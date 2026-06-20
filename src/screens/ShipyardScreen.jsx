import { useState } from 'react'
import HudHeader from '../components/HudHeader'
import HudFooter from '../components/HudFooter'
import { ShipSprite, ShipInfoTip } from './battle/RosterUI'
import { splitCapName } from './battle/constants'
import {
  NODE_BATTLES, SHIP_COST, getFleet, setFleet, getCredits, spendCredits, addCredits,
  fleetStrength, getFlagshipName,
} from '../lib/campaign'
import './shipyard.css'

const KINDS = [
  { key: 'fighters', kind: 'fighter', label: 'Interceptors' },
  { key: 'bombers',  kind: 'bomber',  label: 'Heavy Bombers' },
  { key: 'cruisers', kind: 'cruiser', label: 'Missile Cruisers' },
]

// A wrapped row of ship silhouettes, capped so a huge enemy fleet stays readable.
function SpriteRow({ team, kind, count, max = 16 }) {
  if (count === 0) return <div className="sy-sprites sy-sprites--empty">— none —</div>
  return (
    <div className="sy-sprites">
      {Array.from({ length: Math.min(count, max) }, (_, i) => <ShipSprite key={i} team={team} kind={kind} />)}
      {count > max && <span className="sy-sprites-more">+{count - max}</span>}
    </div>
  )
}

export default function ShipyardScreen({ nodeIndex, onDeploy, onExit }) {
  const node = NODE_BATTLES[nodeIndex] || NODE_BATTLES[0]
  const [fleet,   setFleetState]   = useState(getFleet)
  const [credits, setCreditsState] = useState(getCredits)
  const flagship = splitCapName(getFlagshipName())

  // Buy / sell persist to the store immediately so the map HUD and the deploy
  // both read true state. Selling refunds the full cost — the shipyard is a
  // planning bench, not a sink.
  const buy = (key) => {
    const cost = SHIP_COST[key]
    if (getCredits() < cost) return
    spendCredits(cost)
    const nf = { ...getFleet(), [key]: getFleet()[key] + 1 }
    setFleet(nf); setFleetState(nf); setCreditsState(getCredits())
  }
  const sell = (key) => {
    if (getFleet()[key] <= 0) return
    addCredits(SHIP_COST[key])
    const nf = { ...getFleet(), [key]: Math.max(0, getFleet()[key] - 1) }
    setFleet(nf); setFleetState(nf); setCreditsState(getCredits())
  }

  // strength readouts (flagship is always present on both sides → +1 capital each)
  const enemyComp  = node.enemy
  const yourStr    = fleetStrength(fleet)
  const enemyStr   = fleetStrength(enemyComp)
  const ratio      = enemyStr > 0 ? yourStr / enemyStr : 2
  const odds       = ratio >= 1.1 ? { cls: 'good', text: 'FAVOURABLE' }
                   : ratio >= 0.85 ? { cls: 'even', text: 'EVENLY MATCHED' }
                   : { cls: 'bad',  text: 'OUTMATCHED' }
  const finale     = nodeIndex === NODE_BATTLES.length - 1

  return (
    <div id="shipyard-screen">
      <HudHeader onLogout={onExit} right={<span className="label">FLEET COMMAND // SHIPYARD</span>} />

      <div className="sy-body">
        <div className="sy-opbar">
          <div className="sy-op">
            <span className="sy-op-num">OPERATION {String(nodeIndex + 1).padStart(2, '0')}</span>
            <span className="sy-op-title">{node.title}{finale && <span className="sy-op-finale">★ FINALE</span>}</span>
          </div>
          <div className="sy-credits">
            <span className="sy-credits-val">{credits.toLocaleString()}</span>
            <span className="sy-credits-label">REQUISITION</span>
          </div>
        </div>

        <p className="sy-brief">{node.brief}</p>

        <div className="sy-cols">
          {/* ── Your fleet — buildable ───────────────────────────────────── */}
          <section className="sy-panel sy-panel--blue">
            <div className="sy-panel-head">
              <h2>YOUR FLEET</h2>
              <span className={`sy-strength sy-strength--${odds.cls}`}>STRENGTH {yourStr.toLocaleString()}</span>
            </div>

            <div className="sy-flagship">
              <ShipSprite team="blue" kind="capital" />
              <div className="sy-flagship-info">
                {flagship.prefix && <div className="sy-flagship-prefix">{flagship.prefix}</div>}
                <div className="sy-flagship-name">{flagship.name}</div>
                <div className="sy-flagship-class">FLAGSHIP · ALWAYS DEPLOYED</div>
              </div>
            </div>

            {KINDS.map(({ key, kind, label }) => {
              const cost = SHIP_COST[key]
              return (
                <div className="sy-row" key={key}>
                  <div className="sy-row-head">
                    <span className="sy-row-label">{label} <ShipInfoTip kind={kind} team="blue" /></span>
                    <span className="sy-row-count">×{fleet[key]}</span>
                  </div>
                  <SpriteRow team="blue" kind={kind} count={fleet[key]} />
                  <div className="sy-row-buy">
                    <button className="sy-btn sy-btn--sell" onClick={() => sell(key)} disabled={fleet[key] <= 0} aria-label={`Sell ${label}`}>−</button>
                    <span className="sy-cost">{cost} REQ</span>
                    <button className="sy-btn sy-btn--buy" onClick={() => buy(key)} disabled={credits < cost} aria-label={`Buy ${label}`}>+</button>
                  </div>
                </div>
              )
            })}
          </section>

          {/* ── Enemy fleet — fixed intel ────────────────────────────────── */}
          <section className="sy-panel sy-panel--red">
            <div className="sy-panel-head">
              <h2>ENEMY FORCES</h2>
              <span className="sy-strength sy-strength--enemy">STRENGTH {enemyStr.toLocaleString()}</span>
            </div>

            <div className="sy-flagship sy-flagship--red">
              <ShipSprite team="red" kind="capital" />
              <div className="sy-flagship-info">
                <div className="sy-flagship-name">{node.enemyName}</div>
                <div className="sy-flagship-class">ENEMY FLAGSHIP</div>
              </div>
            </div>

            {KINDS.map(({ key, kind, label }) => (
              <div className="sy-row sy-row--intel" key={key}>
                <div className="sy-row-head">
                  <span className="sy-row-label">{label}</span>
                  <span className="sy-row-count">×{enemyComp[key] || 0}</span>
                </div>
                <SpriteRow team="red" kind={kind} count={enemyComp[key] || 0} />
              </div>
            ))}

            <div className={`sy-odds sy-odds--${odds.cls}`}>
              <span className="sy-odds-label">ASSESSMENT</span>
              <span className="sy-odds-val">{odds.text}</span>
            </div>
          </section>
        </div>

        <div className="sy-actions">
          <button className="sy-back" onClick={onExit}>↩ RETURN TO MAP</button>
          <button className="sy-deploy" onClick={() => onDeploy(fleet)}>DEPLOY FLEET ▶</button>
        </div>
      </div>

      <HudFooter>
        <span>HMSS / FLEET COMMAND / REQUISITION &amp; MUSTER</span>
        <span className="sep">│</span>
        <span>OPERATION: <em className="ok">{node.title.toUpperCase()}</em></span>
      </HudFooter>
    </div>
  )
}
