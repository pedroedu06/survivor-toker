/** [provisional] Player tuning. Tune by playing. */
export type PlayerDef = {
  /** Movement speed in world units per second. */
  speed: number
  /** Collision radius in world units (~half the visual width). */
  radius: number
  /** Visual height in world units (render only). */
  height: number
}

export const player: PlayerDef = {
  speed: 6,
  radius: 0.45,
  height: 1.1,
}
