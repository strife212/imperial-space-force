import { useRef, useEffect, useState, useCallback } from 'react'
import HudHeader from '../components/HudHeader'
import HudFooter from '../components/HudFooter'
import { PLANETS, SUN, SUN_IDX } from '../lib/planetData'

const CANVAS_SIZE = 600
const STAR_R      = 16

const LOG_MIN = Math.log(0.39)
const LOG_MAX = Math.log(9.50)
const PIX_MIN = 42
const PIX_MAX = 272

const ORBIT_R = PLANETS.map(p => {
  const t = (Math.log(p.distAU) - LOG_MIN) / (LOG_MAX - LOG_MIN)
  return PIX_MIN + t * (PIX_MAX - PIX_MIN)
})

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
function StarSphere({ size = 110 }) {
  const ref = useRef(null)

  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    const cx = size / 2, cy = size / 2, r = size / 2 - 8

    ctx.clearRect(0, 0, size, size)

    // corona glow
    const corona = ctx.createRadialGradient(cx, cy, r * 0.6, cx, cy, r * 1.55)
    corona.addColorStop(0, 'rgba(255,200,60,0.30)')
    corona.addColorStop(0.5, 'rgba(255,120,20,0.12)')
    corona.addColorStop(1, 'rgba(255,60,0,0)')
    ctx.beginPath(); ctx.arc(cx, cy, r * 1.55, 0, Math.PI * 2)
    ctx.fillStyle = corona; ctx.fill()

    // star body
    const body = ctx.createRadialGradient(cx - r * 0.28, cy - r * 0.28, 0, cx, cy, r)
    body.addColorStop(0,   '#fffde8')
    body.addColorStop(0.35, '#ffd060')
    body.addColorStop(1,   '#ff7010')
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2)
    ctx.fillStyle = body; ctx.fill()
  }, [size])

  return <canvas ref={ref} width={size} height={size} className="targeting-sphere-canvas" />
}

