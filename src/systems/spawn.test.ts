import { describe, expect, test } from 'bun:test'
import { FIXED_DT } from '../core/loop'
import { createWorld, type WorldOptions } from '../core/world'
import { startRound } from './rounds'
import { updateSpawn } from './spawn'

function roundWorld(n = 1, options: WorldOptions = {}) {
  const world = createWorld(options)
  startRound(world, n)
  return world
}

const run = (world: ReturnType<typeof createWorld>, steps: number) => {
  for (let i = 0; i < steps; i++) updateSpawn(world, FIXED_DT)
}

describe('updateSpawn', () => {
  test('first zombie spawns right away, then one per spawn interval', () => {
    const world = roundWorld(1)
    run(world, 1)
    expect(world.activeEnemies).toBe(1)
    const interval = world.round.spawnInterval
    run(world, Math.round(interval / FIXED_DT))
    expect(world.activeEnemies).toBe(2)
  })

  test('never spawns more than the round total', () => {
    const world = roundWorld(1)
    run(world, 60 * 60)
    expect(world.round.spawned).toBe(world.round.total)
    expect(world.activeEnemies).toBe(world.round.total)
  })

  test('respects maxAlive; the rest waits', () => {
    const world = roundWorld(30, { spawnDef: { maxAlive: 5, minDistance: 14, maxDistance: 18 } })
    run(world, 60 * 60)
    expect(world.activeEnemies).toBe(5)
    expect(world.round.spawned).toBe(5)
  })

  test('no spawn during intermission or after failing', () => {
    for (const phase of ['intermission', 'failed'] as const) {
      const world = roundWorld(1)
      world.round.phase = phase
      run(world, 600)
      expect(world.activeEnemies).toBe(0)
    }
  })

  test('zombies spawn with the round HP', () => {
    const world = roundWorld(10)
    run(world, 1)
    expect(world.enemies.find((e) => e.active)?.hp).toBeCloseTo(world.round.enemyHp)
  })

  test('spawns on the ring around the player when inside the arena', () => {
    const world = roundWorld(20)
    run(world, 60 * 30)
    for (const e of world.enemies.filter((e) => e.active)) {
      const d = Math.hypot(e.x, e.z)
      expect(d).toBeGreaterThanOrEqual(world.spawnDef.minDistance - 1e-9)
      expect(d).toBeLessThanOrEqual(world.spawnDef.maxDistance + 1e-9)
    }
  })

  test('is clamped inside the arena near the edge', () => {
    const world = roundWorld(20)
    world.player.x = 29
    world.player.z = 29
    run(world, 60 * 30)
    const limit = world.arena.halfSize - world.enemyDef.radius
    for (const e of world.enemies.filter((e) => e.active)) {
      expect(Math.abs(e.x)).toBeLessThanOrEqual(limit)
      expect(Math.abs(e.z)).toBeLessThanOrEqual(limit)
    }
  })

  test('same seed spawns in the same places', () => {
    const positions = (seed: number) => {
      const world = roundWorld(5, { seed })
      run(world, 600)
      return world.enemies.map((e) => [e.x, e.z])
    }
    expect(positions(5)).toEqual(positions(5))
    expect(positions(5)).not.toEqual(positions(6))
  })
})
