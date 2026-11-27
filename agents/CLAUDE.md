# Zombie Survivors-like (working title)

Mobile game: survivors-like with auto-shoot, CoD Zombies-style rounds, a weapon Mystery Box, cards as upgrades, 3D with a tilted top-down camera. Android first, offline in v1.

The full memory of ideas and decisions is in `DESIGN.md`. The 3D model standard (template, rig, animations, weapons, export) is in `MODELS.md`: read it before touching any model. The map standard (scale, axes, spawn empties, collision, export) is in `MAPS.md`. Before implementing any system, read its relevant section.

## Current phase

**Milestone 1** (see "Planned phases" in `DESIGN.md`), with **phase 2 (rounds)**, a first **shop** and the **start map** (`start_base` = Forest: destructible base, doors, turrets, hiding in trees) brought forward at the user's request. Next: the player model (trooper). Milestone 1 tools are in (dev panel, copy run/replay, soak, perf test, pause). Still pending to close Milestone 1: the performance result on a real mid-range phone (60 fps with ~100 zombies). Update this line when the phase changes.

## Stack and commands

- Bun + Vite + TypeScript + Three.js + Capacitor (Android).
- Always `bun`, `bun add`, `bunx`. Never npm.
- Code identifiers and files in English. The user chats in Portuguese: reply in Portuguese in chat, but keep files and code in English.
- `bun test` for tests. Run typecheck before calling a phase done.
- `bun run soak [seeds] [minutes]`: bot + random commands with invariants every step. Run it after changing gameplay systems.
- `bun run import-map <id>`: after the user re-exports a map `.glb`, regenerates `src/data/maps/<id>.gen.ts` (see `MAPS.md`).
- A run pasted by the user ("SURVIVOR-RUN v1/v2 ..."): save it to `runs/<name>.txt` and run `bun run replay runs/<name>.txt` to reproduce it headless (final state, checksum, first invariant failure).

## Determinism (needed for replays)

- Anything that changes the game goes through `InputState` (including dev/cheat commands, `systems/dev.ts`). Never mutate the world from the UI.
- Inputs are quantized (`quantizeInput`) before the simulation sees them; the recorder logs what was simulated.
- New world state must be reset in `resetWorld` (otherwise "play again" leaks state and replays diverge).

## Rules

- `core/` is pure simulation (no Three, no DOM), fixed 60 Hz timestep, seeded RNG. No `Math.random` in core.
- Content and balancing live in `data/`, never hardcoded in systems.
- No allocation inside the loop; object pooling; collision with a spatial hash.
- Menus and HUD in DOM/CSS. World in Three.js. 2D logic on the (x, z) plane.
- Start with placeholders (capsules/cubes). Don't spend time on 3D art before the loop is fun.

## How to work

- Only implement what belongs to the current phase. Don't build features from future phases.
- Decisions in `DESIGN.md` don't change without asking. If the user brings a new idea, record it in `DESIGN.md` with a status before implementing it.
- Test in the browser in mobile mode and, when closing the phase, on a real phone.
