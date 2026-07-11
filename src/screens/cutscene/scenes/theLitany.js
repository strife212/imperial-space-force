import * as THREE from 'three'
import { makeMachinePlanet, makeEarthlike, buildBlueModel } from '../../battle/geometry'
import { buildRelay } from '../models'

// The Ecumenologion — the World Engine, Litania Magna — computes the silence,
// raises a simulated projection of what the Aleph is and what it will do, and
// names the one instrument the Order has never used. The Empress's craft steals
// in to commune.
const LINE1 = 'I have modelled the silence. It propagates. The Song fails in ninety days.'
const LINE1B = 'I shall show you a visualisation that you may better understand.'
const LINE_EMP1 = 'Then time has recurred forever? Aeon upon aeon, and we merely the latest. Is it right, that we should stop such a thing?'
const LINE2 = 'There is one instrument the Order has never used. The prophecy names it. So do I.'
const LINE_LANCE = 'The Divine Lance...'
const LINE3 = 'Then it is to be in my reign. I had hoped otherwise.'
// the projection's narration — the Engine explaining the mechanism
const PROJ1 = 'Figure alpha: time as we thought it was. The arrow runs out of the first moment and never turns. This is the shape of the Song.'
const PROJ2 = 'Figure omega: the same flow — but the Aleph has ridden it since the dawn of time. A Cauchy reliquary, posted from the aeon before ours, waiting for its appointed hour.'
const PROJ3_SEGS = [
  { text: 'When it activates, it drives w beneath −1. The universe as we know it is unmade — the flow gathered back to the origin. ' },
  { text: 'The eternal return.', cls: 'sb-comms-em--red' },
]
const PROJ3 = PROJ3_SEGS.map((s) => s.text).join('')
const PROJ4 = 'Nothing burns. The signature rotates: time becomes space, the world a timeless block — and the next aeon takes its axis from ours. Perhaps pointing back through it.'
const PROJ5 = 'The model is complete. This is what the silence intends. You have seen what I have seen.'
// each step: its explanation is read first; NEXT plays the animation up to
// animTo; the next explanation only appears once the animation is done. The
// final step has no animation — NEXT closes the simulation.
const PROJ_STEPS = [
  { text: PROJ1, animTo: 4.6 },
  { text: PROJ2, animTo: 8.4 },
  { text: PROJ3, segments: PROJ3_SEGS, animTo: 13.6 },
  { text: PROJ4, animTo: 18.9 },
  { text: PROJ5 },
]
const TYPE_CPS = 55   // dialogue typewriter speed, chars/sec

// ── The simulated projection ─────────────────────────────────────────────────
// A near-fullscreen DOM overlay (above the stage, outside the bloom pass) with
// an animated canvas diagram: this aeon's arrow of time running out of the
// bang, then the Aleph posting the arrow home across the crossover, then the
// signature rotating time into space. Holds on REPLAY / CONTINUE at the end.
const MONO = '"Cascadia Mono", "Consolas", ui-monospace, "Menlo", "Monaco", monospace'
const INKC = (a) => `rgba(148,214,255,${a})`
const clamp01 = (v) => Math.max(0, Math.min(1, v))
const sstep = (v) => { const k = clamp01(v); return k * k * (3 - 2 * k) }

