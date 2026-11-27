import { shopItems } from '../data/shop'
import { weaponUpgrades } from '../data/upgrades'
import type { World } from './world'

const EPS = 1e-6

/**
 * Sanity checks on the world state. Returns human-readable problems ([] = all good).
 * Used by the debug build (every few ticks), the soak test and replays to catch bugs early.
 * Allocates: do not call every frame in release builds.
 */
export function checkInvariants(world: World): string[] {
  const problems: string[] = []
  const bad = (msg: string) => problems.push(msg)
  const finite = (v: number, what: string) => {
    if (!Number.isFinite(v)) bad(`${what} is not finite (${v})`)
  }

  const p = world.player
  const half = world.arena.halfSize
  finite(p.x, 'player.x')
  finite(p.z, 'player.z')
  finite(p.facingX, 'player.facingX')
  finite(p.facingZ, 'player.facingZ')
  if (Math.abs(p.x) > half + EPS || Math.abs(p.z) > half + EPS) {
    bad(`player outside arena (${p.x.toFixed(2)}, ${p.z.toFixed(2)})`)
  }
  finite(p.hp, 'player.hp')
  finite(p.shield, 'player.shield')
  if (p.hp < 0 || p.hp > world.playerDef.maxHp + EPS) bad(`player.hp out of range (${p.hp})`)
  if (p.shield < 0 || p.shield > world.playerDef.maxShield + EPS) {
    bad(`player.shield out of range (${p.shield})`)
  }
  if (p.hp <= 0 && world.round.phase !== 'failed') bad('player has 0 HP but the run is not failed')
  for (const t of ['hurtTimer', 'speedBoostTimer', 'damageBoostTimer'] as const) {
    finite(p[t], `player.${t}`)
    if (p[t] < 0) bad(`player.${t} is negative (${p[t]})`)
  }

  let enemies = 0
  world.enemies.forEach((e, i) => {
    if (!e.active) return
    enemies++
    finite(e.x, `enemy[${i}].x`)
    finite(e.z, `enemy[${i}].z`)
    finite(e.hp, `enemy[${i}].hp`)
    if (Math.abs(e.x) > half + EPS || Math.abs(e.z) > half + EPS) bad(`enemy[${i}] outside arena`)
    if (e.hp <= 0) bad(`enemy[${i}] is active with hp ${e.hp}`)
  })
  if (enemies !== world.activeEnemies) {
    bad(`activeEnemies=${world.activeEnemies} but ${enemies} enemies are active`)
  }

  let projectiles = 0
  world.projectiles.forEach((pr, i) => {
    if (!pr.active) return
    projectiles++
    finite(pr.x, `projectile[${i}].x`)
    finite(pr.z, `projectile[${i}].z`)
    if (Math.abs(pr.x) > half + 1 || Math.abs(pr.z) > half + 1)
      bad(`projectile[${i}] outside arena`)
  })
  if (projectiles !== world.activeProjectiles) {
    bad(`activeProjectiles=${world.activeProjectiles} but ${projectiles} are active`)
  }

  const r = world.round
  finite(r.timer, 'round.timer')
  if (r.timer < 0) bad(`round.timer is negative (${r.timer})`)
  if (r.number > 0) {
    if (r.killed > r.spawned) bad(`round.killed (${r.killed}) > spawned (${r.spawned})`)
    if (r.spawned > r.total) bad(`round.spawned (${r.spawned}) > total (${r.total})`)
    if (r.phase === 'intermission' && enemies > 0)
      bad(`${enemies} zombies alive in the intermission`)
  }
  if (r.phase === 'failed' && !r.failReason) bad('run failed without a reason')
  if (r.number > 0 && r.phase === 'active' && r.spawnMask === 0)
    bad('active round with no spawn point')
  if (r.spawnMask >= 1 << world.map.spawnPoints.length)
    bad(`spawnMask ${r.spawnMask} has unknown points`)

  if (!Number.isInteger(world.coins) || world.coins < 0) bad(`coins invalid (${world.coins})`)
  for (const item of shopItems) {
    const n = world.inventory[item.id] ?? 0
    if (!Number.isInteger(n) || n < 0) bad(`inventory.${item.id} invalid (${n})`)
    if (item.maxStack !== undefined && n > item.maxStack) {
      bad(`inventory.${item.id}=${n} above max ${item.maxStack}`)
    }
  }
  for (const [weaponId, levels] of Object.entries(world.weaponLevels)) {
    for (const up of weaponUpgrades) {
      const level = levels[up.id] ?? 0
      if (level < 0 || level > up.maxLevel)
        bad(`weapon ${weaponId} ${up.id} level ${level} invalid`)
    }
  }
  return problems
}
