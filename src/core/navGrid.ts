import type { BoxDef, MapDef } from '../data/maps'

/** Navigation cell size in meters (same as the hiding grid). */
export const NAV_CELL = 0.5
/** Unreachable. */
export const NAV_INF = 0x3fffffff
/** Step costs (orthogonal / diagonal) of the flow field. */
export const NAV_ORTH = 10
export const NAV_DIAG = 14
/**
 * Extra cost to enter a cell of an intact wall/door. High, so zombies walk around the base
 * when they can and only go for a wall when the player is shut inside.
 */
export const NAV_SLOT_COST = 400
/** Bucket count: more than the biggest single step cost. */
const NAV_BUCKETS = NAV_SLOT_COST + NAV_DIAG + 1

/**
 * Grid over the play area for the zombie flow field (see systems/navigation.ts).
 * Built once per map; `dist` is recomputed when the player moves to another cell or a base
 * piece breaks/is repaired. Everything is preallocated (no allocation in the loop).
 */
export type NavGrid = {
  halfSize: number
  cells: number
  /** 1 = blocked by an unbreakable obstacle (inflated by the zombie radius). */
  blocked: Uint8Array
  /** Base slot index covering the cell (inflated), -1 = none. */
  slotOf: Int16Array
  /** Cost to reach the player from each cell (NAV_INF = unreachable). */
  dist: Int32Array
  /**
   * Cell state for the current field: -1 blocked, 0 free, k + 1 = intact base slot k.
   * Entering a slot band costs NAV_SLOT_COST once (not per cell), so thick or diagonal pieces
   * (doors) are not more "expensive" than straight walls.
   */
  cellCost: Int32Array
  /**
   * Bucket queue (Dial's algorithm, scratch): one list per cost modulo `bucketHead.length`,
   * linked through `entryNext`; stale entries are skipped.
   */
  bucketHead: Int32Array
  entryCell: Int32Array
  entryNext: Int32Array
  /** Cell the field was computed for (-1 = never). */
  fieldCell: number
  /** Ticks left before the field may be recomputed for a new player cell. */
  cooldown: number
  /** Force a recompute (a base piece broke or was rebuilt, or the run restarted). */
  dirty: boolean
}

/** Distance from (x, z) to the box surface (0 inside). */
export function boxDistance(b: BoxDef, x: number, z: number): number {
  const dx = x - b.x
  const dz = z - b.z
  const lx = dx * b.ux + dz * b.uz
  const lz = -dx * b.uz + dz * b.ux
  const ex = Math.max(0, Math.abs(lx) - b.hx)
  const ez = Math.max(0, Math.abs(lz) - b.hz)
  return Math.sqrt(ex * ex + ez * ez)
}

export function createNavGrid(map: MapDef, halfSize: number, radius: number): NavGrid {
  const cells = Math.round((halfSize * 2) / NAV_CELL)
  const n = cells * cells
  const blocked = new Uint8Array(n)
  const slotOf = new Int16Array(n).fill(-1)
  // Inflate a bit less than the radius so cells along a wall stay walkable for sliding.
  const inflate = radius * 0.8

  const mark = (b: BoxDef, apply: (cell: number) => void) => {
    const reach = Math.max(b.hx, b.hz) + inflate + NAV_CELL
    const i0 = Math.max(0, Math.floor((b.x - reach + halfSize) / NAV_CELL))
    const i1 = Math.min(cells - 1, Math.floor((b.x + reach + halfSize) / NAV_CELL))
    const j0 = Math.max(0, Math.floor((b.z - reach + halfSize) / NAV_CELL))
    const j1 = Math.min(cells - 1, Math.floor((b.z + reach + halfSize) / NAV_CELL))
    for (let j = j0; j <= j1; j++) {
      for (let i = i0; i <= i1; i++) {
        const cx = -halfSize + (i + 0.5) * NAV_CELL
        const cz = -halfSize + (j + 0.5) * NAV_CELL
        if (boxDistance(b, cx, cz) <= inflate) apply(j * cells + i)
      }
    }
  }

  for (const b of map.obstacles ?? []) mark(b, (c) => (blocked[c] = 1))
  ;(map.slots ?? []).forEach((s, index) => {
    mark(s.box, (c) => {
      if (!blocked[c]) slotOf[c] = index
    })
  })

  return {
    halfSize,
    cells,
    blocked,
    slotOf,
    dist: new Int32Array(n).fill(NAV_INF),
    cellCost: new Int32Array(n),
    bucketHead: new Int32Array(NAV_BUCKETS),
    entryCell: new Int32Array(n * 8 + 8),
    entryNext: new Int32Array(n * 8 + 8),
    fieldCell: -1,
    cooldown: 0,
    dirty: true,
  }
}

/** Cell index of a world point (clamped into the grid). */
export function navCellOf(nav: NavGrid, x: number, z: number): number {
  const c = nav.cells
  const i = Math.min(c - 1, Math.max(0, Math.floor((x + nav.halfSize) / NAV_CELL)))
  const j = Math.min(c - 1, Math.max(0, Math.floor((z + nav.halfSize) / NAV_CELL)))
  return j * c + i
}
