import type { World } from '../core/world'
import type { SpawnPointDef } from '../data/maps'

/**
 * Spawns the current round's zombies at the map's active spawn points (see data/maps.ts).
 * Only during an active round, up to the round total and the max alive at once.
 */
export function updateSpawn(world: World, dt: number): void {
  const r = world.round
  if (r.phase !== 'active' || r.spawned >= r.total) return

  world.spawnTimer -= dt
  if (world.spawnTimer > 0) return
  world.spawnTimer += r.spawnInterval
  if (world.spawnTimer < 0) world.spawnTimer = 0

  if (world.activeEnemies >= world.spawnDef.maxAlive) return
  if (spawnEnemy(world)) r.spawned++
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

  const point = pickActivePoint(world)
  // Uniform inside a disc around the point (sqrt keeps it from bunching at the center).
  const angle = world.rng.range(0, Math.PI * 2)
  const dist = Math.sqrt(world.rng.next()) * world.map.spawnSpread
  const limit = world.arena.halfSize - world.enemyDef.radius
  const x = clamp(point.x + Math.cos(angle) * dist, -limit, limit)
  const z = clamp(point.z + Math.sin(angle) * dist, -limit, limit)

  e.active = true
  e.x = x
  e.z = z
  e.prevX = x
  e.prevZ = z
  e.hp = world.round.enemyHp || world.enemyDef.hp
  world.activeEnemies++
  return true
}

/** A random spawn point among the round's active ones (all of them if none is set). */
function pickActivePoint(world: World): SpawnPointDef {
  const points = world.map.spawnPoints
  const mask = world.round.spawnMask || (1 << points.length) - 1
  let active = 0
  for (let i = 0; i < points.length; i++) if (mask & (1 << i)) active++
  let k = world.rng.int(0, active - 1)
  for (let i = 0; i < points.length; i++) {
    if (!(mask & (1 << i))) continue
    if (k === 0) return points[i] as SpawnPointDef
    k--
  }
  return points[0] as SpawnPointDef
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(v, max))
}
