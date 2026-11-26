# DESIGN.md — game memory

Source of truth for ideas and decisions. Every new idea goes here, with a status. Written to work in any tool or AI, with no dependence on a prior conversation.

Status: **[decided]** final · **[provisional]** guess until tested · **[idea]** still being developed · **[open]** not decided yet.

## Vision

- [decided] Mobile survivors-like with auto-shoot, CoD Zombies-style rounds, a weapon Mystery Box, and cards as upgrades. No battle royale.
- [decided] Android first, offline in v1. Fun first; monetization later.
- [decided] A functional, testable game first. Content and balancing come later, by playing.

## Visuals and camera

- [decided] 3D with a tilted top-down camera, Brawl Stars level: low-poly cartoon characters, flat colors, clear readability.
- [decided] Game logic stays **2D on the (x, z) plane**. Only rendering is 3D. This keeps the simulation simple and performance predictable.
- [provisional] Perspective camera tilted ~55-60°, following the player.
- [provisional] Simple shadows (blob/disc under the character, no shadow maps), few textures (color palette), `InstancedMesh` for hordes, simple animation (bob/squash) before skeletal animation.
- [provisional] Character size: height ~1.0-1.15, width ~0.85-1.0 (chunky, readable from above), collision radius ~0.45 (matches the visual width). Common zombies the same size or slightly smaller; special ones bigger (1.3-2.0) to be recognizable from afar.
- [decided] Blender models: 1 unit = 1 m, origin at the feet (center of the base), facing forward (+Z in Three.js after glTF export).
- [decided] Start with **placeholders** (colored capsules and cubes). Swap in real models later: CC0 packs (Kenney, Quaternius) or custom Blender models.
- Biggest project risk: 3D art and animation cost. Real models only come in once the game loop is already fun with placeholders.

## Stack and commands

- [decided] Bun + Vite + TypeScript + **Three.js** + Capacitor (Android). (Replaces PixiJS from the initial 2D idea.)
- Always `bun`, `bun add`, `bunx`. Never npm.
- Code identifiers in English. Files and docs in English. The user chats in Portuguese.
- Tests with `bun test`. Typecheck before calling a phase done.

## Architecture

```
src/
  core/      pure simulation (no Three, no DOM)
  data/      weapons, cards, characters, enemies, difficulties, modes, crates, rarityTable
  systems/   movement, targeting, weapons, projectiles, collision, damage, spawn, roundDirector, box, cards
  render/    Three.js only draws the simulation state
  ui/        menus, HUD and cards in DOM/CSS
  meta/      save, wallet, skins, unlocks
  dev/       debug overlay, dev panel, run export
```

- [decided] `core/` imports neither Three nor DOM. Fixed timestep at 60 Hz. Seeded RNG (mulberry32). `Math.random` is forbidden in core.
- [decided] Record the run's input log (seed + inputs) for replay, bug reproduction, ranking validation and future co-op.
- [decided] Content and balancing live in `data/` (JSON/TS), never hardcoded in systems.
- [decided] Performance: object pooling, spatial hash for collision (circle vs circle, no physics engine), zero allocation inside the loop, DPR capped at 2.
- [provisional] Budget: ~150 MB RAM, ~120 active enemies, few draw calls, low triangle count per zombie. Measure on device.
- [decided] Menus and HUD in DOM/CSS. World in Three.
- [decided] Save in IndexedDB or Capacitor Preferences (not localStorage), with a `version` field and migrations.
- [decided] Separate the definition of a card/skin/character (data) from what the player owns (list of ids in the save).

## Gameplay

- [decided] Virtual joystick on the left (WASD/arrows on PC). Auto-shoot with no fire button (important in later rounds).
- [provisional] Manual aim, twin-stick, for testing: right virtual joystick aims on mobile, mouse aims on PC. Fire stays automatic (no button) toward the aim; releasing the right stick keeps the last aim. Movement does not change the aim. (Replaces "shoot where you move", which made fleeing shoot away from the horde and felt too hard.)
- [decided] Each weapon has a `targeting`; cards can improve/change it.
- [idea] Settings option to choose the aim mode: manual (twin-stick/mouse) or aim lock (`nearest`: auto-aim at the closest zombie). Also possibly automatic vs manual fire (fire button). Details open.
- [provisional] A round ends when all zombies are dead. If the player takes too long, a time limit passes and more zombies start spawning.
- [decided] Between rounds: use the box, sell cards.
- [decided] Kills give **points** (spent on the Mystery Box) and **XP** (level up, pick 1 of 3 cards).

