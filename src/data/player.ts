/** [provisional] Player tuning. Tune by playing. */
export type PlayerDef = {
  /** Movement speed in world units per second. */
  speed: number
  /** Collision radius in world units. */
  radius: number
}

export const player: PlayerDef = {
  speed: 6,
  radius: 0.5,
}
