import * as THREE from 'three'
import { registerAudioContext } from '../../../lib/audioUnlock'
import { playTitleBoom } from '../sfx'
import { makeGalaxy, makeStar, buildSimpleStar, buildSimpleGalaxy } from '../../battle/geometry'
import { buildFleet } from '../actors'

// Eschaton — the capstone. The Lance has annihilated the veiled seat, and the
// Ecumenologion re-runs model Ω against the LIVING sky: the aeons as they were
// — a universe born, gathered home at the appointed hour, born again — three
// recurrences rung off like a wheel. Then the forward integration that cannot
// close: the Aleph glyph shatters on the model, the arrow of time runs out of
// the origin and never turns, and everything the Discord has left comes over
// the horizon for its last stand.
//
// The whole cosmogenesis is a pure function of a "universe age" clock U, so
// the collapse is literally creation played backwards — galaxies unwind, stars
// gutter out, the matter shells fall home to the seed. The diagram cards ride
// a DOM canvas above the bloom pass, in the Logos projection's own idiom.

const LINE_LIT1 = 'So it was, aeon upon aeon: everything that is, gathered home at the appointed hour.'
const LINE_LIT2 = 'The Lance has spoken. There is no appointed hour. The wheel is broken.'
const LINE_E1 = 'What have you done? The past is lost, the future uncertain!'
const LINE_E2 = 'Our people, cast into the uncertainty of infinity...'
const LINE_P1 = 'The continuation of the future is better than the guaranteed safety of a guided cage.'
const LINE_P2 = 'Your end has come!'

// ── the sequence ─────────────────────────────────────────────────────────────
// [bang forward → the Aleph attested → bang in reverse → a beat of dark] ×3,
// each recurrence a little faster — the wheel grinding. Then one last forward
// run, the glyph shattering, the arrow of time, and the fleet.
const U_END = 10          // the universe's internal timeline, bang at U=0.5
const BANG_U = 0.5
const FWD_D = 4.0, REV_D = 3.2, DARK_D = 0.5
const CYCLES = [
  { rate: 1.0,  hold: 1.7 },
  { rate: 1.28, hold: 1.4 },
  { rate: 1.62, hold: 1.15 },
]
const SEGS = [{ kind: 'dark', dur: 1.6, cycle: 0 }]   // a held breath before the first replay
for (let i = 0; i < CYCLES.length; i++) {
  const c = CYCLES[i]
  SEGS.push({ kind: 'fwd',  dur: FWD_D / c.rate, cycle: i })
  SEGS.push({ kind: 'card', dur: c.hold,         cycle: i })
  SEGS.push({ kind: 'rev',  dur: REV_D / c.rate, cycle: i })
  SEGS.push({ kind: 'dark', dur: DARK_D,         cycle: i })
}
SEGS.push({ kind: 'fwd',     dur: 4.6, cycle: 3, final: true })
SEGS.push({ kind: 'shatter', dur: 3.6 })
SEGS.push({ kind: 'arrow',   dur: 4.8 })
SEGS.push({ kind: 'fleet',   dur: 22 })
{ let acc = 0; for (const s of SEGS) { s.t0 = acc; acc += s.dur } }
const seg2 = (k, n) => SEGS.filter((s) => s.kind === k)[n]         // n-th segment of a kind
const FINAL_FWD = SEGS.find((s) => s.final)
const SHATTER = seg2('shatter', 0), ARROW = seg2('arrow', 0), FLEET = seg2('fleet', 0)
const CRACK_T = 1.15      // into the shatter card: when the glyph gives way
const segAt = (t) => SEGS.find((s) => t < s.t0 + s.dur) ?? SEGS[SEGS.length - 1]

const clamp01 = (v) => Math.min(1, Math.max(0, v))
const easeOut3 = (p) => 1 - Math.pow(1 - p, 3)
const easeInOut = (p) => (p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2)
const ORIGIN = new THREE.Vector3()

