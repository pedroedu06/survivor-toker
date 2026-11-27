/**
 * Imports a Blender map (.glb, see agents/MAPS.md) into simulation data:
 *   bun run import-map start_base
 * writes src/data/maps/startBase.gen.ts (spawn points, obstacles, base slots, turret slots,
 * hiding grid). The game renders the .glb itself; the simulation only reads the generated data,
 * so tests, replays and the soak stay headless and deterministic.
 */
import { type GlbNode, readGlb, yawOf } from './glb'

/** Hiding grid cell size in meters (same as the navigation grid). */
export const HIDE_CELL = 0.5
/** Meshes that count as hiding spots: only bushes (trees do not hide the player). */
const HIDE_MESHES = /^bushes$/
/**
 * Canopy objects also contain the low bushes of the groves: their parts below this height
 * hide too (tree crowns start ~1.5 m up, so they never count).
 */
const CANOPY_MESHES = /^trees_canopy_/
const LOW_BUSH_MAX_Y = 1.3
const SPAWN_ORDER = ['north', 'south', 'east', 'west']

const r4 = (v: number) => {
  const x = Math.round(v * 10000) / 10000
  return Object.is(x, -0) ? 0 : x
}

type Box = { x: number; z: number; hx: number; hz: number; ux: number; uz: number }

function boxOf(n: GlbNode): Box {
  const min = n.localMin ?? [0, 0, 0]
  const max = n.localMax ?? [0, 0, 0]
  const yaw = yawOf(n.q)
  const ux = Math.cos(yaw)
  const uz = -Math.sin(yaw)
  // Local center (bbox middle), scaled, rotated into the world.
  const lcx = ((min[0] + max[0]) / 2) * n.s[0]
  const lcz = ((min[2] + max[2]) / 2) * n.s[2]
  return {
    x: r4(n.t[0] + lcx * ux - lcz * uz),
    z: r4(n.t[2] + lcx * uz + lcz * ux),
    hx: r4(((max[0] - min[0]) / 2) * Math.abs(n.s[0])),
    hz: r4(((max[2] - min[2]) / 2) * Math.abs(n.s[2])),
    ux: r4(ux),
    uz: r4(uz),
  }
}

function sideOfSlot(id: string): string {
  // wall_<side><n> -> side; door_<ns><ew> -> n or s (doors belong to the north/south walls).
  const rest = id.replace(/^(wall|door)_/, '')
  const side = rest[0]
  if (!side || !'nesw'.includes(side)) throw new Error(`cannot tell the side of slot ${id}`)
  return side
}

export function buildHideHex(nodes: GlbNode[], halfSize: number): { cells: number; hex: string } {
  const cells = Math.round((halfSize * 2) / HIDE_CELL)
  const bits = new Uint8Array(cells * cells)
  const mark = (x: number, z: number) => {
    const i = Math.floor((x + halfSize) / HIDE_CELL)
    const j = Math.floor((z + halfSize) / HIDE_CELL)
    if (i >= 0 && j >= 0 && i < cells && j < cells) bits[j * cells + i] = 1
  }
  for (const n of nodes) {
    const canopy = CANOPY_MESHES.test(n.name)
    if ((!HIDE_MESHES.test(n.name) && !canopy) || !n.triangles) continue
    const t = n.triangles
    const lowParts = canopy ? lowIslands(t) : null
    for (let k = 0; k + 8 < t.length; k += 9) {
      if (lowParts && !lowParts[k / 9]) continue
      const ax = t[k] ?? 0
      const az = t[k + 2] ?? 0
      const bx = t[k + 3] ?? 0
      const bz = t[k + 5] ?? 0
      const cx = t[k + 6] ?? 0
      const cz = t[k + 8] ?? 0
      mark(ax, az)
      mark(bx, bz)
      mark(cx, cz)
      const area = (bx - ax) * (cz - az) - (bz - az) * (cx - ax)
      if (Math.abs(area) < 1e-9) continue
      const i0 = Math.max(0, Math.floor((Math.min(ax, bx, cx) + halfSize) / HIDE_CELL))
      const i1 = Math.min(cells - 1, Math.floor((Math.max(ax, bx, cx) + halfSize) / HIDE_CELL))
      const j0 = Math.max(0, Math.floor((Math.min(az, bz, cz) + halfSize) / HIDE_CELL))
      const j1 = Math.min(cells - 1, Math.floor((Math.max(az, bz, cz) + halfSize) / HIDE_CELL))
      for (let j = j0; j <= j1; j++) {
        for (let i = i0; i <= i1; i++) {
          const px = -halfSize + (i + 0.5) * HIDE_CELL
          const pz = -halfSize + (j + 0.5) * HIDE_CELL
          const w0 = (bx - px) * (cz - pz) - (bz - pz) * (cx - px)
          const w1 = (cx - px) * (az - pz) - (cz - pz) * (ax - px)
          const w2 = (ax - px) * (bz - pz) - (az - pz) * (bx - px)
          const inside = area > 0 ? w0 >= 0 && w1 >= 0 && w2 >= 0 : w0 <= 0 && w1 <= 0 && w2 <= 0
          if (inside) bits[j * cells + i] = 1
        }
      }
    }
  }
  let hex = ''
  for (let d = 0; d * 4 < bits.length; d++) {
    let v = 0
    for (let b = 0; b < 4; b++) v |= (bits[d * 4 + b] ?? 0) << b
    hex += v.toString(16)
  }
  return { cells, hex }
}

