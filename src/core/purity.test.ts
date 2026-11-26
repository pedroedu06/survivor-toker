import { describe, expect, test } from 'bun:test'
import { Glob } from 'bun'

/**
 * Guards the core rules from CLAUDE.md: `core/` is pure simulation.
 * No Three.js, no DOM, no Math.random (use the seeded RNG).
 */
const FORBIDDEN: Array<[RegExp, string]> = [
  [/Math\.random\s*\(/, 'Math.random (use createRng from core/rng)'],
  [/from\s+['"]three/, 'three import'],
  [/\b(window|document|navigator|localStorage|requestAnimationFrame)\b/, 'DOM/browser global'],
]

describe('core purity', () => {
  test('core/ uses no Math.random, Three.js or DOM', async () => {
    const violations: string[] = []
    const dir = `${import.meta.dir}`
    for await (const file of new Glob('**/*.ts').scan(dir)) {
      if (file.endsWith('.test.ts')) continue
      const lines = (await Bun.file(`${dir}/${file}`).text()).split('\n')
      lines.forEach((line, i) => {
        if (line.trim().startsWith('//') || line.trim().startsWith('*')) return
        for (const [pattern, label] of FORBIDDEN) {
          if (pattern.test(line)) violations.push(`core/${file}:${i + 1} ${label}`)
        }
      })
    }
    expect(violations).toEqual([])
  })
})
