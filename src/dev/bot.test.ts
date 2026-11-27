import { describe, expect, test } from 'bun:test'
import { createInputState } from '../core/input'
import { FIXED_DT } from '../core/loop'
import { stepWorld } from '../core/step'
import { createWorld } from '../core/world'
import { applyDevCommands } from '../systems/dev'
import { botInput } from './bot'

describe('botInput', () => {
  test('with god mode the bot clears several rounds and spends coins', () => {
    const world = createWorld({ seed: 3 })
    applyDevCommands(world, 'god:1')
    const input = createInputState()
    for (let i = 0; i < 60 * 60 * 3; i++) {
      botInput(world, input)
      stepWorld(world, input, FIXED_DT)
    }
    expect(world.round.number).toBeGreaterThan(4)
    expect(world.kills).toBeGreaterThan(40)
  })

  test('aims at the nearest zombie', () => {
    const world = createWorld()
    const e = world.enemies[0]
    if (!e) throw new Error('no slot')
    e.active = true
    e.x = 5
    e.z = 0
    world.activeEnemies = 1
    const input = createInputState()
    botInput(world, input)
    expect(input.aimX).toBeGreaterThan(0)
    expect(input.aimZ).toBe(0)
  })
})
