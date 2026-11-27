import { describe, expect, test } from 'bun:test'
import { createInputState } from '../core/input'
import { FIXED_DT } from '../core/loop'
import { createWorld, type World } from '../core/world'
import { getShopItem } from '../data/shop'
import { updateMovement } from './movement'
import { startRound } from './rounds'
import { buyItem, canBuy, updateShop, useItem } from './shop'

function inIntermission(coins = 1000): World {
  const world = createWorld()
  startRound(world, 1)
  world.round.phase = 'intermission'
  world.coins = coins
  return world
}

describe('buyItem', () => {
  test('refused without enough coins', () => {
    const world = inIntermission(5)
    expect(buyItem(world, 'healthPotion')).toBe('noCoins')
    expect(world.coins).toBe(5)
  })

  test('refused outside the intermission', () => {
    const world = inIntermission()
    world.round.phase = 'active'
    expect(buyItem(world, 'healthPotion')).toBe('closed')
  })

  test('"coming soon" items cannot be bought', () => {
    const world = inIntermission()
    for (const id of ['katana', 'knife', 'axe', 'turret', 'wall']) {
      expect(buyItem(world, id)).toBe('unavailable')
    }
    expect(world.coins).toBe(1000)
  })

  test('shield refills to max and is refused when full', () => {
    const world = inIntermission()
    expect(canBuy(world, 'shield')).toBe('full')
    world.player.shield = 10
    expect(buyItem(world, 'shield')).toBe('ok')
    expect(world.player.shield).toBe(world.playerDef.maxShield)
    expect(world.coins).toBe(1000 - (getShopItem('shield')?.price ?? 0))
  })

  test('potions go to the inventory up to maxStack', () => {
    const world = inIntermission()
    for (let i = 0; i < 3; i++) expect(buyItem(world, 'healthPotion')).toBe('ok')
    expect(buyItem(world, 'healthPotion')).toBe('full')
    expect(world.inventory.healthPotion).toBe(3)
    expect(world.coins).toBe(1000 - 3 * 15)
  })
})

describe('useItem', () => {
  test('only during an active round and with stock', () => {
    const world = inIntermission()
    buyItem(world, 'healthPotion')
    world.player.hp = 30
    expect(useItem(world, 'healthPotion')).toBe(false) // still intermission
    world.round.phase = 'active'
    expect(useItem(world, 'speedPotion')).toBe(false) // none carried
    expect(useItem(world, 'healthPotion')).toBe(true)
    expect(world.player.hp).toBe(80)
    expect(world.inventory.healthPotion).toBe(0)
  })

  test('health potion never goes above max and is not wasted at full HP', () => {
    const world = inIntermission()
    buyItem(world, 'healthPotion')
    world.round.phase = 'active'
    expect(useItem(world, 'healthPotion')).toBe(false)
    world.player.hp = 90
    expect(useItem(world, 'healthPotion')).toBe(true)
    expect(world.player.hp).toBe(world.playerDef.maxHp)
  })

  test('speed potion makes the player faster, then wears off', () => {
    const world = inIntermission()
    buyItem(world, 'speedPotion')
    world.round.phase = 'active'
    const input = { ...createInputState(), moveX: 1 }

    updateShop(world, { ...input, useItem: 'speedPotion' }, FIXED_DT)
    const x0 = world.player.x
    updateMovement(world, input, FIXED_DT)
    expect(world.player.x - x0).toBeCloseTo(world.playerDef.speed * 1.4 * FIXED_DT)

    for (let i = 0; i < 60 * 11; i++) updateShop(world, createInputState(), FIXED_DT)
    expect(world.player.speedBoostTimer).toBe(0)
    const x1 = world.player.x
    updateMovement(world, input, FIXED_DT)
    expect(world.player.x - x1).toBeCloseTo(world.playerDef.speed * FIXED_DT)
  })
})

describe('updateShop', () => {
  test('applies buy commands from the input', () => {
    const world = inIntermission()
    updateShop(world, { ...createInputState(), buyItem: 'speedPotion' }, FIXED_DT)
    expect(world.inventory.speedPotion).toBe(1)
  })
})
