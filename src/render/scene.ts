import {
  AmbientLight,
  BoxGeometry,
  CapsuleGeometry,
  CircleGeometry,
  Color,
  DirectionalLight,
  GridHelper,
  Group,
  InstancedMesh,
  Mesh,
  MeshBasicMaterial,
  MeshLambertMaterial,
  Object3D,
  PerspectiveCamera,
  Plane,
  PlaneGeometry,
  Raycaster,
  Scene,
  Vector2,
  Vector3,
  WebGLRenderer,
} from 'three'
import type { World } from '../core/world'

/** Camera tilt from the ground plane, in degrees. [provisional] ~55-60 in DESIGN.md. */
const CAMERA_TILT_DEG = 55
/** [provisional] Tuned for ~1.1-tall characters on a phone screen. */
const CAMERA_DISTANCE = 13
const MAX_DPR = 2
/** Chest height of a ~1.1-tall character. */
const PROJECTILE_HEIGHT = 0.6
const SHADOW_OPACITY = 0.35
const PLAYER_COLOR = 0x4fa3ff
const HURT_COLOR = 0xffffff
/** Color toggles per second while the player is invulnerable after a hit. */
const HURT_BLINK_HZ = 16

export type GameRenderer = {
  /** Draws the world, interpolating between the last two sim steps with `alpha`. */
  render(world: World, alpha: number): void
  /** Projects a screen point (CSS px) onto the plane where projectiles fly. */
  screenToGround(clientX: number, clientY: number, out: { x: number; z: number }): boolean
  resize(): void
  /** Draw calls and triangles of the last rendered frame. */
  stats(out: { drawCalls: number; triangles: number }): void
  dispose(): void
}

/** Capsule with its base at y = 0 (origin at the feet, like the future Blender models). */
function footCapsule(radius: number, height: number): CapsuleGeometry {
  const geo = new CapsuleGeometry(radius, Math.max(0, height - radius * 2), 4, 12)
  geo.translate(0, height / 2, 0)
  return geo
}

function shadowDisc(radius: number): CircleGeometry {
  const geo = new CircleGeometry(radius, 20)
  geo.rotateX(-Math.PI / 2)
  geo.translate(0, 0.02, 0)
  return geo
}

