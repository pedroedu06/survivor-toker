import type { World } from '../core/world'

/** Continuous spawn on a ring around the player, outside the camera view. */
export function updateSpawn(world: World, dt: number): void {
  const def = world.spawnDef
  world.spawnTimer -= dt
  while (world.spawnTimer <= 0) {
    world.spawnTimer += def.interval
    if (world.activeEnemies >= def.maxAlive) continue
    spawnEnemy(world)
  }
}

export function spawnEnemy(world: World): boolean {
  const pool = world.enemies
  let slot = -1
  for (let i = 0; i < pool.length; i++) {
    if (!pool[i]?.active) {
      slot = i
      break
    }
  }
  const e = pool[slot]
  if (!e) return false

  const def = world.spawnDef
  const angle = world.rng.range(0, Math.PI * 2)
  const dist = world.rng.range(def.minDistance, def.maxDistance)
  const limit = world.arena.halfSize - world.enemyDef.radius
  const x = clamp(world.player.x + Math.cos(angle) * dist, -limit, limit)
  const z = clamp(world.player.z + Math.sin(angle) * dist, -limit, limit)

  e.active = true
  e.x = x
  e.z = z
  e.prevX = x
  e.prevZ = z
  e.hp = world.enemyDef.hp
  world.activeEnemies++
  return true
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(v, max))
}
