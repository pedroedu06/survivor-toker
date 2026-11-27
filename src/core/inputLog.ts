import type { InputState } from './input'

/**
 * Input log of a run: seed + inputs => exact replay (bug reports, ranking, co-op later).
 *
 * Inputs are quantized BEFORE the simulation sees them (see `quantizeInput`), so the
 * recorded values are exactly what was simulated. Only changes are stored:
 *  - `n`: flat numbers, 5 per change: [tick, moveX*1000, moveZ*1000, aimX*1000, aimZ*1000]
 *  - `c`: one-step commands: [tick, skip(0/1), buy, use, upgrade, dev, base]
 * v1 runs (before maps had a base) have no `map` (= testArena) and no `base` command.
 */
export type RunLog = {
  v: 1 | 2
  seed: number
  /** Map id (`data/maps.ts`). Missing in v1 runs = 'testArena'. */
  map?: string
  /** Build id of the game that recorded it (informative). */
  build: string
  /** Ticks simulated when the log was exported. */
  ticks: number
  /** worldChecksum at `ticks`, to verify a replay. */
  checksum: string
  n: number[]
  c: Array<[number, number, string, string, string, string, string?]>
}

const MOVE_STEP = 0.05
const AIM_SCALE = 1000

/** Rounds movement to 0.05 steps and the aim to a 3-decimal unit vector, in place. */
export function quantizeInput(input: InputState): void {
  input.moveX = Math.round(input.moveX / MOVE_STEP) * MOVE_STEP
  input.moveZ = Math.round(input.moveZ / MOVE_STEP) * MOVE_STEP
  const len = Math.sqrt(input.aimX * input.aimX + input.aimZ * input.aimZ)
  if (len < 1e-3) {
    input.aimX = 0
    input.aimZ = 0
  } else {
    input.aimX = Math.round((input.aimX / len) * AIM_SCALE) / AIM_SCALE
    input.aimZ = Math.round((input.aimZ / len) * AIM_SCALE) / AIM_SCALE
  }
}

const toInt = (v: number) => Math.round(v * AIM_SCALE)

export type InputRecorder = {
  /** Call once per simulated step, with the (quantized) input that step used. */
  record(tick: number, input: InputState): void
  /** Starts a new run (after "play again"). */
  reset(seed: number): void
  /** Map the run is played on (written to the log). */
  map: string
  export(ticks: number, checksum: string, build: string): RunLog
}

export function createInputRecorder(seed: number, map = 'testArena'): InputRecorder {
  let runSeed = seed
  let n: number[] = []
  let c: RunLog['c'] = []
  let lastMx = Number.NaN
  let lastMz = Number.NaN
  let lastAx = Number.NaN
  let lastAz = Number.NaN

  return {
    map,
    record(tick, input) {
      const mx = toInt(input.moveX)
      const mz = toInt(input.moveZ)
      const ax = toInt(input.aimX)
      const az = toInt(input.aimZ)
      if (mx !== lastMx || mz !== lastMz || ax !== lastAx || az !== lastAz) {
        n.push(tick, mx, mz, ax, az)
        lastMx = mx
        lastMz = mz
        lastAx = ax
        lastAz = az
      }
      if (
        input.skipIntermission ||
        input.buyItem ||
        input.useItem ||
        input.upgradeWeapon ||
        input.base ||
        input.dev
      ) {
        c.push([
          tick,
          input.skipIntermission ? 1 : 0,
          input.buyItem,
          input.useItem,
          input.upgradeWeapon,
          input.dev,
          input.base,
        ])
      }
    },
    reset(newSeed) {
      runSeed = newSeed
      n = []
      c = []
      lastMx = lastMz = lastAx = lastAz = Number.NaN
    },
    export(ticks, checksum, build) {
      return {
        v: 2,
        seed: runSeed,
        map,
        build,
        ticks,
        checksum,
        n: n.slice(),
        c: c.slice(),
      }
    },
  }
}

export type InputPlayback = {
  /** Writes the recorded input for `tick` into `out`. Ticks must go forward. */
  read(tick: number, out: InputState): void
  readonly ticks: number
}

/** Plays a log back, tick by tick (no allocation per tick). */
export function createInputPlayback(log: RunLog): InputPlayback {
  let ni = 0
  let ci = 0
  return {
    ticks: log.ticks,
    read(tick, out) {
      while (ni + 5 <= log.n.length && (log.n[ni] ?? 0) <= tick) {
        out.moveX = (log.n[ni + 1] ?? 0) / AIM_SCALE
        out.moveZ = (log.n[ni + 2] ?? 0) / AIM_SCALE
        out.aimX = (log.n[ni + 3] ?? 0) / AIM_SCALE
        out.aimZ = (log.n[ni + 4] ?? 0) / AIM_SCALE
        ni += 5
      }
      out.skipIntermission = false
      out.buyItem = ''
      out.useItem = ''
      out.upgradeWeapon = ''
      out.dev = ''
      out.base = ''
      while (ci < log.c.length && (log.c[ci]?.[0] ?? 0) < tick) ci++
      const cmd = log.c[ci]
      if (cmd && cmd[0] === tick) {
        out.skipIntermission = cmd[1] === 1
        out.buyItem = cmd[2]
        out.useItem = cmd[3]
        out.upgradeWeapon = cmd[4]
        out.dev = cmd[5]
        out.base = cmd[6] ?? ''
      }
    },
  }
}

const HEADER = 'SURVIVOR-RUN v2'

/** Text to paste in a chat: a short human summary + the JSON log on the last line. */
export function formatRunText(log: RunLog, summaryLines: string[]): string {
  return [HEADER, ...summaryLines, JSON.stringify(log)].join('\n')
}

/** Reads a run from pasted text (summary lines are ignored). Throws if invalid. */
export function parseRunText(text: string): RunLog {
  const line = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .find((l) => l.startsWith('{'))
  if (!line) throw new Error('No run JSON found in the text')
  const log = JSON.parse(line) as RunLog
  if (
    (log.v !== 1 && log.v !== 2) ||
    !Number.isFinite(log.seed) ||
    !Array.isArray(log.n) ||
    !Array.isArray(log.c)
  ) {
    throw new Error('Not a valid run (v1/v2)')
  }
  return log
}
