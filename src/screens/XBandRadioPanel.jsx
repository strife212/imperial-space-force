import { useState, useRef, useCallback, useEffect } from 'react'

const MIN_FREQ = 8.0
const MAX_FREQ = 12.0
const STEP = 0.1
const PX_PER_STEP = 5

export default function XBandRadioPanel({ litClass, lowPower, aligned, onAlign }) {
  const [freq,      setFreq]      = useState(8.0)
  const [dialAngle, setDialAngle] = useState(-90)
  const freqRef      = useRef(8.0)
  const dialAngleRef = useRef(-90)
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
            <div className="xband-lcd-fault">ANTENNA ALIGNMENT ISSUE</div>
          )}
        </div>

        <div className="xband-controls-row">
          <div className="xband-dial-section">
            <div className="xband-dial-label">FREQUENCY</div>
            <div className="xband-dial-surround">
              <div
                className="xband-dial"
                onMouseDown={onMouseDown}
                style={{ transform: `rotate(${dialAngle}deg)` }}
              >
                <div className="xband-dial-marker" />
              </div>
            </div>
            <div className="xband-dial-range">8 ←──→ 12 GHz</div>
          </div>

          <button className="xband-antenna-btn" disabled={lowPower || aligned} onClick={onAlign}>
            {aligned ? 'ANTENNA ALIGNED' : 'ADJUST ANTENNA ALIGNMENT'}
          </button>
        </div>

      </div>

      {lowPower && <div className="low-power-overlay" />}
    </section>
  )
}
