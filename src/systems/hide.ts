import type { World } from '../core/world'

/**
 * Hiding in bushes (trees do not hide): standing on a hiding cell hides the player unless a zombie already
 * found them there (`exposed`, set on contact in damage.ts). Leaving the cover clears it.
 */
export function updateHide(world: World): void {
  const p = world.player
  const inCover = isInCover(world, p.x, p.z)
  if (!inCover) p.exposed = false
  p.hidden = inCover && !p.exposed
}

export function isInCover(world: World, x: number, z: number): boolean {
  const grid = world.map.hideGrid
  if (!grid || world.hideCells.length === 0) return false
  const half = world.arena.halfSize
  const i = Math.floor((x + half) / grid.cellSize)
  const j = Math.floor((z + half) / grid.cellSize)
  if (i < 0 || j < 0 || i >= grid.cells || j >= grid.cells) return false
  return world.hideCells[j * grid.cells + i] === 1
}
