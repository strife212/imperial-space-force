import { useRef, useEffect, useState } from 'react'
import * as THREE from 'three'
import HudHeader from '../components/HudHeader'
import { createStage } from './cutscene/stage'
import { buildReviewFleet } from './buildReviewFleet'
import { SHIP_COST, getFleet, setFleet as storeSetFleet, getCredits, spendCredits, addCredits, getFlagshipName } from '../lib/campaign'
import { getFlag } from '../lib/store'
import './fleet-review.css'

const KINDS = [
  { key: 'fighters', label: 'Interceptors' },
  { key: 'bombers',  label: 'Heavy Bombers' },
  { key: 'cruisers', label: 'Missile Cruisers' },
]

// A 3D parade of the player's standing fleet that doubles as a fleet editor:
// add / remove ships at their proper Requisition cost (full refund on removal,
// matching the shipyard) and watch the formation rebuild in real time.
export default function FleetReview({ onExit }) {
  const mountRef = useRef(null)
  const [fleet, setFleet] = useState(getFleet)
  const [credits, setCredits] = useState(getCredits)
  const flagshipName = getFlagshipName()
  const fleetName = getFlag('fleetName') || 'Fleet Polyhymnia'

  const rebuildRef = useRef(null)   // set by the scene; call with a comp to rebuild

  useEffect(() => {
    const mount = mountRef.current
    if (!mount) return
    const el = 0.40   // camera elevation (radians)
    const sceneDef = {
      bloom: 0.75,
      create(ctx) {
        const { camera } = ctx
        let current = null
        const targetCenter = new THREE.Vector3()
        const curCenter = new THREE.Vector3()
        let targetDist = 100, curDist = 100, first = true

        const build = (comp) => {
          if (current) current.dispose()
          current = buildReviewFleet(ctx, comp)
          targetCenter.copy(current.center)
          const fov = (camera.fov * Math.PI) / 180
          targetDist = (current.radius / Math.sin(fov / 2)) * 0.92
          if (first) { curCenter.copy(targetCenter); curDist = targetDist; first = false }
        }
        build(getFleet())
        rebuildRef.current = build

        let T = 0
        return (dt) => {
          T += dt
          const k = 1 - Math.exp(-4 * dt)          // ease camera as the fleet reflows
          curCenter.lerp(targetCenter, k)
          curDist += (targetDist - curDist) * k
          const az = 0.7 + T * 0.1                  // slow orbit
          camera.position.set(
            curCenter.x + Math.cos(az) * Math.cos(el) * curDist,
            curCenter.y + Math.sin(el) * curDist + current.radius * 0.04,
            curCenter.z + Math.sin(az) * Math.cos(el) * curDist,
          )
          camera.lookAt(curCenter.x, curCenter.y, curCenter.z)
        }
      },
    }
    const teardown = createStage(mount, sceneDef, {})
    return () => { rebuildRef.current = null; teardown() }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // persist + refresh UI + rebuild the 3D formation
  const apply = (next) => { storeSetFleet(next); setFleet(next); rebuildRef.current?.(next) }
  const buy = (key) => {
    const cost = SHIP_COST[key]
    if (getCredits() < cost) return
    spendCredits(cost); setCredits(getCredits())
    apply({ ...getFleet(), [key]: getFleet()[key] + 1 })
  }
  const sell = (key) => {
    if (getFleet()[key] <= 0) return
    addCredits(SHIP_COST[key]); setCredits(getCredits())
    apply({ ...getFleet(), [key]: Math.max(0, getFleet()[key] - 1) })
  }

  return (
    <div id="fleet-review">
      <HudHeader onLogout={onExit} right={<span className="label">FLEET REVIEW</span>} />
      <div className="fr-stage">
        <div className="fr-canvas" ref={mountRef} />

        <div className="fr-panel">
          <div className="fr-name">{fleetName}</div>
          <div className="fr-flagship">⬢ {flagshipName} · FLAGSHIP</div>

          <div className="fr-req">
            <span className="fr-req-val">{credits.toLocaleString()}</span>
            <span className="fr-req-label">REQUISITION</span>
          </div>

          <div className="fr-rows">
            {KINDS.map(({ key, label }) => {
              const cost = SHIP_COST[key]
              return (
                <div className="fr-row" key={key}>
                  <div className="fr-row-top">
                    <span className="fr-row-label">{label}</span>
                    <span className="fr-row-count">×{fleet[key]}</span>
                  </div>
                  <div className="fr-row-ctrl">
                    <button className="fr-btn" onClick={() => sell(key)} disabled={fleet[key] <= 0} aria-label={`Remove ${label}`}>−</button>
                    <span className="fr-cost">{cost} REQ</span>
                    <button className="fr-btn fr-btn--buy" onClick={() => buy(key)} disabled={credits < cost} aria-label={`Add ${label}`}>+</button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        <button className="fr-back" onClick={onExit}>◂ RETURN TO MAP</button>
      </div>
    </div>
  )
}
