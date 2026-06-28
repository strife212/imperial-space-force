import { useState } from 'react'
import { useScreenScale, SCREEN_DESIGN_HEIGHT } from '../hooks/useScreenScale'
import './upgrade.css'

// ── Upgrade icons (themeable line/fill SVGs) ─────────────────────────────────
function MissileIcon() {
  return (
    <svg viewBox="0 0 64 64" className="up-svg" aria-hidden="true">
      <path d="M32 5 C40 14 41 22 41 30 V41 H23 V30 C23 22 24 14 32 5 Z" />
      <path d="M23 33 L13 46 L23 41 Z" />
      <path d="M41 33 L51 46 L41 41 Z" />
      <circle cx="32" cy="24" r="3.2" className="up-svg-cut" />
      <path d="M27 41 H37 L34.5 56 L32 50 L29.5 56 Z" className="up-svg-flame" />
    </svg>
  )
}
function LockFighterIcon() {
  return (
    <svg viewBox="0 0 64 64" className="up-svg" aria-hidden="true">
      <path d="M32 6 L48 46 L32 38 L16 46 Z" />
      <g className="up-svg-lock">
        <path d="M37 47 v-3.5 a5 5 0 0 1 10 0 V47" fill="none" strokeWidth="3" />
        <rect x="34.5" y="46.5" width="15" height="12" rx="2.5" />
      </g>
    </svg>
  )
}
function HullIcon() {
  return (
    <svg viewBox="0 0 64 64" className="up-svg" aria-hidden="true">
      <path d="M32 5 L55 14 V31 C55 45 45 54 32 60 C19 54 9 45 9 31 V14 Z" fill="none" strokeWidth="4" />
      <path d="M28.5 21 h7 v7.5 h7.5 v7 h-7.5 v7.5 h-7 v-7.5 h-7.5 v-7 h7.5 Z" className="up-svg-plus" />
    </svg>
  )
}
function BarrageIcon() {
  return (
    <svg viewBox="0 0 64 64" className="up-svg" aria-hidden="true">
      <path d="M32 58 Q 13 33 18 14" fill="none" strokeWidth="2.6" strokeLinecap="round" />
      <path d="M32 58 Q 32 30 32 10" fill="none" strokeWidth="2.6" strokeLinecap="round" />
      <path d="M32 58 Q 51 33 46 14" fill="none" strokeWidth="2.6" strokeLinecap="round" />
      <path d="M18 9 l-4 8 8 0 Z" />
      <path d="M32 5 l-4 8 8 0 Z" />
      <path d="M46 9 l-4 8 8 0 Z" />
    </svg>
  )
}
// Ablative plating — a shield, half its face plated solid
function PlatingIcon() {
  return (
    <svg viewBox="0 0 64 64" className="up-svg" aria-hidden="true">
      <path d="M32 5 L55 14 V31 C55 45 45 54 32 60 C19 54 9 45 9 31 V14 Z" fill="none" strokeWidth="4" />
      <path d="M32 12 L48 18 V31 C48 41 41 48 32 53 Z" />
      <path d="M16 21 H26 M16 28 H24 M16 35 H26" fill="none" strokeWidth="3" strokeLinecap="round" />
    </svg>
  )
}
// Decoy launchers — a launch point throwing a fan of flares
function FlareIcon() {
  return (
    <svg viewBox="0 0 64 64" className="up-svg" aria-hidden="true">
      <circle cx="32" cy="51" r="4.5" />
      <path d="M32 47 L20 14 M32 47 L32 9 M32 47 L44 14 M32 47 L12 26 M32 47 L52 26" fill="none" strokeWidth="2.6" strokeLinecap="round" />
      <path d="M20 9 l-3.5 8 7.5 0 Z" />
      <path d="M32 4 l-3.5 8 7.5 0 Z" />
      <path d="M44 9 l-3.5 8 7.5 0 Z" />
      <path d="M10 21 l-1 8.4 6.6 -3.4 Z" />
      <path d="M54 21 l1 8.4 -6.6 -3.4 Z" />
    </svg>
  )
}
// Hardened hulls — a fighter chevron with a shield badge
function HardenIcon() {
  return (
    <svg viewBox="0 0 64 64" className="up-svg" aria-hidden="true">
      <path d="M30 6 L47 42 L30 34 L13 42 Z" />
      <path d="M44 36 l9 4 v7 a9 9 0 0 1 -9 8 a9 9 0 0 1 -9 -8 v-7 Z" fill="none" strokeWidth="3" />
    </svg>
  )
}
// Veteran squadrons — a fighter chevron stamped with a rank star
function VeteranIcon() {
  return (
    <svg viewBox="0 0 64 64" className="up-svg" aria-hidden="true">
      <path d="M32 7 L51 47 L32 39 L13 47 Z" />
      <path d="M32 18 l3 6.2 6.8 .9 -4.9 4.8 1.2 6.8 -6.1 -3.2 -6.1 3.2 1.2 -6.8 -4.9 -4.8 6.8 -.9 Z" className="up-svg-cut" />
    </svg>
  )
}
// Forward batteries — a turret base with three barrels and muzzle flash
function CannonIcon() {
  return (
    <svg viewBox="0 0 64 64" className="up-svg" aria-hidden="true">
      <rect x="11" y="40" width="42" height="15" rx="2.5" />
      <rect x="17" y="22" width="6" height="20" />
      <rect x="29" y="16" width="6" height="26" />
      <rect x="41" y="22" width="6" height="20" />
      <path d="M20 11 l-3 7 6 0 Z" className="up-svg-flame" />
      <path d="M32 5 l-3 7 6 0 Z" className="up-svg-flame" />
      <path d="M44 11 l-3 7 6 0 Z" className="up-svg-flame" />
    </svg>
  )
}
// Targeting uplink — a reticle ringed by motion ticks (faster fire)
function RateIcon() {
  return (
    <svg viewBox="0 0 64 64" className="up-svg" aria-hidden="true">
      <path d="M44 16 a20 20 0 1 0 6 12" fill="none" strokeWidth="4" strokeLinecap="round" />
      <path d="M42 6 v14 h14" fill="none" strokeWidth="4" strokeLinecap="round" />
      <circle cx="40" cy="36" r="4.5" />
      <path d="M8 30 H21 M6 39 H19 M10 48 H23" fill="none" strokeWidth="3" strokeLinecap="round" />
    </svg>
  )
}
// Auto-repair bays — a regen cycle arrow wrapping a repair cross
function RepairIcon() {
  return (
    <svg viewBox="0 0 64 64" className="up-svg" aria-hidden="true">
      <path d="M50 16 a22 22 0 1 0 5 16" fill="none" strokeWidth="4" strokeLinecap="round" />
      <path d="M55 8 v12 h-12" fill="none" strokeWidth="4" strokeLinecap="round" />
      <path d="M28 22 h8 v6 h6 v8 h-6 v6 h-8 v-6 h-6 v-8 h6 Z" className="up-svg-plus" />
    </svg>
  )
}
// Bastion bulwark — a castellated fortress shield with a cross seam
function BastionIcon() {
  return (
    <svg viewBox="0 0 64 64" className="up-svg" aria-hidden="true">
      <path d="M13 11 h7 v5 h6 v-5 h8 v5 h6 v-5 h7 v18 C53 43 43 53 32 59 C21 53 11 43 11 29 Z" />
      <path d="M24 31 h16 v4 h-16 Z M30 25 h4 v17 h-4 Z" className="up-svg-cut" />
    </svg>
  )
}
// Praetorian wing — a lead interceptor flanked by two wingmen
function WingIcon() {
  return (
    <svg viewBox="0 0 64 64" className="up-svg" aria-hidden="true">
      <path d="M32 7 L44 31 L32 25 L20 31 Z" />
      <path d="M15 29 L25 49 L15 44 L5 49 Z" />
      <path d="M49 29 L59 49 L49 44 L39 49 Z" />
    </svg>
  )
}
// Throne-forged aegis — a radiant crowned shield (legendary)
function AegisIcon() {
  return (
    <svg viewBox="0 0 64 64" className="up-svg" aria-hidden="true">
      <path d="M32 11 L52 17 V32 C52 45 43 55 32 60 C21 55 12 45 12 32 V17 Z" />
      <path d="M21 25 l5 6 6 -8 6 8 5 -6 -2 14 H23 Z" className="up-svg-cut" />
      <path d="M32 2 v6 M11 7 l3 5 M53 7 l-3 5" fill="none" strokeWidth="2.6" strokeLinecap="round" />
    </svg>
  )
}

