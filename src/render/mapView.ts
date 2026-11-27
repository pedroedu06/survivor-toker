import {
  AnimationMixer,
  type Material,
  Mesh,
  type Object3D,
  PlaneGeometry,
  type Scene,
  Vector3,
  type WebGLProgramParametersWithUniforms,
} from 'three'
import type { MapAssets } from './mapAssets'

/** Hole in tree canopies/bushes around the player so they can be seen while hiding. */
const HOLE_RADIUS = 2.3
/** Below this height nothing is cut (ground tufts share the bush colors). */
const HOLE_MIN_Y = 0.35

/** Map meshes that hide the player (cut around them). */
const COVER = /^(trees_canopy_|bushes$)/
/** Static meshes that cast shadows (everything tall). */
const CASTERS = /^(trees_|bushes$|turret_block_)/
/** Meshes that receive shadows. */
const RECEIVERS = /^(ground|floor|ground_detail)$/
/** Replaced by code: walls/doors (structuresView), collision shapes (never drawn). */
const REMOVED = /^(col_|wall_|door_)/
/**
 * Grass "skirt" far beyond the map's own ground, slightly below it, so the camera never
 * sees where the ground ends (the sky showed past the corners).
 */
const SKIRT_SIZE = 600
const SKIRT_Y = -0.03

export type MapView = {
  update(dt: number, playerX: number, playerZ: number): void
}

export function createMapView(scene: Scene, assets: MapAssets): MapView {
  const root = assets.map.scene
  const holeCenter = { value: new Vector3() }
  const patched = new Set<Material>()
  const removed: Object3D[] = []

  root.traverse((o) => {
    if (REMOVED.test(o.name)) {
      removed.push(o)
      return
    }
    if (!(o instanceof Mesh)) return
    const name = meshOwnerName(o)
    o.castShadow = CASTERS.test(name)
    o.receiveShadow = RECEIVERS.test(name) || name === 'floor'
    if (COVER.test(name)) {
      const mats = Array.isArray(o.material) ? o.material : [o.material]
      for (const m of mats) {
        if (patched.has(m)) continue
        patched.add(m)
        addCanopyHole(m, holeCenter)
      }
    }
  })
  for (const o of removed) o.removeFromParent()
  scene.add(root)

  // Same material as the map ground, so the seam is invisible.
  const ground = root.getObjectByName('ground')
  if (ground instanceof Mesh) {
    const skirtGeo = new PlaneGeometry(SKIRT_SIZE, SKIRT_SIZE)
    skirtGeo.rotateX(-Math.PI / 2)
    const skirt = new Mesh(skirtGeo, ground.material)
    skirt.position.y = SKIRT_Y
    skirt.receiveShadow = true
    scene.add(skirt)
  }

  // Wind: one looping morph-target clip per canopy object + bushes.
  const mixer = new AnimationMixer(root)
  for (const clip of assets.map.animations) mixer.clipAction(clip).play()

  return {
    update(dt, px, pz) {
      mixer.update(dt)
      holeCenter.value.set(px, 0, pz)
    },
  }
}

/** Multi-material glTF meshes load as a Group of Meshes: the Blender name is on the parent. */
function meshOwnerName(o: Object3D): string {
  return o.parent && o.parent.type === 'Group' && o.name.startsWith(o.parent.name)
    ? o.parent.name
    : o.name
}

function addCanopyHole(material: Material, center: { value: Vector3 }): void {
  material.onBeforeCompile = (shader: WebGLProgramParametersWithUniforms) => {
    shader.uniforms.uHoleCenter = center
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vHoleWorld;')
      .replace(
        '#include <project_vertex>',
        '#include <project_vertex>\nvHoleWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;',
      )
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        '#include <common>\nvarying vec3 vHoleWorld;\nuniform vec3 uHoleCenter;',
      )
      .replace(
        '#include <clipping_planes_fragment>',
        `#include <clipping_planes_fragment>
        {
          float hd = distance(vHoleWorld.xz, uHoleCenter.xz);
          if (vHoleWorld.y > ${HOLE_MIN_Y.toFixed(2)} && hd < ${HOLE_RADIUS.toFixed(2)}) {
            float keep = smoothstep(${(HOLE_RADIUS * 0.55).toFixed(2)}, ${HOLE_RADIUS.toFixed(2)}, hd);
            float n = fract(sin(dot(floor(gl_FragCoord.xy), vec2(12.9898, 78.233))) * 43758.5453);
            if (n > keep) discard;
          }
        }`,
      )
  }
  material.needsUpdate = true
}
