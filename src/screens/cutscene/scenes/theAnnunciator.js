import * as THREE from 'three'
import { TEAMS } from '../../battle/constants'
import { buildBlueModel } from '../../battle/geometry'
import { buildAnnunciator } from '../models'
import { playLanceCharge, preloadLanceSfx } from '../../../lib/lanceSfx'
import { getFlag } from '../../../lib/store'
import { registerAudioContext } from '../../../lib/audioUnlock'

// The last resort of the Empire, never yet fired in anger. The Cathedra's
// golden word arrives down the light, the launch codes verify box by box —
// and only the player's LAUNCH wakes the great driver: coils, arcs, the round
// forming at the muzzle, the whole spin-up, then Her word releases it.
const LINE1 = 'Annunciator armed. Black-hole package loaded. Driver spinning to ninety percent of light.'
const LINE_CODES = 'Launch codes received.'
const LINE2 = 'Caelum canit, illa audit.'   // the Admiralty's ritual response…
const LINE3 = 'Let it be cast.'             // …and Her word alone releases it
const MUZZLE = new THREE.Vector3(31, 0, 0)
const RAY_T = 2.2, CODES_T = 4.6, PANEL_T = 6.8   // the word arrives, is spoken, is verified

// codetick.wav for each locking code character — decoded once into a lazy
// WebAudio buffer so fifteen rapid plays cost one tiny source node each
// (no HTMLAudio clones), sharing the title-boom pattern.
const TICK_BASE = import.meta.env?.BASE_URL ?? '/'
let tickCtx = null, tickBuf = null, tickLoading = null
function initCodeTick() {
  try { tickCtx = tickCtx || registerAudioContext(new (window.AudioContext || window.webkitAudioContext)()) } catch (_) { return }
  tickLoading = tickLoading || fetch(`${TICK_BASE}codetick.wav`)
    .then((r) => r.arrayBuffer())
    .then((ab) => tickCtx.decodeAudioData(ab))
    .then((b) => { tickBuf = b })
    .catch(() => {})
}
function playCodeTick() {
  if (getFlag('soundMuted') || !tickCtx || !tickBuf) return
  if (tickCtx.state === 'suspended') tickCtx.resume().catch(() => {})
  const src = tickCtx.createBufferSource(); src.buffer = tickBuf
  const g = tickCtx.createGain(); g.gain.value = 0.5
  src.connect(g); g.connect(tickCtx.destination)
  src.start()
}

// ── The launch-code verifier ─────────────────────────────────────────────────
// A diegetic reprise of the old fire-control terminal's sequence: fifteen code
// boxes cycling A–Z0–9, locking true one by one, then LAUNCH enables — and
// waits for the player's hand. Mounted beside the comms box (same stacking
// world) like the other holographic overlays; the story clock holds until fired.
const CODE_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
const BOX_COUNT = 15
const CYCLE_S = 0.075, LOCK_START_S = 0.7, LOCK_INTERVAL_S = 0.26
const randChar = () => CODE_CHARS[(Math.random() * CODE_CHARS.length) | 0]