// ── planet sphere sub-component ───────────────────────────────────────────────
function PlanetSphere({ planet, size = 110 }) {
  const ref = useRef(null)

  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    const cx = size / 2, cy = size / 2, r = size / 2 - 5

    ctx.clearRect(0, 0, size, size)

    // base gradient (lit from upper-left)
    const base = ctx.createRadialGradient(cx - r * 0.35, cy - r * 0.35, r * 0.05, cx, cy, r)
    base.addColorStop(0,   lighten(planet.color, 0.55))
    base.addColorStop(0.5, planet.color)
    base.addColorStop(1,   darken(planet.color, 0.65))
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2)
    ctx.fillStyle = base; ctx.fill()

    // specular highlight
    const spec = ctx.createRadialGradient(cx - r * 0.28, cy - r * 0.32, 0, cx - r * 0.15, cy - r * 0.2, r * 0.45)
    spec.addColorStop(0, 'rgba(255,255,255,0.55)')
    spec.addColorStop(1, 'rgba(255,255,255,0)')
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2)
    ctx.fillStyle = spec; ctx.fill()

    // limb darkening
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
  const canvasRef = useRef(null)
  const stateRef  = useRef({
    angles:   PLANETS.map((_, i) => (i * Math.PI * 2.3) / PLANETS.length),
    lastTime: null,
    playing:  true,
    hovered:  -1,
    selected: initialSelectedIdx,
    stars:    makeStars(),
  })

  const [hoveredIdx,  setHoveredIdx]  = useState(-1)
  const [selectedIdx, setSelectedIdx] = useState(initialSelectedIdx)
  const [isPlaying,   setIsPlaying]   = useState(true)

  // panel shows selected target; falls back to hovered if nothing locked
  const displayIdx = selectedIdx !== -1 ? selectedIdx : hoveredIdx

  // ── draw ──────────────────────────────────────────────────────────────────
  const draw = useCallback((ctx) => {
    const { angles, hovered, selected, stars } = stateRef.current
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

    // orbit rings
    PLANETS.forEach((_, i) => {
      const isHov = i === hovered
      const isSel = i === selected
      ctx.beginPath()
      ctx.arc(CX, CY, ORBIT_R[i], 0, Math.PI * 2)
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
    const glow = ctx.createRadialGradient(CX, CY, 0, CX, CY, 60)
    glow.addColorStop(0,   'rgba(255,240,150,0.28)')
    glow.addColorStop(0.5, 'rgba(255,160,40,0.10)')
    glow.addColorStop(1,   'rgba(255,80,0,0)')
    ctx.beginPath(); ctx.arc(CX, CY, 60, 0, Math.PI * 2)
    ctx.fillStyle = glow; ctx.fill()

    // star body
    const sun = ctx.createRadialGradient(CX - 4, CY - 4, 0, CX, CY, STAR_R)
    sun.addColorStop(0,   '#fffde8')
    sun.addColorStop(0.4, '#ffd060')
    sun.addColorStop(1,   '#ff7010')
    ctx.beginPath(); ctx.arc(CX, CY, STAR_R, 0, Math.PI * 2)
    ctx.fillStyle = sun; ctx.fill()

    // sun hover / selection ring
    const sunHov = hovered  === SUN_IDX
    const sunSel = selected === SUN_IDX
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

    // planets
    PLANETS.forEach((p, i) => {
      const angle = angles[i]
      const ox = CX + ORBIT_R[i] * Math.cos(angle)
      const oy = CY + ORBIT_R[i] * Math.sin(angle)
      const isHov = i === hovered
      const isSel = i === selected

      const [r, g, b] = hexToRgb(p.color) // used for labels only

      // uniform diagram colour
      const dc = '100,160,240'

      // hover glow
      if (isHov) {
        const hg = ctx.createRadialGradient(ox, oy, 0, ox, oy, p.r + 20)
        hg.addColorStop(0, `rgba(${dc},0.25)`)
        hg.addColorStop(1, `rgba(${dc},0)`)
        ctx.beginPath(); ctx.arc(ox, oy, p.r + 20, 0, Math.PI * 2)
        ctx.fillStyle = hg; ctx.fill()
      }

      // planet body — dark fill + uniform outline
      ctx.beginPath(); ctx.arc(ox, oy, p.r, 0, Math.PI * 2)
      ctx.fillStyle = `rgba(${dc},0.07)`
      ctx.fill()
      ctx.strokeStyle = `rgba(${dc},0.75)`
      ctx.lineWidth = 2.5
      ctx.stroke()

      // hover ring
      if (isHov) {
        ctx.beginPath(); ctx.arc(ox, oy, p.r + 4, 0, Math.PI * 2)
        ctx.strokeStyle = `rgba(${dc},0.55)`
        ctx.lineWidth = 1
        ctx.stroke()
      }

      // selection ring (gold dashed)
      if (isSel) {
        ctx.beginPath(); ctx.arc(ox, oy, p.r + (isHov ? 8 : 6), 0, Math.PI * 2)
        ctx.strokeStyle = 'rgba(255,220,80,0.80)'
        ctx.lineWidth = 1
        ctx.setLineDash([3, 4])
        ctx.stroke()
        ctx.setLineDash([])
      }

      // name tag — keep planet colour
      const dx = ox - CX, dy = oy - CY
      const dist = Math.hypot(dx, dy)
      const nx = dx / dist, ny = dy / dist
      const labelOffset = p.r + 7
      ctx.font = '500 10px "Cascadia Mono", Consolas, monospace'
      ctx.textBaseline = 'middle'
      ctx.textAlign = nx >= 0 ? 'left' : 'right'
      ctx.fillStyle = `rgba(${r},${g},${b},${isHov || isSel ? 0.95 : 0.65})`
      ctx.fillText(p.name, ox + nx * labelOffset, oy + ny * labelOffset)
    })
  }, [])

  // ── RAF loop ─────────────────────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    let rafId

    const loop = (ts) => {
      const s = stateRef.current
      if (s.lastTime !== null && s.playing) {
        const dt = Math.min(ts - s.lastTime, 100)
        PLANETS.forEach((p, i) => { s.angles[i] += p.speed * dt })
      }
      s.lastTime = ts
      draw(ctx)
      rafId = requestAnimationFrame(loop)
    }
    rafId = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(rafId)
  }, [draw])

  // sync play state
  useEffect(() => {
    stateRef.current.playing = isPlaying
    if (!isPlaying) stateRef.current.lastTime = null
  }, [isPlaying])

  // ── mouse move ───────────────────────────────────────────────────────────
  const handleMouseMove = useCallback((e) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const mx = (e.clientX - rect.left) * (CANVAS_SIZE / rect.width)
    const my = (e.clientY - rect.top)  * (CANVAS_SIZE / rect.height)
    const CX = CANVAS_SIZE / 2, CY = CANVAS_SIZE / 2

    let found = -1

    // check sun first
    if (Math.hypot(mx - CX, my - CY) <= STAR_R + 6) {
      found = SUN_IDX
    } else {
      PLANETS.forEach((p, i) => {
        const ox = CX + ORBIT_R[i] * Math.cos(stateRef.current.angles[i])
        const oy = CY + ORBIT_R[i] * Math.sin(stateRef.current.angles[i])
        if (Math.hypot(mx - ox, my - oy) <= p.r + 6) found = i
      })
    }

    if (found !== stateRef.current.hovered) {
      stateRef.current.hovered = found
      setHoveredIdx(found)
      canvas.style.cursor = found !== -1 ? 'pointer' : 'default'
    }
  }, [])

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
    const CX = CANVAS_SIZE / 2, CY = CANVAS_SIZE / 2

    // check sun
    if (Math.hypot(mx - CX, my - CY) <= STAR_R + 6) {
      stateRef.current.selected = SUN_IDX
      setSelectedIdx(SUN_IDX)
      return
    }

    // check planets
    let found = -1
    PLANETS.forEach((p, i) => {
      const ox = CX + ORBIT_R[i] * Math.cos(stateRef.current.angles[i])
      const oy = CY + ORBIT_R[i] * Math.sin(stateRef.current.angles[i])
      if (Math.hypot(mx - ox, my - oy) <= p.r + 6) found = i
    })

    stateRef.current.selected = found   // -1 (empty click) clears selection
    setSelectedIdx(found)
  }, [])

  // ── render ───────────────────────────────────────────────────────────────
  const displayPlanet = displayIdx >= 0 && displayIdx < PLANETS.length ? PLANETS[displayIdx] : null
  const displaySun    = displayIdx === SUN_IDX

  return (
    <div id="targeting-screen">
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
          <div className="targeting-canvas-wrap">
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
          {displaySun ? (
            <>
              <div className="tip-status">TARGET ACQUIRED</div>
              <div className="tip-divider" />
              <div className="tip-name">{SUN.name}</div>
              <StarSphere size={110} />
              <div className="tip-divider" />
              <div className="tip-row">
                <span className="tip-key">CLASS</span>
                <span className="tip-val">{SUN.type}</span>
              </div>
              <div className="tip-row">
                <span className="tip-key">MASS</span>
                <span className="tip-val">{SUN.mass}</span>
              </div>
              <div className="tip-row">
                <span className="tip-key">SURFACE TEMP</span>
                <span className="tip-val">{SUN.temp}</span>
              </div>
              <div className="tip-row">
                <span className="tip-key">LUMINOSITY</span>
                <span className="tip-val">{SUN.lum}</span>
              </div>
            </>
          ) : displayPlanet ? (
            <>
              <div className="tip-status">TARGET ACQUIRED</div>
              <div className="tip-divider" />
              <div className="tip-name">{displayPlanet.name}</div>
              <PlanetSphere planet={displayPlanet} size={110} />
              <div className="tip-divider" />
              <div className="tip-row">
                <span className="tip-key">CLIMATE</span>
                <span className="tip-val">{displayPlanet.climate}</span>
              </div>
              <div className="tip-row">
                <span className="tip-key">DISTANCE FROM STAR</span>
                <span className="tip-val">{displayPlanet.distAU.toFixed(2)} AU</span>
              </div>
            </>
          ) : (
            <div className="tip-idle">// NO TARGET SELECTED //</div>
          )}
          </div>

          <div className="targeting-list-panel">
            <div className="tlist-title">TARGET LIST</div>
            <div className="tip-divider" />
            <button
              className={`tlist-item${selectedIdx === SUN_IDX ? ' tlist-item--active' : ''}`}
              onClick={() => { stateRef.current.selected = SUN_IDX; setSelectedIdx(SUN_IDX) }}
            >
              <span className="tlist-marker">★</span>{SUN.name}
            </button>
            {PLANETS.map((p, i) => (
              <button
                key={p.name}
                className={`tlist-item${selectedIdx === i ? ' tlist-item--active' : ''}`}
                style={{ '--tlist-color': p.color }}
                onClick={() => { stateRef.current.selected = i; setSelectedIdx(i) }}
              >
                <span className="tlist-marker">◆</span>{p.name}
              </button>
            ))}
          </div>
          </div>
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
            {displaySun ? SUN.name : displayPlanet ? displayPlanet.name : 'NONE'}
          </em>
        </span>
        <span className="sep">│</span>
        <span>SIMULATION: <em className={isPlaying ? 'ok' : 'warn'}>{isPlaying ? 'RUNNING' : 'PAUSED'}</em></span>
      </HudFooter>
    </div>
  )
}
