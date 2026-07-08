// ─────────────────────────────────────────────────────────────────────────────
// Render the LAST FIVE slides of Cosmogony II to a high-quality clip + GIF:
//   node scripts/render-montage-tail.mjs
//     → public/clips/cosmogony2-last5.mp4   (1080p, CRF 18, finale audio)
//     → public/clips/cosmogony2-last5.gif   (960w, 20 fps, palette-dithered)
//
// Same deterministic pipeline as render-montage-video.mjs (real REEL via the
// Vite dev server, canvas frames, OfflineAudioContext port), narrowed to the
// reel's tail: Reprogramming ENIAC → Connection Machine → the two neural
// networks (finale chord) → the silent XDF reprise, through the end fade.
// FILM GRAIN IS OFF here — clean gradients palette-quantise far better.
// The audio is scheduled across the FULL timeline (so the drone/era state and
// the finale chord are exactly what the reel plays), then the tail segment is
// cut out at the mux. Outputs land in public/clips/ (gitignored) so they are
// reachable on the dev server at /clips/…  Requires Vite on :5173.
// ─────────────────────────────────────────────────────────────────────────────
import { chromium } from 'playwright-core'
import ffmpegPath from 'ffmpeg-static'
import { execFileSync } from 'node:child_process'
import { mkdirSync, writeFileSync, rmSync, existsSync, appendFileSync, statSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const OUT_DIR = join(ROOT, 'public', 'clips')
const FRAMES = join(ROOT, 'renders', 'tail-frames')
const WAV = join(ROOT, 'renders', 'tail.wav')
const OUT_MP4 = join(OUT_DIR, 'cosmogony2-last5.mp4')
const OUT_GIF = join(OUT_DIR, 'cosmogony2-last5.gif')
const PALETTE = join(ROOT, 'renders', 'tail-palette.png')
const DEV = 'http://localhost:5173'
const CHROME = 'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe'
const FPS = 30, W = 1920, H = 1080
const N_TAIL = 5

rmSync(FRAMES, { recursive: true, force: true })
mkdirSync(FRAMES, { recursive: true })
mkdirSync(OUT_DIR, { recursive: true })
if (existsSync(WAV)) rmSync(WAV)

const browser = await chromium.launch({ executablePath: CHROME, headless: true })
const page = await browser.newPage({ viewport: { width: W, height: H } })
page.on('console', (m) => { if (m.type() === 'error') console.error('[page]', m.text()) })
page.on('pageerror', (e) => console.error('[pageerror]', e.message))

let frameCount = 0
await page.exposeBinding('saveFrame', async (_s, name, b64) => {
  writeFileSync(join(FRAMES, name), Buffer.from(b64, 'base64'))
  if (++frameCount % 100 === 0) console.log(`  frames: ${frameCount}`)
})
await page.exposeBinding('saveWavChunk', async (_s, b64) => appendFileSync(WAV, Buffer.from(b64, 'base64')))
await page.exposeBinding('logNode', async (_s, msg) => console.log(msg))

await page.goto(DEV + '/', { waitUntil: 'domcontentloaded' })

console.log('rendering tail audio + frames in headless Chrome…')
const seg = await page.evaluate(async ({ FPS, W, H, N_TAIL }) => {
  const log = (m) => window.logNode(m)
  const mod = await import('/src/screens/MontageScreen.jsx')
  const REEL = mod.REEL, CREDITS = mod.CREDITS
  if (!REEL || !CREDITS) throw new Error('REEL/CREDITS not exported')

  // ── the master timeline (identical to the full renderer) ──
  const TITLE = 3.0, BREATH = 1.4
  const starts = []
  let acc = TITLE + BREATH
  for (const s of REEL) { starts.push(acc); acc += s.dur }
  const reelEnd = acc
  const ENDF = 1.4

  // the clip window: hard cut into the fifth-from-last slide → past the end fade
  const tail0 = REEL.length - N_TAIL
  const T0 = starts[tail0]
  const T1 = reelEnd + 1.5                        // fade done (1.4) + a black beat
  log(`  window: ${T0.toFixed(2)}s → ${T1.toFixed(2)}s  (${(T1 - T0).toFixed(2)}s)`)

  const clamp01 = (v) => Math.min(1, Math.max(0, v))
  const smooth = (v) => { v = clamp01(v); return v * v * (3 - 2 * v) }

  // ══ AUDIO · full-timeline schedule (state at the tail is then exact) ═══════
  const SR = 44100
  const off = new OfflineAudioContext(2, Math.ceil(T1 * SR), SR)
  const ERA_ROOT = { 1: 36.71, 2: 41.2, 3: 49.0, 4: 55.0, 5: 61.74 }
  const ERA_MOOD = {
    1: { cutoff: 130, air: 0, wet: 0.5 }, 2: { cutoff: 240, air: 0.05, wet: 0.42 },
    3: { cutoff: 420, air: 0.025, wet: 0.36 }, 4: { cutoff: 700, air: 0.008, wet: 0.3 },
    5: { cutoff: 1150, air: 0, wet: 0.26 },
  }
  const master = off.createGain(); master.gain.value = 0; master.connect(off.destination)
  const bus = off.createGain(); bus.connect(master)
  const delay = off.createDelay(1.5); delay.delayTime.value = 0.43
  const damp = off.createBiquadFilter(); damp.type = 'lowpass'; damp.frequency.value = 1900
  const fbk = off.createGain(); fbk.gain.value = 0.42
  const wet = off.createGain(); wet.gain.value = 0.5
  bus.connect(delay); delay.connect(damp); damp.connect(fbk); fbk.connect(delay); damp.connect(wet); wet.connect(master)
  const droneFilter = off.createBiquadFilter(); droneFilter.type = 'lowpass'; droneFilter.frequency.value = 130; droneFilter.Q.value = 0.6
  const droneGain = off.createGain(); droneGain.gain.value = 0.16
  droneFilter.connect(droneGain); droneGain.connect(bus)
  const oscs = []
  for (const [type, ratio, level] of [['sine', 0.5, 0.9], ['sawtooth', 1, 0.22], ['sawtooth', 1.006, 0.2], ['sine', 1.5, 0.3]]) {
    const o = off.createOscillator(); o.type = type; o.frequency.value = ERA_ROOT[1] * ratio
    const g = off.createGain(); g.gain.value = level
    o.connect(g); g.connect(droneFilter); o.start(0)
    oscs.push({ o, ratio })
  }
  const nbuf = off.createBuffer(1, SR * 2, SR)
  const nd = nbuf.getChannelData(0)
  for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1
  const noise = off.createBufferSource(); noise.buffer = nbuf; noise.loop = true
  const airBP = off.createBiquadFilter(); airBP.type = 'bandpass'; airBP.frequency.value = 640; airBP.Q.value = 0.8
  const airGain = off.createGain(); airGain.gain.value = 0
  noise.connect(airBP); airBP.connect(airGain); airGain.connect(bus); noise.start(0)

  const cur = new Map()
  const ramp = (param, v0key, v, t, tau) => {
    const prev = cur.has(v0key) ? cur.get(v0key) : param.value
    param.setValueAtTime(prev, t); param.linearRampToValueAtTime(v, t + tau); cur.set(v0key, v)
  }
  const blip = (freq, t0, len, level, type = 'sine', glideTo = null) => {
    if (t0 > T1) return
    const o = off.createOscillator(); o.type = type; o.frequency.setValueAtTime(freq, t0)
    if (glideTo != null) o.frequency.exponentialRampToValueAtTime(Math.max(glideTo, 1), t0 + len)
    const g = off.createGain()
    g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(Math.max(level, 0.0002), t0 + 0.014); g.gain.exponentialRampToValueAtTime(0.0001, t0 + len)
    o.connect(g); g.connect(bus); o.start(t0); o.stop(t0 + len + 0.05)
  }
  const burst = (t0, len, level, bpFreq, q = 1) => {
    if (t0 > T1) return
    const src = off.createBufferSource(); src.buffer = nbuf
    const bp = off.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = bpFreq; bp.Q.value = q
    const g = off.createGain()
    g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(Math.max(level, 0.0002), t0 + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t0 + len)
    src.connect(bp); bp.connect(g); g.connect(bus); src.start(t0, Math.random()); src.stop(t0 + len + 0.05)
  }
  const strike = (era, dur, t0) => {
    const w = Math.min(1, Math.max(0.15, dur / 2.4))
    if (era === 1) blip(82, t0, 0.55 + 1.1 * w, 0.28 + 0.3 * w, 'sine', 27)
    else if (era === 2) { burst(t0, 0.25 + 0.5 * w, 0.05 + 0.16 * w, 380, 0.7); blip(49, t0, 0.3 + 0.4 * w, 0.14 + 0.16 * w, 'sine', 38) }
    else if (era === 3) { for (const [r, l] of [[1, 1], [2.76, 0.5], [5.4, 0.24]]) blip(523.25 * r, t0, 0.35 + 0.55 * w, (0.05 + 0.09 * w) * l, 'sine') }
    else if (era === 4) { blip(880, t0, 0.09, 0.1 + 0.06 * w, 'square'); burst(t0, 0.03, 0.08, 4800, 3) }
    else {
      // data-chime in the era's key (B · F♯ · B): quick triangle arpeggio + relay-click
      for (const [r, at, l] of [[4, 0, 1], [6, 0.028, 0.62], [8, 0.056, 0.45]])
        blip(ERA_ROOT[5] * r, t0 + at, 0.22 + 0.34 * w, (0.08 + 0.06 * w) * l, 'triangle')
      burst(t0, 0.022, 0.065, 3200, 2.4)
    }
    if (dur < 0.7 && era >= 4) blip(ERA_ROOT[era] * 16, t0 + dur / 2, 0.05, 0.028, 'sine')
  }
  const env = (g, pts) => { g.gain.setValueAtTime(0.0001, pts[0][0]); for (const [tt, v, exp] of pts.slice(1)) exp ? g.gain.exponentialRampToValueAtTime(Math.max(v, 0.0001), tt) : g.gain.linearRampToValueAtTime(v, tt) }
  const trinity = (t0, dur) => {
    ramp(droneGain.gain, 'drone', 0.0001, t0, 0.04)
    ramp(airGain.gain, 'air', 0, t0, 0.04)
    ramp(fbk.gain, 'fbk', 0.05, t0, 0.04)
    const hit = t0 + 0.26
    { const src = off.createBufferSource(); src.buffer = nbuf
      const hp = off.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 1100
      const g = off.createGain(); env(g, [[hit], [hit + 0.006, 0.55], [hit + 0.11, 0.0001, true]])
      src.connect(hp); hp.connect(g); g.connect(bus); src.start(hit, Math.random()); src.stop(hit + 0.2) }
    { const o = off.createOscillator(); o.type = 'sine'
      o.frequency.setValueAtTime(58, hit); o.frequency.exponentialRampToValueAtTime(13, hit + 2.1)
      const g = off.createGain(); env(g, [[hit], [hit + 0.01, 0.9], [hit + 0.55, 0.5], [hit + 2.3, 0.0001, true]])
      o.connect(g); g.connect(bus); o.start(hit); o.stop(hit + 2.4) }
    { const o = off.createOscillator(); o.type = 'sine'
      o.frequency.setValueAtTime(116, hit); o.frequency.exponentialRampToValueAtTime(28, hit + 0.9)
      const g = off.createGain(); env(g, [[hit], [hit + 0.012, 0.5], [hit + 1.0, 0.0001, true]])
      o.connect(g); g.connect(bus); o.start(hit); o.stop(hit + 1.1) }
    { const o = off.createOscillator(); o.type = 'sawtooth'
      o.frequency.setValueAtTime(88, hit); o.frequency.exponentialRampToValueAtTime(22, hit + 0.7)
      const lp = off.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 480
      const g = off.createGain(); env(g, [[hit], [hit + 0.015, 0.24], [hit + 0.85, 0.0001, true]])
      o.connect(lp); lp.connect(g); g.connect(bus); o.start(hit); o.stop(hit + 0.95) }
    { const src = off.createBufferSource(); src.buffer = nbuf; src.loop = true
      const bp = off.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 85; bp.Q.value = 0.4
      const g = off.createGain(); env(g, [[hit + 0.3], [hit + 0.75, 0.55], [hit + 2.8, 0.0001, true]])
      src.connect(bp); bp.connect(g); g.connect(bus); src.start(hit + 0.3, Math.random()); src.stop(hit + 3.0) }
    { const o = off.createOscillator(); o.type = 'sine'; o.frequency.value = 2900
      const g = off.createGain(); env(g, [[hit + 0.12], [hit + 0.5, 0.022], [hit + 2.0, 0.0001, true]])
      o.connect(g); g.connect(bus); o.start(hit + 0.12); o.stop(hit + 2.1) }
    ramp(droneGain.gain, 'drone', 0.16, t0 + dur, 1.6)
    ramp(fbk.gain, 'fbk', 0.42, t0 + dur, 1.0)
  }
  const finaleGains = []
  const finaleChord = (t0) => {
    ramp(droneGain.gain, 'drone', 0.05, t0, 1.2)
    for (const [f, l] of [[146.83, 0.16], [220, 0.13], [293.66, 0.11], [369.99, 0.09], [440, 0.07], [1174.66, 0.02]]) {
      const o = off.createOscillator(); o.type = 'sine'; o.frequency.value = f
      const g = off.createGain()
      g.gain.setValueAtTime(0.0001, t0); g.gain.linearRampToValueAtTime(l, t0 + 1.6); g.gain.linearRampToValueAtTime(l * 0.8, t0 + 3.2)
      o.connect(g); g.connect(bus); o.start(t0); o.stop(t0 + 12)
      finaleGains.push(g)
    }
  }
  master.gain.setValueAtTime(0, 0); master.gain.linearRampToValueAtTime(0.55, 1.0); cur.set('master', 0.55)
  let prevEra = 1
  REEL.forEach((s, i) => {
    const t0 = starts[i], era = s.era || 1
    if (s.sfx === 'silence') {
      ramp(droneGain.gain, 'drone', 0.0001, t0, 0.12)
      ramp(airGain.gain, 'air', 0, t0, 0.12)
      for (const g of finaleGains) {
        try { g.gain.cancelAndHoldAtTime(t0) } catch (_) { g.gain.cancelScheduledValues(t0); g.gain.setValueAtTime(0.1, t0) }
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + 6.5)
      }
      return
    }
    if (era !== prevEra) {
      prevEra = era
      const mood = ERA_MOOD[era]
      for (const { o, ratio } of oscs) ramp(o.frequency, 'f' + ratio, ERA_ROOT[era] * ratio, t0, 1.8)
      ramp(droneFilter.frequency, 'cut', mood.cutoff, t0, 2.2)
      ramp(airGain.gain, 'air', mood.air, t0, 2.5)
      ramp(wet.gain, 'wet', mood.wet, t0, 2.5)
    }
    if (s.sfx === 'trinity') { trinity(t0, s.dur); return }
    if (s.sfx === 'finale') { finaleChord(t0); return }
    if (s.sfx === 'bell') { for (const [r, l] of [[1, 1], [2.76, 0.5], [5.4, 0.24]]) blip(523.25 * r, t0, 1.1, 0.12 * l, 'sine'); return }
    strike(era, s.dur, t0)
  })
  ramp(master.gain, 'master', 0, reelEnd, 2.8)   // finish(): closes the chord's tail
  log('  rendering audio…')
  const audioBuf = await off.startRendering()
  {
    const n = audioBuf.length, ch0 = audioBuf.getChannelData(0), ch1 = audioBuf.getChannelData(1)
    const data = new DataView(new ArrayBuffer(44 + n * 4))
    const wr = (o, s) => { for (let i = 0; i < s.length; i++) data.setUint8(o + i, s.charCodeAt(i)) }
    wr(0, 'RIFF'); data.setUint32(4, 36 + n * 4, true); wr(8, 'WAVEfmt '); data.setUint32(16, 16, true)
    data.setUint16(20, 1, true); data.setUint16(22, 2, true); data.setUint32(24, SR, true)
    data.setUint32(28, SR * 4, true); data.setUint16(32, 4, true); data.setUint16(34, 16, true)
    wr(36, 'data'); data.setUint32(40, n * 4, true)
    for (let i = 0; i < n; i++) {
      data.setInt16(44 + i * 4, Math.max(-1, Math.min(1, ch0[i])) * 0x7fff, true)
      data.setInt16(46 + i * 4, Math.max(-1, Math.min(1, ch1[i])) * 0x7fff, true)
    }
    const bytes = new Uint8Array(data.buffer)
    const CH = 4 << 20
    for (let o = 0; o < bytes.length; o += CH) {
      let bin = ''
      const part = bytes.subarray(o, Math.min(o + CH, bytes.length))
      for (let i = 0; i < part.length; i += 0x8000) bin += String.fromCharCode.apply(null, part.subarray(i, i + 0x8000))
      await window.saveWavChunk(btoa(bin))
    }
  }
  log('  audio done; drawing frames…')

  // ══ VIDEO · tail frames only, film grain OFF ═══════════════════════════════
  const tailSlides = REEL.slice(tail0)
  const files = [...new Set(tailSlides.map((s) => s.f))]
  const imgs = {}
  for (const f of files) {
    const im = new Image(); im.src = '/montage/' + encodeURIComponent(f)
    try { im.decode ? await im.decode() : await new Promise((r, j) => { im.onload = r; im.onerror = j }) }
    catch (_) { await new Promise((r) => setTimeout(r, 120)) }
    if (!(im.complete && im.naturalWidth > 0)) await new Promise((r) => { im.onload = r; im.onerror = r; setTimeout(r, 1500) })
    if (im.complete && im.naturalWidth > 0) imgs[f] = im
  }
  const missing = files.filter((f) => !imgs[f])
  if (missing.length) throw new Error('images failed to load: ' + missing.join(', '))
  log(`  images: ${files.length} loaded`)

  const cv = document.createElement('canvas'); cv.width = W; cv.height = H
  const ctx = cv.getContext('2d', { willReadFrequently: false })
  const vig = document.createElement('canvas'); vig.width = W; vig.height = H
  { const g = vig.getContext('2d')
    const r = Math.hypot(W, H) / 2
    const rad = g.createRadialGradient(W / 2, H / 2, r * 0.42, W / 2, H / 2, r)
    rad.addColorStop(0, 'rgba(0,0,0,0)'); rad.addColorStop(1, 'rgba(0,0,0,0.42)')
    g.fillStyle = rad; g.fillRect(0, 0, W, H)
    const lin = g.createLinearGradient(0, 0, 0, H)
    lin.addColorStop(0, 'rgba(0,0,0,0.25)'); lin.addColorStop(0.09, 'rgba(0,0,0,0)')
    lin.addColorStop(0.91, 'rgba(0,0,0,0)'); lin.addColorStop(1, 'rgba(0,0,0,0.25)')
    g.fillStyle = lin; g.fillRect(0, 0, W, H) }

  const parsePos = (pos) => { const m = (pos || '50% 50%').split(' '); return [parseFloat(m[0]) / 100, parseFloat(m[1]) / 100] }
  const drawSlide = (s, tLocal, alpha) => {
    const im = imgs[s.f]; if (!im) return
    const z = s.zoom || 1
    const animDur = s.dur + s.fade + 0.6
    const p = s.kb === 'still' ? 0 : clamp01(tLocal / animDur)
    let k = z, tyH = 0
    if (s.kb === 'in') k = (1.0 + 0.075 * p) * z
    else if (s.kb === 'out') k = (1.09 - 0.085 * p) * z
    else if (s.kb === 'up') { k = 1.17 * z; tyH = (-0.045 + 0.09 * p) * H }
    const [px, py] = parsePos(s.pos)
    const s0 = Math.max(W / im.width, H / im.height)
    const dw = im.width * s0, dh = im.height * s0
    const x0 = (W - dw) * px, y0 = (H - dh) * py
    ctx.save()
    ctx.globalAlpha = alpha
    ctx.translate(W / 2, H / 2); ctx.scale(k, k); ctx.translate(0, tyH); ctx.translate(-W / 2, -H / 2)
    ctx.drawImage(im, x0, y0, dw, dh)
    ctx.restore()
  }

  const f0 = Math.round(T0 * FPS), f1 = Math.ceil(T1 * FPS)
  for (let fi = f0; fi < f1; fi++) {
    const t = fi / FPS
    ctx.globalAlpha = 1
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H)
    if (t < reelEnd) {
      let idx = 0
      for (let i = 0; i < REEL.length; i++) if (t >= starts[i]) idx = i
      const s = REEL[idx], tl = t - starts[idx]
      if (idx > tail0 && s.fade > 0 && tl < s.fade + 0.05) drawSlide(REEL[idx - 1], t - starts[idx - 1], 1)
      drawSlide(s, tl, s.fade > 0 ? smooth(tl / s.fade) : 1)
    }
    ctx.drawImage(vig, 0, 0)                     // vignette stays; grain is off
    if (t >= reelEnd) { ctx.save(); ctx.globalAlpha = smooth((t - reelEnd) / ENDF); ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H); ctx.restore() }
    const b64 = cv.toDataURL('image/jpeg', 0.95).split(',')[1]
    await window.saveFrame(`f${String(fi - f0).padStart(5, '0')}.jpg`, b64)
  }
  log(`  frames done: ${f1 - f0}`)
  return { T0, T1 }
}, { FPS, W, H, N_TAIL })

