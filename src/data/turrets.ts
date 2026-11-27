/** [provisional] Base turrets (bought in the shop, one per side, placed on the turret blocks). */
export type TurretDef = {
  price: number
  /** Targets the nearest zombie within this distance (meters). */
  range: number
  /** Shots per second. */
  fireRate: number
  damage: number
  projectileSpeed: number
  projectileLifetime: number
  /** Radians per second the head turns. */
  turnSpeed: number
  /** Fires only when aimed within this angle of the target (radians). */
  aimTolerance: number
  /** Distance from the turret center to the muzzle, along the barrel. */
  muzzleOffset: number
}

export const turret: TurretDef = {
  price: 200,
  range: 9,
  fireRate: 2,
  damage: 1,
  projectileSpeed: 22,
  projectileLifetime: 0.6,
  turnSpeed: Math.PI * 2,
  aimTolerance: 0.15,
  muzzleOffset: 0.96,
}
