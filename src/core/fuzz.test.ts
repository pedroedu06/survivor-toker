import { describe, expect, test } from 'bun:test'
import { soakRun } from '../dev/soak'
import { parseRunText } from './inputLog'
import { replayRun } from './replay'

describe('soak (bot + random commands, invariants every step)', () => {
  for (const seed of [1, 2, 3, 4]) {
    test(`seed ${seed}: 3 minutes of play without invariant failures`, () => {
      const result = soakRun(seed, 60 * 60 * 3)
      expect(result.problem).toBeNull()
      expect(result.world.kills).toBeGreaterThan(0)
    })
  }
})

describe('replay', () => {
  test('a recorded run replays to the exact same state (checksum)', () => {
    const { runText, world } = soakRun(5, 60 * 60 * 2)
    const log = parseRunText(runText)
    const replay = replayRun(log, 60)
    expect(replay.firstProblem).toBeNull()
    expect(replay.matches).toBe(true)
    expect(replay.world.kills).toBe(world.kills)
    expect(replay.world.coins).toBe(world.coins)
  })
})
