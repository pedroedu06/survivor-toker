import { worldChecksum } from './core/checksum'
import {
  createInputPlayback,
  createInputRecorder,
  formatRunText,
  type InputPlayback,
  parseRunText,
  quantizeInput,
} from './core/inputLog'
import { checkInvariants } from './core/invariants'
import { advanceClock, createFixedClock, FIXED_DT } from './core/loop'
import { stepWorld } from './core/step'
import { createWorld, resetWorld } from './core/world'
import { type Side, startBase } from './data/maps'
import { botInput } from './dev/bot'
import { createDebugOverlay, isDebugEnabled } from './dev/debug'
import { createDevPanel } from './dev/devPanel'
import { createErrorLog } from './dev/errors'
import { createPerfRecorder, type FrameSample, formatPerfResult } from './dev/perfTest'
import { loadMapAssets } from './render/mapAssets'
import { createGameRenderer } from './render/scene'
import type { TurretPlacement } from './render/turretsView'
import { createHideOverlay } from './ui/hideOverlay'
import { installHotkeys } from './ui/hotkeys'
import { createHud, POTIONS } from './ui/hud'
import { createInputSource } from './ui/input'
import { copyText, createTextModal } from './ui/modal'
import { installLandscapeGuard } from './ui/orientation'
import { createPauseMenu } from './ui/pause'
import { createShopPanel } from './ui/shop'
import { strings } from './ui/strings'
import { createTurretPlacement } from './ui/turretPlacement'

const canvas = document.querySelector<HTMLCanvasElement>('#game')
const ui = document.querySelector<HTMLElement>('#ui')
if (!canvas || !ui) throw new Error('Missing #game canvas or #ui root')

/** Outside core/, so Math.random is fine here. The seed is what a replay records. */
const newSeed = () => (Math.random() * 2 ** 32) >>> 0
const DEBUG = isDebugEnabled()
/** How often (in steps) the debug build checks the invariants. */
const INVARIANT_EVERY = 30

/** The map being played ("Forest" in the final game). Map selection comes later. */
const MAP = startBase

// Load the map's Blender models before anything is drawn.
const loading = document.createElement('div')
loading.className = 'loading'
loading.textContent = 'Carregando…'
ui.appendChild(loading)
const assets = await loadMapAssets(MAP.id).catch((e: unknown) => {
  console.error('Map models failed to load', e)
  return null
})
loading.remove()

const world = createWorld({ seed: newSeed(), map: MAP })
// Spawn markers ("portals") stay visible while testing; remove for the final game.
const renderer = createGameRenderer(canvas, world, { showSpawnMarkers: true, assets })
const input = createInputSource(ui, renderer.screenToGround)
const recorder = createInputRecorder(world.seed, MAP.id)
const clock = createFixedClock()

// ---- Run state outside the sim (real time, tools) ----
/** Steps simulated in this run (what the input log counts). */
let steps = 0
let speed = 1
let botOn = false
let replay: { playback: InputPlayback; expected: string } | null = null

function restartRun(seed = newSeed()) {
  resetWorld(world, seed)
  recorder.reset(seed)
  steps = 0
  replay = null
  errors.clear()
}

// ---- UI ----
const hud = createHud(ui, {
  onSkip: () => input.requestSkip(),
  onPlayAgain: () => restartRun(),
  onOpenShop: () => shop.open(),
  onUseItem: (id) => input.requestUse(id),
})
const shop = createShopPanel(ui, {
  onBuy: (id) => input.requestBuy(id),
  onUpgrade: (id) => input.requestUpgrade(id),
  onBase: (cmd) => input.requestBase(cmd),
  onPlaceTurret: () => {
    shop.close()
    turretBar.open()
  },
})
/** Turret placement preview state, read by the renderer every frame. */
const turretPreview: TurretPlacement = { active: false, selected: null }
const turretBar = createTurretPlacement(ui, {
  onSelect: (side: Side | null) => {
    turretPreview.selected = side
  },
  onConfirm: (side) => input.requestBase(`turret:${side}`),
  onCancel: () => shop.open(),
})
const hideOverlay = createHideOverlay(ui)
const modal = createTextModal(ui, strings.close)
const pause = createPauseMenu(
  ui,
  { onRestart: () => restartRun(), onCopyRun: () => copyRun() },
  () => world.round.phase !== 'failed',
)
const errors = createErrorLog(ui, DEBUG, () => copyRun())

