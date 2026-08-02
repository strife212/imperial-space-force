import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { renderCommsBody } from '../battle/RosterUI'
import { playTitleBoom, createCutsceneSfx } from './sfx'
import '../battle/battle.css'
import './imperium-map.css'

const BASE = import.meta.env?.BASE_URL ?? '/'
const TAU = Math.PI * 2

// ── Chart geometry ───────────────────────────────────────────────────────────
// Drawn in a 1200×1200 design space: a dark throne-core, three rings of
// territory, then the surveyed limit. Every border is a deterministic function
// — of angle for a ring border, of the run outward for a sector border — so the
// two territories sharing a border evaluate the same points and the seam stays
// shut. No gaps, no overlaps, and no hand-authored polygons.
const CX = 600, CY = 600
const BOUNDS = [140, 265, 385, 500]   // core edge, then one radius per ring border
const LIMIT = 556                     // the surveyed limit — a true circle, behind everything
const RINGS = [5, 7, 8]               // sectors per ring, inner → outer

const frac = (x) => x - Math.floor(x)
const hash = (n) => frac(Math.sin(n * 127.1 + 311.7) * 43758.5453)
const lerp = (a, b, t) => a + (b - a) * t

// A ring border is a closed wobbled circle. The core edge (k = 0) stays a true
// circle so the throne-core reads as one; the rest wander.
const RING_W = BOUNDS.map((r, k) => ({
  r, amp: k === 0 ? 0 : 0.055,
  p: hash(k + 1) * TAU, q: hash(k + 9) * TAU, s: hash(k + 17) * TAU,
}))
const ringR = (k, a) => {
  const w = RING_W[k]
  return w.r * (1 + w.amp * (Math.sin(3 * a + w.p) + 0.62 * Math.sin(5 * a + w.q) + 0.4 * Math.sin(7 * a + w.s)))
}

// Where each ring's sectors are cut, with the first cut repeated at +2π so a
// sector can always address its outer neighbour as `j + 1`.
const CUTS = RINGS.map((n, ri) => {
  const rot = hash(ri * 31 + 3) * TAU
  const cuts = []
  for (let j = 0; j < n; j++) cuts.push(rot + (TAU * j) / n + (hash(ri * 71 + j * 13 + 5) - 0.5) * (TAU / n) * 0.5)
  cuts.push(cuts[0] + TAU)
  return cuts
})
// The border between two sectors of a ring, `t` running 0 (inner) → 1 (outer).
// Phase is keyed on j % n, so the wrap-around border is the same curve as j = 0.
const edgeA = (ri, j, t) => {
  const n = RINGS[ri]
  return CUTS[ri][j] + Math.sin(t * 3.4 + hash(ri * 97 + (j % n) * 7 + 11) * TAU) * (TAU / n) * 0.09
}

// Coarse sampling on purpose: few enough segments that the borders read as
// surveyed straight lines with kinks, not as smooth arcs.
const EDGE_STEPS = 5, ARC_STEPS = 7
function sectorPath(ri, j) {
  const pts = []
  const push = (r, a) => pts.push(`${(CX + Math.cos(a) * r).toFixed(1)} ${(CY + Math.sin(a) * r).toFixed(1)}`)
  for (let i = 0; i <= EDGE_STEPS; i++) { const t = i / EDGE_STEPS, a = edgeA(ri, j, t); push(lerp(ringR(ri, a), ringR(ri + 1, a), t), a) }
  const oA = edgeA(ri, j, 1), oB = edgeA(ri, j + 1, 1)
  for (let i = 1; i <= ARC_STEPS; i++) { const a = lerp(oA, oB, i / ARC_STEPS); push(ringR(ri + 1, a), a) }
  for (let i = EDGE_STEPS - 1; i >= 0; i--) { const t = i / EDGE_STEPS, a = edgeA(ri, j + 1, t); push(lerp(ringR(ri, a), ringR(ri + 1, a), t), a) }
  const iB = edgeA(ri, j + 1, 0), iA = edgeA(ri, j, 0)
  for (let i = 1; i < ARC_STEPS; i++) { const a = lerp(iB, iA, i / ARC_STEPS); push(ringR(ri, a), a) }
  return `M${pts.join('L')}Z`
}
const centroid = (ri, j) => {
  const a = (edgeA(ri, j, 0.5) + edgeA(ri, j + 1, 0.5)) / 2
  return { a, x: CX + Math.cos(a) * ((ringR(ri, a) + ringR(ri + 1, a)) / 2), y: CY + Math.sin(a) * ((ringR(ri, a) + ringR(ri + 1, a)) / 2) }
}

