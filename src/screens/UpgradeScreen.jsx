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

// ── Rarity tiers ─────────────────────────────────────────────────────────────
// Drives each card's colour and (later) its chance of appearing.
//   legendary=orange · epic=purple · rare=blue · uncommon=green · basic=white
const RARITY_LABEL = { legendary: 'LEGENDARY', epic: 'EPIC', rare: 'RARE', uncommon: 'UNCOMMON', basic: 'BASIC' }

// ── Upgrade catalog ──────────────────────────────────────────────────────────
// Every defined upgrade card. POOL_IDS controls which are currently offered —
// add an id there to put a card into the post-battle rotation.
const UPGRADE_CARDS = {
  capMissile:        { rarity: 'epic',      tag: 'FLAGSHIP', title: 'SPINAL MISSILE BATTERY', desc: 'Mount a homing-missile launcher on your flagship — it lobs a guided missile at the enemy throughout the battle.', Icon: MissileIcon },
  unsellableFighter: { rarity: 'uncommon',  tag: 'FLEET',    title: 'VOLUNTEER WING',         desc: 'A permanent interceptor joins your fleet. It deploys every battle and can never be decommissioned.', Icon: LockFighterIcon },
  capHp:             { rarity: 'basic',     tag: 'FLAGSHIP', title: 'REINFORCED HULL',        desc: 'Plate the flagship with extra armour — +5 maximum hull integrity, permanently.', Icon: HullIcon },
  // Defined but not yet offered (see POOL_IDS):
  macroMissile:      { rarity: 'legendary', tag: 'FLAGSHIP', title: 'MACRO-MISSILE BARRAGE',  desc: 'A second admiral skill: lock onto 10 random targets, then loose a missile at each in one fanning barrage.', Icon: BarrageIcon },
}
const POOL_IDS = ['capMissile', 'unsellableFighter', 'capHp']   // macroMissile intentionally excluded for now

const pickUpgrades = (n = 3) => {
  const a = [...POOL_IDS]
  for (let i = a.length - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0;[a[i], a[j]] = [a[j], a[i]] }
  return a.slice(0, n).map(id => ({ id, ...UPGRADE_CARDS[id] }))
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
          {options.map(({ id, rarity, tag, title, desc, Icon }) => (
            <button key={id} className={`up-card up-card--${rarity}`} onClick={() => onChoose(id)}>
              <span className="up-card-top">
                <span className="up-card-rarity">{RARITY_LABEL[rarity]}</span>
                <span className="up-card-tag">{tag}</span>
              </span>
              <span className="up-card-icon"><Icon /></span>
              <span className="up-card-name">{title}</span>
              <span className="up-card-desc">{desc}</span>
              <span className="up-card-cta">SELECT ▸</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
