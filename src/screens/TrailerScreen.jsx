import { useState, useEffect, useRef } from 'react'
import SpaceBattleScreen from './SpaceBattleScreen'
import FleetReview from './FleetReview'
import { createStage } from './cutscene/stage'
import { playTitleBoom } from './cutscene/sfx'
import { SCENES } from './cutscene/scenes'
import { CAP_HP } from './battle/constants'
import { registerAudioContext } from '../lib/audioUnlock'
import { setFlag } from '../lib/store'

// ── The trailer — a 30-second montage cut from the real game ─────────────────
// Not a video file: a deep-linked screen (/trailer) that plays the actual game
// surfaces in sequence, ready to be screen-recorded. Hard cuts ride short black
// blinks, which double as masks — each next layer mounts BEHIND the blink, so
// shader compiles and warp-ins warm up unseen and every reveal lands clean.
//
//   0.0  the Cosmogony bang — seed, detonation, the matter racing out
//   5.0  live skirmish, HUD hidden: the fleets warp in and open fire
//  11.9  the fleet builder
//  14.8  the Lance: charge, cast, and the chase down the dark
//  20.2  FIRST LIGHT / PROVIDENCE / ESCHATON flashing → the last stand, in close
//  27.8  white flash → IMPERIAL SPACE FORCE · Caelum canit · illa avdit
//  30.0  black. Cut. (REPLAY reloads for another take.)
//
// Exactly one base layer is ever mounted: each hands off to the next at a cut.
// The score is fully synthesized below — no music assets, one WebAudio graph.
const NOOP_HOOKS = { comms: { show: () => {}, hide: () => {} }, end: () => {} }

// Battles run as locked campaign engagements — campaign mode skips the
// order-of-battle briefing and warps straight in. Callbacks are inert (the
// trailer cuts away long before any battle can resolve).
const noop = () => {}
const battleConfig = (over) => ({
  nodeIndex: 4, nodeTitle: 'First Light', enemyName: 'Aleph Sentinels',
  playerComp: { fighters: 24, bombers: 4, cruisers: 1 },
  enemyComp:  { fighters: 24, bombers: 4, cruisers: 1 },
  capMaxHp: CAP_HP, capMissile: false, macroMissile: false,
  mods: null, redMods: null, redCapHpBonus: 0, redCapMissile: false,
  flagshipName: 'HMSS Aquila Imperialis', reward: 0,
  onResolve: noop, onExit: noop, onRetry: noop, onContinue: noop,
  ...over,
})
const BATTLE_A = battleConfig({})
const BATTLE_B = battleConfig({
  nodeTitle: 'Eschaton', enemyName: "Discord's Last Stand", sky: 'aurum',
  playerComp: { fighters: 40, bombers: 8, cruisers: 4 },
  enemyComp:  { fighters: 48, bombers: 6, cruisers: 5 },
  camera: [30, 9, 24],   // in among the ships: closer, swung round, near the plane
})

// ── the timeline ─────────────────────────────────────────────────────────────
// base layers: mounted at `mount` (behind a blink or the cards), cut at `hide`
const LAYERS = [
  { id: 'cosmo',   mount: 0,     hide: 4.5 },
  { id: 'battleA', mount: 4.5,   hide: 11.45 },
  { id: 'fleet',   mount: 11.45, hide: 14.3 },
  { id: 'lance',   mount: 14.3,  hide: 20.15 },
  { id: 'battleB', mount: 20.15, hide: 27.75 },
]
// plain black blinks masking the cuts between shots
const BLINKS = [
  { at: 4.5,   dur: 0.45 },
  { at: 11.45, dur: 0.45 },
  { at: 14.3,  dur: 0.45 },
]
// the one card run — three beats flashing in sequence before the last stand
const CARDS = [
  { at: 20.15, dur: 0.45, text: 'FIRST LIGHT' },
  { at: 20.6,  dur: 0.45, text: 'PROVIDENCE' },
  { at: 21.05, dur: 0.45, text: 'ESCHATON' },
]
// lower-third captions, timed inside their shots
const CAPTIONS = [
  { at: 6.2,  until: 11.1, text: 'REALTIME FLEET COMBAT' },
  { at: 12.3, until: 14.0, text: 'FORGE YOUR FLEET' },
  { at: 15.6, until: 19.8, text: 'CAST THE CELESTIAL LANCE' },
  { at: 22.9, until: 27.4, text: 'BREAK THE WHEEL OF ETERNITY' },
]
const BANG_T = 3.0      // the cosmogony detonation (scene preroll 2s + bang 1s)
const FIRE_T = 17.45    // the Lance discharges (mount 14.3 + scene FIRE_T 3.0 + a frame)
const LOGO_T = 27.75
const END_T = 30.0

