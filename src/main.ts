import { advanceClock, createFixedClock } from './core/loop'
import { stepWorld } from './core/step'
import { createWorld, resetWorld } from './core/world'
import { createDebugOverlay, isDebugEnabled } from './dev/debug'
import { createGameRenderer } from './render/scene'
import { startRound } from './systems/rounds'
import { createHud } from './ui/hud'
import { createInputSource } from './ui/input'
import { createShopPanel } from './ui/shop'

const canvas = document.querySelector<HTMLCanvasElement>('#game')
const ui = document.querySelector<HTMLElement>('#ui')
if (!canvas || !ui) throw new Error('Missing #game canvas or #ui root')

/** Outside core/, so Math.random is fine here. The seed is what a replay would record. */
const newSeed = () => (Math.random() * 2 ** 32) >>> 0

const world = createWorld({ seed: newSeed() })
const renderer = createGameRenderer(canvas, world)
const input = createInputSource(ui, renderer.screenToGround)
const hud = createHud(ui, {
  onSkip: () => input.requestSkip(),
  onPlayAgain: () => resetWorld(world, newSeed()),
  onOpenShop: () => shop.open(),
  onUseItem: (id) => input.requestUse(id),
})
const shop = createShopPanel(ui, {
  onBuy: (id) => input.requestBuy(id),
  onUpgrade: (id) => input.requestUpgrade(id),
})
const debug = isDebugEnabled() ? createDebugOverlay(ui) : null
const clock = createFixedClock()

const step = (dt: number) => {
  stepWorld(world, input.state, dt)
  input.consumeCommands()
}

let last = performance.now()
const frame = (now: number) => {
  const frameDt = (now - last) / 1000
  last = now

  input.poll(world.player.x, world.player.z)
  advanceClock(clock, frameDt, step)

  renderer.render(world, clock.alpha)
  hud.update(world, now)
  shop.update(world)
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
      hud.update(world, performance.now())
      shop.update(world)
    },
    /** Jumps straight to round `n`, clearing the zombies alive. */
    startRound(n: number) {
      for (const e of world.enemies) e.active = false
      world.activeEnemies = 0
      startRound(world, n)
    },
    /** Gives in-run coins (to test the shop). */
    addCoins(n: number) {
      world.coins += n
    },
    /** God mode: the player takes no damage. */
    setGod(on: boolean) {
      world.debugGod = on
    },
    /** Same as pressing the "skip" button. */
    skip() {
      input.requestSkip()
    },
  }
}