export function createGameRenderer(canvas: HTMLCanvasElement, world: World): GameRenderer {
  const renderer = new WebGLRenderer({
    canvas,
    antialias: true,
    powerPreference: 'high-performance',
  })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, MAX_DPR))

  const scene = new Scene()
  scene.background = new Color(0x1b1f2a)

  const camera = new PerspectiveCamera(50, 1, 0.1, 200)
  const tilt = (CAMERA_TILT_DEG * Math.PI) / 180
  const camOffsetY = Math.sin(tilt) * CAMERA_DISTANCE
  const camOffsetZ = Math.cos(tilt) * CAMERA_DISTANCE

  scene.add(new AmbientLight(0xffffff, 0.6))
  const sun = new DirectionalLight(0xffffff, 1.2)
  sun.position.set(5, 10, 4)
  scene.add(sun)

  // Ground on the (x, z) plane — game logic is 2D on this plane.
  const arenaSize = world.arena.halfSize * 2
  const ground = new Mesh(
    new PlaneGeometry(arenaSize, arenaSize),
    new MeshLambertMaterial({ color: 0x3a4a3a }),
  )
  ground.rotation.x = -Math.PI / 2
  scene.add(ground)

  const grid = new GridHelper(arenaSize, arenaSize / 2, 0x556655, 0x445544)
  grid.position.y = 0.01
  scene.add(grid)

  const shadowMat = new MeshBasicMaterial({
    color: 0x000000,
    transparent: true,
    opacity: SHADOW_OPACITY,
    depthWrite: false,
  })

  // Placeholder player: capsule + "nose" showing the facing + blob shadow (no shadow maps).
  const pDef = world.playerDef
  const player = new Group()
  const bodyMat = new MeshLambertMaterial({ color: PLAYER_COLOR })
  const body = new Mesh(footCapsule(pDef.radius, pDef.height), bodyMat)
  const nose = new Mesh(
    new BoxGeometry(0.22, 0.22, 0.3),
    new MeshLambertMaterial({ color: 0xffd24f }),
  )
  nose.position.set(0, pDef.height * 0.7, pDef.radius + 0.05)
  const playerShadow = new Mesh(shadowDisc(pDef.radius * 1.2), shadowMat)
  player.add(body, nose, playerShadow)
  scene.add(player)

  // Zombies: one instanced draw call for bodies, one for shadows.
  const eDef = world.enemyDef
  const maxEnemies = world.enemies.length
  const zombies = new InstancedMesh(
    footCapsule(eDef.radius, eDef.height),
    new MeshLambertMaterial({ color: 0xd9534f }),
    maxEnemies,
  )
  const zombieShadows = new InstancedMesh(shadowDisc(eDef.radius * 1.2), shadowMat, maxEnemies)
  for (const mesh of [zombies, zombieShadows]) {
    mesh.frustumCulled = false
    mesh.count = 0
    scene.add(mesh)
  }

  // Projectiles: one instanced draw call for the whole pool.
  const size = world.weapon.projectileSize
  const projectiles = new InstancedMesh(
    new BoxGeometry(size, size, size),
    new MeshBasicMaterial({ color: 0xffe066 }),
    world.projectiles.length,
  )
  projectiles.frustumCulled = false
  projectiles.count = 0
  scene.add(projectiles)

  // Reused for instance matrices (no allocation per frame).
  const dummy = new Object3D()

  // Reused for mouse aim picking.
  const raycaster = new Raycaster()
  const ndc = new Vector2()
  const aimPlane = new Plane(new Vector3(0, 1, 0), -PROJECTILE_HEIGHT)
  const hit = new Vector3()

  const resize = () => {
    const w = canvas.clientWidth
    const h = canvas.clientHeight
    renderer.setSize(w, h, false)
    camera.aspect = w / h
    camera.updateProjectionMatrix()
  }
  resize()

  return {
    render(world, alpha) {
      const p = world.player
      const px = p.prevX + (p.x - p.prevX) * alpha
      const pz = p.prevZ + (p.z - p.prevZ) * alpha

      player.position.set(px, 0, pz)
      player.rotation.y = Math.atan2(p.facingX, p.facingZ)

      // Blink while invulnerable after a hit.
      const hurtFlash = p.hurtTimer > 0 && Math.floor(p.hurtTimer * HURT_BLINK_HZ) % 2 === 0
      bodyMat.color.setHex(hurtFlash ? HURT_COLOR : PLAYER_COLOR)

      camera.position.set(px, camOffsetY, pz + camOffsetZ)
      camera.lookAt(px, 0, pz)

      // Zombies (facing the player).
      let n = 0
      const enemies = world.enemies
      dummy.rotation.set(0, 0, 0)
      for (let i = 0; i < enemies.length; i++) {
        const e = enemies[i]
        if (!e?.active) continue
        const ex = e.prevX + (e.x - e.prevX) * alpha
        const ez = e.prevZ + (e.z - e.prevZ) * alpha
        dummy.position.set(ex, 0, ez)
        dummy.rotation.y = Math.atan2(px - ex, pz - ez)
        dummy.updateMatrix()
        zombies.setMatrixAt(n, dummy.matrix)
        zombieShadows.setMatrixAt(n, dummy.matrix)
        n++
      }
      zombies.count = n
      zombieShadows.count = n
      zombies.instanceMatrix.needsUpdate = true
      zombieShadows.instanceMatrix.needsUpdate = true

      // Projectiles.
      n = 0
      const pool = world.projectiles
      dummy.rotation.set(0, 0, 0)
      for (let i = 0; i < pool.length; i++) {
        const pr = pool[i]
        if (!pr?.active) continue
        dummy.position.set(
          pr.prevX + (pr.x - pr.prevX) * alpha,
          PROJECTILE_HEIGHT,
          pr.prevZ + (pr.z - pr.prevZ) * alpha,
        )
        dummy.updateMatrix()
        projectiles.setMatrixAt(n++, dummy.matrix)
      }
      projectiles.count = n
      projectiles.instanceMatrix.needsUpdate = true

      renderer.render(scene, camera)
    },
    screenToGround(clientX, clientY, out) {
      const rect = canvas.getBoundingClientRect()
      ndc.set(
        ((clientX - rect.left) / rect.width) * 2 - 1,
        -((clientY - rect.top) / rect.height) * 2 + 1,
      )
      raycaster.setFromCamera(ndc, camera)
      if (!raycaster.ray.intersectPlane(aimPlane, hit)) return false
      out.x = hit.x
      out.z = hit.z
      return true
    },
    resize,
    stats(out) {
      out.drawCalls = renderer.info.render.calls
      out.triangles = renderer.info.render.triangles
    },
    dispose() {
      renderer.dispose()
    },
  }
}
