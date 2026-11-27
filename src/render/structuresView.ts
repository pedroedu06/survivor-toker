import {
  Group,
  IcosahedronGeometry,
  Mesh,
  MeshBasicMaterial,
  type Object3D,
  type Scene,
} from 'three'
import type { World } from '../core/world'
import { damagePhase } from '../data/base'
import { type SlotDef, sideIndex } from '../data/maps'
import type { MapAssets } from './mapAssets'

/** How far doors swing open (radians) and how fast (per second, eased). */
const DOOR_OPEN_ANGLE = (100 * Math.PI) / 180
const DOOR_SPEED = 6
/** Shake when a piece takes damage / changes damage phase (seconds, meters). */
const HIT_SHAKE = { time: 0.12, amount: 0.03 }
const BREAK_SHAKE = { time: 0.3, amount: 0.08 }
const GRAVITY = 9.8
const DEBRIS_LIFE = 1.1
const DEBRIS_PER_TYPE = 28
const DUST_COUNT = 36
const DUST_LIFE = 0.8

type Piece = {
  def: SlotDef
  holder: Group
  content: Object3D | null
  shownKey: string
  shownPhase: number
  lastHp: number
  shakeTime: number
  shakeAmount: number
  /** Door swing: current angle and the sign that opens it into the base. */
  angle: number
  openSign: number
}

type Particle = {
  obj: Object3D
  life: number
  vx: number
  vy: number
  vz: number
  spin: number
}

export type StructuresView = {
  update(world: World, dt: number, nowMs: number): void
}

const DEBRIS_TYPES = [
  'debris_wood_plank',
  'debris_wood_splinter',
  'debris_metal_plate',
  'debris_metal_bolt',
  'debris_titanium_shard',
] as const
type DebrisType = (typeof DEBRIS_TYPES)[number]

/** Debris thrown when a piece of this tier breaks a bit more (MAPS.md). */
function debrisFor(tier: number): readonly DebrisType[] {
  if (tier <= 1) return ['debris_wood_plank', 'debris_wood_splinter']
  if (tier === 2) return ['debris_wood_plank', 'debris_wood_splinter', 'debris_metal_bolt']
  if (tier === 3) return ['debris_metal_plate', 'debris_metal_bolt']
  return ['debris_titanium_shard', 'debris_metal_bolt']
}

/**
 * Walls and doors of the base: swaps each piece's mesh for its tier/damage phase prefab,
 * swings doors, shakes pieces when hit and throws debris + dust when they break.
 * Prefab clones happen only when a piece changes tier/phase (rare); particles are pooled.
 */