// ── the score — synthesized end to end, one WebAudio graph ───────────────────
// No samples: a drone bed that climbs shot by shot, a war-pulse under the
// battles, a bright ostinato ticking over the fights, risers into the bang and
// the cast, drum hits on the cards, and the radiant D-major chord under the
// logo. The Cathedral (playTitleBoom) still slams the bang and the title —
// it is the game's stinger, synthesized too.
function makeTrailerScore() {
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
  const wet = actx.createGain(); wet.gain.value = 0.34
  bus.connect(delay); delay.connect(damp); damp.connect(fbk); fbk.connect(delay); damp.connect(wet); wet.connect(master)
  const nbuf = actx.createBuffer(1, actx.sampleRate * 2, actx.sampleRate)
  { const nd = nbuf.getChannelData(0); for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1 }
  const now = () => actx.currentTime
  const ramp = (p, v, t) => { p.cancelScheduledValues(now()); p.setValueAtTime(p.value, now()); p.linearRampToValueAtTime(v, now() + t) }

  const droneFilter = actx.createBiquadFilter(); droneFilter.type = 'lowpass'; droneFilter.frequency.value = 150; droneFilter.Q.value = 0.6
  const droneGain = actx.createGain(); droneGain.gain.value = 0
  droneFilter.connect(droneGain); droneGain.connect(bus)
  const oscs = []
  for (const [type, ratio, level] of [['sine', 0.5, 0.9], ['sawtooth', 1, 0.2], ['sawtooth', 1.006, 0.18], ['sine', 1.5, 0.26]]) {
    const o = actx.createOscillator(); o.type = type; o.frequency.value = 36.71 * ratio
    const g = actx.createGain(); g.gain.value = level
    o.connect(g); g.connect(droneFilter); o.start()
    oscs.push({ o, ratio })
  }
  const setDrone = (root, cutoff, glide = 1.2, level = 0.09) => {
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

  // the war-pulse — a kick under the battle shots
  const thump = (vol = 1) => { blip(62, 0, 0.22, 0.42 * vol, 'sine', 34); burst(0, 0.05, 0.08 * vol, 320, 1.2) }
  // the ostinato — a bright tick riding over the fights, D-pentatonic
  const OSTI = [293.66, 349.23, 440, 349.23, 293.66, 440, 523.25, 440]
  let ostiStep = 0
  const tickBlip = (bright = 0) => { blip(OSTI[ostiStep++ % OSTI.length] * (bright ? 2 : 1), 0, 0.14, 0.05, 'triangle') }
  // a swelling riser — into the bang, into the cast
  const riser = (dur) => {
    const t0 = now() + 0.02
    const n = actx.createBufferSource(); n.buffer = nbuf; n.loop = true
    const bp = actx.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 0.9
    bp.frequency.setValueAtTime(140, t0); bp.frequency.exponentialRampToValueAtTime(2200, t0 + dur)
    const g = actx.createGain()
    g.gain.setValueAtTime(0.0001, t0)
    g.gain.linearRampToValueAtTime(0.22, t0 + dur * 0.85)
    g.gain.setValueAtTime(0.22, t0 + dur - 0.02)
    g.gain.linearRampToValueAtTime(0.0001, t0 + dur)
    n.connect(bp); bp.connect(g); g.connect(bus); n.start(t0, Math.random()); n.stop(t0 + dur + 0.05)
  }
  // the card strike — ceremonial drum, one per flashing title
  const hit = () => {
    const t0 = now() + 0.02
    const o = actx.createOscillator(); o.type = 'sine'
    o.frequency.setValueAtTime(96, t0); o.frequency.exponentialRampToValueAtTime(40, t0 + 0.45)
    const og = actx.createGain()
    og.gain.setValueAtTime(0.0001, t0)
    og.gain.exponentialRampToValueAtTime(0.5, t0 + 0.012)
    og.gain.exponentialRampToValueAtTime(0.0001, t0 + 1.1)
    o.connect(og); og.connect(bus); o.start(t0); o.stop(t0 + 1.2)
    burst(0, 0.24, 0.22, 260, 0.8)
  }
  // the resolution — D major swelling under the logo
  const chord = () => {
    const t0 = now() + 0.05
    for (const [f, l] of [[146.83, 0.13], [220, 0.1], [293.66, 0.09], [440, 0.05], [1174.66, 0.012]]) {
      const o = actx.createOscillator(); o.type = 'sine'; o.frequency.value = f
      const g = actx.createGain()
      g.gain.setValueAtTime(0.0001, t0)
      g.gain.linearRampToValueAtTime(l, t0 + 1.0)
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + 4.5)
      o.connect(g); g.connect(bus); o.start(t0); o.stop(t0 + 4.6)
    }
  }
  const start = () => { actx.resume?.().catch?.(() => {}); ramp(master.gain, 0.5, 0.6) }
  const fadeOut = (dur) => ramp(master.gain, 0, dur)
  const dispose = () => { try { actx.close() } catch { /* closed */ } }
  return { setDrone, thump, tickBlip, riser, hit, chord, start, fadeOut, dispose }
}

