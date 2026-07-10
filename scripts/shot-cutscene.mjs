// ─────────────────────────────────────────────────────────────────────────────
// Screenshot a cutscene at chosen timestamps (visual QA without clicking through
// the campaign):
//   node scripts/shot-cutscene.mjs <sceneId> [t1 t2 ...]     → renders/shots/
//   node scripts/shot-cutscene.mjs all                       → every scene, default times
//
// Drives the system Chrome headless via playwright-core, imports the REAL scene
// registry + stage through the Vite dev server (:5173), mounts the stage full-
// screen with stub comms/end hooks, and captures the page at each requested
// scene-time (real-time playback — the stage runs its own clock).
// ─────────────────────────────────────────────────────────────────────────────
import { chromium } from 'playwright-core'
import { mkdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const OUT = join(ROOT, 'renders', 'shots')
const DEV = 'http://localhost:5173'
const CHROME = 'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe'
const W = 1280, H = 720

const DEFAULT_TIMES = {
  firstContact:    [2, 8, 14, 20, 24],
  muster:          [3, 12, 15, 18.5, 25, 31, 36],
  warfront:        [2, 5, 9, 14],
  theHush:         [2, 6, 10, 14],
  theLitany:       [2, 7, 12, 18],
  theFall:         [2, 6, 11, 16],
  theResolve:      [2, 6, 10, 14],
  theAnnunciator:  [2, 6, 10, 14],
  theLance:        [1, 3.4, 6, 8.4, 10, 13.2],
  theOrderRestored:[2, 6, 10, 14],
}

const [, , sceneArg, ...timeArgs] = process.argv
if (!sceneArg) { console.error('usage: node scripts/shot-cutscene.mjs <sceneId|all> [t1 t2 ...]'); process.exit(1) }
const jobs = sceneArg === 'all'
  ? Object.entries(DEFAULT_TIMES)
  : [[sceneArg, timeArgs.length ? timeArgs.map(Number) : (DEFAULT_TIMES[sceneArg] ?? [2, 6, 10, 14])]]

mkdirSync(OUT, { recursive: true })
const browser = await chromium.launch({ executablePath: CHROME, headless: true })
const page = await browser.newPage({ viewport: { width: W, height: H } })
page.on('pageerror', (e) => console.error('[pageerror]', e.message))
page.on('console', (m) => { if (m.type() === 'error') console.error('[page]', m.text()) })
await page.goto(DEV + '/', { waitUntil: 'domcontentloaded' })

for (const [id, times] of jobs) {
  console.log(`\n${id} @ ${times.join(', ')}s`)
  // fresh mount per scene; stub hooks record instead of touching React
  await page.evaluate(async (sceneId) => {
    document.body.innerHTML = ''
    const mount = document.createElement('div')
    mount.style.cssText = 'position:fixed;inset:0;background:#000'
    document.body.appendChild(mount)
    const { SCENES } = await import('/src/screens/cutscene/scenes/index.js')
    const { createStage } = await import('/src/screens/cutscene/stage.js')
    const scene = SCENES[sceneId]
    if (!scene) throw new Error(`unknown scene: ${sceneId}`)
    window.__events = []
    window.__t0 = performance.now()
    window.__teardown = createStage(mount, scene, {
      comms: { show: (name, text) => window.__events.push(`comms[${((performance.now() - window.__t0) / 1000).toFixed(1)}s] ${name}: ${text.slice(0, 60)}`), hide: () => {} },
      end: () => window.__events.push(`end[${((performance.now() - window.__t0) / 1000).toFixed(1)}s]`),
    })
  }, id)

  const sorted = [...times].sort((a, b) => a - b)
  let prev = 0
  for (const t of sorted) {
    await page.waitForTimeout(Math.max(0, (t - prev) * 1000))
    prev = t
    await page.screenshot({ path: join(OUT, `${id}-${String(t).replace('.', '_')}s.png`) })
    console.log(`  saved ${id}-${t}s`)
  }
  const events = await page.evaluate(() => { const e = window.__events; try { window.__teardown() } catch (_) {} return e })
  for (const e of events) console.log(`  ${e}`)
}

await browser.close()
console.log('\ndone →', OUT)
