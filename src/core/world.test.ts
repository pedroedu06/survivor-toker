import { describe, expect, test } from 'bun:test'
import { createInputState } from './input'
import { FIXED_DT } from './loop'
import { stepWorld } from './step'
import { createWorld, resetWorld } from './world'

describe('resetWorld', () => {
  test('a reset world plays exactly like a new one', () => {
    const input = { ...createInputState(), moveX: 0.5, aimX: 1 }
    const played = createWorld({ seed: 4 })
    for (let i = 0; i < 60 * 20; i++) stepWorld(played, input, FIXED_DT)
    const pools = [played.projectiles, played.enemies]

    resetWorld(played)
    const fresh = createWorld({ seed: 4 })
    for (const w of [played, fresh]) {
      for (let i = 0; i < 60 * 20; i++) stepWorld(w, input, FIXED_DT)
    }

    expect(played.player).toEqual(fresh.player)
    expect(played.enemies).toEqual(fresh.enemies)
    expect(played.round).toEqual(fresh.round)
    expect(played.kills).toBe(fresh.kills)
    // Same pool arrays are reused, not reallocated.
    expect([played.projectiles, played.enemies]).toEqual(pools)
    expect(played.projectiles).toBe(pools[0] as typeof played.projectiles)
  })
})
