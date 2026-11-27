import { describe, expect, test } from 'bun:test'
import { createInputState } from '../core/input'
import { checkInvariants } from '../core/invariants'
import { FIXED_DT } from '../core/loop'
import { createWorld, resetWorld, type World } from '../core/world'
import { damagePhase } from '../data/base'
import { type BoxDef, startBase } from '../data/maps'
import {
  applyBaseCommand,
  canBuyTurret,
  damageStructure,
  repairSidePrice,
  updateDoors,
} from './base'
import { updatePlayerDamage } from './damage'
import { rebuildEnemyHash, updateEnemies } from './enemies'
import { updateHide } from './hide'
import { updateMovement } from './movement'
import { obstacleHit, pushOutOfBox } from './obstacles'
import { updateTurrets } from './turrets'
import { updateWeapons } from './weapons'

const slotIndex = (world: World, id: string) =>
  (world.map.slots ?? []).findIndex((s) => s.id === id)

function baseWorld(): World {
  const world = createWorld({ seed: 7, map: startBase })
  world.round.number = 1
  world.round.phase = 'active'
  world.round.spawnMask = 1
  return world
}

function addZombie(world: World, x: number, z: number) {
  const e = world.enemies.find((q) => !q.active)
  if (!e) throw new Error('pool full')
  e.active = true
  e.x = e.prevX = x
  e.z = e.prevZ = z
  e.hp = 1000
  world.activeEnemies++
  rebuildEnemyHash(world)
  return e
}

function setPlayer(world: World, x: number, z: number) {
  const p = world.player
  p.x = p.prevX = x
  p.z = p.prevZ = z
}

/** Runs the movement/door/hide/enemy part of a step `seconds` long. */
function simulate(world: World, seconds: number, moveX = 0, moveZ = 0) {
  const input = createInputState()
  input.moveX = moveX
  input.moveZ = moveZ
  for (let t = 0; t < seconds * 60; t++) {
    updateDoors(world)
    updateMovement(world, input, FIXED_DT)
    updateHide(world)
    updateEnemies(world, FIXED_DT)
  }
}

/** Center of a hiding cell surrounded by hiding cells. */
function coverPoint(world: World): { x: number; z: number } {
  const g = world.map.hideGrid
  if (!g) throw new Error('no hide grid')
  const half = world.arena.halfSize
  for (let j = 1; j < g.cells - 1; j++) {
    for (let i = 1; i < g.cells - 1; i++) {
      let all = true
      for (let dj = -1; dj <= 1 && all; dj++)
        for (let di = -1; di <= 1 && all; di++)
          all = world.hideCells[(j + dj) * g.cells + i + di] === 1
      if (all) return { x: -half + (i + 0.5) * g.cellSize, z: -half + (j + 0.5) * g.cellSize }
    }
  }
  throw new Error('no cover')
}

describe('start_base map data', () => {
  test('8 walls + 4 doors, doors belong to north/south, 4 turret slots', () => {
    const slots = startBase.slots ?? []
    expect(slots.filter((s) => s.kind === 'wall')).toHaveLength(8)
    const doors = slots.filter((s) => s.kind === 'door')
    expect(doors.map((d) => `${d.id}:${d.side}`).sort()).toEqual([
      'door_ne:n',
      'door_nw:n',
      'door_se:s',
      'door_sw:s',
    ])
    expect((startBase.turretSlots ?? []).map((t) => t.side)).toEqual(['n', 'e', 's', 'w'])
    expect(startBase.playerStart).toEqual({ x: 0, z: 0 })
  })
})

describe('pushOutOfBox', () => {
  const box: BoxDef = { x: 0, z: 0, hx: 1, hz: 0.2, ux: 1, uz: 0 }
  test('pushes out of a face and a corner, ignores far circles', () => {
    expect(pushOutOfBox(box, 0, 0.5, 0.45)).toBe(true)
    expect(obstacleHit.z).toBeCloseTo(0.65)
    expect(pushOutOfBox(box, 1.2, 0.3, 0.45)).toBe(true)
    expect(Math.hypot(obstacleHit.x - 1, obstacleHit.z - 0.2)).toBeCloseTo(0.45)
    expect(pushOutOfBox(box, 0, 2, 0.45)).toBe(false)
  })
  test('works rotated (45 degrees)', () => {
    const c = Math.SQRT1_2
    const rotated: BoxDef = { x: 0, z: 0, hx: 1, hz: 0.2, ux: c, uz: -c }
    // Local z axis is (-uz, ux) = (c, c): a point 0.3 along it overlaps.
    expect(pushOutOfBox(rotated, 0.3 * c, 0.3 * c, 0.45)).toBe(true)
    expect(Math.hypot(obstacleHit.x, obstacleHit.z)).toBeCloseTo(0.65)
  })
})