// ── Rarity tiers ─────────────────────────────────────────────────────────────
// Drives each card's colour and (later) its chance of appearing.
//   legendary=orange · epic=purple · rare=blue · uncommon=green · basic=white
export const RARITY_LABEL = { legendary: 'LEGENDARY', epic: 'EPIC', rare: 'RARE', uncommon: 'UNCOMMON', basic: 'BASIC' }

// ── Upgrade catalog ──────────────────────────────────────────────────────────
// Every defined upgrade card, keyed by id. The post-battle draw (pickUpgrades)
// rolls each slot's rarity, then picks a random card of that rarity from here.
export const UPGRADE_CARDS = {
  capMissile:        { rarity: 'epic',      tag: 'FLAGSHIP', title: 'SPINAL MISSILE BATTERY', desc: 'Mount a homing-missile launcher on your flagship — it lobs a guided missile at the enemy throughout the battle.', Icon: MissileIcon },
  unsellableFighter: { rarity: 'uncommon',  tag: 'FLEET',    title: 'VOLUNTEER WING',         desc: 'A permanent interceptor joins your fleet. It deploys every battle and can never be decommissioned.', Icon: LockFighterIcon },
  capHp:             { rarity: 'basic',     tag: 'FLAGSHIP', title: 'REINFORCED HULL',        desc: 'Plate the flagship with extra armour — +5 maximum hull integrity, permanently.', Icon: HullIcon },
  macroMissile:      { rarity: 'legendary', tag: 'FLAGSHIP', title: 'MACRO-MISSILE BARRAGE',  desc: 'A second admiral skill: lock onto 10 random targets, then loose a missile at each in one fanning barrage.', Icon: BarrageIcon },
  // ── Combat-stat cards (drawn into the post-battle pick by rarity) ──
  // basic (white) — minor single-stat bumps
  capArmor:          { rarity: 'basic',     tag: 'FLAGSHIP', title: 'ABLATIVE PLATING',       desc: 'Bolt-deflecting plates layer the flagship hull, raising its armour so more fighter fire glances off.', Icon: PlatingIcon },
  fighterArmor:      { rarity: 'basic',     tag: 'FLEET',    title: 'HARDENED HULLS',         desc: 'Reinforced plating across the whole interceptor wing — each fighter deflects a slice of incoming fire.', Icon: HardenIcon },
  capFlares:         { rarity: 'basic',     tag: 'FLAGSHIP', title: 'DECOY LAUNCHERS',        desc: 'Extra countermeasure racks for the flagship: more flares to spoof incoming missiles before they connect.', Icon: FlareIcon },
  // uncommon (green) — moderate
  fighterHp:         { rarity: 'uncommon',  tag: 'FLEET',    title: 'VETERAN SQUADRONS',      desc: 'Battle-hardened crews fly tougher hulls — every interceptor gains integrity and lasts longer in the brawl.', Icon: VeteranIcon },
  capWeapons:        { rarity: 'uncommon',  tag: 'FLAGSHIP', title: 'FORWARD BATTERIES',      desc: 'An extra gun joins each flagship broadside, putting one more bolt on a fresh target every volley.', Icon: CannonIcon },
  // rare (blue) — strong
  fighterRof:        { rarity: 'rare',      tag: 'FLEET',    title: 'TARGETING UPLINK',       desc: 'A fleet-wide fire-control net: your interceptors acquire and fire markedly faster for the whole battle.', Icon: RateIcon },
  capRegen:          { rarity: 'rare',      tag: 'FLAGSHIP', title: 'AUTO-REPAIR BAYS',       desc: 'Damage-control drones knit the hull back together, repairing the flagship steadily throughout the fight.', Icon: RepairIcon },
  // epic (purple) — powerful packages
  bastionHull:       { rarity: 'epic',      tag: 'FLAGSHIP', title: 'BASTION BULWARK',        desc: 'A fortress refit — a major hull increase plus heavier armour and extra flares turn the flagship into a wall.', Icon: BastionIcon },
  praetorianWing:    { rarity: 'epic',      tag: 'FLEET',    title: 'PRAETORIAN WING',        desc: 'Elite doctrine for the entire wing: every interceptor gains substantial hull and armour — a hardened vanguard.', Icon: WingIcon },
  // legendary (orange) — apotheosis
  throneAegis:       { rarity: 'legendary', tag: 'FLAGSHIP', title: 'THRONE-FORGED AEGIS',    desc: 'The flagship ascends: vast hull and armour, more flares, an added broadside gun, and a hull that repairs itself.', Icon: AegisIcon },
}
// Card ids grouped by rarity, derived from the full catalog above.
const CARDS_BY_RARITY = Object.entries(UPGRADE_CARDS).reduce((acc, [id, c]) => {
  (acc[c.rarity] ||= []).push(id)
  return acc
}, {})