### Mystery Box (in-run)

- [decided] Costs points, appears at a random spot on the map, rolls a weapon by rarity.
- [decided] The player carries 2 weapons; picking up a new one replaces one.
- [decided] "Teddy bear" chance: the box moves to another spot and the player loses the points.
- The end-of-run reward is called a **Reward Crate**, to avoid confusion.

## Characters

Overall status: [idea] in development. More characters to come.

- **Soldier:** better with rifles and machine guns. +5% fire rate with those weapons. [provisional, 5% is small; tune by playing]
- **Huntress:** better with shotguns. Deals extra damage to some enemy type that appears. [open: which enemy type]
- **Ninja:** better with melee weapons. [open: exact bonus]

Design notes (suggestions, not decided yet):

- A character's bonus uses the same `Effect` system with `requiresTag` as cards.
- Each character gets a starting weapon of their type, and a higher weight (~1.5x) in the Mystery Box roll for their type, so the random box doesn't punish specialists.
- Melee weapons need a new weapon type (automatic area attack or short strike on the nearest enemy). Extra scope: comes after the Mystery Box.
- Characters are **unlocks** (e.g. defeat a boss in Story, Reward Crate), never purchased power.
- v1: only 1 character.

```ts
type Character = {
  id: string
  startingWeapon: string
  passives: Effect[] // e.g. { stat: 'fireRate', op: 'increased', value: 0.05, requiresTag: 'rifle' }
}
```

## Cards and build

- [decided] 5 slots. Unique cards: the same card never takes two slots.
- [decided] If the same card drops again, it goes up one tier instead of taking another slot. A card at max tier no longer shows up in offers.
- [decided] Tiers: `common`, `rare`, `epic`, `legendary`, `mystic`. Mystic does not upgrade by duplicates: it only drops by roll.
- [decided] Selling a card gives points for the Mystery Box.
- [decided] Cards have tags (`fire`, `pierce`, `crit`, `shotgun`, ...). Effects can require a tag (`requiresTag`). Combos between cards and weapons are the heart of the game; broken builds are desired, within the caps.
- [decided] `increased` adds with other `increased`; `more` multiplies (careful: it creates the broken builds).
- [decided] Cap per stat (e.g. `fireRate` max 3x base) with diminishing returns. Higher cap in Infinity.
- [decided] Special effects via events: `onKill`, `onCrit`, `onHit`. Recompute stats only when the build changes.

```ts
type Tier = 'common' | 'rare' | 'epic' | 'legendary' | 'mystic'
type Effect = {
  stat: string
  op: 'add' | 'increased' | 'more'
  value: number
  requiresTag?: string
}
type Card = {
  id: string
  tags: string[]
  tiers: Partial<Record<Tier, Effect[]>>
}
type Build = Map<string, Tier> // cardId -> tier
```

## Rarity and difficulty

Everything in `data/difficulties.ts`. [provisional] All numbers are guesses until the game runs.

- [provisional] Chances are **per offer** (probability that the 3-card offer includes a card of that rarity), not per slot. Per slot would give ~39% mystic per level up at 15%.
- Rarity also rises with the round: a ramp up to round 100, and after 100 it grows a little every 50 rounds (e.g. +0.03 to +0.05), with a high max cap (e.g. 0.6).
- The round where the ramp ends can differ per difficulty.

```ts
const difficulties = {
  easy:     { epic: 0.30, legendary: 0,    mystic: 0,    enemyGrowth: 1.05 },
  medium:   { epic: 0.30, legendary: 0.10, mystic: 0,    enemyGrowth: 1.06 },
  hard:     { epic: 0.30, legendary: 0.20, mystic: 0.05, enemyGrowth: 1.07 },
  veryHard: { epic: 0.30, legendary: 0.40, mystic: 0.15, enemyGrowth: 1.09 },
}

function rarityChance(round: number, cap: number, d: Difficulty): number {
  const ramp = Math.min(1, round / 100)
  const extra = Math.floor(Math.max(0, round - 100) / 50) * d.extraPer50
  return Math.min(d.maxChance, cap * ramp + extra)
}
```

