/**
 * Frame timing stats (debug overlay) and the in-browser performance test.
 * Fed once per rendered frame by main.ts. Preallocated buffers: no allocation per frame.
 */
export type FrameSample = {
  frameMs: number
  simMs: number
  renderMs: number
  drawCalls: number
  triangles: number
  zombies: number
}

export type PerfResult = {
  seconds: number
  frames: number
  avgFps: number
  minFps: number
  /** FPS of the slowest 1% of frames. */
  low1Fps: number
  avgFrameMs: number
  avgSimMs: number
  avgRenderMs: number
  avgDrawCalls: number
  avgZombies: number
  /** Target from DESIGN.md: 60 fps with ~100 zombies. */
  ok: boolean
}

const MAX_FRAMES = 60 * 120

export type PerfRecorder = {
  readonly running: boolean
  /** Seconds left in the current test. */
  readonly remaining: number
  start(seconds: number): void
  /** Returns the result when the test just finished, otherwise null. */
  sample(now: number, s: FrameSample): PerfResult | null
}

export function createPerfRecorder(): PerfRecorder {
  const frameMs = new Float32Array(MAX_FRAMES)
  let count = 0
  let sim = 0
  let render = 0
  let calls = 0
  let zombies = 0
  let running = false
  let startAt = 0
  let duration = 0
  let lastNow = 0

  const finish = (seconds: number): PerfResult => {
    running = false
    const n = Math.max(1, count)
    const sorted = Array.from(frameMs.subarray(0, count)).sort((a, b) => a - b)
    let total = 0
    for (const v of sorted) total += v
    const avgFrame = total / n
    const worst = sorted[sorted.length - 1] ?? avgFrame
    const p99 = sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.99))] ?? avgFrame
    const avgFps = 1000 / avgFrame
    return {
      seconds,
      frames: count,
      avgFps,
      minFps: 1000 / worst,
      low1Fps: 1000 / p99,
      avgFrameMs: avgFrame,
      avgSimMs: sim / n,
      avgRenderMs: render / n,
      avgDrawCalls: calls / n,
      avgZombies: zombies / n,
      ok: avgFps >= 55,
    }
  }

  return {
    get running() {
      return running
    },
    get remaining() {
      return running ? Math.max(0, duration - (lastNow - startAt) / 1000) : 0
    },
    start(seconds) {
      running = true
      duration = seconds
      startAt = performance.now()
      lastNow = startAt
      count = sim = render = calls = zombies = 0
    },
    sample(now, s) {
      lastNow = now
      if (!running) return null
      if (count < MAX_FRAMES) frameMs[count++] = s.frameMs
      sim += s.simMs
      render += s.renderMs
      calls += s.drawCalls
      zombies += s.zombies
      const elapsed = (now - startAt) / 1000
      return elapsed >= duration ? finish(elapsed) : null
    },
  }
}

/** Human summary (pt-BR UI), also what "copy" puts in the clipboard. */
export function formatPerfResult(r: PerfResult): string {
  return [
    `Teste de desempenho (${r.seconds.toFixed(0)} s, ~${r.avgZombies.toFixed(0)} zumbis)`,
    `${r.ok ? 'OK' : 'ABAIXO DA META'}: média ${r.avgFps.toFixed(1)} fps · mínimo ${r.minFps.toFixed(1)} · 1% low ${r.low1Fps.toFixed(1)}`,
    `quadro ${r.avgFrameMs.toFixed(2)} ms · simulação ${r.avgSimMs.toFixed(2)} ms · render ${r.avgRenderMs.toFixed(2)} ms`,
    `draw calls ${r.avgDrawCalls.toFixed(0)} · ${r.frames} quadros`,
    `${navigator.userAgent}`,
  ].join('\n')
}
