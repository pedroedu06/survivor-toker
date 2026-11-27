/**
 * Minimal read-only .glb reader for build scripts (no Three.js): nodes with world-space
 * transforms (Y-up, as Three.js sees them) and mesh positions/indices.
 */

export type GlbNode = {
  name: string
  /** Translation, rotation quaternion (x, y, z, w) and scale, composed with the parents. */
  t: [number, number, number]
  q: [number, number, number, number]
  s: [number, number, number]
  extras: Record<string, unknown> | undefined
  /** Mesh triangles in world space as flat xyz triples (undefined for empties). */
  triangles?: Float64Array
  /** Local-space bounding box of the mesh (POSITION min/max), if any. */
  localMin?: [number, number, number]
  localMax?: [number, number, number]
}

type Json = {
  nodes?: Array<{
    name?: string
    mesh?: number
    children?: number[]
    translation?: number[]
    rotation?: number[]
    scale?: number[]
    extras?: Record<string, unknown>
  }>
  meshes?: Array<{ primitives: Array<{ attributes: Record<string, number>; indices?: number }> }>
  accessors?: Array<{
    bufferView: number
    byteOffset?: number
    componentType: number
    count: number
    type: string
    min?: number[]
    max?: number[]
  }>
  bufferViews?: Array<{ byteOffset?: number; byteLength: number; byteStride?: number }>
}

const COMPONENTS: Record<string, number> = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT4: 16 }

type Vec3 = [number, number, number]
type Quat = [number, number, number, number]

function quatMul(a: Quat, b: Quat): Quat {
  return [
    a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1],
    a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0],
    a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3],
    a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2],
  ]
}

export function rotate(q: Quat, v: Vec3): Vec3 {
  const [x, y, z, w] = q
  // v' = v + 2w(q x v) + 2 q x (q x v)
  const cx = y * v[2] - z * v[1]
  const cy = z * v[0] - x * v[2]
  const cz = x * v[1] - y * v[0]
  const ccx = y * cz - z * cy
  const ccy = z * cx - x * cz
  const ccz = x * cy - y * cx
  return [v[0] + 2 * (w * cx + ccx), v[1] + 2 * (w * cy + ccy), v[2] + 2 * (w * cz + ccz)]
}

export function readGlb(bytes: Uint8Array): GlbNode[] {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  if (view.getUint32(0, true) !== 0x46546c67) throw new Error('not a .glb file')
  const jsonLen = view.getUint32(12, true)
  const json = JSON.parse(new TextDecoder().decode(bytes.subarray(20, 20 + jsonLen))) as Json
  const binStart = 20 + jsonLen + 8
  const bin = bytes.subarray(binStart)
  const binView = new DataView(bin.buffer, bin.byteOffset, bin.byteLength)

  const readAccessor = (index: number): number[] => {
    const a = json.accessors?.[index]
    if (!a) throw new Error(`accessor ${index} missing`)
    const bv = json.bufferViews?.[a.bufferView]
    if (!bv) throw new Error(`bufferView ${a.bufferView} missing`)
    const n = COMPONENTS[a.type] ?? 1
    const size =
      a.componentType === 5126 || a.componentType === 5125 ? 4 : a.componentType === 5123 ? 2 : 1
    const stride = bv.byteStride ?? n * size
    const base = (bv.byteOffset ?? 0) + (a.byteOffset ?? 0)
    const out: number[] = []
    for (let i = 0; i < a.count; i++) {
      for (let c = 0; c < n; c++) {
        const off = base + i * stride + c * size
        if (a.componentType === 5126) out.push(binView.getFloat32(off, true))
        else if (a.componentType === 5125) out.push(binView.getUint32(off, true))
        else if (a.componentType === 5123) out.push(binView.getUint16(off, true))
        else out.push(binView.getUint8(off))
      }
    }
    return out
  }

  const nodes = json.nodes ?? []
  const result: GlbNode[] = []
  const visit = (index: number, pt: Vec3, pq: Quat, ps: Vec3) => {
    const n = nodes[index]
    if (!n) return
    const lt = (n.translation ?? [0, 0, 0]) as Vec3
    const lq = (n.rotation ?? [0, 0, 0, 1]) as Quat
    const ls = (n.scale ?? [1, 1, 1]) as Vec3
    const st: Vec3 = [lt[0] * ps[0], lt[1] * ps[1], lt[2] * ps[2]]
    const rt = rotate(pq, st)
    const t: Vec3 = [pt[0] + rt[0], pt[1] + rt[1], pt[2] + rt[2]]
    const q = quatMul(pq, lq)
    const s: Vec3 = [ps[0] * ls[0], ps[1] * ls[1], ps[2] * ls[2]]
    const node: GlbNode = { name: n.name ?? `node${index}`, t, q, s, extras: n.extras }

    if (n.mesh !== undefined) {
      const mesh = json.meshes?.[n.mesh]
      const tris: number[] = []
      let min: Vec3 = [Infinity, Infinity, Infinity]
      let max: Vec3 = [-Infinity, -Infinity, -Infinity]
      for (const prim of mesh?.primitives ?? []) {
        const posIndex = prim.attributes.POSITION
        if (posIndex === undefined) continue
        const acc = json.accessors?.[posIndex]
        if (acc?.min && acc.max) {
          min = [
            Math.min(min[0], acc.min[0] ?? 0),
            Math.min(min[1], acc.min[1] ?? 0),
            Math.min(min[2], acc.min[2] ?? 0),
          ]
          max = [
            Math.max(max[0], acc.max[0] ?? 0),
            Math.max(max[1], acc.max[1] ?? 0),
            Math.max(max[2], acc.max[2] ?? 0),
          ]
        }
        const pos = readAccessor(posIndex)
        const idx =
          prim.indices !== undefined
            ? readAccessor(prim.indices)
            : Array.from({ length: pos.length / 3 }, (_, i) => i)
        for (const vi of idx) {
          const local: Vec3 = [
            (pos[vi * 3] ?? 0) * s[0],
            (pos[vi * 3 + 1] ?? 0) * s[1],
            (pos[vi * 3 + 2] ?? 0) * s[2],
          ]
          const w = rotate(q, local)
          tris.push(w[0] + t[0], w[1] + t[1], w[2] + t[2])
        }
      }
      node.triangles = Float64Array.from(tris)
      node.localMin = min
      node.localMax = max
    }
    result.push(node)
    for (const c of n.children ?? []) visit(c, t, q, s)
  }

  const childSet = new Set<number>()
  for (const n of nodes) for (const c of n.children ?? []) childSet.add(c)
  for (let i = 0; i < nodes.length; i++) {
    if (!childSet.has(i)) visit(i, [0, 0, 0], [0, 0, 0, 1], [1, 1, 1])
  }
  return result
}

/** Yaw (rotation about +Y, Three.js convention) of a quaternion that only rotates about Y. */
export function yawOf(q: Quat): number {
  // Rotating local +X gives (cos(yaw), 0, -sin(yaw)).
  const v = rotate(q, [1, 0, 0])
  return Math.atan2(-v[2], v[0])
}
