import type { World } from '../core/world'
import { tierDef } from '../data/base'
import { SIDES, type Side, type SlotDef, sideIndex } from '../data/maps'
import type { BuyResult } from './shop'

/** Max tier a side can reach (titanium). */
export const MAX_TIER = 4

/** Damages one base piece. At 0 it breaks: it stops blocking and the zombie field updates. */
export function damageStructure(world: World, slot: number, amount: number): void {
  const s = world.structures[slot]
  if (!s || s.hp <= 0 || amount <= 0) return
  s.hp -= amount
  if (s.hp <= 0) {
    s.hp = 0
    s.open = false
    world.nav.dirty = true
  }
}

/** Opens each intact door while the player is near it (only the player passes through). */
export function updateDoors(world: World): void {
  const slots = world.map.slots
  if (!slots) return
  const p = world.player
  const r2 = world.baseDef.doorOpenRadius ** 2
  for (let i = 0; i < slots.length; i++) {
    const def = slots[i] as SlotDef
    const s = world.structures[i]
    if (!s || def.kind !== 'door') continue
    const dx = p.x - def.box.x
    const dz = p.z - def.box.z
    s.open = s.hp > 0 && dx * dx + dz * dz <= r2
  }
}

function isSide(v: string): v is Side {
  return (SIDES as readonly string[]).includes(v)
}

/** Does this map have base pieces on `side`? */
function sideHasSlots(world: World, side: Side): boolean {
  return (world.map.slots ?? []).some((s) => s.side === side)
}

/** Price to upgrade `side` to its next tier (0 if maxed or no such side). */
export function upgradeSidePrice(world: World, side: Side): number {
  const tier = world.sideTier[sideIndex(side)] ?? 1
  if (tier >= MAX_TIER) return 0
  return tierDef(tier + 1).upgradePrice
}

export function canUpgradeSide(world: World, side: Side): BuyResult {
  if (!sideHasSlots(world, side)) return 'unavailable'
  if (world.round.phase !== 'intermission') return 'closed'
  if ((world.sideTier[sideIndex(side)] ?? 1) >= MAX_TIER) return 'full'
  if (world.coins < upgradeSidePrice(world, side)) return 'noCoins'
  return 'ok'
}

/** Upgrades a whole side (walls + its doors) one tier, rebuilt at full life. */
export function upgradeSide(world: World, side: Side): BuyResult {
  const result = canUpgradeSide(world, side)
  if (result !== 'ok') return result
  world.coins -= upgradeSidePrice(world, side)
  const index = sideIndex(side)
  world.sideTier[index] = (world.sideTier[index] ?? 1) + 1
  restoreSide(world, side)
  return 'ok'
}

/** Missing life over all pieces of a side. */
export function sideMissingHp(world: World, side: Side): number {
  let missing = 0
  const slots = world.map.slots ?? []
  for (let i = 0; i < slots.length; i++) {
    if (slots[i]?.side !== side) continue
    const s = world.structures[i]
    if (s) missing += s.maxHp - s.hp
  }
  return missing
}

/** Life of a side as a fraction (sum of pieces), 1 = intact. */
export function sideLifeFraction(world: World, side: Side): number {
  let hp = 0
  let max = 0
  const slots = world.map.slots ?? []
  for (let i = 0; i < slots.length; i++) {
    if (slots[i]?.side !== side) continue
    const s = world.structures[i]
    if (!s) continue
    hp += s.hp
    max += s.maxHp
  }
  return max > 0 ? hp / max : 1
}

export function repairSidePrice(world: World, side: Side): number {
  const missing = sideMissingHp(world, side)
  return missing > 0 ? Math.max(1, Math.ceil(missing * world.baseDef.repairPricePerHp)) : 0
}

export function canRepairSide(world: World, side: Side): BuyResult {
  if (!sideHasSlots(world, side)) return 'unavailable'
  if (world.round.phase !== 'intermission') return 'closed'
  if (sideMissingHp(world, side) <= 0) return 'full'
  if (world.coins < repairSidePrice(world, side)) return 'noCoins'
  return 'ok'
}

/** Repairs (and rebuilds broken) pieces of a side to full life. */
export function repairSide(world: World, side: Side): BuyResult {
  const result = canRepairSide(world, side)
  if (result !== 'ok') return result
  world.coins -= repairSidePrice(world, side)
  restoreSide(world, side)
  return 'ok'
}

/** Full life at the side's current tier (rebuilds broken pieces). */
export function restoreSide(world: World, side: Side): void {
  const hp = tierDef(world.sideTier[sideIndex(side)] ?? 1).hp
  const slots = world.map.slots ?? []
  for (let i = 0; i < slots.length; i++) {
    if (slots[i]?.side !== side) continue
    const s = world.structures[i]
    if (!s) continue
    s.hp = hp
    s.maxHp = hp
  }
  world.nav.dirty = true
}

/** Index of the turret slot on `side` (-1 if the map has none there). */
export function turretSlotIndex(world: World, side: Side): number {
  return (world.map.turretSlots ?? []).findIndex((t) => t.side === side)
}

export function canBuyTurret(world: World, side: Side): BuyResult {
  const index = turretSlotIndex(world, side)
  if (index < 0) return 'unavailable'
  if (world.round.phase !== 'intermission') return 'closed'
  if (world.turrets[index]?.active) return 'full'
  if (world.coins < world.turretDef.price) return 'noCoins'
  return 'ok'
}

/** Places a turret on the block of `side`, facing outward. */
export function buyTurret(world: World, side: Side): BuyResult {
  const result = canBuyTurret(world, side)
  if (result !== 'ok') return result
  world.coins -= world.turretDef.price
  placeTurret(world, side)
  return 'ok'
}

export function placeTurret(world: World, side: Side): void {
  const index = turretSlotIndex(world, side)
  const t = world.turrets[index]
  const slot = world.map.turretSlots?.[index]
  if (!t || !slot) return
  t.active = true
  // The slot's local +Z (barrel) faces outward: yaw = slot yaw.
  t.yaw = t.prevYaw = slot.yaw
  t.cooldown = 0
}

/** Base shop command from the input: `upgrade:<side>`, `repair:<side>`, `turret:<side>`. */
export function applyBaseCommand(world: World, command: string): BuyResult {
  if (!command) return 'unavailable'
  const [action = '', side = ''] = command.split(':')
  if (!isSide(side)) return 'unavailable'
  switch (action) {
    case 'upgrade':
      return upgradeSide(world, side)
    case 'repair':
      return repairSide(world, side)
    case 'turret':
      return buyTurret(world, side)
    default:
      return 'unavailable'
  }
}
