import { worldChecksum } from './checksum'
import { createInputState } from './input'
import { createInputPlayback, type RunLog } from './inputLog'
import { checkInvariants } from './invariants'
import { FIXED_DT } from './loop'
import { stepWorld } from './step'
import { createWorld, type World } from './world'

export type ReplayResult = {
  world: World
  checksum: string
  /** True when the final state matches the recorded checksum. */
  matches: boolean
  /** First invariant failure found (when `checkEvery` > 0). */
  firstProblem: { tick: number; problems: string[] } | null
}

/**
 * Re-simulates a recorded run headless. `checkEvery` = check invariants every N ticks
 * (0 = never, 1 = every step).
 */
export function replayRun(log: RunLog, checkEvery = 0): ReplayResult {
  const world = createWorld({ seed: log.seed })
  const playback = createInputPlayback(log)
  const input = createInputState()
  let firstProblem: ReplayResult['firstProblem'] = null

  for (let t = 0; t < log.ticks; t++) {
    playback.read(t, input)
    stepWorld(world, input, FIXED_DT)
    if (!firstProblem && checkEvery > 0 && t % checkEvery === 0) {
      const problems = checkInvariants(world)
      if (problems.length) firstProblem = { tick: world.tick, problems }
    }
  }

  const checksum = worldChecksum(world)
  return { world, checksum, matches: checksum === log.checksum, firstProblem }
}
