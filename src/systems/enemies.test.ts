import { describe, expect, test } from 'bun:test'
import { FIXED_DT } from '../core/loop'
import { createWorld, type World } from '../core/world'
import { updateEnemies } from './enemies'

function place(world: World, index: number, x: number, z: number) {
  const e = world.enemies[index]
  if (!e) throw new Error('no slot')
  e.active = true
  e.x = e.prevX = x
  e.z = e.prevZ = z
  e.hp = world.enemyDef.hp
  world.activeEnemies++
  return e
}

describe('updateEnemies', () => {
  test('moves toward the player at speed * dt', () => {
    const world = createWorld()
    const e = place(world, 0, 10, 0)
    updateEnemies(world, FIXED_DT)
    expect(e.x).toBeCloseTo(10 - world.enemyDef.speed * FIXED_DT)
    expect(e.z).toBeCloseTo(0)
    expect(e.prevX).toBe(10)
  })

  test('overlapping zombies push each other apart', () => {
    const world = createWorld()
    world.player.x = -25 // far away so chasing barely matters
    const a = place(world, 0, 10, 0)
    const b = place(world, 1, 10, 0.1)
    updateEnemies(world, FIXED_DT)
    const d = Math.hypot(a.x - b.x, a.z - b.z)
    expect(d).toBeGreaterThanOrEqual(world.enemyDef.radius * 2 - 1e-6)
  })

  test('exactly stacked zombies still separate', () => {
    const world = createWorld()
    world.player.x = -25
    const a = place(world, 0, 10, 0)
    const b = place(world, 1, 10, 0)
    updateEnemies(world, FIXED_DT)
    expect(Math.hypot(a.x - b.x, a.z - b.z)).toBeGreaterThan(0.5)
  })

  test('zombies never overlap the player', () => {
    const world = createWorld()
    for (let i = 0; i < 20; i++) place(world, i, Math.cos(i) * 5, Math.sin(i) * 5)
    for (let s = 0; s < 600; s++) updateEnemies(world, FIXED_DT)
    const minDist = world.enemyDef.radius + world.playerDef.radius
    for (const e of world.enemies.filter((e) => e.active)) {
      expect(Math.hypot(e.x, e.z)).toBeGreaterThanOrEqual(minDist - 1e-6)
    }
  })
})
