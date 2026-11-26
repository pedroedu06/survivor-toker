import { updateCollision } from '../systems/collision'
import { updateEnemies } from '../systems/enemies'
import { updateMovement } from '../systems/movement'
import { updateProjectiles } from '../systems/projectiles'
import { updateSpawn } from '../systems/spawn'
import { updateWeapons } from '../systems/weapons'
import type { InputState } from './input'
import type { World } from './world'

/** Advances the simulation by one fixed step. Order matters. */
export function stepWorld(world: World, input: InputState, dt: number): void {
  const p = world.player
  p.prevX = p.x
  p.prevZ = p.z

  updateMovement(world, input, dt)
  updateEnemies(world, dt) // also rebuilds the enemy spatial hash
  updateProjectiles(world, dt)
  updateCollision(world)
  updateWeapons(world, dt)
  updateSpawn(world, dt)

  world.tick++
}
