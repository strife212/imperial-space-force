import { useRef, useEffect, useState, useCallback, useMemo } from 'react'
import HudHeader from '../components/HudHeader'
import HudFooter from '../components/HudFooter'
import { SYSTEMS, TARGETS, findTargetIdx, getTargetInfo } from '../lib/planetData'
import { setFlag } from '../lib/store'

const CANVAS_SIZE = 600
const STAR_R      = 16
const PIX_MIN     = 42
const PIX_MAX     = 272

// ── colour helpers ────────────────────────────────────────────────────────────
function hexToRgb(hex) {
  return [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)]
}
function lighten(hex, t) {
  const [r, g, b] = hexToRgb(hex)
  return `rgb(${Math.round(r+(255-r)*t)},${Math.round(g+(255-g)*t)},${Math.round(b+(255-b)*t)})`
}
function darken(hex, t) {
  const [r, g, b] = hexToRgb(hex)
  return `rgb(${Math.round(r*(1-t))},${Math.round(g*(1-t))},${Math.round(b*(1-t))})`
}

// ── orbit-radius scaler per system ────────────────────────────────────────────
function computeOrbits(system) {
  const planets = system.planets
  if (planets.length === 0) return []
  if (planets.length === 1) return [180]
  const logs = planets.map(p => Math.log(p.distAU))
  const lmin = Math.min(...logs), lmax = Math.max(...logs)
  return planets.map(p => {
    const t = (Math.log(p.distAU) - lmin) / (lmax - lmin)
    return PIX_MIN + t * (PIX_MAX - PIX_MIN)
  })
}

// ── static starfield ─────────────────────────────────────────────────────────
function makeStars(n = 200) {
  return Array.from({ length: n }, () => ({
    x: Math.random() * CANVAS_SIZE,
    y: Math.random() * CANVAS_SIZE,
    r: Math.random() * 1.1 + 0.2,
    a: 0.25 + Math.random() * 0.65,
  }))
}

// ── star sphere sub-component ─────────────────────────────────────────────────
function StarSphere({ sun, size = 110 }) {
  const ref = useRef(null)

  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    const cx = size / 2, cy = size / 2, r = size / 2 - 8
    const [sr, sg, sb] = hexToRgb(sun.color)

    ctx.clearRect(0, 0, size, size)

    const corona = ctx.createRadialGradient(cx, cy, r * 0.6, cx, cy, r * 1.55)
    corona.addColorStop(0,   `rgba(${sr},${sg},${sb},0.30)`)
    corona.addColorStop(0.5, `rgba(${sr},${sg},${sb},0.12)`)
    corona.addColorStop(1,   `rgba(${sr},${sg},${sb},0)`)
    ctx.beginPath(); ctx.arc(cx, cy, r * 1.55, 0, Math.PI * 2)
    ctx.fillStyle = corona; ctx.fill()

    const body = ctx.createRadialGradient(cx - r * 0.28, cy - r * 0.28, 0, cx, cy, r)
    body.addColorStop(0,    lighten(sun.color, 0.7))
    body.addColorStop(0.35, sun.color)
    body.addColorStop(1,    darken(sun.color, 0.55))
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2)
    ctx.fillStyle = body; ctx.fill()
  }, [sun, size])

  return <canvas ref={ref} width={size} height={size} className="targeting-sphere-canvas" />
}

// ── planet/moon sphere sub-component ──────────────────────────────────────────
function PlanetSphere({ planet, size = 110 }) {
  const ref = useRef(null)

  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    const cx = size / 2, cy = size / 2, r = size / 2 - 5

    ctx.clearRect(0, 0, size, size)

    const base = ctx.createRadialGradient(cx - r * 0.35, cy - r * 0.35, r * 0.05, cx, cy, r)
    base.addColorStop(0,   lighten(planet.color, 0.55))
    base.addColorStop(0.5, planet.color)
    base.addColorStop(1,   darken(planet.color, 0.65))
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2)
    ctx.fillStyle = base; ctx.fill()

    const spec = ctx.createRadialGradient(cx - r * 0.28, cy - r * 0.32, 0, cx - r * 0.15, cy - r * 0.2, r * 0.45)
    spec.addColorStop(0, 'rgba(255,255,255,0.55)')
    spec.addColorStop(1, 'rgba(255,255,255,0)')
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2)
    ctx.fillStyle = spec; ctx.fill()

    const limb = ctx.createRadialGradient(cx, cy, r * 0.65, cx, cy, r)
    limb.addColorStop(0, 'rgba(0,0,0,0)')
    limb.addColorStop(1, 'rgba(0,0,0,0.55)')
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2)
    ctx.fillStyle = limb; ctx.fill()
  }, [planet, size])

  return <canvas ref={ref} width={size} height={size} className="targeting-sphere-canvas" />
}

