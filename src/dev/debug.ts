import type { World } from '../core/world'

/** Debug overlay, enabled with `?debug=1` (or just `?debug`). */
export type DebugOverlay = {
  /** Call once per rendered frame. */
  frame(now: number, world: World): void
}

const SAMPLE_MS = 500

export function isDebugEnabled(): boolean {
  const flag = new URLSearchParams(window.location.search).get('debug')
  return flag === '1' || flag === ''
}

export function createDebugOverlay(parent: HTMLElement): DebugOverlay {
  const el = document.createElement('div')
  el.className = 'debug-overlay'
  parent.appendChild(el)

  let frames = 0
  let lastSample = performance.now()

  return {
    frame(now, world) {
      frames++
      const elapsed = now - lastSample
      if (elapsed < SAMPLE_MS) return
      const fps = (frames * 1000) / elapsed
      el.textContent = [
        `FPS ${fps.toFixed(0)}  tick ${world.tick}`,
        `enemies ${world.activeEnemies}  kills ${world.kills}`,
        `projectiles ${world.activeProjectiles}`,
        `hp ${world.player.hp.toFixed(0)}  shield ${world.player.shield.toFixed(0)}${world.debugGod ? '  GOD' : ''}`,
        `round ${world.round.number} ${world.round.phase} ${world.round.timer.toFixed(1)}s`,
        `spawned ${world.round.spawned}/${world.round.total}  hp ${world.round.enemyHp.toFixed(1)}`,
      ].join('\n')
      frames = 0
      lastSample = now
    },
  }
}
