import { createInputState, type InputState } from '../core/input'
import { createJoystick } from './joystick'
import { createKeyboard } from './keyboard'

export type InputSource = {
  /** Reused every frame; the simulation reads it on each fixed step. */
  readonly state: InputState
  /** Samples devices into `state`. Call once per rendered frame, before stepping. */
  poll(): void
  dispose(): void
}

/** Merges the virtual joystick (touch/mouse) and the keyboard. Joystick wins while held. */
export function createInputSource(uiRoot: HTMLElement): InputSource {
  const state = createInputState()
  const joystick = createJoystick(uiRoot)
  const keyboard = createKeyboard()
  const dir = { x: 0, z: 0 }

  return {
    state,
    poll() {
      if (joystick.active) joystick.read(dir)
      else keyboard.read(dir)
      state.moveX = dir.x
      state.moveZ = dir.z
    },
    dispose() {
      joystick.dispose()
      keyboard.dispose()
    },
  }
}
