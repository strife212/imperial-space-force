// ─────────────────────────────────────────────────────────────────────────────
// Render Cosmogony II (/cosmogony2) to a video file:
//   node scripts/render-montage-video.mjs          → renders/cosmogony2-1080p.mp4
//
// Deterministic offline render — no screen capture, no dropped frames:
//   · drives the system Chrome headless via playwright-core, importing the
//     REAL reel (REEL/CREDITS from MontageScreen.jsx via the Vite dev server)
//     so timing, framing and credits can never drift from the app,
//   · draws every frame to a canvas (cover-crop + object-position, Ken Burns
//     in/out/up/still with per-slide zoom, dissolves, Trinity + act-boundary
//     flashes, film grain, vignette, title card, end fade, rolling colophon),
//   · re-schedules the soundscape into an OfflineAudioContext on an absolute
//     timeline (same synthesis as montageAudio.js: era-keyed drone bed, air,
//     strikes, trinity detonation, finale chord, bell, dead silence),
//   · muxes frames + WAV with ffmpeg (libx264 CRF 21 + AAC 192k).
// Requires the Vite dev server on :5173.
// ─────────────────────────────────────────────────────────────────────────────
import { chromium } from 'playwright-core'
import ffmpegPath from 'ffmpeg-static'
import { execFileSync } from 'node:child_process'
import { mkdirSync, writeFileSync, rmSync, existsSync, appendFileSync, statSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const OUT_DIR = join(ROOT, 'renders')
const FRAMES = join(OUT_DIR, 'frames')
const WAV = join(OUT_DIR, 'cosmogony2.wav')
const OUT = join(OUT_DIR, 'cosmogony2-1080p.mp4')
const DEV = 'http://localhost:5173'
const CHROME = 'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe'
const FPS = 30, W = 1920, H = 1080

rmSync(FRAMES, { recursive: true, force: true })
mkdirSync(FRAMES, { recursive: true })
if (existsSync(WAV)) rmSync(WAV)

const browser = await chromium.launch({ executablePath: CHROME, headless: true })
const page = await browser.newPage({ viewport: { width: W, height: H } })
page.on('console', (m) => { if (m.type() === 'error') console.error('[page]', m.text()) })
page.on('pageerror', (e) => console.error('[pageerror]', e.message))

let frameCount = 0
await page.exposeBinding('saveFrame', async (_s, name, b64) => {
  writeFileSync(join(FRAMES, name), Buffer.from(b64, 'base64'))
  if (++frameCount % 300 === 0) console.log(`  frames: ${frameCount}`)
})
await page.exposeBinding('saveWavChunk', async (_s, b64) => appendFileSync(WAV, Buffer.from(b64, 'base64')))
await page.exposeBinding('logNode', async (_s, msg) => console.log(msg))

await page.goto(DEV + '/', { waitUntil: 'domcontentloaded' })

console.log('rendering audio + frames in headless Chrome…')
await page.evaluate(async ({ FPS, W, H }) => {
  const log = (m) => window.logNode(m)
  const mod = await import('/src/screens/MontageScreen.jsx')
  const REEL = mod.REEL, CREDITS = mod.CREDITS
  if (!REEL || !CREDITS) throw new Error('REEL/CREDITS not exported')

  // ── the master timeline (video seconds) ──
  const TITLE = 3.0, BREATH = 1.4, ENDF = 1.4, CRED_DELAY = 1.6, TAIL = 1.0
  const starts = []
  let acc = TITLE + BREATH
  for (const s of REEL) { starts.push(acc); acc += s.dur }
  const reelEnd = acc
  const credStart = reelEnd + CRED_DELAY
  const credDur = 10 + CREDITS.length * 0.62
  const TOTAL = credStart + credDur + TAIL
  log(`  timeline: reel ${reelEnd.toFixed(1)}s · credits ${credDur.toFixed(1)}s · total ${TOTAL.toFixed(1)}s`)

  const clamp01 = (v) => Math.min(1, Math.max(0, v))
  const smooth = (v) => { v = clamp01(v); return v * v * (3 - 2 * v) }

  // ══ AUDIO · offline port of montageAudio.js on absolute time ══════════════
  const SR = 44100
  const off = new OfflineAudioContext(2, Math.ceil(TOTAL * SR), SR)
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

  // anchored ramps: track each param's current target so ramps chain correctly
  const cur = new Map()
  const ramp = (param, v0key, v, t, tau) => {
    const prev = cur.has(v0key) ? cur.get(v0key) : param.value
    param.setValueAtTime(prev, t); param.linearRampToValueAtTime(v, t + tau); cur.set(v0key, v)
  }
  const blip = (freq, t0, len, level, type = 'sine', glideTo = null) => {
    const o = off.createOscillator(); o.type = type; o.frequency.setValueAtTime(freq, t0)
    if (glideTo != null) o.frequency.exponentialRampToValueAtTime(Math.max(glideTo, 1), t0 + len)
    const g = off.createGain()
    g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(Math.max(level, 0.0002), t0 + 0.014); g.gain.exponentialRampToValueAtTime(0.0001, t0 + len)
    o.connect(g); g.connect(bus); o.start(t0); o.stop(t0 + len + 0.05)
  }
  const burst = (t0, len, level, bpFreq, q = 1, loop = false) => {
    const src = off.createBufferSource(); src.buffer = nbuf; src.loop = loop
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
    else for (let n = 0; n < 3; n++) blip(330 * (n + 1) * 1.5, t0 + n * 0.042, 0.035, 0.075, 'square')
    if (dur < 0.7 && era >= 4) blip(1320, t0 + dur / 2, 0.04, 0.05, 'sine')
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
  const finaleChord = (t0) => {
    ramp(droneGain.gain, 'drone', 0.05, t0, 1.2)
    for (const [f, l] of [[146.83, 0.16], [220, 0.13], [293.66, 0.11], [369.99, 0.09], [440, 0.07], [1174.66, 0.02]]) {
      const o = off.createOscillator(); o.type = 'sine'; o.frequency.value = f
      const g = off.createGain()
      g.gain.setValueAtTime(0.0001, t0); g.gain.linearRampToValueAtTime(l, t0 + 1.6); g.gain.linearRampToValueAtTime(l * 0.8, t0 + 3.2)
      o.connect(g); g.connect(bus); o.start(t0); o.stop(t0 + 12)
    }
  }
  // the ceremony: drone breathes in from t=0 beneath the title
  master.gain.setValueAtTime(0, 0); master.gain.linearRampToValueAtTime(0.55, 1.0); cur.set('master', 0.55)
  let prevEra = 1
  REEL.forEach((s, i) => {
    const t0 = starts[i], era = s.era || 1
    if (s.sfx === 'silence') { ramp(master.gain, 'master', 0, t0, 0.08); return }
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
  log('  rendering audio…')
  const audioBuf = await off.startRendering()
  // encode 16-bit stereo WAV and ship it out in chunks
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

  // ══ VIDEO · canvas re-creation of the CSS composition ═════════════════════
  // load sequentially: firing 36 concurrent 4K decode()s trips Chrome's
  // decoded-image budget and the tail of the list gets rejected. A decode()
  // rejection with loaded bytes is still drawable (drawImage sync-decodes),
  // so tolerate it — but fail LOUDLY if any file is truly unavailable.
  const files = [...new Set(REEL.map((s) => s.f))]
  const imgs = {}
  for (const f of files) {
    const im = new Image(); im.src = '/montage/' + encodeURIComponent(f)
    try { im.decode ? await im.decode() : await new Promise((r, j) => { im.onload = r; im.onerror = j }) }
    catch (_) { await new Promise((r) => setTimeout(r, 120)) }   // budget rejection — bytes may still be in
    if (!(im.complete && im.naturalWidth > 0)) await new Promise((r) => { im.onload = r; im.onerror = r; setTimeout(r, 1500) })
    if (im.complete && im.naturalWidth > 0) imgs[f] = im
  }
  const missing = files.filter((f) => !imgs[f])
  if (missing.length) throw new Error('images failed to load: ' + missing.join(', '))
  log(`  images: ${files.length} loaded`)

  const cv = document.createElement('canvas'); cv.width = W; cv.height = H
  const ctx = cv.getContext('2d', { willReadFrequently: false })
  // grain tile + vignette overlay, prerendered once
  const grain = document.createElement('canvas'); grain.width = 160; grain.height = 160
  { const g = grain.getContext('2d'), im = g.createImageData(160, 160)
    for (let i = 0; i < im.data.length; i += 4) { const v = Math.random() * 255; im.data[i] = v; im.data[i + 1] = v; im.data[i + 2] = v; im.data[i + 3] = 255 }
    g.putImageData(im, 0, 0) }
  const grainPat = ctx.createPattern(grain, 'repeat')
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

  const flashes = []
  REEL.forEach((s, i) => {
    if (s.sfx === 'trinity') flashes.push({ t: starts[i], p: 1, d: 0.55 })
    else if (i > 0 && REEL[i - 1].era !== s.era && !s.dis && s.sfx !== 'silence') flashes.push({ t: starts[i], p: 0.16, d: 0.22 })
  })

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
  const monoText = (txt, y, size, spacingEm, color, alpha) => {
    ctx.save(); ctx.globalAlpha = alpha; ctx.fillStyle = color
    ctx.font = `${size}px Consolas, monospace`
    try { ctx.letterSpacing = `${(size * spacingEm).toFixed(1)}px` } catch (_) { /* older canvas */ }
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    ctx.fillText(txt, W / 2 + (size * spacingEm) / 2, y)
    ctx.restore(); try { ctx.letterSpacing = '0px' } catch (_) { /* noop */ }
  }

  const totalFrames = Math.ceil(TOTAL * FPS)
  for (let fi = 0; fi < totalFrames; fi++) {
    const t = fi / FPS
    ctx.globalAlpha = 1
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H)

    // the reel
    if (t >= starts[0] && t < reelEnd) {
      let idx = 0
      for (let i = 0; i < REEL.length; i++) if (t >= starts[i]) idx = i
      const s = REEL[idx], tl = t - starts[idx]
      if (idx > 0 && s.fade > 0 && tl < s.fade + 0.05) drawSlide(REEL[idx - 1], t - starts[idx - 1], 1)
      drawSlide(s, tl, s.fade > 0 ? smooth(tl / s.fade) : 1)
    }
    if (t < credStart) {
      // grain + vignette ride every frame of the film itself
      ctx.save(); ctx.globalAlpha = 0.05
      ctx.translate(-Math.random() * 160, -Math.random() * 160)
      ctx.fillStyle = grainPat; ctx.fillRect(0, 0, W + 320, H + 320)
      ctx.restore()
      ctx.drawImage(vig, 0, 0)
    }
    // flashes
    for (const fl of flashes) {
      if (t >= fl.t && t < fl.t + fl.d) {
        ctx.save(); ctx.globalAlpha = fl.p * Math.pow(1 - (t - fl.t) / fl.d, 1.6)
        ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, W, H); ctx.restore()
      }
    }
    // end fade to black
    if (t >= reelEnd) { ctx.save(); ctx.globalAlpha = smooth((t - reelEnd) / ENDF); ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H); ctx.restore() }
    // title card
    if (t < TITLE) {
      const q = t / TITLE
      const a = q < 0.26 ? q / 0.26 : q > 0.74 ? (1 - q) / 0.26 : 1
      monoText('COSMOGONY II', H / 2 - 12, 30, 0.62, 'rgba(214,226,250,0.95)', clamp01(a))
      monoText('a reel of first light, deep time, and the minds that followed', H / 2 + 34, 11, 0.3, 'rgba(150,168,205,0.55)', clamp01(a))
    }
    // rolling colophon
    if (t >= credStart) {
      const lineStep = 27, headGap = 41, tailGap = 49
      const contentH = 15 + headGap + CREDITS.length * lineStep + tailGap + 12 + H * 0.08
      const yTop = H - ((t - credStart) / credDur) * (H + contentH)
      let y = yTop
      monoText('COSMOGONY II', y, 15, 0.55, 'rgba(214,226,250,0.9)', 1); y += headGap
      for (const c of CREDITS) { if (y > -20 && y < H + 20) monoText(c, y, 12, 0.12, 'rgba(168,184,216,0.75)', 1); y += lineStep }
      y += tailGap - lineStep
      monoText('THE SONG IS NOT YET DONE', y, 11, 0.34, 'rgba(150,168,205,0.45)', 1)
    }

    const b64 = cv.toDataURL('image/jpeg', 0.92).split(',')[1]
    await window.saveFrame(`f${String(fi).padStart(6, '0')}.jpg`, b64)
  }
  log(`  frames done: ${totalFrames}`)
}, { FPS, W, H })

await browser.close()

console.log('muxing with ffmpeg…')
execFileSync(ffmpegPath, [
  '-y',
  '-framerate', String(FPS), '-i', join(FRAMES, 'f%06d.jpg'),
  '-i', WAV,
  '-c:v', 'libx264', '-preset', 'medium', '-crf', '21', '-pix_fmt', 'yuv420p',
  '-c:a', 'aac', '-b:a', '192k',
  '-movflags', '+faststart',
  '-shortest',
  OUT,
], { stdio: ['ignore', 'ignore', 'inherit'] })

rmSync(FRAMES, { recursive: true, force: true })
rmSync(WAV)
const mb = (statSync(OUT).size / 1024 / 1024).toFixed(1)
console.log(`\ndone → ${OUT}  (${mb} MB)`)
