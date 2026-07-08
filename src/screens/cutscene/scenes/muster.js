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
    const { scene, camera, fx, sfx, comms, end, orient } = ctx
    const fleetName = getFlag('fleetName') || 'Fleet Polyhymnia'
    const LINE2 = `${fleetName} — advance. Find what silenced the Cassiopeia.`
    const fleet = buildFleet(ctx, { team: 'blue', fighters: 34, bombers: 14, cruisers: 6 })

    // the muster point: a drydock station the fleet forms up around, and a quiet
    // ringed world + debris far behind
    const station = buildStation(); station.position.set(0, 26, -46); station.scale.setScalar(2.4); scene.add(station)
    makeRingedPlanet(scene, [], new THREE.Vector3(170, -30, -150), new THREE.Vector3(0.4, 0.5, 0.6).normalize())
    const field = asteroidField(ctx, { count: 30, center: new THREE.Vector3(0, 0, -20), inner: 80, outer: 200, scaleMax: 4 })

    // drydock dressing: an approach-corridor floodlight cone off the lower pad
    // and a slow-blinking hazard beacon at the mast head
    const coneMat = new THREE.MeshBasicMaterial({ color: 0xffd28a, transparent: true, opacity: 0.05, blending: THREE.AdditiveBlending, depthWrite: false })
    const cone = new THREE.Mesh(new THREE.ConeGeometry(9, 34, 20, 1, true), coneMat)
    cone.position.set(0, -19 - 17, 0); station.add(cone)   // hangs below the lower docking pad
    const beaconMat = new THREE.MeshBasicMaterial({ color: 0xff6a52, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false })
    const beacon = new THREE.Mesh(fx.blastGeo, beaconMat); beacon.scale.setScalar(0.7); beacon.position.set(0, 19.5, 0); station.add(beacon)

    // two shuttles ferrying between the drydock and the flagship — the small
    // business of a fleet being provisioned
    const shutMat = new THREE.MeshStandardMaterial({ color: 0x9fb0c8, emissive: 0x2a3a58, emissiveIntensity: 0.5, metalness: 0.7, roughness: 0.5 })
    const shuttles = []
    for (let i = 0; i < 2; i++) {
      const g = new THREE.Group(); g.add(new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.55, 1.5), shutMat))
      const glow = new THREE.Mesh(fx.blastGeo, fx.glowMat.blue); glow.scale.set(0.16, 0.16, 0.3); glow.position.set(0, 0, -0.85); g.add(glow)
      g.scale.setScalar(1.6); scene.add(g)
      shuttles.push({ g, phase: i * 0.52, spd: 0.075 + i * 0.02, hi: new THREE.Vector3(0, 10 - i * 6, -44 + i * 5) })
    }

    // late arrivals streak in from the dark and slot into the formation —
    // staggered, each announced by the hyperspace howl and a hull still
    // stretched by the translation
    const arrMat = new THREE.MeshStandardMaterial({ color: TEAMS.blue.color, emissive: TEAMS.blue.color, emissiveIntensity: 0.55, metalness: 0.6, roughness: 0.4 })
    const _t = new THREE.Vector3(), _d = new THREE.Vector3(), _p1 = new THREE.Vector3(), _p2 = new THREE.Vector3(), _l1 = new THREE.Vector3()
    const arrivals = []
    for (let i = 0; i < 7; i++) {
      const g = new THREE.Group(); g.add(new THREE.Mesh(buildBlueModel(), arrMat))
      const glow = new THREE.Mesh(fx.blastGeo, fx.glowMat.blue); glow.scale.set(0.22, 0.22, 0.38); glow.position.set(0, 0, -0.95); g.add(glow)
      g.visible = false; scene.add(g)
      const offset = new THREE.Vector3((Math.random() - 0.5) * 34, (Math.random() - 0.5) * 16, (Math.random() - 0.5) * 34)
      const dir = new THREE.Vector3(Math.random() - 0.5, (Math.random() - 0.5) * 0.4, Math.random() - 0.5).normalize()
      const from = new THREE.Vector3().copy(fleet.group.position).add(offset).addScaledVector(dir, 200)
      g.position.copy(from)
      arrivals.push({ g, from, offset, t: 0, delay: 0.7 + i * 0.9, dur: 1.0 + i * 0.28, started: false, arrived: false, trail: fx.makeTrail(TEAMS.blue.bolt, 5) })
    }

    const center = new THREE.Vector3(), off = new THREE.Vector3(-10, 2, 0)

    let T = 0, c1 = false, c2 = false, ended = false, underway = false
    return (dt) => {
      T += dt
      underway = T >= 13.2                        // the advance order takes hold
      fleet.group.position.x += (underway ? 11 : 5) * dt
      field.tick(dt)
      station.rotation.y += 0.05 * dt
      beaconMat.opacity = 0.25 + 0.65 * (0.5 + 0.5 * Math.sin(T * 2.4))
      coneMat.opacity = 0.045 + 0.015 * Math.sin(T * 0.9)

      // shuttles ping-pong between the lower pad and the flagship's flank
      for (const s of shuttles) {
        s.phase += s.spd * dt
        const k = s.phase % 1, fwd = k < 0.5, p = fwd ? k * 2 : (k - 0.5) * 2
        const e = p * p * (3 - 2 * p)
        _p1.copy(s.hi); _p2.copy(fleet.group.position).add(_t.set(-6, 3, 8))
        if (!fwd) { const sw = _p1; _p1.copy(_p2); _p2.copy(sw.set(s.hi.x, s.hi.y, s.hi.z)) }
        s.g.position.lerpVectors(_p1, _p2, e)
        orient(s.g, _d.subVectors(_p2, _p1), 1 - Math.exp(-6 * dt))
      }

      for (const a of arrivals) {
        if (a.arrived || T < a.delay) continue
        if (!a.started) { a.started = true; a.g.visible = true; sfx.jump(0.5) }
        a.t += dt
        const p = Math.min(1, a.t / a.dur), e = 1 - Math.pow(1 - p, 3)
        _t.copy(fleet.group.position).add(a.offset)
        a.g.position.lerpVectors(a.from, _t, e)
        orient(a.g, _d.subVectors(_t, a.from))
        a.g.scale.set(1, 1, 1 + 7 * Math.pow(1 - p, 2))   // translation stretch, relaxing on approach
        if (p < 0.92) a.trail(a.g.position)
        if (p >= 1) { a.arrived = true; a.g.scale.setScalar(1); scene.remove(a.g); fleet.group.add(a.g); a.g.position.copy(a.offset); orient(a.g, new THREE.Vector3(1, 0, 0)) }
      }

      // camera: a low tracking shot alongside the forming line, craning up and
      // out into the wide drydock orbit as the advance order comes through
      center.copy(fleet.group.position).add(off)
      const k = Math.min(1, Math.max(0, (T - 7.0) / 4.0)), ke = k * k * (3 - 2 * k)
      _p1.set(center.x - 26, center.y + 4, center.z + 42)                      // low, close, alongside
      const az = 0.6 + 0.2 * T
      _p2.set(center.x + 104 * Math.cos(az), center.y + 30 + 8 * Math.sin(az * 0.5), center.z + 104 * Math.sin(az))
      camera.position.lerpVectors(_p1, _p2, ke)
      _l1.copy(center).add(_t.set(14, 2, 0)); _l1.lerp(center, ke)
      camera.lookAt(_l1)

      if (!c1 && T >= 1.4) { c1 = true; comms.show('Princess Astraia', LINE1, { persist: true }) }
      if (!c2 && T >= 8.5) { c2 = true; comms.show('Admiralty Command', LINE2, { persist: true }) }
      if (!ended && T >= 16) { ended = true; end() }
    }
  },
}
