import { useRef, useEffect, useState, useCallback } from 'react'

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
    ],
  },
}

const CANVAS_LABELS = {
  installation: 'HMSS HER ANNUNCIATOR',
  target:       'TARGET',
  projectile:   'PHYSICS PROJECTILE',
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function LaunchMonitorScreen({ onReturn }) {
  const canvasRef   = useRef(null)
  const rotRef      = useRef({ x: 0.35, y: -0.4 })
  const dragging    = useRef(false)
  const lastMPos    = useRef({ x: 0, y: 0 })
  const distRef     = useRef(INITIAL_DIST)
  const rafRef      = useRef(null)
  const projPosRef  = useRef({})
  const blinkOn     = useRef(true)
  const lastBlinkT  = useRef(0)
  const onLaunchCompleteRef = useRef(onReturn)
  useEffect(() => { onLaunchCompleteRef.current = onReturn }, [onReturn])

  const [distance, setDistance] = useState(INITIAL_DIST)
  const [clock,    setClock]    = useState(fmtClk(Date.now() - t0))
  const [hovered,  setHovered]  = useState(null)
  const [hoverXY,  setHoverXY]  = useState({ x: 0, y: 0 })

  // Distance countdown
  useEffect(() => {
    const iv = setInterval(() => {
      distRef.current = Math.max(0, distRef.current - DIST_PER_SEC)
      setDistance(distRef.current)
    }, 1000)
    return () => clearInterval(iv)
  }, [])

  // Mission clock
  useEffect(() => {
    const iv = setInterval(() => setClock(fmtClk(Date.now() - t0)), 1000)
    return () => clearInterval(iv)
  }, [])

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

      // Reference sphere
      SPHERE_NORMALS.forEach(n => {
        const pts = gcPoints(n)
        ctx.beginPath()
        pts.forEach((p, i) => {
          const [sx, sy] = project(rotXY(p, rx, ry), cx, cy, s)
          if (i === 0) ctx.moveTo(sx, sy); else ctx.lineTo(sx, sy)
        })
        ctx.strokeStyle = 'rgba(40,100,220,0.65)'
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
      ctx.strokeStyle = 'rgba(255,255,255,0.13)'
      ctx.lineWidth   = 1
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

  const onMouseUp   = useCallback(() => { dragging.current = false }, [])

  return (
    <div id="monitor-screen">
      <header className="hud-header">
        <div className="header-left">
          <span className="brand">⬢ IMPERIAL SPACE FORCE // HMSS &quot;HER ANNUNCIATOR&quot;</span>
        </div>
        <div className="header-center">
          <span className="status-pill armed">DEFCON-2 // WEAPONS HOT</span>
        </div>
        <div className="header-right">
          <span className="label">MISSION CLOCK T+</span>
          <span className="mono big">{clock}</span>
        </div>
      </header>

      <main className="monitor-main">
        <div className="monitor-title">LAUNCH MONITORING // TRAJECTORY TRACKING ACTIVE</div>

        <div
          className="monitor-canvas-wrap"
          onMouseDown={onMouseDown}
          onMouseMove={onMouseMove}
          onMouseUp={onMouseUp}
          onMouseLeave={onMouseUp}
        >
          <canvas ref={canvasRef} className="monitor-canvas" />

          <div className="monitor-canvas-hint">Click &amp; drag to rotate</div>

          {hovered && OBJECTS[hovered] && (
            <div className="monitor-infobox" style={{ left: hoverXY.x + 18, top: hoverXY.y - 16 }}>
              <div className="mib-title" style={{ color: OBJECTS[hovered].color }}>
                {OBJECTS[hovered].label}
              </div>
              <div className="mib-divider" />
              {OBJECTS[hovered].stats.map(({ key, value }) => (
                <div key={key} className="mib-row">
                  <span className="mib-key">{key}</span>
                  <span className="mib-val">{value}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="monitor-dist-section">
          <div className="monitor-dist-label">DISTANCE TO TARGET</div>
          <div className="monitor-dist-value">{fmtDist(distance)} <span className="monitor-dist-unit">km</span></div>
        </div>

        <button className="monitor-return-btn" onClick={onReturn}>
          RETURN TO INSTALLATION VIEW
        </button>
      </main>
    </div>
  )
}
