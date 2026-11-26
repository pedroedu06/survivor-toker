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
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshLambertMaterial,
  PerspectiveCamera,
  PlaneGeometry,
  Scene,
  WebGLRenderer,
} from 'three'
import type { World } from '../core/world'

/** Camera tilt from the ground plane, in degrees. [provisional] ~55-60 in DESIGN.md. */
const CAMERA_TILT_DEG = 55
const CAMERA_DISTANCE = 18
const MAX_DPR = 2
const PROJECTILE_HEIGHT = 0.9

export type GameRenderer = {
  /** Draws the world, interpolating between the last two sim steps with `alpha`. */
  render(world: World, alpha: number): void
  resize(): void
  dispose(): void
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

  // Placeholder player: capsule + "nose" showing the facing + blob shadow (no shadow maps).
  const player = new Group()
  const body = new Mesh(
    new CapsuleGeometry(0.5, 1, 4, 12),
    new MeshLambertMaterial({ color: 0x4fa3ff }),
  )
  body.position.y = 1
  const nose = new Mesh(
    new BoxGeometry(0.25, 0.25, 0.35),
    new MeshLambertMaterial({ color: 0xffd24f }),
  )
  nose.position.set(0, 1.3, 0.55)
  player.add(body, nose)
  scene.add(player)

  const shadow = new Mesh(
    new CircleGeometry(0.6, 20),
    new MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.35 }),
  )
  shadow.rotation.x = -Math.PI / 2
  shadow.position.y = 0.02
  scene.add(shadow)

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
  const tmp = new Matrix4()

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
      shadow.position.x = px
      shadow.position.z = pz

      camera.position.set(px, camOffsetY, pz + camOffsetZ)
      camera.lookAt(px, 0, pz)

      let n = 0
      const pool = world.projectiles
      for (let i = 0; i < pool.length; i++) {
        const pr = pool[i]
        if (!pr?.active) continue
        tmp.makeTranslation(
          pr.prevX + (pr.x - pr.prevX) * alpha,
          PROJECTILE_HEIGHT,
          pr.prevZ + (pr.z - pr.prevZ) * alpha,
        )
        projectiles.setMatrixAt(n++, tmp)
      }
      projectiles.count = n
      projectiles.instanceMatrix.needsUpdate = true

      renderer.render(scene, camera)
    },
    resize,
    dispose() {
      renderer.dispose()
    },
  }
}
