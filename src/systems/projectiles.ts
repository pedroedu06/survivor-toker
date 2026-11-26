import type { World } from '../core/world'

export function updateProjectiles(world: World, dt: number): void {
  const pool = world.projectiles
  const limit = world.arena.halfSize
  for (let i = 0; i < pool.length; i++) {
    const p = pool[i]
    if (!p?.active) continue
    p.prevX = p.x
    p.prevZ = p.z
    p.x += p.vx * dt
    p.z += p.vz * dt
    p.life -= dt
    if (p.life <= 0 || p.x < -limit || p.x > limit || p.z < -limit || p.z > limit) {
      p.active = false
      world.activeProjectiles--
    }
  }
}
