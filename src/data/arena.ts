/** [provisional] Arena limits and entity budgets. */
export type ArenaDef = {
  /** Half the side of the square arena, centered at the origin, in world units. */
  halfSize: number
  /** Projectile pool capacity. Shots are skipped when it is full. */
  maxProjectiles: number
}

export const arena: ArenaDef = {
  halfSize: 30,
  maxProjectiles: 256,
}
