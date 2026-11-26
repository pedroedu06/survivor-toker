/** [provisional] Continuous spawn until rounds exist (Phase 2). */
export type SpawnDef = {
  /** Seconds between spawns. */
  interval: number
  /** Max zombies alive at once (performance budget in DESIGN.md: ~120). */
  maxAlive: number
  /** Spawn ring around the player, outside the camera view. */
  minDistance: number
  maxDistance: number
}

export const spawn: SpawnDef = {
  interval: 0.4,
  maxAlive: 120,
  minDistance: 14,
  maxDistance: 18,
}
