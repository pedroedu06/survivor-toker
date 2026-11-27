import {
  AmbientLight,
  BoxGeometry,
  CapsuleGeometry,
  CircleGeometry,
  Color,
  DirectionalLight,
  Fog,
  GridHelper,
  Group,
  HemisphereLight,
  InstancedMesh,
  Mesh,
  MeshBasicMaterial,
  MeshLambertMaterial,
  NeutralToneMapping,
  Object3D,
  PCFSoftShadowMap,
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
import type { MapAssets } from './mapAssets'
import { createMapView, type MapView } from './mapView'
import { createScenery } from './scenery'
import { createSpawnIndicators } from './spawnIndicators'
import { createStructuresView, type StructuresView } from './structuresView'
import { createTurretsView, type TurretPlacement, type TurretsView } from './turretsView'

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
/** [provisional] Lighting: bright sky + warm sun with one shadow map that follows the player. */
const SKY_COLOR = 0x8fd6ff
const FOG_NEAR = 34
const FOG_FAR = 80
const SHADOW_HALF = 16
const SHADOW_MAP_SIZE = 1024
const SUN_OFFSET = { x: -9, y: 18, z: 7 }

export type GameRenderer = {
  /** Draws the world, interpolating between the last two sim steps with `alpha`. */
  render(world: World, alpha: number): void
  /** Projects a screen point (CSS px) onto the plane where projectiles fly. */
  screenToGround(clientX: number, clientY: number, out: { x: number; z: number }): boolean
  resize(): void
  /** Draw calls and triangles of the last rendered frame. */
  stats(out: { drawCalls: number; triangles: number }): void
  /** Turret placement preview (ghosts on the free turret blocks). */
  setTurretPlacement(placement: TurretPlacement): void
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

export type RendererOptions = {
  /** Debug only: draw the spawn point markers on the ground (not in the final game). */
  showSpawnMarkers?: boolean
  /** The map's Blender models (null = placeholder ground and grid). */
  assets?: MapAssets | null
  /** Real-time shadows (sun). Turn off if a phone cannot keep 60 fps. */
  shadows?: boolean
}

export function createGameRenderer(
  canvas: HTMLCanvasElement,
  world: World,
  options: RendererOptions = {},
): GameRenderer {
  const renderer = new WebGLRenderer({
    canvas,
    antialias: true,
    powerPreference: 'high-performance',
  })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, MAX_DPR))
  // Neutral tone mapping keeps the flat colors saturated (ACES washes them out).
  renderer.toneMapping = NeutralToneMapping
  renderer.toneMappingExposure = 1.0
  const shadows = options.shadows ?? true
  renderer.shadowMap.enabled = shadows
  renderer.shadowMap.type = PCFSoftShadowMap

  const assets = options.assets ?? null
  const scene = new Scene()
  scene.background = new Color(assets ? SKY_COLOR : 0x1b1f2a)
  if (assets) scene.fog = new Fog(SKY_COLOR, FOG_NEAR, FOG_FAR)

  const camera = new PerspectiveCamera(50, 1, 0.1, 200)
  const tilt = (CAMERA_TILT_DEG * Math.PI) / 180
  const camOffsetY = Math.sin(tilt) * CAMERA_DISTANCE
  const camOffsetZ = Math.cos(tilt) * CAMERA_DISTANCE

  let mapView: MapView | null = null
  let structuresView: StructuresView | null = null
  let turretsView: TurretsView | null = null
  let placement: TurretPlacement = { active: false, selected: null }
  const sun = new DirectionalLight(0xfff1d6, assets ? 2.1 : 1.2)
  sun.position.set(5, 10, 4)
  scene.add(sun, sun.target)
  if (assets) {
    // Sky-blue from above, grass-green bounce from below: colorful even in the shade.
    scene.add(new HemisphereLight(0xd6f0ff, 0x6f9a3c, 1.25))
    sun.castShadow = shadows
    const cam = sun.shadow.camera
    cam.left = -SHADOW_HALF
    cam.right = SHADOW_HALF
    cam.top = SHADOW_HALF
    cam.bottom = -SHADOW_HALF
    cam.near = 1
    cam.far = 60
    sun.shadow.mapSize.set(SHADOW_MAP_SIZE, SHADOW_MAP_SIZE)
    sun.shadow.bias = -0.0005
    sun.shadow.normalBias = 0.03
    mapView = createMapView(scene, assets)
    createScenery(scene)
    structuresView = createStructuresView(scene, world, assets)
    turretsView = createTurretsView(scene, world, assets)
  } else {
    scene.add(new AmbientLight(0xffffff, 0.6))
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
  }
  let lastRenderMs = performance.now()
  /** What the camera looks at: the player, or the base while placing a turret. */
  const focus = { x: world.player.x, z: world.player.z }
  /** Camera easing toward a new focus (per second). */
  const FOCUS_SPEED = 6
  /** While placing a turret: zoom out and look a bit south so the whole base clears the bar. */
  const PLACEMENT_ZOOM = 1.4
  const PLACEMENT_SHIFT_Z = 3.5
  /** Seconds the camera takes to come back to the player after placing. */
  const RETURN_TIME = 0.5
  let returnTime = 0
  let zoom = 1

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

  // Arc arrows toward the active spawn points (+ ground markers in debug).
  const spawnIndicators = createSpawnIndicators(scene, world, options.showSpawnMarkers ?? false)

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
      const nowMs = performance.now()
      const dt = Math.min(0.1, (nowMs - lastRenderMs) / 1000)
      lastRenderMs = nowMs
      const p = world.player
      const px = p.prevX + (p.x - p.prevX) * alpha
      const pz = p.prevZ + (p.z - p.prevZ) * alpha

      player.position.set(px, 0, pz)
      player.rotation.y = Math.atan2(p.facingX, p.facingZ)

      // Blink while invulnerable after a hit.
      const hurtFlash = p.hurtTimer > 0 && Math.floor(p.hurtTimer * HURT_BLINK_HZ) % 2 === 0
      bodyMat.color.setHex(hurtFlash ? HURT_COLOR : PLAYER_COLOR)

      const fx = placement.active ? (world.map.playerStart?.x ?? 0) : px
      const fz = placement.active ? (world.map.playerStart?.z ?? 0) + PLACEMENT_SHIFT_Z : pz
      zoom += ((placement.active ? PLACEMENT_ZOOM : 1) - zoom) * Math.min(1, dt * FOCUS_SPEED)
      if (Math.abs(zoom - 1) < 0.002) zoom = 1
      if (placement.active) returnTime = RETURN_TIME
      if (placement.active || returnTime > 0) {
        // Ease toward the base, then back to the player for a moment; exact follow otherwise.
        if (!placement.active) returnTime -= dt
        const k = Math.min(1, dt * FOCUS_SPEED)
        focus.x += (fx - focus.x) * k
        focus.z += (fz - focus.z) * k
        if (!placement.active && returnTime <= 0) {
          focus.x = fx
          focus.z = fz
          zoom = 1
        }
      } else {
        focus.x = fx
        focus.z = fz
      }
      camera.position.set(focus.x, camOffsetY * zoom, focus.z + camOffsetZ * zoom)
      camera.lookAt(focus.x, 0, focus.z)
      spawnIndicators.update(world, px, pz, nowMs)
      if (mapView) {
        mapView.update(dt, px, pz)
        // The shadow box follows the player (snapped to texels to avoid shimmering).
        const texel = (SHADOW_HALF * 2) / SHADOW_MAP_SIZE
        const sx = Math.round(focus.x / texel) * texel
        const sz = Math.round(focus.z / texel) * texel
        sun.target.position.set(sx, 0, sz)
        sun.position.set(sx + SUN_OFFSET.x, SUN_OFFSET.y, sz + SUN_OFFSET.z)
      }
      structuresView?.update(world, dt, nowMs)
      turretsView?.update(world, alpha, nowMs, placement)

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
    setTurretPlacement(next) {
      placement = next
    },
    stats(out) {
      out.drawCalls = renderer.info.render.calls
      out.triangles = renderer.info.render.triangles
    },
    dispose() {
      renderer.dispose()
    },
  }
}
