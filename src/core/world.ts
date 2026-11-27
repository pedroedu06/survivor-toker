import { type ArenaDef, arena as defaultArena } from '../data/arena'
import { type EnemyDef, walker } from '../data/enemies'
import { player as defaultPlayer, type PlayerDef } from '../data/player'
import { rounds as defaultRounds, type RoundsDef } from '../data/rounds'
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
  hp: number
  /** Absorbs damage before HP. Never regenerates. */
  shield: number
  /** Invulnerability left after a hit, in seconds. */
  hurtTimer: number
  /** Seconds since the last hit (HP regen starts after `regenDelay`). */
  sinceHurt: number
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

export type RoundPhase = 'active' | 'intermission' | 'failed'

export type RoundState = {
  /** Current round. 0 = not started yet (the round director starts round 1 on the first step). */
  number: number
  phase: RoundPhase
  /** Seconds left in the current phase. */
  timer: number
  /** Zombies in this round, how many already spawned and how many were killed. */
  total: number
  spawned: number
  killed: number
  /** HP of zombies spawned this round. */
  enemyHp: number
  /** Seconds between spawns this round. */
  spawnInterval: number
  /** Why the run ended, when phase is 'failed'. */
  failReason: FailReason | null
}

export type FailReason = 'timeUp' | 'died'

export type World = {
  seed: number
  rng: Rng
  tick: number
  arena: ArenaDef
  playerDef: PlayerDef
  weapon: WeaponDef
  enemyDef: EnemyDef
  spawnDef: SpawnDef
  roundsDef: RoundsDef
  round: RoundState
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
  /** Debug only (god mode): the player takes no damage. */
  debugGod: boolean
}

export type WorldOptions = {
  seed?: number
  arena?: ArenaDef
  playerDef?: PlayerDef
  weapon?: WeaponDef
  enemyDef?: EnemyDef
  spawnDef?: SpawnDef
  roundsDef?: RoundsDef
}

function initialRound(): RoundState {
  return {
    number: 0,
    phase: 'active',
    timer: 0,
    total: 0,
    spawned: 0,
    killed: 0,
    enemyHp: 0,
    spawnInterval: 0,
    failReason: null,
  }
}

function initialPlayer(def: PlayerDef): Player {
  return {
    x: 0,
    z: 0,
    prevX: 0,
    prevZ: 0,
    facingX: 0,
    facingZ: -1,
    fireCooldown: 0,
    hp: def.maxHp,
    shield: def.maxShield,
    hurtTimer: 0,
    sinceHurt: 0,
  }
}

/**
 * Restarts the run in place (same pools, same definitions). Used by "play again".
 * Not for the game loop: it allocates a little.
 */
export function resetWorld(world: World, seed: number = world.seed): void {
  world.seed = seed
  world.rng = createRng(seed)
  world.tick = 0
  world.round = initialRound()
  world.player = initialPlayer(world.playerDef)
  for (const p of world.projectiles) {
    p.active = false
    p.x = p.z = p.prevX = p.prevZ = p.vx = p.vz = p.life = 0
  }
  for (const e of world.enemies) {
    e.active = false
    e.x = e.z = e.prevX = e.prevZ = e.hp = 0
  }
  world.activeProjectiles = 0
  world.activeEnemies = 0
  world.kills = 0
  world.spawnTimer = 0
  world.enemyHash.clear()
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
    roundsDef: options.roundsDef ?? defaultRounds,
    round: initialRound(),
    player: initialPlayer(options.playerDef ?? defaultPlayer),
    projectiles,
    enemies,
    activeProjectiles: 0,
    activeEnemies: 0,
    kills: 0,
    spawnTimer: 0,
    enemyHash: createSpatialHash(arena.halfSize, HASH_CELL_SIZE, arena.maxEnemies),
    queryBuffer: new Int32Array(arena.maxEnemies),
    debugGod: false,
  }
}
