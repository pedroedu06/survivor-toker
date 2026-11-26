import type { InputState } from '../core/input'
import type { World } from '../core/world'

/** Below this input length the player keeps its previous facing. */
const FACING_THRESHOLD = 0.1

export function updateMovement(world: World, input: InputState, dt: number): void {
  const p = world.player
  let mx = input.moveX
  let mz = input.moveZ
  const len = Math.hypot(mx, mz)

  // Keyboard diagonals have length ~1.41: clamp so they are not faster.
  if (len > 1) {
    mx /= len
    mz /= len
  }

  if (len > FACING_THRESHOLD) {
    p.facingX = input.moveX / len
    p.facingZ = input.moveZ / len
  }

  const speed = world.playerDef.speed
  const limit = world.arena.halfSize - world.playerDef.radius
  p.x = clamp(p.x + mx * speed * dt, -limit, limit)
  p.z = clamp(p.z + mz * speed * dt, -limit, limit)
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(v, max))
}
