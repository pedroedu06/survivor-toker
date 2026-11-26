import { describe, expect, test } from 'bun:test'
import { advanceClock, createFixedClock, FIXED_DT, MAX_STEPS_PER_FRAME } from './loop'

const noop = () => {}

describe('advanceClock', () => {
  test('runs no step when less than one fixed step has passed', () => {
    const clock = createFixedClock()
    expect(advanceClock(clock, FIXED_DT * 0.5, noop)).toBe(0)
    expect(clock.alpha).toBeCloseTo(0.5)
  })

  test('accumulates leftover time across frames', () => {
    const clock = createFixedClock()
    advanceClock(clock, FIXED_DT * 0.6, noop)
    expect(advanceClock(clock, FIXED_DT * 0.6, noop)).toBe(1)
    expect(clock.alpha).toBeCloseTo(0.2)
  })

  test('runs exact number of steps for whole multiples', () => {
    const clock = createFixedClock()
    expect(advanceClock(clock, FIXED_DT * 3, noop)).toBe(3)
    expect(clock.tick).toBe(3)
  })

  test('always passes the fixed dt to the step function', () => {
    const clock = createFixedClock()
    const seen: number[] = []
    advanceClock(clock, FIXED_DT * 2, (dt) => seen.push(dt))
    expect(seen).toEqual([FIXED_DT, FIXED_DT])
  })

  test('caps steps per frame after a long stall', () => {
    const clock = createFixedClock()
    expect(advanceClock(clock, 10, noop)).toBe(MAX_STEPS_PER_FRAME)
    // Time beyond the cap is dropped, not carried over.
    expect(advanceClock(clock, 0, noop)).toBe(0)
  })

  test('60 frames of 1/60 s simulate 60 ticks', () => {
    const clock = createFixedClock()
    for (let i = 0; i < 60; i++) advanceClock(clock, 1 / 60, noop)
    expect(clock.tick).toBe(60)
  })

  test('120 Hz display still simulates at 60 Hz', () => {
    const clock = createFixedClock()
    for (let i = 0; i < 120; i++) advanceClock(clock, 1 / 120, noop)
    expect(clock.tick).toBe(60)
  })
})
