// Render /trailer to a 1080p 30fps video — deterministic two-pass capture.
//
//   PASS 1 · video — the page clock is frozen and stepped exactly 1/30s per
//   frame; every frame is screenshotted at 1920×1080. No dropped frames, no
//   duplicated frames, no timing jitter: the montage's cuts land on the exact
//   video frames they were authored on, however long each screenshot takes.
//
//   PASS 2 · audio — a real-time run with every audio source tapped in-page:
//   AudioNode.connect is patched so anything reaching an AudioContext's
//   destination is forked into a master mixer, and HTMLMediaElement.play forks
//   the element through captureStream(). A MediaRecorder captures the mix.
//   The trailer runs once first to warm shader/audio caches, then the second,
//   stall-free run is recorded (the trailer clock loses time to stalls, so the
//   warm run keeps audio cues aligned with the deterministic video).
//
//   MUX · ffmpeg — H.264 CRF 16 (slow) + AAC 256k, 30fps CFR, faststart.
//
// Usage:  node scripts/render-trailer.mjs [--url http://localhost:5173/trailer]
// Output: imperial-space-force-trailer.mp4 (repo root) · work dir .trailer-render/
// NOTE: pass 2 plays the trailer audibly on this machine (twice, ~65s).
import { chromium } from 'playwright'
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

const URL = process.argv.includes('--url') ? process.argv[process.argv.indexOf('--url') + 1] : 'http://localhost:5173/trailer'
const FPS = 30, DUR = 30, FRAMES = FPS * DUR
const W = 1920, H = 1080
const WORK = path.resolve('.trailer-render')
const FRAME_DIR = path.join(WORK, 'frames')
const AUDIO_WEBM = path.join(WORK, 'audio.webm')
const OUT = path.resolve('imperial-space-force-trailer.mp4')
const FFMPEG = process.env.FFMPEG || 'ffmpeg'

const pad = (n) => String(n).padStart(5, '0')

// ── PASS 1 · deterministic frames ────────────────────────────────────────────
async function renderFrames() {
  fs.rmSync(FRAME_DIR, { recursive: true, force: true })
  fs.mkdirSync(FRAME_DIR, { recursive: true })
  const browser = await chromium.launch({ headless: false, args: ['--mute-audio', '--hide-scrollbars'] })
  const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 })
  await page.addInitScript(() => {
    // freeze the page clock — only __step advances it, by exact frame deltas.
    // rAF becomes a queue drained per step, so every animation loop in the app
    // (trailer tick, cutscene stages, the battle sim) advances in lockstep.
    const base = performance.now()
    const dateBase = Date.now()
    let off = 0
    let nextId = 1
    const pend = new Map()
    window.requestAnimationFrame = (cb) => { const id = nextId++; pend.set(id, cb); return id }
    window.cancelAnimationFrame = (id) => { pend.delete(id) }
    performance.now = () => base + off
    Date.now = () => dateBase + off
    window.__step = (ms) => {
      off += ms
      const q = [...pend.values()]; pend.clear()
      for (const cb of q) cb(performance.now())
      return q.length
    }
  })
  await page.goto(URL, { waitUntil: 'networkidle' })
  await page.click('.trailer-start-btn')
  await page.evaluate(() => window.__step(0.001))   // commit the roll under the frozen clock
  const STEP = 1000 / FPS
  const t0 = Date.now()
  for (let i = 1; i <= FRAMES; i++) {
    await page.evaluate((s) => window.__step(s), STEP)
    await page.screenshot({ path: path.join(FRAME_DIR, `f${pad(i)}.png`), type: 'png' })
    if (i % 60 === 0) {
      const rate = i / ((Date.now() - t0) / 1000)
      console.log(`  frame ${i}/${FRAMES} · t=${(i / FPS).toFixed(1)}s · ${rate.toFixed(1)} fps capture · ETA ${((FRAMES - i) / rate).toFixed(0)}s`)
    }
  }
  await browser.close()
  console.log('PASS 1 done — %d frames', FRAMES)
}

