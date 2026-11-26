/**
 * Floating virtual joystick on the left half of the screen.
 * Appears where the finger touches; works with touch and mouse (Pointer Events).
 */
export type Joystick = {
  /** True while a finger (or mouse button) is holding the stick. */
  readonly active: boolean
  /** Writes the analog direction into `out` (length 0..1, dead zone applied). */
  read(out: { x: number; z: number }): void
  dispose(): void
}

/** Max distance of the knob from the base center, in CSS pixels. */
const RADIUS = 60
/** Fraction of RADIUS ignored near the center. */
const DEAD_ZONE = 0.15

export function createJoystick(parent: HTMLElement): Joystick {
  const zone = document.createElement('div')
  zone.className = 'joystick-zone'
  const base = document.createElement('div')
  base.className = 'joystick-base'
  const knob = document.createElement('div')
  knob.className = 'joystick-knob'
  base.appendChild(knob)
  zone.appendChild(base)
  parent.appendChild(zone)

  let pointerId = -1
  let originX = 0
  let originY = 0
  let dx = 0
  let dy = 0

  const show = (x: number, y: number) => {
    base.style.transform = `translate(${x - RADIUS}px, ${y - RADIUS}px)`
    base.classList.add('visible')
  }

  const moveKnob = () => {
    knob.style.transform = `translate(${dx}px, ${dy}px)`
  }

  const onDown = (e: PointerEvent) => {
    if (pointerId !== -1) return
    pointerId = e.pointerId
    originX = e.clientX
    originY = e.clientY
    dx = 0
    dy = 0
    show(originX, originY)
    moveKnob()
    e.preventDefault()
    try {
      // Keeps receiving moves even if the finger leaves the left half.
      zone.setPointerCapture(e.pointerId)
    } catch {
      // Capture can fail for already-released pointers; the stick still works without it.
    }
  }

  const onMove = (e: PointerEvent) => {
    if (e.pointerId !== pointerId) return
    dx = e.clientX - originX
    dy = e.clientY - originY
    const len = Math.hypot(dx, dy)
    if (len > RADIUS) {
      dx = (dx / len) * RADIUS
      dy = (dy / len) * RADIUS
    }
    moveKnob()
  }

  const onUp = (e: PointerEvent) => {
    if (e.pointerId !== pointerId) return
    pointerId = -1
    dx = 0
    dy = 0
    base.classList.remove('visible')
  }

  zone.addEventListener('pointerdown', onDown)
  zone.addEventListener('pointermove', onMove)
  zone.addEventListener('pointerup', onUp)
  zone.addEventListener('pointercancel', onUp)

  return {
    get active() {
      return pointerId !== -1
    },
    read(out) {
      const len = Math.hypot(dx, dy) / RADIUS
      if (len <= DEAD_ZONE) {
        out.x = 0
        out.z = 0
        return
      }
      // Rescale so output goes smoothly from 0 at the dead zone edge to 1 at the rim.
      const scale = (len - DEAD_ZONE) / (1 - DEAD_ZONE) / len
      out.x = (dx / RADIUS) * scale
      out.z = (dy / RADIUS) * scale
    },
    dispose() {
      zone.remove()
    },
  }
}
