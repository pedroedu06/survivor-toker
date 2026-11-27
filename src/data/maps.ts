/**
 * Maps: size and zombie spawn points. See "Maps" in DESIGN.md.
 * 5 maps at launch; for now only the test arena exists.
 */
export type SpawnPointDef = {
  id: string
  x: number
  z: number
}

export type MapDef = {
  id: string
  /** Half the side of the square map, centered at the origin (screen up = -z). */
  halfSize: number
  spawnPoints: readonly SpawnPointDef[]
  /** Zombies appear at a random spot within this radius of the chosen point. */
  spawnSpread: number
  /**
   * How many spawn points are active in a round:
   * min(points, start + floor((round - 1) / everyRounds)).
   */
  activePoints: { start: number; everyRounds: number }
}

/** [provisional] Test arena: 4 cardinal points near the edges (walls at 30). */
export const testArena: MapDef = {
  id: 'testArena',
  halfSize: 30,
  spawnPoints: [
    { id: 'north', x: 0, z: -25 },
    { id: 'south', x: 0, z: 25 },
    { id: 'east', x: 25, z: 0 },
    { id: 'west', x: -25, z: 0 },
  ],
  spawnSpread: 2.5,
  activePoints: { start: 1, everyRounds: 4 },
}

export const maps = { testArena } as const

/** Number of active spawn points in round `n` of `map`. */
export function activePointCount(map: MapDef, n: number): number {
  const { start, everyRounds } = map.activePoints
  const count = start + Math.floor(Math.max(0, n - 1) / everyRounds)
  return Math.max(1, Math.min(map.spawnPoints.length, count))
}
