import { applyBaseCommand, updateDoors } from '../systems/base'
import { updateCollision } from '../systems/collision'
import { updatePlayerDamage } from '../systems/damage'
import { applyDevCommands } from '../systems/dev'
import { updateEnemies } from '../systems/enemies'
import { updateHide } from '../systems/hide'
import { updateMovement } from '../systems/movement'
import { updateProjectiles } from '../systems/projectiles'
import { updateRounds } from '../systems/rounds'
import { updateShop } from '../systems/shop'
import { updateSpawn } from '../systems/spawn'
import { updateTurrets } from '../systems/turrets'
import { updateWeapons } from '../systems/weapons'
import type { InputState } from './input'
import type { World } from './world'

// A function (not an inline check) so TypeScript does not narrow the phase across system calls.
const isFailed = (world: World) => world.round.phase === 'failed'

/** Advances the simulation by one fixed step. Order matters. */
export function stepWorld(world: World, input: InputState, dt: number): void {
  // Mission failed: everything freezes until the run is reset.
  if (isFailed(world)) return

  applyDevCommands(world, input.dev)

  const p = world.player
  p.prevX = p.x
  p.prevZ = p.z

  updateShop(world, input, dt) // buy/use commands + timed potion effects
  if (input.base) applyBaseCommand(world, input.base) // base upgrades, repairs, turrets
  updateDoors(world) // open for the player when near
  updateMovement(world, input, dt) // + walls/obstacles
  updateHide(world) // trees/bushes
  updateEnemies(world, dt) // flow field, wander, wall attacks; rebuilds the enemy spatial hash
  updatePlayerDamage(world, dt)
  if (isFailed(world)) {
    // Died this step: freeze right here.
    world.tick++
    return
  }
  updateProjectiles(world, dt)
  updateCollision(world)
  updateTurrets(world, dt)
  updateWeapons(world, dt)
  updateSpawn(world, dt)
  updateRounds(world, input, dt)

  world.tick++
}
