import { useState, useEffect, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { LOG_MESSAGES, PKG_NAMES, SECTION_INFO } from '../../lib/constants'
import { PLANETS, SUN, SUN_IDX, getTargetName } from '../../lib/planetData'
import LaunchCodeVerifier from './LaunchCodeVerifier'
import HudHeader from '../../components/HudHeader'
import HudFooter from '../../components/HudFooter'
import { setFlag } from '../../lib/store'
import XBandRadioPanel from './XBandRadioPanel'

// ── Glitch overlay (under attack) ────────────────────────────────────────────
function GlitchOverlay() {
  const canvasRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    let rafId
    let blocks = []
    let lastSpawn = 0

    const resize = () => {
      canvas.width  = canvas.offsetWidth
      canvas.height = canvas.offsetHeight
    }
    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(canvas)

    let hadBlocks = false
    const loop = (ts) => {
      const w = canvas.width, h = canvas.height

      // spawn blocks at irregular intervals
      if (ts - lastSpawn > 60 + Math.random() * 220) {
        lastSpawn = ts
        const count = Math.floor(1 + Math.random() * 4)
        for (let n = 0; n < count; n++) {
          const isSlice = Math.random() < 0.25
          blocks.push({
            x:       isSlice ? 0 : Math.random() * w,
            y:       Math.random() * h,
            w:       isSlice ? w : 8 + Math.random() * 60,
            h:       isSlice ? 1 + Math.random() * 5 : 3 + Math.random() * 18,
            dx:      isSlice ? (Math.random() - 0.5) * 24 : 0,
            life:    50 + Math.random() * 130,
            born:    ts,
            // mostly cyan/blue with occasional white or red tint
            r: Math.random() < 0.15 ? 255 : Math.random() < 0.5 ? 80  : 160,
            g: Math.random() < 0.15 ? 255 : 200,
            b: 255,
          })
        }
      }

      // draw and expire blocks
      blocks = blocks.filter(b => ts - b.born < b.life)
      // Only touch the full-screen canvas when there's something to draw, or
      // there was last frame (one final clear to erase the expired blocks).
      if (blocks.length || hadBlocks) {
        ctx.clearRect(0, 0, w, h)
        blocks.forEach(b => {
          const age   = (ts - b.born) / b.life
          const alpha = Math.sin(age * Math.PI) * 0.18   // fade in then out
          ctx.fillStyle = `rgba(${b.r},${b.g},${b.b},${alpha})`
          ctx.fillRect(b.x + b.dx * age, b.y, b.w, b.h)
        })
      }
      hadBlocks = blocks.length > 0

      rafId = requestAnimationFrame(loop)
    }

    rafId = requestAnimationFrame(loop)
    return () => { cancelAnimationFrame(rafId); ro.disconnect() }
  }, [])

  return <canvas ref={canvasRef} className="glitch-overlay-canvas" />
}

// ── Light Cone Tooltip Canvas ────────────────────────────────────────────────
const LC_TILT = Math.PI / 4          // 45° tilt of cone axis toward +X
const LC_cT   = Math.cos(LC_TILT), LC_sT = Math.sin(LC_TILT)
const LC_N    = 32, LC_RINGS = 5, LC_MERIDIANS = 12, LC_H = 0.40

function lcProj(x0, y0, z0, cx, cy, scale, ry) {
  // tilt the cone axis 45° (rotate around Z)
  const x = x0 * LC_cT - y0 * LC_sT
  const y = x0 * LC_sT + y0 * LC_cT
  const z = z0
  // slow Y-axis animation rotation
  const cosY = Math.cos(ry), sinY = Math.sin(ry)
  const x1 =  x * cosY + z * sinY
  const z1 = -x * sinY + z * cosY
  const d = 3.2, pz = d + z1
  return { x: (x1 / pz) * scale + cx, y: (y / pz) * scale + cy, z: z1 }
}

function lcRing(h, cx, cy, scale, ry) {
  const r = Math.abs(h)
  return Array.from({ length: LC_N + 1 }, (_, i) => {
    const a = (i / LC_N) * Math.PI * 2
    return lcProj(r * Math.cos(a), h, r * Math.sin(a), cx, cy, scale, ry)
  })
}