// ── The realm ────────────────────────────────────────────────────────────────
// Twenty territories, in generation order: five core provinces under the
// throne, seven of the settled middle, eight on the frontier. Names are stacked
// by hand rather than wrapped — a narrow caption is a caption that fits.
const SECTORS = [
  // the Litania Magna is Novaraya's moon — both bodies are the one system, and
  // the throneworld province is charted with both
  { n: ['NOVARAYAN', 'CORE'],      sub: 'THRONEWORLD',   star: ['NOVARAYA', 'LITANIA MAGNA'], seat: true },
  { n: ['CATHEDRAL', 'REACH'],     sub: 'THE HEARING' },
  { n: ['SERAPHIC', 'WATCH'],      sub: 'THRONE DEFENCE', star: 'CAELIFER' },
  { n: ['CONCORDIA', 'PROVINCE'],  sub: 'FIRST LISTENER' },
  { n: ['THE AUDIENCE'],           sub: 'HIGH SYNOD' },

  { n: ['BERENIKE', 'MARCH'],      sub: 'CLASSIS BULWARK', star: 'SINN' },
  { n: ['SELENE', 'PROVINCE'],     sub: 'THE HELD LINE' },
  { n: ['ASTRAIAN', 'REACH'],      sub: 'CORE PROVINCE',  star: 'KHALETH' },
  { n: ['POLYHYMNIAN', 'SPAN'],    sub: 'SIGNAL ARCHIVE' },
  { n: ['THE PTOLEMAIA'],          sub: 'ORBITAL WORKS' },
  { n: ['CASSIAN', 'DIOCESE'],     sub: 'SCHOLARIUM',    star: 'CASSIA' },
  { n: ['IULIAN', 'PROVINCE'],     sub: 'GRAIN WORLDS' },

  { n: ['PHAERE', 'FRONTIER'],     sub: 'THE LONG RETURN', star: 'PHAERE' },
  { n: ['SEVERINE', 'MARCHES'],    sub: 'MILITARY ZONE' },
  { n: ['ALEPH', 'PERIPHERY'],     sub: 'CONTACT SITE',  star: 'ALEPH' },
  { n: ['ERATO', 'CONCORD'],       sub: 'TREATY SPACE' },
  { n: ['THE OUTER', 'AUDIT'],     sub: 'LISTENING POSTS', star: 'VIGIL' },
  { n: ['DRUSILLAN', 'VERGE'],     sub: 'SATELLITE STATES' },
  { n: ['ANDROMEDAN', 'PROVINCE'], sub: 'SETTLED SPACE' },
  { n: ['THE UNSUNG', 'DEEP'],     sub: 'UNSURVEYED',    star: 'IX' },
]
// What a territory's caption becomes once the Hush has it.
const HUSH_SUB = ['SIGNAL LOST', 'NO AUDITION', 'SILENT', 'UNSUNG']

const CHART = (() => {
  const out = []
  RINGS.forEach((n, ri) => {
    for (let j = 0; j < n; j++) {
      const s = SECTORS[out.length]
      // `star` is authored as one name or several; downstream only sees a list
      const stars = s.star ? (Array.isArray(s.star) ? s.star : [s.star]) : []
      out.push({ id: out.length, ri, ...centroid(ri, j), d: sectorPath(ri, j), ...s, stars })
    }
  })
  return out
})()

