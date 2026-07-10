import * as THREE from 'three'
import { TEAMS } from '../../battle/constants'
import { makeRingedPlanet, makeShield } from '../../battle/geometry'
import { createFlagship, buildFleet } from '../actors'
import { asteroidField } from '../models'

// The cost: a flagship and its escort are swarmed and all but lost. The fleet
// that learned the habits of a parade meets a foe that does not parade — and
// the survivors run for the Throneworld at the last second.
const LINE1 = 'We cannot hold them. Half the line is gone already.'
const LINE2 = 'Fall back to the Throneworld. We make our stand where she hears.'
const SHIELD_FAIL_T = 5.2   // the screen holds this long, then the hull pays
const WARP_T = 12.6         // the last second — the survivors translate out

export default {
  label: 'CUTSCENE / CATABASIS',
  establishing: { name: 'CATABASIS', sub: 'The Fall · The Line Breaks', stamp: 'FLEET LOSS RECORD · STRATCON 2 IN EFFECT' },
  feed: [
    { t: 1.0,  level: 'crit', text: 'Escort screen collapsing · half the line gone' },
    { t: 3.5,  level: 'warn', text: 'Flagship shields buckling · armour ablating' },
    { t: 6.0,  level: 'crit', text: '[FAIL] Damage control overwhelmed · decks 4–9 open to vacuum' },
    { t: 9.0,  level: 'crit', text: 'Hull integrity critical · reactor at redline' },
    { t: 11.4, level: 'warn', text: 'Withdrawal geodesic laid · Throneworld anchorage' },
    { t: 13.6, level: 'ok',   text: '[OK] Emergency translation · surviving hulls away' },
  ],
  readout: {
    id: 'Hull Monitor · Flag',
    rows: [
      { label: 'Hull',    value: (t) => `${Math.max(18, Math.floor(62 - t * 2.5))}%` },
      { label: 'Escorts', value: (t) => `${Math.max(3, 15 - Math.floor(t * 0.55))}` },
      { label: 'Order',   value: (t) => (t < 10.8 ? 'HOLD' : 'WITHDRAW') },
    ],
  },
  bloom: 0.8,
  create(ctx) {
    const { scene, camera, fx, sfx, comms, end, orient } = ctx
    const flagship = createFlagship(ctx, {
      deathDrift: 0.4,
      onDestroyed: () => end({ holdMs: 3800 }),   // failsafe — the flag is meant to get out
    })
    flagship.ship.pos.set(0, 0, 0)
    orient(flagship.group, new THREE.Vector3(1, 0, 0))

    // the flag shield — it holds, buckles, and shatters before the hull burns
    const shield = makeShield(TEAMS.blue.bolt)
    shield.mesh.scale.set(2.6, 2.1, 4.6)
    flagship.group.add(shield.mesh)

    const escort = buildFleet(ctx, { team: 'blue', fighters: 12, cruisers: 3, capital: false, ringR: 16 })   // the dwindling line
    const swarm = buildFleet(ctx, { team: 'red', fighters: 34, bombers: 12, cruisers: 5, capital: false, ringR: 36 })
    makeRingedPlanet(scene, [], new THREE.Vector3(170, 40, -280), new THREE.Vector3(0.4, 0.5, 0.6).normalize())   // the Throneworld they flee toward — far off their jump line
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

    // the way out: toward the Throneworld, at the last second
    const warpDir = new THREE.Vector3(60, -20, -150).normalize()
    const flagPos0 = new THREE.Vector3()
    let warpers = null   // built at WARP_T — the flag and every escort still alive

    let T = 0, c1 = false, c2 = false, ended = false, fireCd = 0, retCd = 0, dmgCd = 0, killCd = 2, redKillCd = 2.6, shake = 0
    let shieldUp = true, shieldFlare = 0, list = 0
    return (dt) => {
      T += dt
      field.tick(dt)
      flagship.tick(dt)
      const fled = !!warpers

      // raiders spiral inward, always nose-on
      for (const rd of raiders) {
        if (rd.s.userData.dead) continue
        rd.a += rd.w * dt
        rd.r = Math.max(26, rd.r - 0.5 * dt)
        rd.s.position.set(Math.cos(rd.a) * rd.r, rd.y, Math.sin(rd.a) * rd.r)
        rd.s.getWorldPosition(_a)
        orient(rd.s, _d.subVectors(flagship.ship.pos, _a), 1 - Math.exp(-6 * dt))
      }

      // the barrage lifts a beat before the jump — every bolt already in
      // flight lands while she is still there, so the streak-out reads clean
      if (T > 1.5 && flagship.ship.alive && T < WARP_T - 0.8) {
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
          // the hull burns down to the wire but holds — she has to get out
          dmgCd -= dt; if (dmgCd <= 0) { if (flagship.ship.hp > 10) flagship.damage(4); shake = Math.min(1.2, shake + 0.5); dmgCd = 0.35 }
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

      // the last second: the flag and every hull still flying translate out
      // toward the Throneworld, stretched by the jump — the noose closes on
      // nothing but wrecks
      if (!warpers && T >= WARP_T) {
        flagPos0.copy(flagship.ship.pos)
        sfx.jump(0.9)
        // glows and hull fires are camera-facing blast spheres — stretched by
        // the jump they balloon into moons, so they wink out with the drive
        flagship.group.traverse((o) => { if (o.isMesh && o.geometry === fx.blastGeo) o.visible = false })
        warpers = [{ flag: true, g: flagship.group, t: 0.0, s0: 3.2 }]
        for (const s of escort.ships) {
          if (s.userData.dead) continue
          warpers.push({ flag: false, g: s, t: -(0.08 + Math.random() * 0.45), s0: s.scale.x })
        }
        shake = Math.min(1.4, shake + 0.7)
      }
      if (warpers) {
        for (const w of warpers) {
          w.t += dt
          if (w.t < 0 || !w.g.visible) continue
          const spd = 40 + w.t * 380
          if (w.flag) flagship.ship.pos.addScaledVector(warpDir, spd * dt)
          else w.g.position.addScaledVector(warpDir, spd * dt)
          orient(w.g, warpDir, 1 - Math.exp(-7 * dt))
          w.g.scale.set(w.s0, w.s0, w.s0 * (1 + w.t * 10))
          if (w.t > 0.8) w.g.visible = false
        }
      }

      // closing camera, behind-and-above the burning ship, shuddering on hits —
      // listing over with her, righting itself once she is away
      shake = Math.max(0, shake - dt * 1.5)
      if (!shieldUp && !fled) list = Math.min(1, list + dt * 0.09)
      if (fled) list = Math.max(0, list - dt * 0.12)
      const d = 56 - Math.min(20, T * 1.3)
      camera.position.set(-d + (Math.random() - 0.5) * shake * 3, 16 + (Math.random() - 0.5) * shake * 2, d * 0.9)
      const lp = fled ? flagPos0 : flagship.ship.pos
      camera.lookAt(lp.x + 4, lp.y, lp.z * 0.5)
      camera.rotateZ(list * 0.14)

      if (!c1 && T >= 1.5) { c1 = true; comms.show('Princess Astraia', LINE1) }
      if (!c2 && T >= 10.8) { c2 = true; comms.show('Admiralty Command', LINE2, { persist: true }) }
      if (!ended && T >= WARP_T + 3.4) { ended = true; end({ holdMs: 3000 }) }
    }
  },
}
