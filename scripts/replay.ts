/**
 * Replays a run copied from the game ("Copiar run") without a screen.
 *   bun run replay path/to/run.txt
 * Prints the final state, whether it matches the recorded checksum, and the first
 * invariant failure (checked every step).
 */
import { parseRunText } from '../src/core/inputLog'
import { replayRun } from '../src/core/replay'

const path = process.argv[2]
if (!path) {
  console.error('Usage: bun run replay <run.txt>')
  process.exit(2)
}

const log = parseRunText(await Bun.file(path).text())
const started = performance.now()
const { world, checksum, matches, firstProblem } = replayRun(log, 1)
const ms = performance.now() - started

const r = world.round
console.log(
  `seed ${log.seed} · build ${log.build} · ${log.ticks} ticks (${(log.ticks / 60).toFixed(1)} s of play) replayed in ${ms.toFixed(0)} ms`,
)
console.log(
  `final: round ${r.number} (${r.phase}${r.failReason ? `: ${r.failReason}` : ''}) · kills ${world.kills} · coins ${world.coins} · hp ${world.player.hp.toFixed(0)} · shield ${world.player.shield.toFixed(0)} · zombies ${world.activeEnemies}`,
)
console.log(
  matches
    ? `checksum ${checksum}: MATCHES the recorded run`
    : `checksum ${checksum} vs recorded ${log.checksum}: DIFFERENT (engine float differences, or a non-determinism bug). Replay in the browser to confirm.`,
)
if (firstProblem) {
  console.log(`FIRST INVARIANT FAILURE at tick ${firstProblem.tick}:`)
  for (const p of firstProblem.problems) console.log(`  - ${p}`)
  process.exit(1)
}
console.log('invariants: ok')
