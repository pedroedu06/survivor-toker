/**
 * [provisional] The player's base (walls, doors, turrets): tiers, life and prices.
 * Wall life is still to be defined by the user after seeing it in game ("Base" in DESIGN.md).
 */
export type BaseTierDef = {
  /** 1 wood, 2 wood + iron plates, 3 full metal, 4 titanium (matches the prefab names `_t<n>`). */
  tier: number
  /** Life of each piece (wall section or door) at this tier. */
  hp: number
  /** Price to upgrade a whole side TO this tier (0 for the starting tier). */
  upgradePrice: number
}

export type BaseDef = {
  tiers: readonly BaseTierDef[]
  /**
   * Life fraction at or below which each damage phase shows (d1, d2, d3). Phase 4 (destroyed)
   * is life 0: the piece stops blocking.
   */
  phaseThresholds: readonly [number, number, number]
  /** Doors open while the player is within this distance of the door center. */
  doorOpenRadius: number
  /** Repair price per missing life point (rounded up). */
  repairPricePerHp: number
}

export const base: BaseDef = {
  tiers: [
    { tier: 1, hp: 150, upgradePrice: 0 },
    { tier: 2, hp: 300, upgradePrice: 80 },
    { tier: 3, hp: 600, upgradePrice: 180 },
    { tier: 4, hp: 1000, upgradePrice: 400 },
  ],
  phaseThresholds: [0.8, 0.55, 0.3],
  doorOpenRadius: 2,
  repairPricePerHp: 0.1,
}

export function tierDef(tier: number): BaseTierDef {
  const tiers = base.tiers
  return tiers[Math.max(0, Math.min(tiers.length - 1, tier - 1))] as BaseTierDef
}

/** Damage phase of a piece: 0 intact, 1..3 damaged, 4 destroyed. */
export function damagePhase(hp: number, maxHp: number): number {
  if (hp <= 0) return 4
  const f = hp / maxHp
  const [d1, d2, d3] = base.phaseThresholds
  if (f <= d3) return 3
  if (f <= d2) return 2
  if (f <= d1) return 1
  return 0
}
