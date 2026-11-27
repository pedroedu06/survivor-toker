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
- [decided] **Base character template: "Trooper"** (`art/characters/trooper_base.blend` / `.glb`, previews in `art/previews/`). Every character, skin and enemy (zombies included) is built from this mold: big round egg head (~0.6 wide), small pear body, short tube arms and legs, round mitten hands, rounded boots, flat saturated colors. Face: oval black eyes with a highlight, slanted brows, thin arc mouth ("angry smile" for the soldier). Features are placed on the head surface (never sunk in). ~1.0 m tall, origin at the feet, facing -Y in Blender (+Z in Three.js). The current model is ~16.6k tris: decimate to ~5-6k before rigging/shipping.
- [decided] Weapons are separate models, **slightly more realistic** than the characters (still chunky and readable), origin at the grip, barrel forward, attached to a hand socket so a new weapon needs no new animation.
- [decided] Keep animation **simple** (standard rig with few bones; idle/walk/aim/hit/death, bob and squash). Rich cartoon animation is out of scope until there is a dedicated artist.
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
- [decided] **Landscape on phones.** The Android app is locked to landscape (`sensorLandscape`); in a mobile browser the game asks to rotate and pauses while upright.
- [decided] PC shortcuts (`ui/hotkeys.ts`): **H** shop, **F** skip intermission, **1/2/3** potions (health, speed, damage), **Esc/P** pause. Key hints show on the buttons only on devices with a mouse.
- [provisional] Manual aim, twin-stick, for testing: right virtual joystick aims on mobile, mouse aims on PC. Fire stays automatic (no button) toward the aim; releasing the right stick keeps the last aim. Movement does not change the aim. (Replaces "shoot where you move", which made fleeing shoot away from the horde and felt too hard.)
- [decided] Each weapon has a `targeting`; cards can improve/change it.
- [idea] Settings option to choose the aim mode: manual (twin-stick/mouse) or aim lock (`nearest`: auto-aim at the closest zombie). Also possibly automatic vs manual fire (fire button). Details open.
- [decided] Each round has a time limit. Killing every zombie of the round ends it early. If the time runs out with zombies alive: **mission failed**, back to the lobby (until the lobby exists: a "mission failed" screen with "play again").
- [decided] Intermission between rounds with a **skip button**; when it ends, the next round starts. Round 1 starts right away. No zombies during the intermission.
- [decided] Zombies get stronger the further you go, so the player needs upgrades (weapon, cards).
- [provisional] Numbers (`data/rounds.ts`): time limit 5 min, intermission 1 min, count `6 + round * 2` (max 120 alive at once, the rest spawn as others die), HP `3 * 1.06^round`, speed constant for now, spawn interval `1.0 - 0.05 * round` s (min 0.25 s).
- [decided] Between rounds: use the box, sell cards, use the shop.
- [decided] Kills give **points** (spent on the Mystery Box) and **XP** (level up, pick 1 of 3 cards).

### Player health

- [decided] 100 HP + 100 shield at the start. Damage hits the shield first; what is left over goes to HP.
- [decided] HP regenerates after a few seconds without taking damage. The shield **never** regenerates: it only comes back by buying it in the shop.
- [provisional] Regen starts 4 s after the last hit, at 20 HP/s up to max. Contact damage 10 per zombie touch, 0.5 s invulnerability after a hit (max 20 damage/s when surrounded). Default values for testing.
- [decided] HP at 0 = mission failed ("you died"), same screen as running out of time.
- [idea] Zombie types that hit harder, once the game has more body.

### Shop

- [decided] The shop is **in-run**: a **"Shop" button in every intermission** opens it. It does not pause the intermission timer.
- [decided] Paid with **in-run coins** ("moedas" in the UI), shown with a coin icon in the HUD. They only exist inside the run.
- [decided] Coins are paid **when a round is cleared**, based on **how many zombies were killed** and **which round** it is: little early on, much more in high rounds.
- [provisional] Formula (`data/economy.ts`): kills in the round × `round(3 * (1 + 0.1 * (round - 1)))`. Round 1 ≈ 24, round 10 ≈ 156, round 100 ≈ 6800.
- [decided] Catalog (`data/shop.ts`):
  - **Shield**: refills the shield right away.
  - **Health potion** and **speed potion**: stored in the inventory (max 3 each) and used **during a wave** with on-screen buttons (in the intermission HP already regenerates).
  - **Melee weapons** (katana, knife, axe), **turrets** and **walls** (protect/improve your base): listed as "coming soon" until the Blender models exist; their behavior is not implemented yet.
  - **Damage potion**: stored like the others, used during a wave.
- [provisional] Prices/effects: shield 20 (full refill), health potion 15 (+50 HP), speed potion 15 (+40% speed for 10 s), damage potion 20 (+50% damage for 10 s).
- [decided] The shop has two tabs: **Items** and **Weapon**. The Weapon tab sells upgrades for the **equipped weapon** (today the pistol; later also the one picked up from the Mystery Box). Upgrades are tracked **per weapon**: a new weapon starts at level 0.
- [provisional] Upgrades (`data/upgrades.ts`): damage +25% per level and fire rate +15% per level, max level 5, price 30 x 1.6^level (30, 48, 77, 123, 197). They stack with the damage potion.
- [idea] Aimed consumables for the shop: a **missile** you point at a spot to wipe out a horde, a **bomb** you aim and throw, etc. Bought in the intermission, used during the wave (like potions), with an aim/target gesture. Details open (area, damage, price, how to aim on mobile).
- [idea] Later: **training ("estudo") for the character** (valid for the run, so it does not break "meta-progression is unlocks only"); more weapon upgrades (pierce, range, projectile speed).
- [open] Whether in-run coins replace the "points" spent on the Mystery Box; how the shop combines with cards.

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

