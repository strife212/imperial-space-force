import { useRef, useEffect, useState, useCallback } from 'react'
import HudHeader from '../components/HudHeader'
import HudFooter from '../components/HudFooter'

// ── Constants ─────────────────────────────────────────────────────────────────
const INITIAL_DIST   = 112_582_692_623_711
const DIST_PER_SEC   = 269_813
const t0             = Date.now() - 86400_000 * 17 - 3600_000 * 4 - 60_000 * 22

// ── Helpers ───────────────────────────────────────────────────────────────────
const pad    = (n, w = 2) => String(n).padStart(w, '0')
const fmtClk = (ms) => {
  const s = Math.floor(ms / 1000)
  return `${pad(Math.floor(s/86400),3)}:${pad(Math.floor((s%86400)/3600))}:${pad(Math.floor((s%3600)/60))}:${pad(s%60)}`
}
const fmtDist = (n) => Math.round(n).toLocaleString('en-US')
const fmtTTI  = (secs) => {
  if (secs <= 0) return '-- IMPACT --'
  const d = Math.floor(secs / 86400)
  const h = Math.floor((secs % 86400) / 3600)
  const m = Math.floor((secs % 3600) / 60)
  const s = secs % 60
  return d > 0
    ? `${pad(d)}d ${pad(h)}h ${pad(m)}m ${pad(s)}s`
    : `${pad(h)}:${pad(m)}:${pad(s)}`
}

// ── Vec3 math ─────────────────────────────────────────────────────────────────
const cross  = ([ax,ay,az],[bx,by,bz]) => [ay*bz-az*by, az*bx-ax*bz, ax*by-ay*bx]
const norm3  = ([x,y,z])               => { const l=Math.sqrt(x*x+y*y+z*z)||1; return [x/l,y/l,z/l] }
const lerp3  = (a,b,t)                 => [a[0]+(b[0]-a[0])*t, a[1]+(b[1]-a[1])*t, a[2]+(b[2]-a[2])*t]

const rotXY  = ([x,y,z], rx, ry) => {
  const [cy,sy] = [Math.cos(ry), Math.sin(ry)]
  const x1 = x*cy + z*sy, z1 = -x*sy + z*cy
  const [cx,sx] = [Math.cos(rx), Math.sin(rx)]
  return [x1, y*cx - z1*sx, y*sx + z1*cx]
}

const project = ([x,y,z], cx, cy, s) => {
  const d = 9 / (9 + z)
  return [cx + x*s*d, cy - y*s*d]
}

const gcPoints = (n, R=5, segs=128) => {
  const u = Math.abs(n[0]) < 0.9 ? norm3(cross(n,[1,0,0])) : norm3(cross(n,[0,1,0]))
  const v = cross(n, u)
  return Array.from({length: segs+1}, (_,i) => {
    const a = (i/segs)*Math.PI*2
    return [ R*(Math.cos(a)*u[0]+Math.sin(a)*v[0]),
             R*(Math.cos(a)*u[1]+Math.sin(a)*v[1]),
             R*(Math.cos(a)*u[2]+Math.sin(a)*v[2]) ]
  })
}

// ── Scene ─────────────────────────────────────────────────────────────────────
const INST_POS   = [-3.2,  0.8,  1.2]
const TARGET_POS = [ 3.0, -0.6, -2.0]

const SPHERE_NORMALS = [
  norm3([0,1,0]), norm3([1,0,0]), norm3([0,0,1]),
  norm3([1,1,0]), norm3([0,1,1]), norm3([1,0,1]),
  norm3([1,-1,0]),norm3([0,1,-1]),norm3([1,1,1]),
]

const OBJECTS = {
  installation: {
    label: 'HMSS HER ANNUNCIATOR',
    color: '#4090ff',
    size: 7,
    stats: [
      { key: 'RA (J2000)',         value: '14h 29m 43.0s'  },
      { key: 'DEC (J2000)',        value: '+14° 29\' 43"'  },
      { key: 'HELIOCENTR. DIST',   value: '1.000 AU'       },
    ],
  },
  target: {
    label: 'TARGET // CLASSIFIED',
    color: '#ffffff',
    size: 7,
    stats: [
      { key: 'RA (J2000)',         value: '22h 14m 02.3s'  },
      { key: 'DEC (J2000)',        value: '-08° 47\' 21"'  },
      { key: 'HELIOCENTR. DIST',   value: '0.751 AU'       },
    ],
  },
  projectile: {
    label: 'PHYSICS PROJECTILE',
    color: '#ff2020',
    size: 5,
    stats: [
      { key: 'RA (J2000)',         value: '18h 21m 33.7s'  },
      { key: 'DEC (J2000)',        value: '+02° 58\' 14"'  },
      { key: 'REL. VELOCITY',      value: '0.894c'         },
      { key: 'PACKAGE TYPE',       value: '__PKG__'        },
    ],
  },
}

