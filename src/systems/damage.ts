import type { World } from '../core/world'

/** How close (beyond touching radii) a zombie must be to hit the player. */
const CONTACT_MARGIN = 0.1

/**
 * Damages the player: the shield absorbs first, the rest goes to HP.
 * HP at 0 ends the run (mission failed, "died"). Returns the damage actually taken.
 */
export function applyDamage(world: World, amount: number): number {
  const p = world.player
  if (world.debugGod || amount <= 0 || world.round.phase === 'failed') return 0

  const toShield = Math.min(p.shield, amount)
  p.shield -= toShield
  const toHp = Math.min(p.hp, amount - toShield)
  p.hp -= toHp

  p.hurtTimer = world.playerDef.hurtCooldown
  p.sinceHurt = 0

  if (p.hp <= 0) {
    p.hp = 0
    world.round.phase = 'failed'
    world.round.failReason = 'died'
  }
  return toShield + toHp
}

/**
 * Contact damage from zombies (expects `world.enemyHash` up to date) and HP regen.
 * The shield never regenerates: it is bought in the shop.
 */
export function updatePlayerDamage(world: World, dt: number): void {
  const p = world.player
  const def = world.playerDef

  if (p.hurtTimer > 0) p.hurtTimer = Math.max(0, p.hurtTimer - dt)
  p.sinceHurt += dt

  const touching = touchingZombie(world)
  // A zombie bumping into a hidden player finds them (until they leave the cover).
  if (touching && p.hidden) {
    p.exposed = true
    p.hidden = false
  }
  if (p.hurtTimer === 0 && touching) {
    applyDamage(world, world.enemyDef.contactDamage)
  }

  if (p.sinceHurt >= def.regenDelay && p.hp > 0 && p.hp < def.maxHp) {
    p.hp = Math.min(def.maxHp, p.hp + def.regenPerSecond * dt)
  }
}

function touchingZombie(world: World): boolean {
  const p = world.player
  const reach = world.playerDef.radius + world.enemyDef.radius + CONTACT_MARGIN
  const reachSq = reach * reach
  const buf = world.queryBuffer
  const n = world.enemyHash.query(p.x, p.z, reach, buf)
  for (let k = 0; k < n; k++) {
    const e = world.enemies[buf[k] ?? -1]
    if (!e?.active) continue
    const dx = e.x - p.x
    const dz = e.z - p.z
    if (dx * dx + dz * dz <= reachSq) return true
  }
  return false
}
