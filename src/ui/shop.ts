import type { World } from '../core/world'
import { SIDES, type Side, sideIndex } from '../data/maps'
import { shopItems } from '../data/shop'
import { weaponUpgrades } from '../data/upgrades'
import {
  canBuyTurret,
  canRepairSide,
  canUpgradeSide,
  repairSidePrice,
  sideLifeFraction,
  upgradeSidePrice,
} from '../systems/base'
import { type BuyResult, canBuy, canUpgrade, upgradePrice } from '../systems/shop'
import { weaponLevel } from '../systems/weaponStats'
import { button, coinIcon, el, setText } from './dom'
import { baseIcons, itemIcons, upgradeIcons } from './icons'
import { strings } from './strings'

export type ShopPanelCallbacks = {
  onBuy(id: string): void
  onUpgrade(id: string): void
  /** Base command (`upgrade:<side>` / `repair:<side>`). */
  onBase(command: string): void
  /** "Buy turret": the caller closes the shop and lets the player pick a side. */
  onPlaceTurret(): void
}

export type ShopPanel = {
  readonly isOpen: boolean
  open(): void
  close(): void
  /** Call every frame; only touches the DOM when something shown changes. */
  update(world: World): void
}

type Tab = 'items' | 'weapon' | 'base'

type SideCard = {
  side: Side
  card: HTMLElement
  icon: HTMLElement
  tier: HTMLElement
  bar: HTMLElement
  upgradeButton: HTMLButtonElement
  upgradePrice: HTMLElement
  repairButton: HTMLButtonElement
  repairPrice: HTMLElement
  shown: string
}

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
  const baseTab = button('shop-tab', tabs, strings.tabBase, () => selectTab('base'))

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

  // ---- Base tab (walls per side + turrets) ----
  const baseSection = el('div', 'shop-base', panel)
  el('div', 'shop-weapon-hint', baseSection).textContent = strings.baseHint
  const baseGrid = el('div', 'shop-grid', baseSection)
  const sideCards: SideCard[] = []
  const priceTag = (parent: HTMLElement) => {
    const tag = el('span', 'shop-price-tag', parent)
    coinIcon(tag)
    return el('span', '', tag)
  }
  for (const side of SIDES) {
    const card = el('div', 'shop-card shop-side', baseGrid)
    el('div', 'shop-card-name', card).textContent = strings.wallSide(strings.sides[side] ?? side)
    const tierRow = el('div', 'shop-card-level', card)
    const icon = el('span', 'shop-side-icon', tierRow)
    const tier = el('span', '', tierRow)
    const barBox = el('div', 'shop-life', card)
    const bar = el('div', 'shop-life-fill', barBox)
    const actions = el('div', 'shop-side-actions', card)
    const upgradeButton = button('hud-button shop-buy', actions, '', () =>
      callbacks.onBase(`upgrade:${side}`),
    )
    el('span', '', upgradeButton).textContent = strings.upgrade
    const upgradePriceValue = priceTag(upgradeButton)
    const repairButton = button('hud-button shop-buy shop-repair', actions, '', () =>
      callbacks.onBase(`repair:${side}`),
    )
    el('span', '', repairButton).textContent = strings.repair
    const repairPriceValue = priceTag(repairButton)
    sideCards.push({
      side,
      card,
      icon,
      tier,
      bar,
      upgradeButton,
      upgradePrice: upgradePriceValue,
      repairButton,
      repairPrice: repairPriceValue,
      shown: '',
    })
  }
  const turretCard = el('div', 'shop-card', baseGrid)
  el('div', 'shop-card-icon', turretCard).textContent = baseIcons.turret
  el('div', 'shop-card-name', turretCard).textContent = strings.turret.name
  el('div', 'shop-card-desc', turretCard).textContent = strings.turret.desc
  const turretPrice = el('div', 'shop-card-price', turretCard)
  coinIcon(turretPrice)
  const turretPriceValue = el('span', '', turretPrice)
  const turretOwned = el('div', 'shop-card-owned', turretCard)
  const turretButton = button('hud-button shop-buy', turretCard, strings.buy, () =>
    callbacks.onPlaceTurret(),
  )
  let shownTurret = ''

  button('hud-button shop-close', panel, strings.close, () => close())

  let isOpen = false
  let shownCoins = -1
  let shownWeapon = ''

  function selectTab(tab: Tab) {
    overlay.dataset.tab = tab
    itemsTab.classList.toggle('active', tab === 'items')
    weaponTab.classList.toggle('active', tab === 'weapon')
    baseTab.classList.toggle('active', tab === 'base')
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

  function updateBase(world: World) {
    const hasBase = (world.map.slots?.length ?? 0) > 0
    baseTab.hidden = !hasBase
    if (!hasBase) return
    for (const c of sideCards) {
      const tier = world.sideTier[sideIndex(c.side)] ?? 1
      const life = sideLifeFraction(world, c.side)
      const up = canUpgradeSide(world, c.side)
      const fix = canRepairSide(world, c.side)
      const upPrice = upgradeSidePrice(world, c.side)
      const fixPrice = repairSidePrice(world, c.side)
      const key = `${tier}|${life.toFixed(3)}|${up}|${fix}|${upPrice}|${fixPrice}`
      if (key === c.shown) continue
      c.shown = key
      setText(c.icon, baseIcons.tiers[tier] ?? '')
      setText(c.tier, strings.tiers[tier] ?? '')
      c.bar.style.width = `${Math.round(life * 100)}%`
      c.bar.classList.toggle('low', life < 0.35)
      c.upgradeButton.disabled = up !== 'ok'
      c.upgradeButton.classList.toggle('maxed', up === 'full')
      setText(c.upgradePrice, up === 'full' ? strings.maxed : String(upPrice))
      c.upgradePrice.parentElement?.classList.toggle('no-coin', up === 'full')
      c.repairButton.disabled = fix !== 'ok'
      setText(c.repairPrice, fix === 'full' ? strings.intact : String(fixPrice))
      c.repairPrice.parentElement?.classList.toggle('no-coin', fix === 'full')
    }
    const slots = world.map.turretSlots ?? []
    const placed = world.turrets.filter((t) => t.active).length
    const anyFree = SIDES.some((side) => canBuyTurret(world, side) === 'ok')
    const full = placed >= slots.length
    const key = `${placed}|${anyFree}|${world.turretDef.price}`
    if (key !== shownTurret) {
      shownTurret = key
      setText(turretPriceValue, String(world.turretDef.price))
      setText(turretOwned, placed > 0 ? strings.turretsPlaced(placed, slots.length) : '')
      turretButton.disabled = !anyFree
      setText(turretButton, full ? strings.full : strings.buy)
    }
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

      updateBase(world)
    },
  }
}
