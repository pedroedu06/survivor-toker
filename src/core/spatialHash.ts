/**
 * Uniform grid over the square arena for circle-vs-circle broad phase.
 * Linked lists in typed arrays: zero allocation after creation.
 */
export type SpatialHash = {
  clear(): void
  /** Inserts item `index` (0..capacity-1) at (x, z). Points outside the arena go to the edge cell. */
  insert(index: number, x: number, z: number): void
  /**
   * Writes into `out` the items in cells touching the square around (x, z) with half-side `radius`.
   * Candidates only: callers still check the real distance. Returns how many were written.
   */
  query(x: number, z: number, radius: number, out: Int32Array): number
}

export function createSpatialHash(
  halfSize: number,
  cellSize: number,
  capacity: number,
): SpatialHash {
  const cols = Math.max(1, Math.ceil((halfSize * 2) / cellSize))
  const cellHead = new Int32Array(cols * cols).fill(-1)
  const next = new Int32Array(capacity).fill(-1)

  const cellCoord = (v: number): number => {
    const c = Math.floor((v + halfSize) / cellSize)
    return c < 0 ? 0 : c >= cols ? cols - 1 : c
  }

  return {
    clear() {
      cellHead.fill(-1)
    },
    insert(index, x, z) {
      const cell = cellCoord(z) * cols + cellCoord(x)
      next[index] = cellHead[cell] ?? -1
      cellHead[cell] = index
    },
    query(x, z, radius, out) {
      const minX = cellCoord(x - radius)
      const maxX = cellCoord(x + radius)
      const minZ = cellCoord(z - radius)
      const maxZ = cellCoord(z + radius)
      let count = 0
      for (let cz = minZ; cz <= maxZ; cz++) {
        for (let cx = minX; cx <= maxX; cx++) {
          let i = cellHead[cz * cols + cx] ?? -1
          while (i !== -1) {
            if (count >= out.length) return count
            out[count++] = i
            i = next[i] ?? -1
          }
        }
      }
      return count
    },
  }
}
