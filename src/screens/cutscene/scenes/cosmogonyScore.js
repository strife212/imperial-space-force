import { registerAudioContext } from '../../../lib/audioUnlock'
import { playTitleBoom } from '../sfx'

// ── Cosmogony III · a fully synthesized score ────────────────────────────────
// No samples: every sound in the hybrid reel is generated here, on one WebAudio
// graph, so the whole cutscene speaks with a single voice. The design rides the
// scene's own theology:
//   · the BANG is the Cathedral (sfx.js's title-card boom — the same slam that
//     opens every cutscene, here opening the universe itself), and the young
//     universe under it keeps the original scene's asset: the bigbang.mp3
//     rumble, tape-slowed and half volume, fading out as the dive reaches the
//     world. The synthesized voice takes over from the first memory on.
//   · each age then hums on its own BED root, montage-fashion — a slow ascent
//     E → G → A → B through the rise of the makers, with the wind of the
//     living world fading out of the air as the machines close in — and the
//     reveal sinks home to D an octave under where the note began: the note,
//     remembered.
//   · MEMORY STRIKES give every photographic flash its era's voice (wind and
//     earth, a struck bell, an instrument blip, a data-chime), the ERA DRUM
//     marks every hard cut of the journey, and the last memory rings the
//     RADIANT CHORD — D major, everything the reel has heard resolving.
//   · the MACHINE HUM is synthesized mains — layered low sines breathing on a
//     slow LFO under a whisper of electrical hiss — and the activation TICKS
//     are bare data-blips with pitch jitter.
// The API mirrors the cosmogony scene's score interface (bang / bangFade /
// bangStop · humStart / humLevel / humStop · tick · eraCut · cityRise) plus
// the hybrid reel's extras (setEra, strike, start, dispose). bangFade/bangStop
// are no-ops here: the note's whole 18.5s death is scheduled at the bang.

