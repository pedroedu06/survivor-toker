import { describe, expect, test } from 'bun:test'
import { FIXED_DT } from '../core/loop'
import { createWorld, type WorldOptions } from '../core/world'
import { type MapDef, testArena } from '../data/maps'
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
    const world = roundWorld(30, { spawnDef: { maxAlive: 5 } })
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

  test('zombies spawn only around the active spawn points', () => {
    for (const n of [1, 6, 10, 20]) {
      const world = roundWorld(n)
      const active = world.map.spawnPoints.filter((_, i) => world.round.spawnMask & (1 << i))
      // Spawn one per step without zombies moving: positions stay where they appeared.
      for (let i = 0; i < 60 * 30; i++) updateSpawn(world, FIXED_DT)
      const spawned = world.enemies.filter((e) => e.active)
      expect(spawned.length).toBeGreaterThan(0)
      for (const e of spawned) {
        const near = active.some(
          (p) => Math.hypot(e.x - p.x, e.z - p.z) <= world.map.spawnSpread + 1e-9,
        )
        expect(near).toBe(true)
      }
    }
  })

  test('zombies do not care where the player is', () => {
    const world = roundWorld(13) // all 4 points active
    world.player.x = 25
    world.player.z = -25
    run(world, 60 * 30)
    for (const e of world.enemies.filter((e) => e.active)) {
      expect(Math.hypot(e.x, e.z)).toBeLessThanOrEqual(25 + world.map.spawnSpread + 1e-9)
    }
  })

  test('a spawn point at the edge is clamped inside the arena', () => {
    const edgeMap: MapDef = {
      ...testArena,
      spawnPoints: [{ id: 'corner', x: 30, z: 30 }],
    }
    const world = roundWorld(1, { map: edgeMap })
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
