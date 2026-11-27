import {
  type BufferGeometry,
  Color,
  ConeGeometry,
  CylinderGeometry,
  DodecahedronGeometry,
  Float32BufferAttribute,
  IcosahedronGeometry,
  InstancedMesh,
  MeshLambertMaterial,
  Object3D,
  type Scene,
} from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

/**
 * Decorative scenery OUTSIDE the play area (render only, no collision, no gameplay):
 * a forest ring, grassy hills and rocks right past the border, and low-poly mountains further
 * out. Everything is instanced (a handful of draw calls) and laid out with a fixed seed, so it
 * looks the same every run.
 */
const SEED = 1337
/** Trees/hills/rocks fill the band between the play area edge and this distance. */
const BAND_INNER = 32
const BAND_OUTER = 46
const TREE_SPACING = 3.2
/** Mountains: a ring far out, faded by the fog. */
const MOUNTAINS = 22
const MOUNTAIN_DIST = { min: 62, max: 80 }

const COLORS = {
  trunk: 0x6b3d1c,
  pine: 0x2f7d3a,
  leaf: 0x4caf3c,
  leafLight: 0x7ccf4a,
  hill: 0x5aa33a,
  rock: 0x8a8f96,
  mountain: 0x6f7f8a,
  snow: 0xf4f8ff,
}

/** Small deterministic RNG (mulberry32): same layout every time. */
function rng(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Geometry with per-vertex colors baked in (one material for many parts). */
function painted(geo: BufferGeometry, color: number): BufferGeometry {
  const g = geo.index ? geo.toNonIndexed() : geo
  const c = new Color(color)
  const count = g.getAttribute('position').count
  const colors = new Float32Array(count * 3)
  for (let i = 0; i < count; i++) {
    colors[i * 3] = c.r
    colors[i * 3 + 1] = c.g
    colors[i * 3 + 2] = c.b
  }
  g.setAttribute('color', new Float32BufferAttribute(colors, 3))
  g.deleteAttribute('uv')
  return g
}

function merged(parts: BufferGeometry[]): BufferGeometry {
  const g = mergeGeometries(parts)
  if (!g) throw new Error('scenery: cannot merge geometries')
  return g
}

function pineGeometry(): BufferGeometry {
  const trunk = painted(new CylinderGeometry(0.15, 0.2, 1.2, 6).translate(0, 0.6, 0), COLORS.trunk)
  const low = painted(new ConeGeometry(1.3, 2.2, 7).translate(0, 2.0, 0), COLORS.pine)
  const high = painted(new ConeGeometry(0.9, 1.8, 7).translate(0, 3.2, 0), COLORS.pine)
  return merged([trunk, low, high])
}

function roundTreeGeometry(): BufferGeometry {
  const trunk = painted(new CylinderGeometry(0.17, 0.24, 1.6, 6).translate(0, 0.8, 0), COLORS.trunk)
  const crown = painted(new IcosahedronGeometry(1.4, 0).translate(0, 2.6, 0), COLORS.leaf)
  const top = painted(new IcosahedronGeometry(0.9, 0).translate(0.4, 3.4, 0.2), COLORS.leafLight)
  return merged([trunk, crown, top])
}

function mountainGeometry(): BufferGeometry {
  const body = painted(new ConeGeometry(1, 1, 7).translate(0, 0.5, 0), COLORS.mountain)
  const cap = painted(new ConeGeometry(0.32, 0.32, 7).translate(0, 0.84, 0), COLORS.snow)
  return merged([body, cap])
}

export function createScenery(scene: Scene): void {
  const random = rng(SEED)
  const material = new MeshLambertMaterial({ vertexColors: true })
  const dummy = new Object3D()

  // ---- Positions in the band around the square play area (jittered grid) ----
  type Spot = { x: number; z: number; d: number }
  const spots: Spot[] = []
  for (let x = -BAND_OUTER; x <= BAND_OUTER; x += TREE_SPACING) {
    for (let z = -BAND_OUTER; z <= BAND_OUTER; z += TREE_SPACING) {
      const jx = x + (random() - 0.5) * TREE_SPACING * 0.8
      const jz = z + (random() - 0.5) * TREE_SPACING * 0.8
      const d = Math.max(Math.abs(jx), Math.abs(jz))
      if (d < BAND_INNER || d > BAND_OUTER) continue
      spots.push({ x: jx, z: jz, d })
    }
  }

  const pines: Spot[] = []
  const rounds: Spot[] = []
  const hills: Spot[] = []
  const rocks: Spot[] = []
  for (const s of spots) {
    const r = random()
    // Denser forest further out; some open patches with hills and rocks near the border.
    const empty = s.d < 36 ? 0.45 : 0.15
    if (r < empty) continue
    if (r < empty + 0.05) rocks.push(s)
    else if (r < empty + 0.09) hills.push(s)
    else if (random() < 0.55) pines.push(s)
    else rounds.push(s)
  }

  const place = (
    geo: BufferGeometry,
    list: Spot[],
    scale: (s: Spot) => [number, number, number],
    y = 0,
    shadow = true,
  ) => {
    const mesh = new InstancedMesh(geo, material, Math.max(1, list.length))
    list.forEach((s, i) => {
      dummy.position.set(s.x, y, s.z)
      dummy.rotation.set(0, random() * Math.PI * 2, 0)
      dummy.scale.set(...scale(s))
      dummy.updateMatrix()
      mesh.setMatrixAt(i, dummy.matrix)
    })
    mesh.count = list.length
    mesh.castShadow = shadow
    mesh.receiveShadow = !shadow
    scene.add(mesh)
  }

  place(pineGeometry(), pines, () => {
    const k = 0.8 + random() * 0.7
    return [k, k * (0.9 + random() * 0.4), k]
  })
  place(roundTreeGeometry(), rounds, () => {
    const k = 0.8 + random() * 0.6
    return [k, k, k]
  })
  place(
    painted(new IcosahedronGeometry(1, 1), COLORS.hill),
    hills,
    () => {
      const w = 2.5 + random() * 3
      return [w, 0.8 + random() * 1.4, w * (0.7 + random() * 0.6)]
    },
    -0.2,
    false,
  )
  place(painted(new DodecahedronGeometry(1, 0), COLORS.rock), rocks, () => {
    const k = 0.4 + random() * 0.9
    return [k, k * (0.6 + random() * 0.5), k]
  })

  // ---- Mountains far out (tall, so they show at the top of the screen near the edges) ----
  const peaks: Spot[] = []
  for (let i = 0; i < MOUNTAINS; i++) {
    const a = (i / MOUNTAINS) * Math.PI * 2 + (random() - 0.5) * 0.25
    const d = MOUNTAIN_DIST.min + random() * (MOUNTAIN_DIST.max - MOUNTAIN_DIST.min)
    peaks.push({ x: Math.cos(a) * d, z: Math.sin(a) * d, d })
  }
  place(
    mountainGeometry(),
    peaks,
    () => {
      const w = 14 + random() * 10
      return [w, 16 + random() * 14, w]
    },
    -0.5,
    false,
  )
}