const ERAS = {
  world:   { root: 41.20, cutoff: 260,  air: 0.05,  wet: 0.42 },  // E1 · the living world — wind enters
  temple:  { root: 49.00, cutoff: 420,  air: 0.028, wet: 0.38 },  // G1 · the charting mind
  city:    { root: 55.00, cutoff: 620,  air: 0.012, wet: 0.32 },  // A1 · the ascending city
  machine: { root: 61.74, cutoff: 950,  air: 0,     wet: 0.28 },  // B1 · the thinking sand — airless
  memory:  { root: 36.71, cutoff: 300,  air: 0.008, wet: 0.5  },  // D1 · the note, remembered
}
export function createCosmogonyScore() {
  const AC = window.AudioContext || window.webkitAudioContext
  if (!AC) return null
  const ctx = registerAudioContext(new AC())

  // master → gentle compression (the detonation needs headroom) → out
  const comp = ctx.createDynamicsCompressor()
  comp.threshold.value = -14; comp.knee.value = 18; comp.ratio.value = 3.5
  comp.attack.value = 0.003; comp.release.value = 0.3
  comp.connect(ctx.destination)
  const master = ctx.createGain(); master.gain.value = 0; master.connect(comp)
  const bus = ctx.createGain(); bus.connect(master)
  // the sense of space: a damped feedback delay, montage-fashion — its wet
  // level breathes with the eras (cavernous deep time, dry machine present)
  const delay = ctx.createDelay(1.5); delay.delayTime.value = 0.43
  const damp = ctx.createBiquadFilter(); damp.type = 'lowpass'; damp.frequency.value = 1900
  const fbk = ctx.createGain(); fbk.gain.value = 0.42
  const wet = ctx.createGain(); wet.gain.value = 0.42
  bus.connect(delay); delay.connect(damp); damp.connect(fbk); fbk.connect(delay); damp.connect(wet); wet.connect(master)

  // shared looped noise — wind, bursts, the detonation's body
  const nbuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate)
  { const nd = nbuf.getChannelData(0); for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1 }

  const now = () => ctx.currentTime
  const ramp = (param, v, t) => { param.cancelScheduledValues(now()); param.setValueAtTime(param.value, now()); param.linearRampToValueAtTime(v, now() + t) }

  // one enveloped oscillator / noise burst — the atoms every voice is built from
  const blip = (freq, at, len, level, type = 'sine', glideTo = null) => {
    const t0 = now() + 0.02 + at
    const o = ctx.createOscillator(); o.type = type; o.frequency.setValueAtTime(freq, t0)
    if (glideTo != null) o.frequency.exponentialRampToValueAtTime(Math.max(glideTo, 1), t0 + len)
    const g = ctx.createGain()
    g.gain.setValueAtTime(0.0001, t0)
    g.gain.exponentialRampToValueAtTime(Math.max(level, 0.0002), t0 + 0.014)
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + len)
    o.connect(g); g.connect(bus); o.start(t0); o.stop(t0 + len + 0.05)
  }
  const burst = (at, len, level, bpFreq, q = 1) => {
    const t0 = now() + 0.02 + at
    const src = ctx.createBufferSource(); src.buffer = nbuf; src.loop = true
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = bpFreq; bp.Q.value = q
    const g = ctx.createGain()
    g.gain.setValueAtTime(0.0001, t0)
    g.gain.exponentialRampToValueAtTime(Math.max(level, 0.0002), t0 + 0.02)
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + len)
    src.connect(bp); bp.connect(g); g.connect(bus); src.start(t0, Math.random()); src.stop(t0 + len + 0.05)
  }

  // ── the drone bed — silent until the first age is set ──────────────────────
  const droneFilter = ctx.createBiquadFilter(); droneFilter.type = 'lowpass'; droneFilter.frequency.value = 260; droneFilter.Q.value = 0.6
  const droneGain = ctx.createGain(); droneGain.gain.value = 0
  droneFilter.connect(droneGain); droneGain.connect(bus)
  const oscs = []
  const mkOsc = (type, ratio, level) => {
    const o = ctx.createOscillator(); o.type = type; o.frequency.value = ERAS.world.root * ratio
    const g = ctx.createGain(); g.gain.value = level
    o.connect(g); g.connect(droneFilter); o.start()
    oscs.push({ o, ratio })
  }
  mkOsc('sine', 0.5, 0.9)         // sub-octave anchor
  mkOsc('sawtooth', 1, 0.2)
  mkOsc('sawtooth', 1.006, 0.18)  // a hair sharp — slow beating, the bed breathes
  mkOsc('sine', 1.5, 0.26)        // the fifth

  // ── air — the wind of the living ages ──────────────────────────────────────
  const airNoise = ctx.createBufferSource(); airNoise.buffer = nbuf; airNoise.loop = true
  const airBP = ctx.createBiquadFilter(); airBP.type = 'bandpass'; airBP.frequency.value = 640; airBP.Q.value = 0.8
  const airGain = ctx.createGain(); airGain.gain.value = 0
  airNoise.connect(airBP); airBP.connect(airGain); airGain.connect(bus); airNoise.start()

  let curEra = null
  const setEra = (name) => {
    const e = ERAS[name]
    if (!e || name === curEra) return
    const first = curEra == null
    curEra = name
    for (const { o, ratio } of oscs) ramp(o.frequency, e.root * ratio, first ? 0.1 : 2.2)
    ramp(droneFilter.frequency, e.cutoff, 2.4)
    ramp(airGain.gain, e.air, 2.8)
    ramp(wet.gain, e.wet, 2.8)
    // the bed enters under the first memories (as the note dies), and settles
    // lower for the reveal — the chord and the watch own that dark
    ramp(droneGain.gain, name === 'memory' ? 0.07 : 0.1, first ? 3.0 : 2.2)
  }

  // ── the bang, and the young universe ────────────────────────────────────────
  // The space phase keeps the original scene's asset: the bigbang.mp3 rumble,
  // tape-slowed and half volume, looping under everything from first light to
  // the dive. The scene drives its death through bangFade/bangStop, exactly as
  // the plain cosmogony does.
  const AUDIO_BASE = import.meta.env?.BASE_URL ?? '/'
  const bangAudio = new Audio(`${AUDIO_BASE}bigbang.mp3`); bangAudio.preload = 'auto'; bangAudio.loop = true
  bangAudio.volume = 0.45; bangAudio.playbackRate = 0.5; bangAudio.preservesPitch = false
  const bang = () => {
    // the detonation is the Cathedral itself — the Mk II title-card boom every
    // cutscene opens on (its own context and reverb; sub drop, slam, crack,
    // the room answering) — struck here against the void, and a notch hotter:
    // it has the whole of creation to announce. The rumble rolls out under it.
    playTitleBoom(1.25)
    bangAudio.play().catch(() => {})
  }
  const bangFade = (k) => { bangAudio.volume = 0.45 * (1 - Math.max(0, Math.min(1, k))) }
  const bangStop = () => { if (!bangAudio.paused) bangAudio.pause() }

  // ── the machine hum — synthesized mains, breathing ──────────────────────────
  let humG = null
  const humStart = () => {
    if (humG) return
    humG = ctx.createGain(); humG.gain.value = 0; humG.connect(bus)
    const wobble = ctx.createGain(); wobble.gain.value = 1; wobble.connect(humG)
    const lfo = ctx.createOscillator(); lfo.frequency.value = 0.23
    const lfoAmt = ctx.createGain(); lfoAmt.gain.value = 0.18
    lfo.connect(lfoAmt); lfoAmt.connect(wobble.gain); lfo.start()
    for (const [f, l, type] of [[58, 0.5, 'sine'], [116, 0.3, 'sine'], [174, 0.12, 'sine'], [58, 0.1, 'sawtooth']]) {
      const o = ctx.createOscillator(); o.type = type; o.frequency.value = f
      const g = ctx.createGain(); g.gain.value = l
      if (type === 'sawtooth') { const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 300; o.connect(lp); lp.connect(g) }
      else o.connect(g)
      g.connect(wobble); o.start()
    }
    const hiss = ctx.createBufferSource(); hiss.buffer = nbuf; hiss.loop = true
    const hbp = ctx.createBiquadFilter(); hbp.type = 'bandpass'; hbp.frequency.value = 1100; hbp.Q.value = 2
    const hg = ctx.createGain(); hg.gain.value = 0.04
    hiss.connect(hbp); hbp.connect(hg); hg.connect(wobble); hiss.start()
  }
  const humLevel = (k) => { if (humG) humG.gain.value = 0.14 * Math.max(0, Math.min(1, k)) }
  const humStop = () => { if (humG) humG.gain.value = 0 }

  // ── the activation tick — a bare data-blip, pitch-jittered ──────────────────
  const tick = () => {
    blip(1150 + Math.random() * 380, 0, 0.05, 0.05)
    burst(0, 0.014, 0.03, 5200, 3)
  }

  // ── the era drum — the ceremonial strike + bronze bell at every hard cut ────
  const eraCut = (vol = 1.4) => {
    const t0 = now() + 0.02
    const out = ctx.createGain(); out.gain.value = vol; out.connect(bus)
    const o = ctx.createOscillator(); o.type = 'sine'
    o.frequency.setValueAtTime(96, t0); o.frequency.exponentialRampToValueAtTime(42, t0 + 0.5)
    const og = ctx.createGain()
    og.gain.setValueAtTime(0.0001, t0)
    og.gain.exponentialRampToValueAtTime(0.5, t0 + 0.012)
    og.gain.exponentialRampToValueAtTime(0.0001, t0 + 1.4)
    o.connect(og); og.connect(out); o.start(t0); o.stop(t0 + 1.5)
    const n = ctx.createBufferSource(); n.buffer = nbuf; n.loop = true
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 240
    const ng = ctx.createGain()
    ng.gain.setValueAtTime(0.28, t0); ng.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.3)
    n.connect(lp); lp.connect(ng); ng.connect(out); n.start(t0, Math.random()); n.stop(t0 + 0.4)
    for (const [f, g0, dur] of [[164, 0.1, 2.6], [219.4, 0.055, 2.0], [327.1, 0.03, 1.5]]) {
      const b = ctx.createOscillator(); b.type = 'sine'; b.frequency.value = f
      const bg = ctx.createGain()
      bg.gain.setValueAtTime(0.0001, t0 + 0.015)
      bg.gain.exponentialRampToValueAtTime(g0, t0 + 0.04)
      bg.gain.exponentialRampToValueAtTime(0.0001, t0 + dur)
      b.connect(bg); bg.connect(out); b.start(t0 + 0.015); b.stop(t0 + dur + 0.1)
    }
  }

  // ── the city-rise swell — filtered noise climbing as the towers do ──────────
  const cityRise = () => {
    const t0 = now() + 0.02
    const n = ctx.createBufferSource(); n.buffer = nbuf; n.loop = true
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = 1.1
    lp.frequency.setValueAtTime(90, t0); lp.frequency.exponentialRampToValueAtTime(340, t0 + 2.0)
    const g = ctx.createGain()
    g.gain.setValueAtTime(0.0001, t0)
    g.gain.linearRampToValueAtTime(0.34, t0 + 1.6)
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + 3.0)
    n.connect(lp); lp.connect(g); g.connect(bus); n.start(t0, Math.random()); n.stop(t0 + 3.2)
  }

  // ── memory strikes — each photographic flash in its era's voice ─────────────
  const strike = (kind) => {
    if (kind === 'world') {              // wind swell + earthen thud
      burst(0, 0.5, 0.14, 380, 0.7)
      blip(49, 0, 0.5, 0.22, 'sine', 38)
    } else if (kind === 'bell') {        // a small struck bell, three partials
      for (const [r, l] of [[1, 1], [2.76, 0.5], [5.4, 0.24]]) blip(523.25 * r, 0, 0.6, 0.1 * l)
    } else if (kind === 'figure') {      // instrument blip + shutter click
      blip(880, 0, 0.09, 0.12, 'square')
      burst(0, 0.03, 0.09, 4800, 3)
    } else if (kind === 'machine') {     // rising data-chime arpeggio + relay click
      for (const [r, at, l] of [[4, 0, 1], [6, 0.028, 0.62], [8, 0.056, 0.45]])
        blip(61.74 * r, at, 0.4, 0.1 * l, 'triangle')
      burst(0, 0.022, 0.07, 3200, 2.4)
    } else {                             // 'finale' — the radiant chord: D major, the note remembered
      const t0 = now() + 0.05
      for (const [f, l] of [[146.83, 0.15], [220, 0.12], [293.66, 0.1], [369.99, 0.08], [440, 0.06], [1174.66, 0.018]]) {
        const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = f
        const g = ctx.createGain()
        g.gain.setValueAtTime(0.0001, t0)
        g.gain.linearRampToValueAtTime(l, t0 + 1.2)
        g.gain.linearRampToValueAtTime(l * 0.8, t0 + 2.6)
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + 7.5)
        o.connect(g); g.connect(bus); o.start(t0); o.stop(t0 + 7.6)
      }
    }
  }

  const start = () => {
    ctx.resume?.().catch?.(() => {})
    ramp(master.gain, 0.55, 0.8)
  }
  const dispose = () => {
    bangAudio.pause()
    try { ctx.close() } catch { /* already closed */ }
  }

  return {
    bang, bangFade, bangStop,
    humStart, humLevel, humStop, tick, eraCut, cityRise,
    setEra, strike, start, dispose,
  }
}
