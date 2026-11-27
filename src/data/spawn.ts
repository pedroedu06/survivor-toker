/** [provisional] How many zombies can be alive. Where they come from is in `maps.ts`. */
export type SpawnDef = {
  /** Max zombies alive at once (performance budget in DESIGN.md: ~120). */
  maxAlive: number
}

export const spawn: SpawnDef = {
  maxAlive: 120,
}
