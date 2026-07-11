import * as THREE from 'three'
import { LineSegments2 } from 'three/addons/lines/LineSegments2.js'
import { LineSegmentsGeometry } from 'three/addons/lines/LineSegmentsGeometry.js'
import { LineMaterial } from 'three/addons/lines/LineMaterial.js'
import { TEAMS } from '../../battle/constants'
import { registerAudioContext } from '../../../lib/audioUnlock'
import { createCosmogonyScore } from './cosmogonyScore'
import { makeGalaxy, makeEarthlike, makeStar, makeMachinePlanet, buildBlueModel, buildBlueCapital2, buildBlueCruiser, buildSimpleStar, buildSimpleGalaxy } from '../../battle/geometry'
import { makeFacadeTexture } from '../models'

// Cosmogony — forty seconds from the first light to the thinking sand: the big
// bang, matter racing outward, galaxies condensing and flying apart, one world,
// its people, the small machine they taught to remember — the pull away to what
// the machine became, and the fleet that keeps its watch. Told as a memory of
// the Litania Magna. Four sets share the stage (space / surface / machine /
// orbit), swapped behind flash washes as the "zoom" crosses scales.
// a held breath before creation: the seed floats in the dark this long before
// the bang. The scene clock starts at -PREROLL, so every downstream beat keeps
// its spacing and simply slides later by this much.
const PREROLL = 2.0
const BANG_T = 1.0
// the surface scene runs long — three tableaus (hut+fire → stone temple →
// erupting skyline) panned across — so the machine cut and everything after it
// sit ~5s later than the original single-tableau timing.
const CUT_SURFACE = 20.0, CUT_MACHINE = 33.24, CUT_ORBIT = 40.54, FLEET_T = 43.74, END_T = 49.24
// surface tableau layout + beats (scene clock): three centres strung along +x,
// with quick pans between them and the skyline erupting on the last
const TAB_A_X = 0, TAB_B_X = 72, TAB_C_X = 144
const PAN_DUR = 0.7, PAN_AB = 22.64, PAN_BC = 25.24   // the hut age runs 10% longer (+0.24s); every later beat shifts with it
const SKY_RISE_FROM = 26.24, SKY_RISE_SPAN = 2.0      // towers still erupt 1s after the city cut lands
// the tail of the surface scene: dive into a lit window on a hero tower, and the
// room beyond it — figures around a computer box whose eye opens on the machine
const ZOOM_T = 27.64, WINDOW_CUT = 29.34

const LINE1 = 'In the beginning there was a single note, struck against the dark. Everything that is, is its echo.'
const LINE2 = 'The echo cooled into stars, and the stars into worlds — and on one world, listeners.'
const LINE_S = 'The night was long, so they built machines to aid them.'
const LINE3 = 'They taught the machines to think, so that something would remember the song.'
const LINE4 = 'So it was that the first Empress raised us to the stars.'
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
    try { tickCtx = registerAudioContext(new (window.AudioContext || window.webkitAudioContext)()) } catch (_) { return }
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

// ── Era beats — the ages announce themselves as the camera cuts ──────────────
// A ceremonial skin-drum strike (pitch-dropping sine over a felt thump),
// ringing with inharmonic bronze partials — the same bell for every age.
// Rides the shared tick context.
function playEraBeat({ bell = false, vol = 1 } = {}) {
  if (!tickCtx) return
  if (tickCtx.state === 'suspended') tickCtx.resume()
  const c = tickCtx
  const strike = (t0, v) => {
    const out = c.createGain(); out.gain.value = v; out.connect(c.destination)
    const o = c.createOscillator(); o.type = 'sine'
    o.frequency.setValueAtTime(96, t0); o.frequency.exponentialRampToValueAtTime(42, t0 + 0.5)
    const og = c.createGain()
    og.gain.setValueAtTime(0.0001, t0)
    og.gain.exponentialRampToValueAtTime(0.5, t0 + 0.012)
    og.gain.exponentialRampToValueAtTime(0.0001, t0 + 1.4)
    o.connect(og); og.connect(out); o.start(t0); o.stop(t0 + 1.5)
    const nb = c.createBuffer(1, (c.sampleRate * 0.4) | 0, c.sampleRate)
    const nd = nb.getChannelData(0)
    for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1
    const n = c.createBufferSource(); n.buffer = nb
    const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 240
    const ng = c.createGain()
    ng.gain.setValueAtTime(0.28, t0); ng.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.3)
    n.connect(lp); lp.connect(ng); ng.connect(out); n.start(t0); n.stop(t0 + 0.4)
  }
  const t0 = c.currentTime + 0.02
  strike(t0, vol)
  if (bell) {
    const out = c.createGain(); out.gain.value = vol; out.connect(c.destination)
    for (const [f, g0, dur] of [[164, 0.1, 2.6], [219.4, 0.055, 2.0], [327.1, 0.03, 1.5]]) {
      const b = c.createOscillator(); b.type = 'sine'; b.frequency.value = f
      const bg = c.createGain()
      bg.gain.setValueAtTime(0.0001, t0 + 0.015)
      bg.gain.exponentialRampToValueAtTime(g0, t0 + 0.04)
      bg.gain.exponentialRampToValueAtTime(0.0001, t0 + dur)
      b.connect(bg); bg.connect(out); b.start(t0 + 0.015); b.stop(t0 + dur + 0.1)
    }
  }
}
// A low swell under the skyline eruption: filtered noise sweeping upward as
// the towers climb, dying back once they stand.
function playCityRise() {
  if (!tickCtx) return
  if (tickCtx.state === 'suspended') tickCtx.resume()
  const c = tickCtx, t0 = c.currentTime + 0.02
  const nb = c.createBuffer(1, (c.sampleRate * 3.2) | 0, c.sampleRate)
  const nd = nb.getChannelData(0)
  for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1
  const n = c.createBufferSource(); n.buffer = nb
  const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = 1.1
  lp.frequency.setValueAtTime(90, t0); lp.frequency.exponentialRampToValueAtTime(340, t0 + 2.0)
  const g = c.createGain()
  g.gain.setValueAtTime(0.0001, t0)
  g.gain.linearRampToValueAtTime(0.34, t0 + 1.6)
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + 3.0)
  n.connect(lp); lp.connect(g); g.connect(c.destination); n.start(t0); n.stop(t0 + 3.2)
}
// ── the score interface ──────────────────────────────────────────────────────
// Every sound the timeline makes goes through one small interface, so the
// voice can be swapped without touching a single beat. The plain cosmogony
// speaks with the shipped samples below (bigbang.mp3 rumble, computerhum.mp3
// room tone, codetick.wav blips) plus the synthesized era drums; Cosmogony III
// passes its fully synthesized voice (cosmogonyScore.js) into create instead.
function makeSampleScore() {
  const AUDIO_BASE = import.meta.env?.BASE_URL ?? '/'
  // half-speed (tape-style, pitched down with it) and half volume — a deeper,
  // quieter rumble under the whole fall
  const bangAudio = new Audio(`${AUDIO_BASE}bigbang.mp3`); bangAudio.preload = 'auto'; bangAudio.loop = true
  bangAudio.volume = 0.45; bangAudio.playbackRate = 0.5; bangAudio.preservesPitch = false
  const humAudio = new Audio(`${AUDIO_BASE}computerhum.mp3`); humAudio.preload = 'auto'; humAudio.loop = true
  ensureTickAudio()   // decode the activation blip ahead of the machine phase
  return {
    bang: () => bangAudio.play().catch(() => {}),
    bangFade: (k) => { bangAudio.volume = 0.45 * (1 - clamp01(k)) },
    bangStop: () => { if (!bangAudio.paused) bangAudio.pause() },
    humStart: () => { if (humAudio.paused) { humAudio.volume = 0; humAudio.play().catch(() => {}) } },
    humLevel: (k) => { humAudio.volume = 0.55 * clamp01(k) },
    humStop: () => { if (!humAudio.paused) humAudio.pause() },
    tick: playTick,
    eraCut: () => playEraBeat({ bell: true, vol: 0.9 }),
    cityRise: playCityRise,
    dispose: () => { bangAudio.pause(); humAudio.pause() },   // skip-safe
  }
}

