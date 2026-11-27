import { describe, expect, test } from 'bun:test'
import { activePointCount, testArena } from './maps'

describe('testArena', () => {
  test('has the 4 cardinal spawn points', () => {
    expect(testArena.spawnPoints.map((p) => p.id)).toEqual(['north', 'south', 'east', 'west'])
  })

  test('spawn points are inside the map, away from the walls', () => {
    for (const p of testArena.spawnPoints) {
      const d = Math.hypot(p.x, p.z)
      expect(d + testArena.spawnSpread).toBeLessThan(testArena.halfSize)
      expect(d).toBeLessThanOrEqual(testArena.halfSize * 0.9)
    }
  })

  test('active point count never goes outside 1..points', () => {
    expect(activePointCount(testArena, 0)).toBe(1)
    expect(activePointCount(testArena, 1000)).toBe(4)
  })
})