// ── Caption placement ────────────────────────────────────────────────────────
// A caption starts at the middle of its territory, which is right up until two
// rings happen to line up on the same bearing and their captions land on top of
// each other. Relax the whole set apart, then pull each one back inside its own
// band — a mapmaker's nudge, done once at module load.
const CH_NAME = 17.1, CH_SUB = 11, CH_STAR = 11.6   // caption widths, per character
const MAX_SHIFT = 100                                // how far a caption may stray
const labelBox = (s) => ({
  w: Math.max(
    Math.max(...s.n.map((l) => l.length)) * CH_NAME,
    Math.max(s.sub.length, HUSH_SUB[s.id % HUSH_SUB.length].length) * CH_SUB,
    ...s.stars.map((t) => (t.length + 2) * CH_STAR),
  ) + 24,
  h: s.n.length * 30 + 54 + s.stars.length * 26,
})
const LABELS = (() => {
  const L = CHART.map((s) => ({ id: s.id, ri: s.ri, x: s.x, y: s.y, x0: s.x, y0: s.y, ...labelBox(s) }))
  for (let it = 0; it < 90; it++) {
    let moved = false
    for (let i = 0; i < L.length; i++) {
      for (let j = i + 1; j < L.length; j++) {
        const a = L[i], b = L[j]
        const ox = (a.w + b.w) / 2 - Math.abs(a.x - b.x)
        const oy = (a.h + b.h) / 2 - Math.abs(a.y - b.y)
        if (ox <= 0 || oy <= 0) continue
        moved = true
        if (ox < oy) { const p = (a.x < b.x ? -1 : 1) * ox * 0.5; a.x += p; b.x -= p }
        else { const p = (a.y < b.y ? -1 : 1) * oy * 0.5; a.y += p; b.y -= p }
      }
    }
    for (const l of L) {
      let dx = l.x - l.x0, dy = l.y - l.y0
      const d = Math.hypot(dx, dy)
      if (d > MAX_SHIFT) { dx *= MAX_SHIFT / d; dy *= MAX_SHIFT / d }
      const a = Math.atan2(l.y0 + dy - CY, l.x0 + dx - CX)
      // Keep the caption's own footprint inside the band, not just its centre —
      // a wide caption on the left flank is as tall, radially, as it is wide.
      // Capped so the clamp always leaves the caption somewhere to go: a pad
      // wider than the band pins every caption to the band's midline, and then
      // no amount of pushing can separate two that landed on the same bearing.
      const rawIn = ringR(l.ri, a), rawOut = ringR(l.ri + 1, a)
      const reach = Math.abs(Math.cos(a)) * l.w / 2 + Math.abs(Math.sin(a)) * l.h / 2 + 6
      const pad = Math.min(reach, Math.max(10, (rawOut - rawIn) / 2 - 22))
      let r = Math.hypot(l.x0 + dx - CX, l.y0 + dy - CY)
      r = Math.max(rawIn + pad, Math.min(rawOut - pad, r))
      l.x = CX + Math.cos(a) * r; l.y = CY + Math.sin(a) * r
    }
    if (!moved) break
  }
  return new Map(L.map((l) => [l.id, l]))
})()

// The silence arrives on one bearing and sweeps around, taking the frontier a
// touch ahead of the interior it shields. Exactly half the realm falls — but
// never the throne: the sweep passes over the Novarayan Core and takes the next
// province behind it instead, leaving the seat of the audition holding while
// everything around it goes quiet.
const THRONE = 0                                     // index into SECTORS
const BEARING = 0.55 * TAU
const FALL_ORDER = CHART
  .filter((s) => s.id !== THRONE)
  .map((s) => ({ id: s.id, k: frac((s.a - BEARING) / TAU) - (2 - s.ri) * 0.02 }))
  .sort((p, q) => p.k - q.k)
  .slice(0, CHART.length / 2)
  .map((s) => s.id)

