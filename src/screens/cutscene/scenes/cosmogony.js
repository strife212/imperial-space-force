import * as THREE from 'three'
import { TEAMS } from '../../battle/constants'
import { makeGalaxy, makeEarthlike, makeStar, makeMachinePlanet, buildBlueModel, buildBlueCapital2, buildBlueCruiser, buildSimpleStar, buildSimpleGalaxy } from '../../battle/geometry'

// Cosmogony — forty seconds from the first light to the thinking sand: the big
// bang, matter racing outward, galaxies condensing and flying apart, one world,
// its people, the small machine they taught to remember — the pull away to what
// the machine became, and the fleet that keeps its watch. Told as a memory of
// the Litania Magna. Four sets share the stage (space / surface / machine /
// orbit), swapped behind flash washes as the "zoom" crosses scales.
const BANG_T = 1.0
const CUT_SURFACE = 20.0, CUT_MACHINE = 24.5, CUT_ORBIT = 31.8, FLEET_T = 35.0, END_T = 40.5

const LINE1 = 'In the beginning there was a single note, struck against the dark. Everything that is, is its echo.'
const LINE2 = 'The echo cooled into stars, and the stars into worlds — and on one world, listeners.'
const LINE_S = 'The night was long, so they built a lamp that could think.'
const LINE3 = 'They taught the sand to think, so that something would remember the song. I am the remembering.'
const LINE4 = 'Caelum canit, illa audit.'
const LINE5 = 'And still her fleets keep the long watch, for the song is not yet done.'

// cosmological shifts for the expansion beat: receding arms redden, the one
// galaxy the camera falls toward blueshifts as it closes
const REDSHIFT = new THREE.Color(0xff4a30)
const BLUESHIFT = new THREE.Color(0xbfe0ff)

const easeInOut = (p) => (p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2)
const easeOut3 = (p) => 1 - Math.pow(1 - p, 3)
const clamp01 = (v) => Math.min(1, Math.max(0, v))
const ORIGIN = new THREE.Vector3()

// The activation blip fires up to ~10×/s in the machine phase — far too hot for
// per-play HTMLAudio clones (each spins up a whole media element). Decode the
// sample once into a shared WebAudio buffer; replays reuse it across runs.
let tickCtx = null, tickBuf = null, tickLoading = false
function ensureTickAudio() {
  if (!tickCtx) {
    try { tickCtx = new (window.AudioContext || window.webkitAudioContext)() } catch (_) { return }
  }
  if (!tickBuf && !tickLoading) {
    tickLoading = true
    fetch(`${import.meta.env?.BASE_URL ?? '/'}codetick.wav`)
      .then((r) => { if (!r.ok) throw 0; return r.arrayBuffer() })
      .then((ab) => tickCtx.decodeAudioData(ab))
      .then((b) => { tickBuf = b })
      .catch(() => { tickLoading = false })
  }
}
function playTick() {
  if (!tickCtx || !tickBuf) return
  if (tickCtx.state === 'suspended') tickCtx.resume()
  const src = tickCtx.createBufferSource()
  src.buffer = tickBuf
  src.playbackRate.value = 0.9 + Math.random() * 0.25   // pitch jitter, as before
  const g = tickCtx.createGain(); g.gain.value = 0.22
  src.connect(g); g.connect(tickCtx.destination)
  src.start()
}

