/**
 * What the simulation receives each fixed step. Kept tiny and serializable:
 * it is the base of the future input log (seed + inputs => replay).
 */
export type InputState = {
  /** Desired movement on x, in [-1, 1]. Screen right = +x. */
  moveX: number
  /** Desired movement on z, in [-1, 1]. Screen up = -z. */
  moveZ: number
}

export function createInputState(): InputState {
  return { moveX: 0, moveZ: 0 }
}
