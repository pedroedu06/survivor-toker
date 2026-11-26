/** Simulation runs at a fixed 60 Hz, independent of the display refresh rate. */
export const FIXED_DT = 1 / 60

/** Max simulation steps per rendered frame. Prevents the "spiral of death" after a long stall. */
export const MAX_STEPS_PER_FRAME = 5

const EPSILON = 1e-9

export type FixedClock = {
  /** Unsimulated time carried over to the next frame, in seconds. */
  accumulator: number
  /** Interpolation factor in [0, 1) between the previous and current sim state, for rendering. */
  alpha: number
  /** Total fixed steps simulated so far. */
  tick: number
}

export function createFixedClock(): FixedClock {
  return { accumulator: 0, alpha: 0, tick: 0 }
}

/**
 * Feeds real elapsed time into the clock and runs `step` as many fixed steps as needed.
 * Mutates `clock` in place (no allocation per frame). Returns the number of steps run.
 */
export function advanceClock(
  clock: FixedClock,
  frameDt: number,
  step: (dt: number) => void,
): number {
  const maxDt = FIXED_DT * MAX_STEPS_PER_FRAME
  clock.accumulator += Math.min(Math.max(frameDt, 0), maxDt)

  let steps = 0
  while (clock.accumulator + EPSILON >= FIXED_DT && steps < MAX_STEPS_PER_FRAME) {
    step(FIXED_DT)
    clock.accumulator -= FIXED_DT
    clock.tick++
    steps++
  }
  if (clock.accumulator < 0) clock.accumulator = 0

  clock.alpha = clock.accumulator / FIXED_DT
  return steps
}
