import { describe, expect, test } from 'bun:test'
import { FIXED_DT } from '../core/loop'
import { createWorld } from '../core/world'
import { pistol } from '../data/weapons'
import { updateWeapons } from './weapons'

describe('updateWeapons', () => {
  test('fires about fireRate shots per second', () => {
    const world = createWorld()
    for (let i = 0; i < 60; i++) updateWeapons(world, FIXED_DT)
    // First shot is immediate, then one every 1/fireRate.
    expect(world.activeProjectiles).toBe(pistol.fireRate)
  })

  test('shoots in the facing direction from the spawn offset', () => {
    const world = createWorld()
    world.player.facingX = 1
    world.player.facingZ = 0
    updateWeapons(world, FIXED_DT)
    const shot = world.projectiles.find((p) => p.active)
    expect(shot?.x).toBeCloseTo(pistol.spawnOffset)
    expect(shot?.z).toBeCloseTo(0)
    expect(shot?.vx).toBeCloseTo(pistol.projectileSpeed)
    expect(shot?.vz).toBeCloseTo(0)
  })

  test('skips shots when the pool is full instead of growing', () => {
    const world = createWorld({ arena: { halfSize: 30, maxProjectiles: 2 } })
    for (let i = 0; i < 600; i++) updateWeapons(world, FIXED_DT)
    expect(world.projectiles.length).toBe(2)
    expect(world.activeProjectiles).toBe(2)
  })
})
