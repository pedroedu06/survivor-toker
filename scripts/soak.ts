/**
 * Soak test: the bot plays many seeds at full speed, with random shop/dev commands mixed in,
 * and the invariants are checked EVERY step. A failure prints the seed/tick and saves the
 * run to runs/soak-<seed>.txt (replay it with `bun run replay`).
 *   bun run soak [seeds=10] [minutes=5]
 */
import { mkdir } from 'node:fs/promises'
import { soakRun } from '../src/dev/soak'

const seeds = Number(process.argv[2] ?? 10)
const minutes = Number(process.argv[3] ?? 5)

let failed = 0
const started = performance.now()
for (let seed = 1; seed <= seeds; seed++) {
  const result = soakRun(seed, minutes * 60 * 60)
  const r = result.world.round
  const line = `seed ${seed}: round ${r.number} (${r.phase}) · kills ${result.world.kills} · coins ${result.world.coins}`
  if (!result.problem) {
    console.log(`ok   ${line}`)
    continue
  }
  failed++
  console.log(`FAIL ${line}`)
  console.log(`     tick ${result.problem.tick}: ${result.problem.problems.join(' | ')}`)
  await mkdir('runs', { recursive: true })
  const file = `runs/soak-${seed}.txt`
  await Bun.write(file, result.runText)
  console.log(`     saved ${file} (bun run replay ${file})`)
}

const secs = ((performance.now() - started) / 1000).toFixed(1)
console.log(`\n${seeds - failed}/${seeds} seeds ok · ${minutes} min of play each · ${secs} s`)
process.exit(failed ? 1 : 0)
