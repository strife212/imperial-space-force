import { useState, useEffect, useRef } from 'react'

const CHARS     = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
const BOX_COUNT = 15
const CYCLE_MS  = 75
const LOCK_START_MS   = 700
const LOCK_INTERVAL_MS = 260

const randChar = () => CHARS[Math.floor(Math.random() * CHARS.length)]

export default function LaunchCodeVerifier({ onComplete, onTick, onFire, launchPhase, launchLabel, launchFiring }) {
  const [symbols,     setSymbols]     = useState(() => Array.from({ length: BOX_COUNT }, randChar))
  const [lockedCount, setLockedCount] = useState(0)
  const lockedRef  = useRef(0)
  const finalChars = useRef(Array.from({ length: BOX_COUNT }, randChar))
  const timers     = useRef([])

  useEffect(() => {
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
  }, [onComplete])

  const allLocked = lockedCount === BOX_COUNT

  return (
    <div className="code-verify-overlay">
      <div className="code-verify-dialog">
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
        {launchPhase === 'armed' && (
          <button
            className={`launch-btn cvl-launch-btn${launchFiring ? ' firing-anim' : ''}`}
            onClick={onFire}
          >
            <span className="launch-btn-inner">
              <span className="launch-btn-label">{launchLabel}</span>
            </span>
          </button>
        )}
      </div>
    </div>
  )
}
