import type { InputState } from '../core/input'
import type { World } from '../core/world'
import { activePointCount } from '../data/maps'
import { payRoundReward } from './economy'

/** Starts round `n`: computes how many zombies, how strong and how fast they spawn. */
export function startRound(world: World, n: number): void {
  const def = world.roundsDef
  const r = world.round
  r.number = n
  r.phase = 'active'
  r.timer = def.duration
  r.total = def.baseCount + def.countPerRound * n
  r.spawned = 0
  r.killed = 0
  r.enemyHp = world.enemyDef.hp * def.hpGrowth ** n
  r.spawnInterval = Math.max(
    def.spawnIntervalMin,
    def.spawnIntervalStart - def.spawnIntervalPerRound * n,
  )
  r.spawnMask = pickSpawnPoints(world, n)
  world.spawnTimer = 0
}

/**
 * Picks which of the map's spawn points are active in round `n` (distinct, seeded RNG).
 * Returns a bitmask: bit i = map.spawnPoints[i].
 */
export function pickSpawnPoints(world: World, n: number): number {
  const total = world.map.spawnPoints.length
  const count = activePointCount(world.map, n)
  let mask = 0
  for (let picked = 0; picked < count; picked++) {
    // Choose the k-th still-free point.
    let k = world.rng.int(0, total - picked - 1)
    for (let i = 0; i < total; i++) {
      if (mask & (1 << i)) continue
      if (k === 0) {
        mask |= 1 << i
        break
      }
      k--
    }
  }
  return mask
}

/** Round director: active -> (all killed) intermission -> next round, or (time out) failed. */
export function updateRounds(world: World, input: InputState, dt: number): void {
  const r = world.round
  if (r.number === 0) {
    startRound(world, 1)
    return
  }

  switch (r.phase) {
    case 'active':
      if (r.killed >= r.total) {
        payRoundReward(world)
        r.phase = 'intermission'
        r.timer = world.roundsDef.intermission
        return
      }
      r.timer -= dt
      if (r.timer <= 0) {
        r.timer = 0
        r.phase = 'failed'
        r.failReason = 'timeUp'
      }
      return

    case 'intermission':
      r.timer -= dt
      if (input.skipIntermission || r.timer <= 0) startRound(world, r.number + 1)
      return

    case 'failed':
      return
  }
}
