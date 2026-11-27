/** [provisional] Player tuning. Tune by playing. */
export type PlayerDef = {
  /** Movement speed in world units per second. */
  speed: number
  /** Collision radius in world units (~half the visual width). */
  radius: number
  /** Visual height in world units (render only). */
  height: number
  maxHp: number
  /** Absorbs damage before HP. Never regenerates: it is bought in the shop. */
  maxShield: number
  /** Invulnerability after taking a hit, in seconds. */
  hurtCooldown: number
  /** Seconds without taking damage before HP starts regenerating. */
  regenDelay: number
  regenPerSecond: number
}

export const player: PlayerDef = {
  speed: 6,
  radius: 0.45,
  height: 1.1,
  maxHp: 100,
  maxShield: 100,
  hurtCooldown: 0.5,
  regenDelay: 4,
  regenPerSecond: 20,
}