Enemies:

```ts
const count = Math.min(MAX_ON_SCREEN, 6 + round * 2) // scaling goes into HP, not quantity
const hp = baseHp * enemyGrowth ** round
```

- Higher difficulty gives better cards, but enemies grow faster (otherwise "very hard" becomes the easiest).
- Soften growth after some round, otherwise a wall appears around round 150-300.
- [open] How far should a very good player get on each difficulty? This defines the curve.
- Large numbers use compact notation.
- Infinity ranking is separate per difficulty.
- Whoever reaches round 1000 deserves it: prestige reward (exclusive skin/title), no power.

## Modes and rewards

- **Story:** missions and bosses. Defeating a boss gives their skin + a special card. Also coins and crates, same idea as Rush with its own rewards.
- **Rush (100 rounds):** coins + a store Reward Crate, the best one at ~1% chance (provisional). Suggestion: crate tier depends on the result (difficulty, round reached), and the 1% applies only to the rarest item inside it. [open: in-run rarity table in Rush; suggestion: fixed, up to `legendary`]
- **Infinity:** difficulty choice, the rarity ramp above, ranking per difficulty. The Reward Crate gets more special the further you go.

### Reward Crate (store)

- [decided] Defines what the player **unlocks**: cards, weapons, skins, characters. Meta-progression is unlocks only, never permanent power.
- [decided] A duplicate of something the player already owns becomes coins.
- [idea] Pity: after N crates without a rare item, the next one is guaranteed.
- [idea] Show the odds on the crate.
- v1: no real money, only in-game coins.

## Future (outside v1)

- [idea] Co-op with friends: Go server + WebSocket.
- [idea] Ranking of who got furthest, validated by replay (seed + inputs).
- [decided] Skins are cosmetic only. Paid cards with power in the future: try to keep it as level as possible between buyers and non-buyers.
- [idea] Marketplace, if it exists, cosmetics only. Cards exist only inside the run; they are not items the player owns.
- Crates paid with real money have their own rules (including in Brazil). Check before any monetization.

## Testing and debug tools (part of the game from the start)

- [decided] `?debug=1` (or a dev build) turns on an overlay with FPS, entity count, round, stats and current build.
- [decided] Dev panel with: jump to round N, give card X at tier Y, give weapon, spawn zombie, god mode, game speed (0.5x / 2x / 5x), a bot that plays by itself.
- [decided] "Copy run" button: copies seed + input log + round + build to the clipboard. Pasting this in a chat reproduces the exact bug.

## How to test

1. **Browser in mobile mode** (`bun run dev`, DevTools device emulation): fast iteration on logic and visuals.
2. **Real phone over USB** (`bunx cap run android`, USB debugging on): the test that counts for performance.
3. **Android Studio emulator** (AVD): good for screen sizes and app flow. Does not represent real WebGL performance; don't use it to decide if the game is light enough.

After changing code: `bun run build` and `bunx cap sync android`.

When reporting a problem: say what was expected, what happened, and use "copy run".

## Open decisions

- Game name, exact art style, theme/universe.
- Round: timer vs kill-all (assumed: kill-all + time limit).
- Initial list of weapons, cards and enemies.
- Character details (bonuses, the huntress's enemy type, melee weapon).
- Enemy curve after round ~100.
- In-run rarity in Rush.
- Chances per offer vs per slot (assumed: per offer).
- Screen orientation: portrait vs landscape (today it follows the phone rotation).
- Aim mode in settings: manual vs aim lock as the default; manual fire button or not.

## Planned phases

1. **Milestone 1 (functional game):** 3D scene with tilted top-down camera, player (capsule) with virtual joystick, auto-shoot, zombies (placeholders) coming from off-screen, health and damage, death and restart. Debug overlay and dev panel. Running in the browser in mobile mode and on phone/emulator. No menus, no cards. Criteria: 60 fps with ~100 zombies on a mid-range phone, `core/` testable with `bun test`.
2. Rounds and spawn director.
3. Cards and modifiers (5 slots, tiers, level up).
4. Mystery Box and 2 weapon slots.
5. Characters.
6. Modes (Story, Rush, Infinity) and difficulties.
7. Meta: save, store, Reward Crates, skins.
8. Real 3D models and visual polish.
