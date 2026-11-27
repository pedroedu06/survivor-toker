import { boxDistance } from '../core/navGrid'
import type { Enemy, World } from '../core/world'
import type { SlotDef } from '../data/maps'
import { damageStructure } from './base'
import { flow, flowDirection, updateNavField } from './navigation'
import { obstacleHit, resolveObstacles } from './obstacles'

/** How close (beyond its radius) a zombie must be to a wall to hit it. */
const WALL_REACH = 0.15
/** Chance that a wandering zombie stands still for a while instead of walking. */
const IDLE_CHANCE = 0.4
/** Wander targets are picked up to this far from the zombie. */
const WANDER_RADIUS = 4

/**
 * Zombies chase the player along the flow field (around the base, or to a wall to break it
 * when the player is shut inside). While the player is hidden they stand or wander.
 * Then overlaps are resolved (zombie-zombie, zombie-player, obstacles).
 */
export function updateEnemies(world: World, dt: number): void {
  const pool = world.enemies
  const def = world.enemyDef
  const p = world.player
  const step = def.speed * dt
  const hidden = p.hidden
  if (!hidden) updateNavField(world)

  for (let i = 0; i < pool.length; i++) {
    const e = pool[i]
    if (!e?.active) continue
    e.prevX = e.x
    e.prevZ = e.z
    if (hidden) {
      wander(world, e, step * def.wanderSpeed, dt)
      continue
    }
    e.wanderTimer = 0

    flowDirection(world, e.x, e.z)
    let move = step
    if (flow.direct) move = Math.min(step, Math.hypot(p.x - e.x, p.z - e.z))
    e.x += flow.dx * move
    e.z += flow.dz * move

    // Pushing against an intact wall/door that blocks the way: break it.
    const slot = flow.nextSlot
    const slotDef: SlotDef | undefined = slot >= 0 ? world.map.slots?.[slot] : undefined
    if (slotDef) {
      if (boxDistance(slotDef.box, e.x, e.z) <= def.radius + WALL_REACH) {
        damageStructure(world, slot, def.wallDamage * dt)
      }
    }
  }

  rebuildEnemyHash(world)
  separate(world)
  rebuildEnemyHash(world)
}

function wander(world: World, e: Enemy, step: number, dt: number): void {
  e.wanderTimer -= dt
  if (e.wanderTimer <= 0) {
    const rng = world.rng
    if (rng.next() < IDLE_CHANCE) {
      e.idle = true
      e.wanderTimer = rng.range(1, 3)
    } else {
      e.idle = false
      const angle = rng.range(0, Math.PI * 2)
      const dist = rng.range(1, WANDER_RADIUS)
      const limit = world.arena.halfSize - world.enemyDef.radius
      e.wanderX = Math.max(-limit, Math.min(limit, e.x + Math.cos(angle) * dist))
      e.wanderZ = Math.max(-limit, Math.min(limit, e.z + Math.sin(angle) * dist))
      e.wanderTimer = rng.range(2, 4)
    }
  }
  if (e.idle) return
  const dx = e.wanderX - e.x
  const dz = e.wanderZ - e.z
  const d = Math.hypot(dx, dz)
  if (d < 0.05) return
  const move = Math.min(step, d)
  e.x += (dx / d) * move
  e.z += (dz / d) * move
}

export function rebuildEnemyHash(world: World): void {
  const hash = world.enemyHash
  hash.clear()
  const pool = world.enemies
  for (let i = 0; i < pool.length; i++) {
    const e = pool[i]
    if (e?.active) hash.insert(i, e.x, e.z)
  }
}

function separate(world: World): void {
  const pool = world.enemies
  const r = world.enemyDef.radius
  const minDist = r * 2
  const p = world.player
  const playerMin = r + world.playerDef.radius
  const limit = world.arena.halfSize - r
  const buf = world.queryBuffer

  for (let i = 0; i < pool.length; i++) {
    const a = pool[i]
    if (!a?.active) continue

    // Zombie-zombie: each pair once (j > i), each side moves half the overlap.
    const n = world.enemyHash.query(a.x, a.z, minDist, buf)
    for (let k = 0; k < n; k++) {
      const j = buf[k] ?? -1
      if (j <= i) continue
      const b = pool[j]
      if (!b?.active) continue
      const dx = b.x - a.x
      const dz = b.z - a.z
      const d = Math.hypot(dx, dz)
      if (d >= minDist) continue
      const push = (minDist - d) * 0.5
      let nx: number
      let nz: number
      if (d > 1e-6) {
        nx = dx / d
        nz = dz / d
      } else {
        // Exactly stacked: pick a deterministic direction from the indices.
        nx = ((i + j) & 1) === 0 ? 1 : -1
        nz = 0
      }
      a.x -= nx * push
      a.z -= nz * push
      b.x += nx * push
      b.z += nz * push
    }

    // Zombie-player: zombies never overlap the player.
    const pdx = a.x - p.x
    const pdz = a.z - p.z
    const pd = Math.hypot(pdx, pdz)
    if (pd < playerMin) {
      const nx = pd > 1e-6 ? pdx / pd : 1
      const nz = pd > 1e-6 ? pdz / pd : 0
      a.x = p.x + nx * playerMin
      a.z = p.z + nz * playerMin
    }

    // Walls, doors and props win over the crowd push.
    resolveObstacles(world, a.x, a.z, r, false)
    a.x = Math.max(-limit, Math.min(obstacleHit.x, limit))
    a.z = Math.max(-limit, Math.min(obstacleHit.z, limit))
  }
}
