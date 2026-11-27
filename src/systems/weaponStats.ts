import type { World } from '../core/world'
import { getWeaponUpgrade } from '../data/upgrades'

/** Upgrade level bought for the equipped weapon. */
export function weaponLevel(world: World, upgradeId: string): number {
  return world.weaponLevels[world.weapon.id]?.[upgradeId] ?? 0
}

/** 1 + perLevel x level for the equipped weapon (1 = no upgrade). */
export function upgradeMultiplier(world: World, upgradeId: string): number {
  const def = getWeaponUpgrade(upgradeId)
  return def ? 1 + def.perLevel * weaponLevel(world, upgradeId) : 1
}

/** Damage per hit: base x weapon upgrade x damage potion (while active). */
export function effectiveDamage(world: World): number {
  const p = world.player
  const potion = p.damageBoostTimer > 0 ? p.damageBoostMultiplier : 1
  return world.weapon.damage * upgradeMultiplier(world, 'damage') * potion
}

/** Shots per second: base x weapon upgrade. */
export function effectiveFireRate(world: World): number {
  return world.weapon.fireRate * upgradeMultiplier(world, 'fireRate')
}
