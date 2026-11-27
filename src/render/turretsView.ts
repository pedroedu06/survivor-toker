import { Group, Mesh, MeshBasicMaterial, type Object3D, type Scene } from 'three'
import type { World } from '../core/world'
import type { Side } from '../data/maps'
import type { MapAssets } from './mapAssets'

/** Turret placement preview: which sides show a ghost and which one is selected. */
export type TurretPlacement = {
  active: boolean
  selected: Side | null
}

export type TurretsView = {
  update(world: World, alpha: number, nowMs: number, placement: TurretPlacement): void
}

type Spot = {
  side: Side
  slotYaw: number
  turret: Object3D | null
  head: Object3D | null
  ghost: Object3D | null
}

/**
 * Turrets on the base's turret blocks: the real turret when bought (head turns to the
 * simulated yaw) and translucent "ghost" previews while the player picks a side.
 */
export function createTurretsView(scene: Scene, world: World, assets: MapAssets): TurretsView {
  const base = assets.prefabs.scene.getObjectByName('prefab_turret_base')
  const ghostMat = new MeshBasicMaterial({
    color: 0x7fe3ff,
    transparent: true,
    opacity: 0.35,
    depthWrite: false,
  })
  const ghostSelectedMat = new MeshBasicMaterial({
    color: 0xffd34f,
    transparent: true,
    opacity: 0.6,
    depthWrite: false,
  })

  const spots: Spot[] = (world.map.turretSlots ?? []).map((slot) => {
    const make = () => {
      if (!base) return null
      const holder = new Group()
      holder.position.set(slot.x, slot.y, slot.z)
      holder.rotation.y = slot.yaw
      const copy = base.clone()
      copy.position.set(0, 0, 0)
      copy.rotation.set(0, 0, 0)
      holder.add(copy)
      holder.visible = false
      scene.add(holder)
      return holder
    }
    const turret = make()
    turret?.traverse((o) => {
      o.castShadow = true
    })
    const ghost = make()
    ghost?.traverse((o) => {
      if (o instanceof Mesh) o.material = ghostMat
    })
    return {
      side: slot.side,
      slotYaw: slot.yaw,
      turret,
      head: turret?.getObjectByName('prefab_turret_head') ?? null,
      ghost,
    }
  })

  let shownSelected: Side | null = null

  return {
    update(world, alpha, nowMs, placement) {
      for (let i = 0; i < spots.length; i++) {
        const spot = spots[i] as Spot
        const t = world.turrets[i]
        const active = t?.active ?? false
        if (spot.turret) spot.turret.visible = active
        if (active && t && spot.head) {
          let d = t.yaw - t.prevYaw
          d = Math.atan2(Math.sin(d), Math.cos(d))
          spot.head.rotation.y = t.prevYaw + d * alpha - spot.slotYaw
        }
        if (spot.ghost) {
          spot.ghost.visible = placement.active && !active
          if (spot.ghost.visible) {
            // Gentle bob so the previews read as "pick one".
            spot.ghost.position.y =
              (world.map.turretSlots?.[i]?.y ?? 0) + Math.sin(nowMs / 250) * 0.05
          }
        }
      }
      if (placement.selected !== shownSelected) {
        shownSelected = placement.selected
        for (const spot of spots) {
          const mat = spot.side === shownSelected ? ghostSelectedMat : ghostMat
          spot.ghost?.traverse((o) => {
            if (o instanceof Mesh) o.material = mat
          })
        }
      }
      ghostMat.opacity = 0.28 + 0.12 * Math.sin(nowMs / 200)
    },
  }
}
