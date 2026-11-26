import { describe, expect, test } from 'bun:test'
import { FIXED_DT } from '../core/loop'
import { createWorld } from '../core/world'
import { updateSpawn } from './spawn'

describe('updateSpawn', () => {
  test('spawns one zombie per interval', () => {
    const world = createWorld()
    // First spawn is immediate, then one every interval.
    for (let i = 0; i < 60; i++) updateSpawn(world, FIXED_DT)
    expect(world.activeEnemies).toBe(Math.floor(1 / world.spawnDef.interval) + 1)
  })

  test('respects maxAlive', () => {
    const world = createWorld({
      spawnDef: { interval: 0.01, maxAlive: 5, minDistance: 14, maxDistance: 18 },
    })
    for (let i = 0; i < 600; i++) updateSpawn(world, FIXED_DT)
    expect(world.activeEnemies).toBe(5)
  })

  test('spawns on the ring around the player when inside the arena', () => {
    const world = createWorld()
    for (let i = 0; i < 600; i++) updateSpawn(world, FIXED_DT)
    for (const e of world.enemies.filter((e) => e.active)) {
      const d = Math.hypot(e.x, e.z)
      expect(d).toBeGreaterThanOrEqual(world.spawnDef.minDistance - 1e-9)
      expect(d).toBeLessThanOrEqual(world.spawnDef.maxDistance + 1e-9)
    }
  })

  test('is clamped inside the arena near the edge', () => {
    const world = createWorld()
    world.player.x = 29
    world.player.z = 29
    for (let i = 0; i < 600; i++) updateSpawn(world, FIXED_DT)
    const limit = world.arena.halfSize - world.enemyDef.radius
    for (const e of world.enemies.filter((e) => e.active)) {
      expect(Math.abs(e.x)).toBeLessThanOrEqual(limit)
      expect(Math.abs(e.z)).toBeLessThanOrEqual(limit)
    }
  })

  test('same seed spawns in the same places', () => {
    const run = (seed: number) => {
      const world = createWorld({ seed })
      for (let i = 0; i < 300; i++) updateSpawn(world, FIXED_DT)
      return world.enemies.map((e) => [e.x, e.z])
    }
    expect(run(5)).toEqual(run(5))
    expect(run(5)).not.toEqual(run(6))
  })
})
