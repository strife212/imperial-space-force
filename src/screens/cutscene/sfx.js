import { getFlag } from '../../lib/store'
import { registerAudioContext } from '../../lib/audioUnlock'

// ── Cutscene sound engine ────────────────────────────────────────────────────
// A trimmed-down sibling of the battle screen's procedural audio: one lazily
// resumed AudioContext per stage, master bus with compression + synthetic
// reverb, and the same sample-first / synth-fallback policy (laser.mp3 and
// explosion.mp3 from public/sfx/ when present). The stage wires laser/explosion
// into the FX pools so every scene's bolts and blasts are audible for free;
// scenes reach the rest through ctx.sfx (jump chirps for warp-ins, comms blips,
// coil blips, ambient music beds). Respects the battle's persisted mute flag.
// dispose() silences everything dead — skip-safe.

const BASE = import.meta.env?.BASE_URL ?? '/'
const FILES = { laser: 'sfx/laser.mp3', explosion: 'sfx/explosion.mp3' }

// ── Mission title-card boom · "Cathedral" ────────────────────────────────────
// A one-shot cinematic slam for the black title cards: a deep sub drop and a
// noise-slam attack that BLOOM into a vast 3.6s reverberant space, with a low
// fifth swelling up out of the wash — the room answering. Module-level with
// its own lazy context (and cached impulse) — the card plays before any stage
// audio engine exists.
//
// Mk II (the shipped version) layers on what small speakers can actually
// reproduce — a bright crack, a 650Hz punch, a whisper of metallic afterring —
// and runs a notch hotter. Mk I (the original, sub-heavy Cathedral) is kept
// below as playTitleBoomMk1 for reference and A-B listening.
let boomCtx = null, boomIR = null
function castCathedral(mk2, vol = 1) {
  if (getFlag('soundMuted')) return
  try { boomCtx = boomCtx || registerAudioContext(new (window.AudioContext || window.webkitAudioContext)()) } catch (_) { return }
  const ctx = boomCtx
  if (ctx.state === 'suspended') ctx.resume().catch(() => {})
  const t0 = ctx.currentTime + 0.03

  const comp = ctx.createDynamicsCompressor()
  comp.threshold.value = -12; comp.knee.value = 16; comp.ratio.value = 4; comp.attack.value = 0.002; comp.release.value = 0.35
  const master = ctx.createGain(); master.gain.value = (mk2 ? 1.0 : 0.85) * vol
  comp.connect(master); master.connect(ctx.destination)

  // the cathedral: a long synthetic impulse, built once and cached
  if (!boomIR) {
    const irLen = Math.floor(ctx.sampleRate * 3.6)
    boomIR = ctx.createBuffer(2, irLen, ctx.sampleRate)
    for (let ch = 0; ch < 2; ch++) {
      const d = boomIR.getChannelData(ch)
      for (let i = 0; i < irLen; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / irLen, 2.2)
    }
  }
  const conv = ctx.createConvolver(); conv.buffer = boomIR
  const wet = ctx.createGain(); wet.gain.value = 0.75; conv.connect(wet); wet.connect(comp)
  const bus = ctx.createGain(); bus.connect(comp); bus.connect(conv)

  // 1 · sub-bass drop — the floor falls out
  const sub = ctx.createOscillator(); sub.type = 'sine'
  sub.frequency.setValueAtTime(65, t0); sub.frequency.exponentialRampToValueAtTime(22, t0 + 1.2)
  const subG = ctx.createGain()
  subG.gain.setValueAtTime(0.0001, t0); subG.gain.exponentialRampToValueAtTime(0.95, t0 + 0.012)
  subG.gain.exponentialRampToValueAtTime(0.0001, t0 + 2.2)
  sub.connect(subG); subG.connect(bus); sub.start(t0); sub.stop(t0 + 2.3)

  // 2 · the slam — a band-passed noise impact for the attack
  const nbuf = ctx.createBuffer(1, ctx.sampleRate * 0.5, ctx.sampleRate)
  const nd = nbuf.getChannelData(0)
  for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1
  const noise = ctx.createBufferSource(); noise.buffer = nbuf
  const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 190; bp.Q.value = 0.8
  const nG = ctx.createGain()
  nG.gain.setValueAtTime(mk2 ? 0.7 : 0.6, t0); nG.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.26)
  noise.connect(bp); bp.connect(nG); nG.connect(bus); noise.start(t0); noise.stop(t0 + 0.35)

  // 3 · the space answers — a low fifth swelling out of the wash
  for (const f of [55, 82.4]) {
    const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = f
    const g = ctx.createGain()
    g.gain.setValueAtTime(0.0001, t0 + 0.3); g.gain.linearRampToValueAtTime(f > 60 ? 0.07 : 0.11, t0 + 1.3)
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + 3.4)
    o.connect(g); g.connect(bus); o.start(t0 + 0.3); o.stop(t0 + 3.5)
  }

  if (!mk2) return
  // ── Mk II additions: energy where ears and small drivers live ──
  // 4 · the crack — a short bright transient snap on the attack
  const cr = ctx.createBufferSource(); cr.buffer = nbuf
  const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 1400; hp.Q.value = 0.7
  const cg = ctx.createGain()
  cg.gain.setValueAtTime(0.38, t0); cg.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.08)
  cr.connect(hp); hp.connect(cg); cg.connect(bus); cr.start(t0, 0.13); cr.stop(t0 + 0.12)
  // 5 · the mid punch — 650Hz body under the crack
  const pu = ctx.createBufferSource(); pu.buffer = nbuf
  const pb = ctx.createBiquadFilter(); pb.type = 'bandpass'; pb.frequency.value = 650; pb.Q.value = 0.9
  const pg = ctx.createGain()
  pg.gain.setValueAtTime(0.5, t0); pg.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.2)
  pu.connect(pb); pb.connect(pg); pg.connect(bus); pu.start(t0, 0.21); pu.stop(t0 + 0.28)
  // 6 · a whisper of metallic afterring in the wash
  for (const [f, g0] of [[178, 0.045], [241.3, 0.035]]) {
    const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = f
    const g = ctx.createGain()
    g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(g0, t0 + 0.015)
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + 1.4)
    o.connect(g); g.connect(bus); o.start(t0); o.stop(t0 + 1.5)
  }
}
export function playTitleBoom(vol) { castCathedral(true, vol) }   // Mk II — shipped · vol scales the mix (post-compressor)
export function playTitleBoomMk1() { castCathedral(false) }        // the original, kept for A-B

