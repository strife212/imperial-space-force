import { useState, useEffect, useRef, useCallback } from 'react'
import HudHeader from '../components/HudHeader'
import HudFooter from '../components/HudFooter'

// ── 3D projection ─────────────────────────────────────────────────────────────
function proj3D(x, y, z, cx, cy, scale, rx, ry) {
  const cosY = Math.cos(ry), sinY = Math.sin(ry)
  const x1 =  x * cosY + z * sinY
  const z1 = -x * sinY + z * cosY
  const cosX = Math.cos(rx), sinX = Math.sin(rx)
  const y2 =  y * cosX - z1 * sinX
  const z2 =  y * sinX + z1 * cosX
  const d  = 3.2, pz = d + z2
  return { x: (x1 / pz) * scale + cx, y: (y2 / pz) * scale + cy, z: z2 }
}

function stroke(ctx, pts) {
  if (!pts.length) return
  ctx.beginPath()
  pts.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)))
  ctx.stroke()
}

// ── Torus geometry constants ──────────────────────────────────────────────────
const R_MAJ = 0.54   // major radius
const R_MIN = 0.20   // tube radius

function drawReactor(ctx, w, h, rx, ry, plasma) {
  const cx = w * 0.5, cy = h * 0.5
  const scale = Math.min(w, h) * 1.05
  const p = (x, y, z) => proj3D(x, y, z, cx, cy, scale, rx, ry)
  const depth = pt => Math.max(0, (pt.z + 1.5) / 3.0)

  ctx.clearRect(0, 0, w, h)

  // Ambient background glow
  const bg = ctx.createRadialGradient(cx, cy, 0, cx, cy, scale * 0.7)
  bg.addColorStop(0, `rgba(0,22,88,${0.04 + plasma * 0.10})`)
  bg.addColorStop(1, 'rgba(0,0,0,0)')
  ctx.fillStyle = bg; ctx.fillRect(0, 0, w, h)

  // ── Plasma channel glow (drawn first, behind structure) ──────────────────
  if (plasma > 0.01) {
    const hot = plasma > 0.78
    const c0  = hot ? '255,120,220'  : '255,100,200'
    const c1  = hot ? '220, 40,160'  : '200, 60,180'
    for (let i = 0; i < 80; i++) {
      const u  = (i / 80) * Math.PI * 2
      const pt = p(R_MAJ * Math.cos(u), R_MAJ * Math.sin(u), 0)
      const dv = depth(pt)
      const gs = Math.max(1, R_MIN * scale * plasma * (0.28 + dv * 0.55))
      const grd = ctx.createRadialGradient(pt.x, pt.y, 0, pt.x, pt.y, gs)
      grd.addColorStop(0,   `rgba(${c0},${(plasma * dv * 0.60).toFixed(3)})`)
      grd.addColorStop(0.5, `rgba(${c1},${(plasma * dv * 0.22).toFixed(3)})`)
      grd.addColorStop(1,   'rgba(120,0,80,0)')
      ctx.fillStyle = grd
      ctx.beginPath(); ctx.arc(pt.x, pt.y, gs, 0, Math.PI * 2); ctx.fill()
    }
  }

  // ── Outer containment shell (large, faint) ───────────────────────────────
  const RO = R_MAJ, Ro = R_MIN * 1.58
  for (let vi = 0; vi < 14; vi++) {
    const v = (vi / 14) * Math.PI * 2
    const pts = []
    for (let i = 0; i <= 48; i++) {
      const u = (i / 48) * Math.PI * 2
      pts.push(p((RO + Ro * Math.cos(v)) * Math.cos(u),
                  (RO + Ro * Math.cos(v)) * Math.sin(u),
                   Ro * Math.sin(v)))
    }
    const dv = depth(pts[24])
    ctx.strokeStyle = `rgba(8,35,115,${0.06 + dv * 0.20})`
    ctx.lineWidth = 0.5; stroke(ctx, pts)
  }

  // ── TF coil rings: build all, draw back half first ───────────────────────
  const numCoils = 14
  const coilRad  = R_MIN * 1.52
  const coils = Array.from({ length: numCoils }, (_, ci) => {
    const u   = (ci / numCoils) * Math.PI * 2
    const cpt = p(R_MAJ * Math.cos(u), R_MAJ * Math.sin(u), 0)
    const pts = []
    for (let i = 0; i <= 36; i++) {
      const v = (i / 36) * Math.PI * 2
      pts.push(p((R_MAJ + coilRad * Math.cos(v)) * Math.cos(u),
                  (R_MAJ + coilRad * Math.cos(v)) * Math.sin(u),
                   coilRad * Math.sin(v)))
    }
    return { pts, z: cpt.z, d: depth(cpt) }
  })

  const drawCoil = (cd) => {
    ctx.strokeStyle = `rgba(18,55,175,${(0.32 + cd.d * 0.52).toFixed(3)})`
    ctx.lineWidth = 2.5; stroke(ctx, cd.pts)
    ctx.strokeStyle = `rgba(55,115,255,${(0.10 + cd.d * 0.20).toFixed(3)})`
    ctx.lineWidth = 0.9; stroke(ctx, cd.pts)
  }

  coils.filter(c => c.z < 0).forEach(drawCoil)

  // ── Main torus wireframe ─────────────────────────────────────────────────
  const pScale = 0.45 + plasma * 0.55

  // Toroidal lines (latitude — run around the big ring)
  for (let vi = 0; vi < 22; vi++) {
    const v = (vi / 22) * Math.PI * 2
    const pts = []
    for (let i = 0; i <= 48; i++) {
      const u = (i / 48) * Math.PI * 2
      pts.push(p((R_MAJ + R_MIN * Math.cos(v)) * Math.cos(u),
                  (R_MAJ + R_MIN * Math.cos(v)) * Math.sin(u),
                   R_MIN * Math.sin(v)))
    }
    const dv = depth(pts[24])
    ctx.strokeStyle = `rgba(20,80,220,${((0.22 + dv * 0.65) * pScale).toFixed(3)})`
    ctx.lineWidth = 0.9; stroke(ctx, pts)
  }

  // Poloidal lines (longitude — cross-sections of the tube)
  for (let ui = 0; ui < 20; ui++) {
    const u   = (ui / 20) * Math.PI * 2
    const cpt = p(R_MAJ * Math.cos(u), R_MAJ * Math.sin(u), 0)
    const pts = []
    for (let i = 0; i <= 32; i++) {
      const v = (i / 32) * Math.PI * 2
      pts.push(p((R_MAJ + R_MIN * Math.cos(v)) * Math.cos(u),
                  (R_MAJ + R_MIN * Math.cos(v)) * Math.sin(u),
                   R_MIN * Math.sin(v)))
    }
    const dv = depth(cpt)
    ctx.strokeStyle = `rgba(30,100,255,${((0.26 + dv * 0.72) * pScale).toFixed(3)})`
    ctx.lineWidth = 1.1; stroke(ctx, pts)
  }

  // Front TF coils
  coils.filter(c => c.z >= 0).forEach(drawCoil)

  // ── Central solenoid helix ───────────────────────────────────────────────
  const solR = 0.052, solH = 0.30, solTurns = 10
  const solPts = Array.from({ length: solTurns * 22 + 1 }, (_, i) => {
    const t   = i / (solTurns * 22)
    const phi = t * Math.PI * 2 * solTurns
    return p(solR * Math.cos(phi), solR * Math.sin(phi), -solH + t * solH * 2)
  })
  ctx.strokeStyle = 'rgba(100,170,255,0.82)'; ctx.lineWidth = 1.6; stroke(ctx, solPts)
  ctx.strokeStyle = 'rgba(190,225,255,0.25)'; ctx.lineWidth = 3.5; stroke(ctx, solPts)
}

