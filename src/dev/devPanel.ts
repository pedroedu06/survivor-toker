import type { World } from '../core/world'
import { button, el, setText } from '../ui/dom'

export type DevPanelActions = {
  /** Dev command through the sim (see systems/dev.ts), so replays stay exact. */
  dev(cmd: string): void
  setSpeed(speed: number): void
  setBot(on: boolean): void
  startPerfTest(): void
  copyRun(): void
  pasteRun(): void
}

export type DevPanelState = {
  speed: number
  bot: boolean
  /** Seconds left in the perf test, 0 = not running. */
  perfRemaining: number
  /** Replay progress text, '' = not replaying. */
  replay: string
}

export type DevPanel = {
  update(world: World, state: DevPanelState): void
}

const SPEEDS = [0.5, 1, 2, 5]

/** Dev panel (only with ?debug=1). A small "DEV" button opens it. */
export function createDevPanel(parent: HTMLElement, actions: DevPanelActions): DevPanel {
  const toggle = button('dev-toggle', parent, 'DEV', () => panel.classList.toggle('open'))
  toggle.setAttribute('aria-label', 'Dev panel')

  const panel = el('div', 'dev-panel', parent)
  const section = (title: string) => {
    const s = el('div', 'dev-section', panel)
    el('div', 'dev-section-title', s).textContent = title
    return el('div', 'dev-row', s)
  }
  const small = (row: HTMLElement, text: string, onClick: () => void) =>
    button('dev-button', row, text, onClick)

  // Round
  const roundRow = section('Rodada')
  const roundInput = el('input', 'dev-input', roundRow)
  roundInput.type = 'number'
  roundInput.min = '1'
  roundInput.value = '10'
  small(roundRow, 'Ir', () => {
    const n = Math.max(1, Math.trunc(Number(roundInput.value) || 1))
    actions.dev(`round:${n}`)
  })
  small(roundRow, 'Matar todos', () => actions.dev('killAll'))
  small(roundRow, '+10 zumbis', () => actions.dev('spawn:10'))
  small(roundRow, '+50 zumbis', () => actions.dev('spawn:50'))

  // Player
  const playerRow = section('Jogador')
  const godButton = small(playerRow, 'God: off', () => actions.dev(godOn ? 'god:0' : 'god:1'))
  small(playerRow, 'Curar tudo', () => actions.dev('heal'))

  // Economy
  const coinsRow = section('Moedas e itens')
  small(coinsRow, '+100', () => actions.dev('coins:100'))
  small(coinsRow, '+1000', () => actions.dev('coins:1000'))
  small(coinsRow, '+1 poção de cada', () => actions.dev('potions'))

  // Speed
  const speedRow = section('Velocidade do jogo')
  const speedButtons = SPEEDS.map((s) => small(speedRow, `${s}x`, () => actions.setSpeed(s)))

  // Tools
  const toolsRow = section('Ferramentas')
  const botButton = small(toolsRow, 'Bot: off', () => actions.setBot(!botOn))
  const perfButton = small(toolsRow, 'Teste de desempenho', () => actions.startPerfTest())
  small(toolsRow, 'Copiar run', () => actions.copyRun())
  small(toolsRow, 'Colar run', () => actions.pasteRun())
  const status = el('div', 'dev-status', panel)

  let godOn = false
  let botOn = false
  let shownSpeed = -1

  return {
    update(world, state) {
      if (world.debugGod !== godOn) {
        godOn = world.debugGod
        setText(godButton, `God: ${godOn ? 'on' : 'off'}`)
        godButton.classList.toggle('on', godOn)
      }
      if (state.bot !== botOn) {
        botOn = state.bot
        setText(botButton, `Bot: ${botOn ? 'on' : 'off'}`)
        botButton.classList.toggle('on', botOn)
      }
      if (state.speed !== shownSpeed) {
        shownSpeed = state.speed
        speedButtons.forEach((b, i) => {
          b.classList.toggle('on', SPEEDS[i] === state.speed)
        })
      }
      perfButton.disabled = state.perfRemaining > 0
      setText(
        perfButton,
        state.perfRemaining > 0
          ? `Medindo... ${Math.ceil(state.perfRemaining)}s`
          : 'Teste de desempenho',
      )
      setText(status, state.replay)
    },
  }
}