const CANVAS_LABELS = {
  installation: 'HMSS HER ANNUNCIATOR',
  target:       'TARGET',
  projectile:   'PHYSICS PROJECTILE',
}

// ── Chronicle messages ────────────────────────────────────────────────────────
const CHRONICLE_MSGS = [
  'GEODESIC LOCK CONFIRMED — KERR METRIC SOLUTION STABLE',
  'APHELION CROSSING // TRAJECTORY NOMINAL',
  'RELATIVISTIC DRIFT WITHIN TOLERANCE — Δθ = 0.0003 rad',
  'TACHYON SHADOW NOMINAL — TELEMETRY UNINTERRUPTED',
  'LORENTZ CONTRACTION FACTOR γ = 4.21 — CONFIRMED',
  'GRAVITATIONAL LENS CORRECTION APPLIED',
  'SOLAR WIND PERTURBATION COMPENSATED // Δv = 0.12 m·s⁻¹',
  'SHAPIRO DELAY LOGGED — +412 µs',
  'FRAME-DRAGGING PRECESSION NOMINAL',
  'PHASE-SPACE TRAJECTORY LOCKED',
  'IMPACT PARAMETER b WITHIN KILL RADIUS',
  'CAUSALITY PRESERVATION CONFIRMED',
  'SCHWARZSCHILD RADIUS CLEARANCE: NOMINAL',
  'THERMAL SIGNATURE ACQUISITION STABLE',
  'GEODESIC SOLUTION VERIFIED — 98.7% CONFIDENCE',
  'RELATIVISTIC KE: 4.21 × 10⁴² J — NOMINAL',
  'LORENTZ BOOST STABLE — NO FRAME VIOLATION',
  'GR TIME DILATION FACTOR: 0.994 — WITHIN SPEC',
  'COURSE CORRECTION WINDOW: CLOSED',
  'HOSTILE INTERCEPT PROBABILITY: NEGLIGIBLE',
]