describe('walls and doors', () => {
  test('the player cannot walk through a wall', () => {
    const world = baseWorld()
    setPlayer(world, 2.6, -4)
    simulate(world, 2, 0, -1) // north into wall_n1 (z = -6)
    expect(world.player.z).toBeGreaterThan(-6 + 0.2 + world.playerDef.radius - 0.01)
  })

  test('a door opens for the player and lets them out', () => {
    const world = baseWorld()
    setPlayer(world, 4.3, -4.3)
    simulate(world, 1.5, Math.SQRT1_2, -Math.SQRT1_2) // out through door_ne
    expect(world.player.x).toBeGreaterThan(6.5)
    expect(world.player.z).toBeLessThan(-6.5)
    // Far from the door again: closed.
    expect(world.structures[slotIndex(world, 'door_ne')]?.open).toBe(false)
  })

  test('zombies never pass an open door: they break it', () => {
    const world = baseWorld()
    setPlayer(world, 4.4, -4.4) // inside, next to door_ne (open)
    const e = addZombie(world, 8, -8)
    simulate(world, 4)
    // Still outside the octagon (its NE door line is x - z = 10.2).
    expect(e.x - e.z).toBeGreaterThan(10.2)
    const door = world.structures[slotIndex(world, 'door_ne')]
    expect(door?.hp).toBeLessThan(door?.maxHp ?? 0)
  })
})

describe('zombie navigation', () => {
  test('walks around the base to a player outside, without hitting walls', () => {
    const world = baseWorld()
    setPlayer(world, 12, 0)
    const e = addZombie(world, -12, 0.3)
    simulate(world, 12)
    expect(Math.hypot(e.x - 12, e.z)).toBeLessThan(1.5)
    for (const s of world.structures) expect(s.hp).toBe(s.maxHp)
  })

  test('player shut inside: zombies break the nearest wall, then come in', () => {
    const world = baseWorld()
    setPlayer(world, 0, 0)
    const e = addZombie(world, 12, 2.6)
    simulate(world, 3)
    expect(world.structures[slotIndex(world, 'wall_e1')]?.hp).toBeLessThan(150)
    expect(e.x).toBeGreaterThan(6)
    damageStructure(world, slotIndex(world, 'wall_e1'), 1000)
    simulate(world, 6)
    expect(Math.hypot(e.x, e.z)).toBeLessThan(1.5)
    expect(checkInvariants(world)).toEqual([])
  })
})

describe('base shop (intermission only)', () => {
  function shopWorld(coins = 2000): World {
    const world = baseWorld()
    world.round.phase = 'intermission'
    world.coins = coins
    return world
  }

  test('upgrade a side: its walls and doors go up a tier at full life', () => {
    const world = shopWorld()
    damageStructure(world, slotIndex(world, 'wall_n1'), 1000) // broken
    expect(applyBaseCommand(world, 'upgrade:n')).toBe('ok')
    expect(world.sideTier).toEqual([2, 1, 1, 1])
    expect(world.coins).toBe(2000 - 80)
    for (const id of ['wall_n1', 'wall_n2', 'door_ne', 'door_nw']) {
      const s = world.structures[slotIndex(world, id)]
      expect(s?.hp).toBe(300)
      expect(s?.maxHp).toBe(300)
    }
    expect(world.structures[slotIndex(world, 'wall_s1')]?.maxHp).toBe(150)
    for (let i = 0; i < 2; i++) applyBaseCommand(world, 'upgrade:n')
    expect(applyBaseCommand(world, 'upgrade:n')).toBe('full')
    expect(world.sideTier[0]).toBe(4)
  })

  test('repair costs the missing life and rebuilds broken pieces', () => {
    const world = shopWorld()
    damageStructure(world, slotIndex(world, 'wall_w1'), 1000)
    damageStructure(world, slotIndex(world, 'wall_w2'), 50)
    const price = repairSidePrice(world, 'w')
    expect(price).toBe(Math.ceil(200 * world.baseDef.repairPricePerHp))
    expect(applyBaseCommand(world, 'repair:w')).toBe('ok')
    expect(world.coins).toBe(2000 - price)
    expect(applyBaseCommand(world, 'repair:w')).toBe('full')
    expect(world.structures[slotIndex(world, 'wall_w1')]?.hp).toBe(150)
  })

  test('not during a round, not without coins', () => {
    const world = shopWorld(10)
    expect(applyBaseCommand(world, 'upgrade:e')).toBe('noCoins')
    expect(applyBaseCommand(world, 'turret:e')).toBe('noCoins')
    world.round.phase = 'active'
    world.coins = 5000
    expect(applyBaseCommand(world, 'upgrade:e')).toBe('closed')
    expect(applyBaseCommand(world, 'turret:e')).toBe('closed')
    expect(applyBaseCommand(world, 'bogus:x')).toBe('unavailable')
  })

  test('one turret per side', () => {
    const world = shopWorld()
    expect(applyBaseCommand(world, 'turret:s')).toBe('ok')
    expect(world.coins).toBe(2000 - world.turretDef.price)
    expect(world.turrets.map((t) => t.active)).toEqual([false, false, true, false])
    expect(canBuyTurret(world, 's')).toBe('full')
    expect(canBuyTurret(world, 'n')).toBe('ok')
  })
})