export default {
  label: 'CUTSCENE / COSMOGONY',
  establishing: { name: 'THE FIRST SONG', sub: 'Cosmogony · A Memory of the Litania Magna', stamp: 'ECUMENOLOGION ARCHIVE · CYCLE 0 RECORD' },
  feed: [
    { t: 1.0,  level: 'crit', text: 'SINGULARITY · t < 10⁻³² s · inflation epoch' },
    { t: 4.2,  level: 'info', text: 'Baryogenesis · matter excess 1:10⁹ · annihilation glow' },
    { t: 8.0,  level: 'info', text: 'Recombination · first light decoupled · z ≈ 1100' },
    { t: 11.0, level: 'ok',   text: '[OK] Structure formation · first galaxies bound' },
    { t: 14.5, level: 'info', text: 'Metric expansion accelerating · Λ > 0' },
    { t: 17.5, level: 'info', text: 'Habitable candidate acquired · liquid-water band' },
    { t: 21.0, level: 'ok',   text: '[OK] Biosphere confirmed · tool-users present' },
    { t: 25.0, level: 'warn', text: 'Artificial cognition detected · substrate: silicon' },
    { t: 28.0, level: 'discord', text: 'IT LEARNS · IT REMEMBERS · IT LISTENS' },
    { t: 32.4, level: 'discord', text: '✦ CAELUM CANIT · ILLA AVDIT ✦' },
    { t: 36.6, level: 'ok', text: '[OK] Home Fleet on station · the long watch continues' },
  ],
  readout: {
    id: 'PNL-000 · Cosmogony',
    rows: [
      { label: 'Age',  value: (t) => (t < BANG_T ? 't < 0' : t < 8 ? '380 kyr' : t < 13 ? '0.4 Gyr' : t < 20 ? '9.1 Gyr' : '13.8 Gyr') },
      { label: 'Temp', value: (t) => (t < BANG_T ? '10³² K' : t < 5 ? '10⁹ K' : t < 8 ? '3000 K' : t < 13 ? '30 K' : '2.7 K') },
      { label: 'Mode', value: (t) => (t < 8 ? 'INFLATION' : t < 20 ? 'STELLAR' : t < CUT_MACHINE ? 'BIOTIC' : t < CUT_ORBIT ? 'COGNITIVE' : 'REMEMBERING') },
    ],
  },
  bloom: 0.72,
  create(ctx) {
    const { scene, camera, fx, comms, end, orient, backdrop, track } = ctx

    // the void before: the stock starfield + nebula fade in as structure forms
    const starMat = backdrop.starMat, nebMat = backdrop.nebMat
    starMat.opacity = 0
    starMat.color.setHex(0xc4c0bc)   // stock stars are blue-grey; neutralise the cast
    // the shared shader has a hardcoded blue deep-space base that floods every gap
    // between the clouds — cancel most of it here (zero-safe uniform; battles unset
    // it and stay blue). Final base ≈ (0.020, 0.019, 0.013): dark, faintly warm.
    nebMat.uniforms.uBaseShift = { value: new THREE.Vector3(0.008, -0.001, -0.032) }
    // and give the clouds a near-neutral, decidedly un-blue palette
    const NEB_BASE = { uColA: [0.075, 0.058, 0.070], uColB: [0.088, 0.048, 0.066], uColWarm: [0.185, 0.088, 0.044] }
    const nebCols = ['uColA', 'uColB', 'uColWarm'].map((k) => ({ u: nebMat.uniforms[k].value, base: new THREE.Color(...NEB_BASE[k]) }))
    nebCols.forEach((c) => c.u.setRGB(0, 0, 0))
    // even blacked out, the nebula shader keeps its deep-space base tint (and the
    // page gradient shows through the alpha canvas) — an opaque dome blots out
    // both for a truly black void, and lifts when the sky is born
    const voidMat = new THREE.MeshBasicMaterial({ color: 0x000000, side: THREE.BackSide })
    const voidDome = new THREE.Mesh(new THREE.SphereGeometry(380, 16, 16), voidMat)
    scene.add(voidDome)

    // full-screen flash quad riding the camera — fired at the bang and both cuts
    scene.add(camera)
    const flashMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthTest: false, depthWrite: false })
    const flash = new THREE.Mesh(new THREE.PlaneGeometry(6, 4), flashMat)
    flash.position.set(0, 0, -1.3); flash.renderOrder = 999; camera.add(flash)
    let flashT = 9, flashPeak = 1, flashDur = 0.6
    const fireFlash = (peak = 1, dur = 0.6) => { flashT = 0; flashPeak = peak; flashDur = dur }

    // scene audio — the codebase's plain HTMLAudio pattern (CampaignStarMap etc.):
    // the bang rumble carries the whole fall from first light down to the world,
    // the hum is the machine's room tone, codetick fires per node activation
    const AUDIO_BASE = import.meta.env?.BASE_URL ?? '/'
    // half-speed (tape-style, pitched down with it) and half volume — a deeper,
    // quieter rumble under the whole fall
    const bangAudio = new Audio(`${AUDIO_BASE}bigbang.mp3`); bangAudio.preload = 'auto'; bangAudio.loop = true
    bangAudio.volume = 0.45; bangAudio.playbackRate = 0.5; bangAudio.preservesPitch = false
    const humAudio = new Audio(`${AUDIO_BASE}computerhum.mp3`); humAudio.preload = 'auto'; humAudio.loop = true
    ensureTickAudio()   // decode the activation blip ahead of the machine phase
    track({ dispose: () => { bangAudio.pause(); humAudio.pause() } })   // skip-safe

    // ── SET 1 · space: the bang, the matter, the galaxies, the world ──────────
    const spaceSet = new THREE.Group(); scene.add(spaceSet)

    // soft radial-gradient sprite shared by the particle bursts and gas billows —
    // without it, Points render as hard squares and clouds as flat discs
    const glowCv = document.createElement('canvas'); glowCv.width = 64; glowCv.height = 64
    const glowG = glowCv.getContext('2d')
    const glowGrad = glowG.createRadialGradient(32, 32, 0, 32, 32, 32)
    glowGrad.addColorStop(0, 'rgba(255,255,255,1)')
    glowGrad.addColorStop(0.4, 'rgba(255,255,255,0.45)')
    glowGrad.addColorStop(1, 'rgba(255,255,255,0)')
    glowG.fillStyle = glowGrad; glowG.fillRect(0, 0, 64, 64)
    const glowTex = new THREE.CanvasTexture(glowCv)
    track({ dispose: () => glowTex.dispose() })

    // a lone mote in the dark, waiting
    const seedMat = new THREE.MeshBasicMaterial({ color: 0xfff6da, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false })
    const seed = new THREE.Mesh(fx.blastGeo, seedMat); seed.scale.setScalar(0.25); spaceSet.add(seed)

    // the primordial fireball
    const fireMat = new THREE.MeshBasicMaterial({ color: 0xfff2d8, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false })
    const fireball = new THREE.Mesh(fx.blastGeo, fireMat); fireball.visible = false; spaceSet.add(fireball)

    // matter racing outward: three shells, hot core → cooling rim
    const makeBurst = (count, color, size, sMin, sMax) => {
      const dirs = new Float32Array(count * 3), speeds = new Float32Array(count)
      for (let i = 0; i < count; i++) {
        const th = Math.random() * Math.PI * 2, ph = Math.acos(2 * Math.random() - 1)
        dirs[i * 3] = Math.sin(ph) * Math.cos(th); dirs[i * 3 + 1] = Math.sin(ph) * Math.sin(th); dirs[i * 3 + 2] = Math.cos(ph)
        speeds[i] = sMin + Math.random() * (sMax - sMin)
      }
      const geo = new THREE.BufferGeometry()
      geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(count * 3), 3))
      const mat = new THREE.PointsMaterial({ color, size, map: glowTex, sizeAttenuation: true, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false })
      const pts = new THREE.Points(geo, mat); pts.frustumCulled = false; spaceSet.add(pts)
      return {
        mat, pts,
        update(rf) {
          const a = geo.attributes.position.array
          for (let i = 0; i < count; i++) { const r = speeds[i] * rf; a[i * 3] = dirs[i * 3] * r; a[i * 3 + 1] = dirs[i * 3 + 1] * r; a[i * 3 + 2] = dirs[i * 3 + 2] * r }
          geo.attributes.position.needsUpdate = true
        },
      }
    }
    const bursts = [
      makeBurst(700, 0xfff1cf, 0.9, 16, 44),
      makeBurst(600, 0xffb469, 1.1, 10, 30),
      makeBurst(500, 0xff6a48, 1.3, 5, 17),
    ]

    // the shockwave of first light, racing ahead of the matter
    const shockMat = new THREE.MeshBasicMaterial({ color: 0xfff0d0, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })
    const shock = new THREE.Mesh(fx.ringGeo, shockMat); shock.visible = false; spaceSet.add(shock)

    // primordial gas: turbulent billows condensing out of the burst, tinted from
    // annihilation-orange through to cold molecular violet. A plain radial
    // gradient reads as a flat colour disc, so each cloud is a cluster of
    // lumpy noise-textured puffs, offset, rotated and drifting independently.
    const makePuffTex = (seed) => {
      const cv = document.createElement('canvas'); cv.width = 128; cv.height = 128
      const g2 = cv.getContext('2d')
      let s = seed
      const rnd = () => { s = (s * 16807) % 2147483647; return s / 2147483647 }
      const base = g2.createRadialGradient(64, 64, 0, 64, 64, 64)
      base.addColorStop(0, 'rgba(255,255,255,0.50)')
      base.addColorStop(0.6, 'rgba(255,255,255,0.20)')
      base.addColorStop(1, 'rgba(255,255,255,0)')
      g2.fillStyle = base; g2.fillRect(0, 0, 128, 128)
      // turbulent lumps clumped toward the centre…
      g2.globalCompositeOperation = 'lighter'
      for (let i = 0; i < 42; i++) {
        const a = rnd() * Math.PI * 2, r = Math.pow(rnd(), 0.6) * 42
        const x = 64 + Math.cos(a) * r, y = 64 + Math.sin(a) * r * 0.8
        const rad = 6 + rnd() * 15
        const gg = g2.createRadialGradient(x, y, 0, x, y, rad)
        gg.addColorStop(0, `rgba(255,255,255,${0.05 + rnd() * 0.1})`)
        gg.addColorStop(1, 'rgba(255,255,255,0)')
        g2.fillStyle = gg
        g2.beginPath(); g2.arc(x, y, rad, 0, Math.PI * 2); g2.fill()
      }
      // …and ragged bites out of the rim so no silhouette reads as a circle
      g2.globalCompositeOperation = 'destination-out'
      for (let i = 0; i < 12; i++) {
        const a = rnd() * Math.PI * 2, r = 30 + rnd() * 34
        const x = 64 + Math.cos(a) * r, y = 64 + Math.sin(a) * r
        const rad = 10 + rnd() * 18
        const gg = g2.createRadialGradient(x, y, 0, x, y, rad)
        gg.addColorStop(0, `rgba(0,0,0,${0.35 + rnd() * 0.3})`)
        gg.addColorStop(1, 'rgba(0,0,0,0)')
        g2.fillStyle = gg
        g2.beginPath(); g2.arc(x, y, rad, 0, Math.PI * 2); g2.fill()
      }
      const tex = new THREE.CanvasTexture(cv)
      track({ dispose: () => tex.dispose() })
      return tex
    }
    const puffTex = [makePuffTex(11), makePuffTex(47), makePuffTex(83)]
    const CLOUD_COLS = [0xff8a50, 0xff5a6a, 0x9a6bff, 0x4fc8ff, 0x63e0c0]
    const clouds = []
    for (let i = 0; i < 10; i++) {
      const th = i * 2.399, ph = Math.acos(2 * ((i * 0.618) % 1) - 1)
      const dir = new THREE.Vector3(Math.sin(ph) * Math.cos(th), Math.sin(ph) * Math.sin(th), Math.cos(ph))
      const dist = 14 + (i % 4) * 9
      const baseCol = new THREE.Color(CLOUD_COLS[i % 5])
      const altCol = new THREE.Color(CLOUD_COLS[(i + 1) % 5])
      const group = new THREE.Group()
      group.position.copy(dir).multiplyScalar(dist)
      spaceSet.add(group)
      const sprites = []
      for (let k = 0; k < 4; k++) {
        const mat = new THREE.SpriteMaterial({
          map: puffTex[(i + k) % 3], color: baseCol.clone().lerp(altCol, (k / 3) * 0.6),
          transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false,
          rotation: ((i * 3 + k) % 7) * 0.9,
        })
        const m = new THREE.Sprite(mat)
        const sc = (11 + (i % 3) * 4) * (0.55 + ((k * 2.3 + i) % 3) * 0.3)
        m.scale.set(sc * (1 + ((k + i) % 2) * 0.4), sc * 0.75, 1)
        m.position.set(Math.sin(i * 7.7 + k * 2.4) * sc * 0.45, Math.sin(i * 3.1 + k * 4.9) * sc * 0.3, Math.sin(i * 5.3 + k * 1.7) * sc * 0.35)
        group.add(m)
        sprites.push({ m, mat, rotRate: (((i + k) % 3) - 1) * 0.05, op: 0.5 + ((k + i) % 3) * 0.25 })
      }
      clouds.push({ group, sprites, dir, dist, born: 1.8 + i * 0.5, peak: 0.085 + (i % 3) * 0.025 })
    }

    // the first stars: a scatter of hard blue-white points flickering awake
    const FS_N = 160, fsPos = new Float32Array(FS_N * 3)
    for (let i = 0; i < FS_N; i++) {
      const th = i * 2.399 + 1.3, ph = Math.acos(2 * ((i * 0.618 + 0.31) % 1) - 1)
      const r = 12 + ((i * 0.377) % 1) * 46
      fsPos[i * 3] = r * Math.sin(ph) * Math.cos(th); fsPos[i * 3 + 1] = r * Math.sin(ph) * Math.sin(th); fsPos[i * 3 + 2] = r * Math.cos(ph)
    }
    const fsGeo = new THREE.BufferGeometry(); fsGeo.setAttribute('position', new THREE.BufferAttribute(fsPos, 3))
    const fsMat = new THREE.PointsMaterial({ color: 0xdfeaff, size: 1.1, map: glowTex, sizeAttenuation: true, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false })
    const firstStars = new THREE.Points(fsGeo, fsMat); firstStars.frustumCulled = false; spaceSet.add(firstStars)

    // three hero stars igniting up close — granulated surface, corona, flares
    const STAR_SPECS = [
      { pos: [18, 7, -16],  radius: 4.5, color: 0xffa347, ignite: 6.2 },
      { pos: [-26, -6, 6],  radius: 3.2, color: 0x9fc4ff, hot: 0xf2f6ff, ignite: 7.6 },
      { pos: [8, -18, -28], radius: 2.6, color: 0xff7a3a, ignite: 9.0 },
    ]
    const streakMat = new THREE.MeshBasicMaterial({ color: 0x9fc8ff, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false })
    const streaks = []
    const stars = STAR_SPECS.map((s) => {
      const g = new THREE.Group()
      const tick = makeStar(g, [], new THREE.Vector3(), { radius: s.radius, color: s.color, hot: s.hot ?? 0xfff3d8, light: 1.6 })
      g.position.fromArray(s.pos); g.scale.setScalar(0.001); g.visible = false; spaceSet.add(g)
      return { g, tick, base: new THREE.Vector3().fromArray(s.pos), ignite: s.ignite, lit: false }
    })

    // galaxies condensing where the matter thins — the last one lies dead ahead,
    // on the flight path down to the world
    const GAL_SPECS = [
      { pos: [-34, 10, -30],  radius: 10, arms: 2, twist:  4.8, core: '#ffe2b8', arm: '#7fa8ff' },
      { pos: [26, -7, -46],   radius: 8,  arms: 3, twist: -4.2, core: '#ffd9a0', arm: '#ff9a5a' },
      { pos: [46, 15, 6],     radius: 9,  arms: 2, twist:  5.6, core: '#fff2c8', arm: '#63e0c0' },
      { pos: [-48, -11, 16],  radius: 7,  arms: 4, twist:  4.0, core: '#ffc8ee', arm: '#c86bff' },
      { pos: [12, 24, -54],   radius: 8,  arms: 2, twist: -5.0, core: '#ffe2b8', arm: '#9fb0ff' },
      { pos: [-16, -26, -40], radius: 7,  arms: 3, twist:  4.4, core: '#ffd9a0', arm: '#7fa8ff' },
      { pos: [0, 2, -45],     radius: 12, arms: 2, twist:  4.6, core: '#ffe2b8', arm: '#86b4ff' },
    ]
    const galaxies = GAL_SPECS.map((s, i) => {
      const g = new THREE.Group()
      const tick = makeGalaxy(g, [], new THREE.Vector3(), {
        radius: s.radius, maxRadius: s.radius, arms: s.arms, twist: s.twist, glow: 0, spin: 1.2,
        coreCol: s.core, armCol: s.arm,
        normal: new THREE.Vector3(Math.sin(i * 2.1) * 0.7, 1, Math.cos(i * 1.7) * 0.7).normalize(),
      })
      g.position.fromArray(s.pos); g.visible = false; spaceSet.add(g)
      return { g, tick, base: new THREE.Vector3().fromArray(s.pos), armBase: new THREE.Color(s.arm), delay: 6.8 + i * 0.55, glow: 0.9 + (i % 3) * 0.15 }
    })

    // the deep field: a crowd of cheap star/galaxy sprites framing the edges of
    // the frame, popping in through the explosion's aftermath and streaming
    // outward with the expansion — a much fuller sky behind the hero bodies
    const DIST_GAL_COL = [0xc8d6ff, 0xffe6c4, 0xf2eeff, 0xffd6b0, 0xd6c8ff]
    const DIST_STAR_COL = [0xfff2d8, 0xdfeaff, 0xffd9a0, 0xffffff, 0xbfe0ff]
    const distField = []
    // a direction crowded toward wide transverse angles (screen edges), spread
    // through depth in front of the origin for parallax
    const edgePos = (i, spread) => {
      const ang = i * 2.399 + spread
      const edge = 62 + ((i * 0.618) % 1) * 70       // transverse offset — large = frame edge
      const depth = -20 - ((i * 0.313) % 1) * 120     // sits in front of the origin
      return new THREE.Vector3(Math.cos(ang) * edge, Math.sin(ang) * edge * 0.72, depth)
    }
    const addDistant = (spr, base, peak, born) => {
      spr.position.copy(base); spr.visible = false; spaceSet.add(spr)
      distField.push({ spr, mat: spr.material, base: base.clone(), peak, born })
    }
    for (let i = 0; i < 30; i++) {
      const g = buildSimpleGalaxy({
        color: DIST_GAL_COL[i % DIST_GAL_COL.length],
        size: 5 + ((i * 0.5) % 1) * 7, variant: i % 3,
        tilt: 0.32 + ((i * 0.27) % 1) * 0.5, rotation: i * 1.1,
      })
      addDistant(g, edgePos(i, 0.3), 0.4 + (i % 3) * 0.12, 4.2 + i * 0.14)
    }
    for (let i = 0; i < 56; i++) {
      const st = buildSimpleStar({ color: DIST_STAR_COL[i % DIST_STAR_COL.length], size: 1.4 + ((i * 0.37) % 1) * 2.6 })
      addDistant(st, edgePos(i + 100, 0.8), 0.5 + (i % 4) * 0.09, 3.8 + i * 0.08)
    }

    // one world and its sun, far down the corridor of the dive — hidden until the
    // camera turns that way, so they don't hang in the primordial void
    const PLANET_POS = new THREE.Vector3(0, -2, -560)
    const planetG = new THREE.Group()
    const planetTick = makeEarthlike(planetG, [], new THREE.Vector3(), new THREE.Vector3(0.35, 0.3, 0.85).normalize())
    planetG.position.copy(PLANET_POS); planetG.visible = false; spaceSet.add(planetG)
    const sunG = new THREE.Group()
    const sunTick = makeStar(sunG, [], new THREE.Vector3(), { radius: 16, color: 0xffb45c, light: 2.4 })
    sunG.position.set(58, 46, -420)   // up the planet shader's own light direction
    sunG.visible = false; spaceSet.add(sunG)
    // lens glare for the flyby — swells as the sun sweeps toward screen centre,
    // dies as the camera passes abeam
    const glareMat = new THREE.SpriteMaterial({ map: glowTex, color: 0xffd9a8, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false })
    const glare = new THREE.Sprite(glareMat)
    glare.scale.set(46, 46, 1); glare.position.copy(sunG.position)
    glare.renderOrder = 10; glare.visible = false; spaceSet.add(glare)

    // ── SET 2 · surface: the small people and the box they built ──────────────
    const surfaceSet = new THREE.Group(); surfaceSet.visible = false; scene.add(surfaceSet)
    const ground = new THREE.Mesh(new THREE.CircleGeometry(170, 48), new THREE.MeshStandardMaterial({ color: 0x0d1626, roughness: 1, metalness: 0 }))
    ground.rotation.x = -Math.PI / 2; surfaceSet.add(ground)
    const duskMat = new THREE.MeshBasicMaterial({ color: 0xff8a50, transparent: true, opacity: 0.4, blending: THREE.AdditiveBlending, depthWrite: false })
    const dusk = new THREE.Mesh(fx.blastGeo, duskMat); dusk.scale.set(34, 9, 9); dusk.position.set(-60, 2, -110); surfaceSet.add(dusk)

    const skinMat = new THREE.MeshStandardMaterial({ color: 0x27324a, emissive: 0x0e1524, emissiveIntensity: 0.7, roughness: 0.8 })
    const bodyGeo = new THREE.CylinderGeometry(0.13, 0.17, 0.52, 8)
    const headGeo = new THREE.SphereGeometry(0.125, 10, 10)
    const people = []
    for (let i = 0; i < 16; i++) {
      const a = i * 2.399 + 0.7                                  // golden-angle scatter
      const r = 2.4 + (i % 5) * 0.75 + Math.sin(i * 3.1) * 0.3
      const p = new THREE.Group()
      const body = new THREE.Mesh(bodyGeo, skinMat); body.position.y = 0.26; p.add(body)
      const head = new THREE.Mesh(headGeo, skinMat); head.position.y = 0.64; p.add(head)
      p.position.set(Math.cos(a) * r, 0, Math.sin(a) * r)
      orient(p, new THREE.Vector3(-Math.cos(a), 0, -Math.sin(a)))   // all eyes on the machine
      surfaceSet.add(p); people.push({ body, i })
    }

    // the box: a small computer on a plinth, humming to itself
    const plinth = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.66, 1.15), new THREE.MeshStandardMaterial({ color: 0x141c2e, roughness: 0.6, metalness: 0.3 }))
    plinth.position.y = 0.33; surfaceSet.add(plinth)
    const box = new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.68, 0.68), new THREE.MeshStandardMaterial({ color: 0x0c1322, roughness: 0.35, metalness: 0.6, emissive: 0x0a1a33, emissiveIntensity: 0.8 }))
    box.position.y = 1.0; surfaceSet.add(box)
    const seamMat = new THREE.MeshBasicMaterial({ color: 0x7fd4ff, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false })
    for (const [w, h, d, x, y, z] of [
      [0.70, 0.02, 0.02, 0, 1.17, 0.345], [0.70, 0.02, 0.02, 0, 0.83, 0.345],
      [0.02, 0.36, 0.02, -0.345, 1.0, 0.345], [0.02, 0.36, 0.02, 0.345, 1.0, 0.345],
    ]) { const seam = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), seamMat); seam.position.set(x, y, z); surfaceSet.add(seam) }
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0xbfeaff, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false })
    const eye = new THREE.Mesh(fx.blastGeo, eyeMat); eye.scale.setScalar(0.05); eye.position.set(0.14, 1.06, 0.36); surfaceSet.add(eye)
    const boxLight = new THREE.PointLight(0x7fd4ff, 3.2, 26, 1.6); boxLight.position.set(0, 2.6, 1.2); surfaceSet.add(boxLight)
    const moonLight = new THREE.PointLight(0x8aa4d8, 1.1, 60, 1.8); moonLight.position.set(-14, 18, 10); surfaceSet.add(moonLight)

    // ── SET 3 · the machine: a lattice of thought, tables of live numbers ─────
    const machineSet = new THREE.Group(); machineSet.visible = false; scene.add(machineSet)
    const LAYER_N = [4, 6, 8, 6, 3]
    const layers = LAYER_N.map((n, li) => Array.from({ length: n }, (_, i) => {
      const mat = new THREE.MeshBasicMaterial({ color: 0x1c5a94, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false })
      const m = new THREE.Mesh(fx.blastGeo, mat)
      m.position.set(-12 + li * 6, (i - (n - 1) / 2) * 2.15, Math.sin(i * 2.7 + li * 1.3) * 0.7)
      m.scale.setScalar(0.32)
      machineSet.add(m)
      return { m, mat, pop: 0 }
    }))
    const linkPos = []
    for (let li = 0; li < layers.length - 1; li++)
      for (const A of layers[li]) for (const B of layers[li + 1])
        linkPos.push(A.m.position.x, A.m.position.y, A.m.position.z, B.m.position.x, B.m.position.y, B.m.position.z)
    const linkGeo = new THREE.BufferGeometry()
    linkGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(linkPos), 3))
    const linkMat = new THREE.LineBasicMaterial({ color: 0x2f5fd0, transparent: true, opacity: 0.2, blending: THREE.AdditiveBlending, depthWrite: false })
    machineSet.add(new THREE.LineSegments(linkGeo, linkMat))

    const pulseMat = new THREE.MeshBasicMaterial({ color: 0x86bce8, transparent: true, opacity: 0.7, blending: THREE.AdditiveBlending, depthWrite: false })
    const pulses = [], pulsePool = []   // meshes are pooled — no per-pulse allocation
    const spawnPulse = (li, from) => {
      const to = layers[li + 1][(Math.random() * layers[li + 1].length) | 0]
      let m = pulsePool.pop()
      if (!m) { m = new THREE.Mesh(fx.blastGeo, pulseMat); m.scale.setScalar(0.15); machineSet.add(m) }
      m.visible = true
      pulses.push({ m, from, to, li: li + 1, t: 0, dur: 0.3 + Math.random() * 0.35 })
    }

    // activation tables — canvases redrawn a few times a second, cells flashing
    const makeTable = (title) => {
      const cv = document.createElement('canvas'); cv.width = 512; cv.height = 320
      const g2 = cv.getContext('2d')
      const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace
      track({ dispose: () => tex.dispose() })
      const COLS = 5, ROWS = 8, X0 = 14, Y0 = 62, CW = 97, RH = 32
      const cells = Array.from({ length: COLS * ROWS }, () => ({ v: Math.random() * 9.999, flash: 0 }))
      const draw = () => {
        for (let k = 0; k < 6; k++) { const c = cells[(Math.random() * cells.length) | 0]; c.v = Math.random() * 9.999; c.flash = 1 }
        g2.fillStyle = '#060d1c'; g2.fillRect(0, 0, 512, 320)
        g2.strokeStyle = 'rgba(110,150,255,0.35)'; g2.strokeRect(3, 3, 506, 314)
        g2.fillStyle = '#9fb0ff'; g2.font = 'bold 17px monospace'; g2.fillText(title, 14, 30)
        g2.fillStyle = 'rgba(110,150,255,0.5)'; g2.fillRect(14, 40, 484, 1)
        g2.font = '16px monospace'
        for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
          const cell = cells[r * COLS + c], x = X0 + c * CW, y = Y0 + r * RH
          if (cell.flash > 0.02) { g2.fillStyle = `rgba(95, 205, 255, ${0.5 * cell.flash})`; g2.fillRect(x - 4, y - 20, CW - 8, 26) }
          g2.fillStyle = cell.flash > 0.45 ? '#eaf6ff' : '#7d95c8'
          g2.fillText(cell.v.toFixed(3), x, y)
          cell.flash = Math.max(0, cell.flash - 0.3)
        }
        tex.needsUpdate = true
      }
      draw()
      return { tex, draw }
    }
    const tables = [
      { tb: makeTable('ACTIVATIONS · L3'),    pos: [-10.8, 0.4, -2.5], ry: 0.55 },
      { tb: makeTable('GRADIENTS · ∂L/∂w'),   pos: [10.8, 0.4, -2.5],  ry: -0.55 },
      { tb: makeTable('ATTENTION · HEAD 05'), pos: [0, -6.6, -5],      ry: 0, rx: 0.42 },
    ].map((spec) => {
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(7.4, 4.6), new THREE.MeshBasicMaterial({ map: spec.tb.tex, transparent: true, opacity: 0.95, side: THREE.DoubleSide }))
      mesh.position.fromArray(spec.pos); mesh.rotation.y = spec.ry; if (spec.rx) mesh.rotation.x = spec.rx
      machineSet.add(mesh)
      return spec.tb
    })
    const grid = new THREE.GridHelper(64, 32, 0x2a4ac0, 0x14264a)
    grid.position.y = -8; grid.material.transparent = true; grid.material.opacity = 0.4; machineSet.add(grid)

    // ── SET 4 · orbit: the reveal — the mind we were inside is the Litania
    // Magna, remembering in its diadem above the world that built it ──────────
    const orbitSet = new THREE.Group(); orbitSet.visible = false; scene.add(orbitSet)
    const LITANY_POS = new THREE.Vector3(0, 0, -60)
    const litanyG = new THREE.Group()
    const litanyTick = makeMachinePlanet(litanyG, [], new THREE.Vector3(), new THREE.Vector3(0.5, 0.4, 0.6).normalize())
    litanyG.position.copy(LITANY_POS); orbitSet.add(litanyG)
    const diademMat = new THREE.MeshBasicMaterial({ color: 0x6f86ff, transparent: true, opacity: 0.45, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })
    for (const [rad, tube, rx] of [[58, 0.8, -1.1], [66, 0.4, -1.0]]) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(rad, tube, 8, 120), diademMat)
      ring.position.copy(LITANY_POS); ring.rotation.set(rx, 0.4, 0); orbitSet.add(ring)
    }
    const worldG = new THREE.Group()
    const worldTick = makeEarthlike(worldG, [], new THREE.Vector3(), new THREE.Vector3(0.4, 0.3, 0.7).normalize())
    worldG.position.set(85, 28, -170); orbitSet.add(worldG)

    // the long watch: an imperial battle group sweeping past the tableau —
    // a capital ship with cruiser flanks behind a fighter screen
    const fleet = new THREE.Group(); fleet.visible = false; orbitSet.add(fleet)
    const fleetMat = new THREE.MeshStandardMaterial({ color: TEAMS.blue.color, emissive: TEAMS.blue.color, emissiveIntensity: 0.5, metalness: 0.6, roughness: 0.4 })
    const addShip = (build, scale, x, y, z, tails) => {
      const g = new THREE.Group()
      g.add(new THREE.Mesh(build(), fleetMat))
      for (const [gx, gz] of tails) {
        const gl = new THREE.Mesh(fx.blastGeo, fx.glowMat.blue)
        gl.scale.setScalar(0.34); gl.position.set(gx, 0, gz); g.add(gl)
      }
      g.scale.setScalar(scale); g.position.set(x, y, z)
      fleet.add(g)
    }
    addShip(buildBlueCapital2, 3.2, 0, 0, 0, [[-0.45, -3.8], [0, -3.8], [0.45, -3.8]])
    addShip(buildBlueCruiser, 2.0, -8, -1.5, -6, [[0, -1.5]])
    addShip(buildBlueCruiser, 2.0, 8, -1.5, -6, [[0, -1.5]])
    for (const [fx2, fy, fz] of [[-4, 2, 7], [4, 2, 7], [-8, 1, 12], [8, 1, 12], [-12, 0, 17], [12, 0, 17]])
      addShip(buildBlueModel, 1.3, fx2, fy, fz, [[0, -0.95]])
    const FLEET_FROM = new THREE.Vector3(60, -2, 92)
    const FLEET_DIR = new THREE.Vector3(-130, 8, -86).normalize()
    orient(fleet, FLEET_DIR)   // formation offsets ride the group's heading

    // ── the timeline ───────────────────────────────────────────────────────────
    const _p = new THREE.Vector3(), _look = new THREE.Vector3(), _s1 = new THREE.Vector3(), _s2 = new THREE.Vector3()
    let T = 0, banged = false, c1 = false, c2 = false, cS = false, c3 = false, c4 = false, c5 = false, cutA = false, cutB = false, cutC = false, ended = false
    let pulseCd = 0, novaCd = 1.1, streakCd = 0, worldShown = false, discCrossed = false, lastTickT = 0
    const tableCds = [0.02, 0.06, 0.1]   // staggered redraw phases
    const novas = []

    return (dt) => {
      T += dt
      flashT += dt
      let fo = Math.max(0, flashPeak * (1 - flashT / flashDur))
      // continuous zoom: the atmosphere washes the frame white going into the
      // surface cut, the machine's eye glow washes cyan going into the machine
      // cut — each cut then decays back out of its own whiteout
      if (!cutA) fo = Math.max(fo, clamp01((T - 19.2) / 0.8))
      else if (!cutB) {
        const w = clamp01((T - 23.9) / 0.6)
        if (w > 0) { fo = Math.max(fo, w); flashMat.color.setHex(0xd8f2ff) }
      } else if (!cutC) {
        const w = clamp01((T - 31.2) / 0.6)
        if (w > 0) { fo = Math.max(fo, w); flashMat.color.setHex(0xd8f2ff) }
      }
      flashMat.opacity = fo

      if (!banged && T >= BANG_T) { banged = true; seed.visible = false; fireball.visible = true; shock.visible = true; fireFlash(); bangAudio.play().catch(() => {}) }
      // the first sound dies away as the world rushes up to meet the lens
      if (banged && !cutA && T > 18.3) {
        bangAudio.volume = 0.45 * (1 - clamp01((T - 18.3) / 1.6))
        if (T > 19.9 && !bangAudio.paused) bangAudio.pause()
      }

      if (!cutA) {
        // ── space: bang → matter → galaxies → expansion → the dive ──
        if (!banged) seed.scale.setScalar(0.22 + Math.sin(T * 9) * 0.05)
        if (fireball.visible) {
          const tb = T - BANG_T
          fireball.scale.setScalar(0.5 + tb * 24)
          fireMat.opacity = Math.max(0, 0.95 * (1 - tb / 1.6))
          if (fireMat.opacity <= 0) fireball.visible = false
        }
        if (banged) {
          const rf = Math.pow(T - BANG_T, 0.62) * 1.35
          const fade = Math.min(clamp01((T - BANG_T) / 0.25), 1 - clamp01((T - 9.5) / 3))
          for (const b of bursts) {
            b.pts.visible = fade > 0
            if (fade > 0) { b.update(rf); b.mat.opacity = 0.95 * fade }
          }
          // the light-front outruns the matter, then thins away
          if (shock.visible) {
            const ts = T - BANG_T
            shock.scale.setScalar(1 + ts * 34)
            shock.lookAt(camera.position)
            shockMat.opacity = Math.max(0, 0.85 * (1 - ts / 2.2))
            if (shockMat.opacity <= 0) shock.visible = false
          }
        }

        // gas billows condense, churn, drift outward, and thin as the dive begins
        for (const cl of clouds) {
          const vis = clamp01((T - cl.born) / 2.5) * (1 - clamp01((T - 15.5) / 2))
          cl.group.visible = vis > 0
          if (!cl.group.visible) continue
          cl.group.position.copy(cl.dir).multiplyScalar(cl.dist * (0.9 + T * 0.05))
          const grow = 1 + 0.02 * dt
          for (const sp of cl.sprites) {
            sp.mat.opacity = cl.peak * sp.op * vis
            sp.mat.rotation += sp.rotRate * dt   // slow counter-rotation = churn
            sp.m.scale.x *= grow; sp.m.scale.y *= grow
          }
        }

        // the first stars flicker awake ahead of the galaxies
        fsMat.opacity = clamp01((T - 6) / 4) * (0.68 + 0.32 * Math.sin(T * 5))

        // hero stars ignite with a pop of light, then simmer
        for (const st of stars) {
          if (!st.lit && T >= st.ignite) { st.lit = true; st.g.visible = true; fx.blast(st.g.position, true) }
          if (st.lit) {
            st.g.scale.setScalar(0.001 + 0.999 * easeOut3(clamp01((T - st.ignite) / 1.4)))
            st.tick(T)
          }
        }

        // distant supernovae through the structure era — soft flares that swell
        // and die (the stock blast ring reads as a targeting reticle from afar)
        if (T > 8 && T < 15) {
          novaCd -= dt
          if (novaCd <= 0) {
            novaCd = 1 + Math.random() * 0.9
            const th = Math.random() * Math.PI * 2, ph = Math.acos(2 * Math.random() - 1), r = 40 + Math.random() * 40
            _s1.set(r * Math.sin(ph) * Math.cos(th), r * Math.sin(ph) * Math.sin(th), r * Math.cos(ph))
            if (_s1.distanceTo(camera.position) > 60) {
              const mat = new THREE.SpriteMaterial({ map: glowTex, color: 0xcfe4ff, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false })
              const m = new THREE.Sprite(mat); m.position.copy(_s1); m.scale.set(3, 3, 1)
              spaceSet.add(m); novas.push({ m, mat, life: 0 })
            }
          }
        }
        for (let i = novas.length - 1; i >= 0; i--) {
          const nv = novas[i]; nv.life += dt
          const k = nv.life / 0.8
          nv.m.scale.setScalar(3 + k * 7)
          nv.mat.opacity = 0.9 * Math.max(0, 1 - k)
          if (k >= 1) { spaceSet.remove(nv.m); nv.mat.dispose(); novas.splice(i, 1) }
        }

        // the afterglow: once the flash fades the whole sky simmers faintly warm —
        // the relic radiation — cooling back to black as the first stars ignite
        if (voidDome.visible) {
          const cmb = clamp01((T - 1.4) / 1.2) * (1 - clamp01((T - 4.5) / 2.3))
          voidMat.color.setRGB(0.055 * cmb, 0.028 * cmb, 0.012 * cmb)
        }

        // the sky fades into existence with the first structure — heavily dimmed:
        // the stock nebula palette reads too blue for the newborn dark, so only
        // a whisper of it (plus the shader's faint deep-space base) remains
        const bd = clamp01((T - 7) / 5) * 0.4
        if (voidDome.visible && bd > 0) voidDome.visible = false
        starMat.opacity = 0.85 * clamp01((T - 7) / 5)
        nebCols.forEach((c) => c.u.copy(c.base).multiplyScalar(bd))

        // galaxies bind, brighten, then fly apart on the expanding metric —
        // the hero stars ride the same expansion. Receding arms redden with it;
        // the one galaxy the dive falls toward blueshifts as the camera closes.
        const ex = 1 + Math.pow(clamp01((T - 13) / 7), 2) * 1.9
        const rs = clamp01((ex - 1) / 1.9)
        for (let gi = 0; gi < galaxies.length; gi++) {
          const gal = galaxies[gi]
          gal.g.visible = T > 6.5
          if (!gal.g.visible) continue
          gal.tick.uniforms.uGlow.value = gal.glow * clamp01((T - gal.delay) / 2.5)
          gal.tick(T)
          gal.g.position.copy(gal.base).multiplyScalar(ex)
          if (gi !== 6) gal.tick.uniforms.uArmCol.value.copy(gal.armBase).lerp(REDSHIFT, rs * 0.6)
          else gal.tick.uniforms.uArmCol.value.copy(gal.armBase).lerp(BLUESHIFT, clamp01((T - 15.5) / 2) * 0.4)
        }
        for (const st of stars) if (st.lit) st.g.position.copy(st.base).multiplyScalar(ex)

        // the deep field fades in through the aftermath, rides the expansion, and
        // clears before the dive plunges through
        for (const d of distField) {
          const vis = clamp01((T - d.born) / 2.2) * (1 - clamp01((T - 15.5) / 1.8))
          d.spr.visible = vis > 0
          if (vis > 0) { d.mat.opacity = d.peak * vis; d.spr.position.copy(d.base).multiplyScalar(ex) }
        }

        // the destination system stays hidden until the dive breaks through the
        // great disc — the swell of light at the crossing is its reveal
        if (worldShown) { planetTick(T); sunTick(T) }

        // sun glare — proportional to how near the sun sits to the view axis
        if (worldShown) {
          _s1.copy(sunG.position).sub(camera.position).normalize()
          camera.getWorldDirection(_s2)
          const gl = Math.pow(Math.max(_s2.dot(_s1), 0), 24)
          glare.visible = gl > 0.02
          glareMat.opacity = gl * 0.9
        }

        // warp streaks rushing past on the way down — thin z-aligned slivers kept
        // clear of the camera axis, stopped before the disc fills the frame
        if (T > 15.8 && T < 18.8) {
          streakCd -= dt
          if (streakCd <= 0) {
            streakCd = 0.05
            for (let k = 0; k < 2; k++) {
              const m = new THREE.Mesh(fx.trailGeo, streakMat)
              const ang = Math.random() * Math.PI * 2, rad = 10 + Math.random() * 22
              m.position.set(Math.cos(ang) * rad, Math.sin(ang) * rad * 0.6, camera.position.z - 50 - Math.random() * 70)
              m.rotation.x = Math.PI / 2
              m.scale.set(0.07, 10 + Math.random() * 14, 0.07)
              spaceSet.add(m)
              streaks.push({ m, life: 0 })
            }
          }
        }
        for (let i = streaks.length - 1; i >= 0; i--) {
          const s = streaks[i]; s.life += dt
          if (s.life > 1.1 || s.m.position.z > camera.position.z + 6) { spaceSet.remove(s.m); streaks.splice(i, 1) }
        }

        // camera: hold the void, drift back as the sky forms, slide laterally
        // through the expansion (parallax reads as motion where pure recession
        // reads as shrinking), then bank into the dive
        const drift = 14 * easeInOut(clamp01((T - 13) / 2.5)) * (1 - easeInOut(clamp01((T - 15.5) / 2.6)))
        if (T < 13) {
          const p = clamp01((T - 6) / 7)
          _p.set(0, 4 + 4 * p, 62 + 18 * easeInOut(p)); _look.copy(ORIGIN)
        } else if (T < 15.5) {
          _p.set(drift, 8, 80); _look.copy(ORIGIN)
        } else {
          // all the way down: the disc swallows the frame and the atmosphere
          // washes it white — the surface cut hides inside the whiteout.
          // The look target blends origin → planet with an eased ramp: zero
          // angular velocity at both ends, so the pan can never kick. (An
          // exponential chase is wrong here — it *starts* at max speed.)
          const p = easeInOut(clamp01((T - 15.5) / 4.5))
          _p.set(drift, 8 - 6 * p, 80 - 600 * p)
          _look.lerpVectors(ORIGIN, PLANET_POS, easeInOut(clamp01((T - 15.5) / 2.6)))
        }
        if (banged && T < 3.5) {   // birth tremor
          const sh = Math.exp(-(T - BANG_T) * 2) * 0.9
          _p.x += (Math.random() - 0.5) * sh; _p.y += (Math.random() - 0.5) * sh
        }
        camera.position.copy(_p)
        camera.lookAt(_look)

        // punching through the great disc: a soft swell of light, and starstuff
        // shimmering past the lens
        if (!discCrossed && T > 15.5 && camera.position.z < galaxies[6].g.position.z + 6) {
          discCrossed = true
          worldShown = true; planetG.visible = true; sunG.visible = true   // the world waits past the disc
          fireFlash(0.18, 0.9)   // a swell, not a blink — bloom amplifies whatever this is
          for (let i = 0; i < 26; i++) {
            _s1.set(
              camera.position.x + (Math.random() - 0.5) * 26,
              camera.position.y + (Math.random() - 0.5) * 16,
              camera.position.z - 4 - Math.random() * 20,
            )
            fx.ember(_s1, i % 2 ? 0x86b4ff : 0xffe2b8)
          }
        }
      }

      if (!cutA && T >= CUT_SURFACE) {
        cutA = true; fireFlash()
        bangAudio.pause()
        spaceSet.visible = false; surfaceSet.visible = true
        scene.fog = new THREE.Fog(0x0a1322, 26, 150)
      }
      if (cutA && !cutB) {
        // ── surface: falling out of the sky, then the last armlength into the
        // machine's glowing eye — the cut hides inside its cyan wash ──
        const q = easeInOut(clamp01((T - 23.6) / 0.9))
        if (q <= 0) {
          const p = easeInOut(clamp01((T - CUT_SURFACE) / 3.6))
          camera.position.set(1.9 * p, 34 - 32.6 * p, 30 - 25.4 * p)
          camera.lookAt(0, 1.0 * p, 0)
        } else {
          camera.position.set(1.9 - 1.45 * q, 1.4 - 0.28 * q, 4.6 - 3.2 * q)
          camera.lookAt(0.14 * q, 1.0 + 0.06 * q, 0.36 * q)
        }
        for (const u of people) u.body.rotation.z = Math.sin(T * 1.2 + u.i) * 0.05
        eyeMat.opacity = 0.55 + 0.45 * Math.sin(T * 6)
        seamMat.opacity = 0.6 + 0.3 * Math.sin(T * 3.2)
      }

      if (!cutB && T >= CUT_MACHINE) {
        cutB = true; fireFlash()
        surfaceSet.visible = false; machineSet.visible = true
        scene.fog = null
        humAudio.volume = 0; humAudio.play().catch(() => {})
      }
      if (cutB && !cutC) {
        humAudio.volume = 0.55 * clamp01((T - CUT_MACHINE) / 0.8)   // room tone fades up
        // ── inside the machine: drift through the thinking lattice, then the
        // long breath out — pulling back before the reveal ──
        const q = clamp01((T - CUT_MACHINE) / 5.5)
        const pb = easeInOut(clamp01((T - 29.5) / 2.3))
        camera.position.set(Math.sin(T * 0.5) * 1.1 * (1 - pb), 1.6 - 1.1 * q + 3.5 * pb, 25 - 11 * easeOut3(q) + 17 * pb)
        camera.lookAt(0, 0, 0)

        pulseCd -= dt
        if (pulseCd <= 0 && pulses.length < 14) { spawnPulse(0, layers[0][(Math.random() * layers[0].length) | 0]); pulseCd = 0.16 }
        for (let i = pulses.length - 1; i >= 0; i--) {
          const pu = pulses[i]; pu.t += dt
          const k = Math.min(1, pu.t / pu.dur)
          pu.m.position.lerpVectors(pu.from.m.position, pu.to.m.position, k)
          if (k >= 1) {
            pu.to.pop = 1
            pu.m.visible = false; pulsePool.push(pu.m)
            if (T - lastTickT > 0.09) { lastTickT = T; playTick() }   // activation blip, rate-limited
            if (pu.li < layers.length - 1 && Math.random() < 0.6) spawnPulse(pu.li, pu.to)
            pulses.splice(i, 1)
          }
        }
        for (const layer of layers) for (const nd of layer) {
          nd.pop *= Math.exp(-4 * dt)
          nd.m.scale.setScalar(0.32 * (1 + nd.pop * 0.8))
          nd.mat.color.setRGB(0.11 + nd.pop * 0.55, 0.35 + nd.pop * 0.4, 0.58 + nd.pop * 0.3)
        }
        // one canvas upload per frame at most — same 0.12s cadence per table,
        // phase-shifted so the three redraws never stack on a single frame
        for (let i = 0; i < tables.length; i++) {
          tableCds[i] -= dt
          if (tableCds[i] <= 0) { tables[i].draw(); tableCds[i] = 0.12 }
        }
      }

      if (!cutC && T >= CUT_ORBIT) {
        cutC = true; fireFlash()
        machineSet.visible = false; orbitSet.visible = true
      }
      if (cutC) {
        // ── the reveal: the lattice was the planet all along — pull away from
        // the Litania Magna in its diadem, the Throneworld hanging beyond ──
        const f = easeInOut(clamp01((T - CUT_ORBIT) / 4))
        camera.position.set(0, 5 + 3 * f, 58 + 28 * f)
        camera.lookAt(LITANY_POS)
        litanyTick(T); worldTick(T)
        // …and the watch sweeps past, silhouetted against the machine planet
        if (T > FLEET_T) {
          fleet.visible = true
          fleet.position.copy(FLEET_FROM).addScaledVector(FLEET_DIR, (T - FLEET_T) * 32)
        }
      }

      if (!c1 && T >= 2.6) { c1 = true; comms.show('Litania Magna', LINE1) }
      if (!c2 && T >= 13.2) { c2 = true; comms.show('Litania Magna', LINE2) }
      if (!cS && T >= 20.6) { cS = true; comms.show('Litania Magna', LINE_S) }
      if (!c3 && T >= 25.2) { c3 = true; comms.show('Litania Magna', LINE3, { persist: true }) }
      if (!c4 && T >= 32.4) { c4 = true; comms.show('Litania Magna', LINE4, { persist: true }) }
      if (!c5 && T >= 36.2) { c5 = true; comms.show('Litania Magna', LINE5, { persist: true }) }
      if (!ended && T >= END_T) { ended = true; end({ holdMs: 900 }) }
    }
  },
}
