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
}

export const walker: EnemyDef = {
  id: 'walker',
  speed: 2.5,
  radius: 0.42,
  height: 1.0,
  hp: 3,
}

export const enemies = { walker } as const
