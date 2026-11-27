import type { World } from '../core/world'

/**
 * Projectile vs zombie (each projectile carries its damage: player weapon or turret).
 * Projectiles fly over walls. Expects `world.enemyHash` to be up to date. No pierce yet.
 */
export function updateCollision(world: World): void {
  const projectiles = world.projectiles
  const enemies = world.enemies
  const hitDist = world.enemyDef.radius + world.weapon.projectileSize * 0.5
  const hitDistSq = hitDist * hitDist
  const buf = world.queryBuffer

  for (let i = 0; i < projectiles.length; i++) {
    const pr = projectiles[i]
    if (!pr?.active) continue

    const n = world.enemyHash.query(pr.x, pr.z, hitDist, buf)
    for (let k = 0; k < n; k++) {
      const e = enemies[buf[k] ?? -1]
      if (!e?.active) continue
      const dx = e.x - pr.x
      const dz = e.z - pr.z
      if (dx * dx + dz * dz > hitDistSq) continue

      pr.active = false
      world.activeProjectiles--
      e.hp -= pr.damage
      if (e.hp <= 0) {
        e.active = false
        world.activeEnemies--
        world.kills++
        world.round.killed++
      }
      break
    }
  }
}
