import type { World } from '../core/world'

/** Chase the player in a straight line, then resolve overlaps (zombie-zombie, zombie-player). */
export function updateEnemies(world: World, dt: number): void {
  const pool = world.enemies
  const def = world.enemyDef
  const p = world.player
  const step = def.speed * dt

  for (let i = 0; i < pool.length; i++) {
    const e = pool[i]
    if (!e?.active) continue
    e.prevX = e.x
    e.prevZ = e.z
    const dx = p.x - e.x
    const dz = p.z - e.z
    const dist = Math.hypot(dx, dz)
    if (dist > 1e-6) {
      const move = Math.min(step, dist)
      e.x += (dx / dist) * move
      e.z += (dz / dist) * move
    }
  }

  rebuildEnemyHash(world)
  separate(world)
  rebuildEnemyHash(world)
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

    // Zombie-player: zombies never overlap the player (no damage yet).
    const pdx = a.x - p.x
    const pdz = a.z - p.z
    const pd = Math.hypot(pdx, pdz)
    if (pd < playerMin) {
      const nx = pd > 1e-6 ? pdx / pd : 1
      const nz = pd > 1e-6 ? pdz / pd : 0
      a.x = p.x + nx * playerMin
      a.z = p.z + nz * playerMin
    }

    a.x = Math.max(-limit, Math.min(a.x, limit))
    a.z = Math.max(-limit, Math.min(a.z, limit))
  }
}
