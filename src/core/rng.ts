/**
 * Seeded RNG (mulberry32). The only source of randomness allowed in `core/`.
 * Same seed => same sequence, which is what makes replays and bug reports reproducible.
 */
export type Rng = {
  /** Float in [0, 1). */
  next(): number
  /** Float in [min, max). */
  range(min: number, max: number): number
  /** Integer in [min, max] (inclusive). */
  int(min: number, max: number): number
  /** Current internal state, so a run can be snapshotted and resumed. */
  state(): number
}

export function createRng(seed: number): Rng {
  let s = seed >>> 0

  const next = (): number => {
    s = (s + 0x6d2b79f5) >>> 0
    let t = s
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }

  return {
    next,
    range: (min, max) => min + next() * (max - min),
    int: (min, max) => min + Math.floor(next() * (max - min + 1)),
    state: () => s,
  }
}