export function createStructuresView(
  scene: Scene,
  world: World,
  assets: MapAssets,
): StructuresView {
  const prefabs = assets.prefabs.scene
  const templates = new Map<string, Object3D | null>()
  const template = (name: string): Object3D | null => {
    if (!templates.has(name)) {
      const found = prefabs.getObjectByName(name) ?? null
      templates.set(name, found)
    }
    return templates.get(name) ?? null
  }
  const instance = (name: string): Object3D | null => {
    const t = template(name)
    if (!t) return null
    const copy = t.clone()
    copy.position.set(0, 0, 0)
    copy.rotation.set(0, 0, 0)
    copy.traverse((o) => {
      o.castShadow = true
      o.receiveShadow = false
    })
    return copy
  }

  const pieces: Piece[] = (world.map.slots ?? []).map((def) => {
    const holder = new Group()
    holder.position.set(def.x, 0, def.z)
    holder.rotation.y = def.yaw
    scene.add(holder)
    // Door: swing toward the base center (inward).
    let openSign = 1
    if (def.kind === 'door') {
      const mid = (sign: number) => {
        const a = def.yaw + sign * DOOR_OPEN_ANGLE * 0.5
        return Math.hypot(def.x + Math.cos(a) * 1.27, def.z - Math.sin(a) * 1.27)
      }
      openSign = mid(1) < mid(-1) ? 1 : -1
    }
    return {
      def,
      holder,
      content: null,
      shownKey: '',
      shownPhase: 0,
      lastHp: -1,
      shakeTime: 0,
      shakeAmount: 0,
      angle: 0,
      openSign,
    }
  })

  // ---- Particle pools ----
  const debris = new Map<DebrisType, Particle[]>()
  for (const type of DEBRIS_TYPES) {
    const pool: Particle[] = []
    for (let i = 0; i < DEBRIS_PER_TYPE; i++) {
      const obj = instance(type)
      if (!obj) break
      obj.visible = false
      scene.add(obj)
      pool.push({ obj, life: 0, vx: 0, vy: 0, vz: 0, spin: 0 })
    }
    debris.set(type, pool)
  }
  const dustMat = new MeshBasicMaterial({
    color: 0xe6d6b8,
    transparent: true,
    opacity: 0.45,
    depthWrite: false,
  })
  const dustGeo = new IcosahedronGeometry(0.22, 0)
  const dust: Particle[] = []
  for (let i = 0; i < DUST_COUNT; i++) {
    const obj = new Mesh(dustGeo, dustMat)
    obj.visible = false
    scene.add(obj)
    dust.push({ obj, life: 0, vx: 0, vy: 0, vz: 0, spin: 0 })
  }

  const emit = (pool: Particle[] | undefined, count: number, piece: Piece, isDust: boolean) => {
    if (!pool) return
    const b = piece.def.box
    for (let n = 0; n < count; n++) {
      const p = pool.find((q) => q.life <= 0)
      if (!p) return
      // Somewhere along the piece, at mid height.
      const along = (Math.random() * 2 - 1) * b.hx
      p.obj.position.set(b.x + along * b.ux, 0.3 + Math.random() * 0.8, b.z + along * b.uz)
      const out = Math.random() < 0.5 ? -1 : 1
      const side = 1 + Math.random() * 2
      p.vx = -b.uz * out * side + (Math.random() - 0.5)
      p.vz = b.ux * out * side + (Math.random() - 0.5)
      p.vy = isDust ? 0.4 + Math.random() * 0.4 : 2 + Math.random() * 2.5
      p.spin = (Math.random() - 0.5) * 16
      p.life = isDust ? DUST_LIFE : DEBRIS_LIFE
      p.obj.scale.setScalar(isDust ? 0.6 : 1)
      p.obj.rotation.set(Math.random() * 6, Math.random() * 6, Math.random() * 6)
      p.obj.visible = true
    }
  }

  const stepParticles = (pool: Particle[], dt: number, isDust: boolean) => {
    for (const p of pool) {
      if (p.life <= 0) continue
      p.life -= dt
      if (p.life <= 0) {
        p.obj.visible = false
        continue
      }
      const o = p.obj
      if (isDust) {
        o.position.x += p.vx * 0.25 * dt
        o.position.z += p.vz * 0.25 * dt
        o.position.y += p.vy * dt
        const t = 1 - p.life / DUST_LIFE
        o.scale.setScalar(0.6 + t * 1.8 * (1 - t * 0.6))
        continue
      }
      p.vy -= GRAVITY * dt
      o.position.x += p.vx * dt
      o.position.y += p.vy * dt
      o.position.z += p.vz * dt
      if (o.position.y < 0.03) {
        o.position.y = 0.03
        p.vy = Math.abs(p.vy) * 0.3
        p.vx *= 0.6
        p.vz *= 0.6
        p.spin *= 0.5
      }
      o.rotation.x += p.spin * dt
      o.rotation.z += p.spin * 0.7 * dt
      if (p.life < 0.3) o.scale.setScalar(p.life / 0.3)
    }
  }

  return {
    update(world, dt, nowMs) {
      for (let i = 0; i < pieces.length; i++) {
        const piece = pieces[i] as Piece
        const s = world.structures[i]
        if (!s) continue
        const tier = world.sideTier[sideIndex(piece.def.side)] ?? 1
        const phase = damagePhase(s.hp, s.maxHp)
        const key = `prefab_${piece.def.kind}_t${tier}${phase > 0 ? `_d${phase}` : ''}`

        if (key !== piece.shownKey) {
          const rebuilt = phase < piece.shownPhase || piece.shownKey === ''
          if (piece.content) piece.holder.remove(piece.content)
          piece.content = instance(key) ?? instance(`prefab_${piece.def.kind}_t${tier}`)
          if (piece.content) piece.holder.add(piece.content)
          if (!rebuilt && phase > piece.shownPhase) {
            // Broke a bit more: debris + dust + a bigger shake.
            const types = debrisFor(tier)
            for (const type of types) emit(debris.get(type), 2 + phase, piece, false)
            emit(dust, 2 + phase, piece, true)
            piece.shakeTime = BREAK_SHAKE.time
            piece.shakeAmount = BREAK_SHAKE.amount
          }
          piece.shownKey = key
          piece.shownPhase = phase
        } else if (piece.lastHp >= 0 && s.hp < piece.lastHp - 1e-6 && piece.shakeTime <= 0) {
          piece.shakeTime = HIT_SHAKE.time
          piece.shakeAmount = HIT_SHAKE.amount
        }
        piece.lastHp = s.hp

        // Door swing (broken doors lie as rubble, no swing).
        if (piece.def.kind === 'door') {
          const target = s.open && phase < 4 ? DOOR_OPEN_ANGLE : 0
          piece.angle += (target - piece.angle) * Math.min(1, dt * DOOR_SPEED)
          piece.holder.rotation.y = piece.def.yaw + piece.openSign * piece.angle
        }

        // Shake the mesh inside the holder.
        const c = piece.content
        if (c) {
          if (piece.shakeTime > 0) {
            piece.shakeTime -= dt
            const a = piece.shakeAmount * Math.max(0, piece.shakeTime / BREAK_SHAKE.time)
            c.position.set(Math.sin(nowMs * 0.09) * a, 0, Math.cos(nowMs * 0.11) * a)
          } else if (c.position.x !== 0 || c.position.z !== 0) {
            c.position.set(0, 0, 0)
          }
        }
      }
      for (const pool of debris.values()) stepParticles(pool, dt, false)
      stepParticles(dust, dt, true)
    },
  }
}