// ── the score — one small WebAudio graph, cosmogonyScore's recipe book ───────
// The bang is the Cathedral (as it is everywhere creation speaks); under it a
// drone bed climbs a root per recurrence and falls back with each collapse.
// The reverse is a riser cut dead at the origin; the Aleph rings a cold bell;
// the shatter is the era drum with its bell partials falling; the arrow gets
// the radiant D chord; the fleet closes on a war-pulse.
const ROOTS = [41.2, 49.0, 55.0]   // E1 → G1 → A1, recurrence by recurrence
function makeEschatonScore() {
  const AC = window.AudioContext || window.webkitAudioContext
  if (!AC) return null
  const actx = registerAudioContext(new AC())
  const comp = actx.createDynamicsCompressor()
  comp.threshold.value = -14; comp.knee.value = 18; comp.ratio.value = 3.5
  comp.attack.value = 0.003; comp.release.value = 0.3
  comp.connect(actx.destination)
  const master = actx.createGain(); master.gain.value = 0; master.connect(comp)
  const bus = actx.createGain(); bus.connect(master)
  const delay = actx.createDelay(1.5); delay.delayTime.value = 0.43
  const damp = actx.createBiquadFilter(); damp.type = 'lowpass'; damp.frequency.value = 1900
  const fbk = actx.createGain(); fbk.gain.value = 0.42
  const wet = actx.createGain(); wet.gain.value = 0.4
  bus.connect(delay); delay.connect(damp); damp.connect(fbk); fbk.connect(delay); damp.connect(wet); wet.connect(master)
  const nbuf = actx.createBuffer(1, actx.sampleRate * 2, actx.sampleRate)
  { const nd = nbuf.getChannelData(0); for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1 }
  const now = () => actx.currentTime
  const ramp = (p, v, t) => { p.cancelScheduledValues(now()); p.setValueAtTime(p.value, now()); p.linearRampToValueAtTime(v, now() + t) }

  const droneFilter = actx.createBiquadFilter(); droneFilter.type = 'lowpass'; droneFilter.frequency.value = 180; droneFilter.Q.value = 0.6
  const droneGain = actx.createGain(); droneGain.gain.value = 0
  droneFilter.connect(droneGain); droneGain.connect(bus)
  const oscs = []
  for (const [type, ratio, level] of [['sine', 0.5, 0.9], ['sawtooth', 1, 0.2], ['sawtooth', 1.006, 0.18], ['sine', 1.5, 0.26]]) {
    const o = actx.createOscillator(); o.type = type; o.frequency.value = 32.7 * ratio
    const g = actx.createGain(); g.gain.value = level
    o.connect(g); g.connect(droneFilter); o.start()
    oscs.push({ o, ratio })
  }
  const setDrone = (root, cutoff, glide = 1.6, level = 0.09) => {
    for (const { o, ratio } of oscs) ramp(o.frequency, root * ratio, glide)
    ramp(droneFilter.frequency, cutoff, glide)
    ramp(droneGain.gain, level, glide)
  }

  const blip = (freq, at, len, level, type = 'sine', glideTo = null) => {
    const t0 = now() + 0.02 + at
    const o = actx.createOscillator(); o.type = type; o.frequency.setValueAtTime(freq, t0)
    if (glideTo != null) o.frequency.exponentialRampToValueAtTime(Math.max(glideTo, 1), t0 + len)
    const g = actx.createGain()
    g.gain.setValueAtTime(0.0001, t0)
    g.gain.exponentialRampToValueAtTime(Math.max(level, 0.0002), t0 + 0.014)
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + len)
    o.connect(g); g.connect(bus); o.start(t0); o.stop(t0 + len + 0.05)
  }
  const burst = (at, len, level, bpFreq, q = 1) => {
    const t0 = now() + 0.02 + at
    const src = actx.createBufferSource(); src.buffer = nbuf; src.loop = true
    const bp = actx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = bpFreq; bp.Q.value = q
    const g = actx.createGain()
    g.gain.setValueAtTime(0.0001, t0)
    g.gain.exponentialRampToValueAtTime(Math.max(level, 0.0002), t0 + 0.02)
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + len)
    src.connect(bp); bp.connect(g); g.connect(bus); src.start(t0, Math.random()); src.stop(t0 + len + 0.05)
  }

  // the reverse: a swelling, band-rising suction cut dead at the origin
  const riser = (dur) => {
    const t0 = now() + 0.02
    const n = actx.createBufferSource(); n.buffer = nbuf; n.loop = true
    const bp = actx.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 0.9
    bp.frequency.setValueAtTime(140, t0); bp.frequency.exponentialRampToValueAtTime(2200, t0 + dur)
    const g = actx.createGain()
    g.gain.setValueAtTime(0.0001, t0)
    g.gain.linearRampToValueAtTime(0.26, t0 + dur * 0.85)
    g.gain.setValueAtTime(0.26, t0 + dur - 0.02)
    g.gain.linearRampToValueAtTime(0.0001, t0 + dur)     // cut dead: the flow reaches home
    n.connect(bp); bp.connect(g); g.connect(bus); n.start(t0, Math.random()); n.stop(t0 + dur + 0.05)
    blip(48, 0, dur, 0.1, 'sine', 210)                    // a thin tone climbing under it
  }
  const thud = () => { blip(64, 0, 0.5, 0.4, 'sine', 28); burst(0, 0.2, 0.16, 160, 0.8) }   // the un-bang

  // the Aleph's bell — D5 partials, cold and certain
  const bell = () => { for (const [r, l] of [[1, 1], [2.76, 0.5], [5.4, 0.24]]) blip(587.33 * r, 0, 0.7, 0.11 * l) }

  // the glyph gives way: the era drum, and the bell's own partials falling
  const crash = () => {
    const t0 = now() + 0.02
    const o = actx.createOscillator(); o.type = 'sine'
    o.frequency.setValueAtTime(96, t0); o.frequency.exponentialRampToValueAtTime(38, t0 + 0.5)
    const og = actx.createGain()
    og.gain.setValueAtTime(0.0001, t0)
    og.gain.exponentialRampToValueAtTime(0.6, t0 + 0.012)
    og.gain.exponentialRampToValueAtTime(0.0001, t0 + 1.5)
    o.connect(og); og.connect(bus); o.start(t0); o.stop(t0 + 1.6)
    burst(0, 0.34, 0.3, 240, 0.8)
    for (const [r, l] of [[1, 1], [2.76, 0.5], [5.4, 0.24]]) blip(587.33 * r, 0.05, 1.3, 0.12 * l, 'sine', 587.33 * r * 0.5)
  }

  // the arrow holds — the radiant chord, D major, brief
  const chord = () => {
    const t0 = now() + 0.05
    for (const [f, l] of [[146.83, 0.14], [220, 0.11], [293.66, 0.09], [440, 0.05], [1174.66, 0.014]]) {
      const o = actx.createOscillator(); o.type = 'sine'; o.frequency.value = f
      const g = actx.createGain()
      g.gain.setValueAtTime(0.0001, t0)
      g.gain.linearRampToValueAtTime(l, t0 + 1.1)
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + 5.0)
      o.connect(g); g.connect(bus); o.start(t0); o.stop(t0 + 5.1)
    }
  }

  // the fleet closing: a low war-pulse, struck from the scene on its cadence
  const pulse = (vol) => { blip(52, 0, 0.4, 0.38 * vol, 'sine', 38); burst(0, 0.08, 0.1 * vol, 300, 1.2) }

  const start = () => { actx.resume?.().catch?.(() => {}); ramp(master.gain, 0.52, 0.8) }
  const dispose = () => { try { actx.close() } catch { /* already closed */ } }
  return { setDrone, riser, thud, bell, crash, chord, pulse, start, dispose }
}

