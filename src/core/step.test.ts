import { describe, expect, test } from 'bun:test'
import { createInputState } from './input'
import { FIXED_DT } from './loop'
import { createRng } from './rng'
import { stepWorld } from './step'
import { createWorld } from './world'

function simulate(seed: number, steps: number) {
  const rng = createRng(seed)
  const world = createWorld({ seed })
  const input = createInputState()
  for (let i = 0; i < steps; i++) {
    if (i % 30 === 0) {
      input.moveX = rng.range(-1, 1)
      input.moveZ = rng.range(-1, 1)
    }
    stepWorld(world, input, FIXED_DT)
  }
  return world
}

describe('stepWorld', () => {
  test('same seed and inputs produce the same state (determinism)', () => {
    const a = simulate(123, 60 * 30)
    const b = simulate(123, 60 * 30)
    expect(a.player).toEqual(b.player)
    expect(a.projectiles).toEqual(b.projectiles)
    expect(a.enemies).toEqual(b.enemies)
    expect(a.kills).toBe(b.kills)
    expect(a.tick).toBe(60 * 30)
  })

  test('zombies spawn and get killed over time', () => {
    const world = simulate(9, 60 * 60)
    expect(world.activeEnemies).toBeGreaterThan(0)
    expect(world.kills).toBeGreaterThan(0)
  })

  test('saves the previous player position for interpolation', () => {
    const world = createWorld()
    const input = { ...createInputState(), moveX: 1 }
    stepWorld(world, input, FIXED_DT)
    const x1 = world.player.x
    stepWorld(world, input, FIXED_DT)
    expect(world.player.prevX).toBe(x1)
  })

  test('active counters match the pools', () => {
    const world = simulate(7, 60 * 30)
    expect(world.activeProjectiles).toBe(world.projectiles.filter((p) => p.active).length)
    expect(world.activeEnemies).toBe(world.enemies.filter((e) => e.active).length)
  })

  test('performance reference: full horde step time', () => {
    const world = createWorld({
      seed: 3,
      spawnDef: { interval: 0.001, maxAlive: 120, minDistance: 3, maxDistance: 18 },
    })
    const input = createInputState()
    for (let i = 0; i < 60; i++) stepWorld(world, input, FIXED_DT) // fill the horde
    const steps = 600
    const start = performance.now()
    for (let i = 0; i < steps; i++) {
      input.moveX = Math.sin(i / 50)
      input.moveZ = Math.cos(i / 50)
      stepWorld(world, input, FIXED_DT)
    }
    const msPerStep = (performance.now() - start) / steps
    console.log(
      `[perf] ${world.activeEnemies} zombies, ${world.activeProjectiles} projectiles: ${msPerStep.toFixed(3)} ms/step`,
    )
    expect(world.activeEnemies).toBeGreaterThan(100)
    // Generous bound: a 60 Hz frame is 16.7 ms, the sim must use a small slice of it.
    expect(msPerStep).toBeLessThan(4)
  })
})
