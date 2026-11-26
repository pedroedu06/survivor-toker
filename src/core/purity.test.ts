import { describe, expect, test } from 'bun:test'
import { Glob } from 'bun'

/**
 * Guards the simulation rules from CLAUDE.md: `core/`, `systems/` and `data/` are pure.
 * No Three.js, no DOM, no Math.random (use the seeded RNG).
 */
const PURE_DIRS = ['core', 'systems', 'data']

const FORBIDDEN: Array<[RegExp, string]> = [
  [/Math\.random\s*\(/, 'Math.random (use createRng from core/rng)'],
  [/from\s+['"]three/, 'three import'],
  [/from\s+['"]\.\.\/(render|ui|dev|meta)\//, 'import from a non-pure folder'],
  [/\b(window|document|navigator|localStorage|requestAnimationFrame)\b/, 'DOM/browser global'],
]

describe('simulation purity', () => {
  test('core/, systems/ and data/ use no Math.random, Three.js or DOM', async () => {
    const violations: string[] = []
    const src = `${import.meta.dir}/..`
    for (const dir of PURE_DIRS) {
      for await (const file of new Glob('**/*.ts').scan(`${src}/${dir}`)) {
        if (file.endsWith('.test.ts')) continue
        const lines = (await Bun.file(`${src}/${dir}/${file}`).text()).split('\n')
        lines.forEach((line, i) => {
          const t = line.trim()
          if (t.startsWith('//') || t.startsWith('*') || t.startsWith('/*')) return
          for (const [pattern, label] of FORBIDDEN) {
            if (pattern.test(line)) violations.push(`${dir}/${file}:${i + 1} ${label}`)
          }
        })
      }
    }
    expect(violations).toEqual([])
  })
})
