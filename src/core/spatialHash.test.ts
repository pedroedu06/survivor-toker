import { describe, expect, test } from 'bun:test'
import { createSpatialHash } from './spatialHash'

describe('createSpatialHash', () => {
  const out = new Int32Array(64)
  const found = (n: number) => [...out.subarray(0, n)].sort((a, b) => a - b)

  test('finds items in nearby cells and skips far ones', () => {
    const hash = createSpatialHash(30, 2, 16)
    hash.insert(0, 0, 0)
    hash.insert(1, 1, 1)
    hash.insert(2, 20, 20)
    expect(found(hash.query(0.5, 0.5, 1, out))).toEqual([0, 1])
    expect(found(hash.query(20, 20, 1, out))).toEqual([2])
  })

  test('never returns the same item twice', () => {
    const hash = createSpatialHash(30, 2, 16)
    for (let i = 0; i < 10; i++) hash.insert(i, i * 0.3, 0)
    const n = hash.query(1.5, 0, 5, out)
    expect(new Set(found(n)).size).toBe(n)
    expect(n).toBe(10)
  })

  test('clear() empties the grid', () => {
    const hash = createSpatialHash(30, 2, 16)
    hash.insert(0, 0, 0)
    hash.clear()
    expect(hash.query(0, 0, 2, out)).toBe(0)
  })

  test('points outside the arena go to edge cells instead of crashing', () => {
    const hash = createSpatialHash(10, 2, 4)
    hash.insert(0, 999, -999)
    expect(found(hash.query(10, -10, 1, out))).toEqual([0])
  })

  test('stops at the output buffer size', () => {
    const hash = createSpatialHash(30, 2, 16)
    for (let i = 0; i < 16; i++) hash.insert(i, 0, 0)
    expect(hash.query(0, 0, 1, new Int32Array(4))).toBe(4)
  })
})
