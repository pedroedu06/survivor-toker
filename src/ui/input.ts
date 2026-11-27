import { createInputState, type InputState } from '../core/input'
import { quantizeInput } from '../core/inputLog'
import { createJoystick } from './joystick'
import { createKeyboard } from './keyboard'

/** Projects a screen point (CSS px) onto the ground plane. Returns false if it misses. */
export type ScreenToGround = (
  clientX: number,
  clientY: number,
  out: { x: number; z: number },
) => boolean

export type InputSource = {
  /** Reused every frame; the simulation reads it on each fixed step. */
  readonly state: InputState
  /** Samples devices into `state`. Call once per rendered frame, before stepping. */
  poll(playerX: number, playerZ: number): void
  /** Queues a one-step "skip intermission" command (from the HUD button). */
  requestSkip(): void
  /** Queues a one-step "buy this shop item" command. */
  requestBuy(id: string): void
  /** Queues a one-step "use this inventory item" command. */
  requestUse(id: string): void
  /** Queues a one-step "buy next weapon upgrade level" command. */
  requestUpgrade(id: string): void
  /** Queues a one-step base command (`upgrade:n`, `repair:s`, `turret:e`...). */
  requestBase(cmd: string): void
  /** Queues dev command(s) (see systems/dev.ts). They go through the sim, so replays match. */
  requestDev(cmd: string): void
  /** Call after each simulation step so one-step commands are not repeated. */
  consumeCommands(): void
  dispose(): void
}

/**
 * Twin-stick input.
 * Move: left joystick (touch) wins while held, otherwise WASD/arrows.
 * Aim: right joystick (touch) wins while held, otherwise the mouse cursor (PC).
 * No aim input => aim (0, 0) and the player keeps its last aim.
 */
export function createInputSource(
  uiRoot: HTMLElement,
  screenToGround: ScreenToGround,
): InputSource {
  const state = createInputState()
  const moveStick = createJoystick(uiRoot, 'left')
  const aimStick = createJoystick(uiRoot, 'right')
  const keyboard = createKeyboard()
  const dir = { x: 0, z: 0 }
  const ground = { x: 0, z: 0 }

  let skipRequested = false
  let buyRequested = ''
  let useRequested = ''
  let upgradeRequested = ''
  let baseRequested = ''
  let devRequested = ''
  let mouseActive = false
  let mouseX = 0
  let mouseY = 0
  const onPointerMove = (e: PointerEvent) => {
    if (e.pointerType !== 'mouse') return
    mouseActive = true
    mouseX = e.clientX
    mouseY = e.clientY
  }
  // A touch means we are on a phone (or emulating one): stop following the mouse.
  const onPointerDown = (e: PointerEvent) => {
    if (e.pointerType !== 'mouse') mouseActive = false
  }
  window.addEventListener('pointermove', onPointerMove)
  window.addEventListener('pointerdown', onPointerDown, true)

  return {
    state,
    poll(playerX, playerZ) {
      if (moveStick.active) moveStick.read(dir)
      else keyboard.read(dir)
      state.moveX = dir.x
      state.moveZ = dir.z

      state.aimX = 0
      state.aimZ = 0
      if (aimStick.active) {
        aimStick.read(dir)
        state.aimX = dir.x
        state.aimZ = dir.z
      } else if (mouseActive && screenToGround(mouseX, mouseY, ground)) {
        state.aimX = ground.x - playerX
        state.aimZ = ground.z - playerZ
      }

      // Kept until a step consumes it, even if this frame runs no step.
      if (skipRequested) state.skipIntermission = true
      skipRequested = false
      if (buyRequested) state.buyItem = buyRequested
      if (useRequested) state.useItem = useRequested
      buyRequested = ''
      useRequested = ''
      if (upgradeRequested) state.upgradeWeapon = upgradeRequested
      upgradeRequested = ''
      if (baseRequested) state.base = baseRequested
      baseRequested = ''
      if (devRequested) state.dev = state.dev ? `${state.dev};${devRequested}` : devRequested
      devRequested = ''

      // Round BEFORE the simulation sees it, so the recorded run replays exactly.
      quantizeInput(state)
    },
    requestDev(cmd) {
      devRequested = devRequested ? `${devRequested};${cmd}` : cmd
    },
    requestBuy(id) {
      buyRequested = id
    },
    requestUpgrade(id) {
      upgradeRequested = id
    },
    requestBase(cmd) {
      baseRequested = cmd
    },
    requestUse(id) {
      useRequested = id
    },
    requestSkip() {
      skipRequested = true
    },
    consumeCommands() {
      state.skipIntermission = false
      state.buyItem = ''
      state.useItem = ''
      state.upgradeWeapon = ''
      state.base = ''
      state.dev = ''
    },
    dispose() {
      moveStick.dispose()
      aimStick.dispose()
      keyboard.dispose()
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerdown', onPointerDown, true)
    },
  }
}
