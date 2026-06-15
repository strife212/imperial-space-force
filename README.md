# IMPERIAL SPACE FORCE
Tactical Command Interface

A narrative browser game built as a fictional military command terminal. The player operates an imperial orbital weapons platform through a series of interlocking screens, each simulating a real system on the station.

---

## Tech Stack

- **React 19** — all UI as functional components with hooks; no class components
- **Vite 8** — dev server and build tooling
- **Vanilla CSS** — single `styles.css` file; no CSS framework or preprocessor
- **three.js** — powers the 3D visualisers (reactor torus, black hole, power-management previews, and the space-battle simulation); the rest of the game's visuals are hand-rolled on `<canvas>` 2D
- **Web Audio API** — procedurally synthesised sound effects for the space battle (no audio assets required)
- **Deployed to GitHub Pages** via GitHub Actions, served at [imperialspaceforce.com](https://imperialspaceforce.com)

---

## Project Structure

```
src/
├── App.jsx                  # Root component; owns all screen state and navigation
├── styles.css               # All styles (single file, ~5000 lines)
├── screens/                 # One file per screen/major view
│   ├── BootScreen.jsx       # Animated boot sequence with diagnostic lines
│   ├── LoginScreen.jsx      # Credential entry, cryptography module, anthem player
│   ├── MenuScreen.jsx       # Main menu with ship dossier
│   ├── MainPanel.jsx        # Primary HUD — multi-panel command grid (largest file)
│   ├── XBandRadioPanel.jsx  # Tunable frequency dial sub-panel
│   ├── PowerManagementScreen.jsx   # Two-stage power hub — live three.js reactor & black-hole previews
│   ├── ReactorScreen.jsx    # Plasma density management minigame
│   ├── AntennaAlignmentScreen.jsx  # Beam alignment minigame with spectrograph
│   ├── TargetingScreen.jsx  # Interactive solar system orbital map
│   ├── LaunchMonitorScreen.jsx     # Post-launch orbital trajectory view
│   ├── EncyclopediaScreen.jsx      # Three-column lore browser with locked entries
│   ├── GameOverScreen.jsx   # End state with encyclopedia unlock summary
│   ├── LaunchCodeVerifier.jsx      # Launch authorisation dialog
│   ├── BlackHoleScreen.jsx  # three.js black hole visualiser (accretion disk, labelled features)
│   ├── SpaceBattleScreen.jsx       # three.js fleet battle sim (25v25 + capitals, tactics, sound)
│   └── DebugScreen.jsx      # Dev tool for jumping between screens and toggling flags
├── components/
│   ├── HudHeader.jsx        # Persistent top bar (used across HUD screens)
│   ├── HudFooter.jsx        # Persistent status bar
│   ├── MailOverlay.jsx      # Imperial Messaging Service — inbox with reply/typing effect
│   ├── AudioSpectrograph.jsx # Reusable canvas-based audio visualiser
│   └── CryptographyModule.jsx # Animated login credential sequence
├── data/
│   ├── encyclopediaData.js  # All lore entries with lock conditions
│   ├── messages.js          # In-game mail — initial and triggered messages
│   └── portraits.js         # Character portrait assets for mail system
├── hooks/
│   └── useScreenScale.js    # Scales screen content to fit small viewports
└── lib/
    ├── store.js             # Persistent flag store (localStorage) for game state
    ├── planetData.js        # Solar system data — orbits, colours, distances
    ├── shaders.js           # Shared GLSL (plasma / accretion disk / fresnel rim) for the 3D screens
    └── constants.js         # Boot sequence lines and other static data
```

`public/sfx/` holds optional sound-effect overrides for the space battle (see its README).

---

## Key Architecture Decisions

**Single-file CSS.** All styles live in `styles.css`. Sections are clearly delimited by comments. This keeps the styling co-located and easy to search without the overhead of CSS modules or a build step.

**Screen switching via state.** `App.jsx` holds a `screen` string and conditionally renders one screen at a time. Screens unmount when not active — no hidden screens in the background. Navigation state (target index, plasma level, etc.) lives in App and is passed down as props.

**Canvas-based visuals.** The radar, targeting, railgun installation view, orbital map, and audio spectrograph are all drawn on `<canvas>` elements using the 2D API directly, with RAF animation loops managed in `useEffect`. No canvas library is used.

**Persistent flags.** `src/lib/store.js` provides `getFlag` / `setFlag` backed by `localStorage`. Flags gate encyclopedia entries, trigger new mail messages, and track story progress across sessions.

**Viewport scaling.** Screens use one of two patterns to fit small displays without scrolling:
- `useScreenScale` hook — measures natural `scrollHeight` once on mount and applies a `transform: scale()` to the inner container (used for Login, Menu, Debug)
- Outer-clip / inner-scaler pattern — hardcoded `NATURAL_H`, outer `position: fixed; overflow: hidden`, inner div gets explicit `width/height` and `transform: scale()` updated on resize (used for MainPanel, TargetingScreen)

**Session-triggered messages.** `App.jsx` tracks a `sessionFlags` set. When a flag is triggered (reactor powered up, targeting map viewed, etc.), it checks `messages.js` for any mail that requires that flag and hasn't been seen, then surfaces it with a toast notification.

---

## Space Battle Simulation

A self-contained three.js set-piece (reachable from the debug screen) that plays out a procedural attrition battle — a 25-fighter + 1 capital fleet against a mirror-image enemy, **blue vs red**.

- **Fleets & models** — distinct per-side fighter hulls (blue delta-wing interceptor, red forked marauder) and large flagships (*HMSS Limitless Light* vs *Rebel Capital Ship*), each built by merging primitives into a single geometry per ship type.
- **Behaviour** — fighters steer (seek nearest enemy to a standoff range, separation, wander, arena bounds) and fire gently-homing laser bolts; capitals fly a fixed circular patrol at the rear and loose rapid broadsides.
- **Combat** — pure attrition: bolts deal 1 damage at ~72% accuracy; fighters have 6 HP, capitals 60. Capitals show escalating **damage states** (hull fires, embers), a drawn-out **death sequence** (rippling secondary explosions → final blast) and leave **persistent drifting wreckage**.
- **Presentation** — a hyperspace **jump-in** (capitals first, fighters following into formation), a nebula skydome with a random on-screen background body (gas giant / ringed planet / black hole), engine glows, fireball + shockwave explosions, a live **kill feed**, capital name/shield labels, and a **post-battle stats breakdown**.
- **Player tactics** (blue fleet only) — capital *Hold Back* / *Directly Engage*, and fighter targeting *Attack All* / *Enemy Fighters* / *Enemy Capital Ship*.
- **Audio** — laser, explosion, jump-in, victory and ambient sounds are synthesised at runtime via the Web Audio API through a shared bus (compressor + soft-clip saturation + reverb send), rate-limited so massed fire stays a crackle rather than a wall of noise. Each sound can be overridden by dropping a file into `public/sfx/` — missing files fall back to the synth.

---

## Running Locally

```bash
npm install
npm run dev
```

Runs at `http://localhost:5173/`

```bash
npm run build
```

Outputs to `dist/` — deploy the contents to any static host.

---

## Debug Mode

Click the small debug link on the login screen footer to open the debug screen. From there you can jump directly to any screen and toggle persistent story flags without playing through the full sequence.
