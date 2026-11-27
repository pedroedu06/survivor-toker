import { describe, expect, test } from 'bun:test'
import { createInputState } from './input'
import {
  createInputPlayback,
  createInputRecorder,
  formatRunText,
  parseRunText,
  quantizeInput,
} from './inputLog'

describe('quantizeInput', () => {
  test('movement in 0.05 steps, aim as a 3-decimal unit vector', () => {
    const input = { ...createInputState(), moveX: 0.333, moveZ: -0.71, aimX: 3, aimZ: 4 }
    quantizeInput(input)
    expect(input.moveX).toBeCloseTo(0.35)
    expect(input.moveZ).toBeCloseTo(-0.7)
    expect(input.aimX).toBe(0.6)
    expect(input.aimZ).toBe(0.8)
  })

  test('no aim stays no aim', () => {
    const input = createInputState()
    quantizeInput(input)
    expect([input.aimX, input.aimZ]).toEqual([0, 0])
  })
})

describe('recorder + playback', () => {
  test('stores only changes and plays back the same inputs every tick', () => {
    const rec = createInputRecorder(7)
    const seen: string[] = []
    const input = createInputState()
    for (let t = 0; t < 100; t++) {
      input.moveX = t < 50 ? 1 : 0
      input.aimX = t < 30 ? 0 : 1
      input.buyItem = t === 40 ? 'shield' : ''
      input.dev = t === 60 ? 'coins:5' : ''
      rec.record(t, input)
      seen.push(JSON.stringify(input))
    }
    const log = rec.export(100, 'abc', 'test')
    expect(log.n.length).toBe(3 * 5) // t=0, t=30, t=50
    expect(log.c.length).toBe(2)

    const play = createInputPlayback(log)
    const out = createInputState()
    for (let t = 0; t < 100; t++) {
      play.read(t, out)
      expect(JSON.stringify(out)).toBe(seen[t] as string)
    }
  })

  test('run text round-trips', () => {
    const rec = createInputRecorder(42)
    rec.record(0, { ...createInputState(), moveX: 1 })
    const log = rec.export(10, 'deadbeef', 'test')
    const text = formatRunText(log, ['rodada 1', 'invariantes: ok'])
    expect(text.startsWith('SURVIVOR-RUN v2')).toBe(true)
    expect(parseRunText(text)).toEqual(log)
  })

  test('garbage text is rejected', () => {
    expect(() => parseRunText('hello')).toThrow()
    expect(() => parseRunText('{"v":2}')).toThrow()
  })
})