// Roll one card slot's rarity as a cascade of independent "upgrade" chances. Each
// slot starts as a basic (white) card; it has a 15% chance to upgrade to green,
// else a 10% chance for blue, else 5% for purple, else 1% for orange/legendary —
// and if none of those hit, it stays white.
const rollRarity = () => {
  if (Math.random() < 0.15) return 'uncommon'   // green
  if (Math.random() < 0.10) return 'rare'       // blue
  if (Math.random() < 0.05) return 'epic'       // purple
  if (Math.random() < 0.01) return 'legendary'  // orange
  return 'basic'                                 // white
}

// Draw n distinct cards: each slot rolls its own rarity, then picks a random card
// of that rarity. If a rolled tier has no unused cards left, it falls back to a
// basic one (then to anything) so the draw always fills.
export const pickUpgrades = (n = 3) => {
  const chosen = [], used = new Set()
  let guard = 0
  while (chosen.length < n && guard++ < 200) {
    const rarity = rollRarity()
    let bucket = (CARDS_BY_RARITY[rarity] || []).filter(id => !used.has(id))
    if (!bucket.length) bucket = (CARDS_BY_RARITY.basic || []).filter(id => !used.has(id))
    if (!bucket.length) bucket = Object.keys(UPGRADE_CARDS).filter(id => !used.has(id))
    if (!bucket.length) break
    const id = bucket[(Math.random() * bucket.length) | 0]
    used.add(id)
    chosen.push({ id, ...UPGRADE_CARDS[id] })
  }
  return chosen
}

