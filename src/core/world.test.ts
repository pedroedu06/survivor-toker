import { describe, expect, test } from 'bun:test'
import { createInputState } from './input'
import { FIXED_DT } from './loop'
import { stepWorld } from './step'
import { createWorld, resetWorld } from './world'

describe('resetWorld', () => {
  test('play again starts with full HP and shield', () => {
    const world = createWorld()
    world.player.hp = 0
    world.player.shield = 0
    world.round.phase = 'failed'
    world.round.failReason = 'died'
    resetWorld(world)
    expect(world.player.hp).toBe(world.playerDef.maxHp)
    expect(world.player.shield).toBe(world.playerDef.maxShield)
    expect(world.round.failReason).toBeNull()
  })

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
    expect(played.round.failReason).toBe(fresh.round.failReason)
    expect(played.enemies).toEqual(fresh.enemies)
    expect(played.round).toEqual(fresh.round)
    expect(played.kills).toBe(fresh.kills)
    // Same pool arrays are reused, not reallocated.
    expect([played.projectiles, played.enemies]).toEqual(pools)
    expect(played.projectiles).toBe(pools[0] as typeof played.projectiles)
  })
})