await browser.close()

const segDur = seg.T1 - seg.T0
console.log('muxing mp4…')
execFileSync(ffmpegPath, [
  '-y',
  '-framerate', String(FPS), '-i', join(FRAMES, 'f%05d.jpg'),
  '-ss', seg.T0.toFixed(3), '-t', segDur.toFixed(3), '-i', WAV,
  '-af', `afade=t=out:st=${(segDur - 0.9).toFixed(2)}:d=0.9`,
  '-c:v', 'libx264', '-preset', 'slow', '-crf', '18', '-pix_fmt', 'yuv420p',
  '-c:a', 'aac', '-b:a', '192k',
  '-movflags', '+faststart',
  '-shortest',
  OUT_MP4,
], { stdio: ['ignore', 'ignore', 'inherit'] })

console.log('building gif palette…')
execFileSync(ffmpegPath, [
  '-y',
  '-framerate', String(FPS), '-i', join(FRAMES, 'f%05d.jpg'),
  '-vf', 'fps=20,scale=960:-1:flags=lanczos,palettegen=stats_mode=diff',
  PALETTE,
], { stdio: ['ignore', 'ignore', 'inherit'] })
console.log('rendering gif…')
execFileSync(ffmpegPath, [
  '-y',
  '-framerate', String(FPS), '-i', join(FRAMES, 'f%05d.jpg'),
  '-i', PALETTE,
  '-lavfi', 'fps=20,scale=960:-1:flags=lanczos[x];[x][1:v]paletteuse=dither=sierra2_4a:diff_mode=rectangle',
  OUT_GIF,
], { stdio: ['ignore', 'ignore', 'inherit'] })

rmSync(FRAMES, { recursive: true, force: true })
rmSync(WAV); rmSync(PALETTE)
const mb = (p) => (statSync(p).size / 1024 / 1024).toFixed(1)
console.log(`\ndone →`)
console.log(`  ${OUT_MP4}  (${mb(OUT_MP4)} MB)  → ${DEV}/clips/cosmogony2-last5.mp4`)
console.log(`  ${OUT_GIF}  (${mb(OUT_GIF)} MB)  → ${DEV}/clips/cosmogony2-last5.gif`)