// ── The historian's narration ────────────────────────────────────────────────
// Lines are authored with <red>…</red> / <blue>…</blue> and split into the
// typewriter segments the battle's comms box already knows how to colour.
const TAG_CLS = { red: 'sb-comms-em--red', blue: 'sb-comms-em--blue' }
const say = (src) => {
  const segments = []
  const re = /<(red|blue)>([\s\S]*?)<\/\1>/g
  let last = 0, m
  while ((m = re.exec(src))) {
    if (m.index > last) segments.push({ text: src.slice(last, m.index) })
    segments.push({ text: m[2], cls: TAG_CLS[m[1]] })
    last = m.index + m[0].length
  }
  if (last < src.length) segments.push({ text: src.slice(last) })
  return { segments, len: segments.reduce((n, s) => n + s.text.length, 0) }
}
// Peacetime reads the realm as it was; wartime opens on the doubt and takes
// half the chart with it.
const PEACE_LINES = [
  say('For a thousand generations, the Empire has stood as a shining beacon of order, spreading harmony and technology under the watchful rule of its Empresses.'),
  say('As above, so below. The harmony of the macrocosmos was reflected in the administration of the empire, and this ideology was called the <blue>Universal Order</blue>.'),
]
const WAR_OPEN = [
  say('But with the discovery of the Aleph and the concept of the cycular aeons, many began to believe the Universal Order had gone astray.'),
]
const AFTER = [
  say('A rival faction emerged, declaring itself the <red>Continuing Order</red>.'),
  say('They believed that the continuation of the cycle of aeons was of utmost importance, and that any action in aid of this was both necessary and justified.'),
]

// ── Beat sheet (ms) ──────────────────────────────────────────────────────────
// The card opens on the seal alone, full size at the centre of the screen; it
// withdraws to its place in the layout, and only then does the empire name
// itself. T_TITLE is the card's whole running time — downstream beats key off
// it as before.
const T_SEAL = 1700       // the seal, full size, alone on black
const T_SEAL_MOVE = 1150  // …withdraws to its place in the card
const T_TEXT_HOLD = 2800  // the name of the empire holds
const T_TITLE = T_SEAL + T_SEAL_MOVE + T_TEXT_HOLD
const T_TITLE_OUT = 1200  // …then dissolves to the chart
const T_HOLD = 1800       // the realm entire, before the historian speaks
const MS_PER_CHAR = 42    // typewriter speed, advanced by elapsed time
const T_DWELL = 2200      // how long a finished line lingers
const T_STEP = 430        // one territory falls
const T_TAIL = 1600       // the last territory settles before the epilogue

const GRID_RINGS = [185, 265, 345, 425, 500]
const SPOKES = Array.from({ length: 24 }, (_, i) => (TAU * i) / 24)

// Bearing ticks around the surveyed limit — every 5°, longer on the half-hours
// — and the four cardinal readouts. Bearing 000 is chart-north (up).
const TICKS = Array.from({ length: 72 }, (_, i) => {
  const a = (TAU * i) / 72, long = i % 6 === 0
  return { a, r1: LIMIT + 4, r2: LIMIT + (long ? 17 : 9), long }
})
const BEARINGS = [['000', -90], ['090', 0], ['180', 90], ['270', 180]].map(([t, deg]) => ({
  t, x: CX + Math.cos((deg * Math.PI) / 180) * (LIMIT + 34), y: CY + Math.sin((deg * Math.PI) / 180) * (LIMIT + 34),
}))

// The space beyond the audition: a deterministic scatter, kept outside the
// limit so the charted realm stays clean.
const STARS = (() => {
  const out = []
  for (let i = 0; i < 150; i++) {
    const x = hash(i * 3 + 11) * 1200, y = hash(i * 7 + 29) * 1200
    if (Math.hypot(x - CX, y - CY) < LIMIT + 16) continue
    out.push({ x: x.toFixed(0), y: y.toFixed(0), r: (0.7 + hash(i * 13 + 5) * 1.3).toFixed(1), o: (0.1 + hash(i * 17 + 3) * 0.45).toFixed(2) })
  }
  return out
})()

