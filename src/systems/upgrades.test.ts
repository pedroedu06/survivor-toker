import { describe, expect, test } from 'bun:test'
import { createInputState } from '../core/input'
import { FIXED_DT } from '../core/loop'
import { createWorld, type World } from '../core/world'
import { pistol } from '../data/weapons'
import { updateCollision } from './collision'
import { rebuildEnemyHash } from './enemies'
import { startRound } from './rounds'
import { buyItem, buyWeaponUpgrade, canUpgrade, updateShop, upgradePrice, useItem } from './shop'
import { effectiveDamage, effectiveFireRate } from './weaponStats'
import { updateWeapons } from './weapons'

function inIntermission(coins = 10_000): World {
  const world = createWorld()
  startRound(world, 1)
  world.round.phase = 'intermission'
  world.coins = coins
  return world
}

describe('weapon upgrades', () => {
  test('price grows per level: 30, 48, 77, 123, 197', () => {
    const world = inIntermission()
    const prices: number[] = []
    for (let i = 0; i < 5; i++) {
      prices.push(upgradePrice(world, 'damage'))
      buyWeaponUpgrade(world, 'damage')
    }
    expect(prices).toEqual([30, 48, 77, 123, 197])
    expect(world.coins).toBe(10_000 - 475)
  })

  test('stops at max level', () => {
    const world = inIntermission()
    for (let i = 0; i < 5; i++) buyWeaponUpgrade(world, 'fireRate')
    expect(canUpgrade(world, 'fireRate')).toBe('full')
    expect(buyWeaponUpgrade(world, 'fireRate')).toBe('full')
  })

  test('refused without coins or outside the intermission', () => {
    const world = inIntermission(10)
    expect(buyWeaponUpgrade(world, 'damage')).toBe('noCoins')
    world.coins = 1000
    world.round.phase = 'active'
    expect(buyWeaponUpgrade(world, 'damage')).toBe('closed')
  })

  test('damage upgrade: +25% per level on the equipped weapon', () => {
    const world = inIntermission()
    buyWeaponUpgrade(world, 'damage')
    buyWeaponUpgrade(world, 'damage')
    expect(effectiveDamage(world)).toBeCloseTo(pistol.damage * 1.5)
    expect(world.weaponLevels.pistol?.damage).toBe(2)
  })

  test('fire rate upgrade makes the weapon shoot more', () => {
    const shotsInOneSecond = (levels: number) => {
      const world = inIntermission()
      for (let i = 0; i < levels; i++) buyWeaponUpgrade(world, 'fireRate')
      world.round.phase = 'active'
      let shots = 0
      for (let i = 0; i < 60; i++) {
        const before = world.activeProjectiles
        updateWeapons(world, FIXED_DT)
        if (world.activeProjectiles > before) shots++
      }
      return shots
    }
    expect(effectiveFireRate(inIntermission())).toBe(pistol.fireRate)
    expect(shotsInOneSecond(5)).toBeGreaterThan(shotsInOneSecond(0))
  })

  test('upgrades are per weapon: another weapon starts at level 0', () => {
    const world = inIntermission()
    buyWeaponUpgrade(world, 'damage')
    world.weapon = { ...pistol, id: 'boxShotgun' }
    expect(effectiveDamage(world)).toBe(pistol.damage)
  })

  test('applies upgrade commands from the input', () => {
    const world = inIntermission()
    updateShop(world, { ...createInputState(), upgradeWeapon: 'damage' }, FIXED_DT)
    expect(world.weaponLevels.pistol?.damage).toBe(1)
  })
})

describe('damage potion', () => {
  test('x1.5 damage for 10 s, then wears off', () => {
    const world = inIntermission()
    buyItem(world, 'damagePotion')
    world.round.phase = 'active'
    expect(useItem(world, 'damagePotion')).toBe(true)
    expect(effectiveDamage(world)).toBeCloseTo(pistol.damage * 1.5)
    for (let i = 0; i < 60 * 11; i++) updateShop(world, createInputState(), FIXED_DT)
    expect(effectiveDamage(world)).toBe(pistol.damage)
  })

  test('stacks with the damage upgrade and hits harder', () => {
    const world = inIntermission()
    buyWeaponUpgrade(world, 'damage') // x1.25
    buyItem(world, 'damagePotion')
    world.round.phase = 'active'
    useItem(world, 'damagePotion') // x1.5
    const e = world.enemies[0]
    if (!e) throw new Error('no slot')
    e.active = true
    e.x = 5
    e.z = 0
    e.hp = 10
    world.activeEnemies = 1
    rebuildEnemyHash(world)
    const shot = world.projectiles[0]
    if (!shot) throw new Error('no slot')
    shot.active = true
    shot.x = 5
    shot.z = 0
    shot.life = 1
    shot.damage = effectiveDamage(world)
    world.activeProjectiles = 1
    updateCollision(world)
    expect(e.hp).toBeCloseTo(10 - pistol.damage * 1.25 * 1.5)
  })
})