function makeLaunchPanel({ track }, { onLock, onLaunch } = {}) {
  const wrap = document.createElement('div'); wrap.className = 'ultima-wrap'
  const panel = document.createElement('div'); panel.className = 'ultima-panel'
  const eyebrow = document.createElement('div'); eyebrow.className = 'uc-eyebrow'; eyebrow.textContent = 'ANNUNCIATOR LAUNCH CONTROL'
  const title = document.createElement('div'); title.className = 'uc-title'; title.textContent = 'VERIFYING LAUNCH CODES'
  const boxRow = document.createElement('div'); boxRow.className = 'uc-boxes'
  const boxes = [], finals = []
  for (let i = 0; i < BOX_COUNT; i++) {
    const b = document.createElement('div'); b.className = 'uc-box'; b.textContent = randChar()
    boxRow.appendChild(b); boxes.push(b); finals.push(randChar())
  }
  const status = document.createElement('div'); status.className = 'uc-status'; status.textContent = 'AUTHENTICATING — 0 / 15'
  const btn = document.createElement('button'); btn.className = 'uc-launch'; btn.textContent = 'LAUNCH'; btn.disabled = true
  panel.append(eyebrow, title, boxRow, status, btn); wrap.appendChild(panel)
  const host = document.querySelector('#cutscene-screen .sb-stage') || document.body
  host.appendChild(wrap)

  const state = { shown: false, fired: false, verified: false }
  let lt = 0, cycleCd = 0, locked = 0
  btn.addEventListener('click', () => {
    if (state.fired || locked < BOX_COUNT) return
    state.fired = true
    panel.classList.remove('is-on')
    setTimeout(() => { wrap.style.display = 'none' }, 500)
    onLaunch?.()
  })
  track({ dispose: () => wrap.remove() })
  return {
    state,
    show() {
      state.shown = true
      void panel.offsetWidth
      panel.classList.add('is-on')
    },
    tick(dt) {
      if (!state.shown || state.fired) return
      lt += dt
      const want = Math.max(0, Math.min(BOX_COUNT, Math.floor((lt - LOCK_START_S) / LOCK_INTERVAL_S) + 1))
      while (locked < want) {
        boxes[locked].textContent = finals[locked]
        boxes[locked].classList.add('locked')
        locked++
        onLock?.(locked)
        status.textContent = `AUTHENTICATING — ${locked} / ${BOX_COUNT}`
        if (locked === BOX_COUNT) {
          state.verified = true
          status.textContent = 'CODES VERIFIED — LAUNCH ENABLED'
          status.classList.add('verified')
          btn.disabled = false
          btn.classList.add('is-ready')
        }
      }
      cycleCd -= dt
      if (cycleCd <= 0 && locked < BOX_COUNT) {
        for (let i = locked; i < BOX_COUNT; i++) boxes[i].textContent = randChar()
        cycleCd = CYCLE_S
      }
    },
  }
}

