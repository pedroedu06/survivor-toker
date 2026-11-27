import type { World } from '../core/world'
import type { BoxDef } from '../data/maps'

/** Result of `resolveObstacles` (module scratch: no allocation in the loop). */
export const obstacleHit = { x: 0, z: 0, slot: -1 }

/**
 * Pushes a circle out of a box. Returns true if it overlapped; the corrected center goes to
 * `obstacleHit.x/z`.
 */
export function pushOutOfBox(b: BoxDef, x: number, z: number, r: number): boolean {
  const dx = x - b.x
  const dz = z - b.z
  // Quick reject with the box's bounding circle.
  const reach = r + b.hx + b.hz
  if (dx * dx + dz * dz >= reach * reach) return false

  let lx = dx * b.ux + dz * b.uz
  let lz = -dx * b.uz + dz * b.ux
  const cx = Math.max(-b.hx, Math.min(lx, b.hx))
  const cz = Math.max(-b.hz, Math.min(lz, b.hz))
  const ex = lx - cx
  const ez = lz - cz
  const d2 = ex * ex + ez * ez
  if (d2 >= r * r) return false

  if (d2 > 1e-12) {
    const d = Math.sqrt(d2)
    lx = cx + (ex / d) * r
    lz = cz + (ez / d) * r
  } else {
    // Center inside the box: leave by the nearest face.
    const px = b.hx - Math.abs(lx)
    const pz = b.hz - Math.abs(lz)
    if (px < pz) lx = (lx < 0 ? -1 : 1) * (b.hx + r)
    else lz = (lz < 0 ? -1 : 1) * (b.hz + r)
  }
  obstacleHit.x = b.x + lx * b.ux - lz * b.uz
  obstacleHit.z = b.z + lx * b.uz + lz * b.ux
  return true
}

/**
 * Moves a circle out of the map's static obstacles and intact base pieces.
 * Doors that are open let the player through (zombies always collide with an intact door).
 * Writes the result to `obstacleHit` (x, z, and the last base slot touched or -1).
 */
export function resolveObstacles(
  world: World,
  x: number,
  z: number,
  r: number,
  isPlayer: boolean,
): void {
  obstacleHit.slot = -1
  let px = x
  let pz = z
  let touched = -1
  const map = world.map
  const obstacles = map.obstacles
  const slots = map.slots
  // Two passes settle corners where two boxes meet.
  for (let pass = 0; pass < 2; pass++) {
    if (obstacles) {
      for (let i = 0; i < obstacles.length; i++) {
        const b = obstacles[i] as BoxDef
        if (pushOutOfBox(b, px, pz, r)) {
          px = obstacleHit.x
          pz = obstacleHit.z
        }
      }
    }
    if (slots) {
      for (let i = 0; i < slots.length; i++) {
        const s = world.structures[i]
        if (!s || s.hp <= 0) continue
        if (isPlayer && s.open) continue
        if (pushOutOfBox((slots[i] as { box: BoxDef }).box, px, pz, r)) {
          px = obstacleHit.x
          pz = obstacleHit.z
          touched = i
        }
      }
    }
  }
  obstacleHit.x = px
  obstacleHit.z = pz
  obstacleHit.slot = touched
}
