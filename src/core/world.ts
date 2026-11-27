import { type ArenaDef, arena as defaultArena } from '../data/arena'
import { type BaseDef, base as defaultBase, tierDef } from '../data/base'
import { economy as defaultEconomy, type EconomyDef } from '../data/economy'
import { type EnemyDef, walker } from '../data/enemies'
import { decodeHideGrid, type MapDef, testArena } from '../data/maps'
import { player as defaultPlayer, type PlayerDef } from '../data/player'
import { rounds as defaultRounds, type RoundsDef } from '../data/rounds'
import { spawn as defaultSpawn, type SpawnDef } from '../data/spawn'
import { turret as defaultTurret, type TurretDef } from '../data/turrets'
import { pistol, type WeaponDef } from '../data/weapons'
import { createNavGrid, type NavGrid } from './navGrid'
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
  /** Speed potion: seconds left and the multiplier while it lasts. */
  speedBoostTimer: number
  speedBoostMultiplier: number
  /** Damage potion: seconds left and the multiplier while it lasts. */
  damageBoostTimer: number
  damageBoostMultiplier: number
  /** Standing in a hiding spot (tree/bush) and not found: zombies lose track, the gun is quiet. */
  hidden: boolean
  /** A zombie touched the player while in cover: found until they leave the cover. */
  exposed: boolean
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
  /** Damage dealt on hit (set when fired: player weapon or turret). */
  damage: number
}

export type Enemy = {
  active: boolean
  x: number
  z: number
  prevX: number
  prevZ: number
  hp: number
  /** While the player is hidden: wander target, seconds until a new decision, standing still. */
  wanderX: number
  wanderZ: number
  wanderTimer: number
  idle: boolean
}

/** One breakable piece of the base (same index as `map.slots`). */
export type Structure = {
  hp: number
  maxHp: number
  /** Door only: open for the player (zombies always collide with an intact door). */
  open: boolean
}

/** One turret position (same index as `map.turretSlots`). */
export type Turret = {
  active: boolean
  /** Aim yaw (Three.js rotation.y convention: direction = (sin, cos)). */
  yaw: number
  prevYaw: number
  cooldown: number
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
  /** Bitmask of the map spawn points active this round (bit i = map.spawnPoints[i]). */
  spawnMask: number
  /** Coins paid for the last cleared round (shown in the intermission). */
  lastReward: number
}

export type FailReason = 'timeUp' | 'died'

export type World = {
  seed: number
  rng: Rng
  tick: number
  arena: ArenaDef
  map: MapDef
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
  economyDef: EconomyDef
  /** In-run coins (shop currency). */
  coins: number
  /** Carried shop items (potions), by item id. */
  inventory: Record<string, number>
  /** Weapon upgrade levels bought in the shop: weaponId -> upgradeId -> level. */
  weaponLevels: Record<string, Record<string, number>>
  baseDef: BaseDef
  turretDef: TurretDef
  /** Base pieces (walls/doors), one per `map.slots` entry. */
  structures: Structure[]
  /** Tier (1..4) of each base side, indexed like `SIDES` (n, e, s, w). */
  sideTier: number[]
  turrets: Turret[]
  /** Hiding spots, one byte per cell of `map.hideGrid` (empty when the map has none). */
  hideCells: Uint8Array
  /** Zombie navigation (flow field toward the player). */
  nav: NavGrid
}

export type WorldOptions = {
  seed?: number
  arena?: ArenaDef
  /** Map (spawn points, size). The arena size comes from it unless `arena` is given. */
  map?: MapDef
  playerDef?: PlayerDef
  weapon?: WeaponDef
  enemyDef?: EnemyDef
  spawnDef?: SpawnDef
  roundsDef?: RoundsDef
  economyDef?: EconomyDef
  baseDef?: BaseDef
  turretDef?: TurretDef
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
    lastReward: 0,
    spawnMask: 0,
  }
}

