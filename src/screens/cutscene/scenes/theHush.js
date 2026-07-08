import * as THREE from 'three'
import { buildAleph, makeGasGiant, makeBlackHoleLensed } from '../../battle/geometry'
import { asteroidField } from '../models'

// The Discord's purpose revealed: the Aleph silences the Song of the Stars. The
// Hush descends — silence rippling out, the light and the stars going dark —
// and at the last the artifact itself collapses, tearing open a veiled seat.
const LINE1 = 'The Aleph is answering something. Listen — the stars. They are going out.'
const LINE2 = 'Caelum tacet.'   // "The heavens fall silent" — the Discord's answer to Caelum canit
const LINE3 = 'Throne preserve us. I can no longer hear the Song.'
const COLLAPSE_T = 15.2         // the Aleph goes critical and becomes a horizon

export default {
  label: 'CUTSCENE / THE HUSH',
  establishing: { name: 'THE HUSH', sub: 'The Song of the Stars Fails', stamp: 'AUDITIO FEED · PRIORITY OMEGA' },
  feed: [
    { t: 1.0,  level: 'warn',    text: 'Stellar output falling across all monitored classes' },
    { t: 3.2,  level: 'crit',    text: 'Carrier lost · 10.3 GHz · re-acquisition failed' },
    { t: 5.4,  level: 'crit',    text: '[FAIL] Auditio channel silent · the chord does not answer' },
    { t: 8.0,  level: 'discord', text: 'YE SHALL BE AS GODS' },
    { t: 10.5, level: 'warn',    text: 'Chronology protection scan inconclusive · σ rising' },
    { t: 12.5, level: 'crit',    text: 'Sky luminance 4% of baseline · the Hush descends' },
    { t: 15.4, level: 'crit',    text: 'COLLAPSE · event horizon forming · the seat is veiled' },
    { t: 17.5, level: 'warn',    text: 'Accretion signature only · the artifact is gone' },
  ],
  readout: {
    id: 'Auditio Ultima Monitor',
    rows: [
      { label: 'Song',      value: (t) => (t > 12 ? 'SILENT' : `${Math.max(0.4, 42 - t * 3.4).toFixed(1)} dB`) },
      { label: 'Starfield', value: (t) => `${Math.max(4, Math.floor(100 - t * 14))}%` },
      { label: 'Tachyon',   value: (t) => `${(0.8 + t * 0.35).toFixed(2)} σ` },
    ],
  },
  bloom: 0.55,
  create(ctx) {
    const { scene, camera, fx, sfx, comms, end, lights, backdrop } = ctx

    const alephInner = buildAleph()
    const abox = new THREE.Box3().setFromObject(alephInner)
    alephInner.position.sub(abox.getCenter(new THREE.Vector3()))
    const aleph = new THREE.Group(); aleph.add(alephInner); aleph.scale.setScalar(2.2)
    scene.add(aleph)

    makeGasGiant(scene, [], new THREE.Vector3(120, 30, -200), new THREE.Vector3(0.5, 0.4, 0.6).normalize())
    const field = asteroidField(ctx, { count: 24, center: new THREE.Vector3(0, 0, 0), inner: 50, outer: 180, scaleMax: 4.5 })

    // a shroud that swallows the heavens as the Song is drunk away
    const shroud = new THREE.Mesh(new THREE.SphereGeometry(340, 24, 24), new THREE.MeshBasicMaterial({ color: 0x000008, transparent: true, opacity: 0, side: THREE.BackSide, depthWrite: false }))
    shroud.renderOrder = -5; scene.add(shroud)

    // the wrongness made visible: a violet halo breathing around the artifact,
    // glowing brighter as every honest light goes out. A soft radial-gradient
    // sprite — a hard additive sphere would read as a balloon, not a glow.
    const glowCv = document.createElement('canvas'); glowCv.width = glowCv.height = 128
    const gctx = glowCv.getContext('2d')
    const grad = gctx.createRadialGradient(64, 64, 4, 64, 64, 64)
    grad.addColorStop(0, 'rgba(158,112,255,0.85)'); grad.addColorStop(0.4, 'rgba(120,80,255,0.3)'); grad.addColorStop(1, 'rgba(90,60,255,0)')
    gctx.fillStyle = grad; gctx.fillRect(0, 0, 128, 128)
    const coronaMat = new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(glowCv), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false })
    const corona = new THREE.Sprite(coronaMat); corona.scale.setScalar(52); scene.add(corona)
    const hushLight = new THREE.PointLight(0x7a50ff, 0, 300); scene.add(hushLight)

    // named stars — bright points that flare once and go out, one by one
    const starMat = new THREE.MeshBasicMaterial({ color: 0xdfe8ff, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false })
    const dying = []
    for (let i = 0; i < 12; i++) {
      const m = new THREE.Mesh(fx.blastGeo, starMat.clone())
      const th = Math.random() * Math.PI * 2, ph = 0.25 + Math.random() * 1.1, R = 230 + Math.random() * 60
      m.position.set(R * Math.sin(ph) * Math.cos(th), R * Math.cos(ph) * 0.8 + 30, R * Math.sin(ph) * Math.sin(th))
      m.scale.setScalar(1.9 + Math.random() * 1.3); scene.add(m)
      dying.push({ m, mat: m.material, dieAt: 2.2 + i * 0.68, t: -1, base: m.scale.x })
    }

    // expanding rings of silence pulsing out of the artifact — a thin bright
    // wavefront trailed by a film of dark that stays where it passed
    const ringGeo = new THREE.RingGeometry(0.965, 1.0, 64)
    const rings = []
    let ringCd = 0
    const spawnRing = () => {
      const mat = new THREE.MeshBasicMaterial({ color: 0x6a4cff, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })
      const m = new THREE.Mesh(ringGeo, mat); scene.add(m)
      const vmat = new THREE.MeshBasicMaterial({ color: 0x000004, transparent: true, opacity: 0.1, depthWrite: false })
      const veil = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 20), vmat); scene.add(veil)
      rings.push({ m, mat, veil, vmat, life: 0 })
    }

    // what the Aleph becomes: the lensed black hole, pre-built dark. Its image
    // is raymarched in world units off uniforms, so the horizon genuinely
    // inflates by scaling uRs / disk radii (plus the shadow sphere) from zero.
    const bh = new THREE.Group(); bh.visible = false; scene.add(bh)
    const bhTick = makeBlackHoleLensed(bh, [], new THREE.Vector3(0, 0, 0))
    const bhQuad = bh.children.find((c) => c.geometry && c.geometry.type === 'PlaneGeometry')
    const bhShadow = bh.children.find((c) => c.geometry && c.geometry.type === 'SphereGeometry')
    const BH_RS = bhQuad.material.uniforms.uRs.value
    const BH_IN = bhQuad.material.uniforms.uDiskIn.value
    const BH_OUT = bhQuad.material.uniforms.uDiskOut.value

    // the collapse flash — violet-white, swallowing the cut where Aleph becomes horizon
    const flashMat = new THREE.SpriteMaterial({ map: coronaMat.map, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false })
    const collapseFlash = new THREE.Sprite(flashMat); collapseFlash.scale.setScalar(160); scene.add(collapseFlash)

    // the Song of the Stars itself, drunk away to nothing as the Hush descends
    const song = sfx.bed('auditioultima.mp3', { volume: 0.32 })
    let songStarted = false

    const a0 = lights.ambient.intensity, k0 = lights.key.intensity, r0 = lights.rim.intensity
    let T = 0, c1 = false, c2 = false, c3 = false, ended = false, firstDeath = true
    let collapsed = false, growT = 0
    return (dt) => {
      T += dt
      field.tick(dt)

      // the last seconds: the artifact convulses, then is a horizon
      const strain = Math.min(1, Math.max(0, (T - 12.5) / (COLLAPSE_T - 12.5)))   // 0 → critical
      aleph.rotation.y += (0.22 + strain * 1.6) * dt; aleph.rotation.x += (0.1 + strain * 0.8) * dt
      aleph.scale.setScalar(2.2 * (1 + (0.05 + strain * 0.3) * Math.sin(T * (2.2 + strain * 9))))

      if (!collapsed && T >= COLLAPSE_T) {
        collapsed = true
        aleph.visible = false
        bh.visible = true
        flashMat.opacity = 1
        sfx.rumble(0.9, 3.2)                             // the hush swallows even this
        hushLight.intensity = 4
      }
      if (collapsed) {
        growT += dt
        const g = Math.min(1, growT / 2.2), ge = 1 - Math.pow(1 - g, 3)         // horizon inflating
        bhQuad.material.uniforms.uRs.value = BH_RS * ge
        bhQuad.material.uniforms.uDiskIn.value = Math.max(0.01, BH_IN * ge)
        bhQuad.material.uniforms.uDiskOut.value = Math.max(0.02, BH_OUT * ge)
        bhShadow.scale.setScalar(Math.max(0.001, ge))
        bhTick(T)
        flashMat.opacity = Math.max(0, flashMat.opacity - dt * 1.1)
        coronaMat.opacity = Math.max(0, coronaMat.opacity - dt * 0.5)           // the wrong glow feeds the horizon
        hushLight.intensity = Math.max(0.6, hushLight.intensity - dt * 1.4)
      }

      // the Song fails: fade from full to silence across the descent
      if (!songStarted) { songStarted = true; song.play() }
      song.setVolume(0.32 * Math.max(0, 1 - Math.max(0, T - 3.5) / 7.5))

      // the corona waxes as the world wanes (until the horizon drinks it too)
      if (!collapsed) {
        const wane = Math.min(1, T / 11)
        coronaMat.opacity = (0.55 + strain * 0.3) * wane * (0.82 + 0.18 * Math.sin(T * (1.7 + strain * 6)))
        corona.scale.setScalar(52 * (1 + wane * 0.5 + 0.04 * Math.sin(T * 2.2)))
        hushLight.intensity = 1.7 * wane * (1 + strain * 0.8)
      }

      // stars die one by one — a last flare, then nothing
      for (const s of dying) {
        if (s.t < 0 && T >= s.dieAt) {
          s.t = 0
          if (firstDeath) { firstDeath = false; sfx.blip(320, 0.16, 0.7) }   // the first one is heard
        }
        if (s.t >= 0 && s.t < 10) {
          s.t += dt
          const k = s.t / 0.55
          if (k < 1) { s.m.scale.setScalar(s.base * (1 + 2.2 * Math.sin(Math.min(1, k) * Math.PI))); s.mat.opacity = 0.95 }
          else { s.mat.opacity = Math.max(0, 0.95 - (s.t - 0.55) * 2.4); s.m.scale.setScalar(s.base * Math.max(0.01, 1 - (s.t - 0.55) * 1.6)) }
          if (s.mat.opacity <= 0) { s.m.visible = false; s.t = 99 }
        }
      }

      // silence ripples (the source is gone once the horizon has it)
      ringCd -= dt; if (ringCd <= 0 && !collapsed) { spawnRing(); ringCd = 1.4 }
      for (let i = rings.length - 1; i >= 0; i--) {
        const r = rings[i]; r.life += dt; const s = 2 + r.life * 26
        r.m.scale.setScalar(s); r.m.lookAt(camera.position); r.mat.opacity = Math.max(0, 0.55 * (1 - r.life / 3.2))
        r.veil.scale.setScalar(Math.max(0.01, s * 0.82)); r.vmat.opacity = Math.min(0.11, r.life * 0.1) * (1 - r.life / 3.4)
        if (r.life > 3.2) { scene.remove(r.m); r.mat.dispose(); scene.remove(r.veil); r.vmat.dispose(); rings.splice(i, 1) }
      }

      // dread push-in + slow orbit — then a slow retreat as the horizon opens,
      // wide enough to hold the whole lensed disk
      const az = 0.4 + 0.08 * T
      const d = collapsed
        ? Math.min(112, 78 - Math.min(40, COLLAPSE_T * 2.2) + growT * 16)
        : 78 - Math.min(40, T * 2.2)
      camera.position.set(Math.cos(az) * d, 8 + Math.sin(T * 0.3) * 3, Math.sin(az) * d); camera.lookAt(0, 0, 0)
      camera.rotateZ(0.05 * Math.sin(T * 0.33))

      // the Hush: light, stars and the very sky go out
      const dim = Math.max(0.08, 1 - T / 11)
      lights.ambient.intensity = a0 * dim; lights.key.intensity = k0 * dim; lights.rim.intensity = r0 * dim
      backdrop.starMat.opacity = 0.85 * Math.max(0, 1 - T / 7)
      shroud.material.opacity = Math.min(0.9, Math.max(0, (T - 2) / 9))

      if (!c1 && T >= 1.5) { c1 = true; comms.show('Princess Astraia', LINE1) }
      if (!c2 && T >= 6.0) { c2 = true; comms.show('The Discord', LINE2, { team: 'red', persist: true }) }
      if (!c3 && T >= 10.5) { c3 = true; comms.show('Princess Astraia', LINE3) }
      if (!ended && T >= 21) { ended = true; end() }
    }
  },
}