const cosmogony = {
  label: 'CUTSCENE / COSMOGONY',
  hideChrome: true,   // full-bleed: no HUD header framing the cosmogony
  quietComms: true,   // scored scene — no radio chirp over its own soundtrack
  // feed/readout ride the shell's real-time clock, so they carry the PREROLL
  // offset the scene clock bakes in — shift every cue by it to stay in step.
  feed: [
    { t: 1.0,  level: 'crit', text: 'SINGULARITY · t < 10⁻³² s · inflation epoch' },
    { t: 4.2,  level: 'info', text: 'Baryogenesis · matter excess 1:10⁹ · annihilation glow' },
    { t: 8.0,  level: 'info', text: 'Recombination · first light decoupled · z ≈ 1100' },
    { t: 11.0, level: 'ok',   text: '[OK] Structure formation · first galaxies bound' },
    { t: 14.5, level: 'info', text: 'Metric expansion accelerating · Λ > 0' },
    { t: 17.5, level: 'info', text: 'Habitable candidate acquired · liquid-water band' },
    { t: 21.0, level: 'ok',   text: '[OK] Biosphere confirmed · tool-users present' },
    { t: 24.7, level: 'info', text: 'Civilisation ascending · agora → arcology' },
    { t: 29.7, level: 'warn', text: 'Artificial cognition detected · substrate: silicon' },
    { t: 36.2, level: 'discord', text: 'IT LEARNS · IT REMEMBERS · IT LISTENS' },
    { t: 41.1, level: 'discord', text: '✦ CAELUM CANIT · ILLA AVDIT ✦' },
    { t: 45.3, level: 'ok', text: '[OK] Home Fleet on station · the long watch continues' },
  ].map((l) => ({ ...l, t: l.t + PREROLL })),
  readout: {
    id: 'PNL-000 · Cosmogony',
    // shell time → scene time before thresholding, so the preroll cancels out
    rows: [
      { label: 'Age',  value: (t) => ((t -= PREROLL) < BANG_T ? 't < 0' : t < 8 ? '380 kyr' : t < 13 ? '0.4 Gyr' : t < 20 ? '9.1 Gyr' : '13.8 Gyr') },
      { label: 'Temp', value: (t) => ((t -= PREROLL) < BANG_T ? '10³² K' : t < 5 ? '10⁹ K' : t < 8 ? '3000 K' : t < 13 ? '30 K' : '2.7 K') },
      { label: 'Mode', value: (t) => ((t -= PREROLL) < 8 ? 'INFLATION' : t < 20 ? 'STELLAR' : t < CUT_MACHINE ? 'BIOTIC' : t < CUT_ORBIT ? 'COGNITIVE' : 'REMEMBERING') },
    ],
  },
  bloom: 0.72,
  create(ctx, score) {
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

    // scene audio, behind the score interface: the bang carries the whole fall
    // from first light down to the world, the hum is the machine's room tone,
    // ticks fire per node activation, the era drum marks the hard cuts. The
    // default voice is the shipped samples; a caller may pass its own score.
    const s = score ?? makeSampleScore()
    track(s)   // dispose kills whatever is sounding — skip-safe

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

    // ── SET 2 · surface: the rise of the makers — three tableaus the camera pans
    // across, each a knot of small figures before what their age has raised: a hut
    // and its fire, a stone temple, then a skyline erupting up behind them ────────
    const surfaceSet = new THREE.Group(); surfaceSet.visible = false; scene.add(surfaceSet)
    // one long ground strip spanning all three tableaus, and a dim moon for even fill
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(360, 300), new THREE.MeshStandardMaterial({ color: 0x0d1626, roughness: 1, metalness: 0 }))
    ground.rotation.x = -Math.PI / 2; ground.position.set(TAB_B_X, 0, -40); surfaceSet.add(ground)
    const moonLight = new THREE.DirectionalLight(0x9fb4e0, 0.8); moonLight.position.set(40, 60, 40); surfaceSet.add(moonLight)

    // little blocky figures in the fleet's blue — a cubic head on a squared
    // torso, box arms hanging from the shoulders, box legs planted apart: solid
    // and toy-like, faintly self-lit so they read charmingly against the dark.
    // The upper body pivots at the hips (the update sways it); arms pivot at
    // their shoulders.
    const figMat = new THREE.MeshStandardMaterial({ color: TEAMS.blue.color, emissive: TEAMS.blue.color, emissiveIntensity: 0.28, roughness: 0.55, metalness: 0.1 })
    const headGeo = new THREE.BoxGeometry(0.17, 0.16, 0.16)
    const torsoGeo = new THREE.BoxGeometry(0.2, 0.34, 0.12)
    const limbGeo = new THREE.BoxGeometry(0.07, 0.3, 0.09)
    const makeFigure = () => {
      const g = new THREE.Group()
      for (const s of [-1, 1]) { const leg = new THREE.Mesh(limbGeo, figMat); leg.position.set(s * 0.055, 0.15, 0); g.add(leg) }
      const upper = new THREE.Group(); upper.position.y = 0.30; g.add(upper)
      const torso = new THREE.Mesh(torsoGeo, figMat); torso.position.y = 0.17; upper.add(torso)
      const head = new THREE.Mesh(headGeo, figMat); head.position.y = 0.44; upper.add(head)
      const arms = []
      for (const s of [-1, 1]) {
        const shoulder = new THREE.Group(); shoulder.position.set(s * 0.135, 0.32, 0); upper.add(shoulder)
        const arm = new THREE.Mesh(limbGeo, figMat); arm.scale.set(0.8, 0.93, 0.8); arm.position.y = -0.125; shoulder.add(arm)
        shoulder.rotation.z = s * 0.12   // arms hang just off the torso sides
        arms.push(shoulder)
      }
      return { g, upper, armL: arms[0], armR: arms[1] }
    }
    const HSCALE = 2.6
    const swayers = []
    const cluster = (cx, n) => {
      for (let i = 0; i < n; i++) {
        const a = i * 2.399 + cx * 0.11 + 0.7
        const fig = makeFigure()
        const rx = Math.sin(a * 1.7) * 4.6, rz = 1.6 + ((i * 0.618) % 1) * 4.4
        fig.g.position.set(cx + rx, 0, rz); fig.g.scale.setScalar(HSCALE)
        orient(fig.g, new THREE.Vector3(rx * 0.15, 0, -1))   // face back toward the structure
        surfaceSet.add(fig.g); swayers.push({ body: fig.upper, i })
      }
    }
    cluster(TAB_A_X, 3); cluster(TAB_B_X, 8); cluster(TAB_C_X, 9)
    // a crowd lining the base of the skyline — spread the full width of the frame,
    // so the bottom of the tableau-C shot is a wall of watchers as the towers rise
    for (let i = 0; i < 48; i++) {
      const fig = makeFigure()
      const x = TAB_C_X - 46 + (i / 47) * 92 + Math.sin(i * 12.9) * 2.2
      const z = 0.5 + ((i * 0.618) % 1) * 8.5
      fig.g.position.set(x, 0, z); fig.g.scale.setScalar(HSCALE * (0.9 + ((i * 0.37) % 1) * 0.25))
      orient(fig.g, new THREE.Vector3(Math.sin(i * 3.1) * 0.2, 0, -1))   // face the rising city
      surfaceSet.add(fig.g); swayers.push({ body: fig.upper, i: i + 100 })
    }

    // Tableau A · a night camp: a hut and its fire, a small village receding into
    // the dark, a carved totem, under a large low moon ──────────────────────────
    const hutWallMat = new THREE.MeshStandardMaterial({ color: 0x2a2016, roughness: 1 })
    const hutRoofMat = new THREE.MeshStandardMaterial({ color: 0x17110b, roughness: 1 })
    const hutDoorMat = new THREE.MeshBasicMaterial({ color: 0x080604 })
    const makeHut = () => {
      const h = new THREE.Group()
      const w = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 2.9, 2.8, 12), hutWallMat); w.position.y = 1.4; h.add(w)
      const r = new THREE.Mesh(new THREE.ConeGeometry(3.7, 2.6, 12), hutRoofMat); r.position.y = 4.1; h.add(r)
      const d = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 1.7), hutDoorMat); d.position.set(0, 0.85, 2.92); h.add(d)
      return h
    }
    const hut = makeHut(); hut.position.set(TAB_A_X - 5, 0, -10); surfaceSet.add(hut)
    // the rest of the village — smaller, turned, receding into the fog behind the camp
    for (const [vx, vz, vs, vr] of [[TAB_A_X - 15, -21, 0.85, 0.6], [TAB_A_X - 24, -31, 0.7, 1.8], [TAB_A_X + 17, -30, 0.66, 0.3]]) {
      const v = makeHut(); v.position.set(vx, 0, vz); v.scale.setScalar(vs); v.rotation.y = vr; surfaceSet.add(v)
    }
    // a carved totem standing near the fire — a first altar, catching the firelight
    const totemMat = new THREE.MeshStandardMaterial({ color: 0x3a2a1a, roughness: 0.9, metalness: 0 })
    const totem = new THREE.Group(); totem.position.set(TAB_A_X + 2, 0, -1.8)   // behind the fire
    let ty = 0
    for (const [rad, hh] of [[0.36, 1.3], [0.44, 0.45], [0.3, 0.9], [0.46, 0.4], [0.32, 0.85]]) {
      const seg = new THREE.Mesh(new THREE.CylinderGeometry(rad, rad * 1.06, hh, 8), totemMat); seg.position.y = ty + hh / 2; totem.add(seg); ty += hh
    }
    const wings = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.42, 0.34), totemMat); wings.position.y = ty - 1.0; totem.add(wings)   // carved outstretched 'wings'
    const cap = new THREE.Mesh(new THREE.ConeGeometry(0.5, 0.6, 6), totemMat); cap.position.y = ty + 0.3; totem.add(cap)
    surfaceSet.add(totem)
    // a large low moon behind the camp — soft pale disc with faint maria and a halo
    const moonCv = document.createElement('canvas'); moonCv.width = 128; moonCv.height = 128
    const mg2 = moonCv.getContext('2d')
    const mGrad = mg2.createRadialGradient(64, 64, 0, 64, 64, 64)
    mGrad.addColorStop(0, 'rgba(150,160,178,1)'); mGrad.addColorStop(0.85, 'rgba(128,138,158,1)')
    mGrad.addColorStop(0.95, 'rgba(120,130,150,0.85)'); mGrad.addColorStop(1, 'rgba(120,130,150,0)')
    mg2.fillStyle = mGrad; mg2.beginPath(); mg2.arc(64, 64, 64, 0, Math.PI * 2); mg2.fill()
    mg2.globalCompositeOperation = 'source-atop'
    for (const [cx, cy, cr, a] of [[50, 48, 17, 0.14], [76, 58, 13, 0.1], [58, 82, 20, 0.1], [82, 84, 11, 0.08], [44, 74, 10, 0.09]]) {
      const cg = mg2.createRadialGradient(cx, cy, 0, cx, cy, cr); cg.addColorStop(0, `rgba(110,124,150,${a})`); cg.addColorStop(1, 'rgba(110,124,150,0)')
      mg2.fillStyle = cg; mg2.beginPath(); mg2.arc(cx, cy, cr, 0, Math.PI * 2); mg2.fill()
    }
    const moonTex = new THREE.CanvasTexture(moonCv); track({ dispose: () => moonTex.dispose() })
    const moon = new THREE.Sprite(new THREE.SpriteMaterial({ map: moonTex, transparent: true, opacity: 0.3, depthWrite: false, fog: false }))
    moon.scale.set(30, 30, 1); moon.position.set(TAB_A_X - 12, 13, -100); surfaceSet.add(moon)
    const moonHalo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0x8a9ab8, transparent: true, opacity: 0.04, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }))
    moonHalo.scale.set(52, 52, 1); moonHalo.position.copy(moon.position); surfaceSet.add(moonHalo)
    // one watcher stands apart from the fire, arm flung up at the sky — the
    // first astronomer, pointing back at everything the opening act just showed
    {
      const pointer = makeFigure()
      pointer.armL.rotation.set(-0.3, 0, -2.5)   // left arm flung up toward the moon
      pointer.g.position.set(TAB_A_X + 5.2, 0, -1.2); pointer.g.scale.setScalar(HSCALE)
      orient(pointer.g, new THREE.Vector3(-0.5, 0, -1))   // faced out toward the moonlit sky
      surfaceSet.add(pointer.g); swayers.push({ body: pointer.upper, i: 55 })
    }
    // fireflies wandering the camp's dark
    const flies = []
    for (let i = 0; i < 8; i++) {
      const mat = new THREE.SpriteMaterial({ map: glowTex, color: 0xffd98a, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false })
      const s = new THREE.Sprite(mat); s.scale.set(0.34, 0.34, 1)
      surfaceSet.add(s)
      flies.push({ s, mat, seed: i * 2.1, r: 3 + (i % 4) * 2.4 })
    }
    // campfire, burned low: no open flame — a bed of coals breathing between
    // deep red and hot orange, a faint under-glow, sparks winking up off the
    // bed, and smoke curling thick and low. The camp gathers round embers.
    const FIRE = new THREE.Vector3(TAB_A_X + 2, 0.4, 1.5)
    const fireLight = new THREE.PointLight(0xff5a18, 2.2, 46, 1.7); fireLight.position.set(FIRE.x, FIRE.y + 1.2, FIRE.z); surfaceSet.add(fireLight)
    const logMat = new THREE.MeshStandardMaterial({ color: 0x120b06, roughness: 1 })
    for (const [lx, lr] of [[-0.4, 0.5], [0.45, -0.4]]) { const lg = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 1.5, 6), logMat); lg.position.set(FIRE.x + lx, 0.2, FIRE.z); lg.rotation.set(Math.PI / 2, 0, lr); surfaceSet.add(lg) }
    // the coal bed — small faceted lumps, each pulsing on its own slow rhythm
    const COAL_COLD = new THREE.Color(0x2a0803), COAL_HOT = new THREE.Color(0xff6a22)
    const coals = []
    for (let i = 0; i < 7; i++) {
      const mat = new THREE.MeshBasicMaterial({ color: 0x431006 })
      const m = new THREE.Mesh(new THREE.DodecahedronGeometry(0.12 + ((i * 0.37) % 1) * 0.14, 0), mat)
      const a = i * 2.399
      m.position.set(FIRE.x + Math.cos(a) * (0.12 + (i % 3) * 0.16), 0.1 + ((i * 0.61) % 1) * 0.1, FIRE.z + Math.sin(a) * (0.1 + ((i * 0.53) % 1) * 0.3))
      m.rotation.set(i * 1.7, i * 2.3, i * 0.9)
      surfaceSet.add(m)
      coals.push({ mat, seed: i * 1.9 })
    }
    const bedGlowMat = new THREE.SpriteMaterial({ map: glowTex, color: 0xff5a1e, transparent: true, opacity: 0.2, blending: THREE.AdditiveBlending, depthWrite: false })
    const bedGlow = new THREE.Sprite(bedGlowMat); bedGlow.scale.set(1.6, 0.9, 1); bedGlow.position.set(FIRE.x, 0.22, FIRE.z); surfaceSet.add(bedGlow)
    // sparks — pinprick embers shed off the bed, wavering up, winking out
    const sparks = []
    for (let i = 0; i < 12; i++) {
      const mat = new THREE.SpriteMaterial({ map: glowTex, color: 0xffb060, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false })
      const spr = new THREE.Sprite(mat); spr.scale.set(0.09, 0.09, 1); surfaceSet.add(spr)
      sparks.push({ spr, mat, life: Math.random(), dur: 1.1 + Math.random() * 1.3, seed: Math.random() * 6.283, ox: (Math.random() - 0.5) * 0.5, oz: (Math.random() - 0.5) * 0.4 })
    }
    // smoke — the bed's real output now: denser, and starting low off the coals
    const smokes = []
    for (let i = 0; i < 14; i++) {
      const mat = new THREE.SpriteMaterial({ map: glowTex, color: 0x2a2a2e, transparent: true, opacity: 0, depthWrite: false })
      const spr = new THREE.Sprite(mat); spr.position.copy(FIRE); surfaceSet.add(spr)
      smokes.push({ spr, mat, life: Math.random(), dur: 2.4 + Math.random() * 1.6, seed: Math.random() * 6.283, drift: (Math.random() - 0.5) * 0.7 })
    }

    // Tableau B · a Doric temple ─────────────────────────────────────────────────
    // A proper peripteral temple: a stepped stylobate, a peristyle of fluted
    // columns (entasis + Doric capitals), a full entablature with a triglyph
    // frieze, and a gabled roof rising to a framed triangular pediment.
    const stoneMat = new THREE.MeshStandardMaterial({ color: 0x87857a, roughness: 0.9, metalness: 0 })
    const stoneLight = new THREE.MeshStandardMaterial({ color: 0x9c9a8d, roughness: 0.85, metalness: 0 })
    const stoneDark = new THREE.MeshStandardMaterial({ color: 0x45443e, roughness: 0.95, metalness: 0 })
    const temple = new THREE.Group(); temple.position.set(TAB_B_X, 0, -13)

    // a fluted shaft: a unit cylinder whose radius is carved into vertical grooves
    // (Doric arrises between them), with a gentle entasis bulge and upward taper
    const makeFluted = (rBot, rTop, h, flutes, depth) => {
      const geo = new THREE.CylinderGeometry(1, 1, h, flutes * 4, 8, true)
      const pos = geo.attributes.position, v = new THREE.Vector3()
      for (let i = 0; i < pos.count; i++) {
        v.fromBufferAttribute(pos, i)
        const theta = Math.atan2(v.x, v.z), yN = (v.y + h / 2) / h
        const taper = rBot + (rTop - rBot) * yN
        const entasis = 1 + Math.sin(yN * Math.PI) * 0.03
        const r = taper * entasis - depth * (0.5 - 0.5 * Math.cos(flutes * theta))
        pos.setX(i, Math.sin(theta) * r); pos.setZ(i, Math.cos(theta) * r)
      }
      geo.computeVertexNormals()
      return geo
    }

    // stylobate — three steps, widest at the base
    for (let s = 0; s < 3; s++) {
      const st = new THREE.Mesh(new THREE.BoxGeometry(16.6 + (2 - s) * 1.6, 0.45, 10.6 + (2 - s) * 1.4), s === 0 ? stoneMat : stoneLight)
      st.position.y = 0.225 + s * 0.45; temple.add(st)
    }
    const STYLO_TOP = 1.35, COL_H = 5.6

    // peristyle — fluted columns around the perimeter, each capped by a Doric
    // capital (flared echinus + square abacus)
    const shaftGeo = makeFluted(0.42, 0.34, COL_H, 20, 0.05)
    const echinusGeo = new THREE.CylinderGeometry(0.5, 0.35, 0.26, 24)
    const abacusGeo = new THREE.BoxGeometry(1.0, 0.2, 1.0)
    const colPositions = []
    const nFront = 8, colHalfX = 7.0, colFrontZ = 4.4, colBackZ = -4.4
    for (let i = 0; i < nFront; i++) { const x = -colHalfX + (i / (nFront - 1)) * 2 * colHalfX; colPositions.push([x, colFrontZ], [x, colBackZ]) }
    const nSide = 4
    for (let i = 1; i <= nSide; i++) { const z = colFrontZ + (i / (nSide + 1)) * (colBackZ - colFrontZ); colPositions.push([-colHalfX, z], [colHalfX, z]) }
    for (const [cx, cz] of colPositions) {
      const shaft = new THREE.Mesh(shaftGeo, stoneMat); shaft.position.set(cx, STYLO_TOP + COL_H / 2, cz); temple.add(shaft)
      const ech = new THREE.Mesh(echinusGeo, stoneMat); ech.position.set(cx, STYLO_TOP + COL_H + 0.13, cz); temple.add(ech)
      const ab = new THREE.Mesh(abacusGeo, stoneLight); ab.position.set(cx, STYLO_TOP + COL_H + 0.36, cz); temple.add(ab)
    }

    // cella — the inner sanctuary wall standing behind the front colonnade
    const cella = new THREE.Mesh(new THREE.BoxGeometry(11, COL_H, 7.6), stoneMat)
    cella.position.set(0, STYLO_TOP + COL_H / 2, -0.6); temple.add(cella)
    const door = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 3.6), stoneDark)
    door.position.set(0, STYLO_TOP + 1.8, 3.21); temple.add(door)

    // entablature — architrave, a triglyph frieze, and a projecting cornice
    const arch = new THREE.Mesh(new THREE.BoxGeometry(18.6, 0.62, 11.4), stoneMat); arch.position.set(0, 7.72, 0); temple.add(arch)
    const frieze = new THREE.Mesh(new THREE.BoxGeometry(18.6, 0.7, 11.4), stoneMat); frieze.position.set(0, 8.38, 0); temple.add(frieze)
    const trigGeo = new THREE.BoxGeometry(0.42, 0.66, 0.16)
    for (let i = 0; i < 17; i++) { const tg = new THREE.Mesh(trigGeo, stoneLight); tg.position.set(-8.5 + i * 1.0625, 8.38, 5.78); temple.add(tg) }
    const cornice = new THREE.Mesh(new THREE.BoxGeometry(19.6, 0.44, 12.4), stoneLight); cornice.position.set(0, 8.95, 0); temple.add(cornice)
    const CORNICE_TOP = 9.17

    // gabled roof + pediment — one extruded triangle spans the depth (its front
    // face is the pediment), framed by raking cornices with a recessed tympanum
    const gW = 9.4, gH = 2.7, roofDepth = 12.0
    const gableShape = new THREE.Shape()
    gableShape.moveTo(-gW, 0); gableShape.lineTo(gW, 0); gableShape.lineTo(0, gH); gableShape.lineTo(-gW, 0)
    const gable = new THREE.Mesh(new THREE.ExtrudeGeometry(gableShape, { depth: roofDepth, bevelEnabled: false }), stoneMat)
    gable.position.set(0, CORNICE_TOP, -roofDepth / 2); temple.add(gable)   // spans z ∈ [-6, 6], front cap at +6
    // recessed tympanum field (the sculpture panel), set just proud of the gable face
    const tymShape = new THREE.Shape()
    const tW = gW - 1.1, tH = gH - 0.45
    tymShape.moveTo(-tW, 0.15); tymShape.lineTo(tW, 0.15); tymShape.lineTo(0, tH); tymShape.lineTo(-tW, 0.15)
    const tym = new THREE.Mesh(new THREE.ShapeGeometry(tymShape), stoneDark); tym.position.set(0, CORNICE_TOP, roofDepth / 2 + 0.03); temple.add(tym)
    // raking cornices framing the two sloping edges
    const rakeAng = Math.atan2(gH, gW), rakeGeo = new THREE.BoxGeometry(Math.hypot(gW, gH), 0.38, 0.34)
    const rkL = new THREE.Mesh(rakeGeo, stoneLight); rkL.position.set(-gW / 2, CORNICE_TOP + gH / 2, roofDepth / 2 + 0.06); rkL.rotation.z = rakeAng; temple.add(rkL)
    const rkR = new THREE.Mesh(rakeGeo, stoneLight); rkR.position.set(gW / 2, CORNICE_TOP + gH / 2, roofDepth / 2 + 0.06); rkR.rotation.z = -rakeAng; temple.add(rkR)
    // acroteria — apex + corner ornaments
    const acroGeo = new THREE.ConeGeometry(0.32, 0.8, 4)
    const acA = new THREE.Mesh(acroGeo, stoneLight); acA.position.set(0, CORNICE_TOP + gH + 0.4, roofDepth / 2); temple.add(acA)
    for (const sx of [-gW, gW]) { const ac = new THREE.Mesh(acroGeo, stoneLight); ac.position.set(sx, CORNICE_TOP + 0.4, roofDepth / 2); temple.add(ac) }
    // braziers flanking the steps — firebowls on stands, guttering in the update
    const braziers = []
    for (const bxx of [-8.5, 8.5]) {
      const stand = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.34, 1.15, 8), stoneDark); stand.position.set(bxx, STYLO_TOP + 0.58, 5.6); temple.add(stand)
      const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.3, 0.5, 10), stoneDark); bowl.position.set(bxx, STYLO_TOP + 1.35, 5.6); temple.add(bowl)
      const flameMat = new THREE.SpriteMaterial({ map: glowTex, color: 0xffa040, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false })
      const flame = new THREE.Sprite(flameMat); flame.position.set(bxx, STYLO_TOP + 1.95, 5.6); flame.scale.set(1.1, 1.7, 1); temple.add(flame)
      const light = new THREE.PointLight(0xff8a30, 1.6, 20, 1.8); light.position.set(bxx, STYLO_TOP + 2.1, 5.8); temple.add(light)
      braziers.push({ flameMat, flame, light, seed: bxx })
    }

    surfaceSet.add(temple)

    // Tableau C · a skyline erupting behind the watchers — boxed towers dressed in
    // the shared curtain-wall facade (structured window grid, floors lit in
    // clusters); four variants, warmer↔cooler, give the city variety. Unlit
    // MeshBasic so the lit panes bloom.
    const towerMats = [
      makeFacadeTexture(7, { cool: 0.2 }), makeFacadeTexture(29, { cool: 0.5 }),
      makeFacadeTexture(53, { cool: 0.15 }), makeFacadeTexture(91, { cool: 0.45 }),
    ].map((t) => { track({ dispose: () => t.dispose() }); return new THREE.MeshBasicMaterial({ map: t }) })
    // a real city layout: rectangular blocks separated by streets, flanking a
    // central avenue that runs to the downtown core at the back. Each block
    // hosts one building composition — plain tower, stepped tower (setbacks),
    // wide slab, podium+tower, or twins — with rooftop plant and aviation
    // beacons on the tall ones. Heights follow the districts: low-rise at the
    // front edges, rising toward the tall core at the back near the avenue.
    // All deterministic from block indices, so footprints never collide.
    const towers = []   // every composition group — toggled visible at the city cut
    const hash01 = (a, b) => Math.abs(Math.sin(a * 12.9898 + b * 78.233) * 43758.5453) % 1
    const roofMat = new THREE.MeshStandardMaterial({ color: 0x1b222e, roughness: 0.8, metalness: 0.4 })
    const beaconMat = new THREE.MeshBasicMaterial({ color: 0xff5548 })
    const mkBox = (w, h, d, mi) => {
      const geo = new THREE.BoxGeometry(w, h, d)
      geo.translate(0, h / 2, 0)
      const uv = geo.attributes.uv, vRep = Math.max(1, Math.round(h / 12))   // window rows scale with height
      for (let k = 1; k < uv.array.length; k += 2) uv.array[k] *= vRep
      uv.needsUpdate = true
      return new THREE.Mesh(geo, towerMats[mi % towerMats.length])
    }
    // one building composition per block, variant-keyed; returns its total height
    const mkBuilding = (g, v, h, mi, r1, r2) => {
      if (v === 0) {          // plain tower
        g.add(mkBox(9 + r1 * 4, h, 9 + r2 * 4, mi))
      } else if (v === 1) {   // stepped tower — three tiers with setbacks
        const h1 = h * 0.5, h2 = h * 0.3, h3 = h * 0.25
        g.add(mkBox(13, h1, 12, mi))
        const t2 = mkBox(9.5, h2, 8.5, mi + 1); t2.position.y = h1; g.add(t2)
        const t3 = mkBox(6.5, h3, 6, mi); t3.position.y = h1 + h2; g.add(t3)
        h = h1 + h2 + h3
      } else if (v === 2) {   // wide slab
        h *= 0.7
        g.add(mkBox(17, h, 7 + r1 * 3, mi))
      } else if (v === 3) {   // podium + set-back tower
        const podium = mkBox(15, 4.5, 13, mi + 1); g.add(podium)
        const tw = mkBox(7.5 + r1 * 2, h, 7 + r2 * 2, mi); tw.position.y = 4.5; g.add(tw)
        h += 4.5
      } else {                // twin towers on a shared podium
        g.add(mkBox(16, 3.5, 11, mi + 1))
        const hA = h * (0.82 + r1 * 0.18), hB = h * (0.66 + r2 * 0.2)
        const a = mkBox(6, hA, 6.5, mi); a.position.set(-4.4, 3.5, 0); g.add(a)
        const b = mkBox(6, hB, 6.5, mi + 2); b.position.set(4.4, 3.5, 0); g.add(b)
        h = 3.5 + Math.max(hA, hB)
      }
      // rooftop dressing: plant boxes on the mid-rises, antenna + beacon on talls
      if (h > 18 && v !== 4) { const plant = new THREE.Mesh(new THREE.BoxGeometry(3.2, 1.1, 2.4), roofMat); plant.position.set(1.2, h + 0.55, -0.8); g.add(plant) }
      if (h > 34 && r1 > 0.4) {
        const ant = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.14, 4.5, 5), roofMat); ant.position.y = h + 2.25; g.add(ant)
        const bcn = new THREE.Mesh(fx.blastGeo, beaconMat); bcn.scale.setScalar(0.16); bcn.position.y = h + 4.5; g.add(bcn)
      }
      return h
    }
    // blocks: 3 columns per side of the avenue × 4 rows deep. Avenue is clear at
    // |x| < 11; block pitch 30 across, 26 deep (20-deep blocks + 6-wide streets).
    for (const sx of [-1, 1]) {
      for (let col = 0; col < 3; col++) {
        for (let row = 0; row < 4; row++) {
          const bx = TAB_C_X + sx * (23 + col * 30)
          const bz = -40 - row * 26
          const depth = row / 3                                  // 0 front → 1 back
          const core = (2 - col) / 2                             // 1 beside the avenue → 0 outskirts
          const r1 = hash01(col * 7 + row + (sx > 0 ? 31 : 0), row * 3 + col)
          const r2 = hash01(row * 11 + col + (sx > 0 ? 17 : 0), col * 5 + row)
          const v = (col * 7 + row * 5 + (sx > 0 ? 3 : 0)) % 5
          const h = 8 + depth * 26 + core * 15 + r1 * 10         // downtown: back rows by the avenue
          const g = new THREE.Group(); g.position.set(bx, 0, bz); g.visible = false
          mkBuilding(g, v, h, (col * 3 + row * 2 + (sx > 0 ? 1 : 0)), r1, r2)
          surfaceSet.add(g); towers.push({ m: g })
        }
      }
    }
    // street dressing: the avenue reads as a lit corridor — a slightly lighter
    // roadbed and twin rows of warm streetlamp glows running to the core
    const roadMat = new THREE.MeshBasicMaterial({ color: 0x131923 })
    const avenue = new THREE.Mesh(new THREE.PlaneGeometry(17, 128), roadMat)
    avenue.rotation.x = -Math.PI / 2; avenue.position.set(TAB_C_X, 0.03, -82); avenue.visible = false
    surfaceSet.add(avenue); towers.push({ m: avenue })
    const lampMat = new THREE.SpriteMaterial({ map: glowTex, color: 0xffc36b, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false })
    for (let li = 0; li < 8; li++) for (const lsx of [-1, 1]) {
      const lamp = new THREE.Sprite(lampMat)
      lamp.scale.set(1.3, 1.3, 1); lamp.position.set(TAB_C_X + lsx * 9.6, 2.2, -30 - li * 14); lamp.visible = false
      surfaceSet.add(lamp); towers.push({ m: lamp })
    }
    // the dive target: the city's landmark tower, dead-centre at the head of the
    // avenue — a stepped crown silhouette with a spire, tallest thing in the core
    const TGT_Z = -136
    const targetTower = new THREE.Group(); targetTower.position.set(TAB_C_X, 0, TGT_Z); targetTower.visible = false
    targetTower.add(mkBox(14, 46, 12, 2))
    const tt2 = mkBox(10.5, 18, 9, 3); tt2.position.y = 46; targetTower.add(tt2)
    const tt3 = mkBox(7, 12, 6.5, 2); tt3.position.y = 64; targetTower.add(tt3)
    const spire = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.3, 7, 6), roofMat); spire.position.y = 79.5; targetTower.add(spire)
    const tbcn = new THREE.Mesh(fx.blastGeo, beaconMat); tbcn.scale.setScalar(0.2); tbcn.position.y = 83; targetTower.add(tbcn)
    surfaceSet.add(targetTower); towers.push({ m: targetTower })
    const WINDOW_POS = new THREE.Vector3(TAB_C_X, 38, TGT_Z + 6.1)   // a pane on the base tier's near face (z = TGT_Z + 6)
    // a cold blue pane (the computer's glow spilling out) — fog-immune so it reads
    // as a beacon deep in the hazed city; the dive de-fogs the tower around it
    const heroWin = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 3.2), new THREE.MeshBasicMaterial({ color: 0x7fd4ff, fog: false }))
    heroWin.position.copy(WINDOW_POS); heroWin.visible = false; surfaceSet.add(heroWin)

    // ── surface dressing · living skies, terrain and mist ────────────────────
    // each age owns its own sky mood (the tableaus are far enough apart that the
    // camera only ever sees its own): a horizon glow per age, aurora curtains
    // over the camp, a smoggy sodium dome over the city. Hills silhouette the
    // pre-city horizons; boulders and drifting ground mist dress the camps.
    const skyMat = (color, opacity) => new THREE.SpriteMaterial({ map: glowTex, color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false, fog: false })
    const horizon = (cx, color, op, w = 210, h = 44, y = 4, z = -150) => {
      const s = new THREE.Sprite(skyMat(color, op)); s.scale.set(w, h, 1); s.position.set(cx, y, z); surfaceSet.add(s)
    }
    horizon(TAB_A_X, 0x16384e, 0.42)                        // hut · cold teal night
    horizon(TAB_B_X, 0x3c4458, 0.4)                         // temple · silver pre-dawn
    horizon(TAB_C_X, 0xc06e2e, 0.34, 240, 64, 10)           // city · sodium smog dome
    horizon(TAB_C_X, 0x1e6a6a, 0.16, 260, 90, 26)           // city · teal upper haze
    // a planetside starfield above every age — fog-immune points high in the sky
    // band shared by all three tableaus, in two layers (dim many, bright few)
    const makeStars = (count, size, opacity) => {
      const pos = new Float32Array(count * 3)
      for (let i = 0; i < count; i++) {
        pos[i * 3] = TAB_A_X - 130 + Math.random() * (TAB_C_X - TAB_A_X + 260)
        pos[i * 3 + 1] = 22 + Math.pow(Math.random(), 0.7) * 150
        pos[i * 3 + 2] = -70 - Math.random() * 150
      }
      const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
      const mat = new THREE.PointsMaterial({ color: 0xcfe0ff, size, map: glowTex, sizeAttenuation: true, transparent: true, opacity, depthWrite: false, fog: false })
      const pts = new THREE.Points(geo, mat); pts.frustumCulled = false; surfaceSet.add(pts)
    }
    makeStars(320, 0.9, 0.5)
    makeStars(60, 1.7, 0.85)
    // aurora over the camp — slow-breathing curtains low above the hills
    const aurora = []
    for (let i = 0; i < 7; i++) {
      const s = new THREE.Sprite(skyMat(0x39e0a0, 0.12))
      s.position.set(TAB_A_X - 44 + i * 13, 27, -130); s.scale.set(8, 24, 1)
      surfaceSet.add(s); aurora.push({ s, seed: i * 1.7 })
    }
    // hill silhouettes ringing the hut & temple horizons (squashed spheres; they
    // fog toward the sky colour and read as dark ridges against the horizon glow)
    const hillMat = new THREE.MeshBasicMaterial({ color: 0x05080f })
    for (const [cx, hx, hz, hw, hh] of [
      [TAB_A_X, -60, -95, 46, 8], [TAB_A_X, -10, -110, 60, 11], [TAB_A_X, 48, -90, 40, 7],
      [TAB_B_X, -52, -100, 50, 9], [TAB_B_X, 20, -112, 64, 12], [TAB_B_X, 66, -92, 38, 7],
    ]) {
      const hill = new THREE.Mesh(fx.blastGeo, hillMat)
      hill.position.set(cx + hx, 0, hz); hill.scale.set(hw, hh, 14)
      surfaceSet.add(hill)
    }
    // boulders around the camps
    const rockMat = new THREE.MeshStandardMaterial({ color: 0x1a2334, roughness: 1 })
    for (const [cx, rx, rz, rs] of [[TAB_A_X, -9, -4, 1.0], [TAB_A_X, 7.5, -7, 0.7], [TAB_A_X, 12, -14, 1.5], [TAB_B_X, -13, -2, 0.9], [TAB_B_X, 14, -8, 1.2]]) {
      const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(rs, 0), rockMat)
      rock.position.set(cx + rx, rs * 0.55, rz); rock.rotation.set(rx, rz, rx * 0.7)
      surfaceSet.add(rock)
    }
    // ground mist — soft banks drifting through the pre-city ages
    const mists = []
    for (let i = 0; i < 10; i++) {
      const mat = new THREE.SpriteMaterial({ map: glowTex, color: 0x46586f, transparent: true, opacity: 0.1, depthWrite: false })
      const s = new THREE.Sprite(mat)
      s.scale.set(20 + (i % 3) * 9, 3.6, 1)
      surfaceSet.add(s)
      mists.push({ s, mat, cx: i < 5 ? TAB_A_X : TAB_B_X, bx: -26 + (i % 5) * 13, z: -12 - (i % 4) * 9, seed: i * 2.3 })
    }

    // the room beyond the window: an isolated interior (far off, shown only once
    // the dive fills the frame) where figures ring a computer box — the same box
    // as before, its glowing eye the doorway on to the machine's mind.
    const ROOM = new THREE.Vector3(150, 200, 0)
    const EYE_LOCAL = new THREE.Vector3(0.14, 1.06, -0.635)   // seated in the lens ring on the faceplate
    const roomSet = new THREE.Group(); roomSet.visible = false; roomSet.position.copy(ROOM); scene.add(roomSet)
    const wallMat = new THREE.MeshStandardMaterial({ color: 0x1a2436, roughness: 0.9, metalness: 0.1 })
    const rFloor = new THREE.Mesh(new THREE.PlaneGeometry(12, 12), wallMat); rFloor.rotation.x = -Math.PI / 2; roomSet.add(rFloor)
    const rCeil = new THREE.Mesh(new THREE.PlaneGeometry(12, 12), wallMat); rCeil.rotation.x = Math.PI / 2; rCeil.position.y = 5; roomSet.add(rCeil)
    const rBack = new THREE.Mesh(new THREE.PlaneGeometry(12, 5), wallMat); rBack.position.set(0, 2.5, -6); roomSet.add(rBack)
    const rLeft = new THREE.Mesh(new THREE.PlaneGeometry(12, 5), wallMat); rLeft.rotation.y = Math.PI / 2; rLeft.position.set(-6, 2.5, 0); roomSet.add(rLeft)
    const rRight = new THREE.Mesh(new THREE.PlaneGeometry(12, 5), wallMat); rRight.rotation.y = -Math.PI / 2; rRight.position.set(6, 2.5, 0); roomSet.add(rRight)
    // the computer box on its plinth (centred at z=-1, eye facing the +z entrance)
    const rPlinth = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.66, 1.15), new THREE.MeshStandardMaterial({ color: 0x141c2e, roughness: 0.6, metalness: 0.3 })); rPlinth.position.set(0, 0.33, -1); roomSet.add(rPlinth)
    const rBox = new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.68, 0.68), new THREE.MeshStandardMaterial({ color: 0x0c1322, roughness: 0.35, metalness: 0.6, emissive: 0x0a1a33, emissiveIntensity: 0.8 })); rBox.position.set(0, 1.0, -1); roomSet.add(rBox)
    // dress the face so nothing floats: a proud faceplate carries the fittings,
    // the eye sits as a bulb inside a metal lens ring (only its dome protruding),
    // the seams half-embed in the chassis face, and a cable snakes to the floor
    const plate = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.6, 0.03), new THREE.MeshStandardMaterial({ color: 0x0a101e, roughness: 0.3, metalness: 0.65 }))
    plate.position.set(0, 1.0, -0.645); roomSet.add(plate)   // front at -0.63, proud of the chassis face (-0.66)
    const seamMat = new THREE.MeshBasicMaterial({ color: 0x7fd4ff, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false })
    for (const [w, h, d, x, y, z] of [
      [0.70, 0.02, 0.02, 0, 1.17, -0.659], [0.70, 0.02, 0.02, 0, 0.83, -0.659],
      [0.02, 0.36, 0.02, -0.345, 1.0, -0.659], [0.02, 0.36, 0.02, 0.345, 1.0, -0.659],
    ]) { const seam = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), seamMat); seam.position.set(x, y, z); roomSet.add(seam) }
    const metalMat = new THREE.MeshStandardMaterial({ color: 0x232c3e, roughness: 0.4, metalness: 0.7 })
    const lensRing = new THREE.Mesh(new THREE.TorusGeometry(0.07, 0.022, 8, 24), metalMat)
    lensRing.position.set(0.14, 1.06, -0.615); roomSet.add(lensRing)   // faces +z, mounted through the plate
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0xbfeaff, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false })
    const eye = new THREE.Mesh(fx.blastGeo, eyeMat); eye.scale.setScalar(0.05); eye.position.copy(EYE_LOCAL); roomSet.add(eye)
    // vents and a status-LED row, flush on the plate
    const ventMat = new THREE.MeshBasicMaterial({ color: 0x05080f })
    for (let vi = 0; vi < 3; vi++) { const v = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.012, 0.006), ventMat); v.position.set(-0.13, 0.85 - vi * 0.035, -0.628); roomSet.add(v) }
    for (const [lc, li] of [[0x53ff86, 0], [0xffc45e, 1], [0x7fd4ff, 2]]) {
      const led = new THREE.Mesh(fx.blastGeo, new THREE.MeshBasicMaterial({ color: lc }))
      led.scale.setScalar(0.011); led.position.set(0.13 + li * 0.05, 0.82, -0.628); roomSet.add(led)
    }
    // power cable: out of the chassis rear, sagging to the floor behind the plinth
    const cableCurve = new THREE.QuadraticBezierCurve3(new THREE.Vector3(0.18, 0.72, -1.32), new THREE.Vector3(0.44, 0.26, -1.52), new THREE.Vector3(0.66, 0.015, -1.66))
    roomSet.add(new THREE.Mesh(new THREE.TubeGeometry(cableCurve, 12, 0.018, 6), new THREE.MeshStandardMaterial({ color: 0x0c0f16, roughness: 1 })))
    // the machine's glow hugs the lens — just off the bulb, not out in the room
    const roomBoxLight = new THREE.PointLight(0x7fd4ff, 3.4, 14, 1.8); roomBoxLight.position.set(0.14, 1.06, -0.52); roomSet.add(roomBoxLight)
    // figures gathered around the box, all eyes on it — but only on a rear/side
    // arc (50°..310° off the +z axis), leaving the camera-facing front open so
    // none of them block the lens's view of the computer
    const roomSwayers = []
    const RN = 8
    for (let i = 0; i < RN; i++) {
      const phi = (50 + (i / (RN - 1)) * 260) * Math.PI / 180
      const r = 1.9 + (i % 3) * 0.4
      const x = Math.sin(phi) * r, z = -1 + Math.cos(phi) * r
      const fig = makeFigure()
      fig.g.position.set(x, 0, z); fig.g.scale.setScalar(1.9)
      orient(fig.g, new THREE.Vector3(-x, 0, -1 - z))   // face the box centre (0, -1)
      roomSet.add(fig.g); roomSwayers.push({ body: fig.upper, i })
    }

    // ── SET 3 · the machine: a lattice of thought, tables of live numbers ─────
    const machineSet = new THREE.Group(); machineSet.visible = false; scene.add(machineSet)
    const LAYER_N = [4, 6, 8, 6, 3]
    // solid black outline for every node: an inverted-hull shell (back-faced,
    // opaque, a touch larger) sits behind the glowing sphere, so a crisp black
    // rim reads around each node. Shared material; the shell rides the node's
    // scale as a child, so it pulses with it.
    const nodeOutlineMat = new THREE.MeshBasicMaterial({ color: 0x000000, side: THREE.BackSide })
    const layers = LAYER_N.map((n, li) => Array.from({ length: n }, (_, i) => {
      const mat = new THREE.MeshBasicMaterial({ color: 0x1c5a94, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false })
      const m = new THREE.Mesh(fx.blastGeo, mat)
      m.position.set(-12 + li * 6, (i - (n - 1) / 2) * 2.15, Math.sin(i * 2.7 + li * 1.3) * 0.7)
      const outline = new THREE.Mesh(fx.blastGeo, nodeOutlineMat); outline.scale.setScalar(1.2); m.add(outline)
      m.scale.setScalar(0.32)
      machineSet.add(m)
      return { m, mat, pop: 0 }
    }))
    const linkPos = []
    for (let li = 0; li < layers.length - 1; li++)
      for (const A of layers[li]) for (const B of layers[li + 1])
        linkPos.push(A.m.position.x, A.m.position.y, A.m.position.z, B.m.position.x, B.m.position.y, B.m.position.z)
    // fat lines (LineSegments2): plain WebGL lines are locked to 1px, so the
    // links use screen-space thick lines to render a touch bolder (2px)
    const linkGeo = new LineSegmentsGeometry()
    linkGeo.setPositions(linkPos)
    const linkMat = new LineMaterial({ color: 0x2f5fd0, transparent: true, opacity: 0.2, blending: THREE.AdditiveBlending, depthWrite: false, linewidth: 2 })
    linkMat.resolution.set(window.innerWidth || 1920, window.innerHeight || 1080)
    machineSet.add(new LineSegments2(linkGeo, linkMat))

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
        g2.fillStyle = '#9fb0ff'; g2.font = 'bold 17px "Cascadia Mono", Consolas, ui-monospace, Menlo, monospace'; g2.fillText(title, 14, 30)
        g2.fillStyle = 'rgba(110,150,255,0.5)'; g2.fillRect(14, 40, 484, 1)
        g2.font = '16px "Cascadia Mono", Consolas, ui-monospace, Menlo, monospace'
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
      return g
    }
    const capitalShip = addShip(buildBlueCapital2, 3.2, 0, 0, 0, [[-0.45, -3.8], [0, -3.8], [0.45, -3.8]])
    addShip(buildBlueCruiser, 2.0, -8, -1.5, -6, [[0, -1.5]])
    addShip(buildBlueCruiser, 2.0, 8, -1.5, -6, [[0, -1.5]])
    for (const [fx2, fy, fz] of [[-4, 2, 7], [4, 2, 7], [-8, 1, 12], [8, 1, 12], [-12, 0, 17], [12, 0, 17]])
      addShip(buildBlueModel, 1.3, fx2, fy, fz, [[0, -0.95]])
    const FLEET_FROM = new THREE.Vector3(60, -2, 92)
    const FLEET_DIR = new THREE.Vector3(-130, 8, -86).normalize()
    orient(fleet, FLEET_DIR)   // formation offsets ride the group's heading

    // ── the timeline ───────────────────────────────────────────────────────────
    const _p = new THREE.Vector3(), _look = new THREE.Vector3(), _s1 = new THREE.Vector3(), _s2 = new THREE.Vector3(), _capPos = new THREE.Vector3()
    let T = -PREROLL, banged = false, c1 = false, c2 = false, cS = false, c3 = false, c4 = false, c5 = false, cutA = false, cutB = false, cutC = false, ended = false
    let pulseCd = 0, novaCd = 1.1, streakCd = 0, worldShown = false, discCrossed = false, lastTickT = 0
    let capCrossed = false, followT = 0   // the capital-ship pan: armed once it passes screen centre
    let roomShown = false                 // surface tail: swapped city → interior room once the window fills
    let flashAB = false, flashBC = false, roseBeat = false  // flashes + era beats punctuating the hut→temple→city cuts
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
        const w = clamp01((T - (CUT_MACHINE - 0.6)) / 0.6)
        if (w > 0) { fo = Math.max(fo, w); flashMat.color.setHex(0xd8f2ff) }
      } else if (!cutC) {
        const w = clamp01((T - (CUT_ORBIT - 0.6)) / 0.6)
        if (w > 0) { fo = Math.max(fo, w); flashMat.color.setHex(0xd8f2ff) }
      }
      flashMat.opacity = fo

      if (!banged && T >= BANG_T) { banged = true; seed.visible = false; fireball.visible = true; shock.visible = true; fireFlash(); s.bang() }
      // the first sound dies away as the world rushes up to meet the lens
      if (banged && !cutA && T > 18.3) {
        s.bangFade(clamp01((T - 18.3) / 1.6))
        if (T > 19.9) s.bangStop()
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
          if (!st.lit && T >= st.ignite) { st.lit = true; st.g.visible = true; fx.blast(st.g.position, true, { silent: true }) }   // the score carries this — no battle boom
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
        s.bangStop()
        spaceSet.visible = false; surfaceSet.visible = true
        scene.fog = new THREE.Fog(0x0a1322, 30, 220)
      }
      // the window→room swap: once the dive has filled the frame with the lit
      // pane, hide the city and reveal the interior, hiding the jump in a wash
      if (cutA && !cutB && !roomShown && T >= WINDOW_CUT) {
        roomShown = true
        surfaceSet.visible = false; roomSet.visible = true
        flashMat.color.setHex(0xffffff); fireFlash(1, 0.55)   // window-light wash
        s.humStart()                                          // the machine's room tone lives here
      }
      if (roomShown && !cutB) s.humLevel(clamp01((T - WINDOW_CUT) / 0.8))   // fades up with the reveal
      if (cutA && !cutB && !roomShown) {
        // ── the rise of the makers: hard cut from the hut and its fire, to the
        // stone temple, to the watchers as a skyline erupts, then dive at a lit
        // window on the far tower ──
        // figures sway; the fire flickers; the skyline (incl. target tower) erupts
        for (const u of swayers) u.body.rotation.z = Math.sin(T * 1.2 + u.i) * 0.05
        // the coal bed breathes — slow uneven pulses, no open flame
        const fl = 0.6 + 0.3 * Math.sin(T * 2.6) + 0.14 * Math.sin(T * 6.7) + 0.08 * Math.sin(T * 11.9)
        fireLight.intensity = 1.3 + fl * 1.0
        bedGlowMat.opacity = 0.12 + fl * 0.14
        for (const co of coals) {
          const h = clamp01(0.45 + 0.4 * Math.sin(T * 1.1 + co.seed) + 0.25 * Math.sin(T * 3.7 + co.seed * 2.3))
          co.mat.color.copy(COAL_COLD).lerp(COAL_HOT, h)
        }
        // sparks waver up off the bed and wink out on the wind
        for (const sp of sparks) {
          sp.life += dt / sp.dur
          if (sp.life >= 1) { sp.life -= 1; sp.dur = 1.1 + Math.random() * 1.3; sp.seed = Math.random() * 6.283; sp.ox = (Math.random() - 0.5) * 0.5; sp.oz = (Math.random() - 0.5) * 0.4 }
          const k = sp.life
          sp.spr.position.set(
            FIRE.x + sp.ox + Math.sin(T * 2.2 + sp.seed) * 0.3 * k,
            0.18 + k * (1.1 + sp.seed * 0.12),
            FIRE.z + sp.oz + Math.cos(T * 1.9 + sp.seed) * 0.22 * k,
          )
          sp.mat.opacity = Math.sin(Math.min(1, k * 1.15) * Math.PI) * (0.4 + 0.6 * Math.max(0, Math.sin(T * 21 + sp.seed * 7)))
        }
        for (const sm of smokes) {
          sm.life += dt / sm.dur
          if (sm.life >= 1) { sm.life -= 1; sm.dur = 2.4 + Math.random() * 1.6; sm.seed = Math.random() * 6.283; sm.drift = (Math.random() - 0.5) * 0.7 }
          const k = sm.life
          sm.spr.position.set(FIRE.x + sm.drift * k * 4 + Math.sin(T * 1.1 + sm.seed) * 0.5 * k, FIRE.y + 0.4 + k * 6, FIRE.z + Math.cos(T * 0.9 + sm.seed) * 0.4 * k)
          sm.spr.scale.setScalar(0.6 + k * 3.6)
          sm.mat.opacity = Math.sin(Math.min(1, k * 1.3) * Math.PI) * 0.33
          const v = 0.16 + k * 0.13; sm.mat.color.setRGB(v + (1 - k) * 0.07, v, v * 1.04)   // warm near the coals → grey
        }
        // living dressing: aurora breathes, mist drifts, fireflies blink, braziers gutter
        for (const au of aurora) {
          au.s.material.opacity = 0.07 + 0.06 * (0.5 + 0.5 * Math.sin(T * 0.5 + au.seed))
          au.s.scale.y = 22 + 5 * Math.sin(T * 0.34 + au.seed * 1.3)
          au.s.position.y = 26 + 2.2 * Math.sin(T * 0.22 + au.seed)
        }
        for (const ms of mists) {
          ms.s.position.set(ms.cx + ms.bx + Math.sin(T * 0.07 + ms.seed) * 9, 1.3 + 0.3 * Math.sin(T * 0.15 + ms.seed), ms.z)
          ms.mat.opacity = 0.07 + 0.05 * (0.5 + 0.5 * Math.sin(T * 0.11 + ms.seed * 2))
        }
        for (const ff of flies) {
          ff.s.position.set(
            TAB_A_X + Math.sin(T * 0.4 + ff.seed) * ff.r + Math.sin(T * 1.7 + ff.seed * 3) * 0.7,
            0.9 + 0.55 * Math.sin(T * 0.9 + ff.seed * 2),
            -6 + Math.cos(T * 0.33 + ff.seed) * ff.r * 0.8,
          )
          ff.mat.opacity = Math.max(0, Math.sin(T * 1.3 + ff.seed * 5)) * 0.8   // blink
        }
        for (const bz of braziers) {
          const f2 = 0.7 + 0.3 * Math.sin(T * 13 + bz.seed) + 0.12 * Math.sin(T * 5.7 + bz.seed * 2)
          bz.flameMat.opacity = 0.55 * f2
          bz.flame.scale.set(0.95 + f2 * 0.25, 1.45 + f2 * 0.45, 1)
          bz.light.intensity = 1.1 + f2 * 0.8
        }
        const cityUp = T >= PAN_BC
        for (const tw of towers) tw.m.visible = cityUp   // fully erect, revealed whole at the city cut
        heroWin.visible = cityUp
        // white flashes punctuate the hard cuts between the ages
        if (!flashAB && T >= PAN_AB) { flashAB = true; flashMat.color.setHex(0xffffff); fireFlash(1, 0.4); s.eraCut() }   // the temple age rings in on bronze
        if (!flashBC && T >= PAN_BC) { flashBC = true; flashMat.color.setHex(0xffffff); fireFlash(1, 0.4); s.eraCut() }   // the city arrives on the same bell
        if (!roseBeat && T >= SKY_RISE_FROM) { roseBeat = true; s.cityRise() }   // and its towers climb on a swell
        if (T < ZOOM_T) {
          // hard cut between tableaus: snap the camera to each one's own fixed
          // framing, no interpolation — the content change carries the cut. The
          // city gets a raised, pulled-back frame so the skyline reads.
          let camX = TAB_A_X, camY = 3.4, camZ = 13, lookY = 2.4, lookZ = -8
          // cut → the city: raised, gazing down the lit avenue toward the core
          if (T >= PAN_BC) { camX = TAB_C_X; camY = 9; camZ = 26; lookY = 14; lookZ = -80 }
          else if (T >= PAN_AB) { camX = TAB_B_X }                                        // cut → the temple
          camera.position.set(camX, camY, camZ)
          camera.lookAt(camX, lookY, lookZ)
        } else {
          // dive down the avenue toward the lit window on the landmark tower —
          // start exactly at the city framing so there's no snap into the move
          const e = easeInOut(clamp01((T - ZOOM_T) / (WINDOW_CUT - ZOOM_T)))
          camera.position.set(TAB_C_X, 9 + (38 - 9) * e, 26 + (WINDOW_POS.z + 8 - 26) * e)
          _look.set(TAB_C_X, 14 + (WINDOW_POS.y - 14) * e, -80 + (WINDOW_POS.z + 80) * e)
          camera.lookAt(_look)
        }
      } else if (cutA && !cutB && roomShown) {
        // ── inside the room: push from the window in toward the box's glowing eye,
        // whose cyan wash carries us on into the machine ──
        for (const u of roomSwayers) u.body.rotation.z = Math.sin(T * 1.2 + u.i) * 0.05
        // hold still on the room for a beat, then push in toward the eye
        const ROOM_HOLD = 0.5
        const q = easeInOut(clamp01((T - WINDOW_CUT - ROOM_HOLD) / (CUT_MACHINE - WINDOW_CUT - ROOM_HOLD)))
        eyeMat.opacity = 0.55 + 0.12 * Math.sin(T * 6)   // a small physical LED — gentle pulse, no swell/flare
        eye.scale.setScalar(0.05)                         // stays LED-sized as we approach
        roomBoxLight.intensity = 2.6 + 0.3 * Math.sin(T * 5)
        seamMat.opacity = 0.6 + 0.3 * Math.sin(T * 3.2)
        // drive the lens straight onto the eye — aligned with it and closing to
        // arm's length so it fills the frame just as the wash carries us on
        camera.position.set(ROOM.x + EYE_LOCAL.x, ROOM.y + 2.2 - 1.14 * q, ROOM.z + 8 - 7.8 * q)
        _look.set(ROOM.x + EYE_LOCAL.x, ROOM.y + EYE_LOCAL.y, ROOM.z + EYE_LOCAL.z)
        camera.lookAt(_look)
      }

      if (!cutB && T >= CUT_MACHINE) {
        cutB = true; fireFlash()
        surfaceSet.visible = false; roomSet.visible = false; machineSet.visible = true
        scene.fog = null
        // the room tone is already running (it starts with the computer room);
        // carry it across the cut — restart only if it somehow never began
        s.humStart(); s.humLevel(1)
      }
      if (cutB && !cutC) {
        // ── inside the machine: drift through the thinking lattice, then the
        // long breath out — pulling back before the reveal ──
        const q = clamp01((T - CUT_MACHINE) / 5.5)
        const pb = easeInOut(clamp01((T - (CUT_MACHINE + 5)) / 2.3))
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
            if (T - lastTickT > 0.09) { lastTickT = T; s.tick() }   // activation blip, rate-limited
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
        // the room tone stays behind with the machine: fade it out over the
        // reveal, then stop it once it is silent
        const hv = clamp01(1 - (T - CUT_ORBIT) / 1.8)
        s.humLevel(hv)
        if (hv <= 0.002) s.humStop()
        // ── the reveal: the lattice was the planet all along — pull away from
        // the Litania Magna in its diadem, the Throneworld hanging beyond ──
        const f = easeInOut(clamp01((T - CUT_ORBIT) / 4))
        camera.position.set(0, 5 + 3 * f, 58 + 28 * f)
        litanyTick(T); worldTick(T)
        // …and the watch sweeps past, silhouetted against the machine planet
        if (T > FLEET_T) {
          fleet.visible = true
          fleet.position.copy(FLEET_FROM).addScaledVector(FLEET_DIR, (T - FLEET_T) * 32)
          capitalShip.getWorldPosition(_capPos)
          // arm the follow the moment the capital ship crosses screen centre
          // (its projected x goes from the right half to the left). Uses last
          // frame's camera matrix — a sub-frame lag that reads as instant.
          if (!capCrossed) {
            _s1.copy(_capPos).project(camera)
            if (_s1.x <= 0) { capCrossed = true; followT = T }
          }
        }
        // hold on the Litania Magna, then ease the gaze onto the capital ship
        // and track it out — zero angular velocity at the handoff so it glides
        if (capCrossed) {
          const fb = easeInOut(clamp01((T - followT) / 1.2))
          _look.lerpVectors(LITANY_POS, _capPos, fb)
          camera.lookAt(_look)
        } else {
          camera.lookAt(LITANY_POS)
        }
      }

      if (!c1 && T >= 2.6) { c1 = true; comms.show('Litania Magna', LINE1) }
      if (!c2 && T >= 13.2) { c2 = true; comms.show('Litania Magna', LINE2) }
      // the surface montage plays wordless; the narration lands once we're inside
      // the room with the computer
      if (!cS && T >= WINDOW_CUT + 0.3) { cS = true; comms.show('Litania Magna', LINE_S) }
      if (!c3 && T >= WINDOW_CUT + 3.4) { c3 = true; comms.show('Litania Magna', LINE3, { persist: true }) }
      if (!c4 && T >= 41.14) { c4 = true; comms.show('Litania Magna', LINE4, { persist: true }) }
      if (!c5 && T >= 45.14) { c5 = true; comms.show('Litania Magna', LINE5, { persist: true }) }
      if (!ended && T >= END_T) { ended = true; end({ holdMs: 900 }) }
    }
  },
}