// P drives the staged animations (frozen while a line is being read);
// A is the ambient clock — flicker and ripples never stop breathing.
function drawProjection(c, P, A) {
  c.setTransform(1800 / 1500, 0, 0, 1056 / 880, 0, 0)
  c.clearRect(0, 0, 1500, 880)

  // panel: near-solid glass, hairline border, corner brackets, scanlines
  c.fillStyle = 'rgba(5,12,20,0.97)'; c.fillRect(20, 20, 1460, 840)
  c.strokeStyle = INKC(0.5); c.lineWidth = 2; c.strokeRect(20, 20, 1460, 840)
  c.fillStyle = INKC(0.022)
  for (let y = 24; y < 856; y += 4) c.fillRect(22, y, 1456, 1)
  c.strokeStyle = INKC(0.95); c.lineWidth = 3
  for (const [bx, by, sx, sy] of [[20, 20, 1, 1], [1480, 20, -1, 1], [20, 860, 1, -1], [1480, 860, -1, -1]]) {
    c.beginPath(); c.moveTo(bx + sx * 34, by); c.lineTo(bx, by); c.lineTo(bx, by + sy * 34); c.stroke()
  }

  // header
  c.font = `700 34px ${MONO}`; c.fillStyle = 'rgba(214,240,255,0.95)'
  c.fillText('◆ SIMULATED PROJECTION', 56, 76)
  c.font = `500 17px ${MONO}`; c.fillStyle = INKC(0.55)
  c.fillText('AEONIC CONTINUATION · CONFORMAL CROSSOVER · MODEL Ω', 56, 104)
  c.textAlign = 'right'
  c.fillStyle = INKC(0.55); c.fillText('ECUMENOLOGION · LITANIA MAGNA', 1444, 76)
  c.fillStyle = INKC(0.38); c.fillText('SUBSTRATE LOAD 96.2% · CLR-Ω', 1444, 104)
  c.textAlign = 'left'
  c.strokeStyle = INKC(0.4); c.lineWidth = 1
  c.beginPath(); c.moveTo(44, 124); c.lineTo(1456, 124); c.stroke()

  const panelBox = (x, y, w, h, label) => {
    c.strokeStyle = INKC(0.28); c.lineWidth = 1; c.strokeRect(x, y, w, h)
    c.fillStyle = INKC(0.04); c.fillRect(x, y, w, h)
    c.font = `500 16px ${MONO}`; c.fillStyle = INKC(0.6); c.fillText(label, x + 14, y + 26)
  }
  const arrowHead = (x, y, dx, color) => {
    c.fillStyle = color; c.beginPath()
    c.moveTo(x + dx * 15, y); c.lineTo(x, y - 8); c.lineTo(x, y + 8); c.closePath(); c.fill()
  }
  const bang = (x, y, dim) => {
    c.strokeStyle = dim ? 'rgba(255,220,150,0.45)' : 'rgba(255,232,170,0.9)'
    c.lineWidth = 2
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2 + 0.26
      const L = (14 + (i % 3) * 9) * (0.85 + 0.15 * Math.sin(A * 7 + i * 1.7))
      c.beginPath(); c.moveTo(x + Math.cos(a) * 8, y + Math.sin(a) * 8); c.lineTo(x + Math.cos(a) * (8 + L), y + Math.sin(a) * (8 + L)); c.stroke()
    }
    c.fillStyle = dim ? 'rgba(255,240,200,0.6)' : 'rgba(255,246,220,0.98)'
    c.beginPath(); c.arc(x, y, 7, 0, Math.PI * 2); c.fill()
  }

  // ── FIG α: time as we thought it was — the bang, the expansion, the arrow ──
  panelBox(56, 148, 1388, 288, 'FIG. α · TIME AS WE THOUGHT IT WAS · THE UNBROKEN FLOW')
  bang(200, 296, false)
  for (let k = 0; k < 3; k++) {
    const rr = (A * 30 + k * 46) % 138
    if (rr > 10) { c.strokeStyle = `rgba(148,214,255,${0.3 * (1 - rr / 138)})`; c.lineWidth = 1.4; c.beginPath(); c.arc(200, 296, rr, -1.1, 1.1); c.stroke() }
  }
  c.font = `500 14px ${MONO}`; c.fillStyle = INKC(0.45); c.fillText('ORIGIN', 174, 396)
  const a1 = 1 - Math.pow(1 - clamp01((P - 0.6) / 3.4), 3)
  if (a1 > 0.01) {
    const tip = 250 + 1080 * a1
    c.strokeStyle = 'rgba(148,214,255,0.9)'; c.lineWidth = 3.5
    c.beginPath(); c.moveTo(250, 296); c.lineTo(tip, 296); c.stroke()
    c.lineWidth = 1.6
    for (let x = 385; x < tip - 16; x += 135) { c.beginPath(); c.moveTo(x, 288); c.lineTo(x, 304); c.stroke() }
    arrowHead(tip, 296, 1, 'rgba(190,230,255,0.95)')
    c.font = `600 19px ${MONO}`; c.fillStyle = `rgba(190,230,255,${0.9 * clamp01((a1 - 0.25) * 3)})`
    c.fillText('THE ARROW OF TIME  →  t', 560, 262)
  }

  // ── FIG Ω: the same flow, under the Aleph — interrupted at the appointed
  //    hour, gathered back to the origin: the eternal return ──
  panelBox(56, 462, 1388, 288, 'FIG. Ω · UNDER THE ALEPH · THE FLOW INTERRUPTED')
  bang(200, 615, true)
  c.font = `500 14px ${MONO}`; c.fillStyle = INKC(0.45); c.fillText('POINT OF ORIGIN', 142, 722)
  // the Aleph — riding the flow since the first moment, beside the origin
  const ap = sstep((P - 4.8) / 0.7)
  if (ap > 0.01) {
    c.save()
    c.translate(330, 612); c.scale(0.62 + 0.28 * ap, 0.62 + 0.28 * ap)
    c.globalAlpha = ap
    c.shadowColor = 'rgba(255,190,80,0.8)'; c.shadowBlur = 22
    c.strokeStyle = '#ffcf5a'; c.lineWidth = 3.4
    c.beginPath(); c.moveTo(-22, 40); c.lineTo(-22, -14); c.arc(0, -14, 22, Math.PI, 0); c.lineTo(22, 40); c.closePath(); c.stroke()
    c.beginPath(); c.arc(0, -10, 8.5, 0, Math.PI * 2); c.stroke()
    c.fillStyle = '#fff0c4'; c.beginPath(); c.arc(0, -10, 3.4, 0, Math.PI * 2); c.fill()
    c.restore()
    c.font = `600 16px ${MONO}`; c.fillStyle = `rgba(255,207,90,${ap})`
    c.fillText('THE ALEPH · SINCE THE FIRST MOMENT', 258, 514)
  }
  // the flow runs on as it should — until the appointed hour
  const af = 1 - Math.pow(1 - clamp01((P - 6.2) / 2.2), 3)
  if (af > 0.01) {
    const tip = 262 + 868 * af
    c.strokeStyle = 'rgba(148,214,255,0.9)'; c.lineWidth = 3.2
    c.beginPath(); c.moveTo(262, 560); c.lineTo(tip, 560); c.stroke()
    c.lineWidth = 1.5
    for (let x = 400; x < tip - 16; x += 135) { c.beginPath(); c.moveTo(x, 553); c.lineTo(x, 567); c.stroke() }
    if (P < 8.8) arrowHead(tip, 560, 1, 'rgba(190,230,255,0.95)')
  }
  // the appointed hour: the flow is cut dead
  const ah = clamp01((P - 8.6) / 0.4)
  if (ah > 0.01) {
    c.setLineDash([6, 6]); c.strokeStyle = `rgba(255,207,90,${0.75 * ah})`; c.lineWidth = 2
    c.beginPath(); c.moveTo(1130, 508); c.lineTo(1130, 712); c.stroke(); c.setLineDash([])
    c.textAlign = 'center'
    c.font = `600 15px ${MONO}`; c.fillStyle = `rgba(255,207,90,${0.85 * ah})`
    c.fillText('THE APPOINTED HOUR', 1130, 496)
    c.textAlign = 'left'
    // the break: a red cross where the arrow dies
    const bf = clamp01((P - 8.8) / 0.5)
    if (bf > 0.01) {
      c.strokeStyle = `rgba(255,90,74,${0.95 * bf})`; c.lineWidth = 3.4
      c.beginPath(); c.moveTo(1119, 549); c.lineTo(1141, 571); c.moveTo(1141, 549); c.lineTo(1119, 571); c.stroke()
      const ring = clamp01((P - 8.8) / 0.9)
      if (ring < 1) { c.strokeStyle = `rgba(255,120,90,${0.7 * (1 - ring)})`; c.lineWidth = 2; c.beginPath(); c.arc(1130, 560, 8 + ring * 52, 0, Math.PI * 2); c.stroke() }
    }
  }
  // and beneath it, the return: the flow driven back to the origin
  const a2 = sstep((P - 9.6) / 3.8)
  if (a2 > 0.01) {
    const tip = 1130 - 866 * a2
    c.strokeStyle = 'rgba(255,90,74,0.9)'; c.lineWidth = 3.5
    c.beginPath(); c.moveTo(1130, 668); c.lineTo(tip, 668); c.stroke()
    arrowHead(tip, 668, -1, 'rgba(255,140,110,0.95)')
    c.textAlign = 'center'
    c.font = `700 19px ${MONO}`; c.fillStyle = `rgba(255,90,74,${0.95 * clamp01((a2 - 0.2) * 3)})`
    c.fillText('w < −1 · THE ETERNAL RETURN', 700, 704)
    c.textAlign = 'left'
  }
  // signature rotation: t rotates into space; the block freezes
  const gb = clamp01((P - 13.8) / 1.4)
  if (gb > 0.01) {
    const cx = 1290, cy = 600
    c.strokeStyle = `rgba(148,214,255,${0.2 * gb})`; c.lineWidth = 1
    for (let i = 0; i <= 5; i++) {
      c.beginPath(); c.moveTo(cx - 70 + i * 28, cy - 70); c.lineTo(cx - 70 + i * 28, cy + 70); c.stroke()
      c.beginPath(); c.moveTo(cx - 70, cy - 70 + i * 28); c.lineTo(cx + 70, cy - 70 + i * 28); c.stroke()
    }
    c.strokeStyle = `rgba(148,214,255,${0.7 * gb})`; c.lineWidth = 2
    c.beginPath(); c.moveTo(cx - 78, cy); c.lineTo(cx + 78, cy); c.stroke()
    c.font = `500 15px ${MONO}`; c.fillStyle = INKC(0.6 * gb); c.fillText('x', cx + 84, cy + 5)
    const rot = (Math.PI / 2) * sstep((P - 15.4) / 3.2)
    const tx = cx + Math.sin(rot) * 74, ty = cy - Math.cos(rot) * 74
    c.strokeStyle = `rgba(255,207,90,${0.9 * gb})`; c.lineWidth = 3
    c.beginPath(); c.moveTo(cx, cy); c.lineTo(tx, ty); c.stroke()
    c.fillStyle = `rgba(255,224,150,${gb})`; c.beginPath(); c.arc(tx, ty, 5, 0, Math.PI * 2); c.fill()
    c.font = `600 16px ${MONO}`; c.fillText('t', tx + 10, ty + 5)
    c.setLineDash([3, 5]); c.strokeStyle = `rgba(255,207,90,${0.35 * gb})`; c.lineWidth = 1.4
    c.beginPath(); c.arc(cx, cy, 58, -Math.PI / 2, rot - Math.PI / 2); c.stroke(); c.setLineDash([])
    c.font = `500 14px ${MONO}`; c.fillStyle = INKC(0.5 * gb)
    c.fillText('SIGNATURE ROTATION', 1214, 708)
    c.fillText('TIME → SPACE · TIMELESS BLOCK', 1178, 728)
  }

}

