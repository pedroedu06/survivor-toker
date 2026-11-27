import { describe, expect, test } from 'bun:test'
import { createInputState } from '../core/input'
import { FIXED_DT } from '../core/loop'
import { createWorld } from '../core/world'
import { coinsPerKill, payRoundReward } from './economy'
import { startRound, updateRounds } from './rounds'

describe('coinsPerKill', () => {
  test('round 1 pays the base value', () => {
    expect(coinsPerKill(createWorld(), 1)).toBe(3)
  })

  test('grows with the round', () => {
    const world = createWorld()
    expect(coinsPerKill(world, 10)).toBe(6)
    expect(coinsPerKill(world, 100)).toBe(33)
    expect(coinsPerKill(world, 50)).toBeGreaterThan(coinsPerKill(world, 10))
  })
})

describe('payRoundReward', () => {
  test('clearing a round pays kills x coins per kill', () => {
    const world = createWorld()
    startRound(world, 1)
    world.round.killed = world.round.total // 8 kills
    updateRounds(world, createInputState(), FIXED_DT)
    expect(world.round.phase).toBe('intermission')
    expect(world.coins).toBe(24)
    expect(world.round.lastReward).toBe(24)
  })

  test('coins add up across rounds', () => {
    const world = createWorld()
    startRound(world, 1)
    world.round.killed = 8
    payRoundReward(world)
    startRound(world, 10)
    world.round.killed = 26
    payRoundReward(world)
    expect(world.coins).toBe(24 + 26 * 6)
  })

  test('failing a round pays nothing', () => {
    const world = createWorld()
    startRound(world, 1)
    world.round.killed = 3
    world.round.timer = FIXED_DT / 2
    updateRounds(world, createInputState(), FIXED_DT)
    expect(world.round.phase).toBe('failed')
    expect(world.coins).toBe(0)
  })
})
