import type { World } from '../core/world'
import { shopItems } from '../data/shop'
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
 * Unknown commands are ignored.
 */
export function applyDevCommands(world: World, commands: string): void {
  if (!commands) return
  for (const raw of commands.split(';')) {
    const [name = '', arg = ''] = raw.trim().split(':')
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
        if (Number.isFinite(n) && world.round.phase === 'active') {
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
