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
- Not in the game yet: player/zombie collision with obstacles and zombies walking around them (pathfinding). The first test map with obstacles is what we use to build that.

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
