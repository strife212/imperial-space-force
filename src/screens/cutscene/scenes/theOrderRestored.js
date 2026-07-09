import * as THREE from 'three'
import { TEAMS } from '../../battle/constants'
import { buildBlueModel, makeStar } from '../../battle/geometry'
import { buildFleet } from '../actors'

// The Discord undone, the Hush lifts: the Song of the Stars returns, the light
// comes back, and the fleet sails on over a saved world.
const LINE1 = 'The stars… they are singing again.'
const LINE2 = 'Long live the Throne, where she hears alone. Caelum canit.'

export default {
  label: 'CUTSCENE / ANASTASIS',
  establishing: { name: 'ANASTASIS', sub: 'Order Restored · The Song Returns', stamp: 'AUDITIO FEED · ALL STATIONS · STRATCON 4' },
  feed: [
    { t: 1.2,  level: 'ok',   text: '[OK] Stellar output recovering · all monitored classes' },
    { t: 4.0,  level: 'ok',   text: '[OK] Carrier re-acquired · 10.3 GHz · the chord holds' },
    { t: 6.8,  level: 'info', text: 'Auditio channel singing · she hears alone' },
    { t: 10.0, level: 'info', text: 'Fleet stands down · DEFCON-5 · muster honours recorded' },
    { t: 13.0, level: 'ok',   text: '✦ CAELUM CANIT · ILLA AVDIT ✦' },
  ],
  readout: {
    id: 'Auditio Monitor',
    rows: [
      { label: 'Song',      value: (t) => `${Math.min(42, t * 3.5).toFixed(1)} dB` },
      { label: 'Starfield', value: (t) => `${Math.min(92, Math.floor(4 + t * 8))}%` },
      { label: 'State',     value: (t) => (t < 6 ? 'RECOVERING' : 'RESTORED') },
    ],
  },
  bloom: 0.6,
  create(ctx) {
    const { scene, camera, fx, sfx, comms, end, orient, lights, backdrop } = ctx
    backdrop.starMat.opacity = 0.04                  // the sky starts hushed, then re-ignites
    const a0 = lights.ambient.intensity, k0 = lights.key.intensity, r0 = lights.rim.intensity
    lights.ambient.intensity = a0 * 0.2; lights.key.intensity = k0 * 0.25; lights.rim.intensity = r0 * 0.25

    const fleet = buildFleet(ctx, { team: 'blue', fighters: 34, bombers: 12, cruisers: 6 })

    // dawn: a star rises out of the dark as the Song returns — the first light
    // the sky has given back. Built inside a group so the whole thing (light
    // included) can climb.
    const dawn = new THREE.Group(); scene.add(dawn)
    const starTick = makeStar(dawn, [], new THREE.Vector3(0, 0, 0), { radius: 16, corona: 2.9, light: 2.6 })
    const DAWN_FROM = new THREE.Vector3(135, -100, -215), DAWN_TO = new THREE.Vector3(135, -2, -215)
    dawn.position.copy(DAWN_FROM)

    // the Song itself, heard again — rising out of the same silence it fell into
    const song = sfx.bed('auditioultima.mp3', { volume: 0 })
    let songStarted = false

    // hero flybys streaking past the lens — two on crossing diagonals, and one
    // pilot who cannot resist a victory roll
    const flyMat = new THREE.MeshStandardMaterial({ color: TEAMS.blue.color, emissive: TEAMS.blue.color, emissiveIntensity: 0.6, metalness: 0.6, roughness: 0.4 })
    const flybys = []
    const mkFly = () => { const g = new THREE.Group(); g.add(new THREE.Mesh(buildBlueModel(), flyMat)); const glow = new THREE.Mesh(fx.blastGeo, fx.glowMat.blue); glow.scale.set(0.22, 0.22, 0.4); glow.position.set(0, 0, -0.95); g.add(glow); g.scale.setScalar(1.2); scene.add(g); return { g } }
    const reseedFly = (o) => { o.x = -90 - Math.random() * 30; o.y = (Math.random() - 0.5) * 30; o.z = 30 + Math.random() * 30; o.spd = 60 + Math.random() * 30; o.trail = fx.makeTrail(TEAMS.blue.bolt, 6) }
    for (let i = 0; i < 4; i++) { const o = mkFly(); reseedFly(o); o.x -= i * 40; o.vz = i === 1 ? -6 : i === 2 ? 6 : 0; o.roll = i === 0; flybys.push(o) }

    const center = new THREE.Vector3(), off = new THREE.Vector3(-10, 2, 0)
    const place = (az) => { center.copy(fleet.group.position).add(off); camera.position.set(center.x + 102 * Math.cos(az), center.y + 28 + 6 * Math.sin(az * 0.6), center.z + 102 * Math.sin(az)); camera.lookAt(center) }
    place(0.7)

    const _d = new THREE.Vector3()
    let T = 0, c1 = false, c2 = false, ended = false
    return (dt) => {
      T += dt
      fleet.group.position.x += 6 * dt
      // the orbit settles where the fleet and the rising sun share the frame
      const ck = Math.min(1, T / 10), cke = ck * ck * (3 - 2 * ck)
      place(0.7 + (1.95 - 0.7) * cke)

      // the song, and the light, return to the sky — and a sun climbs with them
      const up = Math.min(1, T / 6)
      backdrop.starMat.opacity = Math.min(0.9, 0.04 + T / 5) * (0.92 + 0.08 * Math.sin(T * 5))   // a faint shimmer as they re-ignite
      lights.ambient.intensity = a0 * (0.2 + 0.8 * up); lights.key.intensity = k0 * (0.25 + 0.75 * up); lights.rim.intensity = r0 * (0.25 + 0.75 * up)
      const rise = Math.min(1, Math.max(0, (T - 1.2) / 9))
      dawn.position.lerpVectors(DAWN_FROM, DAWN_TO, rise * rise * (3 - 2 * rise))
      starTick(T)

      if (!songStarted) { songStarted = true; song.play() }
      song.setVolume(0.42 * Math.min(1, Math.max(0, (T - 1.5) / 6.5)))

      for (const o of flybys) {
        o.x += o.spd * dt; o.z += (o.vz || 0) * dt
        o.g.position.set(fleet.group.position.x + o.x, o.y, o.z)
        orient(o.g, _d.set(o.spd, 0, o.vz || 0))
        if (o.roll && o.x > -30 && o.x < 60) o.g.rotateZ((o.x + 30) * 0.07)   // the victory roll
        o.trail(o.g.position)
        if (o.x > 110) reseedFly(o)
      }

      if (!c1 && T >= 2.2) { c1 = true; comms.show('Her Imperial Majesty Iliantha III', LINE1) }
      if (!c2 && T >= 7.5) { c2 = true; comms.show('Princess Astraia', LINE2, { persist: true }) }
      if (!ended && T >= 16) { ended = true; end() }
    }
  },
}
