import { describe, expect, test } from 'bun:test'
import { FIXED_DT } from '../core/loop'
import { createWorld } from '../core/world'
import { pistol } from '../data/weapons'
import { updateProjectiles } from './projectiles'
import { updateWeapons } from './weapons'

describe('updateProjectiles', () => {
  test('moves by velocity and expires after its lifetime', () => {
    const world = createWorld()
    updateWeapons(world, FIXED_DT)
    const shot = world.projectiles.find((p) => p.active)
    if (!shot) throw new Error('expected a shot')
    const startZ = shot.z

    updateProjectiles(world, FIXED_DT)
    expect(shot.z).toBeCloseTo(startZ - pistol.projectileSpeed * FIXED_DT)

    const steps = Math.ceil(pistol.projectileLifetime / FIXED_DT)
    for (let i = 0; i < steps; i++) updateProjectiles(world, FIXED_DT)
    expect(shot.active).toBe(false)
    expect(world.activeProjectiles).toBe(0)
  })

  test('expires when leaving the arena', () => {
    const world = createWorld({ arena: { halfSize: 1, maxProjectiles: 4, maxEnemies: 8 } })
    updateWeapons(world, FIXED_DT)
    for (let i = 0; i < 10; i++) updateProjectiles(world, FIXED_DT)
    expect(world.activeProjectiles).toBe(0)
  })

  test('freed slots are reused', () => {
    const world = createWorld({ arena: { halfSize: 30, maxProjectiles: 1, maxEnemies: 8 } })
    let shots = 0
    for (let i = 0; i < 60 * 5; i++) {
      updateProjectiles(world, FIXED_DT)
      const before = world.activeProjectiles
      updateWeapons(world, FIXED_DT)
      if (world.activeProjectiles > before) shots++
    }
    expect(world.projectiles.length).toBe(1)
    // Lifetime 0.8 s => the single slot is freed and reused several times in 5 s.
    expect(shots).toBeGreaterThan(3)
  })
})
