import { describe, expect, test } from 'bun:test'
import { FIXED_DT } from '../core/loop'
import { createWorld, type World } from '../core/world'
import { player as playerDef } from '../data/player'
import { applyDamage, updatePlayerDamage } from './damage'
import { rebuildEnemyHash } from './enemies'
import { startRound } from './rounds'

function withZombieAt(x: number, z: number): World {
  const world = createWorld()
  startRound(world, 1)
  const e = world.enemies[0]
  if (!e) throw new Error('no slot')
  e.active = true
  e.x = x
  e.z = z
  e.hp = 3
  world.activeEnemies = 1
  rebuildEnemyHash(world)
  return world
}

const touching = playerDef.radius + 0.42 // exactly at the separation edge

describe('applyDamage', () => {
  test('shield absorbs first', () => {
    const world = createWorld()
    applyDamage(world, 30)
    expect(world.player.shield).toBe(70)
    expect(world.player.hp).toBe(100)
  })

  test('damage beyond the shield goes to HP', () => {
    const world = createWorld()
    world.player.shield = 5
    applyDamage(world, 30)
    expect(world.player.shield).toBe(0)
    expect(world.player.hp).toBe(75)
  })

  test('HP at 0 fails the mission with reason "died"', () => {
    const world = createWorld()
    startRound(world, 1)
    applyDamage(world, 500)
    expect(world.player.hp).toBe(0)
    expect(world.round.phase).toBe('failed')
    expect(world.round.failReason).toBe('died')
  })

  test('god mode takes no damage', () => {
    const world = createWorld()
    world.debugGod = true
    applyDamage(world, 500)
    expect(world.player.hp).toBe(100)
    expect(world.player.shield).toBe(100)
  })
})

describe('updatePlayerDamage', () => {
  test('a zombie far away does nothing', () => {
    const world = withZombieAt(5, 0)
    updatePlayerDamage(world, FIXED_DT)
    expect(world.player.shield).toBe(100)
  })

  test('a touching zombie deals contact damage', () => {
    const world = withZombieAt(touching, 0)
    updatePlayerDamage(world, FIXED_DT)
    expect(world.player.shield).toBe(100 - world.enemyDef.contactDamage)
  })

  test('invulnerability blocks hits until the cooldown ends', () => {
    const world = withZombieAt(touching, 0)
    updatePlayerDamage(world, FIXED_DT)
    const steps = Math.round(playerDef.hurtCooldown / FIXED_DT)
    for (let i = 0; i < steps - 1; i++) updatePlayerDamage(world, FIXED_DT)
    expect(world.player.shield).toBe(90)
    updatePlayerDamage(world, FIXED_DT)
    updatePlayerDamage(world, FIXED_DT)
    expect(world.player.shield).toBe(80)
  })

  test('HP regenerates only after the delay, up to max', () => {
    const world = createWorld()
    world.player.shield = 0
    applyDamage(world, 50)
    expect(world.player.hp).toBe(50)

    const delaySteps = Math.floor(playerDef.regenDelay / FIXED_DT) - 1
    for (let i = 0; i < delaySteps; i++) updatePlayerDamage(world, FIXED_DT)
    expect(world.player.hp).toBe(50)

    for (let i = 0; i < 60 * 10; i++) updatePlayerDamage(world, FIXED_DT)
    expect(world.player.hp).toBe(playerDef.maxHp)
  })

  test('the shield never regenerates', () => {
    const world = createWorld()
    applyDamage(world, 40)
    for (let i = 0; i < 60 * 30; i++) updatePlayerDamage(world, FIXED_DT)
    expect(world.player.shield).toBe(60)
  })

  test('taking damage restarts the regen wait', () => {
    const world = createWorld()
    world.player.shield = 0
    applyDamage(world, 50)
    for (let i = 0; i < 60 * 3; i++) updatePlayerDamage(world, FIXED_DT)
    applyDamage(world, 10)
    for (let i = 0; i < 60 * 3; i++) updatePlayerDamage(world, FIXED_DT)
    expect(world.player.hp).toBe(40)
  })
})
