import { useRef, useEffect, useState } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js'
import HudHeader from '../components/HudHeader'
import HudFooter from '../components/HudFooter'
import {
  FLEET_SIZE, SHIP_HP, BOMBER_COUNT, CRUISER_COUNT, BOMBER_HP, BOMBER_SPEED, BOMBER_MIN, BOMBER_SCALE,
  BOMB_DMG, BOMB_RANGE, BOMB_LIFE, PD_RANGE, CAP_HP, CAP_SPEED, CAP_WEAPONS, BOLT_SPEED, MISS_CHANCE,
  BOMB_MISS_CHANCE, MAX_SPEED, MIN_SPEED, SEP_RADIUS, BOUND_R, STANDOFF, FIGHTER_RANGE, TURN_RATE,
  FIELD_FIGHTER_CAP, REINFORCE_INTERVAL, BOMBER_AUTO_DISPATCH, ARMOR_FIGHTER, ARMOR_BOMBER, ARMOR_FLAGSHIP, ARMOR_CRUISER,
  FLARES_BOMBER, FLARES_FLAGSHIP,
  CRUISER_HP, CRUISER_SPEED, CRUISER_MIN, CRUISER_SCALE, CRUISER_STANDOFF, CRUISER_TURN_RATE,
  MISSILE_DMG, MISSILE_SALVO, MISSILE_SPEED, MISSILE_LIFE, MISSILE_RANGE, MISSILE_MISS_CHANCE, MISSILE_HOMING, MISSILE_TURN, MISSILE_ACCEL, MISSILE_LAUNCH_SPEED, MISSILE_CD_MIN, MISSILE_CD_RND,
  PTS_FIGHTER, PTS_BOMBER, PTS_CRUISER, PTS_FLAGSHIP, PTS_FLAGSHIP_MIN, FLEET_BUDGET, RETREAT_STRENGTH, MORALE_BROKEN_STRENGTH, compStrength, TEAMS, SOUND_FILES,
  RED_CAP_NAME, randomBlueCapName, splitCapName, COMMS_PORTRAIT, VICTORY_SEGMENTS,
} from './battle/constants'
import { NEBULA_VERT, NEBULA_FRAG, buildBlueModel, buildRedModel, buildBlueCapital, buildRedCapital, buildBlueBomber, buildRedBomber, buildBlueCruiser, buildRedCruiser, makeShield, makeBackdrop } from './battle/geometry'
import { makeCampaignBackdrop } from './battle/campaignBackdrop'
import { Briefing, ShipSprite, renderCommsBody } from './battle/RosterUI'
import './battle/battle.css'