// ── The standards of the two Orders ──────────────────────────────────────────
// Once the schism has run its course, each half of the realm flies its colours
// beside the chart. The Continuing Order's is the wheel of aeons, exactly as
// its proclamation draws it: a red rim and eight spokes around a gold
// four-point star, ported here to SVG.
const WHEEL_R = 52
const WHEEL_SPOKES = Array.from({ length: 8 }, (_, i) => {
  const a = (TAU * i) / 8 + TAU / 16
  return {
    x1: +(60 + Math.cos(a) * WHEEL_R * 0.28).toFixed(1), y1: +(60 + Math.sin(a) * WHEEL_R * 0.28).toFixed(1),
    x2: +(60 + Math.cos(a) * WHEEL_R * 0.8).toFixed(1),  y2: +(60 + Math.sin(a) * WHEEL_R * 0.8).toFixed(1),
  }
})
const WHEEL_STAR = (() => {
  const s = WHEEL_R * 0.17, k = s * 0.34
  const p = (x, y) => `${(60 + x).toFixed(1)} ${(60 + y).toFixed(1)}`
  return `M${p(0, -s)}L${p(k, -k)}L${p(s, 0)}L${p(k, k)}L${p(0, s)}L${p(-k, k)}L${p(-s, 0)}L${p(-k, -k)}Z`
})()

