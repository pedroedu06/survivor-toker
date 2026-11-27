import {
  Color,
  type Material,
  Mesh,
  MeshLambertMaterial,
  MeshStandardMaterial,
  type Object3D,
} from 'three'
import { type GLTF, GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import startBaseUrl from '../../art/maps/start_base.glb?url'
import startBasePrefabsUrl from '../../art/maps/start_base_prefabs.glb?url'

/** Blender files of each map (by `MapDef.id`). */
const MAP_FILES: Record<string, { map: string; prefabs: string }> = {
  startBase: { map: startBaseUrl, prefabs: startBasePrefabsUrl },
}

export type MapAssets = {
  map: GLTF
  prefabs: GLTF
}

/** [provisional] "Vibrant" look: color tweaks applied to every map material on load. */
const SATURATION = 1.15
const LIGHTNESS = 1.0

export function hasMapAssets(mapId: string): boolean {
  return mapId in MAP_FILES
}

/** Loads the map and its prefab .glb (walls/doors tiers, damage phases, turret, debris). */
export async function loadMapAssets(mapId: string): Promise<MapAssets | null> {
  const files = MAP_FILES[mapId]
  if (!files) return null
  const loader = new GLTFLoader()
  const [map, prefabs] = await Promise.all([
    loader.loadAsync(files.map),
    loader.loadAsync(files.prefabs),
  ])
  const cache = new Map<Material, Material>()
  vibrant(map.scene, cache)
  vibrant(prefabs.scene, cache)
  return { map, prefabs }
}

const hsl = { h: 0, s: 0, l: 0 }

/**
 * Swaps the glTF PBR materials for cheaper Lambert ones (flat colors look the same, much
 * lighter on phones) and pushes saturation/lightness up so the map reads bright and colorful.
 */
function vibrant(root: Object3D, cache: Map<Material, Material>): void {
  root.traverse((o) => {
    if (!(o instanceof Mesh)) return
    const convert = (m: Material): Material => {
      const done = cache.get(m)
      if (done) return done
      if (!(m instanceof MeshStandardMaterial)) return m
      const color = new Color().copy(m.color)
      color.getHSL(hsl)
      color.setHSL(hsl.h, Math.min(1, hsl.s * SATURATION), Math.min(0.95, hsl.l * LIGHTNESS))
      const lambert = new MeshLambertMaterial({ color, name: m.name })
      if (m.emissive && (m.emissive.r > 0 || m.emissive.g > 0 || m.emissive.b > 0)) {
        lambert.emissive.copy(m.emissive)
        lambert.emissiveIntensity = Math.max(0.6, m.emissiveIntensity)
      }
      cache.set(m, lambert)
      return lambert
    }
    o.material = Array.isArray(o.material) ? o.material.map(convert) : convert(o.material)
  })
}
