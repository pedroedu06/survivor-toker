import { describe, expect, test } from 'bun:test'
import { createWorld, type World } from '../core/world'
import { updateCollision } from './collision'
import { rebuildEnemyHash } from './enemies'

function setup(): World {
  const world = createWorld()
  const e = world.enemies[0]
  if (!e) throw new Error('no slot')
  e.active = true
  e.x = 5
  e.z = 0
  e.hp = world.enemyDef.hp
  world.activeEnemies = 1
  rebuildEnemyHash(world)
  return world
}

function shootAt(world: World, x: number, z: number) {
  const p = world.projectiles.find((p) => !p.active)
  if (!p) throw new Error('pool full')
  p.active = true
  p.x = x
  p.z = z
  p.life = 1
  world.activeProjectiles++
  return p
}

describe('updateCollision', () => {
  test('a hit deals damage and consumes the projectile', () => {
    const world = setup()
    const p = shootAt(world, 5.1, 0)
    updateCollision(world)
    expect(p.active).toBe(false)
    expect(world.activeProjectiles).toBe(0)
    expect(world.enemies[0]?.hp).toBe(world.enemyDef.hp - world.weapon.damage)
  })

  test('hp hits kill the zombie and count a kill', () => {
    const world = setup()
    for (let i = 0; i < world.enemyDef.hp; i++) {
      shootAt(world, 5, 0)
      updateCollision(world)
    }
    expect(world.enemies[0]?.active).toBe(false)
    expect(world.activeEnemies).toBe(0)
    expect(world.kills).toBe(1)
  })

  test('a miss does nothing', () => {
    const world = setup()
    const p = shootAt(world, 7, 0)
    updateCollision(world)
    expect(p.active).toBe(true)
    expect(world.enemies[0]?.hp).toBe(world.enemyDef.hp)
  })

  test('one projectile hits only one zombie', () => {
    const world = setup()
    const b = world.enemies[1]
    if (!b) throw new Error('no slot')
    b.active = true
    b.x = 5
    b.z = 0.2
    b.hp = world.enemyDef.hp
    world.activeEnemies = 2
    rebuildEnemyHash(world)
    shootAt(world, 5, 0.1)
    updateCollision(world)
    const damaged = world.enemies.filter((e) => e.active && e.hp < world.enemyDef.hp)
    expect(damaged.length).toBe(1)
  })
})