// ── PASS 2 · real-time audio ─────────────────────────────────────────────────
async function recordAudio() {
  const browser = await chromium.launch({ headless: false, args: ['--autoplay-policy=no-user-gesture-required', '--hide-scrollbars'] })
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } })
  await page.addInitScript(() => {
    // master mixer: everything audible is forked into one recordable stream
    const master = { ctx: null, dest: null }
    const ensure = () => {
      if (master.ctx) return
      master.ctx = new AudioContext()
      master.dest = master.ctx.createMediaStreamDestination()
    }
    // 1 · WebAudio: fork any connect() into an AudioContext destination
    const taps = new WeakMap()   // ctx -> per-context MediaStreamDestination
    const origConnect = AudioNode.prototype.connect
    AudioNode.prototype.connect = function (dst, ...rest) {
      try {
        if (dst instanceof AudioDestinationNode) {
          const ctx = this.context
          let msd = taps.get(ctx)
          if (!msd) {
            msd = ctx.createMediaStreamDestination()
            taps.set(ctx, msd)
            ensure()
            master.ctx.createMediaStreamSource(msd.stream).connect(master.dest)
          }
          origConnect.call(this, msd)
        }
      } catch { /* tap is best-effort — never break the app's audio */ }
      return origConnect.call(this, dst, ...rest)
    }
    // 2 · media elements: fork through captureStream() on first play
    const origPlay = HTMLMediaElement.prototype.play
    HTMLMediaElement.prototype.play = function (...a) {
      try {
        if (!this.__tapped && this.captureStream) {
          this.__tapped = true
          ensure()
          const s = this.captureStream()
          let wired = false
          const wire = () => {
            if (wired || !s.getAudioTracks().length) return
            wired = true
            master.ctx.createMediaStreamSource(s).connect(master.dest)
          }
          wire()
          s.addEventListener('addtrack', wire)
        }
      } catch { /* best-effort */ }
      return origPlay.apply(this, a)
    }
    let rec = null, chunks = []
    window.__startRec = () => {
      ensure()
      master.ctx.resume?.()
      chunks = []
      rec = new MediaRecorder(master.dest.stream, { mimeType: 'audio/webm;codecs=opus', audioBitsPerSecond: 256000 })
      rec.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data) }
      rec.start(250)
    }
    window.__stopRec = () => new Promise((resolve) => {
      rec.onstop = async () => {
        const buf = await new Blob(chunks, { type: 'audio/webm' }).arrayBuffer()
        let bin = ''
        const bytes = new Uint8Array(buf)
        for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
        resolve(btoa(bin))
      }
      rec.stop()
    })
  })
  await page.goto(URL, { waitUntil: 'networkidle' })

  console.log('  warm run (caches, ~31s)…')
  await page.click('.trailer-start-btn')
  await page.waitForSelector('.trailer-end', { timeout: 90000 })
  await page.click('.trailer-end .trailer-start-btn')          // REPLAY reloads the page
  await page.waitForSelector('.trailer-start-btn', { timeout: 30000 })

  console.log('  recorded run (~31s)…')
  await page.evaluate(() => window.__startRec())
  await page.click('.trailer-start-btn')
  await page.waitForSelector('.trailer-end', { timeout: 90000 })
  const t = await page.evaluate(() => document.querySelector('.trailer')?.dataset.t)
  const b64 = await page.evaluate(() => window.__stopRec())
  fs.writeFileSync(AUDIO_WEBM, Buffer.from(b64, 'base64'))
  await browser.close()
  console.log('PASS 2 done — trailer clock ended at t=%ss (drift vs 30.0 shows as late cues)', t)
}

// ── MUX ──────────────────────────────────────────────────────────────────────
function mux() {
  execFileSync(FFMPEG, [
    '-y',
    '-framerate', String(FPS), '-i', path.join(FRAME_DIR, 'f%05d.png'),
    '-i', AUDIO_WEBM,
    '-c:v', 'libx264', '-preset', 'slow', '-crf', '16', '-pix_fmt', 'yuv420p',
    '-r', String(FPS),
    '-c:a', 'aac', '-b:a', '256k',
    '-shortest', '-movflags', '+faststart',
    OUT,
  ], { stdio: 'inherit' })
  console.log('MUX done →', OUT)
}

const t0 = Date.now()
console.log('PASS 1 · deterministic 1080p frames from', URL)
await renderFrames()
console.log('PASS 2 · real-time audio capture (this will be audible)')
await recordAudio()
console.log('MUX · encoding')
mux()
console.log('done in %ds →', ((Date.now() - t0) / 1000).toFixed(0), OUT)
