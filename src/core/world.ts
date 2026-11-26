import { type ArenaDef, arena as defaultArena } from '../data/arena'
import { type EnemyDef, walker } from '../data/enemies'
import { player as defaultPlayer, type PlayerDef } from '../data/player'
import { spawn as defaultSpawn, type SpawnDef } from '../data/spawn'
import { pistol, type WeaponDef } from '../data/weapons'
import { createRng, type Rng } from './rng'
import { createSpatialHash, type SpatialHash } from './spatialHash'

/** Broad-phase cell size in world units (~2x the biggest common radius). */
const HASH_CELL_SIZE = 2

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

export type Enemy = {
  active: boolean
  x: number
  z: number
  prevX: number
  prevZ: number
  hp: number
}

export type World = {
  seed: number
  rng: Rng
  tick: number
  arena: ArenaDef
  playerDef: PlayerDef
  weapon: WeaponDef
  enemyDef: EnemyDef
  spawnDef: SpawnDef
  player: Player
  /** Fixed-size pools. Never grow; inactive slots are reused. */
  projectiles: Projectile[]
  enemies: Enemy[]
  activeProjectiles: number
  activeEnemies: number
  kills: number
  /** Seconds until the next spawn. */
  spawnTimer: number
  /** Broad phase of active enemies, rebuilt every step. */
  enemyHash: SpatialHash
  /** Scratch buffer for hash queries (no allocation in the loop). */
  queryBuffer: Int32Array
}

export type WorldOptions = {
  seed?: number
  arena?: ArenaDef
  playerDef?: PlayerDef
  weapon?: WeaponDef
  enemyDef?: EnemyDef
  spawnDef?: SpawnDef
}

export function createWorld(options: WorldOptions = {}): World {
  const seed = options.seed ?? 1
  const arena = options.arena ?? defaultArena

  const projectiles: Projectile[] = []
  for (let i = 0; i < arena.maxProjectiles; i++) {
    projectiles.push({ active: false, x: 0, z: 0, prevX: 0, prevZ: 0, vx: 0, vz: 0, life: 0 })
  }
  const enemies: Enemy[] = []
  for (let i = 0; i < arena.maxEnemies; i++) {
    enemies.push({ active: false, x: 0, z: 0, prevX: 0, prevZ: 0, hp: 0 })
  }

  return {
    seed,
    rng: createRng(seed),
    tick: 0,
    arena,
    playerDef: options.playerDef ?? defaultPlayer,
    weapon: options.weapon ?? pistol,
    enemyDef: options.enemyDef ?? walker,
    spawnDef: options.spawnDef ?? defaultSpawn,
    player: { x: 0, z: 0, prevX: 0, prevZ: 0, facingX: 0, facingZ: -1, fireCooldown: 0 },
    projectiles,
    enemies,
    activeProjectiles: 0,
    activeEnemies: 0,
    kills: 0,
    spawnTimer: 0,
    enemyHash: createSpatialHash(arena.halfSize, HASH_CELL_SIZE, arena.maxEnemies),
    queryBuffer: new Int32Array(arena.maxEnemies),
  }
}
