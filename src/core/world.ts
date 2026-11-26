import { type ArenaDef, arena as defaultArena } from '../data/arena'
import { player as defaultPlayer, type PlayerDef } from '../data/player'
import { pistol, type WeaponDef } from '../data/weapons'

export type Player = {
  x: number
  z: number
  /** Position at the start of the last step, for render interpolation. */
  prevX: number
  prevZ: number
  /** Unit vector of where the player is facing. Starts facing screen up (-z). */
  facingX: number
  facingZ: number
  /** Seconds until the next shot. */
  fireCooldown: number
}

export type Projectile = {
  active: boolean
  x: number
  z: number
  prevX: number
  prevZ: number
  vx: number
  vz: number
  /** Seconds left before it disappears. */
  life: number
}

export type World = {
  tick: number
  arena: ArenaDef
  playerDef: PlayerDef
  weapon: WeaponDef
  player: Player
  /** Fixed-size pool. Never grows; inactive slots are reused. */
  projectiles: Projectile[]
  activeProjectiles: number
}

export type WorldOptions = {
  arena?: ArenaDef
  playerDef?: PlayerDef
  weapon?: WeaponDef
}

export function createWorld(options: WorldOptions = {}): World {
  const arena = options.arena ?? defaultArena
  const projectiles: Projectile[] = []
  for (let i = 0; i < arena.maxProjectiles; i++) {
    projectiles.push({ active: false, x: 0, z: 0, prevX: 0, prevZ: 0, vx: 0, vz: 0, life: 0 })
  }

  return {
    tick: 0,
    arena,
    playerDef: options.playerDef ?? defaultPlayer,
    weapon: options.weapon ?? pistol,
    player: { x: 0, z: 0, prevX: 0, prevZ: 0, facingX: 0, facingZ: -1, fireCooldown: 0 },
    projectiles,
    activeProjectiles: 0,
  }
}
