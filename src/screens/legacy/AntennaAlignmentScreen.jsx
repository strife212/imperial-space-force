import { useState, useEffect, useRef, useMemo } from 'react'
import HudHeader from '../../components/HudHeader'
import HudFooter from '../../components/HudFooter'

// ── SVG viewBox dimensions ────────────────────────────────────────────────────
const VW = 1000
const VH = 580

// ── Geometry constants ────────────────────────────────────────────────────────
const DISH_RADIUS    = 38
const MAST_LEN       = 10
const DISH_R         = 13   // small dish reflector radius
const ANTENNA_REACH  = MAST_LEN + DISH_R * 2  // dist from main body edge to dish chord
const RELAY_OFFSET   = 40   // ±degrees for the relay's two antennas
const TOLERANCE      = 7    // degrees of slack

// ── Dish layout & rotation ranges ─────────────────────────────────────────────
const DISHES = [
  {
    id: 'ship',  x: 180, y: 460,
    label: 'SHIP ANTENNA',     designation: 'SRC-001 / X-BAND TRANSMITTER',
    angleMin: -110, angleMax: -10, defaultAngle: -100,
    antennaOffsets: [0],
  },
  {
    id: 'relay', x: 500, y: 100,
    label: 'RELAY SATELLITE',  designation: 'RLY-OMEGA / GEO 15.7°W',
    angleMin: 30, angleMax: 150, defaultAngle: 45,
    antennaOffsets: [RELAY_OFFSET, -RELAY_OFFSET],
  },
  {
    id: 'array', x: 820, y: 460,
    label: 'DEEP SPACE ARRAY', designation: 'DST-019 / TRACKING STATION 3',
    angleMin: -170, angleMax: -70, defaultAngle: -80,
    antennaOffsets: [0],
  },
]

// ── Utility ───────────────────────────────────────────────────────────────────
const angleDiff = (a, b) => Math.abs(((a - b + 540) % 360) - 180)
const clamp     = (v, mn, mx) => Math.max(mn, Math.min(mx, v))