// `campaign` (optional) turns this into a campaign engagement: both fleets are
// locked (built in the shipyard beforehand), the flagship/enemy names are the
// persistent campaign ones, the battle auto-starts, and resolving it reports the
// result back so Requisition can be banked. Absent → the standalone skirmish.
export default function SpaceBattleScreen({ onReturn, campaign = null }) {
  const isCampaign = !!campaign
  const mountRef     = useRef(null)
  const blueCountRef = useRef(null)
  const redCountRef  = useRef(null)
  const blueStrengthRef = useRef(null)
  const redStrengthRef  = useRef(null)
  const powerBarRef     = useRef(null)
  const blueMoraleRef   = useRef(null)
  const redMoraleRef    = useRef(null)
  const timerRef     = useRef(null)             // battle clock DOM node (sim-time elapsed)
  const [simSpeed, setSimSpeed] = useState(1)   // 0 (paused) | 0.5 | 1
  const simSpeedRef = useRef(1)
  useEffect(() => { simSpeedRef.current = simSpeed }, [simSpeed])
  const [pipCaption, setPipCaption] = useState(null)  // { team, text } — picture-in-picture event highlight
  const pipRef = useRef(null)                         // active PiP 3D state for the render loop
  // blue flagship name: campaign uses the persistent fleet name; skirmish rolls a
  // random one that can be re-rolled on the briefing
  const [blueCapName, setBlueCapName] = useState(() => campaign?.flagshipName || randomBlueCapName())
  const blueCapNameRef = useRef(blueCapName)
  useEffect(() => { blueCapNameRef.current = blueCapName }, [blueCapName])
  const cycleBlueName = () => setBlueCapName(randomBlueCapName())
  // red flagship name: campaign uses the node's enemy name; skirmish uses the default
  const redCapName = campaign?.enemyName || RED_CAP_NAME
  const redCapNameRef = useRef(redCapName)
  useEffect(() => { redCapNameRef.current = redCapName }, [redCapName])
  const [winner, setWinner] = useState(null)   // null | 'BLUE' | 'RED' | 'DRAW'
  const [runId,  setRunId]  = useState(0)
  const [kills,  setKills]  = useState([])      // recent kill-feed entries
  const [stats,  setStats]  = useState(null)    // post-battle breakdown
  const [muted,  setMuted]  = useState(true)    // sound off by default
  const [started, setStarted] = useState(isCampaign) // campaign auto-starts (the shipyard was the briefing)
  const [campResult, setCampResult] = useState(null) // campaign: banked outcome { award, won, firstClear, progress }
  // per-team fleet composition. Skirmish: customisable on the briefing within the
  // 1000-point budget. Campaign: locked to the fleets supplied by the shipyard.
  const [comp, setComp] = useState(() => isCampaign
    ? { blue: { ...campaign.playerComp }, red: { ...campaign.enemyComp } }
    : {
        blue: { fighters: FLEET_SIZE, bombers: BOMBER_COUNT, cruisers: CRUISER_COUNT },
        red:  { fighters: FLEET_SIZE, bombers: BOMBER_COUNT, cruisers: CRUISER_COUNT },
      })
  const compRef = useRef(comp)
  useEffect(() => { compRef.current = comp }, [comp])
  const adjustComp = (team, kind, delta) => setComp(c => {
    const next = { ...c[team], [kind]: c[team][kind] + delta }
    if (next[kind] < 0) return c                                   // can't go below zero
    if (delta > 0 && compStrength(next) > FLEET_BUDGET) return c    // no free points to spend
    return { ...c, [team]: next }
  })
  const [comms, setComms]   = useState(null)    // active capital broadcast { id, team, name, portrait, text, persist }
  const [commsText, setCommsText] = useState('')// progressively-typed body
  const commsSeq   = useRef(0)
  const commsQueue = useRef([])                 // pending broadcasts waiting their turn
  const commsBusy  = useRef(false)              // a broadcast is currently on screen
  const [followName, setFollowName] = useState(null)  // tracked ship name (third-person view active)
  const [followTeam, setFollowTeam] = useState(null)  // tracked ship's team (colours the readout)
  const followRef    = useRef(null)             // the ship the camera is following (or null)
  const followHpRef  = useRef(null)             // live "remaining / max" hull text for the tracked ship
  const followBarRef = useRef(null)             // live hull bar fill for the tracked ship
  const followTargetRef = useRef(null)          // live "TARGET: …" text for the tracked ship
  const exitFollowRef = useRef(null)            // revert-to-tactical fn, wired up inside the scene
  const followBomberRef = useRef(null)          // follow-a-blue-bomber-by-index fn, wired up inside the scene
  const killSeq = useRef(0)
  const audioRef = useRef(null)
  const blueCapRef = useRef(null), blueShieldRef = useRef(null), blueReserveRef = useRef(null)
  const redCapRef  = useRef(null), redShieldRef  = useRef(null), redReserveRef  = useRef(null)

  // ── Player tactics (blue fleet only) ──────────────────────────────────────
  const [capTactic,     setCapTactic]     = useState('hold')      // 'hold' | 'engage'
  // single blue-fighter posture: each mode sets both movement and target priority
  const [fighterControl, setFighterControl] = useState('default')  // 'default' | 'screen' | 'pursue' | 'capital'
  const [bombersCalled, setBombersCalled] = useState(false)              // player has called the blue bomber wing
  const [blueBomberAlive, setBlueBomberAlive] = useState(() => Array(BOMBER_COUNT).fill(true))  // per-bomber status for the roster
  const callBombersRef = useRef(false)
  const bomberCountdownRef = useRef(null)       // live "auto dispatch in Ns" text element
  const capTacticRef      = useRef(capTactic)
  const fighterControlRef = useRef(fighterControl)
  useEffect(() => { capTacticRef.current = capTactic }, [capTactic])
  useEffect(() => { fighterControlRef.current = fighterControl }, [fighterControl])

  // Enqueue a broadcast; show it now if the box is free, otherwise queue it so
  // simultaneous lines play one after another rather than overlapping.
  const enqueueComms = (item) => {
    if (commsBusy.current) { commsQueue.current.push(item); return }
    commsBusy.current = true
    setComms(item)
  }

  // ── Capital comms broadcast: chirp, type the line out, then show the next ──
  useEffect(() => {
    if (!comms) { setCommsText(''); return }
    audioRef.current?.playComms()                          // chirp each time a box appears
    setCommsText('')
    let i = 0
    const full = comms.text
    const typer = setInterval(() => {
      i++
      setCommsText(full.slice(0, i))
      if (i >= full.length) clearInterval(typer)
    }, 42)
    if (comms.persist) return () => clearInterval(typer)   // victory line stays until restart
    const hide = setTimeout(() => {
      const next = commsQueue.current.shift()
      if (next) setComms(next)                             // advance the queue
      else { commsBusy.current = false; setComms(null) }
    }, 2800)                                               // visible for a couple of seconds
    return () => { clearInterval(typer); clearTimeout(hide) }
  }, [comms?.id])

  // ── Procedural audio engine (synthesised — no asset files) ─────────────────
  useEffect(() => {
    let ctx
    try { ctx = new (window.AudioContext || window.webkitAudioContext)() } catch (_) { return }
    const TARGET_VOL = 0.42

    // master bus: soft-clip saturation + compressor for glue and punch
    const master = ctx.createGain(); master.gain.value = 0   // ramp up on resume
    const shaper = ctx.createWaveShaper()
    { const n = 1024, c = new Float32Array(n); for (let i = 0; i < n; i++) { const x = (i / (n - 1)) * 2 - 1; c[i] = Math.tanh(x * 1.5) } shaper.curve = c; shaper.oversample = '2x' }
    const comp = ctx.createDynamicsCompressor()
    comp.threshold.value = -16; comp.knee.value = 22; comp.ratio.value = 3.2; comp.attack.value = 0.003; comp.release.value = 0.25
    comp.connect(shaper); shaper.connect(master); master.connect(ctx.destination)

    // reverb send (synthetic impulse) for a sense of space
    const conv = ctx.createConvolver()
    { const len = Math.floor(ctx.sampleRate * 1.3), b = ctx.createBuffer(2, len, ctx.sampleRate)
      for (let ch = 0; ch < 2; ch++) { const d = b.getChannelData(ch); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.6) }
      conv.buffer = b }
    const wet = ctx.createGain(); wet.gain.value = 0.5; conv.connect(wet); wet.connect(comp)
    const dry = ctx.createGain(); dry.connect(comp)
    const sendTo = (node, amt) => { const s = ctx.createGain(); s.gain.value = amt; node.connect(s); s.connect(conv) }

    // saturation curve reused for explosion grit
    const satCurve = (() => { const n = 1024, c = new Float32Array(n); for (let i = 0; i < n; i++) { const x = (i / (n - 1)) * 2 - 1; c[i] = Math.tanh(x * 3) } return c })()

    // shared white-noise buffer
    const noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate)
    const nd = noiseBuf.getChannelData(0)
    for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1

    let mutedLocal = true, lastLaser = 0, lastBoom = 0   // sound off by default

    // sample buffers — loaded from public/sfx/ when present; missing files are
    // ignored so each sound keeps its synthesised fallback below.
    const buffers = {}
    Object.entries(SOUND_FILES).forEach(([key, file]) => {
      fetch(`${import.meta.env.BASE_URL}${file}`)
        .then(r => { const ct = r.headers.get('content-type') || ''; if (!r.ok || ct.includes('text/html')) throw 0; return r.arrayBuffer() })
        .then(ab => ctx.decodeAudioData(ab))
        .then(buf => { buffers[key] = buf })
        .catch(() => {})   // no file (or not audio) → keep the synth version
    })
    // play a loaded sample through the same bus (so reverb / compression / mute apply)
    const playSample = (buf, gain, rate, reverb) => {
      const src = ctx.createBufferSource(); src.buffer = buf
      src.playbackRate.value = rate || 1
      const g = ctx.createGain(); g.gain.value = gain == null ? 1 : gain
      src.connect(g); g.connect(dry)
      if (reverb) sendTo(g, reverb)
      src.start()
    }

    const playLaser = (team) => {
      if (mutedLocal) return
      const now = ctx.currentTime
      if (now - lastLaser < 0.05) return         // rate-limit the crackle
      lastLaser = now
      const lbuf = (team === 'blue' ? buffers.laserBlue : buffers.laserRed) || buffers.laser
      if (lbuf) { playSample(lbuf, 0.9, 0.95 + Math.random() * 0.1, 0.1); return }
      const out = ctx.createGain()
      out.gain.setValueAtTime(0.0001, now)
      out.gain.linearRampToValueAtTime(0.18, now + 0.005)
      out.gain.exponentialRampToValueAtTime(0.0001, now + 0.18)
      // warm tone body — resonant lowpass tames the harsh top end
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'
      lp.frequency.value = team === 'blue' ? 2400 : 1900; lp.Q.value = 7
      const f0 = (team === 'blue' ? 700 : 500) * (0.95 + Math.random() * 0.1)
      const o1 = ctx.createOscillator(); o1.type = 'triangle'
      o1.frequency.setValueAtTime(f0 * 2.0, now); o1.frequency.exponentialRampToValueAtTime(f0 * 0.55, now + 0.14)
      const o2 = ctx.createOscillator(); o2.type = 'sine'
      o2.frequency.setValueAtTime(f0, now); o2.frequency.exponentialRampToValueAtTime(f0 * 0.4, now + 0.16)
      o1.connect(lp); o2.connect(lp); lp.connect(out)
      o1.start(now); o2.start(now); o1.stop(now + 0.19); o2.stop(now + 0.19)
      // attack "crack" — short high-passed noise transient for punch
      const nb = ctx.createBufferSource(); nb.buffer = noiseBuf
      const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 1500
      const ng = ctx.createGain(); ng.gain.setValueAtTime(0.22, now); ng.gain.exponentialRampToValueAtTime(0.0001, now + 0.045)
      nb.connect(hp); hp.connect(ng); ng.connect(out); nb.start(now); nb.stop(now + 0.05)
      out.connect(dry); sendTo(out, 0.1)
    }

    const playExplosion = (big) => {
      if (mutedLocal) return
      const now = ctx.currentTime
      if (now - lastBoom < 0.05) return
      lastBoom = now
      const ebuf = (big && buffers.explosionBig) || buffers.explosion
      if (ebuf) { playSample(ebuf, big ? 1 : 0.8, big ? 1 : 1.05 + Math.random() * 0.1, big ? 0.6 : 0.4); return }
      const dur = big ? 1.1 : 0.6
      const out = ctx.createGain()
      // 1) sharp initial crack — high-passed noise transient
      const cb = ctx.createBufferSource(); cb.buffer = noiseBuf
      const chp = ctx.createBiquadFilter(); chp.type = 'highpass'; chp.frequency.value = 800
      const cg = ctx.createGain(); cg.gain.setValueAtTime(big ? 0.55 : 0.4, now); cg.gain.exponentialRampToValueAtTime(0.0001, now + 0.09)
      cb.connect(chp); chp.connect(cg); cg.connect(out); cb.start(now); cb.stop(now + 0.1)
      // 2) saturated body roar — noise → soft clip → downward lowpass sweep
      const bb = ctx.createBufferSource(); bb.buffer = noiseBuf; bb.loop = true
      const ws = ctx.createWaveShaper(); ws.curve = satCurve
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'
      lp.frequency.setValueAtTime(big ? 1700 : 1200, now); lp.frequency.exponentialRampToValueAtTime(big ? 110 : 190, now + dur)
      const bg = ctx.createGain(); bg.gain.setValueAtTime(big ? 0.55 : 0.38, now); bg.gain.exponentialRampToValueAtTime(0.0001, now + dur)
      bb.connect(ws); ws.connect(lp); lp.connect(bg); bg.connect(out); bb.start(now); bb.stop(now + dur + 0.05)
      // 3) sub-bass thump for chest punch
      const o = ctx.createOscillator(); o.type = 'sine'
      o.frequency.setValueAtTime(big ? 110 : 145, now); o.frequency.exponentialRampToValueAtTime(big ? 32 : 50, now + dur * 0.5)
      const og = ctx.createGain(); og.gain.setValueAtTime(big ? 0.95 : 0.6, now); og.gain.exponentialRampToValueAtTime(0.0001, now + dur * 0.7)
      o.connect(og); og.connect(out); o.start(now); o.stop(now + dur)
      out.connect(dry); sendTo(out, big ? 0.6 : 0.4)
    }

    const playJump = () => {
      if (mutedLocal) return
      const now = ctx.currentTime
      if (buffers.jump) { playSample(buffers.jump, 0.9, 1, 0.5); return }
      const src = ctx.createBufferSource(); src.buffer = noiseBuf
      const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 1.4
      bp.frequency.setValueAtTime(180, now)
      bp.frequency.exponentialRampToValueAtTime(2600, now + 0.6)
      const g = ctx.createGain()
      g.gain.setValueAtTime(0.0001, now)
      g.gain.linearRampToValueAtTime(0.26, now + 0.4)
      g.gain.exponentialRampToValueAtTime(0.0001, now + 1.0)
      src.connect(bp); bp.connect(g); g.connect(dry); sendTo(g, 0.5); src.start(now); src.stop(now + 1.1)
      const o = ctx.createOscillator(), og = ctx.createGain()
      o.type = 'sawtooth'
      o.frequency.setValueAtTime(70, now); o.frequency.exponentialRampToValueAtTime(520, now + 0.6)
      const olp = ctx.createBiquadFilter(); olp.type = 'lowpass'; olp.frequency.value = 1800
      og.gain.setValueAtTime(0.0001, now)
      og.gain.linearRampToValueAtTime(0.13, now + 0.4); og.gain.exponentialRampToValueAtTime(0.0001, now + 0.9)
      o.connect(olp); olp.connect(og); og.connect(dry); o.start(now); o.stop(now + 0.95)
    }

    const playVictory = (winner) => {
      if (mutedLocal) return
      const now = ctx.currentTime
      if (buffers.victory) { playSample(buffers.victory, 0.9, 1, 0.4); return }
      const freqs = winner === 'RED' ? [98, 196, 233.1, 294] : [130.8, 261.6, 329.6, 392]
      freqs.forEach((f, i) => {
        const o = ctx.createOscillator(), g = ctx.createGain(), lp = ctx.createBiquadFilter()
        o.type = i === 0 ? 'sine' : 'triangle'; o.frequency.value = f
        lp.type = 'lowpass'; lp.frequency.value = 2200
        const tt = now + i * 0.08
        g.gain.setValueAtTime(0.0001, tt)
        g.gain.linearRampToValueAtTime(i === 0 ? 0.2 : 0.13, tt + 0.05)
        g.gain.exponentialRampToValueAtTime(0.0001, tt + 1.5)
        o.connect(lp); lp.connect(g); g.connect(dry); sendTo(g, 0.4); o.start(tt); o.stop(tt + 1.6)
      })
    }

    // comms-open chirp — a short two-tone radio blip when a broadcast appears
    const playComms = () => {
      if (mutedLocal) return
      const now = ctx.currentTime
      const bus = ctx.createGain(); bus.gain.value = 0.5
      bus.connect(dry); sendTo(bus, 0.18)
      const blip = (f, t0, dur) => {
        const o = ctx.createOscillator(); o.type = 'square'; o.frequency.value = f
        const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = f; bp.Q.value = 6
        const g = ctx.createGain()
        g.gain.setValueAtTime(0.0001, now + t0)
        g.gain.exponentialRampToValueAtTime(0.5, now + t0 + 0.008)
        g.gain.exponentialRampToValueAtTime(0.0001, now + t0 + dur)
        o.connect(bp); bp.connect(g); g.connect(bus)
        o.start(now + t0); o.stop(now + t0 + dur + 0.02)
      }
      blip(720, 0, 0.07)
      blip(1080, 0.085, 0.12)
    }

    // subtle ambient drone (two detuned low sines)
    const droneG = ctx.createGain(); droneG.gain.value = 0.03; droneG.connect(dry)
    const d1 = ctx.createOscillator(); d1.type = 'sine'; d1.frequency.value = 54;   d1.connect(droneG); d1.start()
    const d2 = ctx.createOscillator(); d2.type = 'sine'; d2.frequency.value = 54.5; d2.connect(droneG); d2.start()

    const applyVol = () => master.gain.setTargetAtTime(mutedLocal ? 0 : TARGET_VOL, ctx.currentTime, 0.06)
    const setMutedFn = (m) => { mutedLocal = m; applyVol() }
    const resume = () => { if (ctx.state === 'suspended') ctx.resume(); applyVol() }
    resume()
    window.addEventListener('pointerdown', resume)

    audioRef.current = { playLaser, playExplosion, playJump, playVictory, playComms, setMuted: setMutedFn }

    return () => {
      window.removeEventListener('pointerdown', resume)
      try { d1.stop(); d2.stop() } catch (_) {}
      audioRef.current = null
      ctx.close()
    }
  }, [])

  useEffect(() => { audioRef.current?.setMuted(muted) }, [muted])

  // ── Campaign: bank the outcome exactly once when the engagement resolves ──────
  useEffect(() => {
    if (!isCampaign || !winner || campResult) return
    setCampResult(campaign.onResolve(winner === 'BLUE'))
  }, [winner])   // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!started) return   // hold on the briefing until the player starts
    const mount = mountRef.current
    if (!mount) return
    let renderer, composer, raf
    const disposables = []
    setKills([])   // fresh kill feed each battle
    setComms(null); commsQueue.current = []; commsBusy.current = false   // clear any lingering broadcasts
    followRef.current = null; setFollowName(null); setFollowTeam(null)   // start in tactical view
    callBombersRef.current = false; setBombersCalled(false); setBlueBomberAlive(Array(compRef.current.blue.bombers).fill(true))  // bomber wing in reserve
    simSpeedRef.current = 1; setSimSpeed(1)                               // every battle starts running at 1×
    pipRef.current = null; setPipCaption(null)                           // no event highlight yet

    // surface a capital broadcast (queued, typewriter + chirp), driven by battle events
    const showComms = (team, text, persist = false) => {
      const name = team === 'blue' ? blueCapNameRef.current : redCapNameRef.current
      enqueueComms({ id: ++commsSeq.current, team, name, portrait: COMMS_PORTRAIT[team], text, segments: [{ text }], persist })
    }

    try {
      const w = mount.clientWidth || 1, h = mount.clientHeight || 1

      const scene = new THREE.Scene()
      const camera = new THREE.PerspectiveCamera(52, w / h, 0.1, 600)
      camera.position.set(0, 25, 60)   // ~30% further back

      // picture-in-picture camera (centre-right box) for highlighting key events
      const PIP_W = 300, PIP_H = 190, PIP_RIGHT = 24   // css px
      const pipCam = new THREE.PerspectiveCamera(34, PIP_W / PIP_H, 0.1, 600)

      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
      renderer.setSize(w, h)
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
      mount.appendChild(renderer.domElement)

      const controls = new OrbitControls(camera, renderer.domElement)
      controls.enableDamping = true
      controls.dampingFactor = 0.06
      controls.enablePan = false
      controls.minDistance = 18
      controls.maxDistance = 110
      controls.autoRotate = true
      controls.autoRotateSpeed = 0.25
      controls.target.set(0, 0, 0)

      // ── Lighting ─────────────────────────────────────────────────────────────
      scene.add(new THREE.AmbientLight(0x4a5a80, 0.75))
      const lightDir = new THREE.Vector3(0.12, 0.42, 0.9).normalize()
      const key = new THREE.DirectionalLight(0xcfe0ff, 0.8)
      key.position.copy(lightDir).multiplyScalar(40)
      scene.add(key)
      const rim = new THREE.DirectionalLight(0x4060a0, 0.35)   // cool back-fill
      rim.position.set(-20, -6, -30)
      scene.add(rim)

      // ── Nebula skydome ─────────────────────────────────────────────────────────
      const nebGeo = new THREE.SphereGeometry(330, 32, 32)
      const nebMat = new THREE.ShaderMaterial({
        vertexShader: NEBULA_VERT, fragmentShader: NEBULA_FRAG,
        uniforms: {
          uColA:    { value: new THREE.Color(0.030, 0.055, 0.140) },
          uColB:    { value: new THREE.Color(0.090, 0.035, 0.150) },
          uColWarm: { value: new THREE.Color(0.180, 0.070, 0.030) },
        },
        side: THREE.BackSide, depthWrite: false, depthTest: false,
      })
      const neb = new THREE.Mesh(nebGeo, nebMat)
      neb.renderOrder = -10
      scene.add(neb)
      disposables.push(nebGeo, nebMat)

      // ── Background body — random type, placed somewhere on-screen up front ──────
      camera.lookAt(0, 0, 0)            // orient the camera so the unproject is correct
      camera.updateMatrixWorld()
      // campaign battles feature the node's signature cutscene object in the
      // background; skirmishes get a random body
      const backdropTick = isCampaign
        ? makeCampaignBackdrop(scene, disposables, lightDir, camera, campaign.nodeIndex)
        : makeBackdrop(scene, disposables, lightDir, camera)

      // ── Starfield (cool dim field + a few bright stars) ─────────────────────────
      const starCount = 1500
      const starPos = new Float32Array(starCount * 3)
      const starCol = new Float32Array(starCount * 3)
      for (let i = 0; i < starCount; i++) {
        const rr = 120 + Math.random() * 180
        const th = Math.random() * Math.PI * 2
        const ph = Math.acos(2 * Math.random() - 1)
        starPos[i * 3]     = rr * Math.sin(ph) * Math.cos(th)
        starPos[i * 3 + 1] = rr * Math.sin(ph) * Math.sin(th)
        starPos[i * 3 + 2] = rr * Math.cos(ph)
        const roll = Math.random()
        let r, g, b
        if (roll > 0.95)      { r = 0.95; g = 0.97; b = 1.0 }                              // bright blue-white
        else if (roll > 0.92) { r = 1.0;  g = 0.85; b = 0.62 }                             // occasional warm star
        else { const v = 0.3 + Math.random() * 0.4; r = v * 0.72; g = v * 0.85; b = v }    // dim cool field
        starCol[i * 3] = r; starCol[i * 3 + 1] = g; starCol[i * 3 + 2] = b
      }
      const starGeo = new THREE.BufferGeometry()
      starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3))
      starGeo.setAttribute('color', new THREE.BufferAttribute(starCol, 3))
      const starMat = new THREE.PointsMaterial({ size: 0.75, sizeAttenuation: true, vertexColors: true, transparent: true, opacity: 0.9 })
      scene.add(new THREE.Points(starGeo, starMat))
      disposables.push(starGeo, starMat)

      // ── Shared geometry ──────────────────────────────────────────────────────
      const teamGeo = { blue: buildBlueModel(), red: buildRedModel() }
      const capGeo  = { blue: buildBlueCapital(), red: buildRedCapital() }
      const bomberGeo = { blue: buildBlueBomber(), red: buildRedBomber() }
      const cruiserGeo = { blue: buildBlueCruiser(), red: buildRedCruiser() }
      const boltGeo = new THREE.CylinderGeometry(0.08, 0.08, 1.7, 6)
      const blastGeo = new THREE.SphereGeometry(1, 12, 12)
      const ringGeo = new THREE.RingGeometry(0.62, 1.0, 32)
      const trailGeo = new THREE.CylinderGeometry(1, 1, 1, 6)   // unit streak (Y axis); scaled per warp segment
      const missileGeo = new THREE.CylinderGeometry(0.13, 0.07, 1.4, 6)   // small dart (long axis = travel)
      const missileMat = new THREE.MeshBasicMaterial({ color: 0xffcaa0, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false })  // glowing missile
      disposables.push(teamGeo.blue, teamGeo.red, capGeo.blue, capGeo.red, bomberGeo.blue, bomberGeo.red, cruiserGeo.blue, cruiserGeo.red, boltGeo, blastGeo, ringGeo, trailGeo, missileGeo, missileMat)
      const boltMat = {
        blue: new THREE.MeshBasicMaterial({ color: TEAMS.blue.bolt, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }),
        red:  new THREE.MeshBasicMaterial({ color: TEAMS.red.bolt,  transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }),
      }
      const bombMat = new THREE.MeshBasicMaterial({ color: 0xffb030, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false })  // glowing bomb ordnance
      const bombGeo = new THREE.BoxGeometry(0.6, 1.5, 0.2)   // a glowing rectangular slab (long axis = travel)
      const smokeMatProto = new THREE.MeshBasicMaterial({ color: 0x8c8c8c, transparent: true, opacity: 0.5, depthWrite: false })  // template for trail puffs
      disposables.push(bombMat, bombGeo, smokeMatProto)
      const glowMat = {   // engine glow — bright additive, tucked at each ship's tail
        blue: new THREE.MeshBasicMaterial({ color: TEAMS.blue.bolt, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false }),
        red:  new THREE.MeshBasicMaterial({ color: TEAMS.red.bolt,  transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false }),
      }
      disposables.push(boltMat.blue, boltMat.red, glowMat.blue, glowMat.red)

      // reusable scratch objects (avoid per-frame allocation)
      const yAxis = new THREE.Vector3(0, 1, 0)
      const UP    = new THREE.Vector3(0, 1, 0)
      const ORIGIN = new THREE.Vector3(0, 0, 0)
      const _dir = new THREE.Vector3(), _tmp = new THREE.Vector3(), _acc = new THREE.Vector3(), _tan = new THREE.Vector3()
      const _proj = new THREE.Vector3()
      const _m = new THREE.Matrix4(), _q = new THREE.Quaternion()
      let cw = w, ch = h   // canvas size, for projecting labels to screen px

      const orient = (mesh, dir, smooth) => {
        if (dir.lengthSq() < 1e-6) return
        _m.lookAt(dir, ORIGIN, UP)        // model +Z aligns to dir
        _q.setFromRotationMatrix(_m)
        if (smooth == null) mesh.quaternion.copy(_q)
        else mesh.quaternion.slerp(_q, smooth)
      }

      // ── Spawn the two fleets (loose cloud on each flank, charging inward) ─────
      const reserveLeft = { blue: 0, red: 0 }   // fighters held off-field, fed in as reinforcements
      const ships = []
      const spawnFleet = (team, sx, vdir) => {
        for (let i = 0; i < compRef.current[team].fighters; i++) {
          const reserve = i >= FIELD_FIGHTER_CAP     // beyond the field cap: held back as reinforcements
          const row = i % 5, col = Math.floor(i / 5)
          const mat = new THREE.MeshStandardMaterial({
            color: TEAMS[team].color, emissive: TEAMS[team].color,
            emissiveIntensity: 0.5, metalness: 0.6, roughness: 0.4,
          })
          disposables.push(mat)
          const mesh = new THREE.Group()
          mesh.add(new THREE.Mesh(teamGeo[team], mat))
          const glow = new THREE.Mesh(blastGeo, glowMat[team])  // engine glow at the tail
          glow.scale.setScalar(0.3)
          glow.position.set(0, 0, -0.95)
          mesh.add(glow)
          const pos = new THREE.Vector3(
            sx + (Math.random() - 0.5) * 5,
            (row - 2) * 2.6 + (Math.random() - 0.5) * 2,
            (col - 2) * 2.8 + (Math.random() - 0.5) * 2,
          )
          const vel = new THREE.Vector3(vdir * (2 + Math.random() * 2), (Math.random() - 0.5), (Math.random() - 0.5))
          mesh.position.copy(pos)
          orient(mesh, vel)
          mesh.visible = !reserve
          scene.add(mesh)
          ships.push({
            mesh, mat, team, hp: SHIP_HP, alive: !reserve, reserve, pos, vel,
            name: `${team === 'blue' ? 'Blue' : 'Red'} Fighter ${i + 1}`,
            fireCd: 0.5 + Math.random() * 2.5, flash: 0,
            isCapital: false, kills: 0, weapons: 1, armor: ARMOR_FIGHTER, maxSpeed: MAX_SPEED, minSpeed: MIN_SPEED, radius: 0, turn: TURN_RATE,
            standoff: STANDOFF, bound: BOUND_R,
          })
        }
        reserveLeft[team] = Math.max(0, compRef.current[team].fighters - FIELD_FIGHTER_CAP)
      }
      spawnFleet('blue', -31, 1)    // blue charges from the left (+X)
      spawnFleet('red',   31, -1)   // red charges from the right (-X)

      // ── Missile cruisers — ranged support, deploy on-field with the fleet ──────
      const spawnCruisers = (team, sx, vdir) => {
        for (let i = 0; i < compRef.current[team].cruisers; i++) {
          const mat = new THREE.MeshStandardMaterial({
            color: TEAMS[team].color, emissive: TEAMS[team].color,
            emissiveIntensity: 0.5, metalness: 0.6, roughness: 0.4,
          })
          disposables.push(mat)
          const mesh = new THREE.Group()
          mesh.add(new THREE.Mesh(cruiserGeo[team], mat))
          const glow = new THREE.Mesh(blastGeo, glowMat[team])
          glow.scale.setScalar(0.42); glow.position.set(0, 0, -1.5); mesh.add(glow)
          const pos = new THREE.Vector3(sx + (Math.random() - 0.5) * 6, (Math.random() - 0.5) * 6, (Math.random() - 0.5) * 12)
          const vel = new THREE.Vector3(vdir * (2 + Math.random() * 2), (Math.random() - 0.5), (Math.random() - 0.5))
          mesh.position.copy(pos)
          orient(mesh, vel)
          mesh.scale.setScalar(CRUISER_SCALE)
          scene.add(mesh)
          ships.push({
            mesh, mat, team, hp: CRUISER_HP, alive: true, pos, vel,
            name: `${team === 'blue' ? 'Blue' : 'Red'} Cruiser ${i + 1}`,
            fireCd: 1 + Math.random() * 2, flash: 0,
            isCapital: false, isBomber: false, isCruiser: true, kills: 0, weapons: 1, armor: ARMOR_CRUISER,
            maxSpeed: CRUISER_SPEED, minSpeed: CRUISER_MIN, radius: 1.4, turn: TURN_RATE * 0.8,
            standoff: CRUISER_STANDOFF, bound: BOUND_R, baseScale: CRUISER_SCALE,
          })
        }
      }
      spawnCruisers('blue', -27, 1)
      spawnCruisers('red',   27, -1)

      // ── Capital ships — huge flagships that fly a fixed circular patrol ───────
      // The orbit (radius, height, direction) is rolled once at the start of the
      // battle; the two flagships ride it 180° apart, sweeping the rear of the
      // field on a smooth, predictable route instead of steering randomly.
      const orbitR = 38 + Math.random() * 5   // capital patrol scaled out with the arena
      const orbit = {
        R: orbitR,
        y: (Math.random() - 0.5) * 6,
        omega: (CAP_SPEED / orbitR) * (Math.random() < 0.5 ? 1 : -1),
      }
      const spawnCapital = (team, startAngle) => {
        const mat = new THREE.MeshStandardMaterial({
          color: TEAMS[team].color, emissive: TEAMS[team].color,
          emissiveIntensity: 0.55, metalness: 0.65, roughness: 0.35,
        })
        disposables.push(mat)
        const mesh = new THREE.Group()
        mesh.add(new THREE.Mesh(capGeo[team], mat))
        const glows = []
        for (const ex of [-0.45, 0.45]) {          // twin engine glows
          const glow = new THREE.Mesh(blastGeo, glowMat[team])
          glow.scale.setScalar(0.7)
          glow.position.set(ex, 0, -3.1)
          mesh.add(glow); glows.push(glow)
        }
        // damage-state hull fires — revealed progressively as the ship is worn down
        const fires = []
        for (let i = 0; i < 6; i++) {
          const fMat = new THREE.MeshBasicMaterial({ color: 0xff7a30, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false })
          const fm = new THREE.Mesh(blastGeo, fMat)
          fm.scale.setScalar(0.16)
          fm.position.set((Math.random() - 0.5) * 1.4, (Math.random() - 0.5) * 0.9, (Math.random() - 0.5) * 5)
          fm.visible = false
          mesh.add(fm)
          fires.push({ mesh: fm, mat: fMat })
          disposables.push(fMat)
        }
        // energy shield bubble — invisible until armour deflects a fighter bolt,
        // then it flashes. Sized (in local space, before the 3.2 hull scale) as an
        // ellipsoid hugging each hull silhouette.
        const shield = makeShield(TEAMS[team].bolt)
        const ss = team === 'blue'
          ? { x: 2.2, y: 2.0, z: 4.8, z0: 1.2 }
          : { x: 3.0, y: 2.4, z: 4.6, z0: 0.5 }
        shield.mesh.scale.set(ss.x, ss.y, ss.z)
        shield.mesh.position.set(0, 0, ss.z0)
        mesh.add(shield.mesh)
        disposables.push(shield.geo, shield.mat)
        mesh.scale.setScalar(3.2)                   // huge flagship
        const route = { R: orbit.R, y: orbit.y, omega: orbit.omega, angle: startAngle }
        const pos = new THREE.Vector3(Math.cos(startAngle) * route.R, route.y, Math.sin(startAngle) * route.R)
        const sgn = route.omega >= 0 ? 1 : -1
        const vel = new THREE.Vector3(-Math.sin(startAngle) * sgn, 0, Math.cos(startAngle) * sgn)
        mesh.position.copy(pos)
        orient(mesh, vel)
        scene.add(mesh)
        ships.push({
          mesh, mat, team, hp: CAP_HP, alive: true, pos, vel,
          name: team === 'blue' ? blueCapNameRef.current : redCapNameRef.current,
          labelEl:  team === 'blue' ? blueCapRef.current   : redCapRef.current,
          shieldEl: team === 'blue' ? blueShieldRef.current : redShieldRef.current,
          reserveEl: team === 'blue' ? blueReserveRef.current : redReserveRef.current,
          fireCd: 0.5 + Math.random(), flash: 0,
          isCapital: true, kills: 0, weapons: CAP_WEAPONS, armor: ARMOR_FLAGSHIP, radius: 16, route, glows, fires, emitCd: 0,
          shieldMesh: shield.mesh, shieldMat: shield.mat, shieldFlash: 0, flares: FLARES_FLAGSHIP,
        })
      }
      spawnCapital('blue', Math.PI)   // start on the left
      spawnCapital('red', 0)          // start opposite, on the right
      const redCapital  = ships.find(s => s.isCapital && s.team === 'red')
      const blueCapital = ships.find(s => s.isCapital && s.team === 'blue')

      // ── Bombers — heavy anti-capital craft that warp in as a wave ─────────────
      // They stage off their flank (hidden); blue jump in when the player calls
      // them, red at a random time. Then they run for the enemy flagship and
      // orbit it dropping high-damage bombs.
      const spawnBombers = (team) => {
        const sx = team === 'blue' ? -28 : 28
        const axis = new THREE.Vector3(team === 'blue' ? -1 : 1, 0.05, -0.3).normalize()
        for (let i = 0; i < compRef.current[team].bombers; i++) {
          const mat = new THREE.MeshStandardMaterial({
            color: TEAMS[team].color, emissive: TEAMS[team].color,
            emissiveIntensity: 0.4, metalness: 0.6, roughness: 0.4,
          })
          disposables.push(mat)
          const mesh = new THREE.Group()
          mesh.add(new THREE.Mesh(bomberGeo[team], mat))
          const glow = new THREE.Mesh(blastGeo, glowMat[team])
          glow.scale.setScalar(0.5); glow.position.set(0, 0, -1.4); mesh.add(glow)
          const home = new THREE.Vector3(sx + (Math.random() - 0.5) * 8, (Math.random() - 0.5) * 8, -16 + i * 8)
          const jumpFrom = home.clone().addScaledVector(axis, 95)
          mesh.position.copy(home)
          mesh.scale.setScalar(BOMBER_SCALE)
          mesh.visible = false
          scene.add(mesh)
          ships.push({
            mesh, mat, team, hp: BOMBER_HP, alive: false, pos: home.clone(), vel: new THREE.Vector3(),
            name: `${team === 'blue' ? 'Blue' : 'Red'} Bomber ${i + 1}`, bIndex: i,
            fireCd: 1 + Math.random() * 1.5, pdCd: 0.5 + Math.random() * 1.5, flash: 0,
            isCapital: false, isBomber: true, kills: 0, weapons: 1, armor: ARMOR_BOMBER,
            maxSpeed: BOMBER_SPEED, minSpeed: BOMBER_MIN, radius: 1.2, turn: TURN_RATE * 0.7,
            standoff: STANDOFF, bound: BOUND_R, baseScale: BOMBER_SCALE, flares: FLARES_BOMBER,
            home, jumpFrom, warpDur: 0.85, warping: false, entered: false, warpT: 0,
          })
        }
      }
      spawnBombers('blue')
      spawnBombers('red')
      // blue bombers wait for the player's "Call Bombers" order; red bombers arrive 5–15s in
      let blueBombersLaunched = false, redBombersLaunched = false
      const redBomberEntry = 5 + Math.random() * 10

      // ── Hyperspace jump-in: stage every ship far out along its flank, then
      // streak it into its formation slot before combat begins ──────────────────
      const STREAK_DUR = 0.85, CAP_LEAD = 0.6, FIGHTER_STAGGER = 0.5
      const INTRO_TOTAL = CAP_LEAD + FIGHTER_STAGGER + STREAK_DUR + 0.1
      const jumpAxis = {
        blue: new THREE.Vector3(-1, 0.05, -0.3).normalize(),
        red:  new THREE.Vector3( 1, 0.05, -0.3).normalize(),
      }
      for (const s of ships) {
        s.home = s.pos.clone()
        s.baseScale = s.isCapital ? 3.2 : s.isCruiser ? CRUISER_SCALE : 1
        // capitals jump in first; the fighters follow them in
        s.jumpDelay = s.isCapital ? Math.random() * 0.15 : CAP_LEAD + Math.random() * FIGHTER_STAGGER
        if (s.route) {
          // capitals warp in *along* their patrol tangent, so they arrive already
          // pointed the right way and slide straight onto the route — no post-warp turn
          const sgn = s.route.omega >= 0 ? 1 : -1
          _dir.set(-Math.sin(s.route.angle) * sgn, 0, Math.cos(s.route.angle) * sgn)
          s.jumpFrom = s.home.clone().addScaledVector(_dir, -95)
        } else {
          s.jumpFrom = s.home.clone().addScaledVector(jumpAxis[s.team], 95)
        }
        s.pos.copy(s.jumpFrom)
        s.mesh.position.copy(s.pos)
      }
      let introT = 0
      audioRef.current?.playJump()

      // ── Bolts, explosions, embers, capital wrecks ─────────────────────────────
      const bolts = []
      const blasts = []
      const embers = []
      const wrecks = []
      const DEATH_DUR = 1.8
      const _e = new THREE.Vector3()
      // a random world point within an oriented box around a capital's hull
      const hullPoint = (sh) => _e.set((Math.random() - 0.5) * 7, (Math.random() - 0.5) * 5, (Math.random() - 0.5) * 18)
        .applyQuaternion(sh.mesh.quaternion).add(sh.pos)
      const spawnEmber = (pos, color) => {
        const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false })
        const m = new THREE.Mesh(blastGeo, mat)
        m.position.copy(pos)
        m.scale.setScalar(0.3 + Math.random() * 0.4)
        scene.add(m)
        embers.push({ mesh: m, mat, vel: new THREE.Vector3((Math.random() - 0.5) * 2.5, (Math.random() - 0.5) * 2.5 + 0.4, (Math.random() - 0.5) * 2.5), life: 0, max: 0.6 + Math.random() * 0.5 })
      }

      // ── Flares: balls of flame a ship ejects to decoy missiles ────────────────
      const flameFX = []
      const spawnFlares = (sh) => {
        const big = sh.isCapital ? 2.4 : sh.isBomber ? 1.4 : 1
        for (let n = 0; n < 10; n++) {
          const mat = new THREE.MeshBasicMaterial({ color: n % 2 ? 0xffe070 : 0xff8a30, transparent: true, opacity: 1, blending: THREE.AdditiveBlending, depthWrite: false })
          const m = new THREE.Mesh(blastGeo, mat)
          const dir = new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize()
          m.position.copy(sh.pos).addScaledVector(dir, 1.6 * big)
          m.scale.setScalar((0.8 + Math.random() * 0.6) * big)
          scene.add(m)
          flameFX.push({ mesh: m, mat, vel: dir.multiplyScalar(15 + Math.random() * 11), life: 0, max: 0.9 + Math.random() * 0.6 })
        }
      }

      // ── Warp light-trails: glowing streaks left along a warping ship's path,
      // which linger briefly and fade in place after the ship has gone ──────────
      const trails = []
      const TRAIL_GAP = 6           // world units between segments (throttles count)
      const _td = new THREE.Vector3(), _tn = new THREE.Vector3()
      const spawnTrail = (from, to, team, width) => {
        _td.subVectors(to, from)
        const len = _td.length()
        if (len < 1e-3) return
        const mat = new THREE.MeshBasicMaterial({ color: TEAMS[team].bolt, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false })
        const m = new THREE.Mesh(trailGeo, mat)
        m.position.copy(from).addScaledVector(_td, 0.5)               // segment midpoint
        m.quaternion.setFromUnitVectors(yAxis, _tn.copy(_td).multiplyScalar(1 / len))
        m.scale.set(width, len, width)
        scene.add(m)
        trails.push({ mesh: m, mat, life: 0, max: 0.5 })
      }
      // emit a trail segment whenever a warping ship has moved far enough since the last
      const emitTrail = (s) => {
        if (!s.trailPrev) { s.trailPrev = s.pos.clone(); return }
        if (s.pos.distanceTo(s.trailPrev) >= TRAIL_GAP) {
          spawnTrail(s.trailPrev, s.pos, s.team, s.isCapital ? 0.6 : s.isBomber ? 0.3 : 0.2)
          s.trailPrev.copy(s.pos)
        }
      }

      // grey smoke puffs that trail behind a bomb and expand/fade
      const puffs = []
      const spawnSmoke = (pos) => {
        const mat = smokeMatProto.clone()
        const m = new THREE.Mesh(blastGeo, mat)
        m.position.copy(pos)
        m.scale.setScalar(0.22 + Math.random() * 0.16)
        scene.add(m)
        puffs.push({ mesh: m, mat, life: 0, max: 0.5 + Math.random() * 0.3 })
      }

      const fireBolt = (shooter, target, big = false, bomb = !!shooter.isBomber) => {
        const willHit = Math.random() > (bomb ? BOMB_MISS_CHANCE : MISS_CHANCE)   // lasers (incl. bomber PD) use fighter accuracy
        _tmp.set(0, 0, 1).applyQuaternion(shooter.mesh.quaternion)        // muzzle direction
        const start = shooter.pos.clone().addScaledVector(_tmp, big ? 2.6 : 1.0)
        if (big) start.add(new THREE.Vector3((Math.random() - 0.5) * 3, (Math.random() - 0.5) * 1.6, (Math.random() - 0.5) * 3))  // spread across hardpoints
        const aim = target.pos.clone()
        if (!willHit) aim.add(new THREE.Vector3((Math.random() - 0.5) * 9, (Math.random() - 0.5) * 9, (Math.random() - 0.5) * 9))
        const dir = aim.sub(start).normalize()
        const mesh = new THREE.Mesh(bomb ? bombGeo : boltGeo, bomb ? bombMat : boltMat[shooter.team])
        if (big) mesh.scale.set(2.3, 1.5, 2.3)
        mesh.position.copy(start)
        mesh.quaternion.setFromUnitVectors(yAxis, dir)
        scene.add(mesh)
        bolts.push({ mesh, dir, target, willHit, life: 0, shooter, dmg: bomb ? BOMB_DMG : 1, bomb, maxLife: bomb ? BOMB_LIFE : 2.2, smokeCd: 0 })
        audioRef.current?.playLaser(shooter.team)
      }

      // Cruiser ordnance: a guided missile that first drops from the launcher's
      // belly (facing forward, no thrust), then ignites and homes onto its target,
      // laying a smoke trail. Subject to armour like a normal hit (not a bomb).
      const fireMissile = (shooter, target) => {
        const willHit = Math.random() > MISSILE_MISS_CHANCE
        const fwd = new THREE.Vector3(0, 0, 1).applyQuaternion(shooter.mesh.quaternion).normalize()
        const down = new THREE.Vector3(0, -1, 0).applyQuaternion(shooter.mesh.quaternion).normalize()
        const start = shooter.pos.clone().addScaledVector(down, 0.5).addScaledVector(fwd, 0.3)
        const mesh = new THREE.Mesh(missileGeo, missileMat)
        mesh.position.copy(start)
        mesh.quaternion.setFromUnitVectors(yAxis, fwd)   // held facing forward through the drop
        scene.add(mesh)
        bolts.push({
          mesh, dir: fwd.clone(), target, willHit, life: 0, shooter,
          dmg: MISSILE_DMG, bomb: false, missile: true, homing: MISSILE_HOMING,
          speed: MISSILE_SPEED, maxLife: MISSILE_LIFE, smokeCd: 0,
          phase: 'drop', dropT: 0, dropDur: 0.32, dropDist: 1.7, dropDir: down, dropStart: start.clone(), fwd,
        })
      }

      const spawnBlast = (pos, big = false) => {
        const s = big ? 1.7 : 1.0
        const fmat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 1, blending: THREE.AdditiveBlending, depthWrite: false })
        const fire = new THREE.Mesh(blastGeo, fmat)
        fire.position.copy(pos); fire.scale.setScalar(0.3 * s)
        scene.add(fire)
        const rmat = new THREE.MeshBasicMaterial({ color: 0xffd9a0, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })
        const ring = new THREE.Mesh(ringGeo, rmat)
        ring.position.copy(pos); ring.scale.setScalar(0.5 * s)
        scene.add(ring)
        blasts.push({ fire, fmat, ring, rmat, life: 0, max: 0.6, s })
        audioRef.current?.playExplosion(big)
      }

      const addKill = (killer, victim) => {
        killer.kills = (killer.kills || 0) + 1
        setKills(prev => [...prev, {
          id: killSeq.current++,
          kName: killer.name, kTeam: killer.team,
          vName: victim.name, vTeam: victim.team,
        }].slice(-7))
      }

      // open the picture-in-picture event camera: track getTarget() from an offset
      const showPip = (team, text, getTarget, camDir, dist, height, max = 4) => {
        pipRef.current = { life: 0, max, getTarget, camDir: camDir.clone().normalize(), dist, height }
        setPipCaption({ team, text })
      }

      const SHIELD_FLASH_TIME = 0.45   // seconds the flagship shield stays lit after catching a bolt
      const damage = (ship, killer, amount = 1, bomb = false) => {
        if (!bomb && !killer?.isCapital && Math.random() * 100 < ship.armor) {
          // armour deflects fighter bolts only — capital fire & bombs ignore it.
          if (ship.isCapital) ship.shieldFlash = SHIELD_FLASH_TIME   // shield catches the deflected bolt → flash
          return
        }
        ship.hp -= amount
        ship.flash = 0.12
        // capital crosses 25% shield → critical-damage broadcast (once per ship)
        if (ship.isCapital && ship.alive && !ship.commsCritical && ship.hp <= CAP_HP * 0.25 && ship.hp > 0) {
          ship.commsCritical = true
          showComms(ship.team, 'Critical damage sustained!')
        }
        if (ship.hp <= 0 && ship.alive) {
          ship.alive = false
          ship.lost = true              // destroyed — drops the team's fleet strength
          if (killer) addKill(killer, ship)
          // grey out the destroyed bomber in the blue bomber roster
          if (ship.isBomber && ship.team === 'blue') setBlueBomberAlive(prev => prev.map((a, i) => i === ship.bIndex ? false : a))
          if (ship.isCapital) {
            if (ship.shieldMesh) ship.shieldMesh.visible = false   // shield collapses with the hull
            // begin the drawn-out death; the hull stays as drifting wreckage
            ship.driftVel = _tmp.set(0, 0, 1).applyQuaternion(ship.mesh.quaternion).multiplyScalar(0.9).clone()
            wrecks.push({ ship, t: 0, blastCd: 0, final: false })
            // highlight the kill in the PiP camera (skip once the match is already resolved)
            if (!gameOver) showPip(ship.team, `${ship.team === 'blue' ? 'BLUE' : 'RED'} CAPITAL SHIP DESTROYED`,
              () => ship.pos, new THREE.Vector3(0.7, 0.32, 0.62), 24, 7, 4.2)
          } else {
            spawnBlast(ship.pos, false)
            scene.remove(ship.mesh)
          }
        }
      }

      let gameOver = false
      let retreatTeam = null, retreatTime = 0, retreatWarped = false   // bombers-only "break and retreat" sequence
      let reinforceAt = REINFORCE_INTERVAL                              // next reserve-reinforcement check (sim seconds)
      const counts = () => ({
        blue: ships.filter(s => s.team === 'blue' && s.alive).length,
        red:  ships.filter(s => s.team === 'red'  && s.alive).length,
      })

      // ── Third-person camera: click a ship to follow it ────────────────────────
      const TAC_POS = new THREE.Vector3(0, 25, 60)   // the default tactical view
      const _camGoal = new THREE.Vector3(), _fwd = new THREE.Vector3(), _lookAt = new THREE.Vector3()
      const raycaster = new THREE.Raycaster()
      const pointer = new THREE.Vector2()
      // restore the orbiting tactical view and drop any followed ship
      const revertToTactical = () => {
        followRef.current = null
        setFollowName(null)
        setFollowTeam(null)
        camera.position.copy(TAC_POS)
        controls.target.set(0, 0, 0)
        controls.enabled = true
        controls.update()
      }
      exitFollowRef.current = revertToTactical
      // follow a specific blue bomber by its roster index (driven by the dispatch sprites);
      // only acts while that bomber is actually on the field and not destroyed
      followBomberRef.current = (idx) => {
        const b = ships.find(s => s.isBomber && s.team === 'blue' && s.bIndex === idx)
        if (!b || !b.alive || !b.entered || b.warpOut) return false
        followRef.current = b
        setFollowName(b.name); setFollowTeam(b.team)
        controls.enabled = false
        return true
      }
      // a near-stationary press (not an orbit drag) selects the ship under the cursor
      let downX = 0, downY = 0, downT = 0
      const onDown = (e) => { downX = e.clientX; downY = e.clientY; downT = performance.now() }
      const onUp = (e) => {
        if (Math.hypot(e.clientX - downX, e.clientY - downY) > 6 || performance.now() - downT > 500) return
        const rect = renderer.domElement.getBoundingClientRect()
        pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1
        pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1
        raycaster.setFromCamera(pointer, camera)
        const live = ships.filter(s => s.alive)
        const hits = raycaster.intersectObjects(live.map(s => s.mesh), true)
        if (!hits.length) return
        const m2s = new Map(live.map(s => [s.mesh, s]))
        let o = hits[0].object
        while (o && !m2s.has(o)) o = o.parent
        const ship = o && m2s.get(o)
        if (ship && ship.alive) { followRef.current = ship; setFollowName(ship.name); setFollowTeam(ship.team); controls.enabled = false }
      }
      renderer.domElement.addEventListener('pointerdown', onDown)
      renderer.domElement.addEventListener('pointerup', onUp)

      // dashed red lines from a followed ship to each foe it's engaging (a ship
      // with several weapons can attack several targets — up to the capital's gun count)
      const targetLineMat = new THREE.LineDashedMaterial({ color: 0xff3322, dashSize: 1.4, gapSize: 0.9, transparent: true, opacity: 0.85, depthWrite: false })
      disposables.push(targetLineMat)
      const targetLines = Array.from({ length: CAP_WEAPONS }, () => {
        const geo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()])
        const line = new THREE.Line(geo, targetLineMat)
        line.frustumCulled = false; line.visible = false; scene.add(line)
        disposables.push(geo)
        return { line, geo }
      })
      const hideTargetLines = () => targetLines.forEach(t => (t.line.visible = false))

      // ── Frame loop ───────────────────────────────────────────────────────────
      const clock = new THREE.Clock()
      let simT = 0, battleSimT = 0
      const fmtTime = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`
      const frame = () => {
        const realDt = Math.min(clock.getDelta(), 0.05)   // true wall-clock step (camera follow works while paused)
        const dt = realDt * simSpeedRef.current            // scaled sim step — 0 when paused
        simT += dt
        const t  = simT
        // realtime battle clock — ticks while the fight is live and not paused
        if (!gameOver) battleSimT += dt   // sim-time elapsed (dt is 0 when paused), so the clock matches time-based events
        if (timerRef.current) timerRef.current.textContent = fmtTime(battleSimT)
        introT += dt
        const intro = introT < INTRO_TOTAL

        // warp in a bomber wave: set them live + animating, with one jump cue
        const launchBombers = (team) => {
          const wave = []
          for (const b of ships) if (b.isBomber && b.team === team) { b.warping = true; b.alive = true; b.mesh.visible = true; b.warpT = 0; wave.push(b) }
          if (!wave.length) return   // this fleet has no bombers in its composition — nothing to warp in
          audioRef.current?.playJump()
          // highlight the warp-in in the PiP camera (tracks the wave's centroid)
          const c = new THREE.Vector3(), snap = new THREE.Vector3()
          const getCentroid = () => {
            let n = 0; c.set(0, 0, 0)
            for (const b of wave) if (b.alive) { c.add(b.pos); n++ }
            if (!n) return snap
            return snap.copy(c.multiplyScalar(1 / n))
          }
          showPip(team, `${team === 'blue' ? 'BLUE' : 'RED'} FLEET BOMBERS WARPING IN`,
            getCentroid, new THREE.Vector3(0.4, 0.26, 0.9), 26, 9, 3.6)
        }
        // blue bombers wait for the player's order; red bombers arrive at a random time
        if (!gameOver) {
          // the blue wing auto-launches at the deadline if the player hasn't intervened;
          // tick the on-screen countdown until then (sim-time based, so it pauses with the game)
          const hasBlueBombers = compRef.current.blue.bombers > 0
          if (hasBlueBombers && !blueBombersLaunched && !callBombersRef.current) {
            const left = Math.max(0, Math.ceil(BOMBER_AUTO_DISPATCH - battleSimT))
            if (bomberCountdownRef.current) bomberCountdownRef.current.textContent = `Bombers auto dispatched in ${left} second${left === 1 ? '' : 's'}`
            if (battleSimT >= BOMBER_AUTO_DISPATCH) { callBombersRef.current = true; setBombersCalled(true) }
          }
          if (!blueBombersLaunched && callBombersRef.current) { blueBombersLaunched = true; launchBombers('blue') }
          if (!redBombersLaunched && t >= redBomberEntry)     { redBombersLaunched = true; launchBombers('red') }
        }

        // ── Ships: steer (seek nearest enemy + separation + bounds), then fire ──
        for (const s of ships) {
          if (!s.alive) continue

          // retreat: streak away in a hyperspace jump, then vanish from the field
          if (s.warpOut) {
            s.warpT += dt
            const p = Math.min(1, s.warpT / s.warpDur)
            const e = Math.pow(p, 3)                               // ease-in — accelerate away
            s.pos.lerpVectors(s.warpFrom, s.warpTo, e)
            s.mesh.position.copy(s.pos)
            orient(s.mesh, _dir.subVectors(s.warpTo, s.warpFrom))
            s.mesh.scale.set(s.baseScale, s.baseScale, s.baseScale * (1 + e * 14))
            emitTrail(s)
            if (p >= 1) { s.alive = false; s.lost = true; s.mesh.visible = false }   // warped out — drops fleet strength
            continue
          }
          // hyperspace jump-in: streak from the staging point into formation
          if (intro) {
            const p = Math.min(1, Math.max(0, (introT - s.jumpDelay) / STREAK_DUR))
            const e = 1 - Math.pow(1 - p, 3)                       // ease-out into place
            s.pos.lerpVectors(s.jumpFrom, s.home, e)
            s.mesh.position.copy(s.pos)
            orient(s.mesh, _dir.subVectors(s.home, s.jumpFrom))    // face travel direction
            const stretch = 1 + Math.pow(1 - p, 3) * (s.isCapital ? 4 : 14)
            s.mesh.scale.set(s.baseScale, s.baseScale, s.baseScale * stretch)
            if (p > 0) emitTrail(s)
            continue
          }
          // bombers and reinforcement fighters streak in on their own delayed warp
          if (s.warping && !s.entered) {
            s.warpT += dt
            const p = Math.min(1, s.warpT / s.warpDur)
            const e = 1 - Math.pow(1 - p, 3)
            s.pos.lerpVectors(s.jumpFrom, s.home, e)
            s.mesh.position.copy(s.pos)
            orient(s.mesh, _dir.subVectors(s.home, s.jumpFrom))
            const stretch = 1 + Math.pow(1 - p, 3) * 12
            s.mesh.scale.set(s.baseScale, s.baseScale, s.baseScale * stretch)
            emitTrail(s)
            if (p >= 1) { s.entered = true; s.mesh.scale.set(s.baseScale, s.baseScale, s.baseScale); s.trailPrev = null }
            continue
          }
          if (s.mesh.scale.z !== s.baseScale) s.mesh.scale.set(s.baseScale, s.baseScale, s.baseScale)
          s.trailPrev = null   // not warping → reset so the next warp starts a fresh trail

          // find nearest living enemy (plus nearest enemy fighter / bomber)
          let nearest = null, nd = Infinity, nearestFighter = null, nfd = Infinity, nearestBomber = null, nbd = Infinity
          for (const e of ships) {
            if (!e.alive || e.team === s.team) continue
            const d = s.pos.distanceToSquared(e.pos)
            if (d < nd) { nd = d; nearest = e }
            if (e.isBomber) { if (d < nbd) { nbd = d; nearestBomber = e } }
            else if (!e.isCapital && d < nfd) { nfd = d; nearestFighter = e }
          }
          // pick a firing target. Blue fighters follow the player's FIGHTER CONTROL
          // mode; red fighters always use the AI 'default' behaviour
          let target = nearest
          if (!s.isCapital && !s.isBomber && !s.isCruiser) {
            const enemyCap = (redCapital && redCapital.alive) ? redCapital : null
            const ctl = s.team === 'blue' ? fighterControlRef.current : 'default'
            if (ctl === 'capital')      target = enemyCap || nearest                                    // focus the flagship
            else if (ctl === 'pursue')  target = nearestBomber || nearest                               // hunt bombers, else engage
            else if (ctl === 'screen')  target = nearestBomber || nearestFighter || enemyCap || nearest  // bombers → fighters → capital
            else                        target = (nearestBomber && nbd < 22 * 22) ? nearestBomber : nearest  // 'default': nearest, nearby bomber priority
          }
          // record what this ship intends to attack (drives the third-person target readout)
          if (s.isBomber) { const ec = s.team === 'blue' ? redCapital : blueCapital; s.attackTarget = (ec && ec.alive) ? ec : target }
          else s.attackTarget = target

          if (s.route) {
            // capitals cruise toward their patrol-slot on the circle (smooth,
            // predictable). The blue flagship can be ordered to leave the patrol
            // and push to the centre, then later make its way back to the route.
            const rt = s.route
            rt.angle += rt.omega * dt
            let tx = Math.cos(rt.angle) * rt.R, ty = rt.y, tz = Math.sin(rt.angle) * rt.R
            if (s.team === 'blue' && capTacticRef.current === 'engage') { tx = 0; ty = 0; tz = 0 }
            const dx = tx - s.pos.x, dy = ty - s.pos.y, dz = tz - s.pos.z
            const dist = Math.hypot(dx, dy, dz)
            const step = CAP_SPEED * dt
            if (dist > 1e-4) {
              const f = Math.min(step, dist) / dist
              s.pos.x += dx * f; s.pos.y += dy * f; s.pos.z += dz * f
              orient(s.mesh, _dir.set(dx, dy, dz), 1 - Math.exp(-1.5 * dt))
            }
            s.mesh.position.copy(s.pos)
          } else if (s.isCruiser) {
            // ponderous turning-circle movement: cruise forward at constant speed and
            // steer the heading slowly toward an orbit of the nearest enemy — it banks
            // around in an arc rather than pivoting on the spot, and turns infrequently
            _dir.copy(s.vel); if (_dir.lengthSq() < 1e-6) _dir.set(s.team === 'blue' ? 1 : -1, 0, 0)
            _dir.normalize()                                   // current heading
            if (nearest) {
              _tmp.subVectors(nearest.pos, s.pos); const dist = _tmp.length() || 1; _tmp.divideScalar(dist)
              _tan.crossVectors(UP, _tmp).normalize()          // tangential (orbit)
              const radial = THREE.MathUtils.clamp((dist - s.standoff) / s.standoff, -1, 1)
              _acc.copy(_tan).addScaledVector(_tmp, radial * 0.9)   // mostly orbit + gentle range-keeping
            } else {
              _acc.copy(_dir)
            }
            const rr = s.pos.length()
            if (rr > s.bound) _acc.addScaledVector(_tmp.copy(s.pos).normalize(), -1.4)   // bank back into the arena
            if (_acc.lengthSq() < 1e-6) _acc.copy(_dir)
            _acc.normalize()                                   // desired heading
            // occasional slow wander so its course isn't perfectly rigid (turns infrequently)
            s.wanderCd = (s.wanderCd ?? 0) - dt
            if (s.wanderCd <= 0) { s.wanderRate = (Math.random() - 0.5) * 0.5; s.wanderCd = 2.5 + Math.random() * 2.5 }
            if (s.wanderRate) _acc.applyAxisAngle(UP, s.wanderRate * dt)
            // rotate heading toward desired at a capped rate → fixed turning circle
            const ang = _dir.angleTo(_acc), step = CRUISER_TURN_RATE * dt
            if (ang > 1e-4) {
              if (ang <= step) _dir.copy(_acc)
              else { _tmp.crossVectors(_dir, _acc); if (_tmp.lengthSq() < 1e-6) _tmp.copy(UP); _tmp.normalize(); _dir.applyAxisAngle(_tmp, step).normalize() }
            }
            s.vel.copy(_dir).multiplyScalar(s.maxSpeed)
            s.pos.addScaledVector(s.vel, dt)
            s.mesh.position.copy(s.pos)
            orient(s.mesh, _dir, 1 - Math.exp(-6 * dt))
          } else {
            _acc.set(0, 0, 0)
            const enemyCap = s.team === 'blue' ? redCapital : blueCapital
            // blue fighters set to "screen carrier" hold station around the flagship
            const screening = s.team === 'blue' && !s.isBomber && !s.isCruiser && fighterControlRef.current === 'screen' && blueCapital && blueCapital.alive
            if (s.isBomber && enemyCap && enemyCap.alive) {
              // run to the enemy flagship and orbit it, dropping bombs
              _tmp.subVectors(s.pos, enemyCap.pos)            // outward radial
              const dist = _tmp.length() || 1
              _tmp.divideScalar(dist)
              _acc.addScaledVector(_tmp, THREE.MathUtils.clamp((enemyCap.radius + 6 - dist) * 0.7, -6, 6))  // hold a tight bombing orbit
              _tan.crossVectors(UP, _tmp).normalize()
              _acc.addScaledVector(_tan, 5)                   // circle the target
            } else if (screening) {
              // hold a protective ring around the friendly capital (it still fires on enemies)
              _tmp.subVectors(blueCapital.pos, s.pos)
              const dist = _tmp.length() || 1
              _tmp.divideScalar(dist)
              const drive = THREE.MathUtils.clamp((dist - (blueCapital.radius + 10)) * 0.9, -6, 9)
              _acc.addScaledVector(_tmp, drive)
            } else if (target) {
              // approach the enemy only down to STANDOFF, then ease off / back away —
              // this holds a gap between the two fleets rather than one merged blob
              _tmp.subVectors(target.pos, s.pos)
              const dist = _tmp.length() || 1
              _tmp.divideScalar(dist)
              const drive = THREE.MathUtils.clamp((dist - s.standoff) * 0.8, -5, 9)
              _acc.addScaledVector(_tmp, drive)
            }
            // separation from all nearby ships (keeps the melee from collapsing;
            // larger ships claim more space via their radius)
            for (const o of ships) {
              if (o === s || !o.alive) continue
              const d = s.pos.distanceTo(o.pos)
              const sepR = SEP_RADIUS + s.radius + o.radius
              if (d > 0 && d < sepR) {
                // small ships are pushed away from capitals far more firmly so they
                // don't clip into the hull; capitals aren't shoved by their escorts
                const w = (o.isCapital && !s.isCapital) ? 65 : 16
                _tmp.subVectors(s.pos, o.pos).multiplyScalar((sepR - d) / (d * sepR))
                _acc.addScaledVector(_tmp, w)
              }
            }
            // wander + keep inside the arena (bombers stay purposeful, less jitter)
            const wj = s.isBomber ? 1.5 : 5
            _acc.x += (Math.random() - 0.5) * wj
            _acc.y += (Math.random() - 0.5) * (s.isBomber ? 1.2 : 4)
            _acc.z += (Math.random() - 0.5) * wj
            const r = s.pos.length()
            if (r > s.bound) _acc.addScaledVector(_tmp.copy(s.pos).normalize(), -(r - s.bound) * 2.2)

            s.vel.addScaledVector(_acc, dt)
            let sp = s.vel.length()
            if (sp > s.maxSpeed) s.vel.multiplyScalar(s.maxSpeed / sp)
            else if (sp < s.minSpeed && sp > 0) s.vel.multiplyScalar(s.minSpeed / sp)
            s.pos.addScaledVector(s.vel, dt)
            s.mesh.position.copy(s.pos)
            orient(s.mesh, _dir.copy(s.vel), 1 - Math.exp(-s.turn * dt))
          }

          if (s.flash > 0) {
            s.flash -= dt
            s.mat.emissiveIntensity = s.flash > 0 ? 1.7 : (s.isCapital ? 0.55 : 0.5)
          }
          // capital damage states: reveal hull fires and spit embers as HP falls
          if (s.isCapital) {
            // energy shield: invisible at rest, fades out after catching a bolt
            if (s.shieldMat) {
              if (s.shieldFlash > 0) s.shieldFlash = Math.max(0, s.shieldFlash - dt)
              s.shieldMat.uniforms.uIntensity.value = s.shieldFlash > 0 ? Math.pow(s.shieldFlash / SHIELD_FLASH_TIME, 0.7) : 0
            }
            const dmg = 1 - s.hp / CAP_HP
            const nf = Math.floor(dmg * s.fires.length)
            for (let i = 0; i < s.fires.length; i++) {
              const f = s.fires[i]
              f.mesh.visible = i < nf
              if (i < nf) f.mat.opacity = 0.4 + 0.5 * Math.abs(Math.sin(t * 7 + i * 1.7))
            }
            if (dmg > 0.15) {
              s.emitCd -= dt
              if (s.emitCd <= 0) {
                spawnEmber(hullPoint(s), dmg > 0.6 ? 0xff5424 : 0xffa848)
                s.emitCd = 0.3 - dmg * 0.22
              }
            }
          }
          if (!gameOver && s.team !== retreatTeam) {
            // bomber point-defence laser: a purely defensive laser (no chasing) that fires
            // at the nearest enemy fighter only while one strays within range
            if (s.isBomber) {
              s.pdCd -= dt
              if (s.pdCd <= 0) {
                const pdSq = PD_RANGE * PD_RANGE
                // point-defence: prefer a nearby enemy fighter, else fall back to a nearby enemy bomber
                const pdTarget = (nearestFighter && nfd < pdSq) ? nearestFighter
                  : (nearestBomber && nbd < pdSq) ? nearestBomber : null
                if (pdTarget) { fireBolt(s, pdTarget, false, false); s.pdCd = 1.2 + Math.random() * 2.8 }   // laser, not a bomb
              }
            }
            s.fireCd -= dt
            if (s.fireCd <= 0) {
              if (s.isBomber) {
                // bombers ONLY bomb capital ships — bomb the enemy flagship in close range
                const enemyCap = s.team === 'blue' ? redCapital : blueCapital
                if (enemyCap && enemyCap.alive && s.pos.distanceTo(enemyCap.pos) < BOMB_RANGE) {
                  fireBolt(s, enemyCap); s.fireCd = 1.6 + Math.random() * 1.4
                }
              } else if (s.weapons > 1) {
                // capital: rapid multi-bolt broadside spread across the enemy fleet
                const enemies = ships.filter(e => e.alive && e.team !== s.team)
                if (enemies.length) {
                  const vt = []
                  for (let k = 0; k < s.weapons; k++) { const e = enemies[(Math.random() * enemies.length) | 0]; vt.push(e); fireBolt(s, e, true) }
                  s.volleyTargets = vt   // actual foes this broadside fired at (for the third-person readout)
                }
                s.fireCd = 0.7 + Math.random() * 0.9
              } else if (s.isCruiser) {
                // cruiser: launch a salvo of homing missiles, spread across the nearest enemies in range
                if (nearest && s.pos.distanceToSquared(nearest.pos) < MISSILE_RANGE * MISSILE_RANGE) {
                  const rngSq = MISSILE_RANGE * MISSILE_RANGE
                  const inRange = ships.filter(e => e.alive && e.team !== s.team && s.pos.distanceToSquared(e.pos) < rngSq)
                    .sort((a, b) => s.pos.distanceToSquared(a.pos) - s.pos.distanceToSquared(b.pos))
                  for (let k = 0; k < MISSILE_SALVO; k++) fireMissile(s, inRange[Math.min(k, inRange.length - 1)])
                  s.fireCd = MISSILE_CD_MIN + Math.random() * MISSILE_CD_RND
                }
              } else if (target && s.pos.distanceToSquared(target.pos) < FIGHTER_RANGE * FIGHTER_RANGE) {
                fireBolt(s, target)   // fighters hold fire until the target is within range
                s.fireCd = 1.2 + Math.random() * 2.8
              }
            }
          }
        }

        // ── Bolts: home gently toward target (hits), or streak straight (misses)
        for (let i = bolts.length - 1; i >= 0; i--) {
          const b = bolts[i]
          b.life += dt
          // missile launch: drop clear of the launcher facing forward, then ignite
          if (b.missile && b.phase === 'drop') {
            b.dropT += dt
            const p = Math.min(1, b.dropT / b.dropDur)
            const e = 1 - Math.pow(1 - p, 2)                 // ease-out — pops out then settles
            b.mesh.position.copy(b.dropStart).addScaledVector(b.dropDir, b.dropDist * e)
            if (p >= 1) {                                    // ignite → keep forward heading, then steer + accelerate
              b.dir.copy(b.fwd)                              // leave along the launcher's facing (no snap-to-target)
              b.mesh.quaternion.setFromUnitVectors(yAxis, b.dir)
              b.phase = 'fly'; b.life = 0                    // maxLife governs flight only
              b.curSpeed = MISSILE_LAUNCH_SPEED              // builds up to MISSILE_SPEED via MISSILE_ACCEL
              audioRef.current?.playLaser(b.shooter.team)
            }
            continue
          }
          let done = false
          if (b.missile && b.decoyed) {
            // decoyed by a flare: lock lost — sail straight past and detonate harmlessly
            b.fuse -= dt
            if (b.fuse <= 0) { spawnBlast(b.mesh.position, false); done = true }
          } else if (b.willHit && b.target.alive) {
            _tmp.subVectors(b.target.pos, b.mesh.position)
            const d = _tmp.length()
            if (b.missile && b.target.flares > 0 && d < 12) {
              // the ship pops a flare — missile is thrown off (no damage), flies past
              b.target.flares--
              b.decoyed = true
              b.fuse = 0.45 + Math.random() * 0.45
              spawnFlares(b.target)
            } else if (d < 1.3) {
              damage(b.target, b.shooter, b.dmg, b.bomb)
              done = true
            } else {
              _tmp.normalize()
              if (b.missile) {
                // steer toward the target at a capped turn rate → real turning radius
                const ang = b.dir.angleTo(_tmp)
                const step = MISSILE_TURN * dt
                if (ang <= step || ang < 1e-4) b.dir.copy(_tmp)
                else { _tan.crossVectors(b.dir, _tmp).normalize(); if (_tan.lengthSq() > 1e-6) b.dir.applyAxisAngle(_tan, step).normalize() }
              } else {
                b.dir.lerp(_tmp, b.homing ?? 0.12).normalize()
              }
              b.mesh.quaternion.setFromUnitVectors(yAxis, b.dir)
            }
          }
          if (!done) {
            let spd = b.speed ?? BOLT_SPEED
            if (b.missile) { b.curSpeed = Math.min(b.speed, (b.curSpeed ?? MISSILE_LAUNCH_SPEED) + MISSILE_ACCEL * dt); spd = b.curSpeed }
            b.mesh.position.addScaledVector(b.dir, spd * dt)
            if (b.life > b.maxLife) done = true
          }
          if (b.bomb || b.missile) {   // lay a smoke trail behind bombs & missiles
            b.smokeCd -= dt
            if (b.smokeCd <= 0) { spawnSmoke(b.mesh.position); b.smokeCd = 0.03 }
          }
          if (done) { scene.remove(b.mesh); bolts.splice(i, 1) }
        }

        // ── Explosions: fireball (white→orange→red) + expanding shockwave ring ──
        for (let i = blasts.length - 1; i >= 0; i--) {
          const x = blasts[i]
          x.life += dt
          const k = x.life / x.max
          // fireball
          x.fire.scale.setScalar((0.3 + k * 3.4) * x.s)
          x.fmat.color.setRGB(1.0, 0.85 - k * 0.55, 0.5 - k * 0.45)
          x.fmat.opacity = Math.max(0, 1 - k)
          // shockwave ring — expands faster, fades sooner, billboarded to camera
          const rk = Math.min(1, k * 1.4)
          x.ring.scale.setScalar((0.5 + rk * 6.0) * x.s)
          x.ring.lookAt(camera.position)
          x.rmat.opacity = Math.max(0, 0.85 * (1 - rk))
          if (x.life >= x.max) {
            scene.remove(x.fire); scene.remove(x.ring)
            x.fmat.dispose(); x.rmat.dispose()
            blasts.splice(i, 1)
          }
        }

        // ── Dying / wrecked capitals ────────────────────────────────────────────
        for (const wk of wrecks) {
          const sh = wk.ship
          wk.t += dt
          sh.pos.addScaledVector(sh.driftVel, dt)
          sh.mesh.position.copy(sh.pos)
          sh.mesh.rotateZ(0.06 * dt); sh.mesh.rotateX(0.025 * dt)   // slow tumble
          if (wk.t < DEATH_DUR) {
            // secondary explosions ripple along the hull, hull flickers violently
            wk.blastCd -= dt
            if (wk.blastCd <= 0) { spawnBlast(hullPoint(sh), false); wk.blastCd = 0.1 + Math.random() * 0.2 }
            sh.mat.emissiveIntensity = 0.6 + Math.random() * 1.2
            for (const f of sh.fires) if (f.mesh.visible) f.mat.opacity = 0.5 + 0.5 * Math.random()
          } else if (!wk.final) {
            // final blast, then settle into a darkened drifting hulk
            wk.final = true
            spawnBlast(sh.pos, true)
            sh.mat.color.setHex(0x2b2e34); sh.mat.emissive.setHex(0x160b06)
            sh.mat.emissiveIntensity = 0.25; sh.mat.metalness = 0.3; sh.mat.roughness = 0.95
            sh.glows.forEach(g => (g.visible = false))
            sh.fires.forEach((f, i) => { f.mesh.visible = i < 2 })
          } else {
            // persistent wreckage: a couple of smouldering fires + the odd ember
            for (const f of sh.fires) if (f.mesh.visible) f.mat.opacity = 0.2 + 0.2 * Math.abs(Math.sin(t * 4 + sh.pos.x))
            if (Math.random() < 0.04) spawnEmber(hullPoint(sh), 0xff6a30)
          }
        }

        // ── Embers: damage sparks / wreck smoulder ──────────────────────────────
        for (let i = embers.length - 1; i >= 0; i--) {
          const em = embers[i]
          em.life += dt
          em.mesh.position.addScaledVector(em.vel, dt)
          em.mesh.scale.multiplyScalar(0.986)
          em.mat.opacity = Math.max(0, 0.9 * (1 - em.life / em.max))
          if (em.life >= em.max) { scene.remove(em.mesh); em.mat.dispose(); embers.splice(i, 1) }
        }

        // ── Flares: ejected balls of flame burst outward, drift, and cool ───────
        for (let i = flameFX.length - 1; i >= 0; i--) {
          const f = flameFX[i]
          f.life += dt
          f.mesh.position.addScaledVector(f.vel, dt); f.vel.multiplyScalar(0.985); f.mesh.scale.multiplyScalar(0.99)
          const k = f.life / f.max
          f.mat.color.setRGB(1, 0.7 - k * 0.45, 0.25 - k * 0.2)
          f.mat.opacity = Math.max(0, 1 - k)
          if (f.life >= f.max) { scene.remove(f.mesh); f.mat.dispose(); flameFX.splice(i, 1) }
        }

        // ── Warp light-trails: fade in place, then clear ────────────────────────
        for (let i = trails.length - 1; i >= 0; i--) {
          const tr = trails[i]
          tr.life += dt
          tr.mat.opacity = Math.max(0, 0.55 * (1 - tr.life / tr.max))
          if (tr.life >= tr.max) { scene.remove(tr.mesh); tr.mat.dispose(); trails.splice(i, 1) }
        }

        // ── Bomb smoke trail: expand + fade ─────────────────────────────────────
        for (let i = puffs.length - 1; i >= 0; i--) {
          const p = puffs[i]
          p.life += dt
          p.mesh.scale.multiplyScalar(1 + dt * 1.6)
          p.mat.opacity = Math.max(0, 0.5 * (1 - p.life / p.max))
          if (p.life >= p.max) { scene.remove(p.mesh); p.mat.dispose(); puffs.splice(i, 1) }
        }

        // ── Capital ship labels (name + shield %), projected above each hull ────
        // The PiP renders an opaque 3D feed over its rectangle; a label can't be drawn
        // on top of that scissored region, so hide any label that sits behind the panel.
        const pipBox = pipRef.current
          ? { l: cw - PIP_RIGHT - PIP_W, r: cw - PIP_RIGHT, t: (ch - PIP_H) / 2, b: (ch - PIP_H) / 2 + PIP_H }
          : null
        for (const s of ships) {
          if (!s.labelEl) continue
          if (!s.alive || intro) { s.labelEl.style.opacity = '0'; continue }
          _proj.copy(s.pos); _proj.y += 7
          _proj.project(camera)
          if (_proj.z > 1) { s.labelEl.style.opacity = '0'; continue }
          const lx = (_proj.x * 0.5 + 0.5) * cw
          const ly = (-_proj.y * 0.5 + 0.5) * ch
          // label is anchored bottom-centre at (lx, ly); suppress if its box overlaps the PiP
          if (pipBox && lx + 140 > pipBox.l && lx - 140 < pipBox.r && ly > pipBox.t && ly - 56 < pipBox.b) {
            s.labelEl.style.opacity = '0'; continue
          }
          s.labelEl.style.opacity = '1'
          s.labelEl.style.transform = `translate(-50%, -100%) translate(${lx}px, ${ly}px)`
          if (s.shieldEl) s.shieldEl.textContent = Math.max(0, Math.round(s.hp / CAP_HP * 100))
          if (s.reserveEl) {
            const r = reserveLeft[s.team]
            if (r > 0) { s.reserveEl.style.display = ''; s.reserveEl.textContent = `RESERVE FIGHTERS: ${r}` }
            else s.reserveEl.style.display = 'none'
          }
        }

        // ── Scoreboard + victory check ─────────────────────────────────────────
        const c = counts()
        if (blueCountRef.current) blueCountRef.current.textContent = c.blue
        if (redCountRef.current)  redCountRef.current.textContent  = c.red
        // Fleet strength /1000: every ship that isn't destroyed or warped out still
        // counts (reserves and unarrived bombers included), so it only falls on real losses.
        // The flagship's contribution scales with its remaining hull — full PTS_FLAGSHIP
        // at 100% HP, falling linearly as it's whittled down — so battle damage to the
        // capital erodes fleet power before it's destroyed. A living flagship never drops
        // below PTS_FLAGSHIP_MIN, though (its guns and morale keep it worth something).
        const strength = { blue: 0, red: 0 }
        for (const s of ships) if (!s.lost) strength[s.team] += s.isCapital ? Math.max(PTS_FLAGSHIP_MIN, PTS_FLAGSHIP * Math.max(0, s.hp) / CAP_HP) : s.isBomber ? PTS_BOMBER : s.isCruiser ? PTS_CRUISER : PTS_FIGHTER
        if (blueStrengthRef.current) blueStrengthRef.current.textContent = Math.round(strength.blue)
        if (redStrengthRef.current)  redStrengthRef.current.textContent  = Math.round(strength.red)
        if (powerBarRef.current) {                                   // ratio bar: blue's share of total strength
          const tot = strength.blue + strength.red
          powerBarRef.current.style.width = (tot > 0 ? strength.blue / tot * 100 : 50) + '%'
        }
        // Flagship-loss morale: a fleet that has lost its capital breaks at a higher
        // strength threshold, flagged by a "morale broken" banner beside the scoreboard.
        const flagshipDead = {
          blue: !ships.some(s => s.isCapital && s.team === 'blue' && s.alive),
          red:  !ships.some(s => s.isCapital && s.team === 'red'  && s.alive),
        }
        if (blueMoraleRef.current) blueMoraleRef.current.style.display = flagshipDead.blue ? '' : 'none'
        if (redMoraleRef.current)  redMoraleRef.current.style.display  = flagshipDead.red  ? '' : 'none'
        // Reinforcements: on a fixed cadence, top each team's on-field fighters back up
        // to the cap from its reserve stockpile, warping the fresh wave in from the flank.
        if (!gameOver && t >= reinforceAt) {
          reinforceAt += REINFORCE_INTERVAL
          for (const tm of ['blue', 'red']) {
            if (reserveLeft[tm] <= 0) continue
            let onField = 0
            for (const s of ships) if (s.team === tm && s.alive && !s.isCapital && !s.isBomber) onField++
            let need = Math.min(FIELD_FIGHTER_CAP - onField, reserveLeft[tm])
            if (need <= 0) continue
            let sent = 0
            for (const s of ships) {
              if (need <= 0) break
              if (s.team !== tm || !s.reserve) continue
              s.reserve = false; s.alive = true; s.mesh.visible = true
              s.warping = true; s.entered = false; s.warpT = 0; s.warpDur = 0.7
              reserveLeft[tm]--; need--; sent++
            }
            if (sent) audioRef.current?.playJump()
          }
        }
        // A fleet whose remaining power falls below the threshold (but isn't already
        // wiped) breaks and retreats: broadcast the order, then warp ALL its surviving
        // ships out 3s later — which, by emptying the team, ends the engagement.
        if (!gameOver && !retreatTeam) {
          for (const tm of ['blue', 'red']) {
            const threshold = flagshipDead[tm] ? MORALE_BROKEN_STRENGTH : RETREAT_STRENGTH
            if (strength[tm] > 0 && strength[tm] < threshold) { retreatTeam = tm; retreatTime = t; showComms(tm, 'Fleet integrity lost! Retreat!'); break }
          }
        }
        if (retreatTeam && !retreatWarped && t - retreatTime >= 3) {
          retreatWarped = true
          audioRef.current?.playJump()
          for (const b of ships) if (b.team === retreatTeam && b.alive) {
            b.warpOut = true; b.warpT = 0; b.warpDur = 0.8
            b.warpFrom = b.pos.clone()
            b.warpTo = b.pos.clone().addScaledVector(jumpAxis[retreatTeam], 95)
          }
        }
        if (!gameOver && (c.blue === 0 || c.red === 0)) {
          gameOver = true
          pipRef.current = null; setPipCaption(null)   // drop any in-progress event cam the instant the match resolves
          if (followRef.current) revertToTactical()   // present the result in tactical view
          setWinner(c.blue > 0 ? 'BLUE' : c.red > 0 ? 'RED' : 'DRAW')
          audioRef.current?.playVictory(c.blue > 0 ? 'BLUE' : 'RED')
          // clear any pending battle chatter and broadcast the victor's line (persists until restart)
          const wTeam = c.blue > 0 ? 'blue' : c.red > 0 ? 'red' : null
          commsQueue.current = []; commsBusy.current = true
          if (wTeam) { const segs = VICTORY_SEGMENTS[wTeam]; const wName = wTeam === 'blue' ? blueCapNameRef.current : redCapNameRef.current; setComms({ id: ++commsSeq.current, team: wTeam, name: wName, portrait: COMMS_PORTRAIT[wTeam], text: segs.map(s => s.text).join(''), segments: segs, persist: true }) }
          else setComms(null)
          const sumKills = team => ships.filter(s => s.team === team).reduce((a, s) => a + (s.kills || 0), 0)
          const cap = team => { const k = ships.find(s => s.isCapital && s.team === team); return { name: k.name, kills: k.kills || 0, alive: k.alive } }
          setStats({
            blueKills: sumKills('blue'), redKills: sumKills('red'),
            blueLeft: c.blue, redLeft: c.red,
            blueCap: cap('blue'), redCap: cap('red'),
          })
        }

        if (backdropTick) backdropTick(t)

        // camera: third-person chase when following a ship, else the orbiting tactical view
        const fol = followRef.current
        if (fol && !fol.alive) revertToTactical()     // followed ship destroyed → tactical view
        const follow = followRef.current
        if (follow) {
          _fwd.set(0, 0, 1).applyQuaternion(follow.mesh.quaternion).normalize()
          const d = follow.isCapital ? 56 : 8, h = follow.isCapital ? 18 : 3
          _camGoal.copy(follow.pos).addScaledVector(_fwd, -d); _camGoal.y += h
          camera.position.lerp(_camGoal, 1 - Math.exp(-5 * realDt))   // realDt so it tracks even when paused
          _lookAt.copy(follow.pos).addScaledVector(_fwd, follow.isCapital ? 12 : 4)
          camera.lookAt(_lookAt)
          // live hull readout under screen-centre for the tracked ship
          const maxHp = follow.isCapital ? CAP_HP : follow.isBomber ? BOMBER_HP : follow.isCruiser ? CRUISER_HP : SHIP_HP
          const hp = Math.max(0, follow.hp)
          if (followHpRef.current) followHpRef.current.textContent = `${Math.ceil(hp)} / ${maxHp}`
          if (followBarRef.current) followBarRef.current.style.width = (hp / maxHp * 100) + '%'
          // target readout + a dashed line to each foe the tracked ship is engaging
          const foes = ships.filter(e => e.alive && e.team !== follow.team)
          let tgts = []
          if (foes.length) {
            const byDist = (a, b) => follow.pos.distanceToSquared(a.pos) - follow.pos.distanceToSquared(b.pos)
            if (follow.isCapital) tgts = (follow.volleyTargets || []).filter(t => t && t.alive)   // actual foes the last broadside fired at
            else if (follow.isCruiser) tgts = foes.slice().sort(byDist).slice(0, MISSILE_SALVO)  // missile salvo
            else if (follow.isBomber) {                                                          // bomb (capital) + PD (fighter)
              const ec = follow.team === 'blue' ? redCapital : blueCapital
              if (ec && ec.alive) tgts.push(ec)
              const ftr = foes.filter(e => !e.isCapital && !e.isBomber && !e.isCruiser).sort(byDist)[0]
              if (ftr) tgts.push(ftr)
              if (!tgts.length) tgts = foes.slice().sort(byDist).slice(0, 1)
            } else tgts = (follow.attackTarget && follow.attackTarget.alive) ? [follow.attackTarget] : foes.slice().sort(byDist).slice(0, 1)
          }
          tgts.forEach((tg, i) => {
            const { line, geo } = targetLines[i]
            const p = geo.attributes.position
            p.setXYZ(0, follow.pos.x, follow.pos.y, follow.pos.z)
            p.setXYZ(1, tg.pos.x, tg.pos.y, tg.pos.z)
            p.needsUpdate = true
            line.computeLineDistances(); line.visible = true
          })
          for (let i = tgts.length; i < targetLines.length; i++) targetLines[i].line.visible = false
          if (followTargetRef.current) {
            if (tgts.length) {
              const c = {}; tgts.forEach(t => (c[t.name] = (c[t.name] || 0) + 1))
              const str = Object.entries(c).map(([n, k]) => k > 1 ? `${n} ×${k}` : n).join(', ')
              followTargetRef.current.textContent = `${tgts.length > 1 ? 'TARGETS' : 'TARGET'}: ${str}`
              followTargetRef.current.style.visibility = 'visible'
            } else followTargetRef.current.style.visibility = 'hidden'
          }
        } else {
          hideTargetLines()
          controls.update()
        }
        composer.render()

        // picture-in-picture: render the highlighted event into a centre-right box
        const pip = pipRef.current
        if (pip) {
          pip.life += dt
          if (pip.life >= pip.max) { pipRef.current = null; setPipCaption(null) }
          else {
            const tp = pip.getTarget()
            if (tp) {
              pipCam.position.copy(tp).addScaledVector(pip.camDir, pip.dist); pipCam.position.y += pip.height
              pipCam.lookAt(tp)
              const vx = cw - PIP_RIGHT - PIP_W, vy = (ch - PIP_H) / 2
              renderer.setRenderTarget(null)
              renderer.setScissorTest(true)
              renderer.setViewport(vx, vy, PIP_W, PIP_H)
              renderer.setScissor(vx, vy, PIP_W, PIP_H)
              renderer.autoClear = true
              renderer.render(scene, pipCam)
              renderer.setScissorTest(false)
              renderer.setViewport(0, 0, cw, ch)
              renderer.setScissor(0, 0, cw, ch)
            }
          }
        }
        raf = requestAnimationFrame(frame)
      }

      // ── Bloom ────────────────────────────────────────────────────────────────
      composer = new EffectComposer(renderer)
      composer.addPass(new RenderPass(scene, camera))
      composer.addPass(new UnrealBloomPass(new THREE.Vector2(w, h), 0.9, 0.6, 0.2))

      frame()

      const onResize = () => {
        const nw = mount.clientWidth, nh = mount.clientHeight
        if (!nw || !nh) return
        cw = nw; ch = nh
        camera.aspect = nw / nh
        camera.updateProjectionMatrix()
        renderer.setSize(nw, nh)
        composer.setSize(nw, nh)
      }
      const ro = new ResizeObserver(onResize)
      ro.observe(mount)

      return () => {
        cancelAnimationFrame(raf)
        ro.disconnect()
        renderer.domElement.removeEventListener('pointerdown', onDown)
        renderer.domElement.removeEventListener('pointerup', onUp)
        exitFollowRef.current = null
        followBomberRef.current = null
        controls.dispose()
        disposables.forEach(d => d.dispose && d.dispose())
        blasts.forEach(x => { x.fmat.dispose(); x.rmat.dispose() })
        embers.forEach(e => e.mat.dispose())
        flameFX.forEach(f => f.mat.dispose())
        puffs.forEach(p => p.mat.dispose())
        trails.forEach(tr => tr.mat.dispose())
        composer.dispose && composer.dispose()
        renderer.dispose()
        if (renderer.domElement.parentNode) renderer.domElement.parentNode.removeChild(renderer.domElement)
      }
    } catch (err) {
      console.error('Space battle failed to initialise:', err)
      if (renderer) { try { renderer.dispose() } catch (_) {} }
    }
  }, [runId, started])

  const startBattle = () => { setWinner(null); setKills([]); setStats(null); setCampResult(null); setStarted(true); setRunId(k => k + 1) }
  // restart the engagement immediately (fresh jump-in) without returning to the briefing
  const restartCombat = () => { setWinner(null); setStats(null); setCampResult(null); setRunId(k => k + 1) }
  // order the blue bomber wing to warp in (one-way; the loop picks up the ref)
  const callBombers = () => { callBombersRef.current = true; setBombersCalled(true) }

  // shared post-battle breakdown (used by both the skirmish and campaign result panels)
  const statsBlock = stats && (
    <div className="sb-stats">
      <div className="sb-stats-grid">
        <span className="sb-stat-val sb-stat--blue">{stats.blueKills}</span>
        <span className="sb-stat-mid">TOTAL KILLS</span>
        <span className="sb-stat-val sb-stat--red">{stats.redKills}</span>
        <span className="sb-stat-val sb-stat--blue">{stats.blueLeft}</span>
        <span className="sb-stat-mid">SHIPS REMAINING</span>
        <span className="sb-stat-val sb-stat--red">{stats.redLeft}</span>
      </div>
      <div className="sb-stat-caps">
        <div className="sb-stat-cap">
          <span className="sb-stat--blue">{stats.blueCap.name}</span>
          <span className="sb-stat-cap-meta">{stats.blueCap.kills} KILLS · {stats.blueCap.alive ? 'SURVIVED' : 'DESTROYED'}</span>
        </div>
        <div className="sb-stat-cap">
          <span className="sb-stat--red">{stats.redCap.name}</span>
          <span className="sb-stat-cap-meta">{stats.redCap.kills} KILLS · {stats.redCap.alive ? 'SURVIVED' : 'DESTROYED'}</span>
        </div>
      </div>
    </div>
  )

  return (
    <div id="battle-screen">
      <HudHeader
        onLogout={onReturn}
        right={<span className="label">{isCampaign ? `OPERATION // ${campaign.nodeTitle}` : 'TAC-SIM / FLEET ENGAGEMENT'}</span>}
      />

      <div className="sb-stage">
        <div className="sb-canvas" ref={mountRef} />

        {!started && !isCampaign && (
          <Briefing comp={comp} blueCapName={blueCapName} onCycleBlueName={cycleBlueName} onAdjust={adjustComp} onStart={startBattle} />
        )}

        <div className="sb-cap-label sb-cap-label--blue" ref={blueCapRef}>
          <div className="sb-cap-name">{splitCapName(blueCapName).name}</div>
          <div className="sb-cap-shield">SHIELD <span ref={blueShieldRef}>100</span>%</div>
          <div className="sb-cap-reserve" ref={blueReserveRef} style={{ display: 'none' }}></div>
        </div>
        <div className="sb-cap-label sb-cap-label--red" ref={redCapRef}>
          <div className="sb-cap-name">{splitCapName(redCapName).name}</div>
          <div className="sb-cap-shield">SHIELD <span ref={redShieldRef}>100</span>%</div>
          <div className="sb-cap-reserve" ref={redReserveRef} style={{ display: 'none' }}></div>
        </div>

        <div className="sb-scoreboard">
          <div className="sb-morale sb-morale--blue" ref={blueMoraleRef} style={{ display: 'none' }}>Flagship Lost<br />Morale Broken</div>
          <div className="sb-morale sb-morale--red" ref={redMoraleRef} style={{ display: 'none' }}>Flagship Lost<br />Morale Broken</div>
          <div className="sb-score-row">
            <span className="sb-score sb-score--blue">BLUE FLEET <span ref={blueCountRef} className="sb-count">{Math.min(FIELD_FIGHTER_CAP, comp.blue.fighters) + comp.blue.cruisers + 1}</span></span>
            <span className="sb-vs">⚔ ENGAGED ⚔</span>
            <span className="sb-score sb-score--red"><span ref={redCountRef} className="sb-count">{Math.min(FIELD_FIGHTER_CAP, comp.red.fighters) + comp.red.cruisers + 1}</span> RED FLEET</span>
          </div>
          <div className="sb-strength-row">
            <span className="sb-strength sb-strength--blue">STRENGTH <span ref={blueStrengthRef}>{compStrength(comp.blue)}</span>{!isCampaign && `/${FLEET_BUDGET}`}</span>
            <div className="sb-power-bar"><div className="sb-power-bar-blue" ref={powerBarRef} /></div>
            <span className="sb-strength sb-strength--red"><span ref={redStrengthRef}>{compStrength(comp.red)}</span>{!isCampaign && `/${FLEET_BUDGET}`} STRENGTH</span>
          </div>
        </div>

        {/* sim speed selector + realtime battle clock (top-right) */}
        <div className="sb-simctl">
          <div className="sb-speed-label">SIM SPEED</div>
          <div className="sb-speed" role="group" aria-label="Sim speed">
            {[0, 0.5, 1].map(sp => (
              <button
                key={sp}
                className={`sb-speed-seg${simSpeed === sp ? ' sb-speed-seg--on' : ''}`}
                onClick={() => setSimSpeed(sp)}
              >{sp === 0 ? '0' : sp === 0.5 ? '0.5×' : '1×'}</button>
            ))}
          </div>
          <div className="sb-timer">BATTLE<span className="sb-timer-clock" ref={timerRef}>0:00</span></div>
        </div>

        {/* picture-in-picture event camera frame + caption (centre-right) */}
        {pipCaption && (
          <div className={`sb-pip sb-pip--${pipCaption.team}`}>
            <div className="sb-pip-tag">◉ LIVE FEED</div>
            <div className="sb-pip-caption">{pipCaption.text}</div>
          </div>
        )}

        {winner && isCampaign && (() => {
          const won = winner === 'BLUE'
          return (
            <div className="sb-victory">
              <div className="sb-victory-sub">{won ? 'SECTOR SECURED' : 'ENGAGEMENT LOST'}</div>
              <div className={`sb-victory-title sb-victory-title--${won ? 'blue' : 'red'}`}>
                {won ? 'VICTORY' : winner === 'DRAW' ? 'MUTUAL ANNIHILATION' : 'FLEET LOST'}
              </div>
              {statsBlock}
              <div className="sb-reward-row">
                {campResult && campResult.award > 0 ? (
                  <div className="sb-reward">
                    <span className="sb-reward-val">+{campResult.award}</span>
                    <span className="sb-reward-label">REQUISITION BANKED</span>
                    {campResult.firstClear && <span className="sb-reward-unlock">▸ NEXT OPERATION UNLOCKED</span>}
                  </div>
                ) : campResult && campResult.won ? (
                  <div className="sb-reward">
                    <span className="sb-reward-label">SECTOR ALREADY SECURED · NO REQUISITION</span>
                  </div>
                ) : null}
                <div className="sb-victory-btns">
                  {!won && <button className="sb-restart sb-restart--ghost" onClick={() => campaign.onRetry()}>↻ RE-DEPLOY</button>}
                  <button className="sb-restart" onClick={() => campaign.onExit()}>{won ? 'CONTINUE ▶' : '↩ WITHDRAW'}</button>
                </div>
              </div>
            </div>
          )
        })()}

        {winner && !isCampaign && (
          <div className="sb-victory">
            <div className="sb-victory-sub">ENGAGEMENT RESOLVED</div>
            <div className={`sb-victory-title sb-victory-title--${winner.toLowerCase()}`}>
              {winner === 'DRAW' ? 'MUTUAL ANNIHILATION' : `${winner} FLEET VICTORIOUS`}
            </div>

            {statsBlock}

            <button className="sb-restart" onClick={() => { setWinner(null); setKills([]); setStats(null); setComms(null); commsQueue.current = []; commsBusy.current = false; setStarted(false) }}>
              ⟳ NEW ENGAGEMENT
            </button>
          </div>
        )}

        <div className="sb-killfeed">
          {kills.map(k => (
            <div key={k.id} className="sb-kill">
              <span className={`sb-kill-name sb-kill-name--${k.kTeam}`}>{k.kName}</span>
              <span className="sb-kill-verb"> destroyed </span>
              <span className={`sb-kill-name sb-kill-name--${k.vTeam}`}>{k.vName}</span>
            </div>
          ))}
        </div>

        {comms && (
          <div className={`sb-comms sb-comms--${comms.team}`} key={comms.id}>
            <img className="sb-comms-portrait" src={comms.portrait} alt="" />
            <div className="sb-comms-body">
              <div className="sb-comms-name">{comms.name}</div>
              <div className="sb-comms-text">{renderCommsBody(comms.segments || [{ text: comms.text }], commsText.length)}<span className="sb-comms-cursor">▋</span></div>
            </div>
          </div>
        )}

        <div className="sb-tactics">
          <div className="sb-tac-title">⬢ TACTICAL COMMAND // BLUE FLEET</div>
          <div className="sb-tac-group">
            <div className="sb-tac-label">CAPITAL SHIP</div>
            <div className="sb-tac-btns">
              <button className={`sb-tac-btn${capTactic === 'hold' ? ' sb-tac-btn--on' : ''}`} onClick={() => setCapTactic('hold')}>HOLD BACK</button>
              <button className={`sb-tac-btn${capTactic === 'engage' ? ' sb-tac-btn--on' : ''}`} onClick={() => setCapTactic('engage')}>DIRECTLY ENGAGE</button>
            </div>
          </div>
          <div className="sb-tac-group">
            <div className="sb-tac-label">FIGHTER CONTROL</div>
            <div className="sb-tac-btns">
              <button className={`sb-tac-btn${fighterControl === 'default' ? ' sb-tac-btn--on' : ''}`} onClick={() => setFighterControl('default')}>DEFAULT</button>
              <button className={`sb-tac-btn${fighterControl === 'screen' ? ' sb-tac-btn--on' : ''}`} onClick={() => setFighterControl('screen')}>SCREEN CARRIER</button>
              <button className={`sb-tac-btn${fighterControl === 'pursue' ? ' sb-tac-btn--on' : ''}`} onClick={() => setFighterControl('pursue')}>PURSUE BOMBERS</button>
              <button className={`sb-tac-btn${fighterControl === 'capital' ? ' sb-tac-btn--on' : ''}`} onClick={() => setFighterControl('capital')}>ATTACK CAPITAL SHIP</button>
            </div>
          </div>

          {comp.blue.bombers > 0 && (
            <div className="sb-dispatch">
              <div className="sb-dispatch-row">
                <button
                  className={`sb-dispatch-btn${bombersCalled ? ' sb-dispatch-btn--sent' : ''}`}
                  onClick={callBombers}
                  disabled={bombersCalled}
                >
                  {bombersCalled ? '✦ BOMBERS INBOUND' : '▼ DISPATCH BOMBERS'}
                </button>
                <div className="sb-dispatch-icons">
                  {blueBomberAlive.map((alive, i) => {
                    const live = bombersCalled && alive   // launched + not destroyed → trackable
                    return (
                      <span
                        key={i}
                        className={`sb-dispatch-bomber${alive ? '' : ' sb-dispatch-bomber--dead'}${live ? ' sb-dispatch-bomber--live' : ''}`}
                        onClick={live ? () => followBomberRef.current?.(i) : undefined}
                        title={live ? 'Track this bomber' : undefined}
                      >
                        <ShipSprite team="blue" kind="bomber" />
                      </span>
                    )
                  })}
                </div>
              </div>
              {!bombersCalled && <div className="sb-dispatch-countdown" ref={bomberCountdownRef} />}
            </div>
          )}
        </div>

        <button className="sb-restart-top" onClick={restartCombat}>⟳ RESTART COMBAT</button>

        <button className={`sb-sound${muted ? ' sb-sound--off' : ''}`} onClick={() => setMuted(m => !m)}>
          {muted ? '♪ SOUND OFF' : '♪ SOUND ON'}
        </button>

        {followName && (
          <div className="sb-follow">
            <div className="sb-follow-label">◉ TRACKING // {followName}</div>
            <button className="sb-follow-exit" onClick={() => exitFollowRef.current && exitFollowRef.current()}>
              ↩ RETURN TO TACTICAL VIEW
            </button>
          </div>
        )}

        {followName && (
          <div className={`sb-track-readout sb-track-readout--${followTeam || 'blue'}`}>
            <div className="sb-track-name">{followName}</div>
            <div className="sb-track-hpbar"><div className="sb-track-hpfill" ref={followBarRef} /></div>
            <div className="sb-track-hp">HULL <b ref={followHpRef} /></div>
            <div className="sb-track-target" ref={followTargetRef} />
          </div>
        )}

        {!followName && <div className="sb-hint">DRAG TO ORBIT // SCROLL TO ZOOM // CLICK A SHIP TO TRACK</div>}
      </div>

      <HudFooter>
        <span>HMSS / TAC-SIM / FLEET ENGAGEMENT MODEL</span>
        <span className="sep">│</span>
        <span>DOCTRINE: <em className="ok">ATTRITION</em></span>
        <span className="sep">│</span>
        <span>SIM STATE: <em className={winner || !started ? 'warn' : 'ok'}>{winner ? 'RESOLVED' : started ? 'LIVE' : 'STANDBY'}</em></span>
      </HudFooter>
    </div>
  )
}
