import * as THREE from 'three'
import { TEAMS } from '../../battle/constants'
import { makeEarthlike, makeMachinePlanet, buildBlueModel, makeShield } from '../../battle/geometry'
import { buildCathedra } from '../models'

// At the Novarayan Throneworld: the Empress has heard the Discord, as the Final
// Hearing foretold, and resolves to cast the Lance.
const LINE1 = 'I have heard it. The Discord, as it was foretold.'
const LINE2 = 'From the Cathedra high, to the listening below — falls the Lance that the Discord besought.'

export default {
  label: 'CUTSCENE / THE FINAL HEARING',
  establishing: { name: 'NOVARAYA', sub: 'Imperial Throneworld', stamp: 'THE FINAL HEARING · SYNOD WITNESS RECORD' },
  feed: [
    { t: 1.2,  level: 'info', text: 'The Cathedra in session · honour guard on station' },
    { t: 4.0,  level: 'info', text: 'She has heard it · the Discord, as it was foretold' },
    { t: 7.2,  level: 'warn', text: 'The Synod defers · prophecy invoked: AUDITIO ULTIMA' },
    { t: 10.8, level: 'crit', text: 'Her word: the Lance is to be cast · STRATCON 1 in effect' },
  ],
  readout: {
    id: 'Synod Record · CLR-Ω',
    rows: [
      { label: 'Hearing',  value: 'FINAL' },
      { label: 'Stratcon', value: (t) => (t < 10.8 ? '2' : '1') },
      { label: 'Assent',   value: (t) => (t < 10.8 ? 'IN SESSION' : 'GIVEN') },
    ],
  },
  bloom: 0.7,
  create(ctx) {
    const { scene, camera, fx, sfx, comms, end, orient } = ctx
    // the Throneworld below — built at prop scale, then blown up ×6 so the
    // horizon reads planetary against the spire (still not to scale, but the
    // Cathedra no longer dwarfs its own world)
    const planet = new THREE.Group(); scene.add(planet)
    const planetTick = makeEarthlike(planet, [], new THREE.Vector3(), new THREE.Vector3(0.3, 0.7, 0.5).normalize())
    planet.scale.setScalar(6)
    planet.rotation.set(-0.95, 0.4, 0)            // tip the ice cap away — temperate ground below
    planet.position.set(0, -158, 0)               // R 22×6 → surface crest ≈ y −26

    // a breathable rim — the shield shader doubling as atmosphere at the limb
    const atmo = makeShield(0x7fb4ff)
    atmo.mesh.scale.setScalar(22.7)
    atmo.mat.uniforms.uIntensity.value = 0.5
    planet.add(atmo.mesh)

    // low clouds drifting between the spire and the horizon
    const cloudCv = document.createElement('canvas'); cloudCv.width = cloudCv.height = 128
    const cg = cloudCv.getContext('2d')
    const cgr = cg.createRadialGradient(64, 64, 6, 64, 64, 64)
    cgr.addColorStop(0, 'rgba(210,225,250,0.5)'); cgr.addColorStop(0.55, 'rgba(190,210,240,0.2)'); cgr.addColorStop(1, 'rgba(180,200,235,0)')
    cg.fillStyle = cgr; cg.fillRect(0, 0, 128, 128)
    const cloudTex = new THREE.CanvasTexture(cloudCv)
    const clouds = []
    for (let i = 0; i < 6; i++) {
      const mat = new THREE.SpriteMaterial({ map: cloudTex, transparent: true, opacity: 0.1 + Math.random() * 0.08, depthWrite: false })
      const sp = new THREE.Sprite(mat)
      sp.scale.set(26 + Math.random() * 22, 7 + Math.random() * 5, 1)
      sp.position.set(-60 + Math.random() * 120, -21 + Math.random() * 7, -30 + Math.random() * 55)
      scene.add(sp)
      clouds.push({ sp, v: 0.5 + Math.random() * 0.7 })
    }
    // the Great Litany hanging in the sky, girdled by its diadem
    const litanyPos = new THREE.Vector3(-80, 0, -250)
    const engineTick = makeMachinePlanet(scene, [], litanyPos, new THREE.Vector3(0.5, 0.4, 0.6).normalize())
    const diademMat = new THREE.MeshBasicMaterial({ color: 0x6f86ff, transparent: true, opacity: 0.45, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })
    for (const [rad, tube, rx] of [[58, 0.8, -1.1], [66, 0.4, -1.0]]) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(rad, tube, 8, 120), diademMat)
      ring.position.copy(litanyPos); ring.rotation.set(rx, 0.4, 0); scene.add(ring)
    }

    // the Cathedra rising from the near pole
    const cathedra = buildCathedra(); cathedra.position.set(0, -27.5, 0); cathedra.scale.setScalar(1.05); scene.add(cathedra)   // plinth bedded into the crust (surface crest ≈ −26)

    // the word made light: a pillar rising from the crown orb toward the
    // listening Engine when the Lance is ordered cast (crown orb ≈ y 8.4)
    const pillarMat = new THREE.MeshBasicMaterial({ color: 0xfff0c4, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false })
    const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.6, 150, 12, 1, true), pillarMat)
    pillar.position.set(0, 8.4 + 75, 0); pillar.visible = false; scene.add(pillar)
    const crownLight = new THREE.PointLight(0xffe9b0, 0, 160); crownLight.position.set(0, 8.4, 0); scene.add(crownLight)

    // an honour guard holding station above the spire
    const guardMat = new THREE.MeshStandardMaterial({ color: TEAMS.blue.color, emissive: TEAMS.blue.color, emissiveIntensity: 0.55, metalness: 0.6, roughness: 0.4 })
    const guard = []
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2
      const g = new THREE.Group(); g.add(new THREE.Mesh(buildBlueModel(), guardMat))
      const glow = new THREE.Mesh(fx.blastGeo, fx.glowMat.blue); glow.scale.setScalar(0.3); glow.position.set(0, 0, -0.95); g.add(glow)
      g.scale.setScalar(1.3); g.position.set(Math.cos(a) * 22, 18 + (i % 2) * 4, Math.sin(a) * 22)
      orient(g, new THREE.Vector3(-Math.cos(a), 0, -Math.sin(a)))   // face inward, toward the spire
      scene.add(g); guard.push({ g, a, base: g.position.y })
    }

    // Her theme, quietly, under Her own scene
    const anthem = sfx.bed('oempress.mp3', { volume: 0 })
    let anthemStarted = false

    const camFrom = new THREE.Vector3(0, 26, 64), camTo = new THREE.Vector3(-15, 0, 34), _p = new THREE.Vector3()
    let T = 0, c1 = false, c2 = false, ended = false, resolve = 0
    return (dt) => {
      T += dt
      planetTick(T)
      engineTick(T)

      if (!anthemStarted) { anthemStarted = true; anthem.play() }
      anthem.setVolume(0.22 * Math.min(1, T / 2.5) * Math.min(1, Math.max(0, (16.5 - T) / 2.5)))

      for (const c of clouds) { c.sp.position.x += c.v * dt; if (c.sp.position.x > 75) c.sp.position.x = -75 }

      // the resolve: the crown ignites and the word ascends
      if (T >= 7.5) {
        if (resolve === 0) { pillar.visible = true; sfx.rumble(0.4, 2.6); sfx.blip(660, 0.18, 0.9) }
        resolve = Math.min(1, resolve + dt / 1.4)
        pillarMat.opacity = resolve * (0.34 + 0.1 * Math.sin(T * 5.2))
        pillar.scale.set(1 + 0.15 * Math.sin(T * 3.1), 1, 1 + 0.15 * Math.cos(T * 2.7))
        crownLight.intensity = resolve * (2.2 + 0.5 * Math.sin(T * 4))
      }

      // the honour guard holds its ring — then breaks skyward with the word
      for (const u of guard) {
        u.a += (0.12 + resolve * 0.06) * dt
        const r = 22 + resolve * 14, climb = resolve * 26
        u.g.position.set(Math.cos(u.a) * r, u.base + climb + Math.sin(T * 1.2 + u.a) * 1.5, Math.sin(u.a) * r)
        const up = resolve * 0.9
        orient(u.g, new THREE.Vector3(-Math.sin(u.a), up, Math.cos(u.a)))
      }

      _p.lerpVectors(camFrom, camTo, Math.min(1, T / 12)); camera.position.copy(_p)
      camera.lookAt(0, -2 + resolve * 9, 0)   // the eye follows the pillar up
      if (!c1 && T >= 2.0) { c1 = true; comms.show('The Empress', LINE1) }
      if (!c2 && T >= 7.5) { c2 = true; comms.show('The Empress', LINE2, { persist: true }) }
      if (!ended && T >= 15) { ended = true; end() }
    }
  },
}
