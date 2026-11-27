/** [provisional] Where and how many zombies can be alive. Pacing comes from `rounds.ts`. */
export type SpawnDef = {
  /** Max zombies alive at once (performance budget in DESIGN.md: ~120). */
  maxAlive: number
  /** Spawn ring around the player, outside the camera view. */
  minDistance: number
  maxDistance: number
}

export const spawn: SpawnDef = {
  maxAlive: 120,
  minDistance: 14,
  maxDistance: 18,
}
