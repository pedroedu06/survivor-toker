import { describe, expect, test } from 'bun:test'
import { createInputState } from '../core/input'
import { FIXED_DT } from '../core/loop'
import { createWorld } from '../core/world'
import { updateMovement } from './movement'

const input = (moveX: number, moveZ: number) => ({ ...createInputState(), moveX, moveZ })

describe('updateMovement', () => {
  test('moves speed * dt per step', () => {
    const world = createWorld()
    updateMovement(world, input(1, 0), FIXED_DT)
    expect(world.player.x).toBeCloseTo(world.playerDef.speed * FIXED_DT)
    expect(world.player.z).toBe(0)
  })

  test('keyboard diagonal is not faster than a straight line', () => {
    const world = createWorld()
    updateMovement(world, input(1, 1), 1)
    const dist = Math.hypot(world.player.x, world.player.z)
    expect(dist).toBeCloseTo(world.playerDef.speed)
  })

  test('analog input below 1 moves slower', () => {
    const world = createWorld()
    updateMovement(world, input(0.5, 0), 1)
    expect(world.player.x).toBeCloseTo(world.playerDef.speed * 0.5)
  })

  test('stops at the arena edge', () => {
    const world = createWorld()
    for (let i = 0; i < 60 * 30; i++) updateMovement(world, input(1, -1), FIXED_DT)
    const limit = world.arena.halfSize - world.playerDef.radius
    expect(world.player.x).toBe(limit)
    expect(world.player.z).toBe(-limit)
  })

  test('aim is independent from movement', () => {
    const world = createWorld()
    expect([world.player.facingX, world.player.facingZ]).toEqual([0, -1])
    updateMovement(world, input(-1, 0), FIXED_DT)
    expect(world.player.facingX).toBe(0)
    expect(world.player.facingZ).toBe(-1)
  })

  test('aim input sets a normalized facing; no aim keeps the last one', () => {
    const world = createWorld()
    updateMovement(world, { ...input(-1, 0), aimX: 3, aimZ: 4 }, FIXED_DT)
    expect(world.player.facingX).toBeCloseTo(0.6)
    expect(world.player.facingZ).toBeCloseTo(0.8)
    updateMovement(world, input(0, 0), FIXED_DT)
    expect(world.player.facingX).toBeCloseTo(0.6)
    expect(world.player.facingZ).toBeCloseTo(0.8)
  })
})
