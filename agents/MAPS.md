# MAPS.md — map standard (Blender → game)

Read this before building or changing a map. Decisions behind it live in `DESIGN.md` ("Maps"). Character/weapon models follow `MODELS.md`.

## Files

| What | Where |
|---|---|
| Editable map | `art/maps/<id>.blend` (e.g. `art/maps/test_arena.blend`) |
| Game map | `art/maps/<id>.glb` |
| Map data in code | `src/data/maps.ts` (today the spawn points are typed there; once the loader exists they come from the `.glb`) |

## Scale and axes

- **1 Blender unit = 1 m.** Characters are ~1.0–1.1 m tall, collision radius ~0.45; common zombies ~0.84 m wide.
- **Map center at the origin (0, 0, 0)**, ground at **Z = 0**.
- **North = +Y in Blender** = top of the screen in game. East = +X. (glTF export with +Y up turns Blender Y into game -Z, and the game's "north" is -Z.)
- The camera looks from the **south** (Blender -Y), tilted ~55°. Phone in landscape sees about **±13 m left/right and ±8 m up/down** around the player.

## Test map (`test_arena`)

- **Play area: 60 × 60 m**, X and Y from -30 to +30. The floor can extend further for looks (e.g. 80 × 80), but the play area ends at ±30.
- **Boundary walls** on the 4 edges (see "Collision"), so nobody leaves the 60 × 60 area.
- **Spawn points** (Empty → Plain Axes, names exact):

  | Empty | Position (X, Y, Z) |
  |---|---|
  | `spawn_north` | (0, 25, 0) |
  | `spawn_south` | (0, -25, 0) |
  | `spawn_east` | (25, 0, 0) |
  | `spawn_west` | (-25, 0, 0) |

  Zombies appear within **2.5 m** of the empty: keep a **clear circle of ~3 m** around each one (no obstacles).
- **`player_start`** (Empty) at (0, 0, 0): keep ~4 m clear around it.
- Suggested layout to test gameplay: an open **plaza ~20 × 20 m in the center**, a few **low cover pieces** (crates, sandbags, cars: ~1 m tall), 2–3 **longer walls** (3–6 m long) to create lanes, and open paths from every spawn to the center.

## Starting map (`start_base`) [approved by the user]

Files: `art/maps/start_base.blend`, `art/maps/start_base.glb` (map + collision + wind), `art/maps/start_base_prefabs.glb` (all wall/door tiers + turret parts), previews in `art/maps/previews/`.

- **Play area 60 × 60**, ground 80 × 80, grass with darker patches and tufts. Spawns unchanged: `spawn_north/south/east/west` at 25 m, 3 m clear. `player_start` at the center (inside the base).
- **Base** in the center, 12 × 12 m with cut corners (octagon), wooden plank floor (`floor`). **No roof** (if one is ever added it must hide when the player is inside: code).
  - **8 walls** `wall_<side><1|2>` (side = n/s/e/w), 3.2 m long, 1.4 m tall, inside faces the center. Custom props `slot` and `tier`.
  - **4 doors** `door_ne/se/sw/nw` on the cut corners, 2.55 m wide, origin at the **hinge** (rotate around Z to open). They count as walls (same tiers). Custom props `slot` and `tier`.
  - **4 turret blocks** `turret_block_<side>` (wooden crate 2.0 × 1.2 × 1.4) in the middle of each side, between the two walls.
  - **Turrets: the map starts without them.** On top of each block there is an empty `turret_slot_<side>` (position + yaw, facing outward). When the player gets a turret, code spawns `prefab_turret_base` at the slot with `prefab_turret_head` as its child at local Z 0.62 (yaw pivot: rotate around Z to aim; barrel = local -Y) and the muzzle at head-local (0, -0.96, 0.02). Turret behavior is code.
- **Wall/door tiers** (`start_base_prefabs.glb`): `prefab_wall_t1..t4`, `prefab_door_t1..t4` = 1 wood, 2 wood + metal plates, 3 full metal, 4 titanium. The map uses tier 1. To upgrade, swap the slot's mesh with the prefab mesh of the new tier (same origin/size). Also `prefab_turret_block`, `prefab_turret_base`, `prefab_turret_head`. Prefab object locations in the file are only for viewing; use the meshes.
- **Damage phases** (also in `start_base_prefabs.glb`): every wall and door tier has 4 phases until its life ends: `prefab_wall_t<tier>_d<phase>` / `prefab_door_t<tier>_d<phase>`, phase 1 light, 2 medium, 3 heavy, **4 destroyed** (only stubs + low rubble, walkable). Same origin and size as the intact piece, so code just swaps the mesh. Suggested thresholds: intact > 80% life, d1 ≤ 80%, d2 ≤ 55%, d3 ≤ 30%, d4 at 0 (then disable that slot's `col_box_*`; re-enable when rebuilt). Repairing walks back through the phases.
- **Debris pieces** for the break effect (code throws them with simple physics and fades them out ~1 s): `debris_wood_plank`, `debris_wood_splinter`, `debris_metal_plate`, `debris_metal_bolt`, `debris_titanium_shard` (origin at center). Use wood for tiers 1–2, metal for 3, titanium for 4 (+ bolts for 2–4). Hit shake/flash and dust particles are code.
- **Base walls (game rule):** 4 walls = 4 sides. Side of each piece = the letter after `wall_`; doors `door_ne/nw` belong to **north**, `door_se/sw` to **south** (decided by the user). Upgrades are per side, life per piece.
- **Collision:** `col_box_wall_*`, `col_box_door_*` (code removes/ignores it while a door is open), `col_box_turret_block_*`, boundary `col_wall_*`. Doors are 2.55 m (narrower than the 3 m corridor rule on purpose: they are the base entrances).
- **Trees:** 4 dense groves at the map corners (20 each, denser toward the corner) + 14 scattered along the edges (spawn lanes kept 5 m clear). Mixed styles: lumpy oaks with branches, 3-tier pines, tall poplars (light trunk), low bushes. `trees_trunks` + `trees_canopy_nw/ne/sw/se/edge`. **No collision**: the player can walk under them (trees do not hide; only bushes do). Canopies start ~1.5 m up.
- **Bushes:** 24 scattered over the whole field (`bushes`, one object), 4 types: round, flowering (orange flowers), tall grass clump, dark berry bush. ~0.6–1 m tall, **no collision**, kept off the base area and 3.5 m from spawns.
- **Wind:** each canopy object (and `bushes`) has 2 shape keys (`wind_a`, `wind_b`) animated as sin/cos over 96 frames (4 s loop); each tree has its own phase and strength (pines and bushes sway less). In the `.glb` they are morph-target animations named after the objects (6 clips: 5 canopies + `bushes`): play all of them in loop.
- Budget: ~19k triangles, 15 materials in the map (+ `Map_Titanium*` only in the prefabs).

## Importing into the game

After exporting the `.glb`, run `bun run import-map <id>` (e.g. `start_base`). It writes `src/data/maps/<camelId>.gen.ts` with what the simulation needs: play area (from `col_wall_*`), `spawn_*`, `player_start`, static obstacles (`col_box_*` that are not a slot), base slots (`wall_*` / `door_*` + their `col_box_*`), `turret_slot_*`, and the **hiding grid** (0.5 m cells covered by the ground footprint of `bushes` and of the low loose parts (≤ 1.3 m) inside `trees_canopy_*`, i.e. the grove bushes; tree crowns do not hide). `bun test` fails if the `.glb` changed and the import was not re-run. The renderer loads the `.glb` itself (`src/render/mapAssets.ts`).

## Game objects (named Empties)

| Name | What |
|---|---|
| `spawn_<id>` | Zombie spawn point (`spawn_north`, `spawn_gate`, ...). Any number per map. |
| `player_start` | Where the player starts. |
| `box_<n>` | Possible Mystery Box spots (future). |

Empties are never rendered. Names are lowercase `snake_case`.

## Collision (obstacles)

The game logic is 2D on the ground, so only each obstacle's **footprint** matters:

- Separate **invisible** collision objects with the prefix **`col_`**, built from simple shapes:
  - `col_box_*`: a box (rotation around Z allowed) → rectangle on the ground;
  - `col_round_*`: a cylinder → circle on the ground;
  - `col_wall_north`, `col_wall_south`, `col_wall_east`, `col_wall_west`: the boundary.
- The visual mesh is separate (any shape); the `col_` shape roughly covers it. Collision objects are not drawn in game.
- **Corridors ≥ 3 m wide** (hordes of up to 120 zombies need room; narrow gaps become choke points).
- In the game: player and zombies collide with `col_box_*` (circle vs oriented box, `systems/obstacles.ts`) and zombies path around them with a flow field (`systems/navigation.ts`). `col_round_*` is not supported by the importer yet (add it when a map uses one).

## Visual budget (phone)

- **Whole map ≤ ~20k triangles**, **≤ ~15 materials**.
- Flat colors, one material per color (`Map_<Part>`, e.g. `Map_Ground`, `Map_Crate`), no textures (same style as `MODELS.md`).
- **Join static meshes that share a material** (fewer objects = fewer draw calls). A few dozen objects in total is fine; hundreds is not.
- Tall props (> ~1.5 m) hide the player when he walks **north** of them (camera looks from the south). Prefer low cover in the play area and tall buildings/trees along the edges.
- No lights and no cameras in the export (the game has its own).

## Export (glTF)

`File → Export → glTF 2.0 (.glb)`:
- Include: Visible Objects (visual meshes + `col_*` + empties). Custom Properties on.
- Transform: **+Y Up**.
- Mesh: Apply Modifiers on.
- Animation: off (static map).
- Save as `art/maps/<id>.glb`.
