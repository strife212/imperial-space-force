// Shared "capital lance" sound sequence: a sustained charge tone that is cut off
// the instant the lance fires, immediately followed by an explosion. Used by both
// the battle and the fleet-review preview so the ability sounds identical in each.
//
// Owns a single lazily-created AudioContext and caches the charge/explosion
// samples from public/sfx/, with synthesised fallbacks if a file is missing.

const BASE = import.meta.env?.BASE_URL ?? '/'
const FILES = { charge: 'sfx/charge.mp3', explosion: 'sfx/explosion.mp3' }

let ctx = null, master = null, convInput = null
const buffers = {}

function init() {
  if (ctx) return ctx
  try { ctx = new (window.AudioContext || window.webkitAudioContext)() } catch (_) { return null }
  master = ctx.createGain(); master.gain.value = 0.4; master.connect(ctx.destination)
  // a touch of synthetic reverb for a sense of space
  const conv = ctx.createConvolver()
  const len = Math.floor(ctx.sampleRate * 1.1), b = ctx.createBuffer(2, len, ctx.sampleRate)
  for (let c = 0; c < 2; c++) { const d = b.getChannelData(c); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.6) }
  conv.buffer = b
  const wet = ctx.createGain(); wet.gain.value = 0.35; conv.connect(wet); wet.connect(master)
  convInput = conv
  // load the samples (missing files simply fall back to the synth versions)
  for (const [k, f] of Object.entries(FILES)) {
    fetch(`${BASE}${f}`)
      .then(r => { const t = r.headers.get('content-type') || ''; if (!r.ok || t.includes('text/html')) throw 0; return r.arrayBuffer() })
      .then(ab => ctx.decodeAudioData(ab)).then(buf => { buffers[k] = buf }).catch(() => {})
  }
  return ctx
}

const send = (node, amt) => { if (!convInput) return; const s = ctx.createGain(); s.gain.value = amt; node.connect(s); s.connect(convInput) }

// Warm up the audio context + sample cache ahead of time (no sound played), so
// the first lance fire has no fetch/decode delay. Safe to call repeatedly.
export function preloadLanceSfx() { init() }

// Fire a one-off explosion (the same sample the lance boom uses). Handy for the
// fleet-review barrage preview, which has no battle audio engine of its own.
export function playExplosion({ muted = false } = {}) {
  if (muted) return
  const c = init(); if (!c) return
  if (c.state === 'suspended') c.resume()
  boom()
}

function boom() {
  if (!ctx) return
  const now = ctx.currentTime
  if (buffers.explosion) {
    const src = ctx.createBufferSource(); src.buffer = buffers.explosion
    const g = ctx.createGain(); g.gain.value = 1
    src.connect(g); g.connect(master); send(g, 0.5); src.start(); return
  }
  // synth fallback: noise body sweeping down + a sub-bass thump
  const out = ctx.createGain(); out.connect(master); send(out, 0.5)
  const noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate); const nd = noise.getChannelData(0)
  for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1
  const nb = ctx.createBufferSource(); nb.buffer = noise; nb.loop = true
  const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.setValueAtTime(1700, now); lp.frequency.exponentialRampToValueAtTime(120, now + 1.1)
  const ng = ctx.createGain(); ng.gain.setValueAtTime(0.6, now); ng.gain.exponentialRampToValueAtTime(0.0001, now + 1.1)
  nb.connect(lp); lp.connect(ng); ng.connect(out); nb.start(now); nb.stop(now + 1.15)
  const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.setValueAtTime(110, now); o.frequency.exponentialRampToValueAtTime(32, now + 0.6)
  const og = ctx.createGain(); og.gain.setValueAtTime(0.9, now); og.gain.exponentialRampToValueAtTime(0.0001, now + 0.8)
  o.connect(og); og.connect(out); o.start(now); o.stop(now + 0.85)
}

// Start the lance charge tone. Returns a discharge function:
//   discharge()       → cut the charge (quick fade) AND fire the explosion
//   discharge(false)  → cut the charge only (e.g. the charge was aborted)
// The returned function is idempotent. When `muted`, it's a silent no-op.
// `rate` stretches the sample (playbackRate — pitch drops with it: 0.6 plays
// ~1.7× longer and deeper); `volume` scales the charge level only.
export function playLanceCharge({ muted = false, rate = 1, volume = 1 } = {}) {
  if (muted) return () => {}
  const c = init(); if (!c) return () => {}
  if (c.state === 'suspended') c.resume()
  const now = c.currentTime
  let src = null, o1 = null, o2 = null, g
  if (buffers.charge) {
    src = c.createBufferSource(); src.buffer = buffers.charge
    src.playbackRate.value = rate
    g = c.createGain(); g.gain.value = 0.95 * volume
    src.connect(g); g.connect(master); send(g, 0.15); src.start()
  } else {
    const T = 3 / rate   // stretch the synth swell to match
    g = c.createGain(); g.gain.setValueAtTime(0.0001, now); g.gain.linearRampToValueAtTime(0.16 * volume, now + 0.5 / rate)
    o1 = c.createOscillator(); o1.type = 'sawtooth'; o1.frequency.setValueAtTime(110 * rate, now); o1.frequency.exponentialRampToValueAtTime(880 * rate, now + T)
    o2 = c.createOscillator(); o2.type = 'sine'; o2.frequency.setValueAtTime(220 * rate, now); o2.frequency.exponentialRampToValueAtTime(1760 * rate, now + T)
    const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.setValueAtTime(700, now); lp.frequency.exponentialRampToValueAtTime(4200, now + T); lp.Q.value = 7
    o1.connect(lp); o2.connect(lp); lp.connect(g); g.connect(master); send(g, 0.2); o1.start(now); o2.start(now)
  }
  let done = false
  return (fireBoom = true) => {
    if (done) return; done = true
    const t = c.currentTime
    try {
      g.gain.cancelScheduledValues(t); g.gain.setValueAtTime(g.gain.value, t); g.gain.linearRampToValueAtTime(0.0001, t + 0.04)
      if (src) src.stop(t + 0.06); if (o1) o1.stop(t + 0.06); if (o2) o2.stop(t + 0.06)
    } catch (_) { /* already stopped */ }
    if (fireBoom) boom()
  }
}