// A single upgrade card. Reused by the post-battle pick and the debug card vault.
// `card` is a UPGRADE_CARDS entry; `badge` is optional corner content (e.g. owned count).
export function UpgradeCard({ card, onClick, cta = 'SELECT ▸', badge = null }) {
  const { rarity, tag, title, desc, Icon } = card
  return (
    <button className={`up-card up-card--${rarity}`} onClick={onClick}>
      {badge}
      <span className="up-card-top">
        <span className="up-card-rarity">{RARITY_LABEL[rarity]}</span>
        <span className="up-card-tag">{tag}</span>
      </span>
      <span className="up-card-icon"><Icon /></span>
      <span className="up-card-name">{title}</span>
      <span className="up-card-desc">{desc}</span>
      <span className="up-card-cta">{cta}</span>
    </button>
  )
}

// Post-victory roguelike upgrade pick. `onChoose(id)` applies the choice and
// continues. The three options are drawn at random from UPGRADE_POOL.
export default function UpgradeScreen({ onChoose }) {
  const [options] = useState(() => pickUpgrades(3))
  const innerRef = useScreenScale(SCREEN_DESIGN_HEIGHT)
  return (
    <div id="upgrade-screen">
      <div className="up-inner" ref={innerRef}>
        <div className="up-head">
          <div className="up-eyebrow">◆ FIELD REFIT ◆</div>
          <div className="up-title">SELECT AN AUGMENT</div>
          <div className="up-sub">VICTORY SECURED // CHOOSE ONE UPGRADE FOR YOUR FLEET</div>
        </div>
        <div className="up-cards">
          {options.map((card) => (
            <UpgradeCard key={card.id} card={card} onClick={() => onChoose(card.id)} />
          ))}
        </div>
      </div>
    </div>
  )
}
