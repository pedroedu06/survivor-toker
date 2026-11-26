/** Debug overlay, enabled with `?debug=1` or in dev builds via `?debug`. */
export type DebugOverlay = {
  /** Call once per rendered frame. */
  frame(now: number, tick: number): void
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
    frame(now, tick) {
      frames++
      const elapsed = now - lastSample
      if (elapsed < SAMPLE_MS) return
      const fps = (frames * 1000) / elapsed
      el.textContent = `FPS ${fps.toFixed(0)}  tick ${tick}`
      frames = 0
      lastSample = now
    },
  }
}
