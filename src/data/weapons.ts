/** [provisional] Weapon definitions. Tune by playing. */
export type WeaponDef = {
  id: string
  /** Shots per second. */
  fireRate: number
  /** World units per second. */
  projectileSpeed: number
  /** Seconds before a projectile disappears. */
  projectileLifetime: number
  /** Cube edge length in world units. */
  projectileSize: number
  /** Damage per hit. */
  damage: number
  /** Distance from the player's center where the projectile spawns. */
  spawnOffset: number
}

export const pistol: WeaponDef = {
  id: 'pistol',
  fireRate: 4,
  projectileSpeed: 20,
  projectileLifetime: 0.8,
  projectileSize: 0.25,
  spawnOffset: 0.7,
  damage: 1,
}

export const weapons = { pistol } as const