function makeLogosProjection({ track }, { onStart, onAdvance, onContinue } = {}) {
  const wrap = document.createElement('div'); wrap.className = 'logos-proj-wrap'
  const panel = document.createElement('div'); panel.className = 'logos-proj'
  const cv = document.createElement('canvas'); cv.width = 1800; cv.height = 1056
  const startBtn = document.createElement('button')
  startBtn.className = 'logos-proj-btn logos-proj-btn--go logos-proj-start'
  startBtn.textContent = '▶ START SIMULATION'
  // the simulation's own dialogue: the Engine's line reads first, and the
  // glowing NEXT plays the animation it just explained
  const dlg = document.createElement('div'); dlg.className = 'logos-dlg'
  const dlgName = document.createElement('div'); dlgName.className = 'logos-dlg-name'; dlgName.textContent = 'LITANIA MAGNA'
  const dlgText = document.createElement('div'); dlgText.className = 'logos-dlg-text'
  const nextBtn = document.createElement('button'); nextBtn.className = 'logos-proj-btn logos-proj-btn--go logos-dlg-next'; nextBtn.textContent = 'NEXT ▸'
  dlg.append(dlgName, dlgText, nextBtn)
  panel.append(cv, startBtn, dlg); wrap.appendChild(panel)
  // mount beside the comms box (same stacking world), so dialogue layering
  // stays deterministic
  const host = document.querySelector('#cutscene-screen .sb-stage') || document.body
  host.appendChild(wrap)
  const c2d = cv.getContext('2d')

  // mode: 'idle' (awaiting START) → 'read' (line typing, then NEXT) →
  // 'anim' (P runs to the step's animTo) → … → close on the final NEXT
  const state = { shown: false, closed: false, P: 0 }
  let mode = 'idle', stepIdx = -1, typeT = 0, ambient = 0, nextShown = false, lastChars = -1
  const lineLen = () => PROJ_STEPS[stepIdx].text.length

  const renderLine = (chars) => {
    const step = PROJ_STEPS[stepIdx]
    const segs = step.segments || [{ text: step.text }]
    dlgText.textContent = ''
    let remaining = chars
    for (const seg of segs) {
      if (remaining <= 0) break
      const shown = seg.text.slice(0, remaining)
      remaining -= shown.length
      const span = document.createElement('span')
      if (seg.cls) span.className = seg.cls
      span.textContent = shown
      dlgText.appendChild(span)
    }
    const cur = document.createElement('span'); cur.className = 'logos-dlg-cursor'; cur.textContent = '▋'
    dlgText.appendChild(cur)
  }
  const present = (i) => {
    stepIdx = i; typeT = 0; mode = 'read'; lastChars = -1
    nextShown = false; nextBtn.classList.remove('is-ready')
    dlg.classList.add('is-on')
    renderLine(0)
  }

  startBtn.addEventListener('click', () => {
    if (mode !== 'idle' || state.closed) return
    startBtn.remove()
    present(0)
    onStart?.()
  })
  nextBtn.addEventListener('click', () => {
    if (mode !== 'read' || !nextShown || state.closed) return
    const step = PROJ_STEPS[stepIdx]
    if (step.animTo != null) {
      mode = 'anim'
      nextShown = false; nextBtn.classList.remove('is-ready')
      onAdvance?.()
    } else {
      state.closed = true
      panel.classList.remove('is-on')
      setTimeout(() => { wrap.style.display = 'none' }, 550)
      onContinue?.()
    }
  })
  track({ dispose: () => wrap.remove() })
  return {
    state,
    show() {
      state.shown = true
      void panel.offsetWidth   // commit initial styles so the transition runs
      panel.classList.add('is-on')
    },
    tick(dt) {
      if (!state.shown || state.closed) return
      ambient += dt
      if (mode === 'anim') {
        state.P += dt
        if (state.P >= PROJ_STEPS[stepIdx].animTo) present(stepIdx + 1)
      } else if (mode === 'read') {
        typeT += dt
        const chars = Math.min(lineLen(), Math.floor(typeT * TYPE_CPS))
        if (chars !== lastChars) { lastChars = chars; renderLine(chars) }
        const done = chars >= lineLen()
        if (done !== nextShown) { nextShown = done; nextBtn.classList.toggle('is-ready', done) }
      }
      drawProjection(c2d, state.P, ambient)
    },
  }
}

