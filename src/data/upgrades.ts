/**
 * [provisional] Weapon upgrades sold in the shop's "Weapon" tab.
 * They apply to the weapon you have equipped (later: also the one from the Mystery Box),
 * and are tracked per weapon id.
 */
export type WeaponUpgradeId = 'damage' | 'fireRate'

export type WeaponUpgradeDef = {
  id: WeaponUpgradeId
  /** Bonus per level, added to 1 (0.25 = +25% per level, so level 2 = x1.5). */
  perLevel: number
  maxLevel: number
  /** Price of level 1; each next level costs `priceGrowth` times more. */
  basePrice: number
  priceGrowth: number
}

export const weaponUpgrades: readonly WeaponUpgradeDef[] = [
  { id: 'damage', perLevel: 0.25, maxLevel: 5, basePrice: 30, priceGrowth: 1.6 },
  { id: 'fireRate', perLevel: 0.15, maxLevel: 5, basePrice: 30, priceGrowth: 1.6 },
]

export function getWeaponUpgrade(id: string): WeaponUpgradeDef | undefined {
  return weaponUpgrades.find((u) => u.id === id)
}