function computeIdeals() {
  const [ship, relay, array] = DISHES
  const ang = (from, to) => Math.atan2(to.y - from.y, to.x - from.x) * 180 / Math.PI
  const shipIdeal  = ang(ship,  relay)
  const arrayIdeal = ang(array, relay)
  const r2s = ang(relay, ship)
  const r2a = ang(relay, array)
  const d   = ((r2a - r2s + 540) % 360) - 180
  let relayIdeal = r2s + d / 2
  relayIdeal = ((relayIdeal + 540) % 360) - 180
  return { shipIdeal, relayIdeal, arrayIdeal }
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function AntennaAlignmentScreen({ onBack, onLogout, onAlignComplete, unreadCount = 0, onMailOpen }) {
  const ideals = useMemo(() => computeIdeals(), [])
  const [angles, setAngles] = useState({
    ship:  DISHES[0].defaultAngle,
    relay: DISHES[1].defaultAngle,
    array: DISHES[2].defaultAngle,
  })

  const svgRef      = useRef(null)
  const draggingRef = useRef(null)
  const specGroupRef = useRef(null)
  const specBarsRef  = useRef(
    Array.from({ length: 40 }, () => ({ h: 0.03, target: 0.03 + Math.random() * 0.05 }))
  )
  const specRafRef = useRef(null)

  const shipOk  = angleDiff(angles.ship,  ideals.shipIdeal)  <= TOLERANCE
  const relayOk = angleDiff(angles.relay, ideals.relayIdeal) <= TOLERANCE
  const arrayOk = angleDiff(angles.array, ideals.arrayIdeal) <= TOLERANCE
  const allOk   = shipOk && relayOk && arrayOk

  useEffect(() => {
    const onMove = (e) => {
      const id = draggingRef.current
      if (!id) return
      const svg = svgRef.current
      if (!svg) return
      const rect = svg.getBoundingClientRect()
      const sx = (e.clientX - rect.left) * (VW / rect.width)
      const sy = (e.clientY - rect.top)  * (VH / rect.height)
      const dish = DISHES.find(d => d.id === id)
      const newAngle = Math.atan2(sy - dish.y, sx - dish.x) * 180 / Math.PI
      const clamped  = clamp(newAngle, dish.angleMin, dish.angleMax)
      setAngles(a => ({ ...a, [id]: clamped }))
    }
    const onUp = () => { draggingRef.current = null }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup',   onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup',   onUp)
    }
  }, [])

  const startDrag = (id) => (e) => {
    e.preventDefault()
    draggingRef.current = id
  }

  // ── Beam geometry ────────────────────────────────────────────────────────
  const ship = DISHES[0], relay = DISHES[1], array = DISHES[2]

  // Antenna tip in screen coords (for a given dish + offset from its rotation)
  const tipOf = (dish, dishAngle, offset) => {
    const rad = (dishAngle + offset) * Math.PI / 180
    return {
      x: dish.x + Math.cos(rad) * (DISH_RADIUS + ANTENNA_REACH + 2),
      y: dish.y + Math.sin(rad) * (DISH_RADIUS + ANTENNA_REACH + 2),
    }
  }

  const shipTip       = tipOf(ship,  angles.ship,  0)
  const relayShipTip  = tipOf(relay, angles.relay, +RELAY_OFFSET)  // ship-side antenna
  const relayArrayTip = tipOf(relay, angles.relay, -RELAY_OFFSET)  // array-side antenna
  const arrayTip      = tipOf(array, angles.array, 0)

  // Ship beam: ship antenna tip → relay's ship-side tip if shipOk, else off-screen
  const shipRad = angles.ship * Math.PI / 180
  const shipBeamStart = shipTip
  const shipBeamEnd = shipOk
    ? relayShipTip
    : { x: ship.x + Math.cos(shipRad) * 1500, y: ship.y + Math.sin(shipRad) * 1500 }

  // Relay beam: from array-side antenna tip in that antenna's actual direction
  let relayBeamStart = null, relayBeamEnd = null
  if (shipOk) {
    relayBeamStart = relayArrayTip
    if (relayOk && arrayOk) {
      relayBeamEnd = arrayTip
    } else {
      const arrSideRad = (angles.relay - RELAY_OFFSET) * Math.PI / 180
      relayBeamEnd = {
        x: relay.x + Math.cos(arrSideRad) * 1500,
        y: relay.y + Math.sin(arrSideRad) * 1500,
      }
    }
  }

  const SPEC_X      = 330
  const SPEC_TOP    = 362
  const SPEC_BOTTOM = 460
  const SPEC_H      = SPEC_BOTTOM - SPEC_TOP   // 98
  const SPEC_W      = 340
  const SPEC_N      = 40
  const BAR_W       = SPEC_W / SPEC_N

  useEffect(() => {
    const group = specGroupRef.current
    if (!group) return
    const bars  = specBarsRef.current
    const rects = group.children

    const tick = () => {
      bars.forEach((b, i) => {
        if (allOk) {
          b.h += (b.target - b.h) * 0.07
          if (Math.abs(b.h - b.target) < 0.015)
            b.target = 0.05 + Math.random() * 0.9
        } else {
          b.h += (0.03 - b.h) * 0.12 + (Math.random() - 0.5) * 0.008
          b.h  = Math.max(0.008, b.h)
        }
        const bh = Math.max(0.5, b.h * SPEC_H)
        const el = rects[i]
        el.setAttribute('y',      String(SPEC_BOTTOM - bh))
        el.setAttribute('height', String(bh))
        el.setAttribute('fill', allOk
          ? `hsl(145, 75%, ${18 + b.h * 55}%)`
          : 'rgba(50, 80, 155, 0.32)')
      })
      specRafRef.current = requestAnimationFrame(tick)
    }

    tick()
    return () => cancelAnimationFrame(specRafRef.current)
  }, [allOk])

  const GREEN = '#3aff8a'
  const RED   = '#ff4848'
  const shipBeamColor  = (shipOk && relayOk) ? GREEN : RED
  const relayBeamColor = (shipOk && relayOk && arrayOk) ? GREEN : RED

  return (
    <div id="aa-screen">
      <HudHeader
        onLogout={onLogout || onBack}
        center={
          <span className={`status-pill mail-pill${unreadCount > 0 ? ' mail-pill--unread' : ''}`} onClick={onMailOpen}>
            {unreadCount > 0 && <span className="mail-unread-dot" />}
            ✉ IMPERIAL MESSAGING SERVICE // UNREAD: {unreadCount}
          </span>
        }
        right={<span className="label">PNL-008-EXT / ANTENNA ALIGNMENT</span>}
      />

      <main className="aa-main">
        <div className="aa-titlebar">
          <div className="aa-title">X-BAND ANTENNA RELAY ALIGNMENT</div>
          <div className="aa-subtitle">DRAG EACH DISH TO ROTATE — SIGNAL MUST REACH DEEP SPACE ARRAY</div>
        </div>

        <div className="aa-svg-wrap">
          <svg ref={svgRef} viewBox={`0 0 ${VW} ${VH}`} className="aa-svg" preserveAspectRatio="xMidYMid meet">
            <defs>
              <pattern id="aa-grid" width="40" height="40" patternUnits="userSpaceOnUse">
                <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(40, 80, 180, 0.10)" strokeWidth="0.6" />
              </pattern>
              <pattern id="aa-grid-coarse" width="200" height="200" patternUnits="userSpaceOnUse">
                <path d="M 200 0 L 0 0 0 200" fill="none" stroke="rgba(60, 110, 220, 0.18)" strokeWidth="0.8" />
              </pattern>
              <filter id="aa-glow" x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur stdDeviation="3" result="blur"/>
                <feMerge>
                  <feMergeNode in="blur"/>
                  <feMergeNode in="SourceGraphic"/>
                </feMerge>
              </filter>
            </defs>

            <rect width={VW} height={VH} fill="rgba(2, 6, 20, 0.85)" />
            <rect width={VW} height={VH} fill="url(#aa-grid)" />
            <rect width={VW} height={VH} fill="url(#aa-grid-coarse)" />

            {/* Coordinate crosshair markers in corners */}
            {[ [40,40], [VW-40,40], [40,VH-40], [VW-40,VH-40] ].map(([x,y], i) => (
              <g key={i} stroke="rgba(80, 130, 220, 0.35)" strokeWidth="0.8">
                <line x1={x-8} y1={y} x2={x+8} y2={y} />
                <line x1={x} y1={y-8} x2={x} y2={y+8} />
              </g>
            ))}

            {/* ── Spectrograph ── */}
            <g style={{ pointerEvents: 'none' }}>
              {/* Outer box */}
              <rect x="328" y="336" width="344" height="154" rx="2"
                    fill="rgba(2, 6, 20, 0.93)" stroke="rgba(60, 100, 200, 0.32)" strokeWidth="1" />
              {/* Header */}
              <text x="500" y="351" textAnchor="middle"
                    fontSize="8" fontFamily="'Cascadia Mono', Consolas, monospace"
                    fill="rgba(90, 130, 210, 0.55)" letterSpacing="0.15em">
                SIGNAL SPECTRUM ANALYZER / 8.0–12.0 GHz
              </text>
              <line x1="330" y1="357" x2="670" y2="357"
                    stroke="rgba(60, 100, 200, 0.22)" strokeWidth="0.5" />
              {/* Clip bars to plot area */}
              <defs>
                <clipPath id="spec-clip">
                  <rect x={SPEC_X} y={SPEC_TOP} width={SPEC_W} height={SPEC_H} />
                </clipPath>
              </defs>
              {/* Horizontal grid lines */}
              {[0.25, 0.5, 0.75].map(f => (
                <line key={f}
                  x1={SPEC_X} y1={SPEC_BOTTOM - f * SPEC_H}
                  x2={SPEC_X + SPEC_W} y2={SPEC_BOTTOM - f * SPEC_H}
                  stroke="rgba(60, 100, 200, 0.11)" strokeWidth="0.5"
                />
              ))}
              {/* Bars */}
              <g ref={specGroupRef} clipPath="url(#spec-clip)">
                {Array.from({ length: SPEC_N }, (_, i) => (
                  <rect key={i}
                    x={SPEC_X + i * BAR_W + 0.5}
                    y={SPEC_BOTTOM}
                    width={BAR_W - 1}
                    height={0}
                    fill="rgba(50, 80, 155, 0.32)"
                  />
                ))}
              </g>
              {/* Axis baseline */}
              <line x1={SPEC_X} y1={SPEC_BOTTOM} x2={SPEC_X + SPEC_W} y2={SPEC_BOTTOM}
                    stroke="rgba(60, 100, 200, 0.28)" strokeWidth="0.5" />
              {/* Freq labels */}
              <text x={SPEC_X + 2} y="473" fontSize="7" fontFamily="'Cascadia Mono', Consolas, monospace"
                    fill="rgba(70, 110, 180, 0.42)">8.0</text>
              <text x="500" y="473" textAnchor="middle" fontSize="7" fontFamily="'Cascadia Mono', Consolas, monospace"
                    fill="rgba(70, 110, 180, 0.42)">10.0 GHz</text>
              <text x={SPEC_X + SPEC_W - 2} y="473" textAnchor="end" fontSize="7" fontFamily="'Cascadia Mono', Consolas, monospace"
                    fill="rgba(70, 110, 180, 0.42)">12.0</text>
              {/* Status */}
              <text x="500" y="484" textAnchor="middle" fontSize="7.5" fontFamily="'Cascadia Mono', Consolas, monospace"
                    fill={allOk ? 'rgba(58, 255, 138, 0.65)' : 'rgba(70, 110, 180, 0.38)'}
                    letterSpacing="0.12em">
                {allOk ? '◆ CARRIER LOCK — 10.3 GHz' : '◇ NO CARRIER — AWAITING ALIGNMENT'}
              </text>
            </g>

            {/* ── Beams ── */}
            <g style={{ pointerEvents: 'none' }}>
              {/* Ship beam */}
              <line
                x1={shipBeamStart.x} y1={shipBeamStart.y}
                x2={shipBeamEnd.x}   y2={shipBeamEnd.y}
                stroke={shipBeamColor} strokeWidth="2.5"
                strokeDasharray="14 8"
                opacity="0.9"
                filter="url(#aa-glow)"
              />
              {/* Relay beam */}
              {relayBeamStart && (
                <line
                  x1={relayBeamStart.x} y1={relayBeamStart.y}
                  x2={relayBeamEnd.x}   y2={relayBeamEnd.y}
                  stroke={relayBeamColor} strokeWidth="2.5"
                  strokeDasharray="14 8"
                  opacity="0.9"
                  filter="url(#aa-glow)"
                />
              )}
            </g>

            {/* ── Dishes ── */}
            {DISHES.map((dish, i) => {
              const angle = angles[dish.id]
              const ok = [shipOk, relayOk, arrayOk][i]
              const accent  = ok ? '#3aff8a' : 'rgba(140, 180, 240, 0.85)'
              const dimAccent = ok ? 'rgba(58, 255, 138, 0.4)' : 'rgba(120, 160, 220, 0.4)'

              return (
                <g key={dish.id} transform={`translate(${dish.x} ${dish.y})`}>
                  {/* Mounting base (does not rotate) */}
                  <rect x="-26" y="22" width="52" height="34" rx="2"
                        fill="rgba(15, 25, 45, 0.95)"
                        stroke="rgba(120, 150, 210, 0.6)" strokeWidth="1" />
                  <line x1="-22" y1="32" x2="22" y2="32" stroke="rgba(120, 150, 210, 0.3)" strokeWidth="0.6" />
                  <line x1="-22" y1="42" x2="22" y2="42" stroke="rgba(120, 150, 210, 0.3)" strokeWidth="0.6" />

                  {/* Allowed rotation arc indicator */}
                  <path
                    d={describeArc(0, 0, DISH_RADIUS + ANTENNA_REACH + 14, dish.angleMin, dish.angleMax)}
                    fill="none" stroke="rgba(80, 130, 220, 0.18)" strokeWidth="1" strokeDasharray="3 3"
                  />
                  {/* End ticks on the arc */}
                  {[dish.angleMin, dish.angleMax].map((a, j) => {
                    const r1 = DISH_RADIUS + ANTENNA_REACH + 10
                    const r2 = DISH_RADIUS + ANTENNA_REACH + 18
                    const rad = a * Math.PI / 180
                    return (
                      <line key={j}
                        x1={Math.cos(rad)*r1} y1={Math.sin(rad)*r1}
                        x2={Math.cos(rad)*r2} y2={Math.sin(rad)*r2}
                        stroke="rgba(80, 130, 220, 0.4)" strokeWidth="1"
                      />
                    )
                  })}

                  {/* Rotating dish assembly */}
                  <g transform={`rotate(${angle})`}
                     onMouseDown={startDrag(dish.id)}
                     style={{ cursor: 'grab' }}>
                    {/* Hit area */}
                    <circle r={DISH_RADIUS + ANTENNA_REACH + 8} fill="transparent" />

                    {/* Dish back */}
                    <circle r={DISH_RADIUS} fill="rgba(8, 16, 34, 0.95)"
                            stroke={accent} strokeWidth="1.8" />
                    {/* Inner ring */}
                    <circle r={DISH_RADIUS - 8} fill="none"
                            stroke={dimAccent} strokeWidth="1" />
                    {/* Surface segments */}
                    <line x1={-DISH_RADIUS*0.9} y1={0} x2={DISH_RADIUS*0.9} y2={0}
                          stroke={dimAccent} strokeWidth="0.6" />
                    <line x1={0} y1={-DISH_RADIUS*0.9} x2={0} y2={DISH_RADIUS*0.9}
                          stroke={dimAccent} strokeWidth="0.6" />
                    {/* Center hub */}
                    <circle r="3.5" fill={accent} />

                    {/* Antenna(s) — each as mast + half-circle dish */}
                    {dish.antennaOffsets.map((off, j) => {
                      const chordX = DISH_RADIUS + MAST_LEN + DISH_R
                      const focusX = DISH_RADIUS + MAST_LEN + DISH_R * 0.55
                      return (
                        <g key={j} transform={`rotate(${off})`}>
                          {/* Mast attaching to back of dish */}
                          <line x1={DISH_RADIUS} y1={0} x2={DISH_RADIUS + MAST_LEN} y2={0}
                                stroke={accent} strokeWidth="2.2" />
                          {/* Half-circle dish reflector — opens forward */}
                          <path
                            d={`M ${chordX} ${-DISH_R} A ${DISH_R} ${DISH_R} 0 0 0 ${chordX} ${DISH_R}`}
                            fill="rgba(15, 24, 50, 0.95)"
                            stroke={accent}
                            strokeWidth="2"
                          />
                          {/* Feed horn at the focal point */}
                          <circle cx={focusX} cy="0" r="2.2" fill={accent} />
                          {/* Tiny direction tick at the chord/opening */}
                          <line x1={chordX} y1={-3} x2={chordX + 4} y2={0}
                                stroke={accent} strokeWidth="1.2" />
                          <line x1={chordX} y1={3}  x2={chordX + 4} y2={0}
                                stroke={accent} strokeWidth="1.2" />
                        </g>
                      )
                    })}
                  </g>

                  {/* Label */}
                  <text y="76" textAnchor="middle"
                        fontSize="11" fontFamily="'Cascadia Mono', Consolas, monospace"
                        fill={ok ? '#5fff9d' : 'rgba(200, 220, 255, 0.85)'}
                        letterSpacing="0.18em">
                    {dish.label}
                  </text>
                  <text y="91" textAnchor="middle"
                        fontSize="9" fontFamily="'Cascadia Mono', Consolas, monospace"
                        fill="rgba(120, 150, 210, 0.55)"
                        letterSpacing="0.08em">
                    {dish.designation}
                  </text>
                  <text y="108" textAnchor="middle"
                        fontSize="9.5" fontFamily="'Cascadia Mono', Consolas, monospace"
                        fill={ok ? '#5fff9d' : 'rgba(255, 110, 110, 0.8)'}
                        letterSpacing="0.18em">
                    {ok ? '◆ LOCK' : `◇ DRIFT ${angle >= 0 ? '+' : ''}${angle.toFixed(0)}°`}
                  </text>
                </g>
              )
            })}
          </svg>
        </div>

        <div className="aa-controls">
          <div className={`aa-status${allOk ? ' aa-status--ok' : ''}`}>
            {allOk ? '◆ SIGNAL LOCK ACQUIRED — RELAY PATH ESTABLISHED' : '◇ AWAITING ALIGNMENT — SIGNAL UNROUTED'}
          </div>
          <button
            className="aa-confirm-btn"
            disabled={!allOk}
            onClick={() => { onAlignComplete?.(); onBack() }}
          >
            CONFIRM ALIGNMENT
          </button>
        </div>
      </main>

      <HudFooter>
        <span>HMSS / FCS v6.2.41 / X-BAND ANTENNA SUBSYSTEM</span>
        <span className="sep">│</span>
        <span>SHIP: <em className={shipOk ? 'ok' : 'warn'}>{shipOk ? 'LOCK' : 'DRIFT'}</em></span>
        <span className="sep">│</span>
        <span>RELAY: <em className={relayOk ? 'ok' : 'warn'}>{relayOk ? 'LOCK' : 'DRIFT'}</em></span>
        <span className="sep">│</span>
        <span>ARRAY: <em className={arrayOk ? 'ok' : 'warn'}>{arrayOk ? 'LOCK' : 'DRIFT'}</em></span>
      </HudFooter>
    </div>
  )
}

// ── SVG arc path helper ───────────────────────────────────────────────────────
function describeArc(cx, cy, r, startDeg, endDeg) {
  const start = polarToCart(cx, cy, r, endDeg)
  const end   = polarToCart(cx, cy, r, startDeg)
  const largeArc = (endDeg - startDeg) <= 180 ? 0 : 1
  return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 0 ${end.x} ${end.y}`
}
function polarToCart(cx, cy, r, deg) {
  const rad = deg * Math.PI / 180
  return { x: cx + Math.cos(rad) * r, y: cy + Math.sin(rad) * r }
}
