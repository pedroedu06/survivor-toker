/**
 * What the simulation receives each fixed step. Kept tiny and serializable:
 * it is the base of the future input log (seed + inputs => replay).
 */
export type InputState = {
  /** Desired movement on x, in [-1, 1]. Screen right = +x. */
  moveX: number
  /** Desired movement on z, in [-1, 1]. Screen up = -z. */
  moveZ: number
  /**
   * Aim direction on the ground plane (any length). (0, 0) = no aim input this step:
   * the player keeps the last aim.
   */
  aimX: number
  aimZ: number
  /** One-step command: skip the current intermission. */
  skipIntermission: boolean
  /** One-step command: buy this shop item id ('' = nothing). */
  buyItem: string
  /** One-step command: use this inventory item id ('' = nothing). */
  useItem: string
  /** One-step command: buy the next level of this weapon upgrade id ('' = nothing). */
  upgradeWeapon: string
}

export function createInputState(): InputState {
  return {
    moveX: 0,
    moveZ: 0,
    aimX: 0,
    aimZ: 0,
    skipIntermission: false,
    buyItem: '',
    useItem: '',
    upgradeWeapon: '',
  }
}