describe('turrets', () => {
  test('turn to and shoot the nearest zombie in range, with turret damage', () => {
    const world = baseWorld()
    world.round.phase = 'intermission'
    world.coins = 1000
    applyBaseCommand(world, 'turret:s') // slot at (0, 6), facing +z
    world.round.phase = 'active'
    addZombie(world, 5, 12) // in range (~7.8 m), off to the side
    for (let t = 0; t < 60; t++) updateTurrets(world, FIXED_DT)
    const shots = world.projectiles.filter((p) => p.active)
    expect(shots.length).toBeGreaterThan(0)
    expect(shots[0]?.damage).toBe(world.turretDef.damage)
    const t = world.turrets[2]
    expect(t?.yaw).toBeCloseTo(Math.atan2(5, 6), 1)
  })

  test('no target in range: no shots', () => {
    const world = baseWorld()
    world.round.phase = 'intermission'
    world.coins = 1000
    applyBaseCommand(world, 'turret:s')
    world.round.phase = 'active'
    addZombie(world, 0, 25)
    for (let t = 0; t < 120; t++) updateTurrets(world, FIXED_DT)
    expect(world.activeProjectiles).toBe(0)
  })
})

describe('hiding in bushes', () => {
  test('hidden: the gun stays quiet and zombies stop chasing', () => {
    const world = baseWorld()
    const spot = coverPoint(world)
    setPlayer(world, spot.x, spot.z)
    const e = addZombie(world, spot.x + 10, spot.z)
    updateHide(world)
    expect(world.player.hidden).toBe(true)
    for (let t = 0; t < 60; t++) updateWeapons(world, FIXED_DT)
    expect(world.activeProjectiles).toBe(0)
    simulate(world, 3)
    // Wandering at reduced speed, never straight at the player.
    expect(Math.hypot(e.x - spot.x, e.z - spot.z)).toBeGreaterThan(6)
  })

  test('a zombie bumping into the player finds them until they leave the cover', () => {
    const world = baseWorld()
    const spot = coverPoint(world)
    setPlayer(world, spot.x, spot.z)
    updateHide(world)
    addZombie(world, spot.x + 0.8, spot.z)
    updatePlayerDamage(world, FIXED_DT)
    expect(world.player.exposed).toBe(true)
    updateHide(world)
    expect(world.player.hidden).toBe(false)
    setPlayer(world, 0, 0) // out of cover (base floor)
    updateHide(world)
    expect(world.player.exposed).toBe(false)
  })
})

describe('reset and phases', () => {
  test('resetWorld restores walls, tiers and turrets', () => {
    const world = baseWorld()
    world.round.phase = 'intermission'
    world.coins = 5000
    applyBaseCommand(world, 'upgrade:e')
    applyBaseCommand(world, 'turret:w')
    damageStructure(world, 0, 1000)
    resetWorld(world, 9)
    expect(world.sideTier).toEqual([1, 1, 1, 1])
    expect(world.turrets.some((t) => t.active)).toBe(false)
    for (const s of world.structures) expect(s.hp).toBe(150)
    expect(world.player.x).toBe(0)
  })

  test('damage phases follow the life thresholds', () => {
    expect(damagePhase(150, 150)).toBe(0)
    expect(damagePhase(120, 150)).toBe(1)
    expect(damagePhase(80, 150)).toBe(2)
    expect(damagePhase(40, 150)).toBe(3)
    expect(damagePhase(0, 150)).toBe(4)
  })
})
