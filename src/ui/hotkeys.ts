/** PC keyboard shortcuts (event.code, so they work on any keyboard layout). */
export const HOTKEYS = {
  shop: 'KeyH',
  skip: 'KeyF',
  /** 1, 2, 3 = the potion quick-use buttons, in HUD order. */
  potions: ['Digit1', 'Digit2', 'Digit3'],
} as const

/** Label shown on buttons (only on devices with a mouse, see CSS). */
export const HOTKEY_LABELS = {
  shop: 'H',
  skip: 'F',
  potions: ['1', '2', '3'],
} as const

export type HotkeyActions = {
  toggleShop(): void
  skip(): void
  usePotion(index: number): void
  /** False while paused / typing in a text box: shortcuts are ignored. */
  enabled(): boolean
}

export function installHotkeys(actions: HotkeyActions): void {
  window.addEventListener('keydown', (e) => {
    if (e.repeat || !actions.enabled()) return
    const target = e.target as HTMLElement | null
    if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return

    if (e.code === HOTKEYS.shop) actions.toggleShop()
    else if (e.code === HOTKEYS.skip) actions.skip()
    else {
      const i = (HOTKEYS.potions as readonly string[]).indexOf(e.code)
      if (i < 0) return
      actions.usePotion(i)
    }
    e.preventDefault()
  })
}
