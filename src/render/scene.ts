import {
  AmbientLight,
  CapsuleGeometry,
  CircleGeometry,
  Color,
  DirectionalLight,
  GridHelper,
  Mesh,
  MeshBasicMaterial,
  MeshLambertMaterial,
  PerspectiveCamera,
  PlaneGeometry,
  Scene,
  WebGLRenderer,
} from 'three'

/** Camera tilt from the ground plane, in degrees. [provisional] ~55-60 in DESIGN.md. */
const CAMERA_TILT_DEG = 55
const CAMERA_DISTANCE = 18
const MAX_DPR = 2

export type GameRenderer = {
  /** Draws one frame. `bob` is a placeholder animation offset until real sim state exists. */
  render(bob: number): void
  resize(): void
  dispose(): void
}

export function createGameRenderer(canvas: HTMLCanvasElement): GameRenderer {
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
  camera.position.set(0, Math.sin(tilt) * CAMERA_DISTANCE, Math.cos(tilt) * CAMERA_DISTANCE)
  camera.lookAt(0, 0, 0)

  scene.add(new AmbientLight(0xffffff, 0.6))
  const sun = new DirectionalLight(0xffffff, 1.2)
  sun.position.set(5, 10, 4)
  scene.add(sun)

  // Ground on the (x, z) plane — game logic is 2D on this plane.
  const ground = new Mesh(new PlaneGeometry(60, 60), new MeshLambertMaterial({ color: 0x3a4a3a }))
  ground.rotation.x = -Math.PI / 2
  scene.add(ground)

  const grid = new GridHelper(60, 30, 0x556655, 0x445544)
  grid.position.y = 0.01
  scene.add(grid)

  // Placeholder player: capsule + blob shadow (no shadow maps, per DESIGN.md).
  const player = new Mesh(
    new CapsuleGeometry(0.5, 1, 4, 12),
    new MeshLambertMaterial({ color: 0x4fa3ff }),
  )
  player.position.y = 1
  scene.add(player)

  const shadow = new Mesh(
    new CircleGeometry(0.6, 20),
    new MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.35 }),
  )
  shadow.rotation.x = -Math.PI / 2
  shadow.position.y = 0.02
  scene.add(shadow)

  const resize = () => {
    const w = canvas.clientWidth
    const h = canvas.clientHeight
    renderer.setSize(w, h, false)
    camera.aspect = w / h
    camera.updateProjectionMatrix()
  }
  resize()

  return {
    render(bob) {
      player.position.y = 1 + bob
      renderer.render(scene, camera)
    },
    resize,
    dispose() {
      renderer.dispose()
    },
  }
}
