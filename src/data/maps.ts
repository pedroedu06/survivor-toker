import { startBaseData } from './maps/startBase.gen'

/**
 * Maps: size, zombie spawn points and (for Blender maps) obstacles, base slots and hiding spots.
 * See "Maps" in DESIGN.md and MAPS.md. Blender maps are imported with `bun run import-map <id>`,
 * which writes `data/maps/<id>.gen.ts`.
 */
export type SpawnPointDef = {
  id: string
  x: number
  z: number
}

/** Base sides. Index order is used in world arrays (sideTier, turrets). */
export type Side = 'n' | 'e' | 's' | 'w'
export const SIDES: readonly Side[] = ['n', 'e', 's', 'w']

/**
 * Oriented box on the ground (x, z): center, half sizes along its local axes and the unit
 * local x axis `(ux, uz)`. The local z axis is `(-uz, ux)`.
 */
export type BoxDef = {
  x: number
  z: number
  hx: number
  hz: number
  ux: number
  uz: number
}

export type SlotKind = 'wall' | 'door'

/** A breakable piece of the base (wall section or door). */
export type SlotDef = {
  /** Blender object name, e.g. `wall_n1`, `door_ne`. */
  id: string
  kind: SlotKind
  /** Which base wall it belongs to (upgrades are bought per side). */
  side: Side
  /** Collision footprint (from `col_box_<id>`). */
  box: BoxDef
  /** Visual origin (doors: the hinge) and yaw (Three.js rotation.y). */
  x: number
  z: number
  yaw: number
}

/** Where a turret goes when bought (top of a turret block). */
export type TurretSlotDef = {
  side: Side
  x: number
  y: number
  z: number
  yaw: number
}

/**
 * Hiding spots (tree canopies, bushes) as a bit grid over the play area.
 * Cell (i, j) covers x in [-halfSize + i*cellSize, ...), z likewise; bit index = j * cells + i.
 * `hex` packs 4 cells per hex digit, lowest bit first.
 */
export type HideGridDef = {
  cellSize: number
  cells: number
  hex: string
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
  /** Where the player starts (default: the center). */
  playerStart?: { x: number; z: number }
  /** Static, unbreakable obstacles (turret blocks, props). */
  obstacles?: readonly BoxDef[]
  /** Breakable base pieces (walls and doors). */
  slots?: readonly SlotDef[]
  /** Turret positions, at most one per side. */
  turretSlots?: readonly TurretSlotDef[]
  hideGrid?: HideGridDef
}

/** [provisional] Test arena: 4 cardinal points near the edges (walls at 30), no obstacles. */
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

/** Starting map ("Forest" in the final game): wooden base in the center, trees, bushes. */
export const startBase: MapDef = {
  ...startBaseData,
  id: 'startBase',
  spawnSpread: 2.5,
  activePoints: { start: 1, everyRounds: 4 },
}

export const maps: Record<string, MapDef> = { testArena, startBase }

/** Number of active spawn points in round `n` of `map`. */
export function activePointCount(map: MapDef, n: number): number {
  const { start, everyRounds } = map.activePoints
  const count = start + Math.floor(Math.max(0, n - 1) / everyRounds)
  return Math.max(1, Math.min(map.spawnPoints.length, count))
}

/** Decodes a hide grid into one byte per cell (1 = hiding spot). Allocates: call once. */
export function decodeHideGrid(grid: HideGridDef): Uint8Array {
  const out = new Uint8Array(grid.cells * grid.cells)
  for (let d = 0; d < grid.hex.length; d++) {
    const v = Number.parseInt(grid.hex[d] ?? '0', 16)
    for (let b = 0; b < 4; b++) {
      const i = d * 4 + b
      if (i < out.length) out[i] = (v >> b) & 1
    }
  }
  return out
}

/** Index of a side in `SIDES`. */
export function sideIndex(side: Side): number {
  return SIDES.indexOf(side)
}
