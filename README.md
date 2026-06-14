# IMPERIAL SPACE FORCE
Tactical Command Interface

A narrative browser game built as a fictional military command terminal. The player operates an imperial orbital weapons platform through a series of interlocking screens, each simulating a real system on the station.

---

## Tech Stack

- **React 19** — all UI as functional components with hooks; no class components
- **Vite 8** — dev server and build tooling
- **Vanilla CSS** — single `styles.css` file; no CSS framework or preprocessor
- **three.js** — powers the 3D visualisers (reactor torus, black hole, power-management previews); the rest of the game's visuals are hand-rolled on `<canvas>` 2D
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
    └── constants.js         # Boot sequence lines and other static data
```

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