/**
 * For each triangle: does it belong to a loose part (connected by shared vertices) whose
 * highest point is at most LOW_BUSH_MAX_Y? Those are the bushes inside the canopy objects.
 */
function lowIslands(t: Float64Array): Uint8Array {
  const triCount = t.length / 9
  const parent = new Int32Array(triCount).map((_, i) => i)
  const find = (i: number): number => {
    let r = i
    while (parent[r] !== r) r = parent[r] as number
    while (parent[i] !== r) {
      const next = parent[i] as number
      parent[i] = r
      i = next
    }
    return r
  }
  const owner = new Map<string, number>()
  for (let tri = 0; tri < triCount; tri++) {
    for (let v = 0; v < 3; v++) {
      const o = tri * 9 + v * 3
      const key = `${(t[o] ?? 0).toFixed(4)},${(t[o + 1] ?? 0).toFixed(4)},${(t[o + 2] ?? 0).toFixed(4)}`
      const other = owner.get(key)
      if (other === undefined) owner.set(key, tri)
      else parent[find(tri)] = find(other)
    }
  }
  const maxY = new Map<number, number>()
  for (let tri = 0; tri < triCount; tri++) {
    const root = find(tri)
    const y = Math.max(t[tri * 9 + 1] ?? 0, t[tri * 9 + 4] ?? 0, t[tri * 9 + 7] ?? 0)
    maxY.set(root, Math.max(maxY.get(root) ?? -Infinity, y))
  }
  const out = new Uint8Array(triCount)
  for (let tri = 0; tri < triCount; tri++) {
    out[tri] = (maxY.get(find(tri)) ?? Infinity) <= LOW_BUSH_MAX_Y ? 1 : 0
  }
  return out
}

