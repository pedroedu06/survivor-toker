import type { World } from '../core/world'
import { strings } from './strings'

/** How long the "Round N" banner stays on screen, in ms. */
const BANNER_MS = 2000

export type HudCallbacks = {
  onSkip(): void
  onPlayAgain(): void
}

export type Hud = {
  /** Call once per rendered frame. Only touches the DOM when a shown value changes. */
  update(world: World, now: number): void
}

/** Formats seconds as m:ss (rounded up, so 0:00 only shows when time is really over). */
export function formatTime(seconds: number): string {
  const total = Math.max(0, Math.ceil(seconds))
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${m}:${s < 10 ? '0' : ''}${s}`
}

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className: string,
  parent: HTMLElement,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag)
  node.className = className
  parent.appendChild(node)
  return node
}

export function createHud(parent: HTMLElement, callbacks: HudCallbacks): Hud {
  const root = el('div', 'hud', parent)

  const top = el('div', 'hud-top', root)
  const roundLabel = el('div', 'hud-round', top)
  const timerLabel = el('div', 'hud-timer', top)
  const zombiesLabel = el('div', 'hud-zombies', top)

  const bars = el('div', 'hud-bars', root)
  const shieldBar = createBar(bars, 'hud-bar--shield', strings.shield)
  const healthBar = createBar(bars, 'hud-bar--health', strings.health)

  const banner = el('div', 'hud-banner', root)

  const intermission = el('div', 'hud-intermission', root)
  const clearedLabel = el('div', 'hud-cleared', intermission)
  const nextLabel = el('div', 'hud-next', intermission)
  const skipButton = el('button', 'hud-button', intermission)
  skipButton.type = 'button'
  skipButton.textContent = strings.skip
  skipButton.addEventListener('click', () => callbacks.onSkip())

  const failed = el('div', 'hud-failed', root)
  const failedCard = el('div', 'hud-card', failed)
  el('h1', 'hud-failed-title', failedCard).textContent = strings.missionFailed
  const reasonLabel = el('p', 'hud-failed-reason', failedCard)
  const reachedLabel = el('p', 'hud-stat', failedCard)
  const killsLabel = el('p', 'hud-stat', failedCard)
  const playAgainButton = el('button', 'hud-button hud-button--primary', failedCard)
  playAgainButton.type = 'button'
  playAgainButton.textContent = strings.playAgain
  playAgainButton.addEventListener('click', () => callbacks.onPlayAgain())

  // Last shown values: the DOM is only written when one changes.
  let shownSeed = Number.NaN
  let shownTick = 0
  let shownPhase = ''
  let shownRound = -1
  let shownTimer = ''
  let shownZombies = -1
  let bannerUntil = 0

  const setText = (node: HTMLElement, text: string) => {
    if (node.textContent !== text) node.textContent = text
  }

  return {
    update(world, now) {
      const r = world.round
      // A new run (play again) gets a new seed: show everything again, banner included.
      if (world.seed !== shownSeed || world.tick < shownTick) {
        shownSeed = world.seed
        shownRound = -1
        shownPhase = ''
      }
      shownTick = world.tick
      if (r.number === 0) return

      if (r.number !== shownRound) {
        shownRound = r.number
        setText(roundLabel, strings.round(r.number))
        setText(banner, strings.round(r.number))
        banner.classList.add('show')
        bannerUntil = now + BANNER_MS
      }
      if (bannerUntil && now > bannerUntil) {
        banner.classList.remove('show')
        bannerUntil = 0
      }

      if (r.phase !== shownPhase) {
        shownPhase = r.phase
        root.dataset.phase = r.phase
        if (r.phase === 'intermission') setText(clearedLabel, strings.roundCleared(r.number))
        if (r.phase === 'failed') {
          setText(reasonLabel, r.failReason === 'died' ? strings.died : strings.timeUp)
          setText(reachedLabel, strings.reachedRound(r.number))
          setText(killsLabel, strings.totalKills(world.kills))
        }
      }

      const time = formatTime(r.timer)
      if (time !== shownTimer) {
        shownTimer = time
        setText(timerLabel, time)
        setText(nextLabel, strings.nextRoundIn(time))
      }

      const left = r.total - r.killed
      if (left !== shownZombies) {
        shownZombies = left
        setText(zombiesLabel, strings.zombiesLeft(left))
      }

      const p = world.player
      shieldBar.set(p.shield, world.playerDef.maxShield)
      healthBar.set(p.hp, world.playerDef.maxHp)
    },
  }
}

type Bar = { set(value: number, max: number): void }

/** Labelled bar (e.g. shield, health). Only writes the DOM when the shown integer changes. */
function createBar(parent: HTMLElement, modifier: string, label: string): Bar {
  const bar = el('div', `hud-bar ${modifier}`, parent)
  const fill = el('div', 'hud-bar-fill', bar)
  el('span', 'hud-bar-label', bar).textContent = label
  const value = el('span', 'hud-bar-value', bar)
  let shown = -1
  let shownMax = -1
  return {
    set(v, max) {
      // Round up so a sliver of HP never shows as 0.
      const n = Math.ceil(v)
      if (n === shown && max === shownMax) return
      shown = n
      shownMax = max
      fill.style.width = `${max > 0 ? (n / max) * 100 : 0}%`
      value.textContent = String(n)
      bar.classList.toggle('empty', n <= 0)
    },
  }
}
