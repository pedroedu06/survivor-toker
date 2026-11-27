/** [provisional] In-run shop catalog. Prices and effects are guesses until tested. */
export type ShopItemId =
  | 'shield'
  | 'healthPotion'
  | 'speedPotion'
  | 'damagePotion'
  | 'katana'
  | 'knife'
  | 'axe'

/** Turrets and walls are bought in the shop's "Base" tab (data/base.ts, data/turrets.ts). */
export type ShopItemKind = 'shield' | 'potion' | 'melee'

export type ShopItem = {
  id: ShopItemId
  kind: ShopItemKind
  price: number
  /** false = "coming soon": listed, but cannot be bought (no model/behavior yet). */
  available: boolean
  /** Inventory items (potions): max carried at once. */
  maxStack?: number
  /** Health potion: HP restored. */
  heal?: number
  /** Damage potion: damage multiplier (uses `duration`). */
  damageMultiplier?: number
  /** Speed potion: speed multiplier and how long it lasts, in seconds. */
  speedMultiplier?: number
  duration?: number
}

export const shopItems: readonly ShopItem[] = [
  { id: 'shield', kind: 'shield', price: 20, available: true },
  { id: 'healthPotion', kind: 'potion', price: 15, available: true, maxStack: 3, heal: 50 },
  {
    id: 'speedPotion',
    kind: 'potion',
    price: 15,
    available: true,
    maxStack: 3,
    speedMultiplier: 1.4,
    duration: 10,
  },
  {
    id: 'damagePotion',
    kind: 'potion',
    price: 20,
    available: true,
    maxStack: 3,
    damageMultiplier: 1.5,
    duration: 10,
  },
  // Coming soon: behavior comes after the Blender models.
  { id: 'katana', kind: 'melee', price: 150, available: false },
  { id: 'knife', kind: 'melee', price: 60, available: false },
  { id: 'axe', kind: 'melee', price: 120, available: false },
]

export function getShopItem(id: string): ShopItem | undefined {
  return shopItems.find((item) => item.id === id)
}
