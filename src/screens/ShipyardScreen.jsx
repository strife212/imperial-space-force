import { useState } from 'react'
import HudHeader from '../components/HudHeader'
import HudFooter from '../components/HudFooter'
import { ShipSprite, ShipInfoTip } from './battle/RosterUI'
import { useFitScale } from '../hooks/useScreenScale'
import { splitCapName } from './battle/constants'
import {
  NODE_BATTLES, SHIP_COST, getFleet, setFleet, getCredits, spendCredits, addCredits,
  fleetStrength, getFlagshipName, getUnsellableFighters, getUpgrades, upgradeStatLines,
} from '../lib/campaign'
import { getEnemyUpgrades } from '../lib/enemyCards'
import './shipyard.css'

const KINDS = [
  { key: 'fighters', kind: 'fighter', label: 'Interceptors' },
  { key: 'bombers',  kind: 'bomber',  label: 'Heavy Bombers' },
  { key: 'cruisers', kind: 'cruiser', label: 'Missile Cruisers' },
]

// A fleet's card-buff tally — "3 FLEET UPGRADES" — with the combined per-stat
// effects (the Fleet Review's list) revealed on hover. Used on both panels:
// the player's owned cards, and the enemy node's rolled buffs (battle 5+).
function UpgradeTally({ upgrades, side, title }) {
  const count = Object.values(upgrades).reduce((s, lvl) => s + lvl, 0)
  if (!count) return null
  const lines = upgradeStatLines(upgrades)
  return (
    <div className={`sy-upg sy-upg--${side}`}>
      <span className="sy-upg-count">{count} FLEET UPGRADE{count > 1 ? 'S' : ''}</span>
      <div className="sy-upg-tip">
        <div className="sy-upg-tip-title">{title}</div>
        {lines.map((l) => (
          <div className={`sy-upg-line${l.gold ? ' sy-upg-line--gold' : ''}`} key={l.text}>{l.text}</div>
        ))}
      </div>
    </div>
  )
}

// A wrapped row of ship silhouettes, capped so a huge enemy fleet stays readable.
function SpriteRow({ team, kind, count, locked = 0, max = 16 }) {
  if (count === 0) return <div className="sy-sprites sy-sprites--empty">— none —</div>
  // Locked (permanent) ships are drawn first so they're always visible — even
  // when the row is capped and the rest spill into the "+N" overflow.
  const shown = Math.min(count, max)
  const lockedShown = Math.min(locked, shown)
  const normalShown = shown - lockedShown
  return (
    <div className="sy-sprites">
      {Array.from({ length: lockedShown }, (_, i) => <ShipSprite key={`L${i}`} team={team} kind={kind} locked />)}
      {Array.from({ length: normalShown }, (_, i) => <ShipSprite key={`N${i}`} team={team} kind={kind} />)}
      {count > max && <span className="sy-sprites-more">+{count - max}</span>}
    </div>
  )
}

export default function ShipyardScreen({ nodeIndex, onDeploy, onExit, onPreview }) {
  const node = NODE_BATTLES[nodeIndex] || NODE_BATTLES[0]
  const [fleet,   setFleetState]   = useState(getFleet)
  const [credits, setCreditsState] = useState(getCredits)
  const unsellable = getUnsellableFighters()   // permanent fighters granted by upgrades
  const flagship = splitCapName(getFlagshipName())
  const fitRef = useFitScale()   // scale the body to fit between header/footer

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

  // enemy card buffs (battle 5+): rolled once per campaign for this node, then
  // fixed — the intel here shows exactly what deploys, including any volunteer
  // fighters the buffs add to the enemy comp
  const enemyUpgrades  = getEnemyUpgrades(nodeIndex)
  const playerUpgrades = getUpgrades()

  // strength readouts (flagship is always present on both sides → +1 capital each)
  const enemyComp  = { ...node.enemy, fighters: node.enemy.fighters + (enemyUpgrades.unsellableFighter || 0) }
  const yourStr    = fleetStrength({ ...fleet, fighters: fleet.fighters + unsellable })
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
       <div className="sy-fit" ref={fitRef}>
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
              <UpgradeTally upgrades={playerUpgrades} side="blue" title="FLEET AUGMENTS" />
            </div>

            {KINDS.map(({ key, kind, label }) => {
              const cost = SHIP_COST[key]
              const locked = key === 'fighters' ? unsellable : 0
              const shown = fleet[key] + locked
              return (
                <div className="sy-row" key={key}>
                  <div className="sy-row-head">
                    <span className="sy-row-label">{label} <ShipInfoTip kind={kind} team="blue" /></span>
                    <span className="sy-row-count">×{shown}</span>
                  </div>
                  <SpriteRow team="blue" kind={kind} count={shown} locked={locked} />
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
              <UpgradeTally upgrades={enemyUpgrades} side="red" title="ENEMY AUGMENTS" />
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
          <div className="sy-actions-right">
            {onPreview && <button className="sy-preview" onClick={onPreview}>◉ PREVIEW FLEET</button>}
            <button className="sy-deploy" onClick={() => onDeploy(fleet)}>DEPLOY FLEET ▶</button>
          </div>
        </div>
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