export default {
  label: 'CUTSCENE / ULTIMA RATIO',
  establishing: { name: 'ULTIMA RATIO', sub: 'Her Annunciator · The Last Resort of the Empire', stamp: 'HMSS FIRE-CONTROL BUS v6.2.41 · DEFCON-1' },
  feed: [
    { t: 1.0, level: 'ok',   text: '[OK] HMSS fire-control bus online · v6.2.41' },
    { t: 2.9, level: 'ok',   text: '[OK] CATHEDRA CARRIER ACQUIRED · Her word rides the light' },
    { t: 5.0, level: 'crit', text: 'LAUNCH CODES RECEIVED · verification pending' },
    { t: 8.4, level: 'info', text: 'PHYSICS PACKAGE LOADED · Kerr–Newman warhead · awaiting authorisation' },
  ],
  readout: {
    id: 'PNL-007 · Driver',
    rows: [
      { label: 'Carrier', value: (t) => (t < 2.9 ? 'SEARCHING' : 'CATHEDRA · LOCK') },
      { label: 'Codes',   value: (t) => (t < 5.0 ? 'AWAITED' : 'RECEIVED') },
      { label: 'Package', value: 'TYPE-IV · K–N' },
    ],
  },
  bloom: 0.75,
  create(ctx) {
    const { scene, camera, fx, sfx, comms, end, orient } = ctx
    const station = buildAnnunciator(); scene.add(station)   // muzzle at x≈31 — matches MUZZLE

    // EM coils igniting one by one, breech → muzzle, as the driver spins up
    // (positions mirror the builder's coil run)
    const coilRingMat = new THREE.MeshBasicMaterial({ color: 0x9fd8ff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false })
    const coilRings = []
    for (let i = 0; i < 10; i++) {
      const x = -16 + i * (i < 6 ? 3.4 : 4.6) + (i >= 6 ? -7.2 : 0)
      const ring = new THREE.Mesh(new THREE.TorusGeometry(3.05, 0.14, 8, 32), coilRingMat.clone())
      ring.position.set(x, 0, 0); ring.rotation.y = Math.PI / 2; station.add(ring)
      coilRings.push({ ring, lit: false, at: (i + 1) / 11, pop: 0 })
    }

    // capacitor discharge arcs crawling over the breech while the bank charges
    const arcMat = new THREE.MeshBasicMaterial({ color: 0xcfe8ff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false })
    const arcs = []
    for (let i = 0; i < 4; i++) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 1), arcMat.clone()); station.add(m)
      arcs.push({ m, cd: 0 })
    }
    const _a1 = new THREE.Vector3(), _a2 = new THREE.Vector3()
    const breechPt = (v) => v.set(-22 + (Math.random() - 0.5) * 7, (Math.random() - 0.5) * 8.5, (Math.random() - 0.5) * 6.5)

    // matter streaming into an accretion swirl around the forming round
    const swirlMat = new THREE.MeshBasicMaterial({ color: 0xffe2b0, transparent: true, opacity: 0.75, blending: THREE.AdditiveBlending, depthWrite: false })
    const swirls = []
    for (let i = 0; i < 3; i++) {
      const m = new THREE.Mesh(fx.blastGeo, swirlMat); m.scale.set(1.15, 0.16, 0.35); m.visible = false; station.add(m)
      swirls.push({ m, a: (i / 3) * Math.PI * 2 })
    }

    // the committed firing solution — a hairline sight lancing out into the dark
    const sightMat = new THREE.MeshBasicMaterial({ color: 0xff8a5a, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false })
    const sight = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 220, 6), sightMat)
    sight.rotation.z = Math.PI / 2; sight.position.set(31 + 110, 0, 0); sight.visible = false; station.add(sight)

    // the Cathedra's word, arriving down the light: the same golden pillar that
    // rose from the crown in Providence, here received at the breech — the
    // station's ear, not its throat
    const RAY_FROM = new THREE.Vector3(-120, 130, -170), RAY_TO = new THREE.Vector3(-22, 3, 0)
    const rayDir = new THREE.Vector3().subVectors(RAY_FROM, RAY_TO), rayLen = rayDir.length(); rayDir.normalize()
    const rayMat = new THREE.MeshBasicMaterial({ color: 0xfff0c4, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false })
    const ray = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 0.7, rayLen, 12, 1, true), rayMat)
    ray.position.copy(RAY_TO).addScaledVector(rayDir, rayLen / 2)
    ray.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), rayDir)
    ray.visible = false; scene.add(ray)
    const rayGlowMat = new THREE.MeshBasicMaterial({ color: 0xffe9b0, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false })
    const rayGlow = new THREE.Mesh(fx.blastGeo, rayGlowMat); rayGlow.position.copy(RAY_TO); rayGlow.scale.setScalar(1.6); scene.add(rayGlow)
    const rayLight = new THREE.PointLight(0xffe9b0, 0, 130); rayLight.position.copy(RAY_TO); scene.add(rayLight)

    // the admiral-skill charge tone accompanies the round being fed; cut silently
    // on teardown so skipping mid-charge doesn't leave it playing
    preloadLanceSfx()
    let discharge = null
    ctx.track({ dispose: () => discharge && discharge(false) })

    // escorts holding station alongside
    const escMat = new THREE.MeshStandardMaterial({ color: TEAMS.blue.color, emissive: TEAMS.blue.color, emissiveIntensity: 0.5, metalness: 0.6, roughness: 0.4 })
    const escorts = []
    for (const [x, y, z] of [[-10, 12, 12], [4, -11, 14], [-24, -8, -12]]) {
      const g = new THREE.Group(); g.add(new THREE.Mesh(buildBlueModel(), escMat))
      const glow = new THREE.Mesh(fx.blastGeo, fx.glowMat.blue); glow.scale.setScalar(0.3); glow.position.set(0, 0, -0.95); g.add(glow)
      g.scale.setScalar(1.2); g.position.set(x, y, z); orient(g, new THREE.Vector3(1, 0, 0)); scene.add(g); escorts.push({ g, b: y })
    }

    // the round being charged, and energy streaming inward to feed it
    const chargeMat = new THREE.MeshBasicMaterial({ color: 0xfff0c4, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false })
    const charge = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 20), chargeMat); charge.position.copy(MUZZLE); charge.scale.setScalar(0.3); charge.visible = false; station.add(charge)
    const haloMat = new THREE.MeshBasicMaterial({ color: 0xffc870, transparent: true, opacity: 0.4, blending: THREE.AdditiveBlending, depthWrite: false })
    const halo = new THREE.Mesh(new THREE.SphereGeometry(1.8, 20, 20), haloMat); halo.position.copy(MUZZLE); halo.visible = false; station.add(halo)
    const streamMat = new THREE.MeshBasicMaterial({ color: 0xffd9a0, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false })
    const streams = []
    const spawnStream = () => {
      const m = new THREE.Mesh(fx.blastGeo, streamMat)
      const dir = new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize()
      m.position.copy(MUZZLE).addScaledVector(dir, 16 + Math.random() * 10); m.scale.setScalar(0.5 + Math.random() * 0.4); scene.add(m)
      streams.push({ m })
    }

    const _from = new THREE.Vector3(-58, 14, 40), _to = new THREE.Vector3(12, 7, 34), _p = new THREE.Vector3(), _d = new THREE.Vector3(), _l = new THREE.Vector3()
    const LOOK_FROM = new THREE.Vector3(-18, 2, 0), LOOK_TO = new THREE.Vector3(14, 0, 0)   // settle a touch aft so the arriving ray stays in frame
    const panel = makeLaunchPanel(ctx, {
      onLock: () => playCodeTick(),
      onLaunch: () => { sfx.rumble(0.6, 2.4); sfx.blip(520, 0.3, 0.5) },
    })
    initCodeTick()   // decode codetick.wav before the first lock needs it
    let T = 0, launchT = 0, c1 = false, cCodes = false, c2 = false, c3 = false, ended = false, streamCd = 0, chargeStarted = false
    let rayT = 0, rayStarted = false, panelShown = false, sightT = 0
    return (dt) => {
      T += dt
      // everything the driver does waits on the player's LAUNCH
      if (panel.state.fired) launchT += dt
      const charged = Math.min(1, launchT / 9)
      // charge.mp3 runs 9.55s; stretched to 0.6× it plays ~15.9s — the whole
      // spin-up, its crescendo landing as the scene fades — pitched down into
      // a heavier voice for the great driver, and a touch quieter
      if (!chargeStarted && panel.state.fired) { chargeStarted = true; discharge = playLanceCharge({ rate: 0.6, volume: 0.7 }) }
      // the muzzle stays dark until the launch order — then the round forms
      charge.visible = halo.visible = panel.state.fired
      for (const sw of swirls) sw.m.visible = panel.state.fired
      charge.scale.setScalar(0.3 + charged * 2.8); halo.scale.setScalar(1 + charged * 2.4)
      chargeMat.opacity = 0.7 + 0.3 * Math.sin(T * 6) * charged
      for (const e of escorts) e.g.position.y = e.b + Math.sin(T * 1.1 + e.b) * 0.8

      // coils catch, breech → muzzle, each with its own soft ignition blip
      for (const c of coilRings) {
        if (!c.lit && charged >= c.at) { c.lit = true; c.pop = 1; sfx.blip(440 + c.at * 900, 0.16, 0.16) }
        if (c.lit) {
          c.pop = Math.max(0, c.pop - dt * 2.2)
          c.ring.material.opacity = 0.34 + 0.5 * c.pop + 0.08 * Math.sin(T * 7 + c.at * 20)
          c.ring.scale.setScalar(1 + c.pop * 0.25)
        }
      }

      // capacitor arcs crawl faster as the bank fills
      if (launchT > 0.5) {
        for (const arc of arcs) {
          arc.cd -= dt
          if (arc.cd <= 0) {
            breechPt(_a1); breechPt(_a2)
            const len = _a1.distanceTo(_a2)
            arc.m.position.lerpVectors(_a1, _a2, 0.5)
            arc.m.lookAt(_a2.add(station.position))
            arc.m.scale.set(1, 1, len)
            arc.m.material.opacity = 0.5 + Math.random() * 0.4
            arc.cd = 0.05 + Math.random() * (0.3 - charged * 0.22)
          }
          arc.m.material.opacity = Math.max(0, arc.m.material.opacity - dt * 6)
        }
      }

      // the swirl tightens around the round as it forms
      for (const sw of swirls) {
        sw.a += (1.6 + charged * 3.4) * dt
        const r = 4.2 - charged * 2.3
        sw.m.position.set(MUZZLE.x + Math.cos(sw.a) * r * 0.35, Math.sin(sw.a) * r * 0.5, Math.cos(sw.a + 1.7) * r)
        sw.m.rotation.y = sw.a
      }

      // the golden word arrives: the ray builds, the station answers in light —
      // and once the codes verify, the word is delivered and the light withdraws
      if (T >= RAY_T && !rayStarted) { rayStarted = true; ray.visible = true; sfx.rumble(0.4, 2.6); sfx.blip(660, 0.18, 0.9) }
      if (rayStarted) {
        rayT = panel.state.verified ? Math.max(0, rayT - dt / 1.1) : Math.min(1, rayT + dt / 1.4)
        ray.visible = rayGlow.visible = rayT > 0.005
        rayMat.opacity = rayT * (0.34 + 0.1 * Math.sin(T * 5.2))
        ray.scale.set(1 + 0.15 * Math.sin(T * 3.1), 1, 1 + 0.15 * Math.cos(T * 2.7))
        rayGlowMat.opacity = rayT * (0.5 + 0.2 * Math.sin(T * 6))
        rayGlow.scale.setScalar(1.6 + rayT * 1.2 + 0.3 * Math.sin(T * 4.4))
        rayLight.intensity = rayT * (2.2 + 0.5 * Math.sin(T * 4))
      }

      // the verifier: raised once the codes are spoken, held until LAUNCH
      if (!panelShown && T >= PANEL_T) { panelShown = true; panel.show(); sfx.blip(1400, 0.3, 0.4) }
      panel.tick(dt)

      // firing solution committed — the sight blinks out along the geodesic
      // once the driver has spun all the way up
      if (!sight.visible && launchT >= 9.6) { sight.visible = true; sfx.blip(1250, 0.2, 0.3) }
      if (sight.visible) {
        sightT += dt
        sightMat.opacity = (sightT < 2.4 ? 0.4 : Math.max(0, 0.4 - (sightT - 2.4) * 0.5)) * (0.6 + 0.4 * Math.sin(T * 9))
      }

      streamCd -= dt; if (panel.state.fired && streamCd <= 0) { spawnStream(); streamCd = 0.04 + (1 - charged) * 0.1 }
      for (let i = streams.length - 1; i >= 0; i--) {
        const s = streams[i]; _d.subVectors(MUZZLE, s.m.position); const d = _d.length(); _d.normalize()
        s.m.position.addScaledVector(_d, (28 + (16 - Math.min(16, d)) * 4) * dt); s.m.scale.multiplyScalar(0.97)
        if (d < 1.5) { scene.remove(s.m); streams.splice(i, 1) }
      }

      // one long reveal: from behind the breech, tracking down the whole rail
      // run to settle on the muzzle and the thing being born there
      const k = Math.min(1, T / 12), ke = k * k * (3 - 2 * k)
      _p.lerpVectors(_from, _to, ke); camera.position.copy(_p)
      _l.lerpVectors(LOOK_FROM, LOOK_TO, ke); camera.lookAt(_l)
      if (!cCodes && T >= CODES_T) { cCodes = true; comms.show('Admiralty Command', LINE_CODES) }
      if (!c1 && launchT >= 1.5) { c1 = true; comms.show('Admiralty Command', LINE1) }
      if (!c2 && launchT >= 10.4) { c2 = true; comms.show('Admiralty Command', LINE2) }
      if (!c3 && launchT >= 13.8) { c3 = true; comms.show('Her Imperial Majesty Iliantha III', LINE3, { persist: true }) }
      if (!ended && launchT >= 17.5) { ended = true; end() }
    }
  },
}
