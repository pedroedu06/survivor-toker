import { describe, expect, test } from 'bun:test'
import { checkInvariants } from '../core/invariants'
import { createWorld } from '../core/world'
import { applyDevCommands } from './dev'
import { startRound } from './rounds'

function activeRound() {
  const world = createWorld()
  startRound(world, 1)
  return world
}

describe('applyDevCommands', () => {
  test('coins, god, heal, potions', () => {
    const world = activeRound()
    world.player.hp = 10
    world.player.shield = 0
    applyDevCommands(world, 'coins:500; god:1; heal; potions')
    expect(world.coins).toBe(500)
    expect(world.debugGod).toBe(true)
    expect(world.player.hp).toBe(100)
    expect(world.player.shield).toBe(100)
    expect(world.inventory.healthPotion).toBe(1)
    expect(world.inventory.damagePotion).toBe(1)
    applyDevCommands(world, 'god:0')
    expect(world.debugGod).toBe(false)
  })

  test('round:N jumps and clears zombies', () => {
    const world = activeRound()
    applyDevCommands(world, 'spawn:5')
    applyDevCommands(world, 'round:15')
    expect(world.round.number).toBe(15)
    expect(world.activeEnemies).toBe(0)
    expect(checkInvariants(world)).toEqual([])
  })

  test('spawn:N adds zombies to the round; killAll counts them as kills', () => {
    const world = activeRound()
    const total = world.round.total
    applyDevCommands(world, 'spawn:10')
    expect(world.activeEnemies).toBe(10)
    expect(world.round.total).toBe(total + 10)
    applyDevCommands(world, 'killAll')
    expect(world.activeEnemies).toBe(0)
    expect(world.kills).toBe(10)
    expect(checkInvariants(world)).toEqual([])
  })

  test('unknown or broken commands are ignored', () => {
    const world = activeRound()
    applyDevCommands(world, 'nope; coins:abc; round:-3;')
    expect(world.coins).toBe(0)
    expect(world.round.number).toBe(1)
  })
})
