import * as THREE from 'three'
import { makeBlackHoleLensed } from '../../battle/geometry'
import { asteroidField, buildAnnunciator } from '../models'
import { playLanceCharge, preloadLanceSfx } from '../../../lib/lanceSfx'

// The Divine Lance is cast: the Annunciator's package crosses the dark and
// annihilates the Discord's veiled seat.
const LINE1 = 'Against the Hush, the Empress’s Chord is brought.'
const LAUNCH = new THREE.Vector3(-78, 2, 26)
const TARGET = new THREE.Vector3(620, 0, -60)   // the veiled seat, far across the dark
const FIRE_T = 3.0
const FLIGHT = 5.5            // package flight time — the camera rides the round the whole way
const IMPACT_T = FIRE_T + FLIGHT
const GUN_SCALE = 0.55

export default {
  label: 'CUTSCENE / SINGULARITY',
  establishing: { name: 'SINGULARITY', sub: 'The Divine Lance · Auditio Ultima', stamp: 'PACKAGE TELEMETRY · STRATCON 1 IN EFFECT' },
  feed: [
    { t: 0.6,  level: 'info', text: 'Final hold released · tube clear · range to seat 4.7 ls' },
    { t: 2.2,  level: 'crit', text: 'T−0 · LET IT BE CAST' },
    { t: 3.2,  level: 'ok',   text: '[OK] PACKAGE AWAY · geodesic true' },
    { t: 4.6,  level: 'info', text: 'Impact probability 1.000 · chronology protection holds' },
    { t: 6.6,  level: 'info', text: 'Coast phase · 0.90 c · star field aberration nominal' },
    { t: 10.9, level: 'crit', text: 'Kerr–Newman collapse on the veiled seat' },
    { t: 12.0, level: 'warn', text: 'Horizon decay · Hawking cascade runaway' },
    { t: 13.1, level: 'crit', text: 'DETONATION · the seat is unmade' },
  ],
  readout: {
    id: 'Package Track · HMSS',
    rows: [
      { label: 'Velocity', value: (t) => (t < 3 ? 'HOLD' : '0.90 c') },
      { label: 'Range',    value: (t) => `${Math.max(0, 4.7 - Math.max(0, t - 3) * (4.7 / 5.5)).toFixed(1)} ls` },
      { label: 'Status',   value: (t) => (t < 3 ? 'IN TUBE' : t < 8.6 ? 'IN FLIGHT' : t < 10.8 ? 'DETONATION' : t < 12.7 ? 'COLLAPSE' : 'ANNIHILATED') },
    ],
  },
  bloom: 0.85,
  create(ctx) {
    const { scene, camera, fx, sfx, comms, end, backdrop } = ctx
    // the crossing runs far past the skydome's shell — carry the sky with the
    // camera so the nebula and stars never fall away into raw black
    const sky = scene.children.filter((o) => o.material && (o.material === backdrop.nebMat || o.material === backdrop.starMat))
    // the veiled seat — the lensed horizon, grouped on itself. Its image is
    // raymarched in world units, so the collapse drives the uRs / disk-radius
    // uniforms (and the shadow sphere) down to nothing, not the group scale.
    const bhGroup = new THREE.Group(); bhGroup.position.copy(TARGET); scene.add(bhGroup)
    const bhTick = makeBlackHoleLensed(bhGroup, [], new THREE.Vector3(0, 0, 0))
    const bhQuad = bhGroup.children.find((c) => c.geometry && c.geometry.type === 'PlaneGeometry')
    const bhShadow = bhGroup.children.find((c) => c.geometry && c.geometry.type === 'SphereGeometry')
    const BH_RS = bhQuad.material.uniforms.uRs.value
    const BH_IN = bhQuad.material.uniforms.uDiskIn.value
    const BH_OUT = bhQuad.material.uniforms.uDiskOut.value
    const field = asteroidField(ctx, { count: 22, center: TARGET, inner: 26, outer: 90, scaleMax: 5 })

    // Her Annunciator itself — the same great driver the fleet mustered around,
    // laid along the firing geodesic (the model's barrel runs +X)
    const dir = new THREE.Vector3().subVectors(TARGET, LAUNCH); const dist = dir.length(); dir.normalize()
    const gun = buildAnnunciator()
    gun.scale.setScalar(GUN_SCALE)
    gun.quaternion.setFromUnitVectors(new THREE.Vector3(1, 0, 0), dir)
    gun.position.copy(LAUNCH); scene.add(gun)
    const MUZZLE = LAUNCH.clone().addScaledVector(dir, 31.2 * GUN_SCALE)

    // the round riding the tube: a reprise of the charge glow, near-critical now
    const chargeMat = new THREE.MeshBasicMaterial({ color: 0xfff0c4, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false })
    const chargeOrb = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 20), chargeMat); chargeOrb.position.copy(MUZZLE); chargeOrb.scale.setScalar(0.8); scene.add(chargeOrb)

    // the admiral-skill lance sound, exactly as the ability fires it: a charge
    // tone cut dead by the discharge boom at T−0 (skip-safe on teardown)
    preloadLanceSfx()
    let discharge = null
    ctx.track({ dispose: () => discharge && discharge(false) })

    const yAxis = new THREE.Vector3(0, 1, 0)
    // muzzle flash — a short discharge cone; the streaking round tells the path
    const beamMat = new THREE.MeshBasicMaterial({ color: 0xfff2cc, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false })
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(1.9, 0.5, 16, 12), beamMat)   // flaring away from the muzzle
    beam.position.copy(MUZZLE).addScaledVector(dir, 8); beam.quaternion.setFromUnitVectors(yAxis, dir); beam.visible = false; scene.add(beam)

    const slugMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 1, blending: THREE.AdditiveBlending, depthWrite: false })
    const slug = new THREE.Mesh(fx.blastGeo, slugMat); slug.visible = false; scene.add(slug)   // the package in flight
    const streakMat = new THREE.MeshBasicMaterial({ color: 0xfff6dd, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false })
    const streak = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 14, 8), streakMat)
    streak.quaternion.setFromUnitVectors(yAxis, dir); streak.visible = false; scene.add(streak)
    const flashMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false })
    const flash = new THREE.Mesh(fx.blastGeo, flashMat); flash.position.copy(TARGET); flash.scale.setScalar(1); scene.add(flash)

    // the collapse: a ring-shockwave and matter dragged INTO the new horizon
    const shockMat = new THREE.MeshBasicMaterial({ color: 0xcfe0ff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })
    const shock = new THREE.Mesh(new THREE.RingGeometry(0.93, 1.0, 64), shockMat); shock.position.copy(TARGET); shock.visible = false; scene.add(shock)

    // and the unmaking: the horizon evaporates, then everything it held comes
    // back out at once — a staggered triple shockwave
    const burstRings = []
    for (let i = 0; i < 3; i++) {
      const mat = shockMat.clone(); mat.color = new THREE.Color(i === 0 ? 0xffffff : i === 1 ? 0xffe0b0 : 0xcfe0ff)
      const m = new THREE.Mesh(new THREE.RingGeometry(0.93, 1.0, 64), mat)
      m.position.copy(TARGET); m.visible = false; scene.add(m)
      burstRings.push({ m, mat, delay: i * 0.28, life: -1 })
    }
    let flings = null   // asteroid outward velocities, seeded at the burst
    const inMat = new THREE.MeshBasicMaterial({ color: 0xaFC4ff, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false })
    const infall = []
    for (let i = 0; i < 14; i++) {
      const m = new THREE.Mesh(fx.blastGeo, inMat); m.visible = false; scene.add(m)
      const d0 = new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize()
      infall.push({ m, d0, r0: 26 + Math.random() * 30, s: 0.5 + Math.random() * 0.7 })
    }

    // camera rigs: on the gun for the cast, chasing the round through the dark,
    // then wide and shuddering for the kill
    const side = new THREE.Vector3().crossVectors(dir, yAxis).normalize()
    const up = new THREE.Vector3().crossVectors(side, dir).normalize()
    const CAM_GUN = LAUNCH.clone().addScaledVector(side, -13).addScaledVector(dir, 6).add(new THREE.Vector3(0, 5.5, 0))
    const CAM_WIDE = TARGET.clone().add(new THREE.Vector3(-114, 44, 130))
    const _p = new THREE.Vector3(), _l = new THREE.Vector3(), _c = new THREE.Vector3(), _s = new THREE.Vector3()
    const _look = new THREE.Vector3().copy(MUZZLE)
    const camImpact = new THREE.Vector3().copy(CAM_GUN)   // where the chase ends, for the pull-out blend

    // the crossing: a shell of elongated star-streaks around the geodesic —
    // static in space, they whip past the chase camera and read as speed
    const stMat = new THREE.MeshBasicMaterial({ color: 0xbfd8ff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false })
    const stGeo = new THREE.CylinderGeometry(0.14, 0.14, 1, 5)
    const starStreaks = []
    for (let i = 0; i < 90; i++) {
      const m = new THREE.Mesh(stGeo, stMat)
      m.quaternion.setFromUnitVectors(yAxis, dir)
      const a = Math.random() * Math.PI * 2, r = 9 + Math.random() * 34
      const off = new THREE.Vector3().addScaledVector(side, Math.cos(a) * r).addScaledVector(up, Math.sin(a) * r)
      m.position.copy(LAUNCH).addScaledVector(dir, 40 + Math.random() * (dist - 100)).add(off)
      m.scale.set(1, 18 + Math.random() * 40, 1)
      m.visible = false; scene.add(m)
      starStreaks.push({ m, off })
    }

    let T = 0, fired = false, c1 = false, beamLife = 0, slugT = 0, slugDone = false, impactCd = 0, impacts = 0, shake = 0, flashLife = -1, ended = false
    let chargeStarted = false, recoil = 0
    let collapseT = -1, boomT = -1, boomFired = false
    return (dt) => {
      T += dt
      if (bhTick) bhTick(T)
      field.tick(dt)

      // pre-fire: the round going critical in the tube
      if (!chargeStarted && T >= 0.3) { chargeStarted = true; discharge = playLanceCharge({ rate: 1.15, volume: 0.85 }) }
      if (!fired) {
        const k = Math.min(1, T / FIRE_T)
        chargeOrb.scale.setScalar(0.8 + k * 1.3)
        chargeMat.opacity = 0.55 + 0.45 * Math.sin(T * (6 + k * 14)) * (0.4 + 0.6 * k)
      }

      if (!fired && T >= FIRE_T) {
        fired = true
        discharge && discharge(true)                     // cut the tone, fire the boom
        chargeOrb.visible = false
        beam.visible = true; beamMat.opacity = 1; beamLife = 0
        slug.visible = true; streak.visible = true; slug.position.copy(MUZZLE); slug.scale.setScalar(2)
        fx.blast(MUZZLE.clone(), true, { silent: true })  // the discharge boom already spoke
        sfx.bed('sfx/missiletrail.mp3', { volume: 0.5, loop: false }).play()   // the package tearing away
        sfx.rumble(0.35, FLIGHT)                          // the long coast, felt in the hull
        for (const st of starStreaks) st.m.visible = true
        recoil = 1
        shake = 1.0
        if (!c1) { c1 = true; comms.show('Her Imperial Majesty Iliantha III', LINE1, { persist: true }) }
      }

      // recoil: the whole platform kicked back along the geodesic, easing home
      if (recoil > 0) {
        recoil = Math.max(0, recoil - dt * 0.8)
        gun.position.copy(LAUNCH).addScaledVector(dir, -3.2 * Math.sin(recoil * Math.PI))
      }

      if (beam.visible) { beamLife += dt; beamMat.opacity = Math.max(0, 0.9 - beamLife / 0.3); const w = 1 + beamLife * 2.4; beam.scale.set(w, 1, w); if (beamLife > 0.28) beam.visible = false }
      if (slug.visible) {
        slugT += dt; const p = Math.min(1, slugT / FLIGHT)
        slug.position.copy(LAUNCH).addScaledVector(dir, dist * p)
        slug.scale.setScalar(1.0)                          // a comet at chase range, not a wall
        streak.position.copy(slug.position).addScaledVector(dir, -9)
        streak.scale.set(0.45, 1, 0.45)
        streakMat.opacity = 0.7 * (1 - p * 0.4)
        // the crossing: streaks fade in with the coast, recycle ahead as they
        // fall behind the round, and gutter out on final approach
        stMat.opacity = 0.55 * Math.min(1, slugT / 0.7) * Math.min(1, ((1 - p) * FLIGHT) / 0.7)
        for (const st of starStreaks) {
          if (_s.subVectors(st.m.position, slug.position).dot(dir) < -50) {
            st.m.position.copy(slug.position).addScaledVector(dir, 180 + Math.random() * 260).add(st.off)
          }
        }
        if (p >= 1 && !slugDone) {
          slugDone = true; slug.visible = false; streak.visible = false
          for (const st of starStreaks) st.m.visible = false
          flashLife = 0; shake = 1.8; sfx.rumble(0.95, 2.6); shock.visible = true
        }
      }

      // annihilation: white flash, ring shockwave, infall, then the barrage
      if (flashLife >= 0 && collapseT < 0) {
        flashLife += dt
        flashMat.opacity = Math.max(0, 1 - flashLife / 1.1); flash.scale.setScalar(1 + flashLife * 80)
        shockMat.opacity = Math.max(0, 0.8 - flashLife * 0.7)
        shock.scale.setScalar(2 + flashLife * 85); shock.lookAt(camera.position)
        for (const f of infall) {
          f.m.visible = flashLife < 1.4
          const rr = Math.max(0.5, f.r0 * (1 - flashLife * f.s))
          f.m.position.copy(TARGET).addScaledVector(f.d0, rr)
          f.m.scale.setScalar(0.4 + rr * 0.02)
        }
        if (impacts < 34) { impactCd -= dt; if (impactCd <= 0) { const off = new THREE.Vector3((Math.random() - 0.5) * 22, (Math.random() - 0.5) * 22, (Math.random() - 0.5) * 22); fx.blast(off.add(TARGET), Math.random() < 0.5); impactCd = 0.06; impacts++; shake = Math.min(2, shake + 0.2) } }
        if (flashLife >= 2.2) collapseT = 0                    // the horizon starts to gutter
      }

      // Hawking runaway: the wounded horizon shrinks, drinking the wreckage —
      // one held breath of dark — then everything it ever held comes back out
      if (collapseT >= 0 && boomT < 0) {
        collapseT += dt
        const p = Math.min(1, collapseT / 1.5)
        const s = Math.pow(1 - p, 1.6)
        bhQuad.material.uniforms.uRs.value = Math.max(0.01, BH_RS * s)
        bhQuad.material.uniforms.uDiskIn.value = Math.max(0.02, BH_IN * s)
        bhQuad.material.uniforms.uDiskOut.value = Math.max(0.04, BH_OUT * s)
        bhShadow.scale.setScalar(Math.max(0.001, s))
        for (const f of infall) {
          f.m.visible = p < 1
          const rr = Math.max(0.5, f.r0 * (1 - p))
          f.m.position.copy(TARGET).addScaledVector(f.d0, rr)
          f.m.scale.setScalar(0.3 + rr * 0.02)
        }
        if (p >= 1) { boomT = 0; bhGroup.visible = false }
      }
      if (boomT >= 0) {
        boomT += dt
        if (!boomFired && boomT >= 0.45) {
          boomFired = true
          flash.scale.setScalar(1); flashMat.opacity = 1
          sfx.explosion(true); sfx.rumble(1, 3.4); shake = 2.4
          for (let i = 0; i < 5; i++) { const off = new THREE.Vector3((Math.random() - 0.5) * 18, (Math.random() - 0.5) * 18, (Math.random() - 0.5) * 18); fx.blast(off.add(TARGET), i < 2) }
          flings = field.group.children.map((m) => ({ m, dir: m.position.clone().sub(TARGET).normalize(), spd: 16 + Math.random() * 30 }))
        }
        if (boomFired) {
          flashMat.opacity = Math.max(0, flashMat.opacity - dt / 1.3)
          flash.scale.setScalar(flash.scale.x + dt * 170)
          for (const r of burstRings) {
            if (boomT - 0.45 < r.delay) continue
            if (r.life < 0) { r.life = 0; r.m.visible = true }
            r.life += dt
            r.m.scale.setScalar(2 + r.life * 110)
            r.m.lookAt(camera.position)
            r.mat.opacity = Math.max(0, 0.85 * (1 - r.life / 1.7))
          }
          if (flings) for (const f of flings) { f.m.position.addScaledVector(f.dir, f.spd * dt); f.spd *= 0.995 }   // the field blown outward
        }
      }

      // camera: locked on the gun for the cast, then riding the round's flank
      // through the streaking dark, then pulled wide and shuddering for the kill
      shake = Math.max(0, shake - dt * 1.4)
      if (!fired) {
        camera.position.copy(CAM_GUN)
        _l.copy(MUZZLE)
      } else if (!slugDone) {
        // chase rig: swinging slowly across the round's wake — high-right to
        // low-left, breathing in and out — while the seat grows dead ahead
        const fp = Math.min(1, Math.max(0, (T - FIRE_T) / FLIGHT))
        const sw = fp * fp * (3 - 2 * fp)
        const lat = 9 - 16 * sw
        const vert = 4.4 - 2.6 * sw + Math.sin(T * 0.6) * 0.9
        const back = 17 + 4 * Math.sin(sw * Math.PI)
        _c.copy(slug.position).addScaledVector(dir, -back).addScaledVector(side, lat).addScaledVector(up, vert)
        const kIn = Math.min(1, (T - FIRE_T) / 0.9), kie = kIn * kIn * (3 - 2 * kIn)
        _p.lerpVectors(CAM_GUN, _c, kie)
        camera.position.copy(_p)
        camImpact.copy(_p)
        _l.copy(slug.position).addScaledVector(dir, 14)   // eyes forward, on the seat growing out of the dark
      } else {
        const k = Math.min(1, (T - IMPACT_T) / 1.6), ke = k * k * (3 - 2 * k)
        _p.lerpVectors(camImpact, CAM_WIDE, ke)
        const kk = Math.min(1, Math.max(0, (T - IMPACT_T) / 5))
        _p.x -= kk * 10; _p.y -= kk * 20; _p.z -= kk * 30
        camera.position.copy(_p)
        _l.copy(TARGET)
      }
      camera.position.x += (Math.random() - 0.5) * shake * 4
      camera.position.y += (Math.random() - 0.5) * shake * 3
      // the chase must hold the round dead in frame — everything else can drift
      _look.lerp(_l, 1 - Math.exp(-(fired && !slugDone ? 14 : 4) * dt))
      camera.lookAt(_look)
      for (const m of sky) m.position.copy(camera.position)   // infinite backdrop

      if (!ended && T >= IMPACT_T + 8.1) { ended = true; end() }
    }
  },
}
