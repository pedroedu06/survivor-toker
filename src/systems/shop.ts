import type { InputState } from '../core/input'
import type { World } from '../core/world'
import { getShopItem } from '../data/shop'
import { getWeaponUpgrade } from '../data/upgrades'
import { weaponLevel } from './weaponStats'

export type BuyResult = 'ok' | 'closed' | 'unavailable' | 'noCoins' | 'full'

/** Why an item can or cannot be bought right now (the UI uses this to disable buttons). */
export function canBuy(world: World, id: string): BuyResult {
  const item = getShopItem(id)
  if (!item?.available) return 'unavailable'
  if (world.round.phase !== 'intermission') return 'closed'
  if (world.coins < item.price) return 'noCoins'
  if (item.kind === 'shield' && world.player.shield >= world.playerDef.maxShield) return 'full'
  if (item.maxStack !== undefined && (world.inventory[id] ?? 0) >= item.maxStack) return 'full'
  return 'ok'
}

/** Buys an item in the intermission. Shield applies now; potions go to the inventory. */
export function buyItem(world: World, id: string): BuyResult {
  const result = canBuy(world, id)
  if (result !== 'ok') return result
  const item = getShopItem(id)
  if (!item) return 'unavailable'

  world.coins -= item.price
  if (item.kind === 'shield') {
    world.player.shield = world.playerDef.maxShield
  } else {
    world.inventory[id] = (world.inventory[id] ?? 0) + 1
  }
  return 'ok'
}

/** Uses a carried item during an active round. Returns true if it was used. */
export function useItem(world: World, id: string): boolean {
  const item = getShopItem(id)
  const count = world.inventory[id] ?? 0
  if (!item || count <= 0 || world.round.phase !== 'active') return false

  const p = world.player
  if (item.heal !== undefined) {
    if (p.hp >= world.playerDef.maxHp) return false // do not waste it
    p.hp = Math.min(world.playerDef.maxHp, p.hp + item.heal)
  } else if (item.speedMultiplier !== undefined) {
    p.speedBoostMultiplier = item.speedMultiplier
    p.speedBoostTimer = item.duration ?? 0
  } else if (item.damageMultiplier !== undefined) {
    p.damageBoostMultiplier = item.damageMultiplier
    p.damageBoostTimer = item.duration ?? 0
  } else {
    return false
  }

  world.inventory[id] = count - 1
  return true
}

/** Applies this step's shop commands and ticks timed effects. */
export function updateShop(world: World, input: InputState, dt: number): void {
  if (input.buyItem) buyItem(world, input.buyItem)
  if (input.useItem) useItem(world, input.useItem)
  if (input.upgradeWeapon) buyWeaponUpgrade(world, input.upgradeWeapon)

  const p = world.player
  if (p.speedBoostTimer > 0) {
    p.speedBoostTimer = Math.max(0, p.speedBoostTimer - dt)
    if (p.speedBoostTimer === 0) p.speedBoostMultiplier = 1
  }
  if (p.damageBoostTimer > 0) {
    p.damageBoostTimer = Math.max(0, p.damageBoostTimer - dt)
    if (p.damageBoostTimer === 0) p.damageBoostMultiplier = 1
  }
}

/** Price of the next level of an upgrade for the equipped weapon (0 if maxed/unknown). */
export function upgradePrice(world: World, upgradeId: string): number {
  const def = getWeaponUpgrade(upgradeId)
  if (!def) return 0
  const level = weaponLevel(world, upgradeId)
  if (level >= def.maxLevel) return 0
  return Math.round(def.basePrice * def.priceGrowth ** level)
}

/** Why the next level of a weapon upgrade can or cannot be bought right now. */
export function canUpgrade(world: World, upgradeId: string): BuyResult {
  const def = getWeaponUpgrade(upgradeId)
  if (!def) return 'unavailable'
  if (world.round.phase !== 'intermission') return 'closed'
  if (weaponLevel(world, upgradeId) >= def.maxLevel) return 'full'
  if (world.coins < upgradePrice(world, upgradeId)) return 'noCoins'
  return 'ok'
}

/** Buys the next level of an upgrade for the equipped weapon (tracked per weapon id). */
export function buyWeaponUpgrade(world: World, upgradeId: string): BuyResult {
  const result = canUpgrade(world, upgradeId)
  if (result !== 'ok') return result
  world.coins -= upgradePrice(world, upgradeId)
  const weaponId = world.weapon.id
  const levels = world.weaponLevels[weaponId] ?? {}
  levels[upgradeId] = (levels[upgradeId] ?? 0) + 1
  world.weaponLevels[weaponId] = levels
  return 'ok'
}
