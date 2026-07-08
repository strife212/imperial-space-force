import * as THREE from 'three'
import { TEAMS } from '../../battle/constants'
import { makeRingedPlanet, buildBlueModel } from '../../battle/geometry'
import { buildAnnunciator } from '../models'
import { playLanceCharge, preloadLanceSfx } from '../../../lib/lanceSfx'

// The last resort of the Empire, never yet fired in anger: the Annunciator-class
// battlestation spins up its mass driver and loads a black-hole package.
const LINE1 = 'Annunciator armed. Black-hole package loaded. Driver spinning to ninety percent of light.'
const LINE2 = 'Caelum canit, illa audit. Let it be cast.'
const MUZZLE = new THREE.Vector3(31, 0, 0)

export default {
  label: 'CUTSCENE / THE ANNUNCIATOR',
  establishing: { name: 'HER ANNUNCIATOR', sub: 'The Last Resort of the Empire', stamp: 'HMSS FIRE-CONTROL BUS v6.2.41 · DEFCON-1' },
  feed: [
    { t: 1.0,  level: 'ok',   text: '[OK] HMSS fire-control bus online · v6.2.41' },
    { t: 3.0,  level: 'info', text: 'PHYSICS PACKAGE ARMED · Kerr–Newman warhead' },
    { t: 5.2,  level: 'info', text: 'EM accelerator coils ×24 · capacitor bank 14.2 GJ · charging' },
    { t: 7.5,  level: 'warn', text: 'Driver spin 0.90 c · rail thermal at ceiling' },
    { t: 10.0, level: 'ok',   text: '[OK] GEODESIC INTERCEPT SOLUTION COMMITTED' },
    { t: 12.5, level: 'crit', text: 'ARMED — LAUNCH ENABLED · awaiting Her word' },
  ],
  readout: {
    id: 'PNL-007 · Driver',
    rows: [
      { label: 'Rail V',   value: (t) => `${Math.min(0.90, t * 0.075).toFixed(2)} c` },
      { label: 'Cap bank', value: (t) => `${Math.min(100, Math.floor(t * 11))}%` },
      { label: 'Package',  value: 'TYPE-IV · K–N' },
    ],
  },
  bloom: 0.75,
  create(ctx) {
    const { scene, camera, fx, sfx, comms, end, orient } = ctx
    const station = buildAnnunciator(); scene.add(station)   // muzzle at x≈31 — matches MUZZLE

    // EM coils igniting one by one, breech → muzzle, as the driver spins up
    // (positions mirror the builder's coil run)
    const coilRingMat = new THREE.MeshBasicMaterial({ color: 0x9fd8ff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false })
    const coilRings = []
    for (let i = 0; i < 10; i++) {
      const x = -16 + i * (i < 6 ? 3.4 : 4.6) + (i >= 6 ? -7.2 : 0)
      const ring = new THREE.Mesh(new THREE.TorusGeometry(3.05, 0.14, 8, 32), coilRingMat.clone())
      ring.position.set(x, 0, 0); ring.rotation.y = Math.PI / 2; station.add(ring)
      coilRings.push({ ring, lit: false, at: (i + 1) / 11, pop: 0 })
    }

    // capacitor discharge arcs crawling over the breech while the bank charges
    const arcMat = new THREE.MeshBasicMaterial({ color: 0xcfe8ff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false })
    const arcs = []
    for (let i = 0; i < 4; i++) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 1), arcMat.clone()); station.add(m)
      arcs.push({ m, cd: 0 })
    }
    const _a1 = new THREE.Vector3(), _a2 = new THREE.Vector3()
    const breechPt = (v) => v.set(-22 + (Math.random() - 0.5) * 7, (Math.random() - 0.5) * 8.5, (Math.random() - 0.5) * 6.5)

    // matter streaming into an accretion swirl around the forming round
    const swirlMat = new THREE.MeshBasicMaterial({ color: 0xffe2b0, transparent: true, opacity: 0.75, blending: THREE.AdditiveBlending, depthWrite: false })
    const swirls = []
    for (let i = 0; i < 3; i++) {
      const m = new THREE.Mesh(fx.blastGeo, swirlMat); m.scale.set(1.15, 0.16, 0.35); station.add(m)
      swirls.push({ m, a: (i / 3) * Math.PI * 2 })
    }

    // the committed firing solution — a hairline sight lancing out into the dark
    const sightMat = new THREE.MeshBasicMaterial({ color: 0xff8a5a, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false })
    const sight = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 220, 6), sightMat)
    sight.rotation.z = Math.PI / 2; sight.position.set(31 + 110, 0, 0); sight.visible = false; station.add(sight)

    // a quiet world behind the great gun
    makeRingedPlanet(scene, [], new THREE.Vector3(40, -40, -170), new THREE.Vector3(0.4, 0.5, 0.6).normalize())

    // the admiral-skill charge tone accompanies the round being fed; cut silently
    // on teardown so skipping mid-charge doesn't leave it playing
    preloadLanceSfx()
    let discharge = null
    ctx.track({ dispose: () => discharge && discharge(false) })

    // escorts holding station alongside
    const escMat = new THREE.MeshStandardMaterial({ color: TEAMS.blue.color, emissive: TEAMS.blue.color, emissiveIntensity: 0.5, metalness: 0.6, roughness: 0.4 })
    const escorts = []
    for (const [x, y, z] of [[-10, 12, 12], [4, -11, 14], [-24, -8, -12]]) {
      const g = new THREE.Group(); g.add(new THREE.Mesh(buildBlueModel(), escMat))
      const glow = new THREE.Mesh(fx.blastGeo, fx.glowMat.blue); glow.scale.setScalar(0.3); glow.position.set(0, 0, -0.95); g.add(glow)
      g.scale.setScalar(1.2); g.position.set(x, y, z); orient(g, new THREE.Vector3(1, 0, 0)); scene.add(g); escorts.push({ g, b: y })
    }

    // the round being charged, and energy streaming inward to feed it
    const chargeMat = new THREE.MeshBasicMaterial({ color: 0xfff0c4, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false })
    const charge = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 20), chargeMat); charge.position.copy(MUZZLE); charge.scale.setScalar(0.3); station.add(charge)
    const haloMat = new THREE.MeshBasicMaterial({ color: 0xffc870, transparent: true, opacity: 0.4, blending: THREE.AdditiveBlending, depthWrite: false })
    const halo = new THREE.Mesh(new THREE.SphereGeometry(1.8, 20, 20), haloMat); halo.position.copy(MUZZLE); station.add(halo)
    const streamMat = new THREE.MeshBasicMaterial({ color: 0xffd9a0, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false })
    const streams = []
    const spawnStream = () => {
      const m = new THREE.Mesh(fx.blastGeo, streamMat)
      const dir = new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize()
      m.position.copy(MUZZLE).addScaledVector(dir, 16 + Math.random() * 10); m.scale.setScalar(0.5 + Math.random() * 0.4); scene.add(m)
      streams.push({ m })
    }

    const _from = new THREE.Vector3(-58, 14, 40), _to = new THREE.Vector3(12, 7, 34), _p = new THREE.Vector3(), _d = new THREE.Vector3(), _l = new THREE.Vector3()
    const LOOK_FROM = new THREE.Vector3(-18, 2, 0), LOOK_TO = new THREE.Vector3(26, 0, 0)
    let T = 0, c1 = false, c2 = false, ended = false, streamCd = 0, chargeStarted = false
    return (dt) => {
      T += dt
      const charged = Math.min(1, T / 9)
      // charge.mp3 runs 9.55s; stretched to 0.6× it plays ~15.9s — the whole
      // scene, its crescendo landing as the fade completes (~16.3s) — pitched
      // down into a heavier spin-up for the great driver, and a touch quieter
      if (!chargeStarted && T >= 0.4) { chargeStarted = true; discharge = playLanceCharge({ rate: 0.6, volume: 0.7 }) }
      charge.scale.setScalar(0.3 + charged * 2.8); halo.scale.setScalar(1 + charged * 2.4)
      chargeMat.opacity = 0.7 + 0.3 * Math.sin(T * 6) * charged
      for (const e of escorts) e.g.position.y = e.b + Math.sin(T * 1.1 + e.b) * 0.8

      // coils catch, breech → muzzle, each with its own soft ignition blip
      for (const c of coilRings) {
        if (!c.lit && charged >= c.at) { c.lit = true; c.pop = 1; sfx.blip(440 + c.at * 900, 0.16, 0.16) }
        if (c.lit) {
          c.pop = Math.max(0, c.pop - dt * 2.2)
          c.ring.material.opacity = 0.34 + 0.5 * c.pop + 0.08 * Math.sin(T * 7 + c.at * 20)
          c.ring.scale.setScalar(1 + c.pop * 0.25)
        }
      }

      // capacitor arcs crawl faster as the bank fills
      if (T > 3.5) {
        for (const arc of arcs) {
          arc.cd -= dt
          if (arc.cd <= 0) {
            breechPt(_a1); breechPt(_a2)
            const len = _a1.distanceTo(_a2)
            arc.m.position.lerpVectors(_a1, _a2, 0.5)
            arc.m.lookAt(_a2.add(station.position))
            arc.m.scale.set(1, 1, len)
            arc.m.material.opacity = 0.5 + Math.random() * 0.4
            arc.cd = 0.05 + Math.random() * (0.3 - charged * 0.22)
          }
          arc.m.material.opacity = Math.max(0, arc.m.material.opacity - dt * 6)
        }
      }

      // the swirl tightens around the round as it forms
      for (const sw of swirls) {
        sw.a += (1.6 + charged * 3.4) * dt
        const r = 4.2 - charged * 2.3
        sw.m.position.set(MUZZLE.x + Math.cos(sw.a) * r * 0.35, Math.sin(sw.a) * r * 0.5, Math.cos(sw.a + 1.7) * r)
        sw.m.rotation.y = sw.a
      }

      // firing solution committed — the sight blinks out along the geodesic
      if (T >= 10 && !sight.visible) { sight.visible = true; sfx.blip(1250, 0.2, 0.3) }
      if (sight.visible) sightMat.opacity = (T < 12.4 ? 0.4 : Math.max(0, 0.4 - (T - 12.4) * 0.5)) * (0.6 + 0.4 * Math.sin(T * 9))

      streamCd -= dt; if (streamCd <= 0) { spawnStream(); streamCd = 0.04 + (1 - charged) * 0.1 }
      for (let i = streams.length - 1; i >= 0; i--) {
        const s = streams[i]; _d.subVectors(MUZZLE, s.m.position); const d = _d.length(); _d.normalize()
        s.m.position.addScaledVector(_d, (28 + (16 - Math.min(16, d)) * 4) * dt); s.m.scale.multiplyScalar(0.97)
        if (d < 1.5) { scene.remove(s.m); streams.splice(i, 1) }
      }

      // one long reveal: from behind the breech, tracking down the whole rail
      // run to settle on the muzzle and the thing being born there
      const k = Math.min(1, T / 12), ke = k * k * (3 - 2 * k)
      _p.lerpVectors(_from, _to, ke); camera.position.copy(_p)
      _l.lerpVectors(LOOK_FROM, LOOK_TO, ke); camera.lookAt(_l)
      if (!c1 && T >= 1.6) { c1 = true; comms.show('Admiralty Command', LINE1) }
      if (!c2 && T >= 8.0) { c2 = true; comms.show('The Empress', LINE2, { persist: true }) }
      if (!ended && T >= 15) { ended = true; end() }
    }
  },
}