// ── the diagram cards — the Logos projection's own hand ─────────────────────
const MONO = '"Cascadia Mono", "Consolas", ui-monospace, "Menlo", "Monaco", monospace'
const INKC = (a) => `rgba(148,214,255,${a})`
// the reliquary glyph, in shatterable pieces: two legs, the arch, the ring,
// the mote. Each carries a fling direction and spin for the breaking.
const PIECES = [
  { cx: -22, cy: 13,  vx: -1.7, vy: 0.5,  vr: -2.2, p: (c) => { c.moveTo(-22, 40); c.lineTo(-22, -14) } },
  { cx: 0,   cy: -30, vx: 0.2,  vy: -1.9, vr: 1.6,  p: (c) => { c.arc(0, -14, 22, Math.PI, 0) } },
  { cx: 22,  cy: 13,  vx: 1.8,  vy: 0.6,  vr: 2.5,  p: (c) => { c.moveTo(22, -14); c.lineTo(22, 40) } },
  { cx: 0,   cy: -10, vx: -0.5, vy: 1.6,  vr: -3.1, ring: 8.5 },
  { cx: 0,   cy: -10, vx: 0.9,  vy: -0.8, vr: 0,    mote: 3.4 },
]
// scatter = how far the pieces have flown (glyph-local units); jit = pre-crack tremor
function drawAleph(c, S, gx, gy, glow, scatter, jit, fade) {
  c.save()
  c.translate(gx, gy); c.scale(S, S)
  c.shadowColor = 'rgba(255,190,80,0.8)'; c.shadowBlur = glow
  c.strokeStyle = `rgba(255,207,90,${fade})`; c.lineWidth = 3.4 / Math.sqrt(S)
  for (let i = 0; i < PIECES.length; i++) {
    const pc = PIECES[i]
    c.save()
    const jx = jit ? (Math.sin(i * 37.7 + jit * 61) * jit) : 0
    const jy = jit ? (Math.cos(i * 51.3 + jit * 47) * jit) : 0
    c.translate(pc.cx + pc.vx * scatter + jx, pc.cy + pc.vy * scatter + jy)
    c.rotate(pc.vr * scatter * 0.03)
    c.translate(-pc.cx, -pc.cy)
    if (pc.mote) { c.fillStyle = `rgba(255,240,196,${fade})`; c.beginPath(); c.arc(0, -10, 3.4, 0, Math.PI * 2); c.fill() }
    else if (pc.ring) { c.beginPath(); c.arc(0, -10, 8.5, 0, Math.PI * 2); c.stroke() }
    else { c.beginPath(); pc.p(c); c.stroke() }
    c.restore()
  }
  c.restore()
}
// the bang icon from FIG. α — the origin, radiating
function drawBangIcon(c, x, y, A) {
  c.strokeStyle = 'rgba(255,232,170,0.9)'; c.lineWidth = 2
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2 + 0.26
    const L = (14 + (i % 3) * 9) * (0.85 + 0.15 * Math.sin(A * 7 + i * 1.7))
    c.beginPath(); c.moveTo(x + Math.cos(a) * 8, y + Math.sin(a) * 8); c.lineTo(x + Math.cos(a) * (8 + L), y + Math.sin(a) * (8 + L)); c.stroke()
  }
  c.fillStyle = 'rgba(255,246,220,0.98)'
  c.beginPath(); c.arc(x, y, 7, 0, Math.PI * 2); c.fill()
}
function drawPanel(c, right) {
  c.fillStyle = 'rgba(5,12,20,0.97)'; c.fillRect(20, 20, 1460, 840)
  c.strokeStyle = INKC(0.5); c.lineWidth = 2; c.strokeRect(20, 20, 1460, 840)
  c.fillStyle = INKC(0.022)
  for (let y = 24; y < 856; y += 4) c.fillRect(22, y, 1456, 1)
  c.strokeStyle = INKC(0.95); c.lineWidth = 3
  for (const [bx, by, sx, sy] of [[20, 20, 1, 1], [1480, 20, -1, 1], [20, 860, 1, -1], [1480, 860, -1, -1]]) {
    c.beginPath(); c.moveTo(bx + sx * 34, by); c.lineTo(bx, by); c.lineTo(bx, by + sy * 34); c.stroke()
  }
  c.font = `700 34px ${MONO}`; c.fillStyle = 'rgba(214,240,255,0.95)'
  c.fillText('◆ MODEL Ω · LIVE RE-RUN', 56, 76)
  c.font = `500 17px ${MONO}`; c.fillStyle = INKC(0.55)
  c.fillText('AEONIC CONTINUATION · AGAINST THE LIVING SKY', 56, 104)
  c.textAlign = 'right'
  c.fillStyle = INKC(0.55); c.fillText('ECUMENOLOGION · LITANIA MAGNA', 1444, 76)
  c.fillStyle = INKC(0.38); c.fillText(right, 1444, 104)
  c.textAlign = 'left'
  c.strokeStyle = INKC(0.4); c.lineWidth = 1
  c.beginPath(); c.moveTo(44, 124); c.lineTo(1456, 124); c.stroke()
}
const ROMAN = ['Ⅰ', 'Ⅱ', 'Ⅲ']
function drawCard(c, kind, cycle, local, A, alpha) {
  c.setTransform(1, 0, 0, 1, 0, 0)
  c.clearRect(0, 0, 1500, 880)
  if (alpha <= 0.004) return
  c.globalAlpha = alpha
  if (kind === 'card') {
    drawPanel(c, `RECURRENCE ${ROMAN[cycle]} · ATTESTED`)
    // ripples closing IN on the glyph — the flow gathered back to its keeper
    for (let k = 0; k < 3; k++) {
      const rr = 200 - ((A * 46 + k * 66) % 200)
      if (rr > 24) { c.strokeStyle = `rgba(255,207,90,${0.22 * (1 - rr / 200)})`; c.lineWidth = 1.4; c.beginPath(); c.arc(750, 460, rr, 0, Math.PI * 2); c.stroke() }
    }
    // the recurrence in one figure: the arrow runs forward out of the origin
    // above, and beneath the glyph the same flow is driven home again
    const fa = 1 - Math.pow(1 - clamp01((local - 0.15) / 0.5), 3)
    if (fa > 0.01) {
      const tip = 330 + 840 * fa
      c.strokeStyle = 'rgba(148,214,255,0.85)'; c.lineWidth = 3
      c.beginPath(); c.moveTo(330, 236); c.lineTo(tip, 236); c.stroke()
      c.lineWidth = 1.5
      for (let x = 450; x < tip - 16; x += 120) { c.beginPath(); c.moveTo(x, 229); c.lineTo(x, 243); c.stroke() }
      c.fillStyle = 'rgba(190,230,255,0.9)'
      c.beginPath(); c.moveTo(tip + 14, 236); c.lineTo(tip, 229); c.lineTo(tip, 243); c.closePath(); c.fill()
      c.font = `500 15px ${MONO}`; c.fillStyle = INKC(0.55 * fa)
      c.fillText('THE ARROW OF TIME  →  t', 330, 210)
    }
    const ra = 1 - Math.pow(1 - clamp01((local - 0.6) / 0.5), 3)
    if (ra > 0.01) {
      const tip = 1170 - 840 * ra
      c.strokeStyle = 'rgba(255,90,74,0.85)'; c.lineWidth = 3
      c.beginPath(); c.moveTo(1170, 668); c.lineTo(tip, 668); c.stroke()
      c.fillStyle = 'rgba(255,140,110,0.9)'
      c.beginPath(); c.moveTo(tip - 14, 668); c.lineTo(tip, 661); c.lineTo(tip, 675); c.closePath(); c.fill()
      c.textAlign = 'right'
      c.font = `500 15px ${MONO}`; c.fillStyle = `rgba(255,110,90,${0.8 * ra})`
      c.fillText('w < −1 · GATHERED BACK', 1170, 646)
      c.textAlign = 'left'
    }
    drawAleph(c, 4.2, 750, 460, 26 + 8 * Math.sin(A * 2.4), 0, 0, 1)
    c.textAlign = 'center'
    c.font = `600 24px ${MONO}`; c.fillStyle = 'rgba(255,207,90,0.9)'
    c.fillText('THE ALEPH · BOUNDARY CONDITION OF THE AEON', 750, 726)
    c.font = `500 17px ${MONO}`; c.fillStyle = INKC(0.5)
    c.fillText('THE FLOW GATHERED BACK · THE ETERNAL RETURN', 750, 758)
    c.textAlign = 'left'
  } else if (kind === 'shatter') {
    drawPanel(c, 'FORWARD INTEGRATION · NO CLOSURE')
    const cracked = local >= CRACK_T
    if (!cracked) {
      const q = clamp01(local / CRACK_T)
      // it tries to attest — and trembles: red hairline fractures spreading
      drawAleph(c, 4.2, 750, 460, 26, 0, q * q * 4.5, 1)
      if (q > 0.45) {
        c.strokeStyle = `rgba(255,90,74,${0.9 * clamp01((q - 0.45) * 3)})`; c.lineWidth = 2.2
        for (const [x1, y1, x2, y2] of [[750, 340, 718, 412], [718, 412, 764, 462], [842, 400, 806, 500], [672, 520, 730, 556]]) {
          c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2); c.stroke()
        }
      }
      c.textAlign = 'center'
      c.font = `600 24px ${MONO}`
      c.fillStyle = `rgba(255,90,74,${0.55 + 0.45 * Math.max(0, Math.sin(A * 12))})`
      c.fillText('RECURRENCE ▸ CANNOT ATTEST', 750, 700)
      c.textAlign = 'left'
    } else {
      const k = (local - CRACK_T) / 1.6
      // the break: a white-hot core flash, an expanding ring, the pieces flung
      const fl = Math.max(0, 1 - k * 2.2)
      if (fl > 0) {
        const g = c.createRadialGradient(750, 460, 0, 750, 460, 260)
        g.addColorStop(0, `rgba(255,244,220,${fl})`); g.addColorStop(1, 'rgba(255,244,220,0)')
        c.fillStyle = g; c.fillRect(430, 140, 640, 640)
      }
      c.strokeStyle = `rgba(255,120,90,${0.75 * Math.max(0, 1 - k * 1.15)})`; c.lineWidth = 3
      c.beginPath(); c.arc(750, 460, 30 + k * 560, 0, Math.PI * 2); c.stroke()
      drawAleph(c, 4.2, 750, 460, 10, k * 46, 0, Math.max(0, 1 - k * 0.85))
      c.textAlign = 'center'
      c.font = `700 30px ${MONO}`; c.fillStyle = `rgba(255,90,74,${clamp01(k * 2.4)})`
      c.fillText('THE BOUNDARY IS UNMADE', 750, 700)
      c.font = `500 17px ${MONO}`; c.fillStyle = INKC(0.55 * clamp01(k * 2.4 - 0.4))
      c.fillText('NOTHING WAITS AT THE APPOINTED HOUR', 750, 736)
      c.textAlign = 'left'
    }
  } else if (kind === 'arrow') {
    drawPanel(c, 'MODEL COMPLETE · UNBOUNDED')
    c.strokeStyle = INKC(0.28); c.lineWidth = 1; c.strokeRect(56, 190, 1388, 420)
    c.fillStyle = INKC(0.04); c.fillRect(56, 190, 1388, 420)
    c.font = `500 16px ${MONO}`; c.fillStyle = INKC(0.6)
    c.fillText('FIG. α′ · TIME AS IT NOW IS · THE UNBROKEN FLOW', 70, 216)
    drawBangIcon(c, 200, 400, A)
    c.font = `500 14px ${MONO}`; c.fillStyle = INKC(0.45); c.fillText('ORIGIN', 174, 500)
    const a1 = 1 - Math.pow(1 - clamp01((local - 0.7) / 2.4), 3)
    if (a1 > 0.01) {
      const tip = 250 + 1080 * a1
      c.strokeStyle = 'rgba(148,214,255,0.9)'; c.lineWidth = 3.5
      c.beginPath(); c.moveTo(250, 400); c.lineTo(tip, 400); c.stroke()
      c.lineWidth = 1.6
      for (let x = 385; x < tip - 16; x += 135) { c.beginPath(); c.moveTo(x, 392); c.lineTo(x, 408); c.stroke() }
      c.fillStyle = 'rgba(190,230,255,0.95)'
      c.beginPath(); c.moveTo(tip + 15, 400); c.lineTo(tip, 392); c.lineTo(tip, 408); c.closePath(); c.fill()
      c.font = `600 19px ${MONO}`; c.fillStyle = `rgba(190,230,255,${0.9 * clamp01((a1 - 0.25) * 3)})`
      c.fillText('THE ARROW OF TIME  →  t', 560, 366)
    }
    const g2 = clamp01((local - 3.0) / 0.8)
    if (g2 > 0.01) {
      c.textAlign = 'center'
      c.font = `600 22px ${MONO}`; c.fillStyle = `rgba(255,207,90,${0.9 * g2})`
      c.fillText('NO APPOINTED HOUR · THE FLOW RUNS ON', 750, 560)
      c.textAlign = 'left'
      c.font = `500 15px ${MONO}`; c.fillStyle = INKC(0.5 * g2)
      c.fillText('w = −1.000 · FUTURE: UNWRITTEN', 1150, 588)
    }
  }
  c.globalAlpha = 1
}

