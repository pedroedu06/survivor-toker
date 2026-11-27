import { describe, expect, test } from 'bun:test'
import { buildMapSource, mapPaths } from './importMap'

describe('imported maps are in sync with the .glb', () => {
  test('start_base: run `bun run import-map start_base` if this fails', async () => {
    const p = mapPaths('start_base')
    const glb = new Uint8Array(await Bun.file(p.glb).arrayBuffer())
    const expected = buildMapSource(glb, p.exportName, p.sourceName)
    expect(await Bun.file(p.out).text()).toBe(expected)
  })
})
