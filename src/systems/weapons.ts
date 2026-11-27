import type { World } from '../core/world'
import { effectiveFireRate } from './weaponStats'

/** Auto-fire: shoots in the facing direction whenever the cooldown is ready. */
export function updateWeapons(world: World, dt: number): void {
  const p = world.player
  const w = world.weapon
  p.fireCooldown -= dt
  if (p.fireCooldown > 0) return

  // Keep the remainder so the fire rate does not drift with the step size.
  p.fireCooldown += 1 / effectiveFireRate(world)
  if (p.fireCooldown < 0) p.fireCooldown = 0

  const slot = findFreeProjectile(world)
  if (slot < 0) return // Pool full: skip this shot.

  const proj = world.projectiles[slot]
  if (!proj) return
  const x = p.x + p.facingX * w.spawnOffset
  const z = p.z + p.facingZ * w.spawnOffset
  proj.active = true
  proj.x = x
  proj.z = z
  proj.prevX = x
  proj.prevZ = z
  proj.vx = p.facingX * w.projectileSpeed
  proj.vz = p.facingZ * w.projectileSpeed
  proj.life = w.projectileLifetime
  world.activeProjectiles++
}

function findFreeProjectile(world: World): number {
  const pool = world.projectiles
  for (let i = 0; i < pool.length; i++) {
    if (!pool[i]?.active) return i
  }
  return -1
}
