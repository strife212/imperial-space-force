import { useState, useEffect, useRef, useCallback } from 'react'
import { LOG_MESSAGES, PKG_NAMES, SECTION_INFO } from '../lib/constants'
import { PLANETS, SUN, SUN_IDX } from '../lib/planetData'
import LaunchCodeVerifier from './LaunchCodeVerifier'
import HudHeader from '../components/HudHeader'
import HudFooter from '../components/HudFooter'

// ── Utilities ────────────────────────────────────────────────────────────────
const t0      = Date.now() - 86400_000 * 17 - 3600_000 * 4 - 60_000 * 22
const rand    = (a, b) => a + Math.random() * (b - a)
const wrap360 = (x) => ((x % 360) + 360) % 360
const pad     = (n, w = 2) => String(n).padStart(w, '0')

const fmtClock = (ms) => {
  const s  = Math.floor(ms / 1000)
  const d  = Math.floor(s / 86400)
  const h  = Math.floor((s % 86400) / 3600)
  const m  = Math.floor((s % 3600) / 60)
  const ss = s % 60
  return `${pad(d, 3)}:${pad(h)}:${pad(m)}:${pad(ss)}`
}
const fmtUTC = (d) => {
  const iso = d.toISOString()
  return `UTC ${iso.slice(0, 10)} ${iso.slice(11, 23)}`
}
const fitCanvas = (cv) => {
  const r   = cv.getBoundingClientRect()
  const dpr = window.devicePixelRatio || 1
  cv.width  = r.width  * dpr
  cv.height = r.height * dpr
  cv.getContext('2d').setTransform(dpr, 0, 0, dpr, 0, 0)
}
const makeContacts = (n) => Array.from({ length: n }, () => ({
  a:    Math.random() * Math.PI * 2,
  r:    0.2 + Math.random() * 0.8,
  va:   (Math.random() - 0.5) * 0.004,
  vr:   (Math.random() - 0.5) * 0.0007,
  kind: Math.random() < 0.15 ? 'hostile' : Math.random() < 0.4 ? 'neutral' : 'unknown',
  id:   'CTC-' + Math.floor(Math.random() * 9999).toString(16).toUpperCase().padStart(4, '0'),
}))