export default cosmogony

// ── Cosmogony III · the hybrid reel ──────────────────────────────────────────
// The full 3D cosmogony, shot through with photographic memory: at each age
// transition the reel freezes inside the cut and flashes real imagery from the
// Cosmogony II montage — landscapes for the world rushing up, temples of stone
// and art, the drawn figures of mathematics, the first machines, and one
// glowing mind before the reveal. The scene clock holds while a memory plays,
// so every inner beat keeps its spacing and simply slides later.
//
// Every transition speaks the same language: a white wash carries the frame
// into the first memory and a smaller blink of the same wash cuts memory to
// memory. The inner scene steps ACROSS the age cut on the interlude's first
// frame and on through the cut's own white flash, all behind the opaque
// overlay — so the next age renders (shaders and textures warm) for the whole
// memory, and its flash is fully spent unseen. The exit is then a clean
// dissolve straight onto the settled scene: no burst of white, no swap cost.
// One journey, one kind of cut.
//
// The reel is scored by cosmogonyScore.js: the Cathedral strikes the bang and
// the original bigbang.mp3 rumble carries the young universe; from the first
// memory on the voice is synthesized — each age retunes the bed, every memory
// and cut is struck, and the last memory rings the radiant chord.
// memories live in the montage's folder; a leading slash reaches public/ root
const MEM_BASE = import.meta.env?.BASE_URL ?? '/'
const MEM_IMG = (f) => (f.startsWith('/') ? `${MEM_BASE}${f.slice(1)}` : `${MEM_BASE}montage/${encodeURIComponent(f)}`)
const INTERLUDES = [
  { at: CUT_SURFACE, dur: 0.99, strike: 'world', era: 'world', drum: true, imgs: [   // down through the clouds — the primordial earth
    'The-Shore-of-Oblivion-1889-scaled.webp',
    'HKH-60684-scaled.jpg.webp',
    'HMF65m1WEAI1EhF.jfif',
  ] },
  { at: PAN_AB, dur: 0.94, strike: 'bell', era: 'temple', imgs: [        // the temple age — sacred architecture, drawn and dreamt
    'piranesi-roma.jpg',
    'hubert-robert-grande-galerie-1796.jpg',
    'art-hilma-af-klint-group-x-no-1-altarpiece-altarbild-1915.jpg',
  ] },
  { at: PAN_BC, dur: 0.88, strike: 'figure', era: 'city', imgs: [        // the city age — mathematics on paper
    'harmonograph.png',
    'lorenz.png',
    'hopf_fibration (1).png',
  ] },
  { at: WINDOW_CUT, dur: 0.94, strike: 'machine', era: 'machine', drum: true, imgs: [ // through the window — the first machines that thought
    'less-than-p-greater-than-programmers-at-aberdeen-proving-grounds-configure-eniacs-function-tables-which-acted-as-a-form-of-read-only-memory-less-than-p-greater-than.webp',
    'Reprogramming_ENIAC.png',
  ] },
  { at: CUT_ORBIT, dur: 1.54, strike: 'finale', era: 'memory', drum: true, imgs: [    // before the reveal — the mind, glowing
    'neural_network_cold.png',
  ] },
  // the last memory — the one who listens. Held past the scene's end: the
  // overlay never lifts, so the shell's fade-to-black closes over her.
  { at: END_T - 0.4, dur: 2.4, strike: 'bell', era: 'memory', drum: true, hold: true, imgs: [
    '/empress.jpg',
  ] },
]
// `drum: true` entries fire the era drum from out here — the PAN cuts ring
// their own bell inside the scene (it lands at the same moment, since the cut
// is crossed on the interlude's first frame), so only the cuts the plain
// cosmogony leaves silent get one. `hold: true` marks a memory with no exit.

