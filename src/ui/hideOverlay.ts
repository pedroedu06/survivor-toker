import type { World } from '../core/world'
import { el } from './dom'
import { strings } from './strings'

export type HideOverlay = { update(world: World): void }

/** Blurred, green-tinted screen edges (center stays sharp) while the player is hidden. */
export function createHideOverlay(parent: HTMLElement): HideOverlay {
  const overlay = el('div', 'hide-overlay', parent)
  el('div', 'hide-overlay-label', overlay).textContent = `🌿 ${strings.hidden}`
  let shown = false
  return {
    update(world) {
      const hidden = world.player.hidden && world.round.phase !== 'failed'
      if (hidden === shown) return
      shown = hidden
      overlay.classList.toggle('on', hidden)
    },
  }
}
