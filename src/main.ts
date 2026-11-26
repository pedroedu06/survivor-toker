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
const renderer = createGameRenderer(canvas, world)
const input = createInputSource(ui, renderer.screenToGround)
const debug = isDebugEnabled() ? createDebugOverlay(ui) : null
const clock = createFixedClock()

const step = (dt: number) => stepWorld(world, input.state, dt)

let last = performance.now()
const frame = (now: number) => {
  const frameDt = (now - last) / 1000
  last = now

  input.poll(world.player.x, world.player.z)
  advanceClock(clock, frameDt, step)

  renderer.render(world, clock.alpha)
  debug?.frame(now, world)

  requestAnimationFrame(frame)
}
requestAnimationFrame(frame)

window.addEventListener('resize', renderer.resize)

// Debug only: lets the console (and the future dev panel) inspect and drive the sim.
if (debug) {
  ;(window as unknown as { __game: unknown }).__game = {
    world,
    input,
    /** Runs `n` fixed steps right now, ignoring real time. */
    advance(n: number) {
      for (let i = 0; i < n; i++) step(1 / 60)
      renderer.render(world, 1)
    },
  }
}