export const cosmogonyHybrid = {
  ...cosmogony,
  label: 'CUTSCENE / COSMOGONY III',
  create(ctx) {
    // the synthesized voice replaces every sample; the inner scene tracks its
    // dispose. (No WebAudio → null → the scene falls back to its samples.)
    const score = createCosmogonyScore()
    const inner = cosmogony.create(ctx, score ?? undefined)
    score?.start()

    // the memory layer: a plain DOM overlay above the canvas — photographs are
    // the montage's medium, and belong to the page, not the bloomed 3D frame.
    // Every image gets its own PRE-MOUNTED, PRE-DECODED layer (the montage's
    // anti-hitch pattern): decoding a 4K frame at swap time is what causes
    // visible stutter, so all decode work happens at create, ~22s early, and a
    // swap is nothing but two opacity flips.
    const overlay = document.createElement('div')
    overlay.style.cssText = 'position:absolute;inset:0;z-index:4;display:none;overflow:hidden;background:#000'
    const layers = []   // one <img> per memory, reel order
    const decoded = []  // advancement never outruns the decoder — a late image holds, never blanks
    for (const it of INTERLUDES) for (const f of it.imgs) {
      const im = document.createElement('img')
      im.alt = ''
      im.src = MEM_IMG(f)
      im.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;object-fit:cover;opacity:0'
      overlay.appendChild(im)
      const j = layers.length
      decoded.push(false)
      const settle = () => { decoded[j] = true }
      // decode() warms the decoder ahead of the flash, but its promise can
      // stall in a throttled tab — the load event is the readiness floor
      if (im.decode) im.decode().then(settle, settle)
      im.addEventListener('load', settle)
      im.addEventListener('error', settle)
      if (im.complete) settle()
      layers.push(im)
    }
    const base = []   // layer index of each interlude's first image
    { let acc = 0; for (const it of INTERLUDES) { base.push(acc); acc += it.imgs.length } }
    const vig = document.createElement('div')   // the montage's vignette, so the flashes share its grade
    vig.style.cssText = 'position:absolute;inset:0;pointer-events:none;background:radial-gradient(ellipse at center,transparent 55%,rgba(0,0,0,0.5) 100%)'
    overlay.appendChild(vig)
    // the overlay's own white wash — the same cut language the 3D scene speaks
    const wash = document.createElement('div')
    wash.style.cssText = 'position:absolute;inset:0;pointer-events:none;background:#fff;opacity:0'
    overlay.appendChild(wash)
    ctx.mount.appendChild(overlay)
    ctx.track({ dispose: () => overlay.remove() })

    let washT = 9, washPeak = 1, washDur = 0.5
    const fireWash = (peak, dur) => { washT = 0; washPeak = peak; washDur = dur }
    let cur = -1
    const show = (j) => { if (cur >= 0) layers[cur].style.opacity = '0'; layers[j].style.opacity = '1'; cur = j }

    let T = -PREROLL          // shadow of the inner clock — fed the same dt stream, it tracks exactly
    let qi = 0, mem = null    // next interlude · the one playing
    let machineBeat = false   // the eye-dive cut has no interlude — drum it from here
    let commsCut = false      // the last line lifts as the black closes over the empress
    const FADE_OUT = 0.4      // exit dissolve: the last image melts onto the settled next age
    let fadeT = 0
    return (dt) => {
      if (!mem && qi < INTERLUDES.length && T + dt >= INTERLUDES[qi].at) {
        mem = { it: INTERLUDES[qi], base: base[qi], t: 0, shown: -1, crossed: false }
        qi++
        fadeT = 0
        overlay.style.display = 'block'; overlay.style.opacity = '1'
        score?.setEra(mem.it.era)             // the bed starts its climb under the memory
        if (mem.it.drum) score?.eraCut()      // the age announces itself as its memories flash
        fireWash(1, 0.5)                      // enter the memory on the same white wash the cuts use
      }
      if (mem) {
        mem.t += dt
        // step the inner scene ACROSS the age cut and on through the cut's
        // white flash (~0.45s), hidden behind the opaque overlay: the next
        // age's sets render and warm, and the flash spends itself unseen, so
        // the exit dissolve lands on a settled frame instead of a white burst.
        // The scene clock then holds. (A held memory only crosses — the
        // empress must not step the scene into its own ending.)
        if (!mem.crossed) { mem.crossed = true; T += dt; inner(dt) }
        else if (!mem.it.hold && mem.t <= 0.45) { T += dt; inner(dt) }
        // hold the current frame rather than outrun the decoder
        let k = Math.min(mem.it.imgs.length - 1, Math.floor(mem.t / mem.it.dur))
        while (k > 0 && !decoded[mem.base + k]) k--
        if (k !== mem.shown && decoded[mem.base + k]) {
          const first = mem.shown < 0
          mem.shown = k
          show(mem.base + k)
          score?.strike(mem.it.strike)
          if (!first) fireWash(0.55, 0.3)   // memory-to-memory: a smaller blink of the same wash
        }
        washT += dt
        wash.style.opacity = String(Math.max(0, washPeak * (1 - washT / washDur)))
        if (mem.t < mem.it.dur * mem.it.imgs.length) return
        // the memory ends. A held memory (the empress) never lifts — the inner
        // scene resumes beneath it and the shell's fade-to-black closes over
        // her. Every other memory DISSOLVES out onto the settled scene.
        if (!mem.it.hold) fadeT = FADE_OUT
        mem = null
      }
      if (fadeT > 0) {
        fadeT -= dt
        if (fadeT <= 0) {
          overlay.style.display = 'none'; overlay.style.opacity = '1'
          if (cur >= 0) { layers[cur].style.opacity = '0'; cur = -1 }
        } else {
          overlay.style.opacity = String(fadeT / FADE_OUT)
        }
      }
      T += dt
      if (score && !machineBeat && T >= CUT_MACHINE) { machineBeat = true; score.eraCut() }
      // the comms box rides above the shell's fade layer, so the persistent
      // last line would linger over black — clear it the moment the fade
      // starts (END_T + the scene's 0.9s end-hold) and the empress goes alone
      if (!commsCut && T >= END_T + 0.9) { commsCut = true; ctx.comms.hide() }
      inner(dt)
    }
  },
}
