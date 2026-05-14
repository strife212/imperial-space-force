import { useEffect, useState, useRef } from 'react'

// Chain x-positions and switch-close stagger (seconds)
const CHAINS         = [100, 270, 440]
const SWITCH_DELAYS  = [0.6, 3.2, 6.0]

export default function DischargeDiagram() {
  const [pct, setPct] = useState(0)
  const rafRef = useRef(null)

  // Drive the 0→100% counter smoothly over 10s
  useEffect(() => {
    const start = performance.now()
    const DUR = 10000
    const tick = (now) => {
      const t = Math.min(1, (now - start) / DUR)
      setPct(Math.floor(t * 100))
      if (t < 1) rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafRef.current)
  }, [])

  return (
    <svg className="dd-svg" viewBox="0 0 540 300" xmlns="http://www.w3.org/2000/svg">

      {/* ── DISCHARGE POINT ─────────────────────────────────────────────── */}
      <rect x="200" y="10" width="140" height="46" rx="2" className="dd-discharge-box" />
      <text x="270" y="29" textAnchor="middle" className="dd-discharge-title">DISCHARGE POINT</text>
      <text x="270" y="48" textAnchor="middle" className="dd-discharge-pct">{String(pct).padStart(3, '0')}%</text>

      {/* Main vertical bus from discharge point */}
      <line x1="270" y1="56" x2="270" y2="86" className="dd-wire dd-flow-v" />

      {/* Horizontal main busbar — split at centre so both halves flow inward */}
      <line x1="270" y1="86" x2="100" y2="86" className="dd-wire dd-flow-h" />
      <line x1="270" y1="86" x2="440" y2="86" className="dd-wire dd-flow-h" />

      {/* ── Three chains ─────────────────────────────────────────────────── */}
      {CHAINS.map((x, i) => (
        <g key={i}>
          {/* Drop to switch */}
          <line x1={x} y1="86" x2={x} y2="118" className="dd-wire dd-flow-v" />

          {/* Switch — open arm fades out, closed arm fades in (staggered) */}
          <circle cx={x} cy="118" r="2.5" className="dd-pin" />
          <line
            x1={x} y1="118" x2={x - 12} y2="140"
            className="dd-switch-open"
            style={{ animationDelay: `${SWITCH_DELAYS[i]}s` }}
          />
          <line
            x1={x} y1="118" x2={x} y2="142"
            className="dd-switch-closed"
            style={{ animationDelay: `${SWITCH_DELAYS[i]}s` }}
          />
          <circle cx={x} cy="142" r="2.5" className="dd-pin" />

          {/* Wire from switch into main capacitor */}
          <line x1={x} y1="142" x2={x} y2="166" className="dd-wire dd-flow-v" />

          {/* Main capacitor: outline, plates, animated fill */}
          <rect x={x - 26} y="166" width="52" height="38" rx="1" className="dd-cap-outline" />
          <rect x={x - 25} y="167" width="50" height="36" className="dd-cap-fill" />
          <line x1={x - 18} y1="180" x2={x + 18} y2="180" className="dd-cap-plate" />
          <line x1={x - 18} y1="190" x2={x + 18} y2="190" className="dd-cap-plate" />

          {/* Wire from main cap to sub-bus */}
          <line x1={x} y1="204" x2={x} y2="226" className="dd-wire dd-flow-v" />

          {/* Sub-busbar — split at centre so both halves flow inward */}
          <line x1={x} y1="226" x2={x - 22} y2="226" className="dd-wire dd-flow-h" />
          <line x1={x} y1="226" x2={x + 22} y2="226" className="dd-wire dd-flow-h" />

          {/* Two sub-caps in parallel */}
          {[-15, 15].map((dx, j) => (
            <g key={j}>
              <line x1={x + dx} y1="226" x2={x + dx} y2="244" className="dd-wire dd-flow-v" />
              <rect x={x + dx - 10} y="244" width="20" height="26" rx="1" className="dd-cap-outline" />
              <rect x={x + dx - 9}  y="245" width="18" height="24" className="dd-cap-fill" />
              <line x1={x + dx - 7} y1="252" x2={x + dx + 7} y2="252" className="dd-cap-plate" />
              <line x1={x + dx - 7} y1="262" x2={x + dx + 7} y2="262" className="dd-cap-plate" />
            </g>
          ))}
        </g>
      ))}
    </svg>
  )
}
