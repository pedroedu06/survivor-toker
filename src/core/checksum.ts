import type { World } from './world'

/**
 * Short hash of the gameplay state (FNV-1a over rounded numbers).
 * Two runs with the same checksum ended in the same state: used to verify replays.
 */
export function worldChecksum(world: World): string {
  let h = 0x811c9dc5
  const mix = (v: number) => {
    // Round so tiny float noise in the last digits does not matter.
    let x = Math.round(v * 1000) | 0
    for (let i = 0; i < 4; i++) {
      h ^= x & 0xff
      h = Math.imul(h, 0x01000193)
      x >>>= 8
    }
  }

  const p = world.player
  mix(world.tick)
  mix(p.x)
  mix(p.z)
  mix(p.hp)
  mix(p.shield)
  mix(world.coins)
  mix(world.kills)
  mix(world.round.number)
  mix(world.round.killed)
  mix(world.round.spawned)
  mix(world.activeEnemies)
  mix(world.activeProjectiles)
  for (const e of world.enemies) {
    if (!e.active) continue
    mix(e.x)
    mix(e.z)
    mix(e.hp)
  }
  return (h >>> 0).toString(16).padStart(8, '0')
}