function StageLayer({ sceneDef }) {
  const ref = useRef(null)
  useEffect(() => createStage(ref.current, sceneDef, NOOP_HOOKS), [sceneDef])
  return <div className="trailer-layer" ref={ref} />
}

export default function TrailerScreen() {
  const [started, setStarted] = useState(false)
  // one state object per discrete change — the clock itself stays in a ref so
  // React only re-renders on cuts, not per frame
  const [view, setView] = useState({ layer: null, blink: false, card: null, caption: null, logo: false, leaving: false, done: false })
  const rootRef = useRef(null)

  useEffect(() => {
    if (!started) return undefined
    // the battles must not pause for first-run tutorial spotlights mid-take
    setFlag('tutSkillSeen', true); setFlag('tutBomberSeen', true)
    const score = makeTrailerScore()
    score?.start()
    score?.setDrone(36.71, 150, 0.2, 0.07)   // D1 — the dark before the note
    score?.riser(BANG_T)                      // and the rise into it

    const fired = new Set()
    const once = (key, fn) => { if (!fired.has(key)) { fired.add(key); fn() } }
    // the war-pulse and ostinato run on the trailer clock, phase by phase
    let nextPulse = null, pulseGap = 0.62, nextOsti = null, ostiGap = 0.31, ostiBright = 0

    // the trailer clock accumulates CAPPED frame deltas, not raw wall time: a
    // main-thread stall (a screen mounting, shaders compiling) then slows the
    // cut by a beat instead of skipping shots — nothing is ever jumped over
    let t = 0, last = performance.now()
    let raf
    const tick = () => {
      const now = performance.now()
      t += Math.min((now - last) / 1000, 0.1); last = now

      const layer = LAYERS.find((l) => t >= l.mount && t < l.hide)?.id ?? null
      const blink = BLINKS.some((b) => t >= b.at && t < b.at + b.dur)
      const card = CARDS.find((c) => t >= c.at && t < c.at + c.dur) ?? null
      const caption = CAPTIONS.find((c) => t >= c.at && t < c.until)?.text ?? null
      const logo = t >= LOGO_T
      const leaving = t >= END_T - 1.0
      const done = t >= END_T

      // ── the score's arc, beat by beat ──
      if (t >= BANG_T) once('bang', () => { playTitleBoom(1.0); score?.setDrone(73.42, 500, 0.4, 0.09) })
      if (t >= 4.95) once('battleA', () => { score?.setDrone(49.0, 420, 1.0, 0.09); nextPulse = t; nextOsti = t + 0.155; ostiBright = 0 })
      if (t >= 11.45) once('fleet', () => { score?.setDrone(55.0, 300, 1.4, 0.06); nextPulse = null; nextOsti = null })
      if (t >= 14.3) once('lance', () => { score?.setDrone(41.2, 220, 1.2, 0.08); score?.riser(FIRE_T - t); nextPulse = t + 0.4; pulseGap = 1.24 })
      if (t >= FIRE_T) once('fire', () => { score?.hit(); score?.setDrone(61.74, 520, 0.5, 0.09) })
      for (const c of CARDS) if (t >= c.at) once(`card-${c.text}`, () => score?.hit())
      if (t >= 21.5) once('battleB', () => { score?.setDrone(61.74, 620, 0.8, 0.1); nextPulse = t; pulseGap = 0.5; nextOsti = t + 0.125; ostiGap = 0.25; ostiBright = 1 })
      if (t >= LOGO_T) once('logo', () => { playTitleBoom(1.15); score?.chord(); score?.setDrone(36.71, 200, 1.5, 0.04); nextPulse = null; nextOsti = null })
      if (t >= END_T - 1.2) once('fade', () => score?.fadeOut(1.1))
      if (nextPulse != null && t >= nextPulse) { score?.thump(t >= 21.5 ? 1 : 0.8); nextPulse += pulseGap }
      if (nextOsti != null && t >= nextOsti) { score?.tickBlip(ostiBright); nextOsti += ostiGap }

      if (rootRef.current) rootRef.current.dataset.t = t.toFixed(2)
      setView((v) => (v.layer === layer && v.blink === blink && v.card === (card?.text ?? null) && v.caption === caption && v.logo === logo && v.leaving === leaving && v.done === done
        ? v
        : { layer, blink, card: card?.text ?? null, caption, logo, leaving, done }))
      if (t < END_T + 0.5) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => { cancelAnimationFrame(raf); score?.dispose() }
  }, [started])

  if (!started) {
    return (
      <div className="trailer">
        <div className="trailer-start">
          <button className="trailer-start-btn" onClick={() => setStarted(true)}>▶ ROLL TRAILER</button>
          <div className="trailer-start-hint">30 seconds · fullscreen recommended before rolling</div>
        </div>
      </div>
    )
  }

  return (
    <div className="trailer trailer--rolling" ref={rootRef}>
      {view.layer === 'cosmo'   && <StageLayer sceneDef={SCENES.cosmogony} />}
      {view.layer === 'battleA' && <div className="trailer-layer trailer-layer--clean"><SpaceBattleScreen key="A" campaign={BATTLE_A} onReturn={() => {}} /></div>}
      {view.layer === 'fleet'   && <div className="trailer-layer"><FleetReview testMode onExit={() => {}} /></div>}
      {view.layer === 'lance'   && <StageLayer sceneDef={SCENES.theLance} />}
      {view.layer === 'battleB' && <div className="trailer-layer trailer-layer--clean"><SpaceBattleScreen key="B" campaign={BATTLE_B} onReturn={() => {}} /></div>}

      {view.caption && !view.card && !view.blink && (
        <div className="trailer-caption" key={view.caption}>{view.caption}</div>
      )}

      {view.blink && <div className="trailer-blink" />}

      {view.card && (
        <div className="cut-titlecard" key={view.card}>
          <div className="cut-titlecard-name">{view.card}</div>
        </div>
      )}

      {view.logo && (
        <div className={`trailer-logo${view.leaving ? ' trailer-logo--out' : ''}`}>
          <div className="trailer-flash" />
          <div className="trailer-logo-name">Imperial Space Force</div>
          <div className="trailer-logo-motto">Caelum canit · illa avdit</div>
          <div className="trailer-logo-url">imperialspaceforce.com</div>
        </div>
      )}

      {view.done && (
        <div className="trailer-end">
          <button className="trailer-start-btn" onClick={() => window.location.reload()}>⟳ REPLAY</button>
        </div>
      )}
    </div>
  )
}
