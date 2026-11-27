import { describe, expect, test } from 'bun:test'
import { createInputState } from '../core/input'
import { FIXED_DT } from '../core/loop'
import { createWorld } from '../core/world'
import { rounds } from '../data/rounds'
import { startRound, updateRounds } from './rounds'

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