// ── Component ────────────────────────────────────────────────────────────────
export default function MainPanel({ onLogout, onLaunchComplete, onReactor, onTargeting, reactorPlasma = 75, targetIdx = -1, unreadCount = 0, onMailOpen }) {

  // ── Panel init animation ──────────────────────────────────────────────────
  const [litPanels, setLitPanels] = useState(new Set())

  useEffect(() => {
    const order = [
      'panel-geodetic', 'panel-radar',    'panel-loadout',
      'panel-spacetime','panel-causality','panel-target',
      'panel-power',    'panel-log',      'panel-launch',
    ]
    const timers = order.map((id, i) =>
      setTimeout(() => setLitPanels(prev => new Set([...prev, id])), 80 + i * 160)
    )
    return () => timers.forEach(clearTimeout)
  }, [])

  const lit = (id) => litPanels.has(id) ? '' : ' unlit'

  // ── Structural state (drives re-renders) ──────────────────────────────────
  const [radarView,       setRadarViewState]  = useState('radar')
  const [launchPhase,     setLaunchPhase]     = useState('idle')
  const [selectedPkg,     setSelectedPkgState]= useState('kn')
  const [activeSection,   setActiveSectionSt] = useState(null)
  const [logEntries,      setLogEntries]      = useState([])
  const [launchStatus,    setLaunchStatus]    = useState({ text: 'SYSTEM READY // AWAITING ARM', cls: 'launch-status' })
  const [launchLabel,     setLaunchLabel]     = useState('INITIATE LAUNCH SEQUENCE')
  const [launchCdText,    setLaunchCdText]    = useState('')
  const [cdVisible,       setCdVisible]       = useState(true)
  const [authCActive,     setAuthCActive]     = useState(false)

  // ── Refs mirroring state (for use inside RAF closure) ─────────────────────
  const radarViewRef    = useRef('radar')
  const selectedPkgRef  = useRef('kn')
  const activeSectionRef= useRef(null)
  const launchPhaseRef  = useRef('idle')

  // ── Canvas element refs ───────────────────────────────────────────────────
  const radarCanvasRef  = useRef(null)
  const railgunCanvasRef= useRef(null)
  const targetCanvasRef = useRef(null)

  // ── Telemetry DOM refs (direct mutation in RAF loop) ──────────────────────
  const clockRef        = useRef(null)
  const utcRef          = useRef(null)
  const latRef          = useRef(null)
  const lonRef          = useRef(null)
  const altRef          = useRef(null)
  const velRef          = useRef(null)
  const nuRef           = useRef(null)
  const raanRef         = useRef(null)
  const argpRef         = useRef(null)
  const ltDragRef       = useRef(null)
  const ricciRef        = useRef(null)
  const kretschRef      = useRef(null)
  const admRef          = useRef(null)
  const tensorRef       = useRef(null)
  const coneStateRef    = useRef(null)
  const tachyonRef      = useRef(null)
  const decohereRef     = useRef(null)
  const coreFluxRef     = useRef(null)
  const coreBarRef      = useRef(null)
  const capBankRef      = useRef(null)
  const capBarRef       = useRef(null)
  const zpeRef          = useRef(null)
  const zpeBarRef       = useRef(null)
  const radiatorRef     = useRef(null)
  const ecefRef         = useRef(null)
  const shapiroRef      = useRef(null)
  const ltlagRef        = useRef(null)
  const grbBarRef       = useRef(null)
  const contactCountRef = useRef(null)

  // ── Simulation state refs ─────────────────────────────────────────────────
  const orbitRef      = useRef({ inc: 51.6394, raan: 142.778, argp: 87.412, a: 6786.4, period: 92.9 * 60, t: 0 })
  const contactsRef   = useRef(makeContacts(9))
  const sweepAngleRef = useRef(0)
  const rgPulseRef    = useRef(0)
  const tphaseRef     = useRef(0)
  const grbPctRef     = useRef(34)
  const lastTimeRef   = useRef(null)
  const logTimerRef   = useRef(0)
  const grbTimerRef   = useRef(0)
  const logBufRef     = useRef([])
  const rafRef               = useRef(null)
  const cdTimerRef           = useRef(null)
  const codetickSfx          = useRef(null)
  const onLaunchCompleteRef  = useRef(onLaunchComplete)
  useEffect(() => { onLaunchCompleteRef.current = onLaunchComplete }, [onLaunchComplete])
  const reactorPlasmaRef = useRef(reactorPlasma)
  useEffect(() => { reactorPlasmaRef.current = reactorPlasma }, [reactorPlasma])
  const targetIdxRef = useRef(targetIdx)
  useEffect(() => { targetIdxRef.current = targetIdx }, [targetIdx])

  // ── Log helper ────────────────────────────────────────────────────────────
  const addLog = useCallback((level, msg) => {
    const ts = new Date()
    const t  = `${pad(ts.getUTCHours())}:${pad(ts.getUTCMinutes())}:${pad(ts.getUTCSeconds())}.${pad(ts.getUTCMilliseconds(), 3)}`
    logBufRef.current = [...logBufRef.current, { t, level, msg }].slice(-6)
    setLogEntries([...logBufRef.current])
  }, [])

  // ── Radar view toggle ─────────────────────────────────────────────────────
  const setRadarView = useCallback((view) => {
    radarViewRef.current = view
    setRadarViewState(view)
  }, [])

  // Fit the railgun canvas after the DOM has rendered it visible
  useEffect(() => {
    if (radarView === 'install' && railgunCanvasRef.current) {
      fitCanvas(railgunCanvasRef.current)
    }
  }, [radarView])

  // ── Section click ─────────────────────────────────────────────────────────
  const handleSectionClick = useCallback((sec) => {
    const next = activeSectionRef.current === sec ? null : sec
    activeSectionRef.current = next
    setActiveSectionSt(next)
  }, [])

  // ── Launch control ────────────────────────────────────────────────────────
  const handleReset = useCallback(() => {
    if (cdTimerRef.current) clearTimeout(cdTimerRef.current)
    launchPhaseRef.current = 'idle'
    setLaunchPhase('idle')
    setLaunchStatus({ text: 'SYSTEM READY // AWAITING ARM', cls: 'launch-status' })
    setLaunchLabel('INITIATE LAUNCH SEQUENCE')
    setLaunchCdText('')
    setCdVisible(true)
    setAuthCActive(false)
  }, [])

  const handleVerifyComplete = useCallback(() => {
    if (launchPhaseRef.current !== 'verifying') return
    launchPhaseRef.current = 'armed'
    setLaunchPhase('armed')
    setLaunchStatus({ text: '⚠ ARMED — LAUNCH ENABLED', cls: 'launch-status armed' })
  }, [])

  const handleArm = useCallback(() => {
    if (launchPhaseRef.current === 'idle') {
      launchPhaseRef.current = 'verifying'
      setLaunchPhase('verifying')
      setLaunchStatus({ text: '⚠ VERIFYING LAUNCH CODES', cls: 'launch-status armed' })
      setAuthCActive(true)
      addLog('CRIT', `PHYSICS PACKAGE ARMED // ${PKG_NAMES[selectedPkgRef.current]}`)
    } else if (launchPhaseRef.current === 'verifying' || launchPhaseRef.current === 'armed' || launchPhaseRef.current === 'countdown') {
      handleReset()
      addLog('WARN', 'LAUNCH SEQUENCE ABORTED // DISARMED BY OPERATOR')
    }
  }, [addLog, handleReset])

  const handleFire = useCallback(() => {
    if (launchPhaseRef.current !== 'armed') return
    launchPhaseRef.current = 'countdown'
    setLaunchPhase('countdown')
    setLaunchStatus({ text: 'COUNTDOWN IN PROGRESS', cls: 'launch-status firing' })

    let val = 10
    const tick = () => {
      if (val > 0) {
        setLaunchCdText(`T− ${String(val).padStart(2, '0')}`)
        addLog('CRIT', `LAUNCH T-${val} // ${PKG_NAMES[selectedPkgRef.current]}`)
        val--
        cdTimerRef.current = setTimeout(tick, 1000)
      } else {
        launchPhaseRef.current = 'fired'
        setLaunchPhase('fired')
        setLaunchCdText('LAUNCHED')
        setLaunchStatus({ text: '🔴 PACKAGE AWAY', cls: 'launch-status firing' })
        setLaunchLabel('PACKAGE AWAY')
        addLog('CRIT', `*** ${PKG_NAMES[selectedPkgRef.current]} // PACKAGE AWAY ***`)
        addLog('CRIT', 'GEODESIC INTERCEPT SOLUTION COMMITTED')
        cdTimerRef.current = setTimeout(() => {
          onLaunchCompleteRef.current?.(PKG_NAMES[selectedPkgRef.current])
        }, 6500)
      }
    }
    tick()
  }, [addLog, handleReset])

  const handleSelectPkg = useCallback((pkg) => {
    if (launchPhaseRef.current !== 'idle') return
    selectedPkgRef.current = pkg
    setSelectedPkgState(pkg)
    setLaunchStatus({ text: 'SYSTEM READY // AWAITING ARM', cls: 'launch-status' })
  }, [])

  // ── Audio preload ─────────────────────────────────────────────────────────
  useEffect(() => {
    const audio = new Audio(`${import.meta.env.BASE_URL}codetick.wav`)
    audio.preload = 'auto'
    codetickSfx.current = audio
  }, [])

  const playTick = useCallback(() => {
    if (codetickSfx.current) {
      codetickSfx.current.currentTime = 0
      codetickSfx.current.volume = 0.1
      codetickSfx.current.play().catch(() => {})
    }
  }, [])

  // ── Main RAF effect ───────────────────────────────────────────────────────
  useEffect(() => {
    addLog('INFO', 'HMSS fire-control bus online // v6.2.41')
    addLog('INFO', 'GR-corrected solver loaded — Kerr metric, a=0.998')
    addLog('INFO', 'Operator HIH V. ASTRAIA authenticated // CLR-Ω')
    addLog('WARN', 'Weapons platform armed — DEFCON-2 in effect')

    const fitAll = () => {
      if (radarCanvasRef.current)   fitCanvas(radarCanvasRef.current)
      if (targetCanvasRef.current)  fitCanvas(targetCanvasRef.current)
      if (railgunCanvasRef.current) fitCanvas(railgunCanvasRef.current)
    }
    fitAll()
    window.addEventListener('resize', fitAll)

    // ── Simulation update functions ──────────────────────────────────────
    const updateGeodetic = (dt) => {
      const o  = orbitRef.current
      o.t += dt
      const n  = (2 * Math.PI) / o.period
      const nu = wrap360((n * o.t) * (180 / Math.PI))
      const u  = (o.argp + nu) * Math.PI / 180
      const inc= o.inc * Math.PI / 180
      const lat= Math.asin(Math.sin(inc) * Math.sin(u)) * 180 / Math.PI
      const lon= wrap360(o.raan + Math.atan2(Math.cos(inc) * Math.sin(u), Math.cos(u)) * 180 / Math.PI - (o.t * 360 / 86164)) - 180
      const alt= (o.a - 6378.137) + Math.sin(o.t * 0.01) * 0.4
      const vel= 7.660 + Math.sin(o.t * 0.013) * 0.004
      if (latRef.current)    latRef.current.textContent    = `${lat >= 0 ? '+' : ''}${lat.toFixed(6)}°`
      if (lonRef.current)    lonRef.current.textContent    = `${lon >= 0 ? '+' : ''}${lon.toFixed(6)}°`
      if (altRef.current)    altRef.current.textContent    = `${alt.toFixed(2)} km`
      if (velRef.current)    velRef.current.textContent    = `${vel.toFixed(3)} km/s`
      if (nuRef.current)     nuRef.current.textContent     = `${nu.toFixed(3)}°`
      if (raanRef.current)   raanRef.current.textContent   = `${(o.raan + o.t * 7.5e-5).toFixed(3)}°`
      if (argpRef.current)   argpRef.current.textContent   = `${(o.argp + o.t * 4.1e-5).toFixed(3)}°`
      const lt = 3.142e-14 + Math.sin(o.t * 0.07) * 1.1e-15
      if (ltDragRef.current) ltDragRef.current.textContent = `${lt.toExponential(3)} rad·s⁻¹`
    }

    const updateSpacetime = (now) => {
      const r = 8.412e-26 + Math.sin(now * 0.0011) * 1.2e-27
      if (ricciRef.current)   ricciRef.current.textContent   = `${r.toExponential(3)} m⁻²`
      const k = 1.137e-44 + Math.cos(now * 0.0009) * 8.0e-46
      if (kretschRef.current) kretschRef.current.textContent = `${k.toExponential(3)} m⁻⁴`
      const adm = 28470 + Math.sin(now * 0.0007) * 12
      if (admRef.current)     admRef.current.textContent     = `${adm.toExponential(3)} kg`
      const cell = (base) => { const v = base + (Math.random() - 0.5) * 0.0002; return (v >= 0 ? '+' : '') + v.toFixed(5) }
      if (tensorRef.current)  tensorRef.current.textContent  =
        ` ${cell(-0.99988)}   ${cell(0.00004)}   ${cell(-0.00001)}   ${cell(0.00000)}\n` +
        ` ${cell(0.00004)}   ${cell(1.00012)}   ${cell(0.00002)}   ${cell(-0.00001)}\n` +
        ` ${cell(-0.00001)}   ${cell(0.00002)}   ${cell(1.00009)}   ${cell(0.00003)}\n` +
        ` ${cell(0.00000)}   ${cell(-0.00001)}   ${cell(0.00003)}   ${cell(1.00007)}`
    }

    const updateCausality = (now) => {
      const tilt = 0.00027 + Math.abs(Math.sin(now * 0.0005)) * 0.00018
      if (coneStateRef.current) coneStateRef.current.textContent = `${tilt.toFixed(5)} rad`
      const tach = 2.4 + Math.sin(now * 0.0017) * 0.6
      if (tachyonRef.current) {
        tachyonRef.current.textContent = `${tach.toFixed(2)} σ ABOVE BG`
        tachyonRef.current.className = tach >= 3.5 ? 'chrono-state bad' : tach > 2.0 ? 'chrono-state warn' : 'chrono-state ok'
      }
      const tD = (10 ** -13) * (1 + Math.sin(now * 0.0009) * 0.05)
      if (decohereRef.current) decohereRef.current.textContent = `τ_D = ${tD.toExponential(2)} s`
    }

    const updatePower = (now) => {
      const d    = reactorPlasmaRef.current / 100
      const flux = (0.35 + d * 3.85) + Math.sin(now * 0.00041) * 0.05
      if (coreFluxRef.current) coreFluxRef.current.textContent = `${flux.toFixed(3)} GW`
      if (coreBarRef.current)  coreBarRef.current.style.width  = `${Math.min(100, flux / 4.2 * 100).toFixed(1)}%`
      const cap = (14 + d * 80) + Math.sin(now * 0.00058) * 1.5
      if (capBankRef.current)  capBankRef.current.textContent  = `${Math.min(100, cap).toFixed(1)}%`
      if (capBarRef.current)   capBarRef.current.style.width   = `${Math.min(100, cap).toFixed(1)}%`
      const zpe = 3.7e-9 + Math.sin(now * 0.00077) * 4.0e-10
      if (zpeRef.current)      zpeRef.current.textContent      = `${zpe.toExponential(2)} J·m⁻³`
      if (zpeBarRef.current)   zpeBarRef.current.style.width   = `${(zpe / 6e-9 * 100).toFixed(1)}%`
      const radT = (580 + d * 2950) + Math.sin(now * 0.00033) * 40
      if (radiatorRef.current) radiatorRef.current.textContent = `+${radT.toFixed(0)} K`
    }

    const updateTargeting = (now) => {
      if (targetIdxRef.current < 0) return
      const drift = (b) => b + (Math.random() - 0.5) * 0.4
      const x = drift(4218.412), y = -drift(3914.083), z = drift(3221.770)
      if (ecefRef.current) ecefRef.current.textContent =
        `${x >= 0 ? '+' : ''}${x.toFixed(3)}, ${y >= 0 ? '+' : ''}${y.toFixed(3)}, ${z >= 0 ? '+' : ''}${z.toFixed(3)} km`
      const sh = 412 + Math.sin(now * 0.0012) * 18
      if (shapiroRef.current) shapiroRef.current.textContent = `+${sh.toFixed(0)} µs`
      const lt = 0.00468 + Math.sin(now * 0.0008) * 0.00007
      if (ltlagRef.current) ltlagRef.current.textContent = `${lt.toFixed(5)} s`
    }

    // ── Canvas draw functions ────────────────────────────────────────────
    const drawRadar = (dt) => {
      const cv = radarCanvasRef.current
      if (!cv) return
      const ctx = cv.getContext('2d')
      const w = cv.clientWidth, h = cv.clientHeight
      const cx = w / 2, cy = h / 2
      const R  = Math.min(w, h) * 0.46
      ctx.fillStyle = 'rgba(1, 2, 8, 0.22)'
      ctx.fillRect(0, 0, w, h)
      ctx.strokeStyle = 'rgba(0, 50, 180, 0.45)'
      ctx.lineWidth = 1
      for (let i = 1; i <= 5; i++) { ctx.beginPath(); ctx.arc(cx, cy, (R / 5) * i, 0, Math.PI * 2); ctx.stroke() }
      ctx.beginPath(); ctx.moveTo(cx - R, cy); ctx.lineTo(cx + R, cy); ctx.moveTo(cx, cy - R); ctx.lineTo(cx, cy + R); ctx.stroke()
      ctx.strokeStyle = 'rgba(20, 80, 220, 0.35)'; ctx.setLineDash([4, 4])
      ctx.beginPath(); ctx.moveTo(cx - R, cy - R); ctx.lineTo(cx + R, cy + R); ctx.moveTo(cx - R, cy + R); ctx.lineTo(cx + R, cy - R); ctx.stroke()
      ctx.setLineDash([])
      ctx.fillStyle = 'rgba(106, 173, 255, 0.7)'; ctx.font = '9px Cascadia Mono, Consolas, monospace'
      for (let deg = 0; deg < 360; deg += 30) {
        const a = (deg - 90) * Math.PI / 180
        ctx.fillText(String(deg).padStart(3, '0'), cx + Math.cos(a) * (R + 10) - 8, cy + Math.sin(a) * (R + 10) + 3)
      }
      sweepAngleRef.current += dt * 0.0011
      const a0 = sweepAngleRef.current, arc = Math.PI / 3
      const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, R)
      grad.addColorStop(0, 'rgba(0,100,255,0.0)'); grad.addColorStop(0.7, 'rgba(0,100,255,0.18)'); grad.addColorStop(1, 'rgba(0,100,255,0.0)')
      ctx.fillStyle = grad; ctx.beginPath(); ctx.moveTo(cx, cy); ctx.arc(cx, cy, R, a0 - arc, a0); ctx.closePath(); ctx.fill()
      ctx.strokeStyle = 'rgba(26,128,255,0.85)'; ctx.lineWidth = 1.3
      ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(a0) * R, cy + Math.sin(a0) * R); ctx.stroke()
      for (const c of contactsRef.current) {
        c.a += c.va * dt; c.r += c.vr * dt
        if (c.r > 0.95 || c.r < 0.1) c.vr *= -1
        const x = cx + Math.cos(c.a) * c.r * R, y = cy + Math.sin(c.a) * c.r * R
        const da = ((c.a - a0) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2)
        const fade = Math.max(0.15, 1 - da / (Math.PI * 0.9))
        const color = c.kind === 'hostile' ? `rgba(255,36,0,${fade})` : c.kind === 'neutral' ? `rgba(179,212,255,${fade * 0.7})` : `rgba(20,100,220,${fade})`
        ctx.fillStyle = color; ctx.strokeStyle = color
        if (c.kind === 'hostile') { ctx.beginPath(); ctx.moveTo(x, y - 6); ctx.lineTo(x + 5, y + 4); ctx.lineTo(x - 5, y + 4); ctx.closePath(); ctx.fill() }
        else { ctx.beginPath(); ctx.arc(x, y, 3, 0, Math.PI * 2); ctx.fill() }
        if (fade > 0.7) { ctx.fillStyle = `rgba(179,212,255,${fade})`; ctx.fillText(c.id, x + 6, y + 3) }
      }
      if (contactCountRef.current) contactCountRef.current.textContent = String(contactsRef.current.length)
      ctx.fillStyle = 'rgba(106,173,255,1)'; ctx.beginPath(); ctx.arc(cx, cy, 3, 0, Math.PI * 2); ctx.fill()
      ctx.strokeStyle = 'rgba(106,173,255,0.7)'; ctx.beginPath(); ctx.arc(cx, cy, 8, 0, Math.PI * 2); ctx.stroke()
    }

    const drawRailgun = (dt) => {
      const cv = railgunCanvasRef.current
      if (!cv || radarViewRef.current !== 'install') return
      const ctx = cv.getContext('2d')
      rgPulseRef.current += dt * 0.002
      const p = rgPulseRef.current
      const w = cv.clientWidth, h = cv.clientHeight
      ctx.clearRect(0, 0, w, h); ctx.fillStyle = '#050102'; ctx.fillRect(0, 0, w, h)
      ctx.fillStyle = 'rgba(179,210,255,0.25)'
      for (let i = 0; i < 80; i++) {
        const sx = ((i * 137 + 41) % 1000) / 1000 * w, sy = ((i * 271 + 83) % 1000) / 1000 * h
        ctx.beginPath(); ctx.arc(sx, sy, 0.6 + ((i * 53) % 10) / 10 * 0.8, 0, Math.PI * 2); ctx.fill()
      }
      const hl = activeSectionRef.current ? SECTION_INFO[activeSectionRef.current].highlight : null
      const drawHighlight = (nx, ny, nw, nh, pulse) => {
        const x = nx * w, y = ny * h, bw = nw * w, bh = nh * h
        const alpha = 0.12 + Math.abs(Math.sin(pulse)) * 0.12
        ctx.fillStyle = `rgba(0,100,255,${alpha})`; ctx.fillRect(x, y, bw, bh)
        ctx.strokeStyle = `rgba(0,128,255,${0.5 + Math.abs(Math.sin(pulse)) * 0.45})`; ctx.lineWidth = 1.5; ctx.strokeRect(x, y, bw, bh)
      }
      const cx = w * 0.5, cy = h * 0.5
      const spineY = cy + h * 0.02
      ctx.strokeStyle = 'rgba(20,60,180,0.9)'; ctx.lineWidth = h * 0.025
      ctx.beginPath(); ctx.moveTo(w * 0.04, spineY); ctx.lineTo(w * 0.96, spineY); ctx.stroke()
      ctx.strokeStyle = 'rgba(60,120,255,0.3)'; ctx.lineWidth = 1
      ctx.beginPath(); ctx.moveTo(w * 0.04, spineY); ctx.lineTo(w * 0.96, spineY); ctx.stroke()
      const railOff = h * 0.065
      for (const sign of [-1, 1]) {
        const ry = spineY + sign * railOff
        ctx.strokeStyle = 'rgba(20,80,220,0.85)'; ctx.lineWidth = h * 0.012
        ctx.beginPath(); ctx.moveTo(w * 0.18, ry); ctx.lineTo(w * 0.82, ry); ctx.stroke()
        ctx.strokeStyle = `rgba(26,128,255,${0.3 + Math.abs(Math.sin(p * 1.3)) * 0.25})`; ctx.lineWidth = 1
        ctx.beginPath(); ctx.moveTo(w * 0.18, ry); ctx.lineTo(w * 0.82, ry); ctx.stroke()
      }
      for (let i = 0; i < 16; i++) {
        const cx2 = w * (0.19 + i * (0.62 / 15)), cp = p + i * 0.4, alpha = 0.45 + Math.abs(Math.sin(cp)) * 0.45
        ctx.strokeStyle = `rgba(26,128,255,${alpha})`; ctx.lineWidth = 2
        ctx.beginPath(); ctx.moveTo(cx2, spineY - h * 0.12); ctx.lineTo(cx2, spineY + h * 0.12); ctx.stroke()
        ctx.strokeStyle = `rgba(20,80,200,${alpha * 0.7})`; ctx.lineWidth = 1
        ctx.beginPath(); ctx.ellipse(cx2, spineY, w * 0.008, h * 0.11, 0, 0, Math.PI * 2); ctx.stroke()
      }
      const capCx = w * 0.72, capCy = spineY + h * 0.2
      for (let row = 0; row < 2; row++) for (let col = 0; col < 5; col++) {
        const bx = capCx + (col - 2) * w * 0.036, by = capCy + row * h * 0.08
        const bp = 0.25 + Math.abs(Math.sin(p * 1.8 + col * 0.7 + row)) * 0.35
        ctx.fillStyle = `rgba(0,30,100,${bp})`; ctx.strokeStyle = 'rgba(20,80,220,0.7)'; ctx.lineWidth = 1
        ctx.beginPath(); ctx.rect(bx - w * 0.013, by - h * 0.028, w * 0.026, h * 0.056); ctx.fill(); ctx.stroke()
      }
      ctx.strokeStyle = 'rgba(20,60,180,0.5)'; ctx.lineWidth = 2; ctx.setLineDash([4, 3])
      ctx.beginPath(); ctx.moveTo(capCx, spineY + h * 0.03); ctx.lineTo(capCx, capCy - h * 0.03); ctx.stroke(); ctx.setLineDash([])
      for (let i = 0; i < 2; i++) {
        const tx2 = w * 0.08, ty2 = spineY + (i === 0 ? -h * 0.17 : h * 0.17)
        ctx.fillStyle = 'rgba(5,15,60,0.85)'; ctx.strokeStyle = 'rgba(20,60,180,0.85)'; ctx.lineWidth = 1.5
        ctx.beginPath(); ctx.ellipse(tx2, ty2, w * 0.035, h * 0.065, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke()
        ctx.strokeStyle = 'rgba(15,50,150,0.6)'; ctx.lineWidth = 2
        ctx.beginPath(); ctx.moveTo(tx2 + w * 0.035, ty2); ctx.lineTo(w * 0.14, spineY); ctx.stroke()
      }
      const fcx = w * 0.08, fcy = spineY - h * 0.24
      ctx.fillStyle = 'rgba(4,10,50,0.9)'; ctx.strokeStyle = 'rgba(20,80,220,0.85)'; ctx.lineWidth = 1.5
      ctx.beginPath(); ctx.rect(fcx - w * 0.055, fcy - h * 0.08, w * 0.11, h * 0.16); ctx.fill(); ctx.stroke()
      ctx.strokeStyle = 'rgba(106,173,255,0.7)'; ctx.lineWidth = 1
      ctx.beginPath(); ctx.arc(fcx, fcy - h * 0.08, w * 0.025, Math.PI, 0); ctx.stroke()
      const uplinkA = 0.4 + Math.abs(Math.sin(p * 2.5)) * 0.6
      ctx.strokeStyle = `rgba(26,128,255,${uplinkA})`
      ctx.beginPath(); ctx.moveTo(fcx, fcy - h * 0.08 - h * 0.025); ctx.lineTo(fcx, fcy - h * 0.16); ctx.stroke()
      ctx.strokeStyle = 'rgba(15,50,150,0.55)'; ctx.lineWidth = 2; ctx.setLineDash([3, 4])
      ctx.beginPath(); ctx.moveTo(fcx, fcy + h * 0.08); ctx.lineTo(fcx, spineY - h * 0.012); ctx.stroke(); ctx.setLineDash([])
      const tsx = w * 0.88, tsy = spineY - h * 0.22
      ctx.strokeStyle = 'rgba(106,173,255,0.9)'; ctx.lineWidth = 2
      ctx.beginPath(); ctx.arc(tsx, tsy, w * 0.04, 0.2, Math.PI - 0.2); ctx.stroke()
      ctx.strokeStyle = `rgba(60,140,255,${0.4 + Math.abs(Math.sin(p)) * 0.4})`; ctx.lineWidth = 1
      ctx.beginPath(); ctx.arc(tsx, tsy, w * 0.025, 0, Math.PI * 2); ctx.stroke()
      ctx.strokeStyle = 'rgba(20,60,180,0.75)'; ctx.lineWidth = 2
      ctx.beginPath(); ctx.moveTo(tsx, tsy + w * 0.04); ctx.lineTo(tsx, spineY - h * 0.012); ctx.stroke()
      for (const side of [-1, 1]) for (let pos = 0; pos < 3; pos++) {
        const px = w * (0.38 + pos * 0.09), py = spineY + side * h * 0.26, ph = h * 0.10, pw = w * 0.06
        ctx.fillStyle = 'rgba(3,8,30,0.8)'; ctx.strokeStyle = 'rgba(0,50,139,0.7)'; ctx.lineWidth = 1
        ctx.beginPath(); ctx.rect(px - pw / 2, py - ph / 2, pw, ph); ctx.fill(); ctx.stroke()
        ctx.strokeStyle = 'rgba(5,40,100,0.5)'
        for (let g = 1; g < 4; g++) { ctx.beginPath(); ctx.moveTo(px - pw / 2 + g * pw / 4, py - ph / 2); ctx.lineTo(px - pw / 2 + g * pw / 4, py + ph / 2); ctx.stroke() }
        ctx.strokeStyle = 'rgba(10,50,150,0.55)'; ctx.lineWidth = 1.5
        ctx.beginPath(); ctx.moveTo(px, py + (side > 0 ? -ph / 2 : ph / 2)); ctx.lineTo(px, spineY + side * h * 0.025); ctx.stroke()
      }
      ctx.fillStyle = 'rgba(10,20,80,0.9)'; ctx.strokeStyle = 'rgba(26,128,255,0.9)'; ctx.lineWidth = 1.5
      ctx.beginPath(); ctx.moveTo(w * 0.82, spineY - h * 0.07); ctx.lineTo(w * 0.97, spineY); ctx.lineTo(w * 0.82, spineY + h * 0.07); ctx.closePath(); ctx.fill(); ctx.stroke()
      const muzzleA = Math.max(0, Math.sin(p * 0.22)) * 0.7
      if (muzzleA > 0.05) {
        const mg = ctx.createRadialGradient(w * 0.97, spineY, 0, w * 0.97, spineY, w * 0.08)
        mg.addColorStop(0, `rgba(200,230,255,${muzzleA})`); mg.addColorStop(0.4, `rgba(26,128,255,${muzzleA * 0.5})`); mg.addColorStop(1, 'rgba(0,80,255,0)')
        ctx.fillStyle = mg; ctx.beginPath(); ctx.arc(w * 0.97, spineY, w * 0.08, 0, Math.PI * 2); ctx.fill()
      }
      if (hl) drawHighlight(...hl, p * 2.2)
      ctx.strokeStyle = 'rgba(0,50,139,0.4)'; ctx.lineWidth = 1; ctx.setLineDash([2, 3])
      ctx.beginPath(); ctx.moveTo(w * 0.18, h * 0.88); ctx.lineTo(w * 0.82, h * 0.88); ctx.stroke(); ctx.setLineDash([])
      ctx.fillStyle = 'rgba(94,130,170,0.85)'; ctx.font = `${Math.max(9, h * 0.028)}px Cascadia Mono, Consolas, monospace`; ctx.textAlign = 'center'
      ctx.fillText('◄────── RAIL ASSEMBLY  4,200 m ──────►', cx, h * 0.91); ctx.textAlign = 'left'
      ctx.fillStyle = 'rgba(0,50,139,0.12)'; ctx.font = `bold ${h * 0.09}px Cascadia Mono, Consolas, monospace`; ctx.textAlign = 'center'
      ctx.fillText('TS // SCI // COMPARTMENTED', cx, cy + h * 0.04); ctx.textAlign = 'left'
    }

    const drawTarget = (dt) => {
      const cv = targetCanvasRef.current
      if (!cv) return
      const ctx = cv.getContext('2d')
      const w = cv.clientWidth, h = cv.clientHeight
      tphaseRef.current += dt * 0.0006
      const ph   = tphaseRef.current
      const hasT = targetIdxRef.current >= 0

      // background
      ctx.fillStyle = 'rgba(1,2,8,0.35)'
      ctx.fillRect(0, 0, w, h)

      // ── crosshair lines (always, proportional gap around centre) ─────────
      const gap = Math.min(w, h) * 0.18
      ctx.strokeStyle = 'rgba(255,60,60,0.38)'
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(w / 2, 0);             ctx.lineTo(w / 2, h / 2 - gap)
      ctx.moveTo(w / 2, h / 2 + gap);   ctx.lineTo(w / 2, h)
      ctx.moveTo(0,     h / 2);          ctx.lineTo(w / 2 - gap, h / 2)
      ctx.moveTo(w / 2 + gap, h / 2);   ctx.lineTo(w,     h / 2)
      ctx.stroke()

      // ── bracket corners (always, proportional) ────────────────────────────
      const bs   = gap
      const bLen = bs * 0.42
      ctx.strokeStyle = 'rgba(255,36,0,0.5)'
      ctx.lineWidth   = 1
      const bracket = (cx, cy, dx, dy) => {
        ctx.beginPath()
        ctx.moveTo(cx + dx * bLen, cy); ctx.lineTo(cx, cy); ctx.lineTo(cx, cy + dy * bLen)
        ctx.stroke()
      }
      bracket(w / 2 - bs, h / 2 - bs, +1, +1)
      bracket(w / 2 + bs, h / 2 - bs, -1, +1)
      bracket(w / 2 - bs, h / 2 + bs, +1, -1)
      bracket(w / 2 + bs, h / 2 + bs, -1, -1)

      // ── corner labels (always, pinned to canvas edges) ────────────────────
      const fs  = Math.max(7, Math.min(10, Math.round(w * 0.044)))
      const pad = 7
      ctx.font      = `${fs}px "Cascadia Mono", Consolas, monospace`
      ctx.fillStyle = 'rgba(106,173,255,0.82)'

      ctx.textBaseline = 'top';    ctx.textAlign = 'left';  ctx.fillText('TGT // ASSET-X9', pad, pad)
      ctx.textBaseline = 'top';    ctx.textAlign = 'right'; ctx.fillText(`LOCK ${hasT ? '98.7' : '0.0'}%`, w - pad, pad)
      ctx.textBaseline = 'bottom'; ctx.textAlign = 'left';  ctx.fillText('RANGE 1,402 km', pad, h - pad)

      // bottom-right: show TTI only when target acquired
      if (hasT) {
        ctx.textBaseline = 'bottom'; ctx.textAlign = 'right'
        ctx.fillStyle = 'rgba(106,173,255,0.82)'
        ctx.fillText('TTI 00:01:47', w - pad, h - pad)
        ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic'
      }

      // centre: blink "AWAITING TARGET" in red when no target
      if (!hasT && Math.floor(Date.now() / 600) % 2 === 0) {
        ctx.font      = `${fs}px "Cascadia Mono", Consolas, monospace`
        ctx.fillStyle = 'rgba(106,173,255,0.65)'
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
        ctx.fillText('AWAITING TARGET', w / 2, h / 2)
        ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic'
      }

      // ── target-specific visuals ───────────────────────────────────────────
      if (hasT) {
        // horizon arc
        const hcx = w / 2, hcy = h * 1.65, R = h * 1.4
        ctx.strokeStyle = 'rgba(20,80,220,0.7)'; ctx.lineWidth = 1.4
        ctx.beginPath(); ctx.arc(hcx, hcy, R, Math.PI, 0, false); ctx.stroke()

        // gradient fill
        const grad = ctx.createLinearGradient(0, h * 0.55, 0, h)
        grad.addColorStop(0, 'rgba(0,80,255,0.0)'); grad.addColorStop(1, 'rgba(0,80,255,0.12)')
        ctx.fillStyle = grad; ctx.fillRect(0, h * 0.55, w, h * 0.45)

        // diagonal scan lines
        ctx.strokeStyle = 'rgba(0,50,180,0.35)'; ctx.lineWidth = 1
        for (let i = -3; i <= 3; i++) {
          const offset = ((i * 60 + ph * 30) % w + w) % w
          ctx.beginPath(); ctx.moveTo(offset, h * 0.6); ctx.lineTo(offset - 30, h); ctx.stroke()
        }

        // diamond marker (proportional to canvas size)
        const dm = Math.min(w, h) * 0.07
        const tx = w / 2 + Math.sin(ph * 1.7) * 8
        const ty = h / 2 + Math.cos(ph * 1.3) * 4
        ctx.strokeStyle = 'rgba(255,36,0,0.95)'; ctx.lineWidth = 1.5
        ctx.beginPath()
        ctx.moveTo(tx, ty - dm); ctx.lineTo(tx + dm, ty)
        ctx.lineTo(tx, ty + dm); ctx.lineTo(tx - dm, ty)
        ctx.closePath(); ctx.stroke()
        ctx.fillStyle = 'rgba(255,36,0,0.4)'; ctx.fill()

        // leader line
        ctx.strokeStyle = 'rgba(106,173,255,0.7)'
        ctx.beginPath(); ctx.moveTo(tx, ty); ctx.lineTo(tx + dm * 1.9, ty - dm * 1.3); ctx.stroke()
      }
    }

    // ── Tick ─────────────────────────────────────────────────────────────
    const tick = (now) => {
      if (lastTimeRef.current === null) lastTimeRef.current = now
      const dt = now - lastTimeRef.current
      lastTimeRef.current = now

      if (clockRef.current) clockRef.current.textContent = fmtClock(Date.now() - t0)
      if (utcRef.current)   utcRef.current.textContent   = fmtUTC(new Date())

      updateGeodetic(dt / 1000)
      updateSpacetime(now)
      updateCausality(now)
      updatePower(now)
      updateTargeting(now)
      drawRadar(dt)
      drawRailgun(dt)
      drawTarget(dt)

      grbTimerRef.current += dt
      if (grbTimerRef.current > 250) {
        grbPctRef.current += rand(0.4, 1.1)
        if (grbPctRef.current >= 100) { grbPctRef.current = 0; addLog('CRIT', 'GRB EMITTER // FIRING SOLUTION DISCHARGED') }
        if (grbBarRef.current) grbBarRef.current.style.width = `${grbPctRef.current.toFixed(1)}%`
        grbTimerRef.current = 0
      }

      logTimerRef.current += dt
      if (logTimerRef.current > 6000 + Math.random() * 4000) {
        const [lvl, msg] = LOG_MESSAGES[Math.floor(Math.random() * LOG_MESSAGES.length)]
        addLog(lvl, msg)
        logTimerRef.current = 0
      }

      rafRef.current = requestAnimationFrame(tick)
    }

    rafRef.current = requestAnimationFrame(tick)

    return () => {
      cancelAnimationFrame(rafRef.current)
      window.removeEventListener('resize', fitAll)
      if (cdTimerRef.current) clearTimeout(cdTimerRef.current)
    }
  }, [addLog])

  // ── JSX ───────────────────────────────────────────────────────────────────
  const hasTarget     = targetIdx >= 0
  const targetName    = targetIdx === SUN_IDX ? SUN.name
                      : targetIdx >= 0        ? PLANETS[targetIdx].name
                      : 'None'
  const lowPower      = reactorPlasma < 25
  const showArm       = launchPhase === 'idle'
  const showDisarm    = launchPhase === 'verifying' || launchPhase === 'armed' || launchPhase === 'countdown'
  const showLaunch    = launchPhase === 'armed' || launchPhase === 'fired'
  const launchFiring  = launchPhase === 'fired'
  const showCodeVerify= launchPhase === 'verifying' || launchPhase === 'armed' || launchPhase === 'countdown' || launchPhase === 'fired'

  return (
    <>
      <HudHeader
        onLogout={onLogout}
        center={
          <span className={`status-pill mail-pill${unreadCount > 0 ? ' mail-pill--unread' : ''}`} onClick={onMailOpen}>
            {unreadCount > 0 && <span className="mail-unread-dot" />}
            ✉ IMPERIAL MESSAGING SERVICE // UNREAD: {unreadCount}
          </span>
        }
        right={<><span className="label">MISSION CLOCK T+</span><span className="mono big" ref={clockRef}>000:00:00:00</span></>}
      />

      <main className="grid">

        {/* GEODETIC TELEMETRY */}
        <section className={`panel${lit('panel-geodetic')}${lowPower ? ' panel--low-power' : ''}`} id="panel-geodetic">
          <header className="panel-header">
            <span className="bullet" /><h2>GEODETIC TELEMETRY</h2>
            <span className="panel-id">PNL-001 / WGS-84</span>
          </header>
          <div className="panel-body">
            <div className="kv-grid">
              <div className="kv"><span className="k">LATITUDE φ</span><span className="v" ref={latRef} /></div>
              <div className="kv"><span className="k">LONGITUDE λ</span><span className="v" ref={lonRef} /></div>
              <div className="kv"><span className="k">ALTITUDE h</span><span className="v" ref={altRef} /></div>
              <div className="kv"><span className="k">VELOCITY ‖v‖</span><span className="v" ref={velRef} /></div>
              <div className="kv"><span className="k">INCLINATION i</span><span className="v">51.6394°</span></div>
              <div className="kv"><span className="k">RAAN Ω</span><span className="v" ref={raanRef} /></div>
              <div className="kv"><span className="k">ARG.PERIGEE ω</span><span className="v" ref={argpRef} /></div>
              <div className="kv"><span className="k">TRUE ANOMALY ν</span><span className="v" ref={nuRef} /></div>
            </div>
            <div className="subline">
              <span>FRAME-DRAGGING ω<sub>LT</sub>:</span>
              <span className="mono v" ref={ltDragRef} />
            </div>
          </div>
          {lowPower && <div className="low-power-overlay" />}
        </section>

        {/* MINKOWSKI RADAR / INSTALLATION VIEW */}
        <section className={`panel wide tall${lit('panel-radar')}${lowPower ? ' panel--low-power' : ''}`} id="panel-radar">
          <header className="panel-header">
            <span className="bullet pulse" />
            <h2>{radarView === 'radar' ? 'MINKOWSKI THREAT TRACE // SECTOR Δ' : 'HMSS "HER ANNUNCIATOR" // INSTALLATION SCHEMATIC'}</h2>
            <span className="panel-id">{radarView === 'radar' ? 'PNL-002 / LIGHT-CONE PROJECTION' : 'PNL-002 / STRUCTURAL DIAGNOSTIC'}</span>
            <div className="panel-toggle">
              <button className={`toggle-btn${radarView === 'radar' ? ' active' : ''}`} onClick={() => setRadarView('radar')}>THREAT TRACE</button>
              <button className={`toggle-btn${radarView === 'install' ? ' active' : ''}`} onClick={() => setRadarView('install')}>INSTALLATION</button>
            </div>
          </header>
          <div className="panel-body radar-body">
            <div id="radar-canvas-wrap" className={radarView !== 'radar' ? 'hidden' : ''}>
              <canvas id="radar-canvas" ref={radarCanvasRef} />
              <div className="radar-readout">
                <div><span className="k">CONTACTS:</span><span className="v" ref={contactCountRef} /></div>
                <div><span className="k">FUTURE LIGHT CONE:</span><span className="v ok">NOMINAL</span></div>
                <div><span className="k">PAST LIGHT CONE:</span><span className="v ok">CAUSAL</span></div>
                <div><span className="k">SWEEP MODE:</span><span className="v">WORLDLINE / τ</span></div>
              </div>
            </div>
            <div className={`railgun-view${radarView === 'install' ? ' visible' : ''}`} id="railgun-view">
              <canvas id="railgun-canvas" ref={railgunCanvasRef} />
              <div className="railgun-section-labels">
                {Object.entries(SECTION_INFO).map(([key, sec]) => (
                  <div
                    key={key}
                    className={`rg-label${activeSection === key ? ' active' : ''}`}
                    style={sec.labelPos}
                    onClick={() => handleSectionClick(key)}
                  >{sec.name}</div>
                ))}
              </div>
              <div className="railgun-section-info">
                {activeSection
                  ? <><span className="si-name">{SECTION_INFO[activeSection].name}</span><span className="si-stats">{SECTION_INFO[activeSection].stats}</span></>
                  : <><span className="si-name">SELECT A SECTION</span><span className="si-stats">Click any labeled subsystem to view diagnostic readout.</span></>
                }
              </div>
            </div>
          </div>
          {lowPower && <div className="low-power-overlay" />}
        </section>

        {/* PHYSICS PACKAGE LOADOUT */}
        <section className={`panel${lit('panel-loadout')}${lowPower ? ' panel--low-power' : ''}`} id="panel-loadout">
          <header className="panel-header">
            <span className="bullet" /><h2>PHYSICS PACKAGE LOADOUT</h2>
            <span className="panel-id">PNL-003 / ORDNANCE</span>
          </header>
          <div className="panel-body">
            <div className="weapon" data-weapon="kn">
              <div className="weapon-row"><span className="weapon-name">KERR–NEWMAN WARHEAD ×4</span><span className="weapon-state ready">READY</span></div>
              <div className="weapon-meta">a = 0.998 M ⋅ Q = 0.043 M</div>
              <div className="bar"><div className="bar-fill" style={{ width: '96%' }} /></div>
            </div>

            <div className="weapon" data-weapon="exotic">
              <div className="weapon-row"><span className="weapon-name">EXOTIC-MATTER LANCE (ρ &lt; 0)</span><span className="weapon-state ready">READY</span></div>
              <div className="weapon-meta">CASIMIR FLUX 4.7 × 10⁻⁹ N·m⁻²</div>
              <div className="bar"><div className="bar-fill" style={{ width: '78%' }} /></div>
            </div>
            <div className="weapon" data-weapon="grb">
              <div className="weapon-row"><span className="weapon-name">COLLIMATED GRB EMITTER</span><span className="weapon-state charging">CHARGING</span></div>
              <div className="weapon-meta">E<sub>iso</sub> ≈ 10⁵² erg ⋅ θ<sub>j</sub> = 0.04 rad</div>
              <div className="bar"><div className="bar-fill charging-bar" ref={grbBarRef} style={{ width: '34%' }} /></div>
            </div>
            <div className="weapon" data-weapon="rkv">
              <div className="weapon-row"><span className="weapon-name">RELATIVISTIC KINETIC SLUG ×12</span><span className="weapon-state ready">READY</span></div>
              <div className="weapon-meta">γ = 4.2 ⋅ M<sub>0</sub> = 1.4 t</div>
              <div className="bar"><div className="bar-fill" style={{ width: '100%' }} /></div>
            </div>
          </div>
          {lowPower && <div className="low-power-overlay" />}
        </section>

        {/* SPACETIME DIAGNOSTICS */}
        <section className={`panel${lit('panel-spacetime')}${lowPower ? ' panel--low-power' : ''}`} id="panel-spacetime">
          <header className="panel-header">
            <span className="bullet" /><h2>LOCAL SPACETIME DIAGNOSTICS</h2>
            <span className="panel-id">PNL-004 / METRIC TENSOR</span>
          </header>
          <div className="panel-body">
            <div className="metric"><div className="metric-label">METRIC SIGNATURE</div><div className="metric-value mono">(−,+,+,+) // LORENTZIAN</div></div>
            <div className="metric"><div className="metric-label">RICCI SCALAR R</div><div className="metric-value mono" ref={ricciRef} /></div>
            <div className="metric"><div className="metric-label">KRETSCHMANN K</div><div className="metric-value mono" ref={kretschRef} /></div>
            <div className="metric"><div className="metric-label">STRESS–ENERGY T<sub>μν</sub></div><div className="metric-value mono">DOMINANT ENERGY: <span className="ok">SATISFIED</span></div></div>
            <div className="metric"><div className="metric-label">ADM MASS</div><div className="metric-value mono" ref={admRef} /></div>
            <div className="metric tensor-block">
              <div className="metric-label">g<sub>μν</sub> (NORMALIZED)</div>
              <pre className="tensor mono" ref={tensorRef} />
            </div>
          </div>
          {lowPower && <div className="low-power-overlay" />}
        </section>

        {/* CAUSALITY / CHRONOLOGY MONITOR */}
        <section className={`panel${lit('panel-causality')}${lowPower ? ' panel--low-power' : ''}`} id="panel-causality">
          <header className="panel-header">
            <span className="bullet pulse" /><h2>CHRONOLOGY PROTECTION MONITOR</h2>
            <span className="panel-id">PNL-005 / HAWKING CONJECTURE</span>
          </header>
          <div className="panel-body">
            <div className="chrono-grid">
              <div className="chrono-cell">
                <div className="chrono-label">CTC DETECTION</div>
                <div className="chrono-state ok">NEGATIVE</div>
                <div className="chrono-sub">δτ ∮ &lt; 10⁻⁴² s</div>
              </div>
              <div className="chrono-cell">
                <div className="chrono-label">LIGHT CONE TILT</div>
                <div className="chrono-state ok" ref={coneStateRef} />
                <div className="chrono-sub">WITHIN TOLERANCE</div>
              </div>
              <div className="chrono-cell">
                <div className="chrono-label">CAUCHY HORIZON</div>
                <div className="chrono-state ok">STABLE</div>
                <div className="chrono-sub">d = 4.21 × 10⁸ m</div>
              </div>
              <div className="chrono-cell">
                <div className="chrono-label">ERGOSPHERE BREACH</div>
                <div className="chrono-state ok">CLEAR</div>
                <div className="chrono-sub">r &gt; r<sub>+</sub></div>
              </div>
              <div className="chrono-cell">
                <div className="chrono-label">TACHYONIC FLUX</div>
                <div className="chrono-state warn" ref={tachyonRef} />
                <div className="chrono-sub">m² &lt; 0 SIGNATURE</div>
              </div>
              <div className="chrono-cell">
                <div className="chrono-label">QUANTUM DECOHERENCE</div>
                <div className="chrono-state ok" ref={decohereRef} />
                <div className="chrono-sub">ENVIRONMENT COUPLED</div>
              </div>
            </div>
          </div>
          {lowPower && <div className="low-power-overlay" />}
        </section>

        {/* TARGETING SOLUTION */}
        <section
          className={`panel wide${lit('panel-target')}${lowPower ? ' panel--low-power' : ' panel--clickable'}`}
          id="panel-target"
          onClick={!lowPower ? onTargeting : undefined}
          title={!lowPower ? 'Open Targeting System' : undefined}
        >
          <header className="panel-header">
            <span className="bullet pulse" /><h2>GEODESIC TARGETING SOLUTION</h2>
            <span className="panel-id">PNL-006 / SCHWARZSCHILD-CORRECTED</span>
          </header>
          <div className="panel-body target-body">
            <div className="target-content">
              <div className="target-vis">
                <canvas id="target-canvas" ref={targetCanvasRef} />
              </div>
              <div className="target-data">
                <div className="td-row"><span>DESIGNATION</span><span className="mono">{targetName}</span></div>
                <div className="td-row"><span>ECEF (X, Y, Z)</span><span className="mono" ref={ecefRef}>{!hasTarget ? 'N/A' : ''}</span></div>
                <div className="td-row"><span>GEODESIC TYPE</span><span className="mono">{hasTarget ? 'TIMELIKE / BOUND' : 'N/A'}</span></div>
                <div className="td-row"><span>IMPACT PARAMETER b</span><span className="mono">{hasTarget ? <>3.41 r<sub>s</sub></> : 'N/A'}</span></div>
                <div className="td-row"><span>SHAPIRO DELAY Δt<sub>s</sub></span><span className="mono" ref={shapiroRef}>{!hasTarget ? 'N/A' : ''}</span></div>
                <div className="td-row"><span>LIGHT-TIME LAG</span><span className="mono" ref={ltlagRef}>{!hasTarget ? 'N/A' : ''}</span></div>
                <div className="td-row"><span>FIRING SOLUTION</span><span className={`mono${hasTarget ? ' ok' : ''}`}>{hasTarget ? 'CONVERGED' : 'N/A'}</span></div>
                <div className="td-row"><span>P<sub>K</sub> (KILL PROB.)</span><span className={`mono${hasTarget ? ' ok' : ''}`}>{hasTarget ? '0.974' : 'N/A'}</span></div>
                <div className="panel-enter-link-wrap">
                  <div className="panel-enter-link">ENTER TARGETING CONTROL</div>
                </div>
              </div>
            </div>
          </div>
          {lowPower && <div className="low-power-overlay" />}
        </section>

        {/* POWER / REACTOR */}
        <section className={`panel panel--clickable${lit('panel-power')}`} id="panel-power" onClick={onReactor} title="Open Reactor Control">
          <header className="panel-header">
            <span className={`bullet${lowPower ? ' bullet--alert' : ''}`} /><h2>REACTOR // PHASE-SPACE</h2>
            <span className="panel-id">PNL-007 / D-³He FUSOR + ZPE TAP</span>
          </header>
          <div className="panel-body">
            <div className="power-grid">
              <div className="power-cell">
                <div className="pc-label">CORE FLUX</div>
                <div className="pc-value mono" ref={coreFluxRef} />
                <div className="bar"><div className="bar-fill" ref={coreBarRef} /></div>
              </div>
              <div className="power-cell">
                <div className="pc-label">CAPACITOR BANK</div>
                <div className="pc-value mono" ref={capBankRef} />
                <div className="bar"><div className="bar-fill" ref={capBarRef} /></div>
              </div>
              <div className="power-cell">
                <div className="pc-label">ZERO-POINT TAP</div>
                <div className="pc-value mono" ref={zpeRef} />
                <div className="bar"><div className="bar-fill" ref={zpeBarRef} /></div>
              </div>
              <div className="power-cell">
                <div className="pc-label">RADIATOR ΔT</div>
                <div className="pc-value mono" ref={radiatorRef} />
                <div className="bar"><div className="bar-fill warn" style={{ width: '71%' }} /></div>
              </div>
            </div>
            <div className="panel-enter-link-wrap">
              <div className="panel-enter-link">ENTER D-³He FUSOR MANAGEMENT</div>
            </div>
          </div>
        </section>

        {/* BOTTOM ROW */}
        <div className="bottom-row">

          {/* EVENT LOG */}
          <section className={`panel${lit('panel-log')}${lowPower ? ' panel--low-power' : ''}`} id="panel-log">
            <header className="panel-header">
              <span className="bullet pulse" /><h2>EVENT LOG // T-STREAM</h2>
              <span className="panel-id">PNL-008 / RING BUFFER</span>
            </header>
            <div className="panel-body log-body">
              <ul id="log-list">
                {logEntries.map((e, i) => (
                  <li key={i} className="fresh">
                    <span className="ts">{e.t}</span>
                    <span className={`lvl ${e.level.toLowerCase()}`}>{e.level}</span>
                    <span className="msg">{e.msg}</span>
                  </li>
                ))}
              </ul>
            </div>
            {lowPower && <div className="low-power-overlay" />}
          </section>

          {/* LAUNCH CONTROL */}
          <section className={`panel${showCodeVerify ? ' elevated' : ''}${lit('panel-launch')}${lowPower ? ' panel--low-power' : ''}`} id="panel-launch">
            <header className="panel-header">
              <span className="bullet pulse" /><h2>PHYSICS PACKAGE LAUNCH CONTROL</h2>
              <span className="panel-id">PNL-009 / AUTHORIZATION REQUIRED</span>
            </header>
            <div className="panel-body launch-body">

              <div className="launch-left">
                <div className="launch-label">SELECT ORDNANCE</div>
                <ul className="weapon-select">
                  {[
                    { key: 'kn',     label: 'KERR–NEWMAN WARHEAD',     st: 'ready',    stLabel: 'RDY' },
                    { key: 'exotic', label: 'EXOTIC-MATTER LANCE',      st: 'ready',    stLabel: 'RDY' },
                    { key: 'grb',    label: 'COLLIMATED GRB EMITTER',   st: 'charging', stLabel: 'CHG' },
                    { key: 'rkv',    label: 'RELATIVISTIC KINETIC SLUG',st: 'ready',    stLabel: 'RDY' },
                  ].map(({ key, label, st, stLabel, disabled }) => (
                    <li
                      key={key}
                      className={`ws-item${selectedPkg === key ? ' active' : ''}${disabled ? ' disabled' : ''}`}
                      onClick={() => !disabled && handleSelectPkg(key)}
                    >
                      <span className="ws-dot" />
                      <span className="ws-name">{label}</span>
                      <span className={`ws-state ${st}`}>{stLabel}</span>
                    </li>
                  ))}
                </ul>
                <div className="auth-row">
                  <span className="auth-label">AUTH KEY A</span><span className="auth-pip active" />
                  <span className="auth-label">AUTH KEY B</span><span className="auth-pip active" />
                  <span className="auth-label">AUTH KEY C</span><span className={`auth-pip${authCActive ? ' active' : ''}`} />
                </div>
              </div>

              <div className="launch-right">
                <div className="launch-pkg-name">{PKG_NAMES[selectedPkg]}</div>
                <div className={launchStatus.cls}>{launchStatus.text}</div>
                {showArm && (
                  <button className="arm-btn arm-btn--full" onClick={handleArm}>ARM</button>
                )}
                {showDisarm && (
                  <button className="disarm-btn disarm-btn--full" onClick={handleArm}>DISARM</button>
                )}
                <div className="launch-countdown">{launchCdText}</div>
              </div>

            </div>
          {lowPower && <div className="low-power-overlay" />}
          </section>

        </div>
      </main>

      {showCodeVerify && <div className="code-verify-dim" />}
      {showCodeVerify && (
        <LaunchCodeVerifier
          onComplete={handleVerifyComplete}
          onTick={playTick}
          onFire={handleFire}
          launchPhase={launchPhase}
          launchLabel={launchLabel}
          launchFiring={launchFiring}
          launchCdText={launchCdText}
          cdVisible={cdVisible}
        />
      )}


      <HudFooter>
        <span>HMSS / FCS v6.2.41 / GR-CORRECTED FIRE-CONTROL</span>
        <span className="sep">│</span>
        <span>UPLINK: <em className="ok" id="uplink">SECURE 256-QKD</em></span>
        <span className="sep">│</span>
        <span>OPERATOR: <em>HIH V. ASTRAIA // CLR-Ω</em></span>
        <span className="sep">│</span>
        <span ref={utcRef}>UTC 0000-00-00 00:00:00.000</span>
      </HudFooter>
    </>
  )
}
