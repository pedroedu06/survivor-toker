import { describe, expect, test } from 'bun:test'
import { createRng } from './rng'

describe('createRng', () => {
  test('same seed produces the same sequence', () => {
    const a = createRng(1234)
    const b = createRng(1234)
    for (let i = 0; i < 1000; i++) expect(a.next()).toBe(b.next())
  })

  test('different seeds produce different sequences', () => {
    const a = createRng(1)
    const b = createRng(2)
    const same = Array.from({ length: 10 }, () => a.next() === b.next()).every(Boolean)
    expect(same).toBe(false)
  })

  test('next() stays in [0, 1)', () => {
    const rng = createRng(42)
    for (let i = 0; i < 10_000; i++) {
      const v = rng.next()
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThan(1)
    }
  })

  test('int() is inclusive on both ends and stays in range', () => {
    const rng = createRng(7)
    const seen = new Set<number>()
    for (let i = 0; i < 2000; i++) {
      const v = rng.int(1, 3)
      expect(v).toBeGreaterThanOrEqual(1)
      expect(v).toBeLessThanOrEqual(3)
      seen.add(v)
    }
    expect([...seen].sort()).toEqual([1, 2, 3])
  })

  test('resuming from state() continues the same sequence', () => {
    const a = createRng(99)
    for (let i = 0; i < 50; i++) a.next()
    const b = createRng(a.state())
    for (let i = 0; i < 50; i++) expect(b.next()).toBe(a.next())
  })
})
