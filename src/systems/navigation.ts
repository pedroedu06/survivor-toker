import {
  NAV_DIAG as DIAG,
  NAV_CELL,
  NAV_INF,
  type NavGrid,
  navCellOf,
  NAV_ORTH as ORTH,
  NAV_SLOT_COST as SLOT_COST,
} from '../core/navGrid'
import type { World } from '../core/world'

/** Minimum ticks between recomputes when the player only moved (~6 per second). */
const RECOMPUTE_TICKS = 10

const NEIGHBOR_DI = Int32Array.of(1, -1, 0, 0, 1, 1, -1, -1)
const NEIGHBOR_DJ = Int32Array.of(0, 0, 1, -1, 1, -1, 1, -1)

/** Zombies closer than this check line of sight and walk straight at the player if clear. */
const DIRECT_RANGE = 12

/** Result of `flowDirection` (module scratch: no allocation in the loop). */
export const flow = { dx: 0, dz: 0, direct: false, nextSlot: -1 }

function slotIntact(world: World, slot: number): boolean {
  return slot >= 0 && (world.structures[slot]?.hp ?? 0) > 0
}

/** Recomputes the field toward the player when needed (new player cell, broken wall...). */
export function updateNavField(world: World): void {
  const nav = world.nav
  if (nav.cooldown > 0) nav.cooldown--
  const cell = navCellOf(nav, world.player.x, world.player.z)
  if (!nav.dirty && (cell === nav.fieldCell || nav.cooldown > 0)) return
  computeField(world, nav, cell)
  nav.fieldCell = cell
  nav.cooldown = RECOMPUTE_TICKS
  nav.dirty = false
}

function computeField(world: World, nav: NavGrid, source: number): void {
  const { cells, dist, bucketHead, entryCell, entryNext, blocked, slotOf, cellCost } = nav
  const n = cells * cells
  const buckets = bucketHead.length
  // Entry cost per cell for the current state of the base.
  const structures = world.structures
  for (let c = 0; c < n; c++) {
    if (blocked[c] === 1) {
      cellCost[c] = -1
      continue
    }
    const slot = slotOf[c] as number
    cellCost[c] = slot >= 0 && (structures[slot]?.hp ?? 0) > 0 ? slot + 1 : 0
  }
  dist.fill(NAV_INF)
  bucketHead.fill(-1)
  dist[source] = 0
  entryCell[0] = source
  entryNext[0] = -1
  bucketHead[0] = 0
  let entries = 1
  let pending = 1

  // Dial's algorithm: costs are small integers, so a circular bucket queue replaces the heap.
  for (let d = 0; pending > 0; d++) {
    const b = d % buckets
    let e = bucketHead[b] as number
    bucketHead[b] = -1
    while (e >= 0) {
      const cell = entryCell[e] as number
      e = entryNext[e] as number
      pending--
      if ((dist[cell] as number) !== d) continue // stale entry
      const ci = cell % cells
      const cj = (cell - ci) / cells
      const here = cellCost[cell] as number
      for (let k = 0; k < 8; k++) {
        const ni = ci + (NEIGHBOR_DI[k] as number)
        const nj = cj + (NEIGHBOR_DJ[k] as number)
        if (ni < 0 || nj < 0 || ni >= cells || nj >= cells) continue
        const nc = nj * cells + ni
        const state = cellCost[nc] as number
        if (state < 0) continue
        // Entering an intact wall/door band (from outside it) costs the break-through price.
        const extra = state > 0 && state !== here ? SLOT_COST : 0
        const diagonal = k >= 4
        // No corner cutting past obstacles or wall/door cells (zombies would snag on them).
        if (
          diagonal &&
          ((cellCost[cj * cells + ni] as number) !== 0 ||
            (cellCost[nj * cells + ci] as number) !== 0)
        )
          continue
        const nd = d + (diagonal ? DIAG : ORTH) + extra
        if (nd < (dist[nc] as number)) {
          dist[nc] = nd
          const nb = nd % buckets
          entryCell[entries] = nc
          entryNext[entries] = bucketHead[nb] as number
          bucketHead[nb] = entries
          entries++
          pending++
        }
      }
    }
  }
}

/**
 * Where a zombie at (x, z) should walk: straight at the player when nothing is in the way,
 * otherwise toward the neighbor cell closest (by the field) to the player.
 * `flow.nextSlot` is the intact base piece in the way (the zombie attacks it), or -1.
 */
export function flowDirection(world: World, x: number, z: number): void {
  const nav = world.nav
  const p = world.player
  const cells = nav.cells
  const c = navCellOf(nav, x, z)
  const d = nav.dist[c] ?? NAV_INF
  flow.nextSlot = -1

  const dx = p.x - x
  const dz = p.z - z
  if (dx * dx + dz * dz < DIRECT_RANGE * DIRECT_RANGE && lineClear(nav, x, z, p.x, p.z)) {
    setDirect(dx, dz)
    return
  }

  // Best neighbor by field cost.
  const ci = c % cells
  const cj = (c - ci) / cells
  let best = -1
  let bestDist = d
  for (let k = 0; k < 8; k++) {
    const ni = ci + (NEIGHBOR_DI[k] ?? 0)
    const nj = cj + (NEIGHBOR_DJ[k] ?? 0)
    if (ni < 0 || nj < 0 || ni >= cells || nj >= cells) continue
    const nc = nj * cells + ni
    if (
      k >= 4 &&
      ((nav.cellCost[cj * cells + ni] as number) !== 0 ||
        (nav.cellCost[nj * cells + ci] as number) !== 0)
    )
      continue
    const nd = nav.dist[nc] ?? NAV_INF
    if (nd < bestDist) {
      bestDist = nd
      best = nc
    }
  }
  if (best < 0) {
    setDirect(p.x - x, p.z - z)
    return
  }
  const bi = best % cells
  const bj = (best - bi) / cells
  const tx = -nav.halfSize + (bi + 0.5) * NAV_CELL
  const tz = -nav.halfSize + (bj + 0.5) * NAV_CELL
  setDirect(tx - x, tz - z)
  flow.direct = false
  const slot = nav.slotOf[best] ?? -1
  if (slotIntact(world, slot)) flow.nextSlot = slot
}

/** True when no obstacle or intact wall cell lies on the segment (sampled every half cell). */
function lineClear(nav: NavGrid, x0: number, z0: number, x1: number, z1: number): boolean {
  const len = Math.sqrt((x1 - x0) * (x1 - x0) + (z1 - z0) * (z1 - z0))
  const steps = Math.ceil(len / (NAV_CELL * 0.5))
  for (let k = 1; k < steps; k++) {
    const t = k / steps
    const c = navCellOf(nav, x0 + (x1 - x0) * t, z0 + (z1 - z0) * t)
    if ((nav.cellCost[c] as number) !== 0) return false
  }
  return true
}

function setDirect(dx: number, dz: number): void {
  const len = Math.sqrt(dx * dx + dz * dz)
  flow.direct = true
  if (len > 1e-6) {
    flow.dx = dx / len
    flow.dz = dz / len
  } else {
    flow.dx = 0
    flow.dz = 0
  }
}
