import { advanceClock, createFixedClock } from './core/loop'
import { stepWorld } from './core/step'
import { createWorld } from './core/world'
import { createDebugOverlay, isDebugEnabled } from './dev/debug'
import { createGameRenderer } from './render/scene'
import { createInputSource } from './ui/input'

const canvas = document.querySelector<HTMLCanvasElement>('#game')
const ui = document.querySelector<HTMLElement>('#ui')
if (!canvas || !ui) throw new Error('Missing #game canvas or #ui root')

const world = createWorld()
const input = createInputSource(ui)
const renderer = createGameRenderer(canvas, world)
const debug = isDebugEnabled() ? createDebugOverlay(ui) : null
const clock = createFixedClock()

const step = (dt: number) => stepWorld(world, input.state, dt)

let last = performance.now()
const frame = (now: number) => {
  const frameDt = (now - last) / 1000
  last = now

  input.poll()
  advanceClock(clock, frameDt, step)

  renderer.render(world, clock.alpha)
  debug?.frame(now, world.tick, world.activeProjectiles)

  requestAnimationFrame(frame)
}
requestAnimationFrame(frame)

window.addEventListener('resize', renderer.resize)
