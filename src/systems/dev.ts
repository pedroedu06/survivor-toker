import type { World } from '../core/world'
import { SIDES, type Side } from '../data/maps'
import { shopItems } from '../data/shop'
import { damageStructure, placeTurret, restoreSide } from './base'
import { startRound } from './rounds'
import { spawnEnemy } from './spawn'

/**
 * Dev/cheat commands. They go through the input (like buy/skip), so a recorded run
 * replays exactly even when the dev panel was used.
 *
 * Commands (';'-separated in one string):
 *   coins:N   add N coins          god:1 / god:0   god mode on/off
 *   round:N   jump to round N      spawn:N         spawn N extra zombies now
 *   killAll   kill every zombie    heal            full HP and shield
 *   potions   +1 of each potion (up to the max)
 *   wallhp:<slot>:<pct>  set a base piece's life to pct% (slot id like wall_n1 or "all")
 *   breakall  destroy every wall/door      repairall  rebuild every side at full life
 *   turret:<side>        place a free turret (n/e/s/w)
 * Unknown commands are ignored.
 */
export function applyDevCommands(world: World, commands: string): void {
  if (!commands) return
  for (const raw of commands.split(';')) {
    const [name = '', arg = '', arg2 = ''] = raw.trim().split(':')
    const n = Number(arg)
    switch (name) {
      case 'coins':
        if (Number.isFinite(n)) world.coins = Math.max(0, world.coins + Math.trunc(n))
        break
      case 'god':
        world.debugGod = arg !== '0'
        break
      case 'round':
        if (Number.isFinite(n) && n >= 1) {
          clearEnemies(world, false)
          startRound(world, Math.trunc(n))
        }
        break
      case 'spawn':
        // Not before round 1 starts (startRound would reset the counters under them).
        if (Number.isFinite(n) && world.round.phase === 'active' && world.round.number > 0) {
          for (let i = 0; i < Math.trunc(n); i++) {
            if (!spawnEnemy(world)) break
            // Extra zombies join the round so it still ends when all are dead.
            world.round.total++
            world.round.spawned++
          }
        }
        break
      case 'killAll':
        clearEnemies(world, true)
        break
      case 'heal':
        world.player.hp = world.playerDef.maxHp
        world.player.shield = world.playerDef.maxShield
        break
      case 'wallhp': {
        const pct = Number(arg2)
        if (!Number.isFinite(pct)) break
        const slots = world.map.slots ?? []
        for (let i = 0; i < slots.length; i++) {
          if (arg !== 'all' && slots[i]?.id !== arg) continue
          const s = world.structures[i]
          if (!s) continue
          const target = Math.max(0, Math.min(1, pct / 100)) * s.maxHp
          if (target < s.hp) damageStructure(world, i, s.hp - target)
          else if (target > s.hp) {
            s.hp = target
            world.nav.dirty = true
          }
        }
        break
      }
      case 'breakall':
        world.structures.forEach((s, i) => {
          damageStructure(world, i, s.hp)
        })
        break
      case 'repairall':
        for (const side of SIDES) restoreSide(world, side)
        break
      case 'turret':
        if ((SIDES as readonly string[]).includes(arg)) placeTurret(world, arg as Side)
        break
      case 'potions':
        for (const item of shopItems) {
          if (item.kind !== 'potion' || item.maxStack === undefined) continue
          world.inventory[item.id] = Math.min(item.maxStack, (world.inventory[item.id] ?? 0) + 1)
        }
        break
    }
  }
}

/** Removes every zombie. `countAsKills` keeps round progress (killed) consistent. */
function clearEnemies(world: World, countAsKills: boolean): void {
  for (const e of world.enemies) {
    if (!e.active) continue
    e.active = false
    world.activeEnemies--
    if (countAsKills) {
      world.kills++
      world.round.killed++
    }
  }
}
