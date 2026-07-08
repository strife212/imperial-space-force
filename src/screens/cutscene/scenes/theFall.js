import * as THREE from 'three'
import { TEAMS } from '../../battle/constants'
import { makeRingedPlanet, makeShield } from '../../battle/geometry'
import { createFlagship, buildFleet } from '../actors'
import { asteroidField } from '../models'

// The cost: a flagship and its escort are swarmed and lost. The fleet that
// learned the habits of a parade meets a foe that does not parade.
const LINE1 = 'We cannot hold them. Half the line is gone already.'
const LINE2 = 'Fall back to the Throneworld. We make our stand where she hears.'
const SHIELD_FAIL_T = 5.2   // the screen holds this long, then the hull pays

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
    const { scene, camera, fx, sfx, comms, end, orient } = ctx
    const flagship = createFlagship(ctx, {
      deathDrift: 0.4,
      onDestroyed: () => { comms.show('Admiralty Command', LINE2, { persist: true }); end({ holdMs: 3800 }) },
    })
    flagship.ship.pos.set(0, 0, 0)
    orient(flagship.group, new THREE.Vector3(1, 0, 0))

    // the flag shield — it holds, buckles, and shatters before the hull burns
    const shield = makeShield(TEAMS.blue.bolt)
    shield.mesh.scale.set(2.6, 2.1, 4.6)
    flagship.group.add(shield.mesh)

    const escort = buildFleet(ctx, { team: 'blue', fighters: 12, cruisers: 3, capital: false, ringR: 16 })   // the dwindling line
    const swarm = buildFleet(ctx, { team: 'red', fighters: 34, bombers: 12, cruisers: 5, capital: false, ringR: 36 })
    makeRingedPlanet(scene, [], new THREE.Vector3(60, -20, -150), new THREE.Vector3(0.4, 0.5, 0.6).normalize())   // the Throneworld they flee toward
    const field = asteroidField(ctx, { count: 22, center: new THREE.Vector3(0, 0, 0), inner: 60, outer: 190, scaleMax: 4 })

    // the noose: every raider on its own inward spiral, nose held on the flag —
    // not a formation, a feeding circle
    const raiders = swarm.ships.map((s) => {
      const r = Math.max(14, Math.hypot(s.position.x, s.position.z)) + 10 + Math.random() * 26
      return { s, r, a: Math.atan2(s.position.z, s.position.x), y: s.position.y * 1.4, w: 0.1 + Math.random() * 0.12 }
    })

    // dead ships stay in frame: charred, tumbling, shedding embers
    const charred = new THREE.MeshStandardMaterial({ color: 0x23262c, emissive: 0x180b05, emissiveIntensity: 0.5, metalness: 0.3, roughness: 0.95 })
    const wrecks = []
    const wreckify = (s) => {
      s.userData.dead = true
      s.children[0].material = charred
      if (s.children[1]) s.children[1].visible = false
      wrecks.push({ s, sx: (Math.random() - 0.5) * 1.6, sz: (Math.random() - 0.5) * 1.6, vy: (Math.random() - 0.5) * 1.4 })
    }

    const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _d = new THREE.Vector3()
    const livePick = (list) => { const live = list.filter(s => !s.userData.dead); return live.length ? live[Math.floor(Math.random() * live.length)] : null }

    let T = 0, c1 = false, ended = false, fireCd = 0, retCd = 0, dmgCd = 0, killCd = 2, redKillCd = 2.6, shake = 0
    let shieldUp = true, shieldFlare = 0, list = 0
    return (dt) => {
      T += dt
      field.tick(dt)
      flagship.tick(dt)

      // raiders spiral inward, always nose-on
      for (const rd of raiders) {
        if (rd.s.userData.dead) continue
        rd.a += rd.w * dt
        rd.r = Math.max(26, rd.r - 0.5 * dt)
        rd.s.position.set(Math.cos(rd.a) * rd.r, rd.y, Math.sin(rd.a) * rd.r)
        rd.s.getWorldPosition(_a)
        orient(rd.s, _d.subVectors(flagship.ship.pos, _a), 1 - Math.exp(-6 * dt))
      }

      if (T > 1.5 && flagship.ship.alive) {
        fireCd -= dt
        if (fireCd <= 0) {
          const s = livePick(swarm.ships)
          if (s) { s.getWorldPosition(_a); fx.bolt(_a, flagship.ship.pos, 0xff7a5a, { speed: 95 }) }
          // also rake the escorts
          const e = livePick(escort.ships), s2 = livePick(swarm.ships)
          if (e && s2 && Math.random() < 0.5) { e.getWorldPosition(_a); s2.getWorldPosition(_b); fx.bolt(_b, _a, 0xff7a5a, { speed: 95 }) }
          fireCd = 0.05
        }
        // the line fires back — defiant, outnumbered
        retCd -= dt
        if (retCd <= 0) {
          const e = livePick(escort.ships), s = livePick(swarm.ships)
          if (e && s) { e.getWorldPosition(_a); s.getWorldPosition(_b); fx.bolt(_a, _b, 0x8fc6ff, { speed: 105 }) }
          retCd = 0.14
        }

        if (shieldUp) {
          // the shield takes the pounding — flaring, guttering, then gone
          shieldFlare = Math.max(shieldFlare, Math.random() < 0.16 ? 0.9 : 0.35 + Math.random() * 0.2)
          if (T >= SHIELD_FAIL_T) {
            shieldUp = false
            shield.mat.uniforms.uIntensity.value = 2.6              // the shatter flash
            fx.blast(_a.copy(flagship.ship.pos).add(_b.set(0, 4, 2)), true)
            sfx.rumble(0.7, 2.0)
            shake = Math.min(1.6, shake + 0.9)
          }
        } else {
          shield.mesh.visible = shield.mat.uniforms.uIntensity.value > 0.02
          dmgCd -= dt; if (dmgCd <= 0) { flagship.damage(4); shake = Math.min(1.2, shake + 0.5); dmgCd = 0.35 }
        }

        killCd -= dt
        if (killCd <= 0) { const v = livePick(escort.ships); if (v) { v.getWorldPosition(_a); fx.blast(_a, true); wreckify(v); shake = Math.min(1.4, shake + 0.6) } killCd = 1.4 + Math.random() }
        redKillCd -= dt
        if (redKillCd <= 0) { const v = livePick(swarm.ships); if (v) { v.getWorldPosition(_a); fx.blast(_a, false); wreckify(v) } redKillCd = 2.2 + Math.random() * 1.2 }
      }

      // shield shimmer decay (uIntensity is also the shatter flash envelope)
      shieldFlare = Math.max(0, shieldFlare - dt * 2.6)
      if (shieldUp) shield.mat.uniforms.uIntensity.value = 0.18 + shieldFlare
      else shield.mat.uniforms.uIntensity.value = Math.max(0, shield.mat.uniforms.uIntensity.value - dt * 2.2)

      // wrecks tumble where they died
      for (const w of wrecks) {
        w.s.rotation.x += w.sx * dt; w.s.rotation.z += w.sz * dt; w.s.position.y += w.vy * dt
        if (Math.random() < 0.02) { w.s.getWorldPosition(_a); fx.ember(_a, 0xff6a30) }
      }

      // closing camera, behind-and-above the doomed ship, shuddering on hits —
      // and listing over with her as she goes down
      shake = Math.max(0, shake - dt * 1.5)
      if (!shieldUp) list = Math.min(1, list + dt * 0.09)
      const dying = flagship.ship.dying
      const d = dying ? 42 : 56 - Math.min(20, T * 1.3)
      camera.position.set(-d + (Math.random() - 0.5) * shake * 3, 16 + (Math.random() - 0.5) * shake * 2, d * 0.9)
      camera.lookAt(flagship.ship.pos.x + 4, flagship.ship.pos.y, flagship.ship.pos.z * 0.5)
      camera.rotateZ(list * 0.14)

      if (!c1 && T >= 1.5) { c1 = true; comms.show('Princess Astraia', LINE1) }
      if (!ended && T >= 30) { ended = true; end({ holdMs: 0 }) }   // safety net
    }
  },
}
