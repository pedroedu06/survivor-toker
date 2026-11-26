# Zombie Survivors-like (working title)

Mobile game: survivors-like with auto-shoot, CoD Zombies-style rounds, a weapon Mystery Box, cards as upgrades, 3D with a tilted top-down camera. Android first, offline in v1.

The full memory of ideas and decisions is in `DESIGN.md`. Before implementing any system, read its relevant section.

## Current phase

**Milestone 1** (see "Planned phases" in `DESIGN.md`). Update this line when the phase changes.

## Stack and commands

- Bun + Vite + TypeScript + Three.js + Capacitor (Android).
- Always `bun`, `bun add`, `bunx`. Never npm.
- Code identifiers and files in English. The user chats in Portuguese: reply in Portuguese in chat, but keep files and code in English.
- `bun test` for tests. Run typecheck before calling a phase done.

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
