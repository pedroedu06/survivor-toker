/** WASD + arrow keys. Uses `event.code`, so it works on any keyboard layout. */
export type Keyboard = {
  /** Writes the current direction into `out` (each axis in -1..1, not normalized). */
  read(out: { x: number; z: number }): void
  dispose(): void
}

const UP = new Set(['KeyW', 'ArrowUp'])
const DOWN = new Set(['KeyS', 'ArrowDown'])
const LEFT = new Set(['KeyA', 'ArrowLeft'])
const RIGHT = new Set(['KeyD', 'ArrowRight'])

export function createKeyboard(target: Window = window): Keyboard {
  let up = false
  let down = false
  let left = false
  let right = false

  const set = (code: string, pressed: boolean): boolean => {
    if (UP.has(code)) up = pressed
    else if (DOWN.has(code)) down = pressed
    else if (LEFT.has(code)) left = pressed
    else if (RIGHT.has(code)) right = pressed
    else return false
    return true
  }

  const onDown = (e: KeyboardEvent) => {
    if (set(e.code, true)) e.preventDefault()
  }
  const onUp = (e: KeyboardEvent) => {
    set(e.code, false)
  }
  // Without this, switching tabs while holding a key leaves the player walking forever.
  const onBlur = () => {
    up = down = left = right = false
  }

  target.addEventListener('keydown', onDown)
  target.addEventListener('keyup', onUp)
  target.addEventListener('blur', onBlur)

  return {
    read(out) {
      out.x = (right ? 1 : 0) - (left ? 1 : 0)
      out.z = (down ? 1 : 0) - (up ? 1 : 0)
    },
    dispose() {
      target.removeEventListener('keydown', onDown)
      target.removeEventListener('keyup', onUp)
      target.removeEventListener('blur', onBlur)
    },
  }
}
