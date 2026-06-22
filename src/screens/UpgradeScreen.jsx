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

// ── Upgrade pool ─────────────────────────────────────────────────────────────
// Extensible: add entries here and the screen will randomly draw three each time.
const UPGRADE_POOL = [
  { id: 'capMissile',       tone: 'purple', tag: 'FLAGSHIP', title: 'SPINAL MISSILE BATTERY', desc: 'Mount a homing-missile launcher on your flagship — it lobs a guided missile at the enemy throughout the battle.', Icon: MissileIcon },
  { id: 'unsellableFighter', tone: 'green',  tag: 'FLEET',    title: 'VOLUNTEER WING',         desc: 'A permanent interceptor joins your fleet. It deploys every battle and can never be decommissioned.', Icon: LockFighterIcon },
  { id: 'capHp',            tone: 'white',  tag: 'FLAGSHIP', title: 'REINFORCED HULL',        desc: 'Plate the flagship with extra armour — +5 maximum hull integrity, permanently.', Icon: HullIcon },
]

const pickUpgrades = (n = 3) => {
  const a = [...UPGRADE_POOL]
  for (let i = a.length - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0;[a[i], a[j]] = [a[j], a[i]] }
  return a.slice(0, n)
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
          {options.map(({ id, tone, tag, title, desc, Icon }) => (
            <button key={id} className={`up-card up-card--${tone}`} onClick={() => onChoose(id)}>
              <span className="up-card-tag">{tag}</span>
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
