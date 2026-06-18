import { useState, useRef, useCallback, useEffect } from 'react'

const MIN_FREQ = 8.0
const MAX_FREQ = 12.0
const STEP = 0.1
const PX_PER_STEP = 5

// ── Dial arc scale (computed once at module level) ────────────────────────────
// 41 ticks spanning 180°; major every 10 (= 1 GHz), medium every 5 (= 0.5 GHz)
const ARC_CX = 50, ARC_CY = 54, ARC_R = 46
const DIAL_TICKS = Array.from({ length: 41 }, (_, i) => {
  const angle   = Math.PI * (1 - i / 40)
  const cos     = Math.cos(angle), sin = Math.sin(angle)
  const isMajor = i % 10 === 0
  const isMid   = i % 10 === 5
  const len     = isMajor ? 13 : isMid ? 8 : 4
  return {
    x1: ARC_CX + ARC_R * cos,           y1: ARC_CY - ARC_R * sin,
    x2: ARC_CX + (ARC_R - len) * cos,   y2: ARC_CY - (ARC_R - len) * sin,
    isMajor, isMid,
  }
})

export default function XBandRadioPanel({ litClass, lowPower, aligned, onAlign, onFreqChange, initialFreq = 8.0 }) {
  // Compute starting dial angle from persisted frequency
  // Each 0.1 GHz step = PX_PER_STEP px drag = PX_PER_STEP * 2 dial degrees
  const initAngle = -90 + ((initialFreq - MIN_FREQ) / STEP) * (PX_PER_STEP * 2)
  const [freq,      setFreq]      = useState(initialFreq)
  const [dialAngle, setDialAngle] = useState(initAngle)
  const freqRef      = useRef(initialFreq)
  const dialAngleRef = useRef(initAngle)
  const isDragging   = useRef(false)
  const lastX        = useRef(0)
  const dragAccum    = useRef(0)

  const onMouseDown = useCallback((e) => {
    isDragging.current = true
    lastX.current = e.clientX
    dragAccum.current = 0
    e.preventDefault()
  }, [])

  const onMouseMove = useCallback((e) => {
    if (!isDragging.current) return
    const dx = e.clientX - lastX.current
    lastX.current = e.clientX
    dragAccum.current += dx

    const steps = Math.trunc(dragAccum.current / PX_PER_STEP)
    if (steps !== 0) {
      dragAccum.current -= steps * PX_PER_STEP
      const newFreq = Math.round(
        Math.min(MAX_FREQ, Math.max(MIN_FREQ, freqRef.current + steps * STEP)) * 10
      ) / 10
      freqRef.current = newFreq
      setFreq(newFreq)
      onFreqChange?.(newFreq)
    }

    dialAngleRef.current += dx * 2
    setDialAngle(dialAngleRef.current)
  }, [])

  const onMouseUp = useCallback(() => {
    isDragging.current = false
  }, [])

  useEffect(() => {
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup',   onMouseUp)
    return () => {
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup',   onMouseUp)
    }
  }, [onMouseMove, onMouseUp])

  const wavelengthCm = (30 / freq).toFixed(1)

  return (
    <section className={`panel${litClass}${lowPower ? ' panel--low-power' : ''}`} id="panel-xband">
      <header className="panel-header">
        <span className={`bullet${aligned ? '' : ' bullet--alert'}`} /><h2>X-BAND RADIO TRANSCEIVER</h2>
        <span className="panel-id">PNL-003 / 8–12 GHz</span>
      </header>

      <div className="panel-body xband-body">

        <div className="xband-left">
          <div className="xband-lcd">
            {aligned ? (
              <>
                <div className="xband-lcd-row">
                  <span className="xband-lcd-label">FREQ</span>
                  <span className="xband-lcd-value xband-lcd-value--large">{freq.toFixed(1)} GHz</span>
                </div>
                <div className="xband-lcd-row">
                  <span className="xband-lcd-label">BAND</span>
                  <span className="xband-lcd-value xband-lcd-value--large">X-BAND / {wavelengthCm} cm</span>
                </div>
              </>
            ) : (
              <div className="xband-lcd-fault">[ ANTENNA ALIGNMENT ISSUE ]</div>
            )}
          </div>

          <button className="xband-antenna-btn" disabled={lowPower || aligned} onClick={onAlign}>
            {aligned ? 'ANTENNA ALIGNED' : 'ADJUST ANTENNA ALIGNMENT'}
          </button>
        </div>

        <div className="xband-dial-section">
          <div className="xband-dial-label">FREQUENCY</div>
          <div className="xband-dial-wrap">
            {/* Arc scale above the dial */}
            <svg className="xband-dial-arc" viewBox="0 0 100 54" preserveAspectRatio="xMidYMid meet">
              <path
                d={`M 4 54 A ${ARC_R} ${ARC_R} 0 0 0 96 54`}
                fill="none"
                stroke="rgba(0,200,80,0.18)"
                strokeWidth="0.8"
              />
              {DIAL_TICKS.map((t, i) => (
                <line
                  key={i}
                  x1={t.x1.toFixed(2)} y1={t.y1.toFixed(2)}
                  x2={t.x2.toFixed(2)} y2={t.y2.toFixed(2)}
                  stroke={t.isMajor ? 'rgba(0,220,100,0.85)' : t.isMid ? 'rgba(0,200,80,0.55)' : 'rgba(0,170,65,0.32)'}
                  strokeWidth={t.isMajor ? 1.3 : t.isMid ? 0.9 : 0.65}
                  strokeLinecap="round"
                />
              ))}
            </svg>
            <div className="xband-dial-surround">
              <div
                className="xband-dial"
                onMouseDown={onMouseDown}
                style={{ transform: `rotate(${dialAngle}deg)` }}
              >
                <div className="xband-dial-marker" />
              </div>
            </div>
          </div>
          <div className="xband-dial-range">8 ←→ 12 GHz</div>
        </div>

      </div>

      {lowPower && <div className="low-power-overlay" />}
    </section>
  )
}