// ── Circuit breaker data ──────────────────────────────────────────────────────
const BREAKERS = [
  { id: 'main',   label: 'MAIN CIRCUIT',  delay: 0   },
  { id: 'sec',    label: 'SECONDARY',     delay: 120  },
  { id: 'aux',    label: 'AUX POWER',     delay: 240  },
  { id: 'coil-a', label: 'FIELD COIL A', delay: 360  },
  { id: 'coil-b', label: 'FIELD COIL B', delay: 480  },
]

// ── Component ─────────────────────────────────────────────────────────────────
export default function ReactorScreen({ onReturn, onLogout, initialPlasma = 0, unreadCount = 0, onMailOpen }) {
  const canvasRef         = useRef(null)
  const rafRef            = useRef(null)
  const rotRef            = useRef({ x: 0.38, y: 0.3 })
  const plasmaRef         = useRef(initialPlasma)
  const redlineTimerRef   = useRef(null)
  const resetIntervalRef  = useRef(null)
  const overloadActiveRef = useRef(false)
  const cbPanelRef        = useRef(null)
  const diagramWrapRef    = useRef(null)

  const [plasmaDensity,  setPlasmaDensity]  = useState(initialPlasma)
  const [redlineActive,  setRedlineActive]  = useState(false)
  const [overloadWarning,setOverloadWarning]= useState(false)

  const audioCtxRef  = useRef(null)
  const gainNodeRef  = useRef(null)
  const sourceNodeRef = useRef(null)

  const fluxValRef = useRef(null)
  const fluxBarRef = useRef(null)
  const capValRef  = useRef(null)
  const capBarRef  = useRef(null)
  const radValRef  = useRef(null)
  const radBarRef  = useRef(null)

  // ── Clear timers ──────────────────────────────────────────────────────────
  const clearTimers = useCallback(() => {
    if (redlineTimerRef.current)  { clearTimeout (redlineTimerRef.current);  redlineTimerRef.current  = null }
    if (resetIntervalRef.current) { clearInterval(resetIntervalRef.current); resetIntervalRef.current = null }
  }, [])

  // ── Overload trigger ──────────────────────────────────────────────────────
  const triggerOverload = useCallback(() => {
    redlineTimerRef.current = null
    overloadActiveRef.current = true
    setOverloadWarning(true)
    // Animate slider back to 75%
    resetIntervalRef.current = setInterval(() => {
      plasmaRef.current = Math.max(75, plasmaRef.current - 1)
      setPlasmaDensity(plasmaRef.current)
      if (plasmaRef.current <= 75) {
        clearInterval(resetIntervalRef.current)
        resetIntervalRef.current = null
        setRedlineActive(false)
      }
    }, 20)
  }, [])

  // ── Slider change ─────────────────────────────────────────────────────────
  const handleSliderChange = useCallback((e) => {
    if (overloadActiveRef.current) return   // locked during reset
    const val = Number(e.target.value)
    plasmaRef.current = val
    setPlasmaDensity(val)

    // Resume AudioContext on first user gesture (browser autoplay policy)
    if (audioCtxRef.current?.state === 'suspended') {
      audioCtxRef.current.resume()
    }

    if (val >= 80) {
      setRedlineActive(true)
      if (!redlineTimerRef.current) {
        redlineTimerRef.current = setTimeout(triggerOverload, 5000)
      }
    } else {
      setRedlineActive(false)
      if (redlineTimerRef.current) { clearTimeout(redlineTimerRef.current); redlineTimerRef.current = null }
    }
  }, [triggerOverload])

  // ── Acknowledge overload ──────────────────────────────────────────────────
  const playClick = useCallback(() => {
    const sfx = new Audio(`${import.meta.env.BASE_URL}click.wav`)
    sfx.volume = 1.0
    sfx.play().catch(() => {})
  }, [])

  const handleAcknowledge = useCallback(() => {
    clearTimers()
    overloadActiveRef.current = false
    setOverloadWarning(false)
    setRedlineActive(false)
  }, [clearTimers])

  // ── RAF / canvas ──────────────────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const fit = () => {
      const rect = canvas.getBoundingClientRect()
      const dpr  = window.devicePixelRatio || 1
      canvas.width  = rect.width  * dpr
      canvas.height = rect.height * dpr
      canvas.getContext('2d').setTransform(dpr, 0, 0, dpr, 0, 0)
    }
    fit()
    window.addEventListener('resize', fit)

    const frame = () => {
      const ctx = canvas.getContext('2d')
      const w = canvas.clientWidth, h = canvas.clientHeight
      rotRef.current.y += 0.004
      drawReactor(ctx, w, h, rotRef.current.x, rotRef.current.y, plasmaRef.current / 100)

      // Update telemetry DOM
      const d  = plasmaRef.current / 100
      const nr = (v, noise) => v + (Math.random() - 0.5) * noise
      const flux = Math.max(0, nr(0.35 + d * 3.85, 0.04))
      const cap  = Math.min(100, Math.max(0, nr(14 + d * 80, 1.0)))
      const rad  = Math.max(0, nr(580 + d * 2950, 25))
      if (fluxValRef.current) fluxValRef.current.textContent = `${flux.toFixed(3)} GW`
      if (fluxBarRef.current) fluxBarRef.current.style.width = `${Math.min(100, flux / 4.2 * 100).toFixed(1)}%`
      if (capValRef.current)  capValRef.current.textContent  = `${cap.toFixed(1)}%`
      if (capBarRef.current)  capBarRef.current.style.width  = `${cap.toFixed(1)}%`
      if (radValRef.current)  radValRef.current.textContent  = `+${rad.toFixed(0)} K`
      const radPct = Math.min(100, (rad - 580) / 2950 * 100)
      if (radBarRef.current)  radBarRef.current.style.width  = `${Math.max(0, radPct).toFixed(1)}%`

      rafRef.current = requestAnimationFrame(frame)
    }
    rafRef.current = requestAnimationFrame(frame)

    return () => {
      cancelAnimationFrame(rafRef.current)
      window.removeEventListener('resize', fit)
    }
  }, [])

  useEffect(() => clearTimers, [clearTimers])

  // ── Scale circuit breakers to fit available height ────────────────────────
  useEffect(() => {
    const panel = cbPanelRef.current
    const wrap  = diagramWrapRef.current
    if (!panel || !wrap) return
    const update = () => {
      panel.style.transform = 'translateY(-50%)'
      requestAnimationFrame(() => {
        const availH = wrap.clientHeight * 0.72
        const scale  = Math.min(1, availH / panel.scrollHeight)
        panel.style.transform = `translateY(-50%) scale(${scale})`
        panel.style.transformOrigin = 'center center'
      })
    }
    const obs = new ResizeObserver(update)
    obs.observe(wrap)
    update()
    return () => obs.disconnect()
  }, [])

  // ── Power audio: seamless loop via Web Audio API ──────────────────────────
  useEffect(() => {
    const ctx  = new (window.AudioContext || window.webkitAudioContext)()
    const gain = ctx.createGain()
    gain.gain.value = 0          // start silent; slider gesture will resume ctx
    gain.connect(ctx.destination)
    audioCtxRef.current = ctx
    gainNodeRef.current = gain

    fetch(`${import.meta.env.BASE_URL}power.flac`)
      .then(r => r.arrayBuffer())
      .then(buf => ctx.decodeAudioData(buf))
      .then(decoded => {
        const src = ctx.createBufferSource()
        src.buffer   = decoded
        src.loop     = true
        src.loopStart = 0
        src.loopEnd   = decoded.duration
        src.connect(gain)
        src.start(0)
        sourceNodeRef.current = src
      })
      .catch(() => {})

    return () => {
      sourceNodeRef.current?.stop()
      ctx.close()
    }
  }, [])

  // Drive volume via gain — no gaps, no restarts
  useEffect(() => {
    const gain = gainNodeRef.current
    if (!gain) return
    gain.gain.setTargetAtTime(
      plasmaDensity >= 25 ? 0.5 : 0,
      gainNodeRef.current.context.currentTime,
      0.1   // 100ms ramp to avoid clicks
    )
  }, [plasmaDensity])

  return (
    <div id="reactor-screen">

      <HudHeader
        onLogout={() => onReturn(plasmaRef.current)}
        center={
          <span className={`status-pill mail-pill${unreadCount > 0 ? ' mail-pill--unread' : ''}`} onClick={onMailOpen}>
            {unreadCount > 0 && <span className="mail-unread-dot" />}
            ✉ IMPERIAL MESSAGING SERVICE // UNREAD: {unreadCount}
          </span>
        }
        right={<span className="label">PNL-007-EXT / PLASMA INTERFACE</span>}
      />

      <main className="reactor-main">

        {/* ── Diagram + slider ────────────────────────────────────────────── */}
        <div className="reactor-diagram-col">
          <div className="reactor-torus-label">D-³He FUSOR REACTOR TORUS</div>
          <div className="reactor-diagram-wrap" ref={diagramWrapRef}>
            <canvas className="reactor-canvas" ref={canvasRef} />

            {/* Circuit breakers overlaid on the left of the torus */}
            <div className="cb-panel" ref={cbPanelRef}>
              <div className="cb-panel-title">CIRCUIT<br/>BREAKERS</div>
              {BREAKERS.map(b => (
                <div
                  key={b.id}
                  className={`cb-item${plasmaDensity >= 25 ? ' cb-closed' : ''}`}
                  style={{ '--cb-delay': `${b.delay}ms` }}
                >
                  <div className="cb-label">{b.label}</div>
                  <div className="cb-body">
                    <div className="cb-top" />
                    <div className="cb-bot" />
                  </div>
                </div>
              ))}
            </div>

            {/* Slider overlaid directly beside the torus */}
            <div className="plasma-slider-wrap">
              <div className="plasma-slider-header">PLASMA DENSITY</div>
              <div className="plasma-pct-display">
                {plasmaDensity}<span className="plasma-pct-unit">%</span>
              </div>

              <div className="plasma-track-outer">
                {/* Redline zone — top 20% (80–100%) */}
                <div className={`plasma-redline-zone${redlineActive ? ' rl-active' : ''}`}>
                  <span className="plasma-redline-label">⚠ REDLINE</span>
                </div>
                <div className="plasma-80-line" />

                {/* Safe zone — middle 70% (10–80%) */}
                <div className="plasma-safe-zone" />

                {/* Low-power threshold line at 10% */}
                <div className="plasma-10-line" />

                {/* Low-power zone — bottom 10% (0–10%) */}
                <div className="plasma-lowpower-zone">
                  <span className="plasma-lowpower-label">LOW</span>
                </div>

                {/* Zone labels to the left of the track */}
                <div className="plasma-zone-label plasma-zone-label--danger" style={{ top: '10%' }}>
                  DANGER ZONE
                </div>
                <div className="plasma-zone-label plasma-zone-label--ideal" style={{ top: '50%' }}>
                  IDEAL POWER
                </div>
                <div className="plasma-zone-label plasma-zone-label--low" style={{ top: '87.5%' }}>
                  LOW POWER
                </div>

                <input
                  type="range"
                  className={`plasma-slider${redlineActive ? ' plasma-slider--redline' : ''}`}
                  orient="vertical"
                  min="0"
                  max="100"
                  value={plasmaDensity}
                  onChange={handleSliderChange}
                  disabled={overloadActiveRef.current}
                />

                {/* Scale labels pinned to the track height */}
                <div className="plasma-scale">
                  <span>100</span>
                  <span>80</span>
                  <span>60</span>
                  <span>40</span>
                  <span>20</span>
                  <span>0</span>
                </div>
              </div>
              <div className={`plasma-adjust-label${plasmaDensity >= 25 && plasmaDensity < 80 ? ' plasma-adjust-label--ideal' : ''}`}>
                ADJUST
              </div>
            </div>
          </div>
          <div className={`reactor-status-label${redlineActive ? ' rsl--overload' : plasmaDensity < 25 ? ' rsl--low' : ' rsl--nominal'}`}>
            {redlineActive ? 'OVERLOAD' : plasmaDensity < 25 ? 'LOW POWER — INCREASE PLASMA' : 'STATUS NOMINAL'}
          </div>
          <button className="monitor-return-btn" onClick={() => { playClick(); onReturn(plasmaRef.current) }} disabled={redlineActive}>RETURN TO INSTALLATION VIEW</button>
        </div>

        {/* ── Status metrics ───────────────────────────────────────────────── */}
        <div className="reactor-status-row">
          <div className="power-cell">
            <div className="pc-label">CORE FLUX</div>
            <div className="pc-value mono" ref={fluxValRef}>—</div>
            <div className="bar"><div className="bar-fill" ref={fluxBarRef} style={{ width: '0%' }} /></div>
          </div>
          <div className="power-cell">
            <div className="pc-label">CAPACITOR BANK</div>
            <div className="pc-value mono" ref={capValRef}>—</div>
            <div className="bar"><div className="bar-fill" ref={capBarRef} style={{ width: '0%' }} /></div>
          </div>
          <div className="power-cell">
            <div className="pc-label">RADIATOR ΔT</div>
            <div className="pc-value mono" ref={radValRef}>—</div>
            <div className="bar"><div className="bar-fill warn" ref={radBarRef} style={{ width: '0%' }} /></div>
          </div>
        </div>
      </main>

      {/* ── Overload warning dialog ──────────────────────────────────────── */}
      {overloadWarning && (
        <>
          <div className="reactor-overload-dim" />
          <div className="reactor-overload-dialog">
            <div className="rod-icon">⚠</div>
            <div className="rod-title">PLASMA OVERLOAD</div>
            <div className="rod-sub">DENSITY EXCEEDS OPERATIONAL THRESHOLD</div>
            <div className="rod-divider" />
            <div className="rod-body">
              Sustained plasma density above 80% for more than 5 seconds has triggered
              emergency containment protocols. Initiating controlled density reduction.
            </div>
            <div className="rod-reset">RESETTING TO 75% NOMINAL DENSITY</div>
            <button className="rod-btn" onClick={handleAcknowledge}>ACKNOWLEDGE</button>
          </div>
        </>
      )}

      <HudFooter>
        <span>HMSS / FCS v6.2.41 / REACTOR CONTROL SUBSYSTEM</span>
        <span className="sep">│</span>
        <span>FUSOR: <em className="ok">NOMINAL</em></span>
        <span className="sep">│</span>
        <span>CONTAINMENT: <em className="ok">STABLE</em></span>
        <span className="sep">│</span>
        <span>PLASMA: <em className={redlineActive ? 'warn' : 'ok'}>{redlineActive ? 'CRITICAL' : 'NOMINAL'}</em></span>
      </HudFooter>

    </div>
  )
}