export function createCutsceneSfx() {
  let ctx = null
  try { ctx = new (window.AudioContext || window.webkitAudioContext)() } catch (_) { /* no audio */ }
  const muted = () => !!getFlag('soundMuted')
  const tracks = []            // HTMLAudio beds to pause at teardown
  if (!ctx) {
    const silentBed = () => ({ el: null, setVolume: () => {}, play: () => {} })
    return { laser: () => {}, explosion: () => {}, jump: () => {}, comms: () => {}, blip: () => {}, ping: () => {}, rumble: () => {}, bed: silentBed, dispose: () => { tracks.forEach(a => a.pause()) } }
  }

  const master = ctx.createGain(); master.gain.value = 0.3
  const comp = ctx.createDynamicsCompressor()
  comp.threshold.value = -16; comp.knee.value = 22; comp.ratio.value = 3.2; comp.attack.value = 0.003; comp.release.value = 0.25
  comp.connect(master); master.connect(ctx.destination)

  // synthetic-impulse reverb send, as in the battle engine
  const conv = ctx.createConvolver()
  { const len = Math.floor(ctx.sampleRate * 1.2), b = ctx.createBuffer(2, len, ctx.sampleRate)
    for (let ch = 0; ch < 2; ch++) { const d = b.getChannelData(ch); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.6) }
    conv.buffer = b }
  const wet = ctx.createGain(); wet.gain.value = 0.45; conv.connect(wet); wet.connect(comp)
  const dry = ctx.createGain(); dry.connect(comp)
  const sendTo = (node, amt) => { const s = ctx.createGain(); s.gain.value = amt; node.connect(s); s.connect(conv) }

  const noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate)
  { const nd = noiseBuf.getChannelData(0); for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1 }

  const buffers = {}
  for (const [k, f] of Object.entries(FILES)) {
    fetch(`${BASE}${f}`)
      .then(r => { const t = r.headers.get('content-type') || ''; if (!r.ok || t.includes('text/html')) throw 0; return r.arrayBuffer() })
      .then(ab => ctx.decodeAudioData(ab)).then(buf => { buffers[k] = buf }).catch(() => {})
  }
  const playSample = (buf, gain, rate, reverb) => {
    const src = ctx.createBufferSource(); src.buffer = buf
    src.playbackRate.value = rate || 1
    const g = ctx.createGain(); g.gain.value = gain ?? 1
    src.connect(g); g.connect(dry)
    if (reverb) sendTo(g, reverb)
    src.start()
  }

  // Safari holds the context suspended until a gesture-stack resume — the
  // shared unlocker retries on every pointer / touch / key gesture
  registerAudioContext(ctx)

  let lastLaser = 0, lastBoom = 0    // rate limits so volleys don't stack into noise

  const laser = (team = 'blue', big = false) => {
    if (muted()) return
    const now = ctx.currentTime
    if (now - lastLaser < 0.07) return
    lastLaser = now
    const vol = big ? 0.85 : 0.4
    if (buffers.laser) { playSample(buffers.laser, vol, (big ? 0.8 : 0.95) + Math.random() * 0.1, 0.1); return }
    const out = ctx.createGain()
    out.gain.setValueAtTime(0.0001, now)
    out.gain.linearRampToValueAtTime(0.18 * (vol / 0.85), now + 0.005)
    out.gain.exponentialRampToValueAtTime(0.0001, now + 0.18)
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = team === 'blue' ? 2400 : 1900; lp.Q.value = 7
    const f0 = (team === 'blue' ? 700 : 500) * (0.95 + Math.random() * 0.1) * (big ? 0.6 : 1)
    const o1 = ctx.createOscillator(); o1.type = 'triangle'
    o1.frequency.setValueAtTime(f0 * 2, now); o1.frequency.exponentialRampToValueAtTime(f0 * 0.55, now + 0.14)
    o1.connect(lp); lp.connect(out); o1.start(now); o1.stop(now + 0.19)
    out.connect(dry); sendTo(out, 0.1)
  }

  const explosion = (big = false) => {
    if (muted()) return
    const now = ctx.currentTime
    if (now - lastBoom < 0.09) return
    lastBoom = now
    if (buffers.explosion) { playSample(buffers.explosion, big ? 1 : 0.7, big ? 0.9 : 1.05 + Math.random() * 0.1, big ? 0.6 : 0.35); return }
    const dur = big ? 1.1 : 0.6
    const out = ctx.createGain()
    const bb = ctx.createBufferSource(); bb.buffer = noiseBuf; bb.loop = true
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'
    lp.frequency.setValueAtTime(big ? 1700 : 1200, now); lp.frequency.exponentialRampToValueAtTime(big ? 110 : 190, now + dur)
    const bg = ctx.createGain(); bg.gain.setValueAtTime(big ? 0.55 : 0.35, now); bg.gain.exponentialRampToValueAtTime(0.0001, now + dur)
    bb.connect(lp); lp.connect(bg); bg.connect(out); bb.start(now); bb.stop(now + dur + 0.05)
    const o = ctx.createOscillator(); o.type = 'sine'
    o.frequency.setValueAtTime(big ? 110 : 145, now); o.frequency.exponentialRampToValueAtTime(big ? 32 : 50, now + dur * 0.5)
    const og = ctx.createGain(); og.gain.setValueAtTime(big ? 0.9 : 0.55, now); og.gain.exponentialRampToValueAtTime(0.0001, now + dur * 0.7)
    o.connect(og); og.connect(out); o.start(now); o.stop(now + dur)
    out.connect(dry); sendTo(out, big ? 0.6 : 0.35)
  }

  // hyperspace arrival — rising band-passed noise sweep + saw undertone
  const jump = (vol = 1) => {
    if (muted()) return
    const now = ctx.currentTime
    const src = ctx.createBufferSource(); src.buffer = noiseBuf
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 1.4
    bp.frequency.setValueAtTime(180, now); bp.frequency.exponentialRampToValueAtTime(2600, now + 0.55)
    const g = ctx.createGain()
    g.gain.setValueAtTime(0.0001, now)
    g.gain.linearRampToValueAtTime(0.22 * vol, now + 0.35)
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.95)
    src.connect(bp); bp.connect(g); g.connect(dry); sendTo(g, 0.5); src.start(now); src.stop(now + 1.0)
    const o = ctx.createOscillator(); o.type = 'sawtooth'
    o.frequency.setValueAtTime(70, now); o.frequency.exponentialRampToValueAtTime(520, now + 0.55)
    const olp = ctx.createBiquadFilter(); olp.type = 'lowpass'; olp.frequency.value = 1800
    const og = ctx.createGain()
    og.gain.setValueAtTime(0.0001, now)
    og.gain.linearRampToValueAtTime(0.11 * vol, now + 0.35); og.gain.exponentialRampToValueAtTime(0.0001, now + 0.85)
    o.connect(olp); olp.connect(og); og.connect(dry); o.start(now); o.stop(now + 0.9)
  }

  // comms-open chirp — the battle's two-tone radio blip
  const comms = () => {
    if (muted()) return
    const now = ctx.currentTime
    const bus = ctx.createGain(); bus.gain.value = 0.4
    bus.connect(dry); sendTo(bus, 0.18)
    const b = (f, t0, dur) => {
      const o = ctx.createOscillator(); o.type = 'square'; o.frequency.value = f
      const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = f; bp.Q.value = 6
      const g = ctx.createGain()
      g.gain.setValueAtTime(0.0001, now + t0)
      g.gain.exponentialRampToValueAtTime(0.5, now + t0 + 0.008)
      g.gain.exponentialRampToValueAtTime(0.0001, now + t0 + dur)
      o.connect(bp); bp.connect(g); g.connect(bus)
      o.start(now + t0); o.stop(now + t0 + dur + 0.02)
    }
    b(720, 0, 0.07); b(1080, 0.085, 0.12)
  }

  // a single soft machine blip (coil ignitions, sensor pings) — pitch per call
  const blip = (freq = 900, vol = 0.3, dur = 0.12) => {
    if (muted()) return
    const now = ctx.currentTime
    const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = freq
    const g = ctx.createGain()
    g.gain.setValueAtTime(0.0001, now)
    g.gain.exponentialRampToValueAtTime(vol, now + 0.01)
    g.gain.exponentialRampToValueAtTime(0.0001, now + dur)
    o.connect(g); g.connect(dry); sendTo(g, 0.25)
    o.start(now); o.stop(now + dur + 0.02)
  }

  // a radar-return ping — a bright sonar strike with a slow downward bend, a
  // fifth-down body and a generous reverb tail. High and quiet for the sweep;
  // a lower freq at volume reads as a hostile return.
  const ping = (freq = 1240, vol = 0.4) => {
    if (muted()) return
    const now = ctx.currentTime
    const out = ctx.createGain(); out.connect(dry); sendTo(out, 0.7)
    const o = ctx.createOscillator(); o.type = 'sine'
    o.frequency.setValueAtTime(freq, now)
    o.frequency.exponentialRampToValueAtTime(freq * 0.93, now + 0.3)
    const g = ctx.createGain()
    g.gain.setValueAtTime(0.0001, now)
    g.gain.exponentialRampToValueAtTime(vol, now + 0.006)
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.34)
    o.connect(g); g.connect(out); o.start(now); o.stop(now + 0.38)
    const o2 = ctx.createOscillator(); o2.type = 'sine'; o2.frequency.value = freq * 0.667
    const g2 = ctx.createGain()
    g2.gain.setValueAtTime(0.0001, now)
    g2.gain.exponentialRampToValueAtTime(vol * 0.4, now + 0.01)
    g2.gain.exponentialRampToValueAtTime(0.0001, now + 0.24)
    o2.connect(g2); g2.connect(out); o2.start(now); o2.stop(now + 0.28)
  }

  // a one-shot deep rumble (impacts, distant detonations) — heavier than blip,
  // softer than a full explosion
  const rumble = (vol = 0.5, dur = 1.6) => {
    if (muted()) return
    const now = ctx.currentTime
    const bb = ctx.createBufferSource(); bb.buffer = noiseBuf; bb.loop = true
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'
    lp.frequency.setValueAtTime(300, now); lp.frequency.exponentialRampToValueAtTime(60, now + dur)
    const g = ctx.createGain()
    g.gain.setValueAtTime(0.0001, now)
    g.gain.linearRampToValueAtTime(0.4 * vol, now + 0.12)
    g.gain.exponentialRampToValueAtTime(0.0001, now + dur)
    bb.connect(lp); lp.connect(g); g.connect(dry); sendTo(g, 0.5)
    bb.start(now); bb.stop(now + dur + 0.05)
  }

  // an ambient music / room-tone bed (HTMLAudio — the codebase's pattern for
  // long assets). The scene drives volume per frame; dispose pauses it dead.
  const bed = (file, { volume = 0.4, loop = true } = {}) => {
    const el = new Audio(`${BASE}${file}`)
    el.preload = 'auto'; el.loop = loop; el.volume = muted() ? 0 : volume
    tracks.push(el)
    return {
      el,
      play: () => el.play().catch(() => {}),
      setVolume: (v) => { el.volume = muted() ? 0 : Math.max(0, Math.min(1, v)) },
    }
  }

  const dispose = () => {
    tracks.forEach(a => { a.pause(); a.src = '' })
    try { ctx.close() } catch (_) { /* already closed */ }   // the unlocker prunes closed contexts itself
  }

  return { laser, explosion, jump, comms, blip, ping, rumble, bed, dispose }
}
