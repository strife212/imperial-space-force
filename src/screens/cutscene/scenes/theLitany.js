import * as THREE from 'three'
import { makeMachinePlanet, makeEarthlike, buildBlueModel } from '../../battle/geometry'
import { buildRelay } from '../models'

// The Ecumenologion — the World Engine, Litania Magna — computes the silence and
// names the one instrument the Order has never used. The Empress's craft steals
// in to commune.
const LINE1 = 'I have modelled the silence. It propagates. The Song fails in ninety days.'
const LINE2 = 'There is one instrument the Order has never used. The prophecy names it. So do I.'
const LINE3 = 'Then it is to be in my reign. I had hoped otherwise.'

export default {
  label: 'CUTSCENE / LOGOS',
  establishing: { name: 'LOGOS', sub: 'Litania Magna · The Great Litany · World Engine', stamp: 'ECUMENOLOGION UPLINK · HER PRIVATE CHANNEL · CLR-Ω' },
  feed: [
    { t: 1.2,  level: 'ok',   text: '[OK] Handshake: Litania Magna · entangled uplink established' },
    { t: 3.6,  level: 'info', text: 'Thought-substrate load 96.2% · liturgical simulations deferred' },
    { t: 6.5,  level: 'warn', text: 'Model horizon: the Song fails in 90 days · confidence 0.997' },
    { t: 10.0, level: 'info', text: 'One instrument un-used · cross-reference: AUDITIO ULTIMA' },
    { t: 14.8, level: 'warn', text: 'Her Annunciator named · STRATCON review convened' },
  ],
  readout: {
    id: 'Ecumenologion · Litania Magna',
    rows: [
      { label: 'Substrate',  value: (t) => `${(96.2 + Math.sin(t * 0.7) * 1.6).toFixed(1)}%` },
      { label: 'Simulation', value: 'SILENCE MODEL Ω' },
      { label: 'Confidence', value: (t) => `${Math.min(0.999, 0.982 + t * 0.001).toFixed(3)}` },
    ],
  },
  bloom: 0.7,
  create(ctx) {
    const { scene, camera, fx, sfx, comms, end, orient } = ctx
    const engineTick = makeMachinePlanet(scene, [], new THREE.Vector3(0, 0, 0), new THREE.Vector3(0.5, 0.6, 0.4).normalize())   // the World Engine (R≈40)
    const throneTick = makeEarthlike(scene, [], new THREE.Vector3(150, 40, -180), new THREE.Vector3(0.4, 0.5, 0.6).normalize())   // the Throneworld it orbits — the same living world the Cathedra stands on

    // the diadem — orbital rings of solar collectors girdling the Engine
    const ringMat = new THREE.MeshBasicMaterial({ color: 0x6f86ff, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })
    const ring = new THREE.Mesh(new THREE.TorusGeometry(58, 0.8, 8, 120), ringMat); ring.rotation.set(-1.1, 0.4, 0); scene.add(ring)
    const ring2 = new THREE.Mesh(new THREE.TorusGeometry(66, 0.4, 8, 120), ringMat); ring2.rotation.set(-1.0, 0.4, 0); scene.add(ring2)

    // collector platforms riding the diadem
    const satMat = new THREE.MeshStandardMaterial({ color: 0x9fb0d8, emissive: 0x223a66, emissiveIntensity: 0.5, metalness: 0.7, roughness: 0.5 })
    const sats = new THREE.Group(); sats.rotation.set(-1.1, 0.4, 0); scene.add(sats)
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * Math.PI * 2
      const s = new THREE.Mesh(new THREE.BoxGeometry(3, 0.5, 5), satMat)
      s.position.set(Math.cos(a) * 58, Math.sin(a) * 58, 0); s.rotation.z = a; sats.add(s)
    }

    // monitoring relays stationed around the Engine, each winking its watch-light
    const relays = []
    const winkMat = new THREE.MeshBasicMaterial({ color: 0x9fe0ff, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false })
    for (const [x, y, z] of [[64, 18, 30], [-58, -24, 40], [30, 50, -34], [-40, 36, -44], [70, -16, -20]]) {
      const r = buildRelay(); r.position.set(x, y, z); r.scale.setScalar(2.2); r.rotation.set(Math.random() * 6, Math.random() * 6, Math.random() * 6); scene.add(r)
      const wink = new THREE.Mesh(fx.blastGeo, winkMat.clone()); wink.scale.setScalar(0.55); wink.position.set(x, y + 5.5, z); scene.add(wink)
      relays.push({ r, wink, ph: Math.random() * 6 })
    }

    // data pulses racing the diadem — the Litany thinking out loud
    const pulseMat = new THREE.MeshBasicMaterial({ color: 0xbfd2ff, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false })
    const pulses = new THREE.Group(); pulses.rotation.set(-1.1, 0.4, 0); scene.add(pulses)
    const pulseList = []
    for (let i = 0; i < 8; i++) {
      const m = new THREE.Mesh(fx.blastGeo, pulseMat); m.scale.setScalar(1.15); pulses.add(m)
      pulseList.push({ m, a: (i / 8) * Math.PI * 2, s: 0.9 + (i % 3) * 0.35 })
    }

    // the communion: a hairline uplink from the Empress's craft down into the
    // Engine's thought-substrate, packets sinking along it while the Litany speaks
    const beamMat = new THREE.MeshBasicMaterial({ color: 0xcfe4ff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false })
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 1, 6), beamMat); beam.visible = false; scene.add(beam)
    const packetMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false })
    const packets = []
    for (let i = 0; i < 3; i++) {
      const m = new THREE.Mesh(fx.blastGeo, packetMat); m.scale.setScalar(0.5); m.visible = false; scene.add(m)
      packets.push({ m, ph: i / 3 })
    }

    // the Engine's room tone, rising as we draw near
    const hum = sfx.bed('computerhum.mp3', { volume: 0 })
    let humStarted = false

    // the Empress's small craft, stealing in to commune — hers is the gold
    // fighter (the same hull and livery as the battle's Gold Ace)
    const craftMat = new THREE.MeshStandardMaterial({ color: 0xffc63a, emissive: 0xffae1f, emissiveIntensity: 0.85, metalness: 0.7, roughness: 0.3 })
    const craftGlowMat = new THREE.MeshBasicMaterial({ color: 0xffd56a, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false })
    const craft = new THREE.Group(); craft.add(new THREE.Mesh(buildBlueModel(), craftMat))
    const cglow = new THREE.Mesh(fx.blastGeo, craftGlowMat); cglow.scale.set(0.22, 0.22, 0.38); cglow.position.set(0, 0, -0.95); craft.add(cglow)
    craft.scale.setScalar(1.4); scene.add(craft)
    // she comes from the Throneworld (over at +x, −z), sweeping low across the
    // Engine's face — inside the diadem — to hold station on the near side.
    // No light trail: she steals in dark.
    const cFrom = new THREE.Vector3(130, 62, -140), cTo = new THREE.Vector3(0, 34, 48)
    const TRAVEL = new THREE.Vector3().subVectors(cTo, cFrom).normalize()
    craft.position.copy(cFrom)
    const _d = new THREE.Vector3()

    const _p1 = new THREE.Vector3(), _p2 = new THREE.Vector3(), _l = new THREE.Vector3()
    const ENGINE_LOOK = new THREE.Vector3(0, 6, 0)
    let T = 0, c1 = false, c2 = false, c3 = false, ended = false
    return (dt) => {
      T += dt
      engineTick(T)
      throneTick(T)
      ring.rotation.z += 0.05 * dt; ring2.rotation.z -= 0.03 * dt; sats.rotation.z += 0.05 * dt
      for (const rl of relays) {
        rl.r.rotation.y += 0.2 * dt
        rl.wink.material.opacity = 0.15 + 0.75 * Math.max(0, Math.sin(T * 1.8 + rl.ph)) ** 6   // a slow lighthouse wink
      }
      for (const p of pulseList) { p.a += p.s * dt; p.m.position.set(Math.cos(p.a) * 58, Math.sin(p.a) * 58, 0) }

      if (!humStarted) { humStarted = true; hum.play() }
      hum.setVolume(0.4 * Math.min(1, T / 3.5))

      // the craft eases in over the first few seconds, trailing light
      const cp = Math.min(1, T / 6), ce = 1 - Math.pow(1 - cp, 3)
      craft.position.lerpVectors(cFrom, cTo, ce)
      orient(craft, _d.subVectors(cTo, cFrom))
      craft.position.y += Math.sin(T * 1.2) * 0.02   // gentle settle

      // communion uplink once the craft holds station over the Engine
      if (cp >= 1) {
        beam.visible = true
        _d.copy(craft.position).multiplyScalar(-1); const dist = craft.position.length(); _d.normalize()
        const len = dist - 41                                         // down to the substrate surface
        beam.position.copy(craft.position).addScaledVector(_d, len / 2)
        beam.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), _d)
        beam.scale.set(1, len, 1)
        beamMat.opacity = 0.4 + 0.25 * Math.sin(T * 5)
        for (const pk of packets) {
          pk.m.visible = true
          pk.ph = (pk.ph + dt * 0.5) % 1
          pk.m.position.copy(craft.position).addScaledVector(_d, len * pk.ph)
        }
      }

      // camera: lead the gold craft out from the Throneworld — Her world
      // shrinking behind her — then swing wide and around, revealing the
      // Engine she has come to as the ceremonial orbit takes over
      const az = 0.5 + 0.12 * T, d = 165 - Math.min(55, T * 2.6)
      // ahead of her, looking back down the geodesic — offset off-axis so she
      // reads against the planet's limb instead of vanishing into its glare
      _p1.copy(craft.position).addScaledVector(TRAVEL, 20)
      _p1.x -= 5.7; _p1.z -= 3.9; _p1.y += 9
      _p2.set(Math.cos(az) * d, 34, Math.sin(az) * d)
      const k = Math.min(1, Math.max(0, (T - 5.2) / 3.2)), ke = k * k * (3 - 2 * k)
      camera.position.lerpVectors(_p1, _p2, ke)
      _l.copy(craft.position).lerp(ENGINE_LOOK, ke)   // the craft (planet behind her) → the Engine core
      camera.lookAt(_l)

      if (!c1 && T >= 2.0) { c1 = true; comms.show('Litania Magna', LINE1) }
      if (!c2 && T >= 8.0) { c2 = true; comms.show('Litania Magna', LINE2, { persist: true }) }
      if (!c3 && T >= 14.5) { c3 = true; comms.show('Her Imperial Majesty Iliantha III', LINE3, { persist: true }) }
      if (!ended && T >= 20.5) { ended = true; end() }
    }
  },
}