## Maps

- [decided] **5 maps at launch.** Each map is data (`data/maps.ts`): size and its own **zombie spawn points**.
- [decided] Zombies no longer spawn in a ring around the player: they come out of the map's spawn points and then chase the player (unchanged).
- [decided] Test map (`testArena`): 4 spawn points at the cardinal directions (north, south, east, west), toward the edges but not at the walls.
- [decided] Each round randomly picks which spawn points are **active**: few early, more in high rounds. Every zombie of the round comes out of one of the active points.
- [decided] A zombie can spawn right next to the player (like the windows in CoD Zombies): standing near a spawn point is the player's risk.
- [decided] **Arc arrows** on the ground around the player point to the active spawn points during a round. Spawn points are marked on the ground ("portals") while testing; the final game has no marker.
- [provisional] Test map numbers: arena 60x60, points 25 units from the center (walls at 30), zombies spawn within 2.5 units of the point; active points = `min(points, 1 + floor((round - 1) / 4))` (1 in rounds 1-4, 2 in 5-8, 3 in 9-12, all 4 from 13).
- [decided] Maps are built in Blender following `MAPS.md` (1 u = 1 m, north = +Y, `spawn_*` / `player_start` empties, `col_*` collision shapes, `.glb`).
- [open] The 5 real maps: layout, obstacles, theme, models. Obstacle collision + zombie pathfinding come with the first map that has obstacles.

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

- [decided] `?debug=1` turns on an overlay: FPS (avg/min), sim and render ms, draw calls, triangles, entities, round, HP/shield/coins.
- [decided] **Dev panel** (`?debug=1`, "DEV" button): jump to round N, kill all, spawn zombies, god mode, heal, coins, potions, game speed (0.5x/1x/2x/5x), bot that plays by itself, performance test, copy/paste run. Later: give card X at tier Y, give weapon.
- [decided] **Everything that changes the game goes through the input** (`InputState`), dev commands included (`systems/dev.ts`). So the input log is the whole run and replays are exact.
- [decided] **"Copy run"** (pause menu for everyone, dev panel in debug): copies a short summary + seed + input log (only changes, quantized) + build + checksum + invariant problems + recent JS errors. Pasting it in a chat reproduces the run: `bun run replay run.txt` (headless) or "Paste run" in the dev panel (in the browser).
- [decided] **Bug hunting:** invariants (`core/invariants.ts`) checked every 30 ticks in debug (red toast + included in the run), JS error capture, and a headless soak test (`bun run soak`: bot + random commands, invariants every step, failing runs saved to `runs/`).
- [decided] **Performance test** (dev panel): god + bot + a 120-zombie horde for 30 s, reports avg/min/1%-low FPS, sim/render ms and draw calls. Target: 60 fps with ~100 zombies on a mid-range phone.
- [decided] **Pause**: ⏸ button, Esc/P on PC, automatic when the app goes to the background. Menu: continue, restart, copy run.

## How to test

1. **Browser in mobile mode** (`bun run dev`, DevTools device emulation): fast iteration on logic and visuals.
2. **Real phone over USB** (`bunx cap run android`, USB debugging on): the test that counts for performance.
3. **Android Studio emulator** (AVD): good for screen sizes and app flow. Does not represent real WebGL performance; don't use it to decide if the game is light enough.

After changing code: `bun run build` and `bunx cap sync android`.

When reporting a problem: say what was expected, what happened, and use "copy run" (pause menu). Long runs give a long text (tens to hundreds of KB): saving it to a file and sharing the file also works.

## Open decisions

- Game name, exact art style, theme/universe.
- Initial list of weapons, cards and enemies.
- Character details (bonuses, the huntress's enemy type, melee weapon).
- Enemy curve after round ~100.
- In-run rarity in Rush.
- Chances per offer vs per slot (assumed: per offer).

- Aim mode in settings: manual vs aim lock as the default; manual fire button or not.
- Shop: melee/turret/wall behavior, weapon upgrades and training (see "Shop").

## Planned phases

1. **Milestone 1 (functional game):** 3D scene with tilted top-down camera, player (capsule) with virtual joystick, auto-shoot, zombies (placeholders) coming from off-screen, health and damage, death and restart. Debug overlay and dev panel. Running in the browser in mobile mode and on phone/emulator. No menus, no cards. Criteria: 60 fps with ~100 zombies on a mid-range phone, `core/` testable with `bun test`.
2. Rounds and spawn director. (Done ahead of the rest of Milestone 1.)
2.5. **Shop** (after player health): weapon upgrades, potions for the waves, character training. See "Shop" under Gameplay.
3. Cards and modifiers (5 slots, tiers, level up).
4. Mystery Box and 2 weapon slots.
5. Characters.
6. Modes (Story, Rush, Infinity) and difficulties.
7. Meta: save, store, Reward Crates, skins.
8. Real 3D models and visual polish.
