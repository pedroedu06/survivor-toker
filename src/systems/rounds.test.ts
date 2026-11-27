import { describe, expect, test } from 'bun:test'
import { createInputState } from '../core/input'
import { FIXED_DT } from '../core/loop'
import { createWorld } from '../core/world'
import { rounds } from '../data/rounds'
import { pickSpawnPoints, startRound, updateRounds } from './rounds'

const noInput = createInputState()

describe('startRound', () => {
  test('round 1 has 6 + 2 = 8 zombies and the full time limit', () => {
    const world = createWorld()
    startRound(world, 1)
    expect(world.round.total).toBe(8)
    expect(world.round.timer).toBe(rounds.duration)
    expect(world.round.phase).toBe('active')
  })

  test('zombie HP grows with 1.06^round', () => {
    const world = createWorld()
    startRound(world, 10)
    expect(world.round.enemyHp).toBeCloseTo(world.enemyDef.hp * 1.06 ** 10)
  })

  test('spawn interval speeds up but never goes below the minimum', () => {
    const world = createWorld()
    startRound(world, 2)
    expect(world.round.spawnInterval).toBeCloseTo(rounds.spawnIntervalStart - 0.1)
    startRound(world, 500)
    expect(world.round.spawnInterval).toBe(rounds.spawnIntervalMin)
  })
})

describe('spawn points per round', () => {
  const bits = (mask: number) => [0, 1, 2, 3].filter((i) => mask & (1 << i))

  test('1 point in rounds 1-4, 2 in 5-8, 3 in 9-12, all 4 from 13', () => {
    const world = createWorld()
    const counts = [1, 4, 5, 8, 9, 12, 13, 50].map((n) => {
      startRound(world, n)
      return bits(world.round.spawnMask).length
    })
    expect(counts).toEqual([1, 1, 2, 2, 3, 3, 4, 4])
  })

  test('picked points are valid and distinct', () => {
    const world = createWorld({ seed: 77 })
    for (let n = 1; n <= 40; n++) {
      pickSpawnPoints(world, n)
      startRound(world, n)
      expect(world.round.spawnMask).toBeGreaterThan(0)
      expect(world.round.spawnMask).toBeLessThan(1 << world.map.spawnPoints.length)
    }
  })

  test('same seed picks the same points', () => {
    const masks = (seed: number) => {
      const world = createWorld({ seed })
      return [1, 2, 3, 6, 10].map((n) => {
        startRound(world, n)
        return world.round.spawnMask
      })
    }
    expect(masks(9)).toEqual(masks(9))
  })

  test('the single early point changes between rounds/seeds (all 4 show up)', () => {
    const seen = new Set<number>()
    for (let seed = 1; seed <= 20; seed++) {
      const world = createWorld({ seed })
      for (let n = 1; n <= 4; n++) {
        startRound(world, n)
        seen.add(world.round.spawnMask)
      }
    }
    expect([...seen].sort()).toEqual([1, 2, 4, 8])
  })
})

describe('updateRounds', () => {
  test('first step starts round 1', () => {
    const world = createWorld()
    expect(world.round.number).toBe(0)
    updateRounds(world, noInput, FIXED_DT)
    expect(world.round.number).toBe(1)
  })

  test('killing every zombie goes to the intermission', () => {
    const world = createWorld()
    startRound(world, 1)
    world.round.killed = world.round.total
    updateRounds(world, noInput, FIXED_DT)
    expect(world.round.phase).toBe('intermission')
    expect(world.round.timer).toBe(rounds.intermission)
  })

  test('the intermission ends and the next round starts', () => {
    const world = createWorld()
    startRound(world, 1)
    world.round.killed = world.round.total
    updateRounds(world, noInput, FIXED_DT)
    for (let i = 0; i < Math.ceil(rounds.intermission / FIXED_DT) + 1; i++) {
      updateRounds(world, noInput, FIXED_DT)
    }
    expect(world.round.number).toBe(2)
    expect(world.round.phase).toBe('active')
    expect(world.round.total).toBe(10)
  })

  test('skip starts the next round right away', () => {
    const world = createWorld()
    startRound(world, 1)
    world.round.killed = world.round.total
    updateRounds(world, noInput, FIXED_DT)
    updateRounds(world, { ...noInput, skipIntermission: true }, FIXED_DT)
    expect(world.round.number).toBe(2)
    expect(world.round.phase).toBe('active')
  })

  test('skip does nothing during an active round', () => {
    const world = createWorld()
    startRound(world, 1)
    updateRounds(world, { ...noInput, skipIntermission: true }, FIXED_DT)
    expect(world.round.number).toBe(1)
    expect(world.round.phase).toBe('active')
  })

  test('time running out with zombies alive fails the mission', () => {
    const world = createWorld()
    startRound(world, 1)
    for (let i = 0; i < Math.ceil(rounds.duration / FIXED_DT) + 1; i++) {
      updateRounds(world, noInput, FIXED_DT)
    }
    expect(world.round.phase).toBe('failed')
    expect(world.round.failReason).toBe('timeUp')
    expect(world.round.timer).toBe(0)
  })
})
