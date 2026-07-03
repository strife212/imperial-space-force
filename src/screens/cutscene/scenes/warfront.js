import * as THREE from 'three'
import { TEAMS } from '../../battle/constants'
import { buildBlueModel, buildRedModel, makeBlackHole } from '../../battle/geometry'
import { buildFleet } from '../actors'
import { asteroidField } from '../models'

// The first true fleet engagement in a generation: the Imperial line meets the
// Discord's ships head-on — fighters streaking the gap, ships dying in fire.
const LINE1 = 'Contact. They came out of nowhere — just like the Cassiopeia reported.'
const LINE2 = 'All batteries, open fire. For the Universal Order!'

export default {
  label: 'CUTSCENE / THE WARFRONT',
  establishing: { name: 'THE WARFRONT', sub: 'The First Fleet Engagement in a Generation', stamp: 'TAC-SIM LIVE · DEFCON-2 IN EFFECT' },
  feed: [
    { t: 0.6,  level: 'crit', text: 'Contact · uncatalogued hulls · closing at combat velocity' },
    { t: 2.6,  level: 'warn', text: 'Firing solutions degraded · Schwarzschild correction unstable' },
    { t: 4.8,  level: 'info', text: 'All batteries release · doctrine: ATTRITION' },
    { t: 7.5,  level: 'warn', text: 'Losses within projection · line holding' },
    { t: 11.0, level: 'crit', text: 'Line integrity 71% · the Discord does not parade' },
  ],
  readout: {
    id: 'Fire Control · HMSS',
    rows: [
      { label: 'Solutions', value: (t) => `${120 + Math.floor(58 * Math.abs(Math.sin(t * 0.9)))}/s` },
      { label: 'Line',      value: (t) => `${Math.max(71, 100 - Math.floor(t * 2))}%` },
      { label: 'Doctrine',  value: 'ATTRITION' },
    ],
  },
  bloom: 0.7,
  create(ctx) {
    const { scene, camera, fx, comms, end, orient } = ctx
    const blue = buildFleet(ctx, { team: 'blue', fighters: 28, bombers: 10, cruisers: 4 })
    const red  = buildFleet(ctx, { team: 'red',  fighters: 28, bombers: 10, cruisers: 4 })
    blue.group.position.set(-64, 0, 20)
    red.group.position.set(64, 0, -20); red.group.rotation.y = Math.PI

    makeBlackHole(scene, [], new THREE.Vector3(-30, 70, -260))
    const field = asteroidField(ctx, { count: 26, center: new THREE.Vector3(0, 0, 0), inner: 70, outer: 220, scaleMax: 5 })

    // skirmishers tearing across the no-man's-land between the lines
    const skirm = []
    const mkSkirm = (team) => {
      const mat = new THREE.MeshStandardMaterial({ color: TEAMS[team].color, emissive: TEAMS[team].color, emissiveIntensity: 0.55, metalness: 0.6, roughness: 0.4 })
      const g = new THREE.Group(); g.add(new THREE.Mesh(team === 'blue' ? buildBlueModel() : buildRedModel(), mat))
      const glow = new THREE.Mesh(fx.blastGeo, fx.glowMat[team]); glow.scale.setScalar(0.3); glow.position.set(0, 0, -0.95); g.add(glow)
      scene.add(g)
      const o = { g, team, dir: team === 'blue' ? 1 : -1, t: Math.random() * 6, fire: Math.random() }
      reseed(o); return o
    }
    const reseed = (o) => { o.x = -o.dir * (70 + Math.random() * 20); o.y = (Math.random() - 0.5) * 26; o.z = (Math.random() - 0.5) * 26; o.amp = 4 + Math.random() * 6; o.spd = 34 + Math.random() * 16 }
    for (let i = 0; i < 7; i++) { skirm.push(mkSkirm('blue')); skirm.push(mkSkirm('red')) }

    const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _d = new THREE.Vector3()
    const pick = (f) => f.ships[Math.floor(Math.random() * f.ships.length)]
    const volley = (att, def, color) => { const s = pick(att), t = pick(def); if (!s || !t) return; s.getWorldPosition(_a); t.getWorldPosition(_b); fx.bolt(_a, _b, color, { speed: 100 }) }
    let shake = 0
    const detonate = (f) => { const live = f.ships.filter(s => s.visible); if (live.length <= 6) return; const s = live[Math.floor(Math.random() * live.length)]; s.getWorldPosition(_a); fx.blast(_a, true); s.visible = false; shake = Math.min(1.4, shake + 0.7) }

    let T = 0, c1 = false, c2 = false, ended = false, fireCd = 0, detCd = 1.5
    return (dt) => {
      T += dt
      field.tick(dt)
      if (T < 5) { blue.group.position.x += 9 * dt; red.group.position.x -= 9 * dt }   // close the gap

      // skirmishers weave across, firing forward
      for (const o of skirm) {
        o.t += dt; o.x += o.dir * o.spd * dt
        o.g.position.set(o.x, o.y + Math.sin(o.t * 2.2) * o.amp, o.z + Math.cos(o.t * 1.7) * o.amp)
        orient(o.g, _d.set(o.dir, Math.cos(o.t * 2.2) * 0.4, -Math.sin(o.t * 1.7) * 0.4))
        if (T > 3) { o.fire -= dt; if (o.fire <= 0) { _b.copy(o.g.position).addScaledVector(_d.set(o.dir, 0, 0), 40); fx.bolt(o.g.position, _b, o.team === 'blue' ? 0x8fc6ff : 0xff7a5a, { speed: 110, blastOnHit: false }); o.fire = 0.5 + Math.random() } }
        if (o.dir > 0 ? o.x > 80 : o.x < -80) reseed(o)
      }

      // main-line gunnery + ships dying
      if (T > 3) {
        fireCd -= dt
        if (fireCd <= 0) { volley(blue, red, 0x8fc6ff); volley(red, blue, 0xff7a5a); fireCd = 0.05 }
        detCd -= dt
        if (detCd <= 0) { detonate(Math.random() < 0.62 ? red : blue); detCd = 0.5 + Math.random() * 0.5 }   // the Discord gives ground slowly
      }

      // camera: side three-quarter on the midpoint, with battle shake
      const mid = (blue.group.position.x + red.group.position.x) / 2
      shake = Math.max(0, shake - dt * 1.6)
      camera.position.set(mid - 8 + (Math.random() - 0.5) * shake * 3, 24 + (Math.random() - 0.5) * shake * 2, 82)
      camera.lookAt(mid, 0, 0)

      if (!c1 && T >= 1.0) { c1 = true; comms.show('Princess Astraia', LINE1) }
      if (!c2 && T >= 4.5) { c2 = true; comms.show('Princess Astraia', LINE2, { persist: true }) }
      if (!ended && T >= 16) { ended = true; end() }
    }
  },
}
