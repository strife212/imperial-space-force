// Shared "gold ace" warp sound: the hyperspace sweep dressed with a bright
// four-note shimmer so the elite's entrance and exit read as their own event.
// Used by both the battle and the fleet-review preview so the ability sounds
// identical in each. Synth-only — owns a single lazily-created AudioContext.

import { registerAudioContext } from './audioUnlock'

let ctx = null, master = null, convInput = null, noiseBuf = null

function init() {
  if (ctx) return ctx
  try { ctx = registerAudioContext(new (window.AudioContext || window.webkitAudioContext)()) } catch (_) { return null }
  master = ctx.createGain(); master.gain.value = 0.4; master.connect(ctx.destination)
  // a touch of synthetic reverb for a sense of space
  const conv = ctx.createConvolver()
  const len = Math.floor(ctx.sampleRate * 1.1), b = ctx.createBuffer(2, len, ctx.sampleRate)
  for (let c = 0; c < 2; c++) { const d = b.getChannelData(c); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.6) }
  conv.buffer = b
  const wet = ctx.createGain(); wet.gain.value = 0.35; conv.connect(wet); wet.connect(master)
  convInput = conv
  noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 1.2, ctx.sampleRate)
  const nd = noiseBuf.getChannelData(0)
  for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1
  return ctx
}

const send = (node, amt) => { if (!convInput) return; const s = ctx.createGain(); s.gain.value = amt; node.connect(s); s.connect(convInput) }

// dir 'in' sweeps up into a rising arpeggio; 'out' pings a falling one, then drops away.
export function playAceWarp(dir = 'in', { muted = false } = {}) {
  if (muted) return
  const c = init(); if (!c) return
  if (c.state === 'suspended') c.resume()
  const now = c.currentTime
  const rise = dir === 'in'
  const src = c.createBufferSource(); src.buffer = noiseBuf
  const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 1.6
  bp.frequency.setValueAtTime(rise ? 220 : 2400, now)
  bp.frequency.exponentialRampToValueAtTime(rise ? 2400 : 220, now + 0.55)
  const g = c.createGain()
  g.gain.setValueAtTime(0.0001, now)
  g.gain.linearRampToValueAtTime(0.55, now + (rise ? 0.35 : 0.12))
  g.gain.exponentialRampToValueAtTime(0.0001, now + 0.9)
  src.connect(bp); bp.connect(g); g.connect(master); send(g, 0.5)
  src.start(now); src.stop(now + 1.0)
  const notes = rise ? [1046.5, 1318.5, 1568, 2093] : [2093, 1568, 1318.5, 1046.5]
  const t0 = rise ? 0.32 : 0.02   // in: shimmer as it drops from warp; out: shimmer first, then fall
  notes.forEach((f, i) => {
    const o = c.createOscillator(); o.type = 'sine'; o.frequency.value = f
    const og = c.createGain()
    const tt = now + t0 + i * 0.05
    og.gain.setValueAtTime(0.0001, tt)
    og.gain.exponentialRampToValueAtTime(0.3, tt + 0.012)
    og.gain.exponentialRampToValueAtTime(0.0001, tt + (rise ? 0.5 : 0.35))
    o.connect(og); og.connect(master); send(og, 0.55)
    o.start(tt); o.stop(tt + 0.55)
  })
}
