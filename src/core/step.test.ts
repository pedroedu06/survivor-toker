import { describe, expect, test } from 'bun:test'
import { rounds } from '../data/rounds'
import { createInputState } from './input'
import { FIXED_DT } from './loop'
import { createRng } from './rng'
import { stepWorld } from './step'
import { createWorld } from './world'

function simulate(seed: number, steps: number) {
  const rng = createRng(seed)
  const world = createWorld({ seed })
  const input = createInputState()
  for (let i = 0; i < steps; i++) {
    if (i % 30 === 0) {
      input.moveX = rng.range(-1, 1)
      input.moveZ = rng.range(-1, 1)
    }
    stepWorld(world, input, FIXED_DT)
  }
  return world
}

describe('stepWorld', () => {
  test('same seed and inputs produce the same state (determinism)', () => {
    const a = simulate(123, 60 * 30)
    const b = simulate(123, 60 * 30)
    expect(a.player).toEqual(b.player)
    expect(a.projectiles).toEqual(b.projectiles)
    expect(a.enemies).toEqual(b.enemies)
    expect(a.kills).toBe(b.kills)
    expect(a.tick).toBe(60 * 30)
  })

  test('a player aiming at the nearest zombie clears rounds', () => {
    const world = createWorld({ seed: 9 })
    const input = createInputState()
    let sawZombies = false
    for (let i = 0; i < 60 * 120; i++) {
      // Tiny bot: aim at the nearest zombie, stand still.
      let best = Number.POSITIVE_INFINITY
      for (const e of world.enemies) {
        if (!e.active) continue
        sawZombies = true
        const d = Math.hypot(e.x - world.player.x, e.z - world.player.z)
        if (d < best) {
          best = d
          input.aimX = e.x - world.player.x
          input.aimZ = e.z - world.player.z
        }
      }
      input.skipIntermission = world.round.phase === 'intermission'
      stepWorld(world, input, FIXED_DT)
    }
    expect(sawZombies).toBe(true)
    expect(world.kills).toBeGreaterThan(0)
    expect(world.round.number).toBeGreaterThan(1)
  })

  test('determinism includes the round state', () => {
    expect(simulate(42, 60 * 60).round).toEqual(simulate(42, 60 * 60).round)
  })

  test('mission failed freezes the simulation', () => {
    const world = simulate(9, 60 * 10)
    world.round.phase = 'failed'
    const before = structuredClone({
      player: world.player,
      enemies: world.enemies,
      tick: world.tick,
    })
    const input = { ...createInputState(), moveX: 1, aimX: 1 }
    for (let i = 0; i < 120; i++) stepWorld(world, input, FIXED_DT)
    expect({ player: world.player, enemies: world.enemies, tick: world.tick }).toEqual(before)
  })

  test('saves the previous player position for interpolation', () => {
    const world = createWorld()
    const input = { ...createInputState(), moveX: 1 }
    stepWorld(world, input, FIXED_DT)
    const x1 = world.player.x
    stepWorld(world, input, FIXED_DT)
    expect(world.player.prevX).toBe(x1)
  })

  test('active counters match the pools', () => {
    const world = simulate(7, 60 * 30)
    expect(world.activeProjectiles).toBe(world.projectiles.filter((p) => p.active).length)
    expect(world.activeEnemies).toBe(world.enemies.filter((e) => e.active).length)
  })

  test('performance reference: full horde step time', () => {
    const world = createWorld({
      seed: 3,
      spawnDef: { maxAlive: 120, minDistance: 3, maxDistance: 18 },
      // Huge round that spawns one zombie per step.
      roundsDef: {
        ...rounds,
        baseCount: 10_000,
        spawnIntervalStart: 0.001,
        spawnIntervalMin: 0.001,
      },
    })
    const input = createInputState()
    for (let i = 0; i < 180; i++) stepWorld(world, input, FIXED_DT) // fill the horde
    const steps = 600
    const start = performance.now()
    for (let i = 0; i < steps; i++) {
      input.moveX = Math.sin(i / 50)
      input.moveZ = Math.cos(i / 50)
      stepWorld(world, input, FIXED_DT)
    }
    const msPerStep = (performance.now() - start) / steps
    console.log(
      `[perf] ${world.activeEnemies} zombies, ${world.activeProjectiles} projectiles: ${msPerStep.toFixed(3)} ms/step`,
    )
    expect(world.activeEnemies).toBeGreaterThan(100)
    // Generous bound: a 60 Hz frame is 16.7 ms, the sim must use a small slice of it.
    expect(msPerStep).toBeLessThan(4)
  })
})
