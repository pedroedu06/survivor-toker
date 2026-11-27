/** [provisional] Enemy definitions. Tune by playing. */
export type EnemyDef = {
  id: string
  /** World units per second. */
  speed: number
  /** Collision radius in world units. */
  radius: number
  /** Visual height in world units (render only). */
  height: number
  hp: number
  /** Damage dealt to the player on contact (see player hurtCooldown). */
  contactDamage: number
  /** Damage per second to a base wall/door the zombie is pushing against. */
  wallDamage: number
  /** Speed multiplier while wandering (the player is hidden). */
  wanderSpeed: number
}

export const walker: EnemyDef = {
  id: 'walker',
  speed: 2.5,
  radius: 0.42,
  height: 1.0,
  hp: 3,
  contactDamage: 10,
  wallDamage: 10,
  wanderSpeed: 0.4,
}

export const enemies = { walker } as const
