import type { World } from '../core/world'
import { SIDES, type Side } from '../data/maps'
import { canBuyTurret } from '../systems/base'
import { button, coinIcon, el, setText } from './dom'
import { strings } from './strings'

export type TurretPlacementCallbacks = {
  /** Selection changed (null = none): the renderer highlights that ghost. */
  onSelect(side: Side | null): void
  /** Buy and place on `side`. */
  onConfirm(side: Side): void
  /** Closed without buying (back to the shop). */
  onCancel(): void
}

export type TurretPlacementBar = {
  readonly isOpen: boolean
  open(): void
  close(): void
  update(world: World): void
}

/**
 * Bottom bar shown after "buy turret": ghost turrets appear on the free turret blocks and the
 * player picks a side (N/L/S/O), then confirms. Nothing is bought until "Confirmar".
 */
export function createTurretPlacement(
  parent: HTMLElement,
  callbacks: TurretPlacementCallbacks,
): TurretPlacementBar {
  const bar = el('div', 'turret-place', parent)
  el('div', 'turret-place-title', bar).textContent = strings.placeTurretTitle
  el('div', 'turret-place-hint', bar).textContent = strings.placeTurretHint
  const row = el('div', 'turret-place-row', bar)
  const sides = el('div', 'turret-place-sides', row)
  let selected: Side | null = null
  const sideButtons = SIDES.map((side) => {
    const b = button('hud-button turret-side', sides, strings.sides[side] ?? side, () =>
      select(side),
    )
    b.dataset.side = side
    return { side, button: b }
  })
  const actions = el('div', 'turret-place-actions', row)
  button('hud-button turret-cancel', actions, strings.cancel, () => {
    close()
    callbacks.onCancel()
  })
  const confirm = button('hud-button turret-confirm', actions, '', () => {
    if (!selected) return
    const side = selected
    close()
    callbacks.onConfirm(side)
  })
  el('span', '', confirm).textContent = strings.confirm
  const price = el('span', 'shop-price-tag', confirm)
  coinIcon(price)
  const priceValue = el('span', '', price)

  let isOpen = false
  let shown = ''

  function select(side: Side | null) {
    selected = side
    for (const s of sideButtons) s.button.classList.toggle('active', s.side === side)
    confirm.disabled = side === null
    callbacks.onSelect(side)
  }

  function open() {
    isOpen = true
    shown = ''
    bar.classList.add('open')
    parent.classList.add('placing-turret')
    select(null)
  }

  function close() {
    isOpen = false
    bar.classList.remove('open')
    parent.classList.remove('placing-turret')
    select(null)
  }

  return {
    get isOpen() {
      return isOpen
    },
    open,
    close,
    update(world) {
      if (!isOpen) return
      if (world.round.phase !== 'intermission') {
        close()
        return
      }
      const key = SIDES.map((s) => canBuyTurret(world, s)).join('|')
      if (key === shown) return
      shown = key
      setText(priceValue, String(world.turretDef.price))
      for (const s of sideButtons) {
        const ok = canBuyTurret(world, s.side) === 'ok'
        s.button.disabled = !ok
        if (!ok && selected === s.side) select(null)
      }
    },
  }
}
