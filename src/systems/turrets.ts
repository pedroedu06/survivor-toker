import type { World } from '../core/world'

/**
 * Base turrets: each active one turns toward the nearest zombie in range and fires when aimed.
 * Shots use the shared projectile pool (they fly over the walls like the player's).
 * Expects `world.enemyHash` to be up to date.
 */
export function updateTurrets(world: World, dt: number): void {
  const slots = world.map.turretSlots
  if (!slots) return
  const def = world.turretDef
  const buf = world.queryBuffer
  const rangeSq = def.range * def.range
  const active = world.round.phase === 'active'

  for (let i = 0; i < world.turrets.length; i++) {
    const t = world.turrets[i]
    const slot = slots[i]
    if (!t?.active || !slot) continue
    t.prevYaw = t.yaw
    if (t.cooldown > 0) t.cooldown = Math.max(0, t.cooldown - dt)
    if (!active) continue

    // Nearest zombie in range (ties: lowest index, deterministic).
    let target = -1
    let bestSq = rangeSq
    const n = world.enemyHash.query(slot.x, slot.z, def.range, buf)
    for (let k = 0; k < n; k++) {
      const idx = buf[k] ?? -1
      const e = world.enemies[idx]
      if (!e?.active) continue
      const dx = e.x - slot.x
      const dz = e.z - slot.z
      const d2 = dx * dx + dz * dz
      if (d2 < bestSq || (d2 === bestSq && idx < target)) {
        bestSq = d2
        target = idx
      }
    }
    const e = world.enemies[target]
    if (!e) continue

    // Turn toward it (yaw: direction = (sin, cos)).
    const want = Math.atan2(e.x - slot.x, e.z - slot.z)
    let diff = want - t.yaw
    diff = Math.atan2(Math.sin(diff), Math.cos(diff))
    const maxTurn = def.turnSpeed * dt
    t.yaw += Math.max(-maxTurn, Math.min(maxTurn, diff))
    t.yaw = Math.atan2(Math.sin(t.yaw), Math.cos(t.yaw))

    if (t.cooldown > 0 || Math.abs(diff) > def.aimTolerance) continue
    t.cooldown = 1 / def.fireRate
    fire(world, slot.x, slot.z, t.yaw)
  }
}

function fire(world: World, x: number, z: number, yaw: number): void {
  const pool = world.projectiles
  const def = world.turretDef
  for (let i = 0; i < pool.length; i++) {
    const pr = pool[i]
    if (!pr || pr.active) continue
    const dx = Math.sin(yaw)
    const dz = Math.cos(yaw)
    const sx = x + dx * def.muzzleOffset
    const sz = z + dz * def.muzzleOffset
    pr.active = true
    pr.x = pr.prevX = sx
    pr.z = pr.prevZ = sz
    pr.vx = dx * def.projectileSpeed
    pr.vz = dz * def.projectileSpeed
    pr.life = def.projectileLifetime
    pr.damage = def.damage
    world.activeProjectiles++
    return
  }
}
