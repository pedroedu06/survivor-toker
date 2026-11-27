/** [provisional] Round rules. Tune by playing. See "Gameplay" in DESIGN.md. */
export type RoundsDef = {
  /** Time limit of a round, in seconds. Running out with zombies alive = mission failed. */
  duration: number
  /** Break between rounds, in seconds (can be skipped). */
  intermission: number
  /** Zombies in a round: baseCount + countPerRound * round. */
  baseCount: number
  countPerRound: number
  /** Zombie HP: enemy base hp * hpGrowth ^ round. */
  hpGrowth: number
  /** Seconds between spawns: start - perRound * round, never below min. */
  spawnIntervalStart: number
  spawnIntervalPerRound: number
  spawnIntervalMin: number
}

export const rounds: RoundsDef = {
  duration: 300,
  intermission: 60,
  baseCount: 6,
  countPerRound: 2,
  hpGrowth: 1.06,
  spawnIntervalStart: 1.0,
  spawnIntervalPerRound: 0.05,
  spawnIntervalMin: 0.25,
}
