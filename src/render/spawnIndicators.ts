import {
  CircleGeometry,
  DoubleSide,
  Group,
  Mesh,
  MeshBasicMaterial,
  RingGeometry,
  type Scene,
  Shape,
  ShapeGeometry,
} from 'three'
import type { World } from '../core/world'

const ACTIVE_COLOR = 0xff7a3d
const IDLE_COLOR = 0x6b7280
/** Arc arrow around the player: radius, width and angular size. */
const ARC_INNER = 1.75
const ARC_OUTER = 2.05
const ARC_ANGLE = (50 * Math.PI) / 180
const ARROW_Y = 0.04
const MARKER_Y = 0.015

export type SpawnIndicators = {
  /** Call every frame with the interpolated player position. */
  update(world: World, playerX: number, playerZ: number, nowMs: number): void
}

/**
 * Debug ground markers on every spawn point (active ones in orange; hidden in the final
 * game) and, during a round, an arc arrow around the player pointing to each active spawn point.
 * All meshes are created once; per frame only transforms/visibility/opacity change.
 */
export function createSpawnIndicators(
  scene: Scene,
  world: World,
  showMarkers: boolean,
): SpawnIndicators {
  const points = world.map.spawnPoints
  const spread = world.map.spawnSpread

  // ---- Ground markers ----
  const discGeo = new CircleGeometry(spread, 32)
  discGeo.rotateX(-Math.PI / 2)
  const ringGeo = new RingGeometry(spread - 0.18, spread, 40)
  ringGeo.rotateX(-Math.PI / 2)
  const markers = points.map((p) => {
    const discMat = new MeshBasicMaterial({
      color: 0x000000,
      transparent: true,
      opacity: 0.25,
      depthWrite: false,
    })
    const ringMat = new MeshBasicMaterial({
      color: IDLE_COLOR,
      transparent: true,
      opacity: 0.6,
      depthWrite: false,
    })
    const group = new Group()
    group.add(new Mesh(discGeo, discMat), new Mesh(ringGeo, ringMat))
    group.position.set(p.x, MARKER_Y, p.z)
    group.visible = showMarkers
    scene.add(group)
    return { discMat, ringMat }
  })

  // ---- Arc arrows (built pointing to +x, then rotated toward the point) ----
  const arcGeo = new RingGeometry(ARC_INNER, ARC_OUTER, 16, 1, -ARC_ANGLE / 2, ARC_ANGLE)
  arcGeo.rotateX(-Math.PI / 2)
  const tip = new Shape()
  tip.moveTo(ARC_OUTER + 0.05, -0.3)
  tip.lineTo(ARC_OUTER + 0.6, 0)
  tip.lineTo(ARC_OUTER + 0.05, 0.3)
  tip.closePath()
  const tipGeo = new ShapeGeometry(tip)
  tipGeo.rotateX(-Math.PI / 2)
  const arrowMat = new MeshBasicMaterial({
    color: ACTIVE_COLOR,
    transparent: true,
    opacity: 0.8,
    depthWrite: false,
    side: DoubleSide,
  })
  const arrows = points.map(() => {
    const group = new Group()
    group.add(new Mesh(arcGeo, arrowMat), new Mesh(tipGeo, arrowMat))
    group.visible = false
    scene.add(group)
    return group
  })

  let shownMask = -1
  let shownPhase = ''

  return {
    update(world, px, pz, nowMs) {
      const r = world.round
      const mask = r.number > 0 ? r.spawnMask : 0
      const showActive = r.phase === 'active'

      if (mask !== shownMask || r.phase !== shownPhase) {
        shownMask = mask
        shownPhase = r.phase
        for (let i = 0; i < markers.length; i++) {
          const m = markers[i]
          if (!m) continue
          const active = showActive && (mask & (1 << i)) !== 0
          m.ringMat.color.setHex(active ? ACTIVE_COLOR : IDLE_COLOR)
          m.ringMat.opacity = active ? 0.9 : 0.45
          m.discMat.opacity = active ? 0.35 : 0.2
        }
      }

      arrowMat.opacity = 0.6 + 0.3 * Math.sin(nowMs / 160)
      for (let i = 0; i < arrows.length; i++) {
        const arrow = arrows[i]
        const p = points[i]
        if (!arrow || !p) continue
        const visible = showActive && (mask & (1 << i)) !== 0
        arrow.visible = visible
        if (!visible) continue
        arrow.position.set(px, ARROW_Y, pz)
        // Rotation about Y maps +x to (cos, 0, -sin): aim it at the spawn point.
        arrow.rotation.y = Math.atan2(-(p.z - pz), p.x - px)
      }
    },
  }
}
