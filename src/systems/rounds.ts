import type { InputState } from '../core/input'
import type { World } from '../core/world'
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
  world.spawnTimer = 0
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