// Standalone chart cutscene in two modes. Both open on the seal splash and the
// chart whole and imperial. 'peace' is the explainer: two lines of lore, the
// realm entire, no key. 'war' opens on the doubt, turns half the realm red a
// province at a time, and keys the two Orders by colour.
export default function ImperiumMap({ mode = 'war', onReturn }) {
  const [nonce, setNonce] = useState(0)
  const [cardPhase, setCardPhase] = useState('seal')   // 'seal' → 'settle' → 'text'
  const sealRef = useRef(null)
  const [titleOut, setTitleOut] = useState(false)
  const [titleDone, setTitleDone] = useState(false)
  const [mapOn, setMapOn] = useState(false)
  const [fallen, setFallen] = useState([])
  const [factionsOn, setFactionsOn] = useState(false)
  const [line, setLine] = useState(null)       // { segments, len, id, t0 } while the historian speaks
  const [typed, setTyped] = useState({ id: 0, n: 0 })
  const [done, setDone] = useState(false)

  useEffect(() => {
    const timers = []
    const at = (ms, fn) => timers.push(setTimeout(fn, ms))
    let sfx = null
    try { sfx = createCutsceneSfx() } catch { /* no audio */ }

    // the seal arrives in silence; the boom belongs to the name
    at(T_SEAL, () => setCardPhase('settle'))
    at(T_SEAL + T_SEAL_MOVE, () => { setCardPhase('text'); playTitleBoom(0.7) })
    at(T_TITLE, () => setTitleOut(true))
    at(T_TITLE + 250, () => setMapOn(true))            // the chart comes up under the card
    at(T_TITLE + T_TITLE_OUT, () => setTitleDone(true))

    // Read a block of narration, one line at a time, then hand on. Each line
    // holds for as long as it takes to type plus a beat to read it.
    let said = 0
    const read = (block, i, then) => {
      if (i >= block.length) { setLine(null); then(); return }
      setLine({ ...block[i], id: ++said, t0: performance.now() })
      sfx?.comms()
      at(block[i].len * MS_PER_CHAR + T_DWELL, () => read(block, i + 1, then))
    }

    // The fall is a chain, not ten timers set at once: each loss schedules the
    // next. Where a browser coalesces timers — a background tab, a throttled
    // preview — independent timers land in the same tick and half the realm
    // goes at a stroke. Chaining stretches the sequence instead of collapsing
    // it, and one-at-a-time is the whole beat.
    const step = (i) => {
      if (i >= FALL_ORDER.length) {
        at(600, () => setFactionsOn(true))   // the colours go up as the last loss settles
        at(T_TAIL, () => read(AFTER, 0, () => at(1600, () => setDone(true))))
        return
      }
      setFallen((f) => [...f, FALL_ORDER[i]])
      sfx?.ping(560 - i * 22, 0.3)                     // each loss a tone lower than the last
      at(T_STEP, () => step(i + 1))
    }

    if (mode === 'peace') {
      // the explainer holds on the whole imperial realm — nothing falls
      at(T_TITLE + T_TITLE_OUT + T_HOLD, () => read(PEACE_LINES, 0, () => at(1400, () => setDone(true))))
    } else {
      at(T_TITLE + T_TITLE_OUT + T_HOLD, () => read(WAR_OPEN, 0, () => {
        at(700, () => { sfx?.rumble(0.4, 2.6); at(900, () => step(0)) })   // the front arrives
      }))
    }

    return () => { timers.forEach(clearTimeout); sfx?.dispose() }
  }, [nonce, mode])

  // Typewriter — the reveal is measured from the line's own start stamp rather
  // than counted in ticks, so a starved interval catches up to the right
  // character instead of typing in slow motion. The count is tagged with the
  // line it belongs to, so a new line reads as zero revealed without needing to
  // be reset first (which would flash the old count against the new text).
  useEffect(() => {
    if (!line) return undefined
    const iv = setInterval(() => {
      const n = Math.min(line.len, Math.floor((performance.now() - line.t0) / MS_PER_CHAR))
      setTyped({ id: line.id, n })
      if (n >= line.len) clearInterval(iv)
    }, MS_PER_CHAR)
    return () => clearInterval(iv)
  }, [line])

  // The seal's opening move, FLIP-style: it is laid out in its final slot from
  // the first frame, but carries a transform that centres it on the screen at
  // full size. Releasing the transform (phase 'settle') lets one CSS transition
  // glide it home — so "its place" is the layout's own truth, never a guess.
  // Measured before paint; the slot is stable because the (invisible) title
  // lines already occupy their space, and the seal's aspect-ratio is fixed in
  // CSS so the maths hold even before the SVG finishes loading.
  useLayoutEffect(() => {
    const el = sealRef.current
    if (!el) return
    // measure the untransformed slot — under StrictMode this effect runs twice,
    // and the second pass must not measure the transform the first one set
    el.style.transform = ''
    const r = el.getBoundingClientRect()
    if (r.width < 4) return
    const big = Math.min(window.innerHeight * 0.55, window.innerWidth * 0.42)
    const dx = window.innerWidth / 2 - (r.left + r.width / 2)
    const dy = window.innerHeight / 2 - (r.top + r.height / 2)
    el.style.transform = `translate(${dx.toFixed(1)}px, ${dy.toFixed(1)}px) scale(${(big / r.width).toFixed(3)})`
  }, [nonce])
  useEffect(() => {
    if (cardPhase !== 'seal' && sealRef.current) sealRef.current.style.transform = ''
  }, [cardPhase])

  const replay = () => {
    setCardPhase('seal'); setTitleOut(false); setTitleDone(false); setMapOn(false)
    setFallen([]); setFactionsOn(false); setLine(null); setTyped({ id: 0, n: 0 }); setDone(false); setNonce((n) => n + 1)
  }

  const held = CHART.length - fallen.length
  const cls = (s) => `imap-sector${fallen.includes(s.id) ? ' is-fallen' : ''}`

  return (
    <div id="imperium-map">
      <div className={`imap-stage${mapOn ? ' is-on' : ''}`}>
        <div className="imap-chartbox">
          <svg className="imap-chart" viewBox="0 0 1200 1200" role="img" aria-label="Strategic chart of the Holy Novarayan Empire">
            <defs>
              <radialGradient id="imap-core-g">
                <stop offset="0%" stopColor="#cfe2ff" stopOpacity="0.55" />
                <stop offset="24%" stopColor="#1d4a90" stopOpacity="0.34" />
                <stop offset="100%" stopColor="#01040c" stopOpacity="0.95" />
              </radialGradient>
              <radialGradient id="imap-haze-g">
                <stop offset="34%" stopColor="#0c2350" stopOpacity="0.5" />
                <stop offset="78%" stopColor="#050e26" stopOpacity="0.2" />
                <stop offset="100%" stopColor="#01030a" stopOpacity="0" />
              </radialGradient>
              {/* the surveyor's mark for lost ground: hatching over the fill */}
              <pattern id="imap-hatch" width="13" height="13" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                <line x1="1.5" y1="0" x2="1.5" y2="13" stroke="rgba(255, 126, 96, 0.17)" strokeWidth="4" />
              </pattern>
            </defs>

            <circle className="imap-haze" cx={CX} cy={CY} r={LIMIT + 40} fill="url(#imap-haze-g)" />

            <g className="imap-space">
              {STARS.map((s, i) => <circle key={i} cx={s.x} cy={s.y} r={s.r} opacity={s.o} />)}
            </g>

            <g className="imap-grid">
              {GRID_RINGS.map((r) => <circle key={r} cx={CX} cy={CY} r={r} />)}
              {SPOKES.map((a, i) => (
                <line key={i} x1={CX + Math.cos(a) * BOUNDS[0]} y1={CY + Math.sin(a) * BOUNDS[0]}
                      x2={CX + Math.cos(a) * LIMIT} y2={CY + Math.sin(a) * LIMIT} />
              ))}
              {TICKS.map((t, i) => (
                <line key={`t${i}`} className={`imap-tick${t.long ? ' imap-tick--long' : ''}`}
                      x1={CX + Math.cos(t.a) * t.r1} y1={CY + Math.sin(t.a) * t.r1}
                      x2={CX + Math.cos(t.a) * t.r2} y2={CY + Math.sin(t.a) * t.r2} />
              ))}
              {BEARINGS.map((b) => <text key={b.t} className="imap-bearing" x={b.x} y={b.y}>{b.t}</text>)}
            </g>

            <g className="imap-terrs">
              {CHART.map((s) => <path key={s.id} className={`${cls(s)} imap-terr imap-terr--r${s.ri}`} d={s.d} />)}
              {CHART.map((s) => <path key={`h${s.id}`} className={`${cls(s)} imap-hatchp`} d={s.d} />)}
            </g>

            <g className="imap-shell">
              <circle className="imap-limit-halo" cx={CX} cy={CY} r={LIMIT} />
              <circle className="imap-limit" cx={CX} cy={CY} r={LIMIT} />
              <circle className="imap-limit-inner" cx={CX} cy={CY} r={LIMIT - 12} />
              <circle className="imap-core" cx={CX} cy={CY} r={BOUNDS[0]} fill="url(#imap-core-g)" />
              <circle className="imap-core-ring" cx={CX} cy={CY} r={BOUNDS[0]} />
              <circle className="imap-core-etch" cx={CX} cy={CY} r={92} />
              <circle className="imap-core-etch" cx={CX} cy={CY} r={48} />
              <line className="imap-core-cross" x1={CX - 26} y1={CY} x2={CX + 26} y2={CY} />
              <line className="imap-core-cross" x1={CX} y1={CY - 26} x2={CX} y2={CY + 26} />
              <circle className="imap-core-dot" cx={CX} cy={CY} r={3} />
            </g>

            <g className="imap-labels">
              {CHART.map((s) => {
                const off = (s.n.length - 1) * 15
                const p = LABELS.get(s.id)
                return (
                  <g key={s.id} className={cls(s)} transform={`translate(${p.x.toFixed(1)} ${p.y.toFixed(1)})`}>
                    {s.n.map((line, i) => <text key={line} className="imap-name" y={i * 30 - off}>{line}</text>)}
                    <text className="imap-sub imap-sub--imp" y={off + 25}>{s.sub}</text>
                    <text className="imap-sub imap-sub--hush" y={off + 25}>{HUSH_SUB[s.id % HUSH_SUB.length]}</text>
                    {s.stars.map((t, i) => (
                      <text key={t} className={`imap-star${s.seat && i === 0 ? ' imap-star--seat' : ''}`} y={off + 53 + i * 26}>✦ {t}</text>
                    ))}
                  </g>
                )
              })}
            </g>
          </svg>
        </div>

        <div className="imap-head">
          <img className="imap-head-seal" src={`${BASE}imperial_empress_emblem.svg`} alt="" />
          <div>
            <div className="imap-head-title">SACRUM IMPERIUM NOVARAYUM</div>
            <div className="imap-head-sub">CLASSIS STELLARIS · STRATEGIC CHART OF THE REALM</div>
          </div>
        </div>

        {mode === 'war' && (
          <div className="imap-legend">
            <div className="imap-key">
              <span className="imap-swatch imap-swatch--imp" />
              <span className="imap-key-label">UNIVERSAL ORDER</span>
              <span className="imap-key-val">{String(held).padStart(2, '0')}</span>
            </div>
            <div className={`imap-key imap-key--hush${fallen.length ? ' is-live' : ''}`}>
              <span className="imap-swatch imap-swatch--hush" />
              <span className="imap-key-label">CONTINUING ORDER</span>
              <span className="imap-key-val">{String(fallen.length).padStart(2, '0')}</span>
            </div>
            {/* one tick per territory; the schism eats the bar from the right */}
            <div className="imap-key-bar">
              {CHART.map((s, i) => <i key={s.id} className={i < held ? undefined : 'is-red'} />)}
            </div>
          </div>
        )}

        {mode === 'war' && (
          <>
            <div className={`imap-faction imap-faction--uo${factionsOn ? ' is-on' : ''}`}>
              <img className="imap-faction-emblem" src={`${BASE}imperial_empress_emblem.svg`} alt="" />
              <div className="imap-faction-name">UNIVERSAL<span>ORDER</span></div>
            </div>
            <div className={`imap-faction imap-faction--co${factionsOn ? ' is-on' : ''}`}>
              <svg className="imap-faction-emblem imap-wheel" viewBox="0 0 120 120" aria-hidden="true">
                <circle className="imap-wheel-rim" cx="60" cy="60" r={WHEEL_R} />
                <circle className="imap-wheel-line" cx="60" cy="60" r={WHEEL_R * 0.8} />
                <circle className="imap-wheel-line" cx="60" cy="60" r={WHEEL_R * 0.28} />
                {WHEEL_SPOKES.map((l, i) => <line key={i} className="imap-wheel-line" x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2} />)}
                <path className="imap-wheel-star" d={WHEEL_STAR} />
              </svg>
              <div className="imap-faction-name">CONTINUING<span>ORDER</span></div>
            </div>
          </>
        )}

        <div className="imap-corner imap-corner--tl" />
        <div className="imap-corner imap-corner--tr" />
        <div className="imap-corner imap-corner--bl" />
        <div className="imap-corner imap-corner--br" />
      </div>

      {line && (
        <div className="sb-comms sb-comms--blue" key={line.id}>
          <img className="sb-comms-portrait" src={`${BASE}imperial_empress_emblem.svg`} alt="" />
          <div className="sb-comms-body">
            <div className="sb-comms-name">Imperial Historian</div>
            <div className="sb-comms-text">{renderCommsBody(line.segments, typed.id === line.id ? typed.n : 0)}<span className="sb-comms-cursor">▋</span></div>
          </div>
        </div>
      )}

      {!titleDone && (
        <div key={nonce} className={`imap-card imap-card--${cardPhase}${titleOut ? ' imap-card--out' : ''}`}>
          <div className="imap-card-title">
            <span>SACRUM IMPERIUM</span>
            <span>NOVARAYUM</span>
          </div>
          <div className="imap-card-sub">Holy Novarayan Empire</div>
          <img ref={sealRef} className="imap-card-seal" src={`${BASE}imperial_empress_emblem.svg`} alt="" />
        </div>
      )}

      <div className="imap-controls">
        {done && <button className="imap-btn" onClick={replay}>⟳ REPLAY</button>}
        <button className="imap-btn imap-btn--ghost" onClick={onReturn}>◂ BACK</button>
      </div>
    </div>
  )
}
