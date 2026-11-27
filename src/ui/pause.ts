import { button, el } from './dom'
import { strings } from './strings'

export type PauseCallbacks = {
  onRestart(): void
  onCopyRun(): void
}

export type PauseMenu = {
  readonly paused: boolean
  pause(): void
  resume(): void
  toggle(): void
}

/**
 * Pause: ⏸ button (top-left), Esc/P on PC, and automatic when the app goes to the
 * background. `canPause()` lets the game refuse (e.g. mission already failed).
 */
export function createPauseMenu(
  parent: HTMLElement,
  callbacks: PauseCallbacks,
  canPause: () => boolean,
): PauseMenu {
  const pauseButton = button('hud-pause-button', parent, '⏸', () => menu.toggle())
  pauseButton.setAttribute('aria-label', strings.pause)

  const overlay = el('div', 'pause', parent)
  const card = el('div', 'hud-card', overlay)
  el('h1', 'pause-title', card).textContent = strings.paused
  const buttons = el('div', 'pause-buttons', card)
  button('hud-button hud-button--primary', buttons, strings.resume, () => menu.resume())
  button('hud-button hud-button--ghost', buttons, strings.restart, () => {
    menu.resume()
    callbacks.onRestart()
  })
  button('hud-button hud-button--ghost', buttons, strings.copyRun, () => callbacks.onCopyRun())
  el('p', 'pause-hint', card).textContent = strings.copyRunHint

  let paused = false
  const menu: PauseMenu = {
    get paused() {
      return paused
    },
    pause() {
      if (paused || !canPause()) return
      paused = true
      overlay.classList.add('open')
    },
    resume() {
      paused = false
      overlay.classList.remove('open')
    },
    toggle() {
      if (paused) menu.resume()
      else menu.pause()
    },
  }

  window.addEventListener('keydown', (e) => {
    if (e.code === 'Escape' || e.code === 'KeyP') {
      e.preventDefault()
      menu.toggle()
    }
  })
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) menu.pause()
  })

  return menu
}
