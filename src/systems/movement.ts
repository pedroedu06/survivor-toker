import type { InputState } from '../core/input'
import type { World } from '../core/world'
import { obstacleHit, resolveObstacles } from './obstacles'

/** Below this aim length the player keeps its previous aim. */
const AIM_THRESHOLD = 0.1

/** Moves the player and updates where it faces/shoots (manual aim, twin-stick). */
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

  // Aim is independent from movement: walk one way, shoot another.
  const aimLen = Math.hypot(input.aimX, input.aimZ)
  if (aimLen > AIM_THRESHOLD) {
    p.facingX = input.aimX / aimLen
    p.facingZ = input.aimZ / aimLen
  }

  const speed = world.playerDef.speed * (p.speedBoostTimer > 0 ? p.speedBoostMultiplier : 1)
  const limit = world.arena.halfSize - world.playerDef.radius
  const x = clamp(p.x + mx * speed * dt, -limit, limit)
  const z = clamp(p.z + mz * speed * dt, -limit, limit)
  // Walls, props and closed doors (doors open for the player when near: systems/base.ts).
  resolveObstacles(world, x, z, world.playerDef.radius, true)
  p.x = clamp(obstacleHit.x, -limit, limit)
  p.z = clamp(obstacleHit.z, -limit, limit)
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(v, max))
}
