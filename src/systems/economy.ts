import type { World } from '../core/world'

/** Coins earned per zombie killed in round `n`: grows with the round. */
export function coinsPerKill(world: World, n: number): number {
  const def = world.economyDef
  return Math.round(def.coinsPerKillBase * (1 + def.coinsGrowthPerRound * (n - 1)))
}

/** Pays the round-clear reward: kills in the round x coins per kill. Returns the amount. */
export function payRoundReward(world: World): number {
  const r = world.round
  const reward = r.killed * coinsPerKill(world, r.number)
  world.coins += reward
  r.lastReward = reward
  return reward
}