/** Builds the TypeScript source of `data/maps/<id>.gen.ts` from a map .glb. */
export function buildMapSource(glb: Uint8Array, exportName: string, sourceName: string): string {
  const nodes = readGlb(glb)
  const byName = new Map(nodes.map((n) => [n.name, n]))

  // Play area from the boundary collision walls (inner faces).
  const bounds = nodes.filter((n) => /^col_wall_(north|south|east|west)$/.test(n.name))
  if (bounds.length !== 4) throw new Error('expected col_wall_north/south/east/west')
  let halfSize = Infinity
  for (const b of bounds) {
    const box = boxOf(b)
    const alongX = Math.abs(box.x) > Math.abs(box.z)
    const inner = alongX ? Math.abs(box.x) - box.hx : Math.abs(box.z) - box.hz
    halfSize = Math.min(halfSize, inner)
  }
  halfSize = r4(halfSize)

  const spawns = nodes
    .filter((n) => n.name.startsWith('spawn_'))
    .map((n) => ({ id: n.name.slice('spawn_'.length), x: r4(n.t[0]), z: r4(n.t[2]) }))
    .sort((a, b) => {
      const ia = SPAWN_ORDER.indexOf(a.id)
      const ib = SPAWN_ORDER.indexOf(b.id)
      return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib) || a.id.localeCompare(b.id)
    })
  if (spawns.length === 0) throw new Error('map has no spawn_* empties')

  const start = byName.get('player_start')
  const playerStart = { x: r4(start?.t[0] ?? 0), z: r4(start?.t[2] ?? 0) }

  const slots = nodes
    .filter((n) => /^(wall|door)_[nesw]/.test(n.name) && n.triangles)
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((n) => {
      const col = byName.get(`col_box_${n.name}`)
      if (!col) throw new Error(`slot ${n.name} has no col_box_${n.name}`)
      return {
        id: n.name,
        kind: n.name.startsWith('door_') ? 'door' : 'wall',
        side: sideOfSlot(n.name),
        box: boxOf(col),
        x: r4(n.t[0]),
        z: r4(n.t[2]),
        yaw: r4(yawOf(n.q)),
      }
    })
  const slotIds = new Set(slots.map((s) => s.id))

  const obstacles = nodes
    .filter((n) => n.name.startsWith('col_box_') && !slotIds.has(n.name.slice('col_box_'.length)))
    .sort((a, b) => a.name.localeCompare(b.name))
    .map(boxOf)

  const turretSlots = nodes
    .filter((n) => /^turret_slot_[nesw]$/.test(n.name))
    .sort((a, b) => 'nesw'.indexOf(a.name.slice(-1)) - 'nesw'.indexOf(b.name.slice(-1)))
    .map((n) => ({
      side: n.name.slice(-1),
      x: r4(n.t[0]),
      y: r4(n.t[1]),
      z: r4(n.t[2]),
      yaw: r4(yawOf(n.q)),
    }))

  const hide = buildHideHex(nodes, halfSize)

  const json = (v: unknown) =>
    JSON.stringify(v)
      .replace(/"(\w+)":/g, '$1: ')
      .replace(/"/g, "'")
  const lines = [
    `// Generated by \`bun run import-map\` from ${sourceName}. Do not edit by hand.`,
    "import type { MapDef } from '../maps'",
    '',
    `export const ${exportName}: Omit<MapDef, 'id' | 'spawnSpread' | 'activePoints'> = {`,
    `  halfSize: ${halfSize},`,
    `  spawnPoints: [`,
    ...spawns.map((s) => `    ${json(s)},`),
    `  ],`,
    `  playerStart: ${json(playerStart)},`,
    `  obstacles: [`,
    ...obstacles.map((o) => `    ${json(o)},`),
    `  ],`,
    `  slots: [`,
    ...slots.map((s) => `    ${json(s)},`),
    `  ],`,
    `  turretSlots: [`,
    ...turretSlots.map((t) => `    ${json(t)},`),
    `  ],`,
    `  hideGrid: {`,
    `    cellSize: ${HIDE_CELL},`,
    `    cells: ${hide.cells},`,
    `    hex:`,
    ...chunk(hide.hex, 90).map((c, i, all) => `      '${c}'${i < all.length - 1 ? ' +' : ','}`),
    `  },`,
    `}`,
    '',
  ]
  return lines.join('\n')
}

function chunk(s: string, size: number): string[] {
  const out: string[] = []
  for (let i = 0; i < s.length; i += size) out.push(s.slice(i, i + size))
  return out
}

export function camel(id: string): string {
  return id.replace(/_(\w)/g, (_, c: string) => c.toUpperCase())
}

export function mapPaths(id: string) {
  const root = `${import.meta.dir}/..`
  return {
    glb: `${root}/art/maps/${id}.glb`,
    out: `${root}/src/data/maps/${camel(id)}.gen.ts`,
    exportName: `${camel(id)}Data`,
    sourceName: `art/maps/${id}.glb`,
  }
}

if (import.meta.main) {
  const id = process.argv[2]
  if (!id) {
    console.error('usage: bun run import-map <map id>   (e.g. start_base)')
    process.exit(1)
  }
  const p = mapPaths(id)
  const glb = new Uint8Array(await Bun.file(p.glb).arrayBuffer())
  const source = buildMapSource(glb, p.exportName, p.sourceName)
  await Bun.write(p.out, source)
  console.log(`wrote ${p.out}`)
}