installHotkeys({
  enabled: () => !pause.paused && !modalBlocks(),
  toggleShop: () => {
    if (shop.isOpen) shop.close()
    else if (world.round.phase === 'intermission') shop.open()
  },
  skip: () => input.requestSkip(),
  usePotion: (i) => {
    const id = POTIONS[i]
    if (id) input.requestUse(id)
  },
})
installLandscapeGuard(ui, () => pause.pause())

// ---- "Copiar run" ----
function runText(): string {
  const r = world.round
  const problems = checkInvariants(world)
  const log = recorder.export(steps, worldChecksum(world), __BUILD__)
  return formatRunText(log, [
    `rodada ${r.number} (${r.phase}${r.failReason ? `: ${r.failReason}` : ''}) · tick ${steps} · kills ${world.kills} · moedas ${world.coins} · hp ${world.player.hp.toFixed(0)} · escudo ${world.player.shield.toFixed(0)}`,
    `invariantes: ${problems.length ? problems.join(' | ') : 'ok'}`,
    `erros: ${errors.recent.length ? errors.recent.join(' | ') : 'nenhum'}`,
  ])
}

async function copyRun() {
  const text = runText()
  if (await copyText(text)) {
    modal.open({ title: strings.runCopied, text, hint: '' })
  } else {
    modal.open({ title: strings.copyRun, hint: strings.runCopyManual, text })
  }
}

function startReplay(text: string) {
  try {
    const log = parseRunText(text)
    const runMap = log.map ?? 'testArena'
    if (runMap !== MAP.id) throw new Error(`a run é do mapa ${runMap}, o jogo está no ${MAP.id}`)
    restartRun(log.seed)
    replay = { playback: createInputPlayback(log), expected: log.checksum }
    modal.close()
  } catch (e) {
    errors.report(`Run inválida: ${(e as Error).message}`)
  }
}

// ---- Dev tools (only ?debug=1) ----
const perf = createPerfRecorder()
let perfGodWasOn = false
const devPanel = DEBUG
  ? createDevPanel(ui, {
      dev: (cmd) => input.requestDev(cmd),
      setSpeed: (s) => {
        speed = s
      },
      setBot: (on) => {
        botOn = on
      },
      startPerfTest: () => {
        // Full horde + bot + god, measured for 30 s at normal speed.
        perfGodWasOn = world.debugGod
        speed = 1
        botOn = true
        const r = world.round
        const start = r.phase === 'active' ? '' : `round:${Math.max(1, r.number + 1)};`
        input.requestDev(`${start}god:1;heal;spawn:120`)
        perf.start(30)
      },
      copyRun: () => copyRun(),
      pasteRun: () =>
        modal.open({
          title: 'Colar run',
          hint: 'Cole o texto da run e toque em Reproduzir.',
          editable: true,
          actionLabel: 'Reproduzir',
          onAction: startReplay,
        }),
    })
  : null
const debug = DEBUG ? createDebugOverlay(ui) : null

// ---- Simulation step ----
const step = (dt: number) => {
  const state = input.state
  if (replay) {
    replay.playback.read(steps, state)
  } else if (botOn) {
    // The bot drives movement/aim, but commands from the UI (dev panel, buttons) still go through.
    const ui = {
      dev: state.dev,
      buy: state.buyItem,
      use: state.useItem,
      up: state.upgradeWeapon,
      base: state.base,
    }
    const skip = state.skipIntermission
    botInput(world, state)
    if (ui.dev) state.dev = ui.dev
    if (ui.buy) state.buyItem = ui.buy
    if (ui.use) state.useItem = ui.use
    if (ui.up) state.upgradeWeapon = ui.up
    if (ui.base) state.base = ui.base
    if (skip) state.skipIntermission = true
    quantizeInput(state)
  }
  recorder.record(steps, state)
  stepWorld(world, state, dt)
  steps++
  input.consumeCommands()

  if (DEBUG && steps % INVARIANT_EVERY === 0) {
    for (const p of checkInvariants(world)) errors.report(`Invariante: ${p}`)
  }
  if (replay && steps >= replay.playback.ticks) {
    const ok = worldChecksum(world) === replay.expected
    replay = null
    modal.open({
      title: ok ? 'Replay terminou: estado igual ✔' : 'Replay terminou: estado DIFERENTE',
      hint: ok
        ? 'A partida foi reproduzida exatamente.'
        : 'O checksum não bate: possível bug de não-determinismo.',
      text: runText(),
    })
  }
}

