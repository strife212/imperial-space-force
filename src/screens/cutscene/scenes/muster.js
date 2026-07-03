import * as THREE from 'three'
import { TEAMS } from '../../battle/constants'
import { buildBlueModel, makeRingedPlanet } from '../../battle/geometry'
import { buildFleet } from '../actors'
import { buildStation, asteroidField } from '../models'
import { getFlag } from '../../../lib/store'

// The Empire answers the Cassiopeia's distress: the first true muster in a
// generation, the fleet gathering at a drydock before it advances — stragglers
// still warping in.
const LINE1 = 'Every ship the Throne could spare. The first true muster in a generation.'
// LINE2 names the player's chosen fleet, e.g. "Fleet Concordia — advance. …"

export default {
  label: 'CUTSCENE / THE MUSTER',
  establishing: { name: 'IMPERIAL FLEET DRYDOCK', sub: 'The First Muster in a Generation', stamp: 'FLEET COMMAND BUS · STRATCON 3 IN EFFECT' },
  feed: [
    { t: 0.8,  level: 'info', text: 'Muster roll: 3rd, 7th and 11th interceptor wings · present' },
    { t: 3.2,  level: 'ok',   text: '[OK] Drydock umbilicals retracted · reactors to cruise flux' },
    { t: 5.6,  level: 'info', text: 'Late arrivals translating in · lanes 4–7 cleared' },
    { t: 8.9,  level: 'info', text: 'Fleet chord tuned · entangled comms synced via Litania Magna' },
    { t: 12.2, level: 'ok',   text: '[OK] Advance order committed · geodesic laid for the warfront' },
  ],
  readout: {
    id: 'Fleet Command · PNL-009',
    rows: [
      { label: 'Hulls',     value: (t) => `${Math.min(54, 41 + Math.floor(t * 1.2))}` },
      { label: 'Reactors',  value: 'NOMINAL' },
      { label: 'Formation', value: (t) => (t < 9 ? 'CONVERGING' : 'LOCKED') },
    ],
  },
  bloom: 0.6,
  create(ctx) {
    const { scene, camera, fx, comms, end, orient } = ctx
    const fleetName = getFlag('fleetName') || 'Fleet Polyhymnia'
    const LINE2 = `${fleetName} — advance. Find what silenced the Cassiopeia.`
    const fleet = buildFleet(ctx, { team: 'blue', fighters: 34, bombers: 14, cruisers: 6 })

    // the muster point: a drydock station the fleet forms up around, and a quiet
    // ringed world + debris far behind
    const station = buildStation(); station.position.set(0, 26, -46); station.scale.setScalar(2.4); scene.add(station)
    makeRingedPlanet(scene, [], new THREE.Vector3(170, -30, -150), new THREE.Vector3(0.4, 0.5, 0.6).normalize())
    const field = asteroidField(ctx, { count: 30, center: new THREE.Vector3(0, 0, -20), inner: 80, outer: 200, scaleMax: 4 })

    // late arrivals streak in from the dark and slot into the formation
    const arrMat = new THREE.MeshStandardMaterial({ color: TEAMS.blue.color, emissive: TEAMS.blue.color, emissiveIntensity: 0.55, metalness: 0.6, roughness: 0.4 })
    const _t = new THREE.Vector3(), _d = new THREE.Vector3()
    const arrivals = []
    for (let i = 0; i < 7; i++) {
      const g = new THREE.Group(); g.add(new THREE.Mesh(buildBlueModel(), arrMat))
      const glow = new THREE.Mesh(fx.blastGeo, fx.glowMat.blue); glow.scale.setScalar(0.3); glow.position.set(0, 0, -0.95); g.add(glow)
      scene.add(g)
      const offset = new THREE.Vector3((Math.random() - 0.5) * 34, (Math.random() - 0.5) * 16, (Math.random() - 0.5) * 34)
      const dir = new THREE.Vector3(Math.random() - 0.5, (Math.random() - 0.5) * 0.4, Math.random() - 0.5).normalize()
      const from = new THREE.Vector3().copy(fleet.group.position).add(offset).addScaledVector(dir, 200)
      g.position.copy(from)
      arrivals.push({ g, from, offset, t: 0, dur: 1.1 + i * 0.45, arrived: false, trail: fx.makeTrail(TEAMS.blue.bolt, 5) })
    }

    const center = new THREE.Vector3(), off = new THREE.Vector3(-10, 2, 0)
    const place = (az) => {
      center.copy(fleet.group.position).add(off)
      camera.position.set(center.x + 104 * Math.cos(az), center.y + 30 + 8 * Math.sin(az * 0.5), center.z + 104 * Math.sin(az))
      camera.lookAt(center)
    }
    place(0.6)

    let T = 0, c1 = false, c2 = false, ended = false
    return (dt) => {
      T += dt
      fleet.group.position.x += 5 * dt
      field.tick(dt)
      station.rotation.y += 0.05 * dt
      place(0.6 + 0.32 * T)

      for (const a of arrivals) {
        if (a.arrived) continue
        a.t += dt
        const p = Math.min(1, a.t / a.dur), e = 1 - Math.pow(1 - p, 3)
        _t.copy(fleet.group.position).add(a.offset)
        a.g.position.lerpVectors(a.from, _t, e)
        orient(a.g, _d.subVectors(_t, a.from))
        if (p < 0.92) a.trail(a.g.position)
        if (p >= 1) { a.arrived = true; scene.remove(a.g); fleet.group.add(a.g); a.g.position.copy(a.offset); orient(a.g, new THREE.Vector3(1, 0, 0)) }
      }

      if (!c1 && T >= 1.4) { c1 = true; comms.show('Princess Astraia', LINE1, { persist: true }) }
      if (!c2 && T >= 8.5) { c2 = true; comms.show('Admiralty Command', LINE2, { persist: true }) }
      if (!ended && T >= 16) { ended = true; end() }
    }
  },
}
