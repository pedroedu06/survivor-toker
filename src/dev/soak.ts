import { worldChecksum } from '../core/checksum'
import { createInputState } from '../core/input'
import { createInputRecorder, formatRunText, quantizeInput } from '../core/inputLog'
import { checkInvariants } from '../core/invariants'
import { FIXED_DT } from '../core/loop'
import { createRng } from '../core/rng'
import { stepWorld } from '../core/step'
import { createWorld, type World } from '../core/world'
import { type MapDef, SIDES, startBase } from '../data/maps'
import { shopItems } from '../data/shop'
import { weaponUpgrades } from '../data/upgrades'
import { botInput } from './bot'

export type SoakResult = {
  world: World
  /** First invariant failure, or null if the whole run was clean. */
  problem: { tick: number; problems: string[] } | null
  /** The run as "Copiar run" text, to replay a failure. */
  runText: string
}

const DEV_COMMANDS = [
  'coins:200',
  'spawn:15',
  'killAll',
  'heal',
  'potions',
  'god:1',
  'god:0',
  'wallhp:all:20',
  'wallhp:wall_n1:0',
  'breakall',
  'repairall',
  'turret:e',
]
const BASE_ACTIONS = ['upgrade', 'repair', 'turret']

/**
 * Bot plays `ticks` steps with random extra commands (buy, use, upgrade, dev) mixed in,
 * checking invariants every step. Headless and deterministic for a given seed.
 */
export function soakRun(seed: number, ticks: number, map: MapDef = startBase): SoakResult {
  const world = createWorld({ seed, map })
  const chaos = createRng(seed ^ 0x9e3779b9)
  const recorder = createInputRecorder(seed, map.id)
  const input = createInputState()
  let problem: SoakResult['problem'] = null
  let steps = 0

  for (let t = 0; t < ticks; t++) {
    botInput(world, input)
    // Chaos: random commands the bot would not send, to poke at edge cases.
    if (chaos.next() < 0.01) input.buyItem = shopItems[chaos.int(0, shopItems.length - 1)]?.id ?? ''
    if (chaos.next() < 0.01) input.useItem = shopItems[chaos.int(0, shopItems.length - 1)]?.id ?? ''
    if (chaos.next() < 0.005) {
      input.upgradeWeapon = weaponUpgrades[chaos.int(0, weaponUpgrades.length - 1)]?.id ?? ''
    }
    if (chaos.next() < 0.002) input.dev = DEV_COMMANDS[chaos.int(0, DEV_COMMANDS.length - 1)] ?? ''
    if (chaos.next() < 0.005) {
      const action = BASE_ACTIONS[chaos.int(0, BASE_ACTIONS.length - 1)]
      input.base = `${action}:${SIDES[chaos.int(0, SIDES.length - 1)]}`
    }
    quantizeInput(input)

    recorder.record(t, input)
    stepWorld(world, input, FIXED_DT)
    steps++

    const problems = checkInvariants(world)
    if (problems.length) {
      problem = { tick: t, problems }
      break
    }
    if (world.round.phase === 'failed') break
  }

  const log = recorder.export(steps, worldChecksum(world), 'soak')
  const runText = formatRunText(log, [`soak seed ${seed}`])
  return { world, problem, runText }
}