// ── main component ────────────────────────────────────────────────────────────
export default function TargetingScreen({ onBack, initialSelectedIdx = -1, unreadCount = 0, onMailOpen }) {
  const canvasRef  = useRef(null)
  const scalerRef  = useRef(null)

  // Always open on the Novaraya System regardless of which target was previously selected
  const [currentSystemId, setCurrentSystemId] = useState('throne-system')
  const currentSystem = useMemo(() => SYSTEMS.find(s => s.id === currentSystemId), [currentSystemId])

  // Per-system angle state — kept in refs across system switches so motion resumes naturally.
  // angleStateRef.current[systemId] = { planetAngles: number[], moonAngles: number[][] }
  const angleStateRef = useRef(
    Object.fromEntries(SYSTEMS.map(sys => [sys.id, {
      planetAngles: sys.planets.map((_, i) => (i * Math.PI * 2.3) / Math.max(1, sys.planets.length)),
      moonAngles:   sys.planets.map(p => p.moons.map((_, j) => (j * Math.PI * 1.7))),
    }]))
  )

  const stateRef = useRef({
    lastTime: null,
    playing:  true,
    hovered:  -1,                  // flat TARGETS index, or -1
    selected: initialSelectedIdx,  // flat TARGETS index, or -1
    stars:    makeStars(),
  })

  const [hoveredIdx,  setHoveredIdx]  = useState(-1)
  const [selectedIdx, setSelectedIdx] = useState(initialSelectedIdx)
  const [isPlaying,   setIsPlaying]   = useState(true)

  // Orbit radii for the current system
  const orbitRadii = useMemo(() => computeOrbits(currentSystem), [currentSystem])

  // ── Scale to fit small viewports ─────────────────────────────────────────
  const NATURAL_H = 850
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

  // Seeing the orbital map unlocks the throneworld and world engine encyclopedia entries
  useEffect(() => {
    setFlag('throneworldTargeted', true)
    setFlag('worldengineTargeted', true)
  }, [])

  // panel shows selected target; falls back to hovered if nothing locked
  const displayIdx     = selectedIdx !== -1 ? selectedIdx : hoveredIdx
  const displayTarget  = displayIdx >= 0 ? TARGETS[displayIdx] : null
  const displayParent  = displayTarget?.kind === 'moon' ? displayTarget.planet : null

  // ── draw ──────────────────────────────────────────────────────────────────
  const draw = useCallback((ctx) => {
    const { hovered, selected, stars } = stateRef.current
    const sys = currentSystem
    const angles = angleStateRef.current[sys.id]
    const CX = CANVAS_SIZE / 2, CY = CANVAS_SIZE / 2

    // background
    ctx.fillStyle = '#010208'
    ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE)

    // starfield
    stars.forEach(s => {
      ctx.beginPath()
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2)
      ctx.fillStyle = `rgba(200,220,255,${s.a})`
      ctx.fill()
    })

    // resolve hovered/selected to {kind, idx_in_system, moonIdx?} for this system
    const resolve = (flatIdx) => {
      const t = TARGETS[flatIdx]
      if (!t || t.systemId !== sys.id) return null
      if (t.kind === 'sun')    return { kind: 'sun' }
      if (t.kind === 'planet') return { kind: 'planet', pIdx: sys.planets.indexOf(t.body) }
      if (t.kind === 'moon')   {
        const pIdx = sys.planets.indexOf(t.planet)
        const mIdx = t.planet.moons.indexOf(t.body)
        return { kind: 'moon', pIdx, mIdx }
      }
      return null
    }
    const hov = resolve(hovered)
    const sel = resolve(selected)

    // planet orbit rings
    sys.planets.forEach((_, i) => {
      const isHov = hov?.kind === 'planet' && hov.pIdx === i
      const isSel = sel?.kind === 'planet' && sel.pIdx === i
      ctx.beginPath()
      ctx.arc(CX, CY, orbitRadii[i], 0, Math.PI * 2)
      if (isHov) {
        ctx.strokeStyle = 'rgba(120,180,255,0.55)'
        ctx.lineWidth = 1
        ctx.setLineDash([])
      } else if (isSel) {
        ctx.strokeStyle = 'rgba(255,220,80,0.45)'
        ctx.lineWidth = 1
        ctx.setLineDash([])
      } else {
        ctx.strokeStyle = 'rgba(80,120,220,0.32)'
        ctx.lineWidth = 1
        ctx.setLineDash([3, 6])
      }
      ctx.stroke()
      ctx.setLineDash([])
    })

    // star glow
    const [sunR, sunG, sunB] = hexToRgb(sys.sun.color)
    const glow = ctx.createRadialGradient(CX, CY, 0, CX, CY, 60)
    glow.addColorStop(0,   `rgba(${sunR},${sunG},${sunB},0.28)`)
    glow.addColorStop(0.5, `rgba(${sunR},${sunG},${sunB},0.10)`)
    glow.addColorStop(1,   `rgba(${sunR},${sunG},${sunB},0)`)
    ctx.beginPath(); ctx.arc(CX, CY, 60, 0, Math.PI * 2)
    ctx.fillStyle = glow; ctx.fill()

    // star body
    const sunGrad = ctx.createRadialGradient(CX - 4, CY - 4, 0, CX, CY, STAR_R)
    sunGrad.addColorStop(0,    lighten(sys.sun.color, 0.7))
    sunGrad.addColorStop(0.4,  sys.sun.color)
    sunGrad.addColorStop(1,    darken(sys.sun.color, 0.55))
    ctx.beginPath(); ctx.arc(CX, CY, STAR_R, 0, Math.PI * 2)
    ctx.fillStyle = sunGrad; ctx.fill()

    // sun hover / selection ring
    const sunHov = hov?.kind === 'sun'
    const sunSel = sel?.kind === 'sun'
    if (sunHov || sunSel) {
      ctx.beginPath(); ctx.arc(CX, CY, STAR_R + 5, 0, Math.PI * 2)
      if (sunSel && !sunHov) {
        ctx.strokeStyle = 'rgba(255,220,80,0.80)'
        ctx.setLineDash([3, 4])
      } else {
        ctx.strokeStyle = 'rgba(255,255,255,0.65)'
      }
      ctx.lineWidth = 1.5
      ctx.stroke()
      ctx.setLineDash([])
    }

    // uniform diagram colour for bodies
    const dc = '100,160,240'

    // planets (+ moons)
    sys.planets.forEach((p, i) => {
      const angle = angles.planetAngles[i]
      const ox = CX + orbitRadii[i] * Math.cos(angle)
      const oy = CY + orbitRadii[i] * Math.sin(angle)
      const isHov = hov?.kind === 'planet' && hov.pIdx === i
      const isSel = sel?.kind === 'planet' && sel.pIdx === i

      const [r, g, b] = hexToRgb(p.color)

      if (isHov) {
        const hg = ctx.createRadialGradient(ox, oy, 0, ox, oy, p.r + 20)
        hg.addColorStop(0, `rgba(${dc},0.25)`)
        hg.addColorStop(1, `rgba(${dc},0)`)
        ctx.beginPath(); ctx.arc(ox, oy, p.r + 20, 0, Math.PI * 2)
        ctx.fillStyle = hg; ctx.fill()
      }

      // planet body
      ctx.beginPath(); ctx.arc(ox, oy, p.r, 0, Math.PI * 2)
      ctx.fillStyle = `rgba(${dc},0.07)`
      ctx.fill()
      ctx.strokeStyle = `rgba(${dc},0.75)`
      ctx.lineWidth = 2.5
      ctx.stroke()

      if (isHov) {
        ctx.beginPath(); ctx.arc(ox, oy, p.r + 4, 0, Math.PI * 2)
        ctx.strokeStyle = `rgba(${dc},0.55)`
        ctx.lineWidth = 1
        ctx.stroke()
      }
      if (isSel) {
        ctx.beginPath(); ctx.arc(ox, oy, p.r + (isHov ? 8 : 6), 0, Math.PI * 2)
        ctx.strokeStyle = 'rgba(255,220,80,0.80)'
        ctx.lineWidth = 1
        ctx.setLineDash([3, 4])
        ctx.stroke()
        ctx.setLineDash([])
      }

      // planet name label
      const dx = ox - CX, dy = oy - CY
      const dist = Math.hypot(dx, dy) || 1
      const nx = dx / dist, ny = dy / dist
      const labelOffset = p.r + 7
      ctx.font = '500 10px "Cascadia Mono", Consolas, monospace'
      ctx.textBaseline = 'middle'
      ctx.textAlign = nx >= 0 ? 'left' : 'right'
      ctx.fillStyle = `rgba(${r},${g},${b},${isHov || isSel ? 0.95 : 0.65})`
      ctx.fillText(p.name, ox + nx * labelOffset, oy + ny * labelOffset)

      // ── moons ──────────────────────────────────────────────────────────────
      p.moons.forEach((m, j) => {
        const mAngle = angles.moonAngles[i][j]
        const mx = ox + m.orbitR * Math.cos(mAngle)
        const my = oy + m.orbitR * Math.sin(mAngle)
        const mHov = hov?.kind === 'moon' && hov.pIdx === i && hov.mIdx === j
        const mSel = sel?.kind === 'moon' && sel.pIdx === i && sel.mIdx === j

        // moon orbit ring (around planet)
        ctx.beginPath()
        ctx.arc(ox, oy, m.orbitR, 0, Math.PI * 2)
        if (mHov) {
          ctx.strokeStyle = 'rgba(120,180,255,0.55)'
          ctx.setLineDash([])
        } else if (mSel) {
          ctx.strokeStyle = 'rgba(255,220,80,0.40)'
          ctx.setLineDash([])
        } else {
          ctx.strokeStyle = 'rgba(80,120,220,0.22)'
          ctx.setLineDash([2, 4])
        }
        ctx.lineWidth = 1
        ctx.stroke()
        ctx.setLineDash([])

        // moon hover glow
        if (mHov) {
          const hg = ctx.createRadialGradient(mx, my, 0, mx, my, m.r + 14)
          hg.addColorStop(0, `rgba(${dc},0.25)`)
          hg.addColorStop(1, `rgba(${dc},0)`)
          ctx.beginPath(); ctx.arc(mx, my, m.r + 14, 0, Math.PI * 2)
          ctx.fillStyle = hg; ctx.fill()
        }

        // moon body
        ctx.beginPath(); ctx.arc(mx, my, m.r, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(${dc},0.07)`
        ctx.fill()
        ctx.strokeStyle = `rgba(${dc},0.75)`
        ctx.lineWidth = 1.5
        ctx.stroke()

        if (mSel) {
          ctx.beginPath(); ctx.arc(mx, my, m.r + (mHov ? 6 : 5), 0, Math.PI * 2)
          ctx.strokeStyle = 'rgba(255,220,80,0.80)'
          ctx.lineWidth = 1
          ctx.setLineDash([3, 4])
          ctx.stroke()
          ctx.setLineDash([])
        }

        // moon label
        const mdx = mx - ox, mdy = my - oy
        const mdist = Math.hypot(mdx, mdy) || 1
        const mnx = mdx / mdist, mny = mdy / mdist
        const [mr, mg, mb] = hexToRgb(m.color)
        ctx.font = '500 9px "Cascadia Mono", Consolas, monospace'
        ctx.textAlign = mnx >= 0 ? 'left' : 'right'
        ctx.fillStyle = `rgba(${mr},${mg},${mb},${mHov || mSel ? 0.95 : 0.60})`
        ctx.fillText(m.name, mx + mnx * (m.r + 5), my + mny * (m.r + 5))
      })
    })
  }, [currentSystem, orbitRadii])

  // ── RAF loop ─────────────────────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    let rafId

    const loop = (ts) => {
      const s = stateRef.current
      const sys = currentSystem
      const angles = angleStateRef.current[sys.id]
      if (s.lastTime !== null && s.playing) {
        const dt = Math.min(ts - s.lastTime, 100)
        sys.planets.forEach((p, i) => {
          angles.planetAngles[i] += p.speed * dt
          p.moons.forEach((m, j) => { angles.moonAngles[i][j] += m.speed * dt })
        })
      }
      s.lastTime = ts
      draw(ctx)
      rafId = requestAnimationFrame(loop)
    }
    rafId = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(rafId)
  }, [draw, currentSystem])

  // sync play state
  useEffect(() => {
    stateRef.current.playing = isPlaying
    if (!isPlaying) stateRef.current.lastTime = null
  }, [isPlaying])

  // Reset lastTime on system switch so dt doesn't jump
  useEffect(() => {
    stateRef.current.lastTime = null
  }, [currentSystemId])

  // ── helpers for hit-testing ───────────────────────────────────────────────
  const findBodyAt = useCallback((mx, my) => {
    const sys = currentSystem
    const angles = angleStateRef.current[sys.id]
    const CX = CANVAS_SIZE / 2, CY = CANVAS_SIZE / 2

    // sun
    if (Math.hypot(mx - CX, my - CY) <= STAR_R + 6) {
      return findTargetIdx(sys.id, 'sun', sys.sun.name)
    }
    // planets and moons
    for (let i = 0; i < sys.planets.length; i++) {
      const p = sys.planets[i]
      const ox = CX + orbitRadii[i] * Math.cos(angles.planetAngles[i])
      const oy = CY + orbitRadii[i] * Math.sin(angles.planetAngles[i])
      // moons first (drawn on top)
      for (let j = 0; j < p.moons.length; j++) {
        const m = p.moons[j]
        const mx2 = ox + m.orbitR * Math.cos(angles.moonAngles[i][j])
        const my2 = oy + m.orbitR * Math.sin(angles.moonAngles[i][j])
        if (Math.hypot(mx - mx2, my - my2) <= m.r + 5) {
          return findTargetIdx(sys.id, 'moon', m.name)
        }
      }
      if (Math.hypot(mx - ox, my - oy) <= p.r + 6) {
        return findTargetIdx(sys.id, 'planet', p.name)
      }
    }
    return -1
  }, [currentSystem, orbitRadii])

  // ── mouse move ───────────────────────────────────────────────────────────
  const handleMouseMove = useCallback((e) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const mx = (e.clientX - rect.left) * (CANVAS_SIZE / rect.width)
    const my = (e.clientY - rect.top)  * (CANVAS_SIZE / rect.height)
    const found = findBodyAt(mx, my)
    if (found !== stateRef.current.hovered) {
      stateRef.current.hovered = found
      setHoveredIdx(found)
      canvas.style.cursor = found !== -1 ? 'pointer' : 'default'
    }
  }, [findBodyAt])

  const handleMouseLeave = useCallback(() => {
    stateRef.current.hovered = -1
    setHoveredIdx(-1)
    if (canvasRef.current) canvasRef.current.style.cursor = 'default'
  }, [])

  // ── click ────────────────────────────────────────────────────────────────
  const handleClick = useCallback((e) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const mx = (e.clientX - rect.left) * (CANVAS_SIZE / rect.width)
    const my = (e.clientY - rect.top)  * (CANVAS_SIZE / rect.height)
    const found = findBodyAt(mx, my)
    stateRef.current.selected = found
    setSelectedIdx(found)
  }, [findBodyAt])

  // selecting a body from the side list
  const selectFlat = (idx) => {
    stateRef.current.selected = idx
    setSelectedIdx(idx)
    stateRef.current.hovered  = -1
    setHoveredIdx(-1)
  }

  // switching systems
  const switchSystem = (sysId) => {
    if (sysId === currentSystemId) return
    setCurrentSystemId(sysId)
    // Clear hover (selection persists — it's a flat index across all systems)
    stateRef.current.hovered = -1
    setHoveredIdx(-1)
  }

  // ── target list — bodies in the currently viewed system ───────────────────
  const listEntries = useMemo(() => {
    const out = []
    out.push({ idx: findTargetIdx(currentSystem.id, 'sun', currentSystem.sun.name), label: currentSystem.sun.name, marker: '★', color: currentSystem.sun.color, indent: 0 })
    currentSystem.planets.forEach(p => {
      out.push({ idx: findTargetIdx(currentSystem.id, 'planet', p.name), label: p.name, marker: '◆', color: p.color, indent: 0 })
      p.moons.forEach(m => {
        out.push({ idx: findTargetIdx(currentSystem.id, 'moon', m.name), label: m.name, marker: '◦', color: m.color, indent: 1 })
      })
    })
    return out
  }, [currentSystem])

  // ── render ───────────────────────────────────────────────────────────────
  return (
    <div id="targeting-screen-outer">
      <div id="targeting-screen" ref={scalerRef}>
      <HudHeader
        onLogout={() => onBack(selectedIdx)}
        center={
          <span className={`status-pill mail-pill${unreadCount > 0 ? ' mail-pill--unread' : ''}`} onClick={onMailOpen}>
            {unreadCount > 0 && <span className="mail-unread-dot" />}
            ✉ IMPERIAL MESSAGING SERVICE // UNREAD: {unreadCount}
          </span>
        }
        right={<span className="label">PNL-012-EXT / STELLAR CARTOGRAPHY</span>}
      />

      <main className="targeting-main">
        <div className="targeting-canvas-label">STELLAR CARTOGRAPHY // TARGETING SYSTEM</div>

        <div className="targeting-content">

          {/* Left column — systems list + target list */}
          <div className="targeting-left-col">
            <div className="targeting-systems-panel">
              <div className="tsys-title">SYSTEMS</div>
              <div className="tip-divider" />
              {SYSTEMS.map(s => (
                <button
                  key={s.id}
                  className={`tsys-item${s.id === currentSystemId ? ' tsys-item--active' : ''}`}
                  onClick={() => switchSystem(s.id)}
                >
                  {s.name}
                </button>
              ))}
            </div>

            <div className="targeting-list-panel">
              <div className="tlist-title">TARGET LIST</div>
              <div className="tip-divider" />
              {listEntries.map(e => (
                <button
                  key={e.idx}
                  className={`tlist-item${selectedIdx === e.idx ? ' tlist-item--active' : ''}${e.indent ? ' tlist-item--moon' : ''}`}
                  style={{ '--tlist-color': e.color }}
                  onClick={() => selectFlat(e.idx)}
                >
                  <span className="tlist-marker">{e.marker}</span>{e.label}
                </button>
              ))}
            </div>
          </div>

          <div className="targeting-canvas-wrap">
            <div className="targeting-system-name-row">
              <div className="targeting-system-name">{currentSystem.name}</div>
            </div>
            {currentSystem.imperial && (
              <div className="targeting-imperial-banner">IMPERIAL CONTROLLED SYSTEM</div>
            )}
            <button
              className="targeting-system-nav-btn"
              onClick={() => {
                const idx = SYSTEMS.findIndex(s => s.id === currentSystemId)
                switchSystem(SYSTEMS[(idx + 1) % SYSTEMS.length].id)
              }}
              title="Next system"
            >›</button>
            <canvas
              ref={canvasRef}
              className="targeting-canvas"
              width={CANVAS_SIZE}
              height={CANVAS_SIZE}
              onMouseMove={handleMouseMove}
              onMouseLeave={handleMouseLeave}
              onClick={handleClick}
            />
            <div className="targeting-controls">
              <button
                className={`targeting-btn${!isPlaying ? ' targeting-btn--active' : ''}`}
                onClick={() => setIsPlaying(false)}
              >⏸ PAUSE</button>
              <button
                className={`targeting-btn${isPlaying ? ' targeting-btn--active' : ''}`}
                onClick={() => setIsPlaying(true)}
              >▶ PLAY</button>
            </div>
          </div>

          <div className="targeting-panels">
          <div className="targeting-info-panel">
          {displayTarget?.kind === 'sun' ? (
            <>
              <div className="tip-status">TARGET ACQUIRED</div>
              <div className="tip-divider" />
              <div className="tip-name">{displayTarget.body.name}</div>
              <StarSphere sun={displayTarget.body} size={110} />
              <div className="tip-divider" />
              <div className="tip-row"><span className="tip-key">CLASS</span>        <span className="tip-val">{displayTarget.body.type}</span></div>
              <div className="tip-row"><span className="tip-key">MASS</span>         <span className="tip-val">{displayTarget.body.mass}</span></div>
              <div className="tip-row"><span className="tip-key">SURFACE TEMP</span> <span className="tip-val">{displayTarget.body.temp}</span></div>
              <div className="tip-row"><span className="tip-key">LUMINOSITY</span>   <span className="tip-val">{displayTarget.body.lum}</span></div>
            </>
          ) : displayTarget?.kind === 'planet' ? (
            <>
              <div className="tip-status">TARGET ACQUIRED</div>
              <div className="tip-divider" />
              <div className="tip-name">{displayTarget.body.name}</div>
              <PlanetSphere planet={displayTarget.body} size={110} />
              <div className="tip-divider" />
              <div className="tip-row"><span className="tip-key">CLIMATE</span> <span className="tip-val">{displayTarget.body.climate}</span></div>
              <div className="tip-row"><span className="tip-key">DISTANCE FROM STAR</span> <span className="tip-val">{displayTarget.body.distAU.toFixed(2)} AU</span></div>
            </>
          ) : displayTarget?.kind === 'moon' ? (
            <>
              <div className="tip-status">TARGET ACQUIRED</div>
              <div className="tip-divider" />
              <div className="tip-name">{displayTarget.body.name}</div>
              <PlanetSphere planet={displayTarget.body} size={110} />
              <div className="tip-divider" />
              <div className="tip-row"><span className="tip-key">TYPE</span> <span className="tip-val">{displayTarget.body.type ?? 'Moon'}</span></div>
              <div className="tip-row"><span className="tip-key">PARENT</span> <span className="tip-val">{displayParent?.name}</span></div>
            </>
          ) : (
            <div className="tip-idle">// NO TARGET SELECTED //</div>
          )}
          </div>

          <div className="targeting-info-text-panel">
            <div className="tlist-title">INFORMATION</div>
            <div className="tip-divider" />
            {displayTarget?.body?.description
              ? displayTarget.body.description.split('\n\n').map((para, i) => (
                  <p key={i} className="tinfo-para">{para}</p>
                ))
              : <div className="tinfo-idle">// SELECT A BODY //</div>
            }
          </div>
          </div>
        </div>

        <div className="targeting-selected-label">
          TARGET SELECTED:{' '}
          <span className={selectedIdx >= 0 ? 'targeting-selected-name' : 'targeting-selected-none'}>
            {selectedIdx >= 0 ? TARGETS[selectedIdx].body.name : 'None'}
          </span>
        </div>
        <button className="targeting-return-btn" onClick={() => onBack(selectedIdx)}>
          ← RETURN TO INSTALLATION VIEW
        </button>
      </main>

      <HudFooter>
        <span>HMSS / FCS v6.2.41 / STELLAR CARTOGRAPHY</span>
        <span className="sep">│</span>
        <span>
          TARGET:{' '}
          <em className={displayIdx !== -1 ? 'ok' : undefined}>
            {displayTarget ? displayTarget.body.name : 'NONE'}
          </em>
        </span>
        <span className="sep">│</span>
        <span>SIMULATION: <em className={isPlaying ? 'ok' : 'warn'}>{isPlaying ? 'RUNNING' : 'PAUSED'}</em></span>
      </HudFooter>
      </div>
    </div>
  )
}
