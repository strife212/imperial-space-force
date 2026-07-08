// ── Cosmogony II · programmatic soundscape ───────────────────────────────────
// No samples — pure WebAudio synthesis, driven by the reel itself so it adapts
// as slides are added or retimed. Three ingredients:
//   · a DRONE BED that climbs and brightens era by era (root note, filter
//     cutoff, air and reverb-space all keyed off each slide's `era`),
//   · per-slide STRIKES whose character follows the era (cosmic boom → wind →
//     chime → instrument blip → machine tick) and whose weight follows the
//     slide's hold time — so the reel's accelerando is *audible*: slow booms
//     in deep time become racing ticks at the end of history,
//   · a FINALE chord that arrests everything under the last held frame.
// API: createMontageAudio() → { start, setSlide(slide, k, isLast), finish, dispose }

const ERA_ROOT = { 1: 36.71, 2: 41.2, 3: 49.0, 4: 55.0, 5: 61.74 }   // D1 → E1 → G1 → A1 → B1: a slow ascent
const ERA_MOOD = {
  1: { cutoff: 130,  air: 0,     wet: 0.5 },    // the void — dark, cavernous
  2: { cutoff: 240,  air: 0.05,  wet: 0.42 },   // the living world — wind enters
  3: { cutoff: 420,  air: 0.025, wet: 0.36 },   // the charting mind — brighter, drier
  4: { cutoff: 700,  air: 0.008, wet: 0.3 },    // the modern eye — close, focused
  5: { cutoff: 1150, air: 0,     wet: 0.26 },   // the machine — bright, airless
}

