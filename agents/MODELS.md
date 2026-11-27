# MODELS.md — character, enemy and weapon model standard

Read this before creating or changing any 3D model. Decisions behind it live in `DESIGN.md` ("Visuals and camera").

## Files

| What | Where |
|---|---|
| Base template (editable) | `art/characters/trooper_base.blend` |
| Base template (game) | `art/characters/trooper_base.glb` (mesh + rig + all animations) |
| Previews | `art/previews/` (`trooper_anim_sheet.png` shows every animation) |

New characters/skins/enemies: open `trooper_base.blend`, **Save As** `art/characters/<id>.blend`, change only the mesh look (colors, clothes, accessories, face), keep the rig and actions, export `<id>.glb`.

## Base template ("Trooper")

Every character, skin and enemy (zombies included) is built from this mold. Do not change the proportions per character; vary colors, clothing, accessories and face only.

- **Scale:** 1 Blender unit = 1 m. Height ~1.0 m (helmet top ~1.02). Width ~0.66 (head is the widest part). Collision radius in game ~0.45.
- **Origin:** at the feet, center of the base (0, 0, 0).
- **Facing:** -Y in Blender (becomes +Z in Three.js after glTF export with +Y up).
- **Proportions:** big egg head (~0.6 wide, center z ≈ 0.68), small pear body (z ≈ 0.12–0.47), short tube arms and legs, round mitten hands, rounded boots with a dark sole.
- **Style:** smooth shading, flat saturated colors, one material per color (`<Character>_<Part>`), no textures. Details (pouches, buckles, patches) sit **on** the surface (raycast placement), never sunk into or poking through it. Clothing (vest, belt) is a shell built from the body shape so the body never shows through.
- **Face:** black oval eyes with a small white highlight, brows, thin arc mouth, all placed on the head surface. Soldier: slanted "angry" brows + smile. No muzzle/snout shape.
- **Triangles:** current Trooper ~16.6k (too high). Target ≤ 6k for playable characters, ≤ 2–3k for common zombies (many on screen). Decimate before shipping; keep the face readable.

## Rig (same for every character)

Armature object `<Character>Rig`, mesh parented with an Armature modifier. Weights are rigid per part (each loose part follows one bone), with a short blend at the elbow, knee/ankle and waist.

```
root                 (non-deform, at the feet; moves/rotates the whole body)
└─ hips
   ├─ spine          (torso, vest, backpack)
   │  ├─ head        (head, helmet, face)
   │  ├─ upper_arm.L ─ forearm.L ─ hand.L
   │  └─ upper_arm.R ─ forearm.R ─ hand.R
   │                               └─ weapon.R  (non-deform socket)
   ├─ thigh.L ─ foot.L
   └─ thigh.R ─ foot.R
```

`.L` = character's left = +X in Blender. Rotations are quaternions.

### Weapon socket

`weapon.R` is a child of `hand.R`. In game, attach the weapon model to this bone (Three.js: `skeleton.getBoneByName('weaponR')` — glTF/Three may strip the dot, check the loaded names). Weapons never get their own animations: switching weapons is swapping the attached model.

## Animations (same names for every character)

24 fps. Actions are named `<Character>_<anim>`; in game, match by the suffix.

| Anim | Frames | Loop | Description |
|---|---|---|---|
| `idle` | 0–32 | yes | Standing, breathing (chest rise, slight arm sway) |
| `run` | 0–16 | yes | Default run: lean forward, legs/arms swing, small bounce |
| `shoot` | 0–24 | yes | Aiming pose only (both arms forward, weapon hand on `weapon.R`), tiny sway. No recoil (do it in code if needed) |
| `hit` | 0–14 | no | Very small knock back (~7°) and recover |
| `death` | 0–40 | no | Falls flat on the back; last frame holds the lying pose |
| `melee` | 0–20 | no | Right arm sweeps an arc from the character's right to its left (viewer's left → right) with a torso twist |

Game usage (Three.js): `AnimationMixer`; `idle`/`run` cross-fade by speed; `shoot` should be layered on the upper body (arms/spine) over `run`; `hit` is a short additive/one-shot; `death` clamps on the last frame (`clampWhenFinished = true`, `LoopOnce`).

Known limitation: from the top-down game camera the arms are mostly hidden under the head, so `shoot` and `melee` read through the weapon in the hand, not the arms.

## Weapons

- Separate model per weapon: `art/weapons/<id>.blend` / `.glb`.
- **Slightly more realistic** than the characters, but still chunky and readable from the top camera.
- Origin at the grip (where the hand holds it), barrel/blade pointing forward (-Y in Blender). An empty named `muzzle` at the barrel tip (where shots/flash spawn).
- ~300–1500 tris. Rarity variants = color/material swaps of the same mesh.

## Exporting (glTF)

Select the rig and the mesh, then `File → Export → glTF 2.0 (.glb)`:
- Include: Selected Objects. +Y Up.
- Animation: mode **Actions**, Always Sample Animations on. Export deforming bones only = off (keeps `root` and `weapon.R`).
- Check the export lists all 6 animations.

## Rules for other agents

- Never change the proportions, bone names, or animation names of the template without asking the user; they are shared by every character.
- New animations are added to the template first, then copied to each character.
- Placeholders stay in game until the user asks to integrate a model.
