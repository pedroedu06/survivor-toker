import type { World } from '../core/world'
import type { FrameSample } from './perfTest'

/** Debug overlay, enabled with `?debug=1` (or just `?debug`). */
export type DebugOverlay = {
  /** Call once per rendered frame. */
  frame(now: number, world: World, sample: FrameSample, extra: string): void
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
  let worstMs = 0
  let simMs = 0
  let renderMs = 0

  return {
    frame(now, world, s, extra) {
      frames++
      worstMs = Math.max(worstMs, s.frameMs)
      simMs += s.simMs
      renderMs += s.renderMs
      const elapsed = now - lastSample
      if (elapsed < SAMPLE_MS) return
      const fps = (frames * 1000) / elapsed
      const r = world.round
      el.textContent = [
        `FPS ${fps.toFixed(0)} (min ${(1000 / Math.max(worstMs, 1)).toFixed(0)})  tick ${world.tick}`,
        `sim ${(simMs / frames).toFixed(2)}ms  render ${(renderMs / frames).toFixed(2)}ms`,
        `calls ${s.drawCalls}  tris ${(s.triangles / 1000).toFixed(1)}k`,
        `zombies ${world.activeEnemies}  proj ${world.activeProjectiles}  kills ${world.kills}`,
        `round ${r.number} ${r.phase} ${r.timer.toFixed(1)}s  ${r.spawned}/${r.total}`,
        `hp ${world.player.hp.toFixed(0)}  shield ${world.player.shield.toFixed(0)}  coins ${world.coins}${world.debugGod ? '  GOD' : ''}`,
        extra,
      ]
        .filter(Boolean)
        .join('\n')
      frames = 0
      worstMs = 0
      simMs = 0
      renderMs = 0
      lastSample = now
    },
  }
}
