import type { World } from '../core/world'
import { shopItems } from '../data/shop'
import { weaponUpgrades } from '../data/upgrades'
import { type BuyResult, canBuy, canUpgrade, upgradePrice } from '../systems/shop'
import { weaponLevel } from '../systems/weaponStats'
import { button, coinIcon, el, setText } from './dom'
import { itemIcons, upgradeIcons } from './icons'
import { strings } from './strings'

export type ShopPanelCallbacks = {
  onBuy(id: string): void
  onUpgrade(id: string): void
}

export type ShopPanel = {
  readonly isOpen: boolean
  open(): void
  close(): void
  /** Call every frame; only touches the DOM when something shown changes. */
  update(world: World): void
}

type Tab = 'items' | 'weapon'

type ItemCard = {
  id: string
  button: HTMLButtonElement
  owned: HTMLElement
  shownResult: BuyResult | ''
  shownOwned: number
}

type UpgradeCard = {
  id: string
  perLevel: number
  maxLevel: number
  level: HTMLElement
  effect: HTMLElement
  price: HTMLElement
  priceValue: HTMLElement
  button: HTMLButtonElement
  shownResult: BuyResult | ''
  shownLevel: number
}

const percent = (fraction: number) => `+${Math.round(fraction * 100)}%`

/** Simple in-run shop: a modal with two tabs, "Items" and "Weapon" (upgrades). */
export function createShopPanel(parent: HTMLElement, callbacks: ShopPanelCallbacks): ShopPanel {
  const overlay = el('div', 'shop', parent)
  const panel = el('div', 'shop-panel', overlay)

  const header = el('div', 'shop-header', panel)
  el('h2', 'shop-title', header).textContent = strings.shop
  const balance = el('div', 'shop-balance', header)
  coinIcon(balance)
  const balanceValue = el('span', 'shop-balance-value', balance)

  const tabs = el('div', 'shop-tabs', panel)
  const itemsTab = button('shop-tab', tabs, strings.tabItems, () => selectTab('items'))
  const weaponTab = button('shop-tab', tabs, strings.tabWeapon, () => selectTab('weapon'))

  // ---- Items tab ----
  const grid = el('div', 'shop-grid', panel)
  const itemCards: ItemCard[] = shopItems.map((item) => {
    const card = el('div', `shop-card${item.available ? '' : ' shop-card--soon'}`, grid)
    el('div', 'shop-card-icon', card).textContent = itemIcons[item.id] ?? '?'
    const text = strings.items[item.id]
    el('div', 'shop-card-name', card).textContent = text?.name ?? item.id
    el('div', 'shop-card-desc', card).textContent = text?.desc ?? ''
    const price = el('div', 'shop-card-price', card)
    coinIcon(price)
    el('span', '', price).textContent = String(item.price)
    const owned = el('div', 'shop-card-owned', card)
    const buyButton = button('hud-button shop-buy', card, strings.buy, () =>
      callbacks.onBuy(item.id),
    )
    return { id: item.id, button: buyButton, owned, shownResult: '', shownOwned: -1 }
  })

  // ---- Weapon tab (upgrades for the equipped weapon) ----
  const weaponSection = el('div', 'shop-weapon', panel)
  const weaponName = el('div', 'shop-weapon-name', weaponSection)
  el('div', 'shop-weapon-hint', weaponSection).textContent = strings.weaponHint
  const upgradeGrid = el('div', 'shop-grid', weaponSection)
  const upgradeCards: UpgradeCard[] = weaponUpgrades.map((up) => {
    const card = el('div', 'shop-card', upgradeGrid)
    el('div', 'shop-card-icon', card).textContent = upgradeIcons[up.id] ?? '?'
    el('div', 'shop-card-name', card).textContent = strings.upgrades[up.id] ?? up.id
    const level = el('div', 'shop-card-level', card)
    const effect = el('div', 'shop-card-desc', card)
    const price = el('div', 'shop-card-price', card)
    coinIcon(price)
    const priceValue = el('span', '', price)
    const upButton = button('hud-button shop-buy', card, strings.upgrade, () =>
      callbacks.onUpgrade(up.id),
    )
    return {
      id: up.id,
      perLevel: up.perLevel,
      maxLevel: up.maxLevel,
      level,
      effect,
      price,
      priceValue,
      button: upButton,
      shownResult: '',
      shownLevel: -1,
    }
  })

  button('hud-button shop-close', panel, strings.close, () => close())

  let isOpen = false
  let shownCoins = -1
  let shownWeapon = ''

  function selectTab(tab: Tab) {
    overlay.dataset.tab = tab
    itemsTab.classList.toggle('active', tab === 'items')
    weaponTab.classList.toggle('active', tab === 'weapon')
  }
  selectTab('items')

  function open() {
    isOpen = true
    overlay.classList.add('open')
  }
  function close() {
    isOpen = false
    overlay.classList.remove('open')
  }

  return {
    get isOpen() {
      return isOpen
    },
    open,
    close,
    update(world) {
      // The shop only exists in the intermission.
      if (isOpen && world.round.phase !== 'intermission') close()
      if (!isOpen) return

      if (world.coins !== shownCoins) {
        shownCoins = world.coins
        setText(balanceValue, String(world.coins))
      }

      for (const card of itemCards) {
        const result = canBuy(world, card.id)
        if (result !== card.shownResult) {
          card.shownResult = result
          card.button.disabled = result !== 'ok'
          setText(
            card.button,
            result === 'unavailable'
              ? strings.comingSoon
              : result === 'full'
                ? strings.full
                : strings.buy,
          )
        }
        const count = world.inventory[card.id] ?? 0
        if (count !== card.shownOwned) {
          card.shownOwned = count
          setText(card.owned, count > 0 ? strings.owned(count) : '')
        }
      }

      if (world.weapon.id !== shownWeapon) {
        shownWeapon = world.weapon.id
        setText(weaponName, strings.weapons[world.weapon.id] ?? world.weapon.id)
        for (const card of upgradeCards) card.shownLevel = -1 // new weapon: refresh levels
      }

      for (const card of upgradeCards) {
        const level = weaponLevel(world, card.id)
        if (level !== card.shownLevel) {
          card.shownLevel = level
          const maxed = level >= card.maxLevel
          setText(card.level, strings.level(level, card.maxLevel))
          setText(
            card.effect,
            maxed
              ? percent(card.perLevel * level)
              : `${percent(card.perLevel * level)} → ${percent(card.perLevel * (level + 1))}`,
          )
          card.price.hidden = maxed
          setText(card.priceValue, String(upgradePrice(world, card.id)))
        }
        const result = canUpgrade(world, card.id)
        if (result !== card.shownResult) {
          card.shownResult = result
          card.button.disabled = result !== 'ok'
          setText(card.button, result === 'full' ? strings.maxed : strings.upgrade)
        }
      }
    },
  }
}