// ---- Frame loop ----
const sample: FrameSample = {
  frameMs: 0,
  simMs: 0,
  renderMs: 0,
  drawCalls: 0,
  triangles: 0,
  zombies: 0,
}
let last = performance.now()
let lastTopUp = 0

const frame = (now: number) => {
  const frameDt = (now - last) / 1000
  last = now

  const simStart = performance.now()
  if (!pause.paused && !modalBlocks()) {
    input.poll(world.player.x, world.player.z)
    advanceClock(clock, frameDt * speed, step)
  }
  const simEnd = performance.now()

  turretPreview.active = turretBar.isOpen
  renderer.setTurretPlacement(turretPreview)
  renderer.render(world, pause.paused ? 1 : clock.alpha)
  const renderEnd = performance.now()

  hud.update(world, now)
  shop.update(world)
  turretBar.update(world)
  hideOverlay.update(world)

  sample.frameMs = frameDt * 1000
  sample.simMs = simEnd - simStart
  sample.renderMs = renderEnd - simEnd
  renderer.stats(sample)
  sample.zombies = world.activeEnemies

  if (perf.running) {
    // Keep the horde full while measuring.
    if (now - lastTopUp > 1000 && world.activeEnemies < 110) {
      input.requestDev(`spawn:${120 - world.activeEnemies}`)
      lastTopUp = now
    }
    const result = perf.sample(now, sample)
    if (result) {
      botOn = false
      if (!perfGodWasOn) input.requestDev('god:0')
      modal.open({
        title: result.ok ? 'Desempenho OK ✔' : 'Desempenho abaixo da meta',
        hint: 'Meta do Milestone 1: 60 fps com ~100 zumbis. Copie e mande no chat.',
        text: formatPerfResult(result),
      })
      void copyText(formatPerfResult(result))
    }
  }

  devPanel?.update(world, {
    speed,
    bot: botOn,
    perfRemaining: perf.remaining,
    replay: replay ? `Reproduzindo run... ${steps}/${replay.playback.ticks}` : '',
  })
  debug?.frame(
    now,
    world,
    sample,
    [speed !== 1 ? `speed ${speed}x` : '', botOn ? 'BOT' : '', replay ? 'REPLAY' : '']
      .filter(Boolean)
      .join('  '),
  )

  requestAnimationFrame(frame)
}

/** The paste-run modal pauses the game while open (typing should not move the player). */
function modalBlocks(): boolean {
  return document.querySelector('.modal.open textarea:not([readonly])') !== null
}

requestAnimationFrame(frame)
window.addEventListener('resize', renderer.resize)

// ---- Console helpers (debug only). Everything goes through the sim, so runs replay. ----
if (DEBUG) {
  ;(window as unknown as { __game: unknown }).__game = {
    world,
    input,
    /** Runs `n` fixed steps right now, ignoring real time (and pause). */
    advance(n: number) {
      input.poll(world.player.x, world.player.z)
      for (let i = 0; i < n; i++) step(FIXED_DT)
      renderer.render(world, 1)
      hud.update(world, performance.now())
      shop.update(world)
    },
    /** Any dev command, e.g. 'coins:500;god:1' (see src/systems/dev.ts). */
    dev: (cmd: string) => input.requestDev(cmd),
    startRound: (n: number) => input.requestDev(`round:${n}`),
    addCoins: (n: number) => input.requestDev(`coins:${n}`),
    setGod: (on: boolean) => input.requestDev(on ? 'god:1' : 'god:0'),
    skip: () => input.requestSkip(),
    setSpeed: (s: number) => {
      speed = s
    },
    setBot: (on: boolean) => {
      botOn = on
    },
    runText,
    checkInvariants: () => checkInvariants(world),
  }
}