function LightConeCanvas({ underAttack }) {
  const cvRef  = useRef(null)
  const atkRef = useRef(underAttack)
  useEffect(() => { atkRef.current = underAttack }, [underAttack])

  useEffect(() => {
    const cv = cvRef.current
    if (!cv) return
    const dpr = window.devicePixelRatio || 1
    const ctx = cv.getContext('2d')
    let w = 0, h = 0
    const fit = () => {
      // clientWidth/Height (unscaled) to match the draw loop's coordinate space —
      // getBoundingClientRect would return transform-scaled size and offset the render.
      w = cv.clientWidth; h = cv.clientHeight
      cv.width  = w * dpr
      cv.height = h * dpr
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }
    fit()
    // ResizeObserver re-fits when the canvas box changes (resize, scaler scale,
    // or the radio online/offline transition that collapses/expands the panel).
    const ro = new ResizeObserver(fit)
    ro.observe(cv)
    let rafId, ry = 0

    const polyline = (ctx, pts) => {
      ctx.beginPath()
      pts.forEach((p, i) => i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y))
      ctx.stroke()
    }
    const depth = pt => Math.max(0, Math.min(1, (pt.z + 1.5) / 3))

    const loop = () => {
      ry += 0.006
      const cx = w * 0.5, cy = h * 0.5
      const scale = Math.min(w, h) * 1.55
      ctx.clearRect(0, 0, w, h)

      const atk = atkRef.current

      // colour palettes
      const planeCol  = atk ? 'rgba(210,50,50,0.22)'   : 'rgba(0,190,210,0.22)'
      const axisCol   = atk ? 'rgba(255,140,140,0.45)'  : 'rgba(160,235,255,0.45)'
      const futRing   = atk
        ? d => `rgba(255,70,70,${(0.18 + d * 0.60).toFixed(2)})`
        : d => `rgba(80,210,255,${(0.18 + d * 0.60).toFixed(2)})`
      const futMer    = atk
        ? d => `rgba(255,100,100,${(0.22 + d * 0.65).toFixed(2)})`
        : d => `rgba(110,220,255,${(0.22 + d * 0.65).toFixed(2)})`
      const pastRing  = atk
        ? d => `rgba(200,40,40,${(0.14 + d * 0.48).toFixed(2)})`
        : d => `rgba(50,160,220,${(0.14 + d * 0.48).toFixed(2)})`
      const pastMer   = atk
        ? d => `rgba(220,55,55,${(0.16 + d * 0.52).toFixed(2)})`
        : d => `rgba(70,180,230,${(0.16 + d * 0.52).toFixed(2)})`

      // ── Hypersurface plane ──────────────────────────────────────────────
      const pR = LC_H * 1.15, pN = 4
      ctx.strokeStyle = planeCol
      ctx.lineWidth = 0.8
      // rim circle
      polyline(ctx, Array.from({ length: LC_N + 1 }, (_, i) => {
        const a = (i / LC_N) * Math.PI * 2
        return lcProj(pR * Math.cos(a), 0, pR * Math.sin(a), cx, cy, scale, ry)
      }))
      // cross-hair lines on the plane
      for (let i = 0; i < pN; i++) {
        const a = (i / pN) * Math.PI
        const A = lcProj(pR * Math.cos(a), 0, pR * Math.sin(a), cx, cy, scale, ry)
        const B = lcProj(-pR * Math.cos(a), 0, -pR * Math.sin(a), cx, cy, scale, ry)
        polyline(ctx, [A, B])
      }

      const apex = lcProj(0, 0, 0, cx, cy, scale, ry)

      // ── Cone helper: rings + meridians ──────────────────────────────────
      const drawCone = (sign, ringColor, merColor) => {
        for (let ri = 1; ri <= LC_RINGS; ri++) {
          const hv = sign * (ri / LC_RINGS) * LC_H
          const pts = lcRing(hv, cx, cy, scale, ry)
          const d = depth(pts[0])
          ctx.strokeStyle = ringColor(d)
          ctx.lineWidth = 0.85
          polyline(ctx, pts)
        }
        for (let mi = 0; mi < LC_MERIDIANS; mi++) {
          const a = (mi / LC_MERIDIANS) * Math.PI * 2
          const rim = lcProj(LC_H * Math.cos(a), sign * LC_H, LC_H * Math.sin(a), cx, cy, scale, ry)
          const d = depth(rim)
          ctx.strokeStyle = merColor(d)
          ctx.lineWidth = 1.0
          ctx.beginPath(); ctx.moveTo(apex.x, apex.y); ctx.lineTo(rim.x, rim.y); ctx.stroke()
        }
      }

      // Future cone — brighter
      drawCone(+1, futRing, futMer)
      // Past cone — slightly dimmer
      drawCone(-1, pastRing, pastMer)

      // ── Time axis (dashed) ──────────────────────────────────────────────
      const top = lcProj(0,  LC_H * 1.3, 0, cx, cy, scale, ry)
      const bot = lcProj(0, -LC_H * 1.3, 0, cx, cy, scale, ry)
      ctx.strokeStyle = axisCol
      ctx.lineWidth = 0.9
      ctx.setLineDash([4, 4])
      ctx.beginPath(); ctx.moveTo(top.x, top.y); ctx.lineTo(bot.x, bot.y); ctx.stroke()
      ctx.setLineDash([])

      rafId = requestAnimationFrame(loop)
    }
    rafId = requestAnimationFrame(loop)
    return () => { cancelAnimationFrame(rafId); ro.disconnect() }
  }, [])

  return <canvas ref={cvRef} style={{ width: '100%', height: '100%', display: 'block' }} />
}

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
  // Use clientWidth/Height (unscaled layout size), NOT getBoundingClientRect
  // (which returns transform-scaled dimensions). The draw loops work in
  // clientWidth/Height units, so the backing store must match or the drawing
  // ends up off-centre/clipped when the panel is scaled down on small displays.
  const dpr = window.devicePixelRatio || 1
  cv.width  = cv.clientWidth  * dpr
  cv.height = cv.clientHeight * dpr
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
export default function MainPanel({ onLogout, onLaunchComplete, onPower, onTargeting, onAdjustAntenna, antennaAligned = false, reactorPlasma = 75, bhOutput = 0, bhYield = 0, targetIdx = -1, countdownSeconds = 10, unreadCount = 0, onMailOpen, underAttack = false, onRadioFreq, radioFreq = 8.0 }) {

  // ── Panel init animation ──────────────────────────────────────────────────
  const [litPanels, setLitPanels] = useState(new Set())

  useEffect(() => {
    const order = [
      'panel-geodetic', 'panel-radar',    'panel-xband',
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
  const [threatHovered,   setThreatHovered]   = useState(false)
  const [threatScreenPos, setThreatScreenPos] = useState(null)
  const [coneTipVisible,  setConeTipVisible]  = useState(false)
  const [coneTipPos,      setConeTipPos]      = useState(null)
  const coneCellRef    = useRef(null)
  const tiltTooltipRef = useRef(null)   // DOM ref inside the tooltip label

  // ── Refs mirroring state (for use inside RAF closure) ─────────────────────
  const radarViewRef    = useRef('radar')
  const selectedPkgRef  = useRef('kn')
  const activeSectionRef= useRef(null)
  const launchPhaseRef  = useRef('idle')

  // ── Canvas element refs ───────────────────────────────────────────────────
  const radarCanvasRef  = useRef(null)
  const railgunCanvasRef= useRef(null)
  const targetCanvasRef = useRef(null)
  const threatPosRef    = useRef(null)   // {x, y} canvas coords of threat marker
  // Cached per-canvas { ctx, w, h, ... } — refreshed on resize / view-toggle so
  // the RAF loop never reads clientWidth (which would force a layout reflow each
  // frame) nor rebuilds the static radar sweep gradient.
  const cvMetaRef       = useRef({ radar: null, target: null, railgun: null })

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
  const coneSubRef      = useRef(null)
  const tachyonRef      = useRef(null)
  const tachSubRef      = useRef(null)
  const decohereRef     = useRef(null)
  const decohSubRef     = useRef(null)
  const coreFluxRef     = useRef(null)
  const coreBarRef      = useRef(null)
  const capBankRef      = useRef(null)
  const capBarRef       = useRef(null)
  const bhOutputRef     = useRef(bhOutput)
  const bhYieldRef      = useRef(bhYield)
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

  // ── Scale to fit small viewports ──────────────────────────────────────────
  // NATURAL_H = grid row mins (190+252+220+212=874) + 3 gaps (30) + padding (20)
  //            + HudHeader (58) + HudFooter (~46). Row mins are sized so every
  //            rigid panel shows in full at the minimum (scaled) layout.
  const NATURAL_H = 1030
  const scalerRef = useRef(null)
  useEffect(() => {
    const update = () => {
      const el = scalerRef.current
      if (!el) return
      const scale = Math.min(1, window.innerHeight / NATURAL_H)
      if (scale < 1) {
        el.style.width     = `${100 / scale}%`
        el.style.height    = `${NATURAL_H}px`
        el.style.transform = `scale(${scale})`
      } else {
        el.style.width     = '100%'
        el.style.height    = '100%'
        el.style.transform = ''
      }
    }
    update()
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [])

  // ── Glitch warp burst (under attack) ───────────────────────────────────────
  // Add the warp class for a brief burst every 5s instead of running an infinite
  // CSS transform animation — the latter keeps the whole screen (all live
  // canvases) promoted to one continuously re-rasterised layer. Same visual
  // cadence, but between bursts the canvases composite cheaply again.
  const mainScreenRef = useRef(null)
  useEffect(() => {
    if (!underAttack) return
    const el = mainScreenRef.current
    if (!el) return
    let burstTimeout
    const burst = () => {
      el.classList.add('main-screen--warp')
      burstTimeout = setTimeout(() => el.classList.remove('main-screen--warp'), 420)
    }
    const id = setInterval(burst, 5000)
    return () => { clearInterval(id); clearTimeout(burstTimeout); el.classList.remove('main-screen--warp') }
  }, [underAttack])

  const logTimerRef   = useRef(0)
  const grbTimerRef   = useRef(0)
  const logBufRef     = useRef([])
  const logSeqRef     = useRef(0)
  const rafRef               = useRef(null)
  const cdTimerRef           = useRef(null)
  const showTimerRef         = useRef(null)
  const codetickSfx          = useRef(null)
  useEffect(() => { setFlag('mainPanelSeen', true) }, [])

  const onLaunchCompleteRef  = useRef(onLaunchComplete)
  useEffect(() => { onLaunchCompleteRef.current = onLaunchComplete }, [onLaunchComplete])
  const reactorPlasmaRef  = useRef(reactorPlasma)
  const antennaAlignedRef = useRef(false)
  useEffect(() => { reactorPlasmaRef.current = reactorPlasma }, [reactorPlasma])
  useEffect(() => { antennaAlignedRef.current = antennaAligned }, [antennaAligned])
  useEffect(() => { bhOutputRef.current = bhOutput }, [bhOutput])
  useEffect(() => { bhYieldRef.current = bhYield }, [bhYield])
  const targetIdxRef = useRef(targetIdx)
  useEffect(() => { targetIdxRef.current = targetIdx }, [targetIdx])
  const countdownSecondsRef = useRef(countdownSeconds)
  useEffect(() => { countdownSecondsRef.current = countdownSeconds }, [countdownSeconds])
  const underAttackRef = useRef(underAttack)
  useEffect(() => { underAttackRef.current = underAttack }, [underAttack])


  // Sync the two subtitle blink animations so they start at exactly the same time
  useEffect(() => {
    if (!underAttack) return
    const els = [coneSubRef.current, tachSubRef.current, decohSubRef.current].filter(Boolean)
    els.forEach(el => { el.style.animation = 'none' })
    // Force reflow so the removal takes effect before we re-apply
    els.forEach(el => el.getBoundingClientRect())
    els.forEach(el => { el.style.animation = '' })
  }, [underAttack])

  // ── Log helper ────────────────────────────────────────────────────────────
  const addLog = useCallback((level, msg) => {
    const ts = new Date()
    const t  = `${pad(ts.getUTCHours())}:${pad(ts.getUTCMinutes())}:${pad(ts.getUTCSeconds())}.${pad(ts.getUTCMilliseconds(), 3)}`
    const id = ++logSeqRef.current
    logBufRef.current = [...logBufRef.current, { id, t, level, msg }].slice(-6)
    setLogEntries([...logBufRef.current])
  }, [])

  // ── Under attack: flood the event log with the Discord's message ───────────
  useEffect(() => {
    if (!underAttack) return
    const id = setInterval(() => addLog('????', 'YE SHALL BE AS GODS'), 500)
    return () => clearInterval(id)
  }, [underAttack, addLog])

  // ── Radar view toggle ─────────────────────────────────────────────────────
  const setRadarView = useCallback((view) => {
    radarViewRef.current = view
    setRadarViewState(view)
  }, [])

  // Fit the railgun canvas after the DOM has rendered it visible
  useEffect(() => {
    const cv = railgunCanvasRef.current
    if (radarView === 'install' && cv) {
      fitCanvas(cv)
      cvMetaRef.current.railgun = { ctx: cv.getContext('2d'), w: cv.clientWidth, h: cv.clientHeight }
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
    if (cdTimerRef.current)   clearTimeout(cdTimerRef.current)
    if (showTimerRef.current) clearTimeout(showTimerRef.current)
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

  const [rejectionMessage, setRejectionMessage] = useState('NO TARGET SELECTED — LAUNCH CODES UNAVAILABLE')

  const handleArm = useCallback(() => {
    if (launchPhaseRef.current === 'idle') {
      if (!underAttackRef.current) {
        // Not under attack — STRATCON 1 required
        setRejectionMessage('STRATCON 1 REQUIRED — LAUNCH CODES UNAVAILABLE')
        launchPhaseRef.current = 'notarget'
        setLaunchPhase('notarget')
        addLog('WARN', 'LAUNCH REJECTED // STRATCON 1 NOT IN EFFECT')
      } else if (targetIdxRef.current < 0) {
        // No target — show rejection sequence
        setRejectionMessage('NO TARGET SELECTED — LAUNCH CODES UNAVAILABLE')
        launchPhaseRef.current = 'notarget'
        setLaunchPhase('notarget')
        addLog('WARN', 'LAUNCH REJECTED // NO TARGET DESIGNATED')
      } else {
        launchPhaseRef.current = 'verifying'
        setLaunchPhase('verifying')
        setLaunchStatus({ text: '⚠ VERIFYING LAUNCH CODES', cls: 'launch-status armed' })
        setAuthCActive(true)
        addLog('CRIT', `PHYSICS PACKAGE ARMED // ${PKG_NAMES[selectedPkgRef.current]}`)
      }
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

    let val = countdownSecondsRef.current
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
        setFlag('lancecast', true)
        addLog('CRIT', `*** ${PKG_NAMES[selectedPkgRef.current]} // PACKAGE AWAY ***`)
        addLog('CRIT', 'GEODESIC INTERCEPT SOLUTION COMMITTED')
        showTimerRef.current = setTimeout(() => {
          launchPhaseRef.current = 'finalHearing'
          setLaunchPhase('finalHearing')
        }, 5000)
        cdTimerRef.current = setTimeout(() => {
          onLaunchCompleteRef.current?.(PKG_NAMES[selectedPkgRef.current])
        }, 12000)
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

    const meta = cvMetaRef.current
    const buildRadarMeta = (cv) => {
      const ctx = cv.getContext('2d')
      const w = cv.clientWidth, h = cv.clientHeight
      const cx = w / 2, cy = h / 2, R = Math.min(w, h) * 0.46
      // Sweep gradient is identical every frame (depends only on centre/radius)
      const sweepGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, R)
      sweepGrad.addColorStop(0, 'rgba(0,100,255,0.0)')
      sweepGrad.addColorStop(0.7, 'rgba(0,100,255,0.18)')
      sweepGrad.addColorStop(1, 'rgba(0,100,255,0.0)')
      return { ctx, w, h, sweepGrad }
    }
    const fitAll = () => {
      if (radarCanvasRef.current)   { fitCanvas(radarCanvasRef.current);   meta.radar  = buildRadarMeta(radarCanvasRef.current) }
      if (targetCanvasRef.current)  { fitCanvas(targetCanvasRef.current);  const cv = targetCanvasRef.current;  meta.target  = { ctx: cv.getContext('2d'), w: cv.clientWidth, h: cv.clientHeight } }
      if (railgunCanvasRef.current) { fitCanvas(railgunCanvasRef.current); const cv = railgunCanvasRef.current; meta.railgun = { ctx: cv.getContext('2d'), w: cv.clientWidth, h: cv.clientHeight } }
    }
    fitAll()
    // Re-fit (and rebuild cached metadata) only when a canvas's box actually
    // changes — covers window/scaler resize, view toggles, and the radio
    // online/offline transition (canvases collapse to 0 while offline).
    const ro = new ResizeObserver(fitAll)
    if (radarCanvasRef.current)   ro.observe(radarCanvasRef.current)
    if (targetCanvasRef.current)  ro.observe(targetCanvasRef.current)
    if (railgunCanvasRef.current) ro.observe(railgunCanvasRef.current)

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
      const atk = underAttackRef.current
      const tilt = atk
        ? 0.04217 + Math.abs(Math.sin(now * 0.0005)) * 0.01364
        : 0.00027 + Math.abs(Math.sin(now * 0.0005)) * 0.00018
      if (coneStateRef.current) {
        coneStateRef.current.textContent = `${tilt.toFixed(5)} rad`
        coneStateRef.current.className   = atk ? 'chrono-state chrono-state--attack' : 'chrono-state ok'
      }
      if (tiltTooltipRef.current) tiltTooltipRef.current.textContent = `${tilt.toFixed(5)} rad`
      const tach = atk
        ? 4.8 + Math.sin(now * 0.0017) * 0.9
        : 2.4 + Math.sin(now * 0.0017) * 0.6
      if (tachyonRef.current) {
        tachyonRef.current.textContent = `${tach.toFixed(2)} σ ABOVE BG`
        tachyonRef.current.className = atk ? 'chrono-state chrono-state--attack' : tach >= 3.5 ? 'chrono-state bad' : tach > 2.0 ? 'chrono-state warn' : 'chrono-state ok'
      }
      const tD = atk
        ? (10 ** -13) * (1 + Math.sin(now * 0.0009) * 0.35)
        : (10 ** -13) * (1 + Math.sin(now * 0.0009) * 0.05)
      if (decohereRef.current) {
        decohereRef.current.textContent = `τ_D = ${tD.toExponential(2)} s`
        decohereRef.current.className   = atk ? 'chrono-state chrono-state--attack' : 'chrono-state ok'
      }
    }

    const updatePower = (now) => {
      const d    = reactorPlasmaRef.current / 100
      const flux = (0.35 + d * 3.85) + Math.sin(now * 0.00041) * 0.05
      if (coreFluxRef.current) coreFluxRef.current.textContent = `${flux.toFixed(3)} GW`
      if (coreBarRef.current)  coreBarRef.current.style.width  = `${Math.min(100, flux / 4.2 * 100).toFixed(1)}%`
      const cap = (14 + d * 80) + Math.sin(now * 0.00058) * 1.5
      if (capBankRef.current)  capBankRef.current.textContent  = `${Math.min(100, cap).toFixed(1)}%`
      if (capBarRef.current)   capBarRef.current.style.width   = `${Math.min(100, cap).toFixed(1)}%`
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
    const drawRadar = (dt, now = 0) => {
      const m = meta.radar
      if (!m || !m.w) return
      const { ctx, w, h } = m
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
      ctx.fillStyle = 'rgba(106, 173, 255, 0.7)'; ctx.font = '9px Cascadia Mono, Consolas, ui-monospace, Menlo, Monaco, monospace'
      for (let deg = 0; deg < 360; deg += 30) {
        const a = (deg - 90) * Math.PI / 180
        ctx.fillText(String(deg).padStart(3, '0'), cx + Math.cos(a) * (R + 10) - 8, cy + Math.sin(a) * (R + 10) + 3)
      }
      sweepAngleRef.current += dt * 0.0011
      const a0 = sweepAngleRef.current, arc = Math.PI / 3
      ctx.fillStyle = m.sweepGrad; ctx.beginPath(); ctx.moveTo(cx, cy); ctx.arc(cx, cy, R, a0 - arc, a0); ctx.closePath(); ctx.fill()
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

      // ── Threat marker (under attack only) ───────────────────────────────
      if (underAttackRef.current) {
        const angle  = Math.PI / 4                       // 45° = bottom-right
        const tx = cx + R * 0.62 * Math.cos(angle)
        const ty = cy + R * 0.62 * Math.sin(angle)
        const labelY = ty - 36                           // label sits above triangle
        // bounding box enclosing label + triangle
        const hitLeft  = tx - 100, hitRight = tx + 100
        const hitTop   = labelY - 22, hitBottom = ty + 14
        threatPosRef.current = { x: tx, y: ty, labelY, hitLeft, hitRight, hitTop, hitBottom }

        // pulsing glow radius + opacity
        const pulse     = 0.5 + 0.5 * Math.sin(now * 0.0025)  // 0→1 oscillation
        const glowR     = 34 + pulse * 16
        const glowAlpha = 0.45 + pulse * 0.35

        const glowGrad = ctx.createRadialGradient(tx, ty, 0, tx, ty, glowR)
        glowGrad.addColorStop(0,   `rgba(200,0,0,${glowAlpha})`)
        glowGrad.addColorStop(0.45,`rgba(150,0,0,${glowAlpha * 0.45})`)
        glowGrad.addColorStop(1,   'rgba(100,0,0,0)')
        ctx.fillStyle = glowGrad
        ctx.beginPath(); ctx.arc(tx, ty, glowR, 0, Math.PI * 2); ctx.fill()

        // triangle body
        ctx.save()
        ctx.shadowColor = `rgba(255,30,0,${0.7 + pulse * 0.3})`
        ctx.shadowBlur  = 16 + pulse * 10
        ctx.fillStyle   = 'rgba(215,25,25,1)'
        ctx.beginPath()
        ctx.moveTo(tx,       ty - 16)
        ctx.lineTo(tx + 14,  ty + 10)
        ctx.lineTo(tx - 14,  ty + 10)
        ctx.closePath()
        ctx.fill()
        ctx.restore()

        // "THREAT DETECTED" label above triangle
        ctx.save()
        ctx.font         = 'bold 18px "Cascadia Mono", Consolas, ui-monospace, Menlo, Monaco, monospace'
        ctx.textAlign    = 'center'
        ctx.textBaseline = 'bottom'
        ctx.shadowColor  = `rgba(255,60,60,${0.6 + pulse * 0.4})`
        ctx.shadowBlur   = 8 + pulse * 6
        ctx.fillStyle    = `rgba(255,220,220,${0.85 + pulse * 0.15})`
        ctx.fillText('THREAT DETECTED', tx, labelY)
        ctx.restore()
      } else {
        threatPosRef.current = null
      }
    }

    const drawRailgun = (dt) => {
      if (radarViewRef.current !== 'install') return
      const m = meta.railgun
      if (!m || !m.w) return
      const { ctx, w, h } = m
      rgPulseRef.current += dt * 0.002
      const p = rgPulseRef.current
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
      ctx.fillStyle = 'rgba(94,130,170,0.85)'; ctx.font = `${Math.max(9, h * 0.028)}px Cascadia Mono, Consolas, ui-monospace, Menlo, Monaco, monospace`; ctx.textAlign = 'center'
      ctx.fillText('◄────── RAIL ASSEMBLY  4,200 m ──────►', cx, h * 0.91); ctx.textAlign = 'left'
      ctx.fillStyle = 'rgba(0,50,139,0.12)'; ctx.font = `bold ${h * 0.09}px Cascadia Mono, Consolas, ui-monospace, Menlo, Monaco, monospace`; ctx.textAlign = 'center'
      ctx.fillText('TS // SCI // COMPARTMENTED', cx, cy + h * 0.04); ctx.textAlign = 'left'
    }

    const drawTarget = (dt) => {
      const m = meta.target
      if (!m || !m.w) return
      const { ctx, w, h } = m
      tphaseRef.current += dt * 0.0006
      const ph   = tphaseRef.current
      const hasT = targetIdxRef.current >= 0

      // background
      ctx.fillStyle = 'rgba(1,2,8,0.35)'
      ctx.fillRect(0, 0, w, h)

      const fs  = Math.max(7, Math.min(10, Math.round(w * 0.044)))
      const pad = 7

      if (hasT) {
        // ── crosshair lines ─────────────────────────────────────────────────
        const gap = Math.min(w, h) * 0.18
        ctx.strokeStyle = 'rgba(255,60,60,0.38)'
        ctx.lineWidth = 1
        ctx.beginPath()
        ctx.moveTo(w / 2, 0);             ctx.lineTo(w / 2, h / 2 - gap)
        ctx.moveTo(w / 2, h / 2 + gap);   ctx.lineTo(w / 2, h)
        ctx.moveTo(0,     h / 2);          ctx.lineTo(w / 2 - gap, h / 2)
        ctx.moveTo(w / 2 + gap, h / 2);   ctx.lineTo(w,     h / 2)
        ctx.stroke()

        // ── bracket corners ─────────────────────────────────────────────────
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

        // ── corner labels ───────────────────────────────────────────────────
        ctx.font      = `${fs}px "Cascadia Mono", Consolas, ui-monospace, Menlo, Monaco, monospace`
        ctx.fillStyle = 'rgba(106,173,255,0.82)'
        ctx.textBaseline = 'top';    ctx.textAlign = 'left';  ctx.fillText('TGT // ASSET-X9', pad, pad)
        ctx.textBaseline = 'top';    ctx.textAlign = 'right'; ctx.fillText('LOCK 98.7%', w - pad, pad)
        ctx.textBaseline = 'bottom'; ctx.textAlign = 'left';  ctx.fillText('RANGE 1,402 km', pad, h - pad)
        ctx.textBaseline = 'bottom'; ctx.textAlign = 'right'; ctx.fillText('TTI 00:01:47', w - pad, h - pad)
        ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic'
      } else {
        // ── "[ AWAITING TARGET ]" blink centred, no crosshair ───────────────
        if (Math.floor(Date.now() / 600) % 2 === 0) {
          const bigFs = Math.max(12, Math.min(20, Math.round(Math.min(w, h) * 0.09)))
          ctx.font      = `${bigFs}px "Cascadia Mono", Consolas, ui-monospace, Menlo, Monaco, monospace`
          ctx.fillStyle = 'rgba(106,173,255,0.65)'
          ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
          ctx.fillText('[ AWAITING TARGET ]', w / 2, h / 2)
          ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic'
        }
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
      const radarActive = (bhOutputRef.current > 0.05 || bhYieldRef.current > 0) && antennaAlignedRef.current
      if (radarActive) drawRadar(dt, now)
      drawRailgun(dt)
      drawTarget(dt)

      grbTimerRef.current += dt
      if (grbTimerRef.current > 250) {
        grbPctRef.current += rand(0.4, 1.1)
        // suppress routine log spam under attack — the Discord floods the log instead
        if (grbPctRef.current >= 100) { grbPctRef.current = 0; if (!underAttackRef.current) addLog('CRIT', 'GRB EMITTER // FIRING SOLUTION DISCHARGED') }
        if (grbBarRef.current) grbBarRef.current.style.width = `${grbPctRef.current.toFixed(1)}%`
        grbTimerRef.current = 0
      }

      logTimerRef.current += dt
      if (logTimerRef.current > 6000 + Math.random() * 4000) {
        if (!underAttackRef.current) {
          const [lvl, msg] = LOG_MESSAGES[Math.floor(Math.random() * LOG_MESSAGES.length)]
          addLog(lvl, msg)
        }
        logTimerRef.current = 0
      }

      rafRef.current = requestAnimationFrame(tick)
    }

    rafRef.current = requestAnimationFrame(tick)

    return () => {
      cancelAnimationFrame(rafRef.current)
      ro.disconnect()
      if (cdTimerRef.current)   clearTimeout(cdTimerRef.current)
      if (showTimerRef.current) clearTimeout(showTimerRef.current)
    }
  }, [addLog])

  // ── JSX ───────────────────────────────────────────────────────────────────
  const hasTarget     = targetIdx >= 0
  const targetName    = targetIdx >= 0 ? getTargetName(targetIdx) : 'None'
  const stage1On      = reactorPlasma >= 25
  const stage2On      = bhOutput > 0.05 || bhYield > 0
  // Main functionality is powered by the black-hole ergosphere tap (Stage 2),
  // not the fusion reactor alone.
  const lowPower      = !stage2On
  const showArm       = launchPhase === 'idle'
  const showDisarm    = launchPhase === 'verifying' || launchPhase === 'armed' || launchPhase === 'countdown'
  const showLaunch    = launchPhase === 'armed' || launchPhase === 'fired'
  const launchFiring  = launchPhase === 'fired'
  const showCodeVerify= launchPhase === 'verifying' || launchPhase === 'armed' || launchPhase === 'countdown' || launchPhase === 'fired' || launchPhase === 'notarget'

  return (
    <>
    <div id="main-screen" ref={mainScreenRef}>
      {underAttack && <GlitchOverlay />}
      <div className="main-scaler" ref={scalerRef}>
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
              <canvas
                id="radar-canvas"
                ref={radarCanvasRef}
                onMouseMove={(e) => {
                  if (!underAttack || !threatPosRef.current) { setThreatHovered(false); return }
                  const cv = radarCanvasRef.current
                  if (!cv) return
                  const rect = cv.getBoundingClientRect()
                  const scaleX = cv.clientWidth  / rect.width
                  const scaleY = cv.clientHeight / rect.height
                  const mx = (e.clientX - rect.left) * scaleX
                  const my = (e.clientY - rect.top)  * scaleY
                  const { hitLeft, hitRight, hitTop, hitBottom } = threatPosRef.current
                  const over = mx >= hitLeft && mx <= hitRight && my >= hitTop && my <= hitBottom
                  setThreatHovered(over)
                  if (over) {
                    setThreatScreenPos({
                      x: rect.left + ((hitLeft + hitRight) / 2) / scaleX - 137.5,
                      y: rect.top  + hitBottom / scaleY,
                    })
                  }
                }}
                onMouseLeave={() => setThreatHovered(false)}
              />
              {threatHovered && underAttack && threatScreenPos && createPortal(
                <div className="radar-threat-infobox" style={{ position: 'fixed', top: threatScreenPos.y, left: threatScreenPos.x }}>
                  <div className="radar-threat-title">THREAT DETECTED</div>
                  <img
                    className="radar-threat-img"
                    src={`${import.meta.env.BASE_URL}darkness.webp`}
                    alt="Threat origin"
                  />
                  <div className="radar-threat-divider" />
                  <div className="radar-threat-row"><span className="radar-threat-key">ORIGIN</span><span className="radar-threat-val">PLANET AETHON, KARATH SYSTEM</span></div>
                  <div className="radar-threat-divider" />
                  <div className="radar-threat-reading">CHRONOLOGY ALTERATION EVENT DETECTED</div>
                  <div className="radar-threat-reading">LIGHT CONE TILT ORIGIN POINT</div>
                  <div className="radar-threat-reading">TACHYONIC EMISSION ORIGIN POINT</div>
                  <div className="radar-threat-divider" />
                  <div className="radar-threat-codered">CODE RED</div>
                </div>,
                document.body
              )}
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
            {!lowPower && !antennaAligned && <div className="radio-offline-overlay"><span>[ RADIO OFFLINE ]</span></div>}
          </div>
          {lowPower && <div className="low-power-overlay" />}
        </section>

        <XBandRadioPanel litClass={lit('panel-xband')} lowPower={lowPower} aligned={antennaAligned} onAlign={onAdjustAntenna} onFreqChange={onRadioFreq} initialFreq={radioFreq} />

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
              <div
                className="chrono-cell chrono-cell--info"
                ref={coneCellRef}
                onMouseEnter={() => {
                  const r = coneCellRef.current?.getBoundingClientRect()
                  if (r) { setConeTipPos({ x: r.left + r.width / 2, y: r.top }); setConeTipVisible(true) }
                }}
                onMouseLeave={() => setConeTipVisible(false)}
              >
                <span className="chrono-info-icon">ⓘ</span>
                <div className="chrono-label">LIGHT CONE TILT</div>
                <div className={underAttack ? 'chrono-state chrono-state--attack' : 'chrono-state ok'} ref={coneStateRef} />
                <div className={`chrono-sub${underAttack ? ' chrono-sub--alert' : ''}`} ref={coneSubRef}>{underAttack ? 'EXCEEDING TOLERANCE' : 'WITHIN TOLERANCE'}</div>
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
                <div className={`chrono-sub${underAttack ? ' chrono-sub--alert' : ''}`} ref={tachSubRef}>{underAttack ? 'EXCEEDING TOLERANCE' : 'm² &lt; 0 SIGNATURE'}</div>
              </div>
              <div className="chrono-cell">
                <div className="chrono-label">QUANTUM DECOHERENCE</div>
                <div className={underAttack ? 'chrono-state chrono-state--attack' : 'chrono-state ok'} ref={decohereRef} />
                <div className={`chrono-sub${underAttack ? ' chrono-sub--alert' : ''}`} ref={decohSubRef}>{underAttack ? 'DECOUPLING IMMINENT' : 'ENVIRONMENT COUPLED'}</div>
              </div>
            </div>
          </div>
          {lowPower && <div className="low-power-overlay" />}
        </section>

        {/* TARGETING SOLUTION */}
        <section
          className={`panel wide${lit('panel-target')}${lowPower ? ' panel--low-power' : (!antennaAligned ? '' : ' panel--clickable')}`}
          id="panel-target"
          onClick={!lowPower && antennaAligned ? onTargeting : undefined}
          title={!lowPower && antennaAligned ? 'Open Targeting System' : undefined}
        >
          <header className="panel-header">
            <span className={`bullet${(!hasTarget && antennaAligned) ? ' bullet--alert' : ''}`} /><h2>GEODESIC TARGETING SOLUTION</h2>
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
            {!lowPower && !antennaAligned && <div className="radio-offline-overlay"><span>[ RADIO OFFLINE ]</span></div>}
          </div>
          {lowPower && <div className="low-power-overlay" />}
        </section>

        {/* POWER / REACTOR */}
        <section className={`panel panel--clickable${lit('panel-power')}`} id="panel-power" onClick={onPower} title="Open Power Management">
          <header className="panel-header">
            <span className={`bullet${lowPower ? ' bullet--alert' : ''}`} /><h2>POWER BUS // TWO-STAGE</h2>
            <span className="panel-id">PNL-007 / FUSION + ERGOSPHERE</span>
          </header>
          <div className="panel-body">
            <div className="power-split">

              {/* ── Stage 1 — fusion reactor ─────────────────────────────── */}
              <div className="power-stage">
                <div className="power-stage-head">
                  <span className={`stage-light${stage1On ? ' stage-light--on' : ''}`} />
                  <div className="power-stage-titles">
                    <span className="power-stage-num">POWER STAGE 1</span>
                    <span className="power-stage-name">D-³He FUSION REACTOR</span>
                  </div>
                </div>
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
                </div>
              </div>

              <div className="power-split-div" />

              {/* ── Stage 2 — black-hole ergosphere extraction ───────────── */}
              <div className="power-stage">
                <div className="power-stage-head">
                  <span className={`stage-light${stage2On ? ' stage-light--on' : ''}`} />
                  <div className="power-stage-titles">
                    <span className="power-stage-num">POWER STAGE 2</span>
                    <span className="power-stage-name">BLACK HOLE POWER EXTRACTION</span>
                  </div>
                </div>
                <div className="power-grid">
                  <div className="power-cell">
                    <div className="pc-label">OUTPUT</div>
                    <div className="pc-value mono">{(stage2On ? bhOutput : 0).toFixed(2)} PW</div>
                    <div className="bar"><div className="bar-fill" style={{ width: `${Math.min(100, bhOutput / 5 * 100)}%` }} /></div>
                  </div>
                  <div className="power-cell">
                    <div className="pc-label">CUM. YIELD</div>
                    <div className="pc-value mono">{bhYield.toFixed(1)} PJ</div>
                    <div className="bar"><div className="bar-fill" style={{ width: `${Math.min(100, bhYield / 500 * 100)}%` }} /></div>
                  </div>
                </div>
              </div>

            </div>
            <div className="panel-enter-link-wrap">
              <div className="panel-enter-link">ENTER POWER MANAGEMENT</div>
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
                {logEntries.map((e) => (
                  <li key={e.id} className={`fresh${e.level === '????' ? ' log-discord' : ''}`}>
                    <span className="ts">{e.t}</span>
                    <span className={`lvl ${e.level === '????' ? 'discord' : e.level.toLowerCase()}`}>{e.level}</span>
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
              <span className={`bullet${underAttack ? ' bullet--alert' : ' pulse'}`} /><h2>PHYSICS PACKAGE LAUNCH CONTROL</h2>
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
          noTarget={launchPhase === 'notarget'}
          rejectionMessage={rejectionMessage}
          onDismiss={handleReset}
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

      {launchPhase === 'finalHearing' && (
        <div className="final-hearing-overlay">
          <img
            src={`${import.meta.env.BASE_URL}finalhearing.jpg`}
            alt=""
            className="final-hearing-img"
          />
        </div>
      )}
      </div>
    </div>

    {/* ── Light cone tooltip portal ────────────────────────────────────── */}
    {coneTipVisible && coneTipPos && createPortal(
      <div className="lc-tooltip" style={{ position: 'fixed', left: coneTipPos.x, top: coneTipPos.y, transform: 'translate(-50%, -100%) translateY(-8px)' }}>
        <div className="lc-tooltip-title">LIGHT CONE TILT</div>
        <div className="lc-tooltip-canvas-wrap">
          <LightConeCanvas underAttack={underAttack} />
        </div>
        <div className="lc-tooltip-sub">
          <div ref={tiltTooltipRef} />
          <div>{underAttack ? 'EXCEEDING TOLERANCE' : 'WITHIN TOLERANCE'}</div>
        </div>
      </div>,
      document.body
    )}
    </>
  )
}