function initialPlayer(def: PlayerDef, map: MapDef): Player {
  const x = map.playerStart?.x ?? 0
  const z = map.playerStart?.z ?? 0
  return {
    x,
    z,
    prevX: x,
    prevZ: z,
    facingX: 0,
    facingZ: -1,
    fireCooldown: 0,
    hp: def.maxHp,
    shield: def.maxShield,
    hurtTimer: 0,
    sinceHurt: 0,
    speedBoostTimer: 0,
    speedBoostMultiplier: 1,
    damageBoostTimer: 0,
    damageBoostMultiplier: 1,
    hidden: false,
    exposed: false,
  }
}

/** Puts every base piece back at tier 1, full life; removes turrets. */
function resetBase(world: World): void {
  const hp = tierDef(1).hp
  for (const s of world.structures) {
    s.hp = hp
    s.maxHp = hp
    s.open = false
  }
  world.sideTier.fill(1)
  for (const t of world.turrets) {
    t.active = false
    t.yaw = t.prevYaw = 0
    t.cooldown = 0
  }
  world.nav.dirty = true
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
  world.player = initialPlayer(world.playerDef, world.map)
  for (const p of world.projectiles) {
    p.active = false
    p.x = p.z = p.prevX = p.prevZ = p.vx = p.vz = p.life = p.damage = 0
  }
  for (const e of world.enemies) {
    e.active = false
    e.x = e.z = e.prevX = e.prevZ = e.hp = 0
    e.wanderX = e.wanderZ = e.wanderTimer = 0
    e.idle = false
  }
  world.activeProjectiles = 0
  world.activeEnemies = 0
  world.kills = 0
  world.spawnTimer = 0
  world.enemyHash.clear()
  world.coins = 0
  world.inventory = {}
  world.weaponLevels = {}
  // Dev state too: a new run must replay from its own log alone.
  world.debugGod = false
  resetBase(world)
}

export function createWorld(options: WorldOptions = {}): World {
  const seed = options.seed ?? 1
  const map = options.map ?? testArena
  const arena = options.arena ?? { ...defaultArena, halfSize: map.halfSize }

  const projectiles: Projectile[] = []
  for (let i = 0; i < arena.maxProjectiles; i++) {
    projectiles.push({
      active: false,
      x: 0,
      z: 0,
      prevX: 0,
      prevZ: 0,
      vx: 0,
      vz: 0,
      life: 0,
      damage: 0,
    })
  }
  const enemies: Enemy[] = []
  for (let i = 0; i < arena.maxEnemies; i++) {
    enemies.push({
      active: false,
      x: 0,
      z: 0,
      prevX: 0,
      prevZ: 0,
      hp: 0,
      wanderX: 0,
      wanderZ: 0,
      wanderTimer: 0,
      idle: false,
    })
  }
  const enemyDef = options.enemyDef ?? walker

  const world: World = {
    seed,
    rng: createRng(seed),
    tick: 0,
    arena,
    map,
    playerDef: options.playerDef ?? defaultPlayer,
    weapon: options.weapon ?? pistol,
    enemyDef,
    spawnDef: options.spawnDef ?? defaultSpawn,
    roundsDef: options.roundsDef ?? defaultRounds,
    round: initialRound(),
    player: initialPlayer(options.playerDef ?? defaultPlayer, map),
    projectiles,
    enemies,
    activeProjectiles: 0,
    activeEnemies: 0,
    kills: 0,
    spawnTimer: 0,
    enemyHash: createSpatialHash(arena.halfSize, HASH_CELL_SIZE, arena.maxEnemies),
    queryBuffer: new Int32Array(arena.maxEnemies),
    debugGod: false,
    economyDef: options.economyDef ?? defaultEconomy,
    coins: 0,
    inventory: {},
    weaponLevels: {},
    baseDef: options.baseDef ?? defaultBase,
    turretDef: options.turretDef ?? defaultTurret,
    structures: (map.slots ?? []).map(() => ({ hp: 0, maxHp: 0, open: false })),
    sideTier: [1, 1, 1, 1],
    turrets: (map.turretSlots ?? []).map(() => ({
      active: false,
      yaw: 0,
      prevYaw: 0,
      cooldown: 0,
    })),
    hideCells: map.hideGrid ? decodeHideGrid(map.hideGrid) : new Uint8Array(0),
    nav: createNavGrid(map, arena.halfSize, enemyDef.radius),
  }
  resetBase(world)
  return world
}
