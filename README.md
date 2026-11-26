# Survivor Toker (working title)

Mobile survivors-like in 3D (tilted top-down camera) with CoD Zombies-style rounds, a Mystery Box and cards as upgrades. Android first, offline.

Design and decisions: [`agents/DESIGN.md`](agents/DESIGN.md). Working rules: [`agents/CLAUDE.md`](agents/CLAUDE.md).

## Stack

Bun · Vite · TypeScript · Three.js · Capacitor (Android) · Biome

## Requirements

- [Bun](https://bun.sh) 1.3+
- For Android only: Android Studio (installs the Android SDK, `adb` and the emulator) and JDK 21

## Commands

```sh
bun install          # install dependencies
bun run dev          # dev server (open in the browser, DevTools mobile mode)
bun test             # tests
bun run typecheck    # TypeScript check
bun run lint         # Biome lint + format check
bun run format       # Biome auto-fix
bun run build        # production build into dist/
```

Debug overlay: open the game with `?debug=1`.

## Android

1. Install Android Studio and, in its SDK Manager, the latest Android SDK platform and platform-tools.
2. Turn on USB debugging on the phone and plug it in (or create an emulator in the Device Manager).
3. Build, sync and run:

```sh
bun run cap:sync     # bun run build + cap sync android
bunx cap run android # pick the device
bunx cap open android # open the project in Android Studio
```

The emulator is good for screen sizes and flow, not for measuring WebGL performance. Use a real phone for that.

## Layout

```
src/
  core/      pure simulation (no Three, no DOM), fixed 60 Hz, seeded RNG
  data/      content and balancing
  systems/   gameplay systems
  render/    Three.js draws the simulation state
  ui/        DOM/CSS menus and HUD
  meta/      save, wallet, skins, unlocks
  dev/       debug overlay, dev panel, run export
android/     Capacitor Android project
```
