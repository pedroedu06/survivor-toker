/** [provisional] In-run coins. Paid when a round is cleared. See "Shop" in DESIGN.md. */
export type EconomyDef = {
  /** Coins per kill in round 1. */
  coinsPerKillBase: number
  /** Extra fraction of the base per round after the first (0.1 = +10% per round). */
  coinsGrowthPerRound: number
}

export const economy: EconomyDef = {
  coinsPerKillBase: 3,
  coinsGrowthPerRound: 0.1,
}
