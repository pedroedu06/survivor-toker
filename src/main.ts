import { advanceClock, createFixedClock, FIXED_DT } from './core/loop'
import { createDebugOverlay, isDebugEnabled } from './dev/debug'
import { createGameRenderer } from './render/scene'

const canvas = document.querySelector<HTMLCanvasElement>('#game')
const ui = document.querySelector<HTMLElement>('#ui')
if (!canvas || !ui) throw new Error('Missing #game canvas or #ui root')

const renderer = createGameRenderer(canvas)
const debug = isDebugEnabled() ? createDebugOverlay(ui) : null
const clock = createFixedClock()

// Placeholder simulation step: real systems (movement, spawn, ...) plug in here in Milestone 1.
const step = (_dt: number) => {}

let last = performance.now()
const frame = (now: number) => {
  const frameDt = (now - last) / 1000
  last = now

  advanceClock(clock, frameDt, step)

  const t = (clock.tick + clock.alpha) * FIXED_DT
  renderer.render(Math.sin(t * 4) * 0.1)
  debug?.frame(now, clock.tick)

  requestAnimationFrame(frame)
}
requestAnimationFrame(frame)

window.addEventListener('resize', renderer.resize)
