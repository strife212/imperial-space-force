import { useEffect, useRef, useState } from 'react'
import { useScreenScale, SCREEN_DESIGN_HEIGHT } from '../hooks/useScreenScale'
import { addUpgrade, getUpgrades } from '../lib/campaign'
import { pickUpgrades, UpgradeCard, UPGRADE_CARDS } from './UpgradeScreen'
import './upgrade.css'
import './draw-test.css'

// Per-rarity accent for the owned-cards list (mirrors the card tone classes).
const RARITY_COLOR = { legendary: '#ffb454', epic: '#c39bff', rare: '#5fb0ff', uncommon: '#6ef0a6', basic: '#cfdcf5' }
const RARITY_RANK = { legendary: 0, epic: 1, rare: 2, uncommon: 3, basic: 4 }

// Debug card collector: shows a random three-card draw (rolled by the same rarity
// odds as the post-battle pick). Clicking a card grants that upgrade and re-rolls;
// the right-hand panel lists everything you currently own. Reached from the
// Z-toggled campaign debug controls.
export default function DrawTestScreen({ onBack }) {
  const [draw, setDraw] = useState(() => pickUpgrades(3))
  const [owned, setOwned] = useState(() => getUpgrades())
  const [picked, setPicked] = useState(null)
  const innerRef = useScreenScale(SCREEN_DESIGN_HEIGHT)
  const clickSfx = useRef(null)
  useEffect(() => {
    const a = new Audio(`${import.meta.env.BASE_URL}click.wav`); a.preload = 'auto'; clickSfx.current = a
  }, [])

  const reroll = () => setDraw(pickUpgrades(3))
  // same taken animation as the post-battle pick: dip + plus, then collect
  const collect = (id) => {
    if (picked) return
    if (clickSfx.current) { clickSfx.current.currentTime = 0; clickSfx.current.play().catch(() => {}) }
    setPicked(id)
    setTimeout(() => {
      addUpgrade(id)
      setOwned({ ...getUpgrades() })
      setPicked(null)
      reroll()
    }, 1000)
  }

  const entries = Object.entries(owned)
    .filter(([id, lvl]) => lvl > 0 && UPGRADE_CARDS[id])
    .map(([id, lvl]) => ({ id, lvl, card: UPGRADE_CARDS[id] }))
    .sort((a, b) => (RARITY_RANK[a.card.rarity] - RARITY_RANK[b.card.rarity]) || a.card.title.localeCompare(b.card.title))
  const total = entries.reduce((s, e) => s + e.lvl, 0)

  return (
    <div id="draw-test">
      <div className="dt-main">
        <div className="up-inner" ref={innerRef}>
          <div className="up-head">
            <div className="up-eyebrow">⚡ DEBUG · CARD COLLECTOR ⚡</div>
            <div className="up-title">RANDOM CARD DRAW</div>
            <div className="up-sub">CLICK A CARD TO COLLECT IT — IT ADDS TO YOUR LIST AND RE-ROLLS</div>
          </div>
          <div className={`up-cards${picked ? ' up-cards--locked' : ''}`}>
            {draw.map((card) => (
              <UpgradeCard key={card.id} card={card} picked={picked === card.id} onClick={() => collect(card.id)} cta="✚ COLLECT" />
            ))}
          </div>
          <div className="up-debug-controls">
            <button className="up-debug-btn" onClick={onBack}>◂ BACK TO MAP</button>
            <button className="up-debug-btn up-debug-btn--go" onClick={reroll}>↻ RE-ROLL</button>
          </div>
        </div>
      </div>

      <aside className="dt-owned">
        <div className="dt-owned-head">
          <div className="dt-owned-title">CARDS OWNED</div>
          <div className="dt-owned-count">{total} TOTAL</div>
        </div>
        <div className="dt-owned-list">
          {entries.length === 0 && <div className="dt-owned-empty">No cards collected yet.</div>}
          {entries.map(({ id, lvl, card }) => (
            <div className="dt-owned-row" key={id} style={{ '--row': RARITY_COLOR[card.rarity] }}>
              <span className="dt-owned-dot" />
              <span className="dt-owned-name">{card.title}</span>
              <span className="dt-owned-x">×{lvl}</span>
            </div>
          ))}
        </div>
      </aside>
    </div>
  )
}
