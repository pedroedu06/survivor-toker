import { el } from './dom'
import { strings } from './strings'

type LockableOrientation = ScreenOrientation & { lock?: (o: 'landscape') => Promise<void> }

/**
 * The game is played in landscape on phones.
 * - Android app: locked in the manifest (`sensorLandscape`).
 * - Mobile browser: on the first touch, tries fullscreen + orientation lock (works on
 *   Android Chrome); if the phone is still upright, a "rotate your phone" screen covers
 *   the game and it pauses.
 * Desktop (mouse) is never affected.
 */
export function installLandscapeGuard(parent: HTMLElement, onPortrait: () => void): void {
  const touch = window.matchMedia('(pointer: coarse)')
  const portrait = window.matchMedia('(orientation: portrait)')

  const overlay = el('div', 'rotate', parent)
  el('div', 'rotate-icon', overlay).textContent = '📱↻'
  el('div', 'rotate-text', overlay).textContent = strings.rotatePhone

  const update = () => {
    const blocked = touch.matches && portrait.matches
    overlay.classList.toggle('open', blocked)
    if (blocked) onPortrait()
  }
  portrait.addEventListener('change', update)
  touch.addEventListener('change', update)
  update()

  const tryLock = async () => {
    if (!touch.matches) return
    try {
      if (!document.fullscreenElement) await document.documentElement.requestFullscreen()
      await (screen.orientation as LockableOrientation).lock?.('landscape')
    } catch {
      // Not supported (e.g. iOS Safari): the rotate screen still guides the player.
    }
  }
  window.addEventListener('pointerdown', () => void tryLock(), { once: true })
}