export default {
  label: 'CUTSCENE / LOGOS',
  establishing: { name: 'LOGOS', sub: 'Litania Magna · The Great Litany · World Engine', stamp: 'ECUMENOLOGION UPLINK · HER PRIVATE CHANNEL · CLR-Ω' },
  feed: [
    { t: 1.2,  level: 'ok',   text: '[OK] Handshake: Litania Magna · entangled uplink established' },
    { t: 3.6,  level: 'info', text: 'Thought-substrate load 96.2% · liturgical simulations deferred' },
    { t: 9.8,  level: 'info', text: 'Simulated projection raised · aeonic continuation model Ω' },
    { t: 6.5,  level: 'warn', text: 'Model horizon: the Song fails in 90 days · confidence 0.997' },
    { t: 10.0, level: 'info', text: 'One instrument un-used · cross-reference: AUDITIO ULTIMA' },
    { t: 14.8, level: 'warn', text: 'Her Annunciator named · STRATCON review convened' },
  ],
  readout: {
    id: 'Ecumenologion · Litania Magna',
    rows: [
      { label: 'Substrate',  value: (t) => `${(96.2 + Math.sin(t * 0.7) * 1.6).toFixed(1)}%` },
      { label: 'Simulation', value: 'SILENCE MODEL Ω' },
      { label: 'Confidence', value: (t) => `${Math.min(0.999, 0.982 + t * 0.001).toFixed(3)}` },
    ],
  },
  bloom: 0.7,
  create(ctx) {
    const { scene, camera, fx, sfx, comms, end, orient } = ctx
    const engineTick = makeMachinePlanet(scene, [], new THREE.Vector3(0, 0, 0), new THREE.Vector3(0.5, 0.6, 0.4).normalize())   // the World Engine (R≈40)
    const throneTick = makeEarthlike(scene, [], new THREE.Vector3(150, 40, -180), new THREE.Vector3(0.4, 0.5, 0.6).normalize())   // the Throneworld it orbits — the same living world the Cathedra stands on

    // the diadem — orbital rings of solar collectors girdling the Engine
    const ringMat = new THREE.MeshBasicMaterial({ color: 0x6f86ff, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })
    const ring = new THREE.Mesh(new THREE.TorusGeometry(58, 0.8, 8, 120), ringMat); ring.rotation.set(-1.1, 0.4, 0); scene.add(ring)
    const ring2 = new THREE.Mesh(new THREE.TorusGeometry(66, 0.4, 8, 120), ringMat); ring2.rotation.set(-1.0, 0.4, 0); scene.add(ring2)

    // collector platforms riding the diadem
    const satMat = new THREE.MeshStandardMaterial({ color: 0x9fb0d8, emissive: 0x223a66, emissiveIntensity: 0.5, metalness: 0.7, roughness: 0.5 })
    const sats = new THREE.Group(); sats.rotation.set(-1.1, 0.4, 0); scene.add(sats)
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * Math.PI * 2
      const s = new THREE.Mesh(new THREE.BoxGeometry(3, 0.5, 5), satMat)
      s.position.set(Math.cos(a) * 58, Math.sin(a) * 58, 0); s.rotation.z = a; sats.add(s)
    }

    // monitoring relays stationed around the Engine, each winking its watch-light
    const relays = []
    const winkMat = new THREE.MeshBasicMaterial({ color: 0x9fe0ff, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false })
    for (const [x, y, z] of [[64, 18, 30], [-58, -24, 40], [30, 50, -34], [-40, 36, -44], [70, -16, -20]]) {
      const r = buildRelay(); r.position.set(x, y, z); r.scale.setScalar(2.2); r.rotation.set(Math.random() * 6, Math.random() * 6, Math.random() * 6); scene.add(r)
      const wink = new THREE.Mesh(fx.blastGeo, winkMat.clone()); wink.scale.setScalar(0.55); wink.position.set(x, y + 5.5, z); scene.add(wink)
      relays.push({ r, wink, ph: Math.random() * 6 })
    }

    // data pulses racing the diadem — the Litany thinking out loud
    const pulseMat = new THREE.MeshBasicMaterial({ color: 0xbfd2ff, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false })
    const pulses = new THREE.Group(); pulses.rotation.set(-1.1, 0.4, 0); scene.add(pulses)
    const pulseList = []
    for (let i = 0; i < 8; i++) {
      const m = new THREE.Mesh(fx.blastGeo, pulseMat); m.scale.setScalar(1.15); pulses.add(m)
      pulseList.push({ m, a: (i / 8) * Math.PI * 2, s: 0.9 + (i % 3) * 0.35 })
    }

    // the communion: a hairline uplink from the Empress's craft down into the
    // Engine's thought-substrate, packets sinking along it while the Litany speaks
    const beamMat = new THREE.MeshBasicMaterial({ color: 0xcfe4ff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false })
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 1, 6), beamMat); beam.visible = false; scene.add(beam)
    const packetMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false })
    const packets = []
    for (let i = 0; i < 3; i++) {
      const m = new THREE.Mesh(fx.blastGeo, packetMat); m.scale.setScalar(0.5); m.visible = false; scene.add(m)
      packets.push({ m, ph: i / 3 })
    }

    // the Engine's room tone, rising as we draw near
    const hum = sfx.bed('computerhum.mp3', { volume: 0 })
    let humStarted = false

    // the Empress's small craft, stealing in to commune — hers is the gold
    // fighter (the same hull and livery as the battle's Gold Ace)
    const craftMat = new THREE.MeshStandardMaterial({ color: 0xffc63a, emissive: 0xffae1f, emissiveIntensity: 0.85, metalness: 0.7, roughness: 0.3 })
    const craftGlowMat = new THREE.MeshBasicMaterial({ color: 0xffd56a, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false })
    const craft = new THREE.Group(); craft.add(new THREE.Mesh(buildBlueModel(), craftMat))
    const cglow = new THREE.Mesh(fx.blastGeo, craftGlowMat); cglow.scale.set(0.22, 0.22, 0.38); cglow.position.set(0, 0, -0.95); craft.add(cglow)
    craft.scale.setScalar(1.4); scene.add(craft)
    // she comes from the Throneworld (over at +x, −z), sweeping low across the
    // Engine's face — inside the diadem — to hold station on the near side.
    // No light trail: she steals in dark.
    const cFrom = new THREE.Vector3(130, 62, -140), cTo = new THREE.Vector3(0, 34, 48)
    const TRAVEL = new THREE.Vector3().subVectors(cTo, cFrom).normalize()
    craft.position.copy(cFrom)
    const _d = new THREE.Vector3()

    const _p1 = new THREE.Vector3(), _p2 = new THREE.Vector3(), _l = new THREE.Vector3()
    const ENGINE_LOOK = new THREE.Vector3(0, 6, 0)
    let T = 0, S = 0, c1 = false, c1b = false, cE1 = false, c2 = false, cE2 = false, c3 = false, ended = false
    let projShown = false
    const proj = makeLogosProjection(ctx, {
      onStart: () => sfx.blip(1400, 0.3, 0.4),
      onAdvance: () => sfx.blip(1150, 0.15, 0.25),
      onContinue: () => sfx.blip(760, 0.22, 0.3),
    })
    return (dt) => {
      T += dt
      // the story clock: everything after the projection waits for Her
      // acknowledgement — the world keeps turning, the beats do not
      const holding = proj.state.shown && !proj.state.closed
      if (!holding) S += dt
      engineTick(T)
      throneTick(T)
      ring.rotation.z += 0.05 * dt; ring2.rotation.z -= 0.03 * dt; sats.rotation.z += 0.05 * dt
      for (const rl of relays) {
        rl.r.rotation.y += 0.2 * dt
        rl.wink.material.opacity = 0.15 + 0.75 * Math.max(0, Math.sin(T * 1.8 + rl.ph)) ** 6   // a slow lighthouse wink
      }
      for (const p of pulseList) { p.a += p.s * dt; p.m.position.set(Math.cos(p.a) * 58, Math.sin(p.a) * 58, 0) }

      if (!humStarted) { humStarted = true; hum.play() }
      hum.setVolume(0.4 * Math.min(1, T / 3.5))

      // the craft eases in over the first few seconds, trailing light
      const cp = Math.min(1, T / 6), ce = 1 - Math.pow(1 - cp, 3)
      craft.position.lerpVectors(cFrom, cTo, ce)
      orient(craft, _d.subVectors(cTo, cFrom))
      craft.position.y += Math.sin(T * 1.2) * 0.02   // gentle settle

      // communion uplink once the craft holds station over the Engine
      if (cp >= 1) {
        beam.visible = true
        _d.copy(craft.position).multiplyScalar(-1); const dist = craft.position.length(); _d.normalize()
        const len = dist - 41                                         // down to the substrate surface
        beam.position.copy(craft.position).addScaledVector(_d, len / 2)
        beam.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), _d)
        beam.scale.set(1, len, 1)
        beamMat.opacity = 0.4 + 0.25 * Math.sin(T * 5)
        for (const pk of packets) {
          pk.m.visible = true
          pk.ph = (pk.ph + dt * 0.5) % 1
          pk.m.position.copy(craft.position).addScaledVector(_d, len * pk.ph)
        }
      }

      // camera: lead the gold craft out from the Throneworld — Her world
      // shrinking behind her — then swing wide and around, revealing the
      // Engine she has come to as the ceremonial orbit takes over
      const az = 0.5 + 0.12 * T, d = 165 - Math.min(55, T * 2.6)
      // ahead of her, looking back down the geodesic — offset off-axis so she
      // reads against the planet's limb instead of vanishing into its glare
      _p1.copy(craft.position).addScaledVector(TRAVEL, 20)
      _p1.x -= 5.7; _p1.z -= 3.9; _p1.y += 9
      _p2.set(Math.cos(az) * d, 34, Math.sin(az) * d)
      const k = Math.min(1, Math.max(0, (T - 5.2) / 3.2)), ke = k * k * (3 - 2 * k)
      camera.position.lerpVectors(_p1, _p2, ke)
      _l.copy(craft.position).lerp(ENGINE_LOOK, ke)   // the craft (planet behind her) → the Engine core
      camera.lookAt(_l)

      // the projection: announced, then raised — it narrates itself through
      // its own step-gated dialogue, and holds until She has clicked through
      if (!projShown && c1b && T >= 9.4) { projShown = true; proj.show(); sfx.blip(1400, 0.3, 0.4) }
      proj.tick(dt)

      if (!c1 && T >= 2.0) { c1 = true; comms.show('Litania Magna', LINE1) }
      if (!c1b && T >= 6.6) { c1b = true; comms.show('Litania Magna', LINE1B) }
      // after the projection: Her doubt, the Engine's answer, and the naming
      if (!cE1 && S >= 11.4) { cE1 = true; comms.show('Her Imperial Majesty Iliantha III', LINE_EMP1, { persist: true }) }
      if (!c2 && S >= 18.0) { c2 = true; comms.show('Litania Magna', LINE2, { persist: true }) }
      if (!cE2 && S >= 24.2) { cE2 = true; comms.show('Her Imperial Majesty Iliantha III', LINE_LANCE, { persist: true }) }
      if (!c3 && S >= 28.6) { c3 = true; comms.show('Her Imperial Majesty Iliantha III', LINE3, { persist: true }) }
      if (!ended && S >= 34.6) { ended = true; end() }
    }
  },
}