const mkTimestamp = () => {
  const d = new Date()
  return `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}`
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function LaunchMonitorScreen({ onReturn, onLogout, packageName, targetName = 'CLASSIFIED', unreadCount = 0, onMailOpen }) {
  const canvasRef      = useRef(null)
  const rotRef         = useRef({ x: 0.518, y: -1.240 })
  const rotDisplayRef  = useRef(null)
  const dragging       = useRef(false)
  const lastMPos       = useRef({ x: 0, y: 0 })
  const distRef        = useRef(INITIAL_DIST)
  const rafRef         = useRef(null)
  const projPosRef     = useRef({})
  const blinkOn        = useRef(true)
  const lastBlinkT     = useRef(0)
  const chronicleLogRef = useRef(null)
  const utcRef          = useRef(null)
  const impactProbRef  = useRef(97.4)
  const onReturnRef    = useRef(onReturn)
  useEffect(() => { onReturnRef.current = onReturn }, [onReturn])

  const playClick = useCallback(() => {
    const sfx = new Audio(`${import.meta.env.BASE_URL}click.wav`)
    sfx.volume = 1.0
    sfx.play().catch(() => {})
  }, [])

  const [distance,    setDistance]    = useState(INITIAL_DIST)
  const [clock,       setClock]       = useState(fmtClk(Date.now() - t0))
  const [hovered,     setHovered]     = useState(null)
  const [hoverXY,     setHoverXY]     = useState({ x: 0, y: 0 })
  const [impactProb,  setImpactProb]  = useState(97.4)
  const [chronicle,   setChronicle]   = useState([
    { ts: mkTimestamp(), msg: 'GEODESIC INTERCEPT SOLUTION COMMITTED' },
    { ts: mkTimestamp(), msg: 'PHYSICS PROJECTILE // PACKAGE AWAY' },
    { ts: mkTimestamp(), msg: 'TRAJECTORY ACQUISITION NOMINAL' },
  ])

  // Distance countdown + impact prob drift
  useEffect(() => {
    const iv = setInterval(() => {
      distRef.current = Math.max(0, distRef.current - DIST_PER_SEC)
      setDistance(distRef.current)
      impactProbRef.current = Math.min(99.9, Math.max(94.0,
        impactProbRef.current + (Math.random() - 0.48) * 0.06
      ))
      setImpactProb(impactProbRef.current)
    }, 1000)
    return () => clearInterval(iv)
  }, [])

  // Mission clock + UTC
  useEffect(() => {
    const tick = () => {
      setClock(fmtClk(Date.now() - t0))
      if (utcRef.current) {
        const d = new Date()
        const iso = d.toISOString()
        utcRef.current.textContent = `UTC ${iso.slice(0, 10)} ${iso.slice(11, 23)}`
      }
    }
    const iv = setInterval(tick, 1000)
    tick()
    return () => clearInterval(iv)
  }, [])

  // Chronicle log
  useEffect(() => {
    const used = new Set([0, 1, 2]) // indices already shown as initial msgs
    const remaining = CHRONICLE_MSGS.filter((_, i) => !used.has(i))
    let pool = [...remaining]
    let timeoutId
    const scheduleNext = () => {
      const delay = 5000 + Math.random() * 6000
      timeoutId = setTimeout(() => {
        if (pool.length === 0) pool = [...CHRONICLE_MSGS]
        const idx = Math.floor(Math.random() * pool.length)
        const msg = pool.splice(idx, 1)[0]
        setChronicle(prev => [...prev.slice(-29), { ts: mkTimestamp(), msg }])
        scheduleNext()
      }, delay)
    }
    scheduleNext()
    return () => clearTimeout(timeoutId)
  }, [])

  // Auto-scroll chronicle log
  useEffect(() => {
    if (chronicleLogRef.current) {
      chronicleLogRef.current.scrollTop = chronicleLogRef.current.scrollHeight
    }
  }, [chronicle])

  // Canvas draw loop
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')

    const resize = () => {
      canvas.width  = canvas.offsetWidth
      canvas.height = canvas.offsetHeight
    }
    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(canvas)

    const drawFrame = (ts) => {
      if (ts - lastBlinkT.current > 500) {
        blinkOn.current  = !blinkOn.current
        lastBlinkT.current = ts
      }

      const W = canvas.width, H = canvas.height
      const cx = W/2, cy = H/2
      const s  = Math.min(W, H) * 0.075
      const { x: rx, y: ry } = rotRef.current

      ctx.clearRect(0, 0, W, H)

      // Update rotation display
      if (rotDisplayRef.current) {
        const fmt = (v) => (v >= 0 ? '+' : '') + v.toFixed(3)
        rotDisplayRef.current.textContent = `X ${fmt(rx)}  Y ${fmt(ry)}  rad`
      }

      // Reference sphere
      SPHERE_NORMALS.forEach(n => {
        const pts = gcPoints(n)
        ctx.beginPath()
        pts.forEach((p, i) => {
          const [sx, sy] = project(rotXY(p, rx, ry), cx, cy, s)
          if (i === 0) ctx.moveTo(sx, sy); else ctx.lineTo(sx, sy)
        })
        ctx.strokeStyle = 'rgba(100,180,255,0.40)'
        ctx.lineWidth   = 1.2
        ctx.stroke()
      })

      // Projectile position (starts 3% along for visual clarity)
      const elapsed  = (INITIAL_DIST - distRef.current) / INITIAL_DIST
      const projFrac = Math.max(0.03, elapsed)
      const proj3    = lerp3(INST_POS, TARGET_POS, projFrac)

      // Rotate + project objects
      const rInst = rotXY(INST_POS,   rx, ry)
      const rTarg = rotXY(TARGET_POS, rx, ry)
      const rProj = rotXY(proj3,      rx, ry)

      const pInst = project(rInst, cx, cy, s)
      const pTarg = project(rTarg, cx, cy, s)
      const pProj = project(rProj, cx, cy, s)

      projPosRef.current = {
        installation: pInst,
        target:       pTarg,
        projectile:   pProj,
      }

      // Trajectory line
      ctx.beginPath()
      ctx.moveTo(pInst[0], pInst[1])
      ctx.lineTo(pTarg[0], pTarg[1])
      ctx.strokeStyle = 'rgba(255,255,255,0.55)'
      ctx.lineWidth   = 1.8
      ctx.setLineDash([4, 7])
      ctx.stroke()
      ctx.setLineDash([])

      // Draw objects back-to-front by Z
      const objs = [
        { key: 'installation', r: rInst, p: pInst },
        { key: 'target',       r: rTarg, p: pTarg },
        { key: 'projectile',   r: rProj, p: pProj },
      ].sort((a, b) => a.r[2] - b.r[2])

      objs.forEach(({ key, p: [sx, sy] }) => {
        const def = OBJECTS[key]
        if (key === 'projectile' && !blinkOn.current) return

        ctx.save()
        ctx.shadowBlur  = 24
        ctx.shadowColor = def.color
        ctx.beginPath()
        ctx.arc(sx, sy, def.size, 0, Math.PI*2)
        ctx.fillStyle = def.color
        ctx.fill()
        ctx.restore()

        // Label
        ctx.save()
        ctx.font      = '10px monospace'
        ctx.fillStyle = def.color
        ctx.globalAlpha = 0.85
        ctx.fillText(CANVAS_LABELS[key], sx + def.size + 6, sy - 4)
        ctx.restore()
      })

      rafRef.current = requestAnimationFrame(drawFrame)
    }

    rafRef.current = requestAnimationFrame(drawFrame)
    return () => { cancelAnimationFrame(rafRef.current); ro.disconnect() }
  }, [])

  // Drag rotation
  const onMouseDown = useCallback((e) => {
    dragging.current = true
    lastMPos.current = { x: e.clientX, y: e.clientY }
  }, [])

  const onMouseMove = useCallback((e) => {
    if (dragging.current) {
      rotRef.current.y += (e.clientX - lastMPos.current.x) * 0.006
      rotRef.current.x += (e.clientY - lastMPos.current.y) * 0.006
      lastMPos.current  = { x: e.clientX, y: e.clientY }
    }

    // Hover detection
    const rect = canvasRef.current?.getBoundingClientRect()
    if (!rect) return
    const mx = e.clientX - rect.left
    const my = e.clientY - rect.top
    let found = null
    for (const [key, [sx, sy]] of Object.entries(projPosRef.current)) {
      if (Math.hypot(mx - sx, my - sy) < 22) { found = key; break }
    }
    setHovered(found)
    if (found) setHoverXY({ x: e.clientX, y: e.clientY })
  }, [])

  const onMouseUp = useCallback(() => { dragging.current = false }, [])

  const ttiSecs   = Math.round(distance / DIST_PER_SEC)
  const distStr   = fmtDist(distance)
  const prevDistRef    = useRef(distStr)
  const digitVersions  = useRef({})
  if (distStr !== prevDistRef.current) {
    const prev = prevDistRef.current
    for (let i = 0; i < distStr.length; i++) {
      if (distStr[i] !== (prev[i] ?? '')) {
        digitVersions.current[i] = (digitVersions.current[i] || 0) + 1
      }
    }
    prevDistRef.current = distStr
  }

  return (
    <div id="monitor-screen">
      <HudHeader
        onLogout={onLogout}
        center={
          <span className={`status-pill mail-pill${unreadCount > 0 ? ' mail-pill--unread' : ''}`} onClick={onMailOpen}>
            {unreadCount > 0 && <span className="mail-unread-dot" />}
            ✉ IMPERIAL MESSAGING SERVICE // UNREAD: {unreadCount}
          </span>
        }
        right={<><span className="label">MISSION CLOCK T+</span><span className="mono big">{clock}</span></>}
      />

      <main className="monitor-main">
        <div className="monitor-title">LAUNCH MONITORING // TRAJECTORY TRACKING ACTIVE</div>

        <div className="monitor-middle">

          {/* ── Intercept solution panel ── */}
          <div className="monitor-side-panel">
            <div className="msp-header">INTERCEPT SOLUTION</div>
            <div className="msp-body">
              <div className="msp-row">
                <span className="msp-key">TIME TO INTERCEPT</span>
                <span className="msp-val tti">{fmtTTI(ttiSecs)}</span>
              </div>
              <div className="msp-divider" />
              <div className="msp-row">
                <span className="msp-key">CLOSING VELOCITY</span>
                <span className="msp-val">269,813 km/s</span>
              </div>
              <div className="msp-row">
                <span className="msp-key">REL. VELOCITY</span>
                <span className="msp-val">0.9003c</span>
              </div>
              <div className="msp-divider" />
              <div className="msp-row">
                <span className="msp-key">IMPACT PROB.</span>
                <span className="msp-val ok">{impactProb.toFixed(1)}%</span>
              </div>
              <div className="msp-row">
                <span className="msp-key">GEODESIC TYPE</span>
                <span className="msp-val">TIMELIKE / UNBOUND</span>
              </div>
              <div className="msp-divider" />
              <div className="msp-row">
                <span className="msp-key">IMPACT PARAMETER b</span>
                <span className="msp-val">2.84 r_s</span>
              </div>
              <div className="msp-row">
                <span className="msp-key">SCHW. CORRECTION</span>
                <span className="msp-val">+0.003°</span>
              </div>
              <div className="msp-row">
                <span className="msp-key">LORENTZ FACTOR γ</span>
                <span className="msp-val">4.214</span>
              </div>
              <div className="msp-row">
                <span className="msp-key">FIRING SOLUTION</span>
                <span className="msp-val ok">CONVERGED</span>
              </div>
            </div>
          </div>

          {/* ── Canvas ── */}
          <div
            className="monitor-canvas-wrap"
            onMouseDown={onMouseDown}
            onMouseMove={onMouseMove}
            onMouseUp={onMouseUp}
            onMouseLeave={onMouseUp}
          >
            <canvas ref={canvasRef} className="monitor-canvas" />

            <div className="monitor-rot-display" ref={rotDisplayRef} />
            <div className="monitor-canvas-hint">Click &amp; drag to rotate</div>

            <div className="monitor-legend">
              {Object.entries(OBJECTS).map(([key, def]) => (
                <div key={key} className="monitor-legend-row">
                  <span className="monitor-legend-dot" style={{ background: def.color, boxShadow: `0 0 6px ${def.color}` }} />
                  <span className="monitor-legend-label">{CANVAS_LABELS[key]}</span>
                </div>
              ))}
            </div>

            {hovered && OBJECTS[hovered] && (
              <div className="monitor-infobox" style={{ left: hoverXY.x + 18, top: hoverXY.y - 16 }}>
                <div className="mib-title" style={{ color: OBJECTS[hovered].color }}>
                  {hovered === 'target' ? `TARGET // ${targetName}` : OBJECTS[hovered].label}
                </div>
                <div className="mib-divider" />
                {OBJECTS[hovered].stats.map(({ key, value }) => (
                  <div key={key} className="mib-row">
                    <span className="mib-key">{key}</span>
                    <span className="mib-val">{value === '__PKG__' ? (packageName || 'CLASSIFIED') : value}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ── Chronicle log panel ── */}
          <div className="monitor-side-panel">
            <div className="msp-header">PROJECTILE TELEMETRY LOG</div>
            <div className="msp-body chronicle-body" ref={chronicleLogRef}>
              {chronicle.map((entry, i) => (
                <div key={i} className="chronicle-row">
                  <span className="chronicle-ts">{entry.ts}</span>
                  <span className="chronicle-msg">{entry.msg}</span>
                </div>
              ))}
            </div>
          </div>

        </div>

        <div className="monitor-bottom">
          <div className="monitor-dist-section">
            <div className="monitor-dist-label">DISTANCE TO TARGET</div>
            <div className="monitor-dist-value">
            {distStr.split('').map((char, i) =>
              char === ',' ? (
                <span key={i} className="dist-comma">{char}</span>
              ) : (
                <span key={`${i}-${digitVersions.current[i] || 0}`} className="dist-digit">{char}</span>
              )
            )}
            <span className="monitor-dist-unit">km</span>
          </div>
          </div>
          <button className="monitor-return-btn" onClick={() => { playClick(); onReturn() }}>
            RETURN TO INSTALLATION VIEW
          </button>
        </div>
      </main>

      <HudFooter>
        <span>HMSS / FCS v6.2.41 / GR-CORRECTED FIRE-CONTROL</span>
        <span className="sep">│</span>
        <span>UPLINK: <em className="ok">SECURE 256-QKD</em></span>
        <span className="sep">│</span>
        <span>OPERATOR: <em>HIH V. ASTRAIA // CLR-Ω</em></span>
        <span className="sep">│</span>
        <span ref={utcRef} />
      </HudFooter>
    </div>
  )
}
