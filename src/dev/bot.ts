import type { InputState } from '../core/input'
import type { World } from '../core/world'
import { SIDES } from '../data/maps'
import { canBuyTurret, canRepairSide, canUpgradeSide } from '../systems/base'
import { canBuy } from '../systems/shop'

/**
 * A tiny bot that plays by itself (dev panel, performance test, soak test).
 * Pure: reads the world, writes an input. No DOM, no Math.random.
 *  - aims at the nearest zombie, strafes in a circle around the arena center;
 *  - in the intermission buys potions/shield when it can, then skips;
 *  - drinks a health potion when low.
 */
export function botInput(world: World, out: InputState): void {
  const p = world.player
  out.buyItem = ''
  out.useItem = ''
  out.upgradeWeapon = ''
  out.dev = ''
  out.base = ''
  out.skipIntermission = false

  // Aim: nearest active zombie.
  let best = Number.POSITIVE_INFINITY
  out.aimX = 0
  out.aimZ = 0
  for (const e of world.enemies) {
    if (!e.active) continue
    const dx = e.x - p.x
    const dz = e.z - p.z
    const d = dx * dx + dz * dz
    if (d < best) {
      best = d
      out.aimX = dx
      out.aimZ = dz
    }
  }

  // Move: circle around the center, radius ~8, direction flips every 20 s.
  const t = world.tick / 60
  const dir = Math.floor(t / 20) % 2 === 0 ? 1 : -1
  const angle = Math.atan2(p.z, p.x)
  const radius = Math.hypot(p.x, p.z)
  const pull = (8 - radius) * 0.3
  out.moveX = -Math.sin(angle) * dir + Math.cos(angle) * pull
  out.moveZ = Math.cos(angle) * dir + Math.sin(angle) * pull

  if (world.round.phase === 'intermission') {
    for (const id of ['shield', 'healthPotion', 'damagePotion']) {
      if (canBuy(world, id) === 'ok') {
        out.buyItem = id
        return // one purchase per step; skip on a later step
      }
    }
    // Base: repair, then a turret, then upgrades (one per step).
    for (const side of SIDES) {
      if (canRepairSide(world, side) === 'ok') {
        out.base = `repair:${side}`
        return
      }
    }
    for (const side of SIDES) {
      if (canBuyTurret(world, side) === 'ok') {
        out.base = `turret:${side}`
        return
      }
    }
    for (const side of SIDES) {
      if (canUpgradeSide(world, side) === 'ok') {
        out.base = `upgrade:${side}`
        return
      }
    }
    out.skipIntermission = true
    return
  }

  if (world.round.phase === 'active') {
    if (p.hp < world.playerDef.maxHp * 0.35 && (world.inventory.healthPotion ?? 0) > 0) {
      out.useItem = 'healthPotion'
    } else if (world.activeEnemies > 20 && (world.inventory.damagePotion ?? 0) > 0) {
      if (p.damageBoostTimer === 0) out.useItem = 'damagePotion'
    }
  }
}
