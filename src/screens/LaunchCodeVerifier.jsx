import { useState, useEffect, useRef } from 'react'

const CHARS     = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
const BOX_COUNT = 15
const CYCLE_MS  = 75
const LOCK_START_MS   = 700
const LOCK_INTERVAL_MS = 260

const randChar = () => CHARS[Math.floor(Math.random() * CHARS.length)]

const NT_FILL_INTERVAL = 80   // ms between each ? locking in
const NT_ERROR_DELAY   = BOX_COUNT * NT_FILL_INTERVAL + 300  // switch to error msg
const NT_DISMISS_DELAY = NT_ERROR_DELAY + 2200 + 1000        // flash (2s) + 1s hold

export default function LaunchCodeVerifier({ onComplete, onTick, onFire, launchPhase, launchLabel, launchFiring, launchCdText, cdVisible, noTarget, onDismiss }) {
  const [symbols,     setSymbols]     = useState(() => Array.from({ length: BOX_COUNT }, randChar))
  const [lockedCount, setLockedCount] = useState(0)
  const [ntPhase,     setNtPhase]     = useState('filling') // 'filling' | 'error'
  const lockedRef  = useRef(0)
  const ntLockedRef = useRef(0)
  const finalChars = useRef(Array.from({ length: BOX_COUNT }, randChar))
  const timers     = useRef([])
  const beepRef    = useRef(null)

  useEffect(() => {
    const b = new Audio(`${import.meta.env.BASE_URL}beep.mp3`)
    b.preload = 'auto'
    beepRef.current = b
  }, [])

  // Beep in sync with the 1s warning-pulse blink when PACKAGE AWAY is showing
  useEffect(() => {
    if (launchPhase !== 'fired') return
    const playBeep = () => { if (beepRef.current) beepRef.current.cloneNode().play().catch(() => {}) }
    playBeep()
    const id = setInterval(playBeep, 1200)
    return () => clearInterval(id)
  }, [launchPhase])

  // No-target rejection sequence
  useEffect(() => {
    if (!noTarget) return
    ntLockedRef.current = 0

    // Cycle random chars for unlocked boxes
    const cycleId = setInterval(() => {
      const n = ntLockedRef.current
      setSymbols(prev => prev.map((c, i) => i < n ? '?' : randChar()))
    }, CYCLE_MS)

    // Lock boxes to '?' one by one
    for (let i = 0; i < BOX_COUNT; i++) {
      timers.current.push(setTimeout(() => {
        ntLockedRef.current = i + 1
      }, i * NT_FILL_INTERVAL))
    }

    // Switch to error message
    timers.current.push(setTimeout(() => {
      clearInterval(cycleId)
      setNtPhase('error')
    }, NT_ERROR_DELAY))

    // Dismiss
    timers.current.push(setTimeout(() => {
      onDismiss?.()
    }, NT_DISMISS_DELAY))

    return () => {
      clearInterval(cycleId)
      timers.current.forEach(clearTimeout)
      timers.current = []
    }
  }, [noTarget]) // eslint-disable-line

  // Normal locking sequence
  useEffect(() => {
    if (noTarget) return

    const interval = setInterval(() => {
      if (lockedRef.current >= BOX_COUNT) return
      setSymbols(prev => prev.map((c, i) =>
        i < lockedRef.current ? finalChars.current[i] : randChar()
      ))
    }, CYCLE_MS)

    for (let i = 0; i < BOX_COUNT; i++) {
      timers.current.push(setTimeout(() => {
        lockedRef.current = i + 1
        setLockedCount(i + 1)
        onTick?.()
        if (i === BOX_COUNT - 1) {
          timers.current.push(setTimeout(onComplete, 500))
        }
      }, LOCK_START_MS + i * LOCK_INTERVAL_MS))
    }

    return () => {
      clearInterval(interval)
      timers.current.forEach(clearTimeout)
    }
  }, [noTarget, onComplete])

  const allLocked   = lockedCount === BOX_COUNT
  const isVerifying = !noTarget && (launchPhase === 'verifying' || launchPhase === 'armed')
  const isCountdown = launchPhase === 'countdown'
  const isFired     = launchPhase === 'fired'

  return (
    <div className="code-verify-overlay">
      <div className="code-verify-dialog">

        {/* ── No-target rejection ─────────────────────────────────────── */}
        {noTarget && ntPhase === 'filling' && (
          <>
            <div className="code-verify-title">VERIFYING LAUNCH CODES</div>
            <div className="code-verify-boxes">
              {symbols.map((sym, i) => (
                <div key={i} className={`code-box code-box--invalid${ntLockedRef.current > i ? ' locked-invalid' : ''}`}>
                  {ntLockedRef.current > i ? '?' : sym}
                </div>
              ))}
            </div>
            <div className="code-verify-status">AUTHENTICATING — QUERYING TARGET DATA</div>
          </>
        )}

        {noTarget && ntPhase === 'error' && (
          <>
            <div className="code-verify-title">VERIFYING LAUNCH CODES</div>
            <div className="code-verify-boxes">
              {Array.from({ length: BOX_COUNT }).map((_, i) => (
                <div key={i} className="code-box code-box--invalid locked-invalid">?</div>
              ))}
            </div>
            <div className="cvl-no-target-msg">
              NO TARGET SELECTED — LAUNCH CODES UNAVAILABLE
            </div>
          </>
        )}

        {isVerifying && (
          <>
            <div className="code-verify-title">VERIFYING LAUNCH CODES</div>
            <div className="code-verify-boxes">
              {symbols.map((sym, i) => (
                <div key={i} className={`code-box${i < lockedCount ? ' locked' : ''}`}>
                  {i < lockedCount ? finalChars.current[i] : sym}
                </div>
              ))}
            </div>
            <div className={`code-verify-status${allLocked ? ' verified' : ''}`}>
              {allLocked
                ? 'CODES VERIFIED — LAUNCH ENABLED'
                : `AUTHENTICATING — ${lockedCount} / ${BOX_COUNT}`}
            </div>
            <button
              className={`launch-btn cvl-launch-btn${launchFiring ? ' firing-anim' : ''}${!allLocked ? ' cvl-launch-btn--locked' : ''}`}
              onClick={allLocked ? onFire : undefined}
              disabled={!allLocked}
            >
              <span className="launch-btn-inner">
                <span className="launch-btn-label">{launchLabel}</span>
              </span>
            </button>
          </>
        )}

        {isCountdown && (
          <div className="cvl-warning-body">
            <div className="cvl-warning-text">⚠ WARNING — LAUNCH INITIATED ⚠</div>
            <div className="cvl-warning-cd">! T−&nbsp;<span key={launchCdText} className="cvl-cd-num--flash">{launchCdText.slice(-2)}</span> !</div>
          </div>
        )}

        {isFired && (
          <div className={`cvl-warning-body cvl-fired${launchFiring ? ' firing-anim' : ''}`}>
            <div className="cvl-warning-text">⚠ PACKAGE AWAY ⚠</div>
            <div className="cvl-fired-blessing">
              The Celestial Lance has been cast.<br />Goddess be with you.
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
