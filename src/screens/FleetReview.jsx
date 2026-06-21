import { useRef, useEffect } from 'react'
import HudHeader from '../components/HudHeader'
import { createStage } from './cutscene/stage'
import { buildReviewFleet } from './buildReviewFleet'
import { getFleet, getFlagshipName } from '../lib/campaign'
import { getFlag } from '../lib/store'
import './fleet-review.css'

// A 3D parade of the player's standing fleet — every owned ship rendered in a
// review formation, slowly orbited by the camera. Reuses the cutscene stage
// (renderer, lights, starfield, bloom, FX) and the formation fleet builder.
export default function FleetReview({ onExit }) {
  const mountRef = useRef(null)
  const fleet = getFleet()
  const flagshipName = getFlagshipName()
  const fleetName = getFlag('fleetName') || 'Fleet Polyhymnia'

  useEffect(() => {
    const mount = mountRef.current
    if (!mount) return
    const sceneDef = {
      bloom: 0.75,
      create(ctx) {
        const { camera } = ctx
        const { center, radius } = buildReviewFleet(ctx, fleet)
        const fov = (camera.fov * Math.PI) / 180
        const dist = (radius / Math.sin(fov / 2)) * 0.92   // frame the fleet (wide/flat, so fill the frame)
        const el = 0.40                                     // camera elevation (radians)
        let T = 0
        return (dt) => {
          T += dt
          const az = 0.7 + T * 0.1                          // slow orbit
          camera.position.set(
            center.x + Math.cos(az) * Math.cos(el) * dist,
            center.y + Math.sin(el) * dist + radius * 0.04,
            center.z + Math.sin(az) * Math.cos(el) * dist,
          )
          camera.lookAt(center.x, center.y, center.z)
        }
      },
    }
    const teardown = createStage(mount, sceneDef, {})
    return teardown
    // fleet read once on mount; the review is a static snapshot of the roster
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div id="fleet-review">
      <HudHeader onLogout={onExit} right={<span className="label">FLEET REVIEW</span>} />
      <div className="fr-stage">
        <div className="fr-canvas" ref={mountRef} />

        <div className="fr-hud">
          <div className="fr-name">{fleetName}</div>
          <div className="fr-flagship">⬢ {flagshipName} · FLAGSHIP</div>
          <div className="fr-counts">
            <span><b>{fleet.fighters}</b> INTERCEPTORS</span>
            <span><b>{fleet.bombers}</b> BOMBERS</span>
            <span><b>{fleet.cruisers}</b> CRUISERS</span>
          </div>
        </div>

        <button className="fr-back" onClick={onExit}>◂ RETURN TO MAP</button>
      </div>
    </div>
  )
}