export function createMontageAudio() {
  const AC = window.AudioContext || window.webkitAudioContext
  if (!AC) return null
  const ctx = new AC()

  const master = ctx.createGain(); master.gain.value = 0; master.connect(ctx.destination)
  const bus = ctx.createGain(); bus.connect(master)
  // cheap cathedral: a damped feedback delay as the sense of space
  const delay = ctx.createDelay(1.5); delay.delayTime.value = 0.43
  const damp = ctx.createBiquadFilter(); damp.type = 'lowpass'; damp.frequency.value = 1900
  const fbk = ctx.createGain(); fbk.gain.value = 0.42
  const wet = ctx.createGain(); wet.gain.value = 0.5
  bus.connect(delay); delay.connect(damp); damp.connect(fbk); fbk.connect(delay); damp.connect(wet); wet.connect(master)

  // ── drone bed: sub + two slow-beating roots + a fifth, through one filter ──
  const droneFilter = ctx.createBiquadFilter(); droneFilter.type = 'lowpass'; droneFilter.frequency.value = 130; droneFilter.Q.value = 0.6
  const droneGain = ctx.createGain(); droneGain.gain.value = 0.16
  droneFilter.connect(droneGain); droneGain.connect(bus)
  const oscs = []
  const mkOsc = (type, ratio, level) => {
    const o = ctx.createOscillator(); o.type = type; o.frequency.value = ERA_ROOT[1] * ratio
    const g = ctx.createGain(); g.gain.value = level
    o.connect(g); g.connect(droneFilter); o.start()
    oscs.push({ o, ratio })
  }
  mkOsc('sine', 0.5, 0.9)         // sub-octave anchor
  mkOsc('sawtooth', 1, 0.22)
  mkOsc('sawtooth', 1.006, 0.2)   // a hair sharp — slow beating, the drone breathes
  mkOsc('sine', 1.5, 0.3)         // the fifth

  // ── air: looped noise through a bandpass — the wind of the living ages ──
  const nbuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate)
  const nd = nbuf.getChannelData(0)
  for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1
  const noise = ctx.createBufferSource(); noise.buffer = nbuf; noise.loop = true
  const airBP = ctx.createBiquadFilter(); airBP.type = 'bandpass'; airBP.frequency.value = 640; airBP.Q.value = 0.8
  const airGain = ctx.createGain(); airGain.gain.value = 0
  noise.connect(airBP); airBP.connect(airGain); airGain.connect(bus); noise.start()

  const now = () => ctx.currentTime
  const ramp = (param, v, t) => { param.cancelScheduledValues(now()); param.setValueAtTime(param.value, now()); param.linearRampToValueAtTime(v, now() + t) }

  // one enveloped oscillator — the atom every strike is built from
  const blip = (freq, t0, len, level, type = 'sine', glideTo = null) => {
    const o = ctx.createOscillator(); o.type = type; o.frequency.setValueAtTime(freq, t0)
    if (glideTo != null) o.frequency.exponentialRampToValueAtTime(Math.max(glideTo, 1), t0 + len)
    const g = ctx.createGain()
    g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(Math.max(level, 0.0002), t0 + 0.014); g.gain.exponentialRampToValueAtTime(0.0001, t0 + len)
    o.connect(g); g.connect(bus); o.start(t0); o.stop(t0 + len + 0.05)
  }
  const burst = (t0, len, level, bpFreq, q = 1) => {
    const src = ctx.createBufferSource(); src.buffer = nbuf
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = bpFreq; bp.Q.value = q
    const g = ctx.createGain()
    g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(Math.max(level, 0.0002), t0 + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t0 + len)
    src.connect(bp); bp.connect(g); g.connect(bus); src.start(t0, Math.random()); src.stop(t0 + len + 0.05)
  }

  // per-slide strike — era picks the voice, dur picks the weight, so the
  // accelerando shrinks each strike from a swell to a tick automatically
  const strike = (era, dur) => {
    const t0 = now() + 0.02
    const w = Math.min(1, Math.max(0.15, dur / 2.4))   // weight ∝ hold time
    if (era === 1) {
      blip(82, t0, 0.55 + 1.1 * w, 0.28 + 0.3 * w, 'sine', 27)              // a falling cosmic boom
    } else if (era === 2) {
      burst(t0, 0.25 + 0.5 * w, 0.05 + 0.16 * w, 380, 0.7)                  // wind swell
      blip(49, t0, 0.3 + 0.4 * w, 0.14 + 0.16 * w, 'sine', 38)              // earthen thud
    } else if (era === 3) {
      for (const [r, l] of [[1, 1], [2.76, 0.5], [5.4, 0.24]])              // a small struck bell
        blip(523.25 * r, t0, (0.35 + 0.55 * w), (0.05 + 0.09 * w) * l, 'sine')
    } else if (era === 4) {
      blip(880, t0, 0.09, 0.1 + 0.06 * w, 'square')                         // instrument blip
      burst(t0, 0.03, 0.08, 4800, 3)                                        // shutter click
    } else {
      // a data-chime: a quick rising triangle arpeggio in the era's key
      // (B · F♯ · B) over a relay-click — bright with a slight machine edge
      for (const [r, at, l] of [[4, 0, 1], [6, 0.028, 0.62], [8, 0.056, 0.45]])
        blip(ERA_ROOT[5] * r, t0 + at, 0.22 + 0.34 * w, (0.08 + 0.06 * w) * l, 'triangle')
      burst(t0, 0.022, 0.065, 3200, 2.4)
    }
    // racing pulse: sub-ticks between fast cuts so the sprint is felt in the
    // body — pitched to the era's root so they ride the drone, not fight it
    if (dur < 0.7 && era >= 4) blip(ERA_ROOT[era] * 16, t0 + dur / 2, 0.05, 0.028, 'sine')
  }

  // the radiant chord — everything recedes beneath it (sfx: 'finale'). Its
  // gain nodes are kept so the silence cut can release them into a long decay.
  let finaleGains = []
  const finaleChord = () => {
    const t0 = now() + 0.05
    ramp(droneGain.gain, 0.05, 1.2)
    finaleGains = []
    for (const [f, l] of [[146.83, 0.16], [220, 0.13], [293.66, 0.11], [369.99, 0.09], [440, 0.07], [1174.66, 0.02]]) {
      const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = f
      const g = ctx.createGain()
      g.gain.setValueAtTime(0.0001, t0); g.gain.linearRampToValueAtTime(l, t0 + 1.6); g.gain.linearRampToValueAtTime(l * 0.8, t0 + 3.2)
      o.connect(g); g.connect(bus); o.start(t0); o.stop(t0 + 12)
      finaleGains.push(g)
    }
  }

  // the detonation (sfx: 'trinity') — staged like the real thing:
  //   1 · the FLASH: everything (bed, air, even the reverb tail) cut dead
  //   2 · a genuine beat of dead air — the terror is in the waiting
  //   3 · the HIT: a broadband crack over a layered, *sustained* sub drop
  //       with a distorted mid growl — weight that hangs, not a thump
  //   4 · the blast wave rolls in late and rumbles out long
  //   5 · a faint high whine after — ears ringing — as the bed creeps back
  const trinity = (dur) => {
    const t = now()
    // 1 · flash: total blackout, reverb feedback choked so the silence is real
    ramp(droneGain.gain, 0.0001, 0.04)
    ramp(airGain.gain, 0, 0.04)
    ramp(fbk.gain, 0.05, 0.04)
    const hit = t + 0.26   // 2 · dead air
    const env = (g, pts) => { g.gain.setValueAtTime(0.0001, pts[0][0]); for (const [tt, v, exp] of pts.slice(1)) exp ? g.gain.exponentialRampToValueAtTime(Math.max(v, 0.0001), tt) : g.gain.linearRampToValueAtTime(v, tt) }
    // 3a · the crack — a hot broadband snap (its single slapback echo survives)
    {
      const src = ctx.createBufferSource(); src.buffer = nbuf
      const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 1100
      const g = ctx.createGain(); env(g, [[hit], [hit + 0.006, 0.55], [hit + 0.11, 0.0001, true]])
      src.connect(hp); hp.connect(g); g.connect(bus); src.start(hit, Math.random()); src.stop(hit + 0.2)
    }
    // 3b · the sub detonation — attack, then a held shoulder before the long die-off
    {
      const o = ctx.createOscillator(); o.type = 'sine'
      o.frequency.setValueAtTime(58, hit); o.frequency.exponentialRampToValueAtTime(13, hit + 2.1)
      const g = ctx.createGain(); env(g, [[hit], [hit + 0.01, 0.9], [hit + 0.55, 0.5], [hit + 2.3, 0.0001, true]])
      o.connect(g); g.connect(bus); o.start(hit); o.stop(hit + 2.4)
    }
    // 3c · octave body + distorted growl — the mid-weight that reads on small speakers
    {
      const o = ctx.createOscillator(); o.type = 'sine'
      o.frequency.setValueAtTime(116, hit); o.frequency.exponentialRampToValueAtTime(28, hit + 0.9)
      const g = ctx.createGain(); env(g, [[hit], [hit + 0.012, 0.5], [hit + 1.0, 0.0001, true]])
      o.connect(g); g.connect(bus); o.start(hit); o.stop(hit + 1.1)
    }
    {
      const o = ctx.createOscillator(); o.type = 'sawtooth'
      o.frequency.setValueAtTime(88, hit); o.frequency.exponentialRampToValueAtTime(22, hit + 0.7)
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 480
      const g = ctx.createGain(); env(g, [[hit], [hit + 0.015, 0.24], [hit + 0.85, 0.0001, true]])
      o.connect(lp); lp.connect(g); g.connect(bus); o.start(hit); o.stop(hit + 0.95)
    }
    // 4 · the blast wave, arriving late, and a long rolling tail
    {
      const src = ctx.createBufferSource(); src.buffer = nbuf; src.loop = true
      const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 85; bp.Q.value = 0.4
      const g = ctx.createGain(); env(g, [[hit + 0.3], [hit + 0.75, 0.55], [hit + 2.8, 0.0001, true]])
      src.connect(bp); bp.connect(g); g.connect(bus); src.start(hit + 0.3, Math.random()); src.stop(hit + 3.0)
    }
    // 5 · ears ringing — a faint high whine hanging in the hush
    {
      const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = 2900
      const g = ctx.createGain(); env(g, [[hit + 0.12], [hit + 0.5, 0.022], [hit + 2.0, 0.0001, true]])
      o.connect(g); g.connect(bus); o.start(hit + 0.12); o.stop(hit + 2.1)
    }
    // bed and space return under the resumed sprint
    setTimeout(() => { ramp(droneGain.gain, 0.16, 1.6); ramp(fbk.gain, 0.42, 1.0) }, dur * 1000)
  }

  let curEra = 0
  // slide.sfx overrides the era strike: 'trinity' → the detonation ·
  // 'finale' → the radiant chord ·
  // 'bell' → a lone revelation bell (under whatever still rings) ·
  // 'silence' → everything stops dead on the cut
  const setSlide = (slide) => {
    const era = slide.era || 1
    if (slide.sfx === 'silence') {
      // not a dead stop: the bed and air cut, but the finale chord is released
      // into a long natural decay — the first note's echo dying back into the
      // field — reaching true silence in the first seconds of the credits
      // (finish()'s master fade at reel-end closes whatever remains).
      const t = now()
      ramp(droneGain.gain, 0.0001, 0.12)
      ramp(airGain.gain, 0, 0.12)
      for (const g of finaleGains) {
        try { g.gain.cancelAndHoldAtTime(t) } catch (_) { g.gain.cancelScheduledValues(t); g.gain.setValueAtTime(0.1, t) }
        g.gain.exponentialRampToValueAtTime(0.0001, t + 6.5)
      }
      curEra = era   // retune the bed under the tail so a replay starts coherent
      for (const { o, ratio } of oscs) ramp(o.frequency, ERA_ROOT[era] * ratio, 0.5)
      ramp(droneFilter.frequency, ERA_MOOD[era].cutoff, 0.5)
      ramp(airGain.gain, ERA_MOOD[era].air === 0 ? 0 : 0.0001, 0.5)
      ramp(wet.gain, ERA_MOOD[era].wet, 0.5)
      return
    }
    if (era !== curEra) {
      curEra = era
      const mood = ERA_MOOD[era]
      for (const { o, ratio } of oscs) ramp(o.frequency, ERA_ROOT[era] * ratio, 1.8)
      ramp(droneFilter.frequency, mood.cutoff, 2.2)
      ramp(airGain.gain, mood.air, 2.5)
      ramp(wet.gain, mood.wet, 2.5)
    }
    if (slide.sfx === 'trinity') { trinity(slide.dur); return }
    if (slide.sfx === 'finale') { finaleChord(); return }
    if (slide.sfx === 'bell') {
      const t0 = now() + 0.02
      for (const [r, l] of [[1, 1], [2.76, 0.5], [5.4, 0.24]]) blip(523.25 * r, t0, 1.1, 0.12 * l, 'sine')
      return
    }
    strike(era, slide.dur)
  }

  const start = () => {
    ctx.resume?.()
    ramp(master.gain, 0.55, 1.0)
    ramp(droneGain.gain, 0.16, 1.0)   // restored after a finale, for replays
  }
  const finish = () => ramp(master.gain, 0, 2.8)
  const dispose = () => { try { ctx.close() } catch (_) { /* noop */ } }

  return { start, setSlide, finish, dispose }
}
