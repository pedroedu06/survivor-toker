import { describe, expect, test } from 'bun:test'
import { createInputState } from './input'
import { FIXED_DT } from './loop'
import { createRng } from './rng'
import { stepWorld } from './step'
import { createWorld } from './world'

function simulate(seed: number, steps: number) {
  const rng = createRng(seed)
  const world = createWorld()
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
  test('same inputs produce the same state (determinism)', () => {
    const a = simulate(123, 60 * 20)
    const b = simulate(123, 60 * 20)
    expect(a.player).toEqual(b.player)
    expect(a.projectiles).toEqual(b.projectiles)
    expect(a.tick).toBe(60 * 20)
  })

  test('saves the previous player position for interpolation', () => {
    const world = createWorld()
    const input = { ...createInputState(), moveX: 1 }
    stepWorld(world, input, FIXED_DT)
    const x1 = world.player.x
    stepWorld(world, input, FIXED_DT)
    expect(world.player.prevX).toBe(x1)
  })

  test('activeProjectiles matches the pool', () => {
    const world = simulate(7, 60 * 10)
    expect(world.activeProjectiles).toBe(world.projectiles.filter((p) => p.active).length)
  })
})
