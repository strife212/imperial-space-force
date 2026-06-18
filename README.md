# IMPERIAL SPACE FORCE
Real-time 3D fleet battle simulator

A browser game built around a procedural **blue vs red** space battle: two fleets jump in, brawl, and one warps out broken. You compose your fleet within a points budget on a pre-battle briefing, issue tactical orders mid-fight, and watch it play out as a three.js set-piece with a follow camera, kill feed and post-battle breakdown. A headless version of the same combat loop runs from the command line for balance sweeps.

The project began life as a narrative command-terminal game (the *HMSS Her Annunciator* orbital weapons platform); that game still ships intact — see [Legacy: 2D Command Terminal](#legacy-2d-command-terminal) — but the battle simulation is now the front door.

---

## Tech Stack

- **React 19** — all UI as functional components with hooks; no class components
- **Vite 8** — dev server and build tooling
- **Vanilla CSS** — single `styles.css` file; no CSS framework or preprocessor
- **three.js** — powers the space-battle simulation and the legacy 3D visualisers (reactor torus, black hole, power previews)
- **Web Audio API** — procedurally synthesised battle sound effects (no audio assets required)
- **Node `worker_threads`** — parallelises the headless balance-sim harness across CPU cores
- **Deployed to GitHub Pages** via GitHub Actions, served at [imperialspaceforce.com](https://imperialspaceforce.com)

---

## Entry Flow

`App.jsx` opens on the **Start screen** (`screen === 'home'`):

- **Campaign** — placeholder, currently disabled.
- **Skirmish Battle** — opens the battle briefing, where you build both fleets and start the engagement.
- A faint **debug** link in the footer opens the debug screen (jump to any screen, toggle story flags).

---

## The Space Battle

A self-contained three.js engagement: a player-built **blue** fleet against a **red** fleet, fought to attrition until one side breaks and warps out.

- **Ship types** — four roles per side, each with distinct hulls:
  - **Fighters** — fast, fragile, the irreplaceable core; brawl at a standoff range and fire gently-homing laser bolts.
  - **Bombers** — tankier, slower; close in and drop high-damage bombs on the enemy flagship, with a point-defence laser against fighters.
  - **Missile cruisers** — ponderous ranged platforms that hold at standoff and lob homing missile salvos; move on a turning circle rather than pivoting on the spot.
  - **Flagship (capital)** — a tanky command vessel with an energy shield and a multi-bolt broadside. Losing it shatters fleet morale.
- **Fleet building** — on the briefing, both fleets are composed within a **1000-point budget** (`compStrength` in `battle/constants.js`) using `+`/`−` controls. The default red fleet is 24 fighters / 4 bombers / 1 cruiser; the player mirrors or counters it.
- **Combat** — bolts, bombs and missiles each have their own damage, accuracy, range and homing. **Armour** gives the flagship/bombers/cruiser a chance to deflect fighter bolts to zero. **Flares** are a limited missile countermeasure: each flagship and bomber can decoy a number of incoming missiles (the missile loses lock, sails past, and detonates harmlessly) before its pool runs dry.
- **Player tactics** (blue only) — flagship *Hold Back* / *Directly Engage*; fighter targeting *Attack All* / *Enemy Fighters* / *Enemy Capital Ship*; and a bomber wing you dispatch on your call (auto-launches if you wait too long).
- **Presentation** — a hyperspace **jump-in**, a nebula skydome with a random background body (gas giant / ringed planet / black hole), engine glows, missile smoke trails, flare flame-bursts, fireball + shockwave explosions, capital damage states and a drawn-out death sequence with drifting wreckage.
- **Follow camera** — click any ship to enter a third-person view with HP and a red **target** readout, numbered ship names (`Blue Fighter 3`, etc.), and dashed lines to every target it's currently engaging (the flagship tracks up to four, bombers two, cruisers two).
- **Audio** — laser, explosion, jump-in, victory and ambient sounds are synthesised at runtime via the Web Audio API through a shared bus (compressor + soft-clip saturation + reverb send), rate-limited so massed fire stays a crackle. Each sound can be overridden by dropping a file into `public/sfx/` — missing files fall back to the synth.

### File breakdown

Imports flow one way: `constants → geometry → RosterUI → SpaceBattleScreen`.

| File | Responsibility |
|---|---|
| `screens/SpaceBattleScreen.jsx` | The screen component: React state and player tactics, the three.js scene with its per-frame simulation loop (spawning, steering, combat, missiles/flares, fighter reserves/reinforcements, follow camera, picture-in-picture event cam, scoreboard & victory), and the Web Audio engine. |
| `screens/battle/constants.js` | Pure data and helpers — fleet/ship stats (HP, speed, damage, armour, flares), the per-ship point costs and 1000-point fleet budget, missile/cruiser tuning, capital-ship name list, comms portraits and victory text, the optional sound-file map, and the `compStrength` / `splitCapName` helpers. No React or three.js. |
| `screens/battle/geometry.js` | All three.js geometry: the inline GLSL shaders (nebula skydome, gas giant, ring, shield fresnel), the ship-model builders (fighter / bomber / cruiser / capital × blue / red) and the random backdrop builders. |
| `screens/battle/RosterUI.jsx` | The pre-battle order-of-battle UI: the `Briefing` screen, per-team rosters, `ShipSprite`, the `CountAdjust` fleet-builder controls, and the ship info tooltip with its rotating 3D `ShipModel3D` — plus `renderCommsBody` for the in-battle comms typewriter. |
| `screens/VisualTestScreen.jsx` | **Combat Visual Test** sandbox (reachable from debug): two indestructible, selectable ships orbit and fire so individual weapon/flare/explosion FX can be tuned in isolation, with a flares on/off toggle and a reset. |

---

## Battle Sim Harness

`scripts/battle-sim.mjs` is a headless, faithful port of the in-game combat loop (three.js vector math only, no rendering) used to balance fleet compositions. It runs thousands of engagements and reports win rates, with the heavy lifting fanned out across CPU cores via `worker_threads`.

```bash
npm run sim -- --runs 200                       # single match-up, 200 runs
npm run sim -- --sweep3 --runs 200 --workers 16 # full 25-build sweep, parallel
```

Key flags:

| Flag | Effect |
|---|---|
| `--runs N` | simulations per cell |
| `--workers N` | parallel worker threads (default 12) |
| `--sweep3` | sweep the full grid of fighter/bomber/cruiser builds vs the default red fleet |
| `--blue-fighters / --blue-bombers-count / --blue-cruisers-count` (and `--red-*`) | override fleet composition |
| `--cruiser-speed`, `--cruiser-steer arc\|force` | A/B cruiser tuning |
| `--verbose` / `--quiet` | output detail |

The harness imports `battle/constants.js` directly, so balance changes to the game are reflected in the sim with no duplication. A full 5000-sim sweep (25 builds × 200 runs) completes in well under a minute on 16 workers.

---

## Running Locally

```bash
npm install
npm run dev      # http://localhost:5173/
npm run build    # outputs static site to dist/
npm run sim      # run the headless balance harness (see above)
```

---

## Debug Mode

Click the small **debug** link in the Start-screen footer to open the debug screen. From there you can jump directly to any screen (including the battle and the Combat Visual Test), and toggle persistent story flags without playing through the full sequence.

---

## Legacy: 2D Command Terminal

Before the battle sim took centre stage, the game was a narrative browser experience styled as a fictional imperial military command terminal. The player operated the *HMSS Her Annunciator* orbital weapons platform through a series of interlocking screens, each simulating a system on the station. These screens all still exist and remain reachable via the debug screen.

### Legacy structure

```
src/screens/
├── BootScreen.jsx           # Animated boot sequence with diagnostic lines
├── LoginScreen.jsx          # Credential entry, cryptography module, anthem player
├── MenuScreen.jsx           # Platform menu with ship dossier
├── MainPanel.jsx            # Primary HUD — multi-panel command grid (largest file)
├── XBandRadioPanel.jsx      # Tunable frequency dial sub-panel
├── PowerManagementScreen.jsx   # Two-stage power hub — live three.js reactor & black-hole previews
├── ReactorScreen.jsx        # Plasma density management minigame
├── AntennaAlignmentScreen.jsx  # Beam alignment minigame with spectrograph
├── TargetingScreen.jsx      # Interactive solar system orbital map
├── LaunchMonitorScreen.jsx  # Post-launch orbital trajectory view
├── EncyclopediaScreen.jsx   # Three-column lore browser with locked entries
├── GameOverScreen.jsx       # End state with encyclopedia unlock summary
├── LaunchCodeVerifier.jsx   # Launch authorisation dialog
└── BlackHoleScreen.jsx      # three.js black hole visualiser (accretion disk, labelled features)

src/components/   # HudHeader/Footer, MailOverlay, AudioSpectrograph, CryptographyModule, UrgentMessageOverlay
src/data/         # encyclopediaData.js, messages.js, portraits.js
src/hooks/        # useScreenScale.js
src/lib/          # store.js (localStorage flags), planetData.js, shaders.js, constants.js
```

### Legacy architecture notes

- **Single-file CSS.** All styles live in `styles.css` (~5000 lines), delimited by section comments — co-located and easy to search without CSS modules.
- **Screen switching via state.** `App.jsx` holds a `screen` string and renders one screen at a time; screens unmount when inactive. Navigation/game state (target index, plasma level, etc.) lives in App and passes down as props.
- **Canvas-based visuals.** The radar, targeting map, orbital views and audio spectrograph are drawn directly on `<canvas>` with the 2D API and RAF loops in `useEffect` — no canvas library.
- **Persistent flags.** `src/lib/store.js` provides `getFlag` / `setFlag` backed by `localStorage`; flags gate encyclopedia entries, trigger mail, and track story progress across sessions.
- **Viewport scaling.** Either the `useScreenScale` hook (measure `scrollHeight`, apply `transform: scale()`) or an outer-clip / inner-scaler pattern with a hardcoded natural height.
- **Session-triggered messages.** `App.jsx` tracks a `sessionFlags` set; triggering a flag surfaces any gated mail from `messages.js` with a toast notification.
