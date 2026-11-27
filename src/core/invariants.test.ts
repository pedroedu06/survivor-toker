import { describe, expect, test } from 'bun:test'
import { startRound } from '../systems/rounds'
import { checkInvariants } from './invariants'
import { createWorld } from './world'

describe('checkInvariants', () => {
  test('a new world is clean', () => {
    const world = createWorld()
    startRound(world, 1)
    expect(checkInvariants(world)).toEqual([])
  })

  test('detects a counter out of sync with its pool', () => {
    const world = createWorld()
    world.activeEnemies = 3
    expect(checkInvariants(world).join()).toContain('activeEnemies')
  })

  test('detects NaN', () => {
    const world = createWorld()
    world.player.x = Number.NaN
    expect(checkInvariants(world).join()).toContain('player.x is not finite')
  })

  test('detects HP above max and 0 HP without failing', () => {
    const world = createWorld()
    world.player.hp = 500
    expect(checkInvariants(world).join()).toContain('player.hp out of range')
    world.player.hp = 0
    expect(checkInvariants(world).join()).toContain('0 HP')
  })

  test('detects broken round counters and inventory', () => {
    const world = createWorld()
    startRound(world, 1)
    world.round.killed = 99
    world.inventory.healthPotion = 9
    const problems = checkInvariants(world).join()
    expect(problems).toContain('round.killed')
    expect(problems).toContain('inventory.healthPotion')
  })
})
