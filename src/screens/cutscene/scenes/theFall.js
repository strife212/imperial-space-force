import * as THREE from 'three'
import { makeRingedPlanet } from '../../battle/geometry'
import { createFlagship, buildFleet } from '../actors'
import { asteroidField } from '../models'

// The cost: a flagship and its escort are swarmed and lost. The fleet that
// learned the habits of a parade meets a foe that does not parade.
const LINE1 = 'We cannot hold them. Half the line is gone already.'
const LINE2 = 'Fall back to the Throneworld. We make our stand where she hears.'

export default {
  label: 'CUTSCENE / THE FALL',
  establishing: { name: 'THE FALL', sub: 'The Line Breaks', stamp: 'FLEET LOSS RECORD · STRATCON 2 IN EFFECT' },
  feed: [
    { t: 1.0,  level: 'crit', text: 'Escort screen collapsing · half the line gone' },
    { t: 3.5,  level: 'warn', text: 'Flagship shields buckling · armour ablating' },
    { t: 6.0,  level: 'crit', text: '[FAIL] Damage control overwhelmed · decks 4–9 open to vacuum' },
    { t: 9.0,  level: 'crit', text: 'Flag bridge: abandon-ship checklist unsealed' },
    { t: 12.0, level: 'warn', text: 'Withdrawal geodesic laid · Throneworld anchorage' },
  ],
  readout: {
    id: 'Hull Monitor · Flag',
    rows: [
      { label: 'Hull',    value: (t) => `${Math.max(0, Math.floor(62 - t * 2.5))}%` },
      { label: 'Escorts', value: (t) => `${Math.max(3, 15 - Math.floor(t * 0.55))}` },
      { label: 'Order',   value: (t) => (t < 12 ? 'HOLD' : 'WITHDRAW') },
    ],
  },
  bloom: 0.8,
  create(ctx) {
    const { scene, camera, fx, comms, end, orient } = ctx
    const flagship = createFlagship(ctx, {
      deathDrift: 0.4,
      onDestroyed: () => { comms.show('Admiralty Command', LINE2, { persist: true }); end({ holdMs: 3800 }) },
    })
    flagship.ship.pos.set(0, 0, 0)
    orient(flagship.group, new THREE.Vector3(1, 0, 0))

    const escort = buildFleet(ctx, { team: 'blue', fighters: 12, cruisers: 3, capital: false, ringR: 16 })   // the dwindling line
    const swarm = buildFleet(ctx, { team: 'red', fighters: 34, bombers: 12, cruisers: 5, capital: false, ringR: 36 })
    makeRingedPlanet(scene, [], new THREE.Vector3(60, -20, -150), new THREE.Vector3(0.4, 0.5, 0.6).normalize())   // the Throneworld they flee toward
    const field = asteroidField(ctx, { count: 22, center: new THREE.Vector3(0, 0, 0), inner: 60, outer: 190, scaleMax: 4 })

    const _a = new THREE.Vector3()
    let T = 0, c1 = false, ended = false, fireCd = 0, dmgCd = 0, killCd = 2, shake = 0
    return (dt) => {
      T += dt
      field.tick(dt)
      swarm.group.rotation.y += 0.06 * dt   // the noose tightens
      flagship.tick(dt)

      if (T > 1.5 && flagship.ship.alive) {
        fireCd -= dt
        if (fireCd <= 0) {
          const s = swarm.ships[Math.floor(Math.random() * swarm.ships.length)]
          if (s) { s.getWorldPosition(_a); fx.bolt(_a, flagship.ship.pos, 0xff7a5a, { speed: 95 }) }
          // also rake the escorts
          const e = escort.ships[Math.floor(Math.random() * escort.ships.length)]
          if (e && e.visible) { e.getWorldPosition(_a); if (Math.random() < 0.5) fx.bolt(swarm.ships[0].getWorldPosition(new THREE.Vector3()), _a, 0xff7a5a, { speed: 95 }) }
          fireCd = 0.04
        }
        dmgCd -= dt; if (dmgCd <= 0) { flagship.damage(4); shake = Math.min(1.2, shake + 0.5); dmgCd = 0.35 }
        killCd -= dt
        if (killCd <= 0) { const live = escort.ships.filter(s => s.visible); if (live.length) { const v = live[Math.floor(Math.random() * live.length)]; v.getWorldPosition(_a); fx.blast(_a, true); v.visible = false; shake = Math.min(1.4, shake + 0.6) } killCd = 1.4 + Math.random() }
      }

      // closing camera, behind-and-above the doomed ship, shuddering on hits
      shake = Math.max(0, shake - dt * 1.5)
      const d = 56 - Math.min(20, T * 1.3)
      camera.position.set(-d + (Math.random() - 0.5) * shake * 3, 16 + (Math.random() - 0.5) * shake * 2, d * 0.9)
      camera.lookAt(flagship.ship.pos.x + 4, 0, 0)

      if (!c1 && T >= 1.5) { c1 = true; comms.show('Princess Astraia', LINE1) }
      if (!ended && T >= 26) { ended = true; end({ holdMs: 0 }) }   // safety net
    }
  },
}