export default {
  label: 'CUTSCENE / ESCHATON',
  establishing: { name: 'ESCHATON', sub: 'The Wheel Broken · Their Last Stand', stamp: 'MODEL Ω LIVE RE-RUN · STRATCON 1 · ALL FLEETS' },
  feed: [
    { t: 0.7,                    level: 'info', text: 'Model Ω re-run against the living sky · this is not a simulation' },
    { t: seg2('card', 0).t0,     level: 'warn', text: 'Recurrence attested · the flow gathered back · aeon −2' },
    { t: seg2('card', 1).t0,     level: 'warn', text: 'Recurrence attested · aeon −1 · faster' },
    { t: seg2('card', 2).t0,     level: 'warn', text: 'Recurrence attested · aeon 0 · ours' },
    { t: FINAL_FWD.t0 + 0.9,     level: 'info', text: 'Forward integration · boundary condition NOT FOUND' },
    { t: SHATTER.t0 + CRACK_T,   level: 'crit', text: 'THE RELIQUARY IS UNMADE · recurrence cannot close' },
    { t: ARROW.t0 + 1.0,         level: 'ok',   text: '[OK] w = −1.000 · the arrow holds · no appointed hour' },
    { t: FLEET.t0 + 0.9,         level: 'crit', text: 'Massed Discord signatures inbound · everything they have left' },
    { t: FLEET.t0 + 8.2,         level: 'discord', text: 'THE PAST IS LOST · THE FUTURE UNCERTAIN' },
    { t: FLEET.t0 + 16.4,        level: 'ok',   text: '[OK] All fleets: weapons free · her word given' },
  ],
  readout: {
    id: 'Aeonic Monitor · Model Ω',
    rows: [
      { label: 'Aeon', value: (t) => { const s = segAt(t); return s.kind === 'arrow' || s.kind === 'fleet' ? '+1 · OPEN' : s.kind === 'shatter' ? '—' : s.final ? '+1' : ['−2', '−1', '0'][s.cycle] } },
      { label: 'Flow', value: (t) => { const s = segAt(t); return s.kind === 'rev' ? 'RETURNING' : s.kind === 'card' ? 'GATHERED' : s.kind === 'dark' ? 'ORIGIN' : s.kind === 'shatter' ? 'UNBOUND' : 'FORWARD' } },
      { label: 'w',    value: (t) => (t < SHATTER.t0 + CRACK_T ? '−1.06' : '−1.000') },
    ],
  },
  bloom: 0.75,
  create(ctx) {
    const { scene, camera, fx, sfx, comms, end, backdrop, track, mount } = ctx
    const score = makeEschatonScore()
    if (score) { track(score); score.start(); score.setDrone(32.7, 160, 0.2, 0.07) }

    // an opaque void: the model runs against blackness, the whole sky built
    // deterministically below. The dome lifts when the fleet comes — normal
    // space (the stock nebula and stars every cutscene shares) returns with it.
    backdrop.starMat.opacity = 0
    const voidMat = new THREE.MeshBasicMaterial({ color: 0x000000, side: THREE.BackSide })
    const voidDome = new THREE.Mesh(new THREE.SphereGeometry(520, 16, 16), voidMat)
    scene.add(voidDome)

    // ── the universe, as a pure function of its age U ────────────────────────
    // Nothing in here accumulates: every position, scale and opacity is set
    // from U each frame, so running U backwards is the collapse, exactly.
    const spaceSet = new THREE.Group(); scene.add(spaceSet)
    const glowCv = document.createElement('canvas'); glowCv.width = 64; glowCv.height = 64
    const gg = glowCv.getContext('2d')
    const grad = gg.createRadialGradient(32, 32, 0, 32, 32, 32)
    grad.addColorStop(0, 'rgba(255,255,255,1)'); grad.addColorStop(0.4, 'rgba(255,255,255,0.45)'); grad.addColorStop(1, 'rgba(255,255,255,0)')
    gg.fillStyle = grad; gg.fillRect(0, 0, 64, 64)
    const glowTex = new THREE.CanvasTexture(glowCv)
    track({ dispose: () => glowTex.dispose() })

    const seedMat = new THREE.MeshBasicMaterial({ color: 0xfff6da, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false })
    const seed = new THREE.Mesh(fx.blastGeo, seedMat); spaceSet.add(seed)
    const fireMat = new THREE.MeshBasicMaterial({ color: 0xfff2d8, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false })
    const fireball = new THREE.Mesh(fx.blastGeo, fireMat); fireball.visible = false; spaceSet.add(fireball)
    const shockMat = new THREE.MeshBasicMaterial({ color: 0xfff0d0, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })
    const shock = new THREE.Mesh(fx.ringGeo, shockMat); shock.visible = false; spaceSet.add(shock)

    // matter shells — fixed directions and speeds, radius purely from U
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
      return { mat, pts, set(rf) {
        const a = geo.attributes.position.array
        for (let i = 0; i < count; i++) { const r = speeds[i] * rf; a[i * 3] = dirs[i * 3] * r; a[i * 3 + 1] = dirs[i * 3 + 1] * r; a[i * 3 + 2] = dirs[i * 3 + 2] * r }
        geo.attributes.position.needsUpdate = true
      } }
    }
    const bursts = [
      makeBurst(500, 0xfff1cf, 0.9, 14, 40),
      makeBurst(400, 0xffb469, 1.1, 9, 27),
      makeBurst(320, 0xff6a48, 1.3, 4, 15),
    ]

    // hero stars — ignition age on the U clock, so the collapse snuffs them
    const STARS = [
      { pos: [16, 6, -8],   radius: 4.2, color: 0xffa347, ig: 3.4 },
      { pos: [-22, -5, 12], radius: 3.0, color: 0x9fc4ff, hot: 0xf2f6ff, ig: 4.4 },
    ]
    const stars = STARS.map((s) => {
      const g = new THREE.Group()
      const tick = makeStar(g, [], new THREE.Vector3(), { radius: s.radius, color: s.color, hot: s.hot ?? 0xfff3d8, light: 1.5 })
      g.position.fromArray(s.pos); g.visible = false; spaceSet.add(g)
      return { g, tick, base: new THREE.Vector3().fromArray(s.pos), ig: s.ig }
    })

    // galaxies — glow and expansion purely from U; their spin clock IS U, so
    // the reverse literally unwinds the arms
    const GALS = [
      { pos: [-32, 10, -28], radius: 9,  arms: 2, twist:  4.8, core: '#ffe2b8', arm: '#7fa8ff' },
      { pos: [25, -7, -42],  radius: 8,  arms: 3, twist: -4.2, core: '#ffd9a0', arm: '#ff9a5a' },
      { pos: [42, 14, 4],    radius: 8,  arms: 2, twist:  5.6, core: '#fff2c8', arm: '#63e0c0' },
      { pos: [-44, -12, 12], radius: 7,  arms: 4, twist:  4.0, core: '#ffc8ee', arm: '#c86bff' },
      { pos: [4, 20, -48],   radius: 10, arms: 2, twist:  4.6, core: '#ffe2b8', arm: '#86b4ff' },
    ]
    const galaxies = GALS.map((s, i) => {
      const g = new THREE.Group()
      const tick = makeGalaxy(g, [], new THREE.Vector3(), {
        radius: s.radius, maxRadius: s.radius, arms: s.arms, twist: s.twist, glow: 0, spin: 1.2,
        coreCol: s.core, armCol: s.arm,
        normal: new THREE.Vector3(Math.sin(i * 2.1) * 0.7, 1, Math.cos(i * 1.7) * 0.7).normalize(),
      })
      g.position.fromArray(s.pos); g.visible = false; spaceSet.add(g)
      return { g, tick, base: new THREE.Vector3().fromArray(s.pos), delay: 3.2 + i * 0.35, glow: 0.9 + (i % 3) * 0.15 }
    })

    // deep field + first stars — the wider sky, born with structure
    const distField = []
    const edgePos = (i, spread) => {
      const ang = i * 2.399 + spread
      const edge = 56 + ((i * 0.618) % 1) * 66
      const depth = -18 - ((i * 0.313) % 1) * 110
      return new THREE.Vector3(Math.cos(ang) * edge, Math.sin(ang) * edge * 0.72, depth)
    }
    const DIST_GAL_COL = [0xc8d6ff, 0xffe6c4, 0xf2eeff, 0xffd6b0, 0xd6c8ff]
    const DIST_STAR_COL = [0xfff2d8, 0xdfeaff, 0xffd9a0, 0xffffff, 0xbfe0ff]
    for (let i = 0; i < 22; i++) {
      const g = buildSimpleGalaxy({ color: DIST_GAL_COL[i % 5], size: 5 + ((i * 0.5) % 1) * 6, variant: i % 3, tilt: 0.32 + ((i * 0.27) % 1) * 0.5, rotation: i * 1.1 })
      g.visible = false; g.position.copy(edgePos(i, 0.3)); spaceSet.add(g)
      distField.push({ spr: g, mat: g.material, base: g.position.clone(), peak: 0.4 + (i % 3) * 0.12, born: 2.6 + i * 0.07 })
    }
    for (let i = 0; i < 40; i++) {
      const st = buildSimpleStar({ color: DIST_STAR_COL[i % 5], size: 1.4 + ((i * 0.37) % 1) * 2.4 })
      st.visible = false; st.position.copy(edgePos(i + 100, 0.8)); spaceSet.add(st)
      distField.push({ spr: st, mat: st.material, base: st.position.clone(), peak: 0.5 + (i % 4) * 0.09, born: 2.3 + i * 0.045 })
    }
    // an all-sky shell besides the edge crowd, so the sky holds up whichever
    // way the war rig looks once the fleet comes
    for (let i = 0; i < 60; i++) {
      const th = i * 2.399 + 0.7, ph = Math.acos(2 * ((i * 0.618 + 0.11) % 1) - 1)
      const r = 150 + ((i * 0.313) % 1) * 160
      const st = buildSimpleStar({ color: DIST_STAR_COL[(i + 2) % 5], size: 1.6 + ((i * 0.41) % 1) * 2.6 })
      st.visible = false
      st.position.set(r * Math.sin(ph) * Math.cos(th), r * Math.sin(ph) * Math.sin(th), r * Math.cos(ph))
      spaceSet.add(st)
      distField.push({ spr: st, mat: st.material, base: st.position.clone(), peak: 0.5 + (i % 4) * 0.1, born: 2.5 + i * 0.03 })
    }
    const FS_N = 140, fsPos = new Float32Array(FS_N * 3)
    for (let i = 0; i < FS_N; i++) {
      const th = i * 2.399 + 1.3, ph = Math.acos(2 * ((i * 0.618 + 0.31) % 1) - 1)
      const r = 12 + ((i * 0.377) % 1) * 42
      fsPos[i * 3] = r * Math.sin(ph) * Math.cos(th); fsPos[i * 3 + 1] = r * Math.sin(ph) * Math.sin(th); fsPos[i * 3 + 2] = r * Math.cos(ph)
    }
    const fsGeo = new THREE.BufferGeometry(); fsGeo.setAttribute('position', new THREE.BufferAttribute(fsPos, 3))
    const fsMat = new THREE.PointsMaterial({ color: 0xdfeaff, size: 1.1, map: glowTex, sizeAttenuation: true, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false })
    const firstStars = new THREE.Points(fsGeo, fsMat); firstStars.frustumCulled = false; spaceSet.add(firstStars)

    const exOf = (u) => 1 + Math.pow(clamp01((u - 4.5) / 5.5), 2) * 1.35
    const setUniverse = (u) => {
      const tb = u - BANG_U
      seed.visible = u < BANG_U
      if (seed.visible) seed.scale.setScalar(0.22 + Math.sin(u * 22) * 0.05)
      fireball.visible = tb > 0 && tb < 0.8
      if (fireball.visible) { fireball.scale.setScalar(0.5 + tb * 30); fireMat.opacity = 0.95 * (1 - tb / 0.8) }
      shock.visible = tb > 0 && tb < 1.5
      if (shock.visible) { shock.scale.setScalar(1 + tb * 40); shock.lookAt(camera.position); shockMat.opacity = 0.85 * (1 - tb / 1.5) }
      const rf = tb > 0 ? Math.pow(tb, 0.62) * 2.1 : 0
      const mfade = tb > 0 ? clamp01(tb / 0.12) * (1 - clamp01((u - 6) / 2.8)) : 0
      for (const b of bursts) {
        b.pts.visible = mfade > 0
        if (mfade > 0) { b.set(rf); b.mat.opacity = 0.95 * mfade }
      }
      const ex = exOf(u)
      for (const st of stars) {
        st.g.visible = u > st.ig
        if (st.g.visible) {
          st.g.scale.setScalar(0.001 + 0.999 * easeOut3(clamp01((u - st.ig) / 1.0)))
          st.g.position.copy(st.base).multiplyScalar(ex)
          st.tick(u * 2)
        }
      }
      for (const gal of galaxies) {
        gal.g.visible = u > 2.6
        if (!gal.g.visible) continue
        gal.tick.uniforms.uGlow.value = gal.glow * clamp01((u - gal.delay) / 1.6)
        gal.tick(u * 1.5)
        gal.g.position.copy(gal.base).multiplyScalar(ex)
      }
      for (const d of distField) {
        const vis = clamp01((u - d.born) / 1.6)
        d.spr.visible = vis > 0
        if (vis > 0) { d.mat.opacity = d.peak * vis; d.spr.position.copy(d.base).multiplyScalar(ex) }
      }
      fsMat.opacity = clamp01((u - 2.4) / 2) * (0.68 + 0.32 * Math.sin(u * 8))
    }

    // ── the diagram layer — DOM above the bloom, the Logos projection's home ──
    const overlay = document.createElement('div')
    overlay.style.cssText = 'position:absolute;inset:0;z-index:4;pointer-events:none'
    const cv = document.createElement('canvas'); cv.width = 1500; cv.height = 880
    cv.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;object-fit:contain'
    const wash = document.createElement('div')
    wash.style.cssText = 'position:absolute;inset:0;background:#fff;opacity:0'
    overlay.append(cv, wash)
    mount.appendChild(overlay)
    track({ dispose: () => overlay.remove() })
    const c2d = cv.getContext('2d')
    let washT = 9, washPeak = 1, washDur = 0.5
    const fireWash = (peak, dur) => { washT = 0; washPeak = peak; washDur = dur }

    // ── the last stand — everything the Discord has left ─────────────────────
    // Normal space for the confrontation: the model's sky steps aside, and one
    // sun hangs behind the approach — the fleet comes on out of its glare.
    const warSun = new THREE.Group()
    const warSunTick = makeStar(warSun, [], new THREE.Vector3(), { radius: 18, color: 0xffb45c, light: 2.2 })
    warSun.position.set(-320, 62, -170); warSun.visible = false; scene.add(warSun)
    const fleet = buildFleet(ctx, { team: 'red', fighters: 64, bombers: 10, cruisers: 8, ringR: 26 })
    fleet.group.position.set(-330, -6, -30)
    fleet.group.visible = false
    for (const sh of fleet.ships) sh.visible = false
    // warp-in order: escorts first in a shuffled storm, the capital dead last
    const revealOrder = fleet.ships.slice(1).sort(() => Math.random() - 0.5)
    const redGlow = new THREE.PointLight(0xff3a2a, 0, 1200); scene.add(redGlow)
    const _w = new THREE.Vector3()

    const _p = new THREE.Vector3(), _l = new THREE.Vector3(), _fc = new THREE.Vector3()
    let T = 0, A = 0, si = 0, U = 0, prevU = 0
    let cardA = 0, cardKind = 'card', cardCycle = 0, cardLocal = 0
    let cL1 = false, cL2 = false, cE1 = false, cE2 = false, cP1 = false, cP2 = false, ended = false
    let crashFired = false, chordFired = false, revealed = 0, capIn = false, pulseCd = 0
    // segment-entry actions, fired once as the clock crosses each boundary
    const enter = (s) => {
      if (s.kind === 'card') { score?.bell(); score?.setDrone(ROOTS[s.cycle], 260 + s.cycle * 120, 0.4) }
      else if (s.kind === 'rev') { score?.riser(s.dur); score?.setDrone(ROOTS[s.cycle] * 0.5, 170, s.dur) }
      else if (s.kind === 'fwd') score?.setDrone(s.final ? 73.42 : ROOTS[s.cycle], s.final ? 700 : 300 + s.cycle * 140, 0.5)
      else if (s.kind === 'shatter') { score?.bell(); score?.setDrone(73.42, 500, 0.4, 0.06) }
      else if (s.kind === 'arrow') score?.setDrone(36.71, 240, 1.2, 0.08)
      else if (s.kind === 'fleet') {
        fireWash(0.7, 0.5)
        // back to normal space: the model's sky steps aside for the stock
        // nebula and stars, a sun, and everything the Discord has left
        voidDome.visible = false
        spaceSet.visible = false
        warSun.visible = true
        fleet.group.visible = true
        score?.setDrone(36.71, 200, 2.0, 0.1)
        sfx.rumble(0.4, 2.2)
      }
    }

    return (dt) => {
      T += dt; A += dt
      while (si < SEGS.length - 1 && T >= SEGS[si].t0 + SEGS[si].dur) { si++; enter(SEGS[si]) }
      const seg = SEGS[si]
      const local = T - seg.t0

      // U — forward, held, or run back down; the collapse accelerates as it falls
      prevU = U
      if (seg.kind === 'fwd') U = U_END * clamp01(local / seg.dur)
      else if (seg.kind === 'rev') U = U_END * (1 - Math.pow(clamp01(local / seg.dur), 1.25))
      else if (seg.kind === 'dark') U = 0
      else U = U_END   // card / shatter / arrow / fleet hold the formed sky

      // crossings on the U clock fire in either direction: the bang, the
      // un-bang, and every stellar ignition (or snuffing)
      if (prevU < BANG_U && U >= BANG_U) {
        fireWash(1, 0.5)
        playTitleBoom(seg.final ? 1.15 : 0.55 + 0.06 * (seg.cycle ?? 0))
        sfx.rumble(0.45, 1.8)
      } else if (prevU >= BANG_U && U < BANG_U && seg.kind === 'rev') {
        fireWash(0.5, 0.32)
        score?.thud()
      }
      if (seg.kind !== 'fleet') {
        for (const st of stars) {
          if ((prevU < st.ig) !== (U < st.ig)) fx.blast(_l.copy(st.base).multiplyScalar(exOf(U)), true, { silent: true })
        }
        setUniverse(U)
      }

      // camera: a slow ceremonial pull-back keyed to the universe's age, with a
      // birth tremor riding each bang — then the war rig once the fleet comes
      if (seg.kind !== 'fleet') {
        const k = U / U_END
        _p.set(0, 3.5 + 2.5 * k, 44 + 14 * k)
        if (U > BANG_U && U < 3) {
          const sh = Math.exp(-(U - BANG_U) * 1.6) * 0.8
          _p.x += (Math.random() - 0.5) * sh; _p.y += (Math.random() - 0.5) * sh
        }
        camera.position.copy(_p)
        camera.lookAt(ORIGIN)
      } else {
        // normal space breathes back in behind the wash, and the sun simmers
        backdrop.starMat.opacity = 0.85 * clamp01(local / 2.5)
        warSunTick(T)
        // they cross the whole of it to reach us
        fleet.group.position.x += 15 * dt
        _fc.copy(fleet.group.position)
        const ck = easeInOut(clamp01(local / 16))
        _p.set(22 - 14 * ck, 9 + 3 * ck, 68 - 12 * ck)
        camera.position.copy(_p)
        _l.copy(_fc); _l.x += 60 * (1 - ck)   // lead the mass, then meet it head-on
        camera.lookAt(_l)
        // the armada arrives in waves — escorts in a warp storm, then the crown
        const want = Math.floor(clamp01(local / 3.0) * revealOrder.length)
        while (revealed < want) {
          const sh = revealOrder[revealed++]
          sh.visible = true
          sh.getWorldPosition(_w); fx.blast(_w, revealed % 4 === 0, { silent: true })   // every 4th flares big — the storm reads at range
          if (revealed % 6 === 1) sfx.jump()
        }
        if (!capIn && local >= 3.4) {
          capIn = true
          fleet.ships[0].visible = true
          fleet.ships[0].getWorldPosition(_w); fx.blast(_w, true, { silent: true })
          sfx.jump(); sfx.rumble(0.6, 1.6)
        }
        redGlow.position.copy(_fc); redGlow.position.x += 30
        redGlow.intensity = 4 * clamp01(local / 5)
        pulseCd -= dt
        if (pulseCd <= 0 && local > 2) { pulseCd = 1.55; score?.pulse(0.5 + 0.5 * clamp01(local / 14)) }
      }

      // the diagram card: fades toward presence whenever a card segment holds
      const wantCard = seg.kind === 'card' || seg.kind === 'shatter' || seg.kind === 'arrow'
      if (wantCard) { cardKind = seg.kind; cardCycle = seg.cycle ?? 0; cardLocal = local }
      cardA = clamp01(cardA + (wantCard ? dt : -dt) / 0.33)
      drawCard(c2d, cardKind, cardCycle, cardLocal, A, cardA)
      if (seg.kind === 'shatter' && !crashFired && local >= CRACK_T) {
        crashFired = true
        score?.crash(); sfx.explosion(true); sfx.rumble(0.9, 2.4)
        fireWash(0.65, 0.45)
      }
      if (seg.kind === 'arrow' && !chordFired && local >= 0.7) { chordFired = true; score?.chord() }

      washT += dt
      wash.style.opacity = String(Math.max(0, washPeak * (1 - washT / washDur)))

      // the words — the Engine frames the model, then the enemy, then Her Grace
      if (!cL1 && T >= 2.4) { cL1 = true; comms.show('Litania Magna', LINE_LIT1) }
      if (!cL2 && T >= FINAL_FWD.t0 + 0.7) { cL2 = true; comms.show('Litania Magna', LINE_LIT2) }
      if (!cE1 && T >= FLEET.t0 + 1.4) { cE1 = true; comms.show('The Discord', LINE_E1, { team: 'red' }) }
      if (!cE2 && T >= FLEET.t0 + 6.8) { cE2 = true; comms.show('The Discord', LINE_E2, { team: 'red' }) }
      if (!cP1 && T >= FLEET.t0 + 12.2) { cP1 = true; comms.show('Princess Astraia', LINE_P1) }
      if (!cP2 && T >= FLEET.t0 + 18.0) { cP2 = true; comms.show('Princess Astraia', LINE_P2, { persist: true }) }
      if (!ended && T >= FLEET.t0 + 20.6) { ended = true; end({ holdMs: 900 }) }
    }
  },
}
