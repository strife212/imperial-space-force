import { useState, useEffect, useRef } from 'react'
import { getFlag } from '../lib/store'

// A copy of the legacy boot/loading screen, repurposed as a fleet-muster
// sequence shown after the operator is chosen. Same chrome and styling as the
// legacy BootScreen (shared .boot-* classes); the diagnostic lines are
// fleet-relevant. The first line authenticates the chosen operator.
export default function FleetBoot({ onComplete }) {
  const operator = getFlag('operator') || 'HIH FLEET COMMAND // CLR-Ω'
  const BOOT_LINES = [
    { text: `Authenticating fleet commander // ${operator}`,            tag: 'OK',   ms: 320 },
    { text: 'Mounting standing fleet roster from Requisition ledger',    tag: 'OK',   ms: 270 },
    { text: 'Spooling flagship reactor to operational output',           tag: 'OK',   ms: 315 },
    { text: 'Synchronising squadron flight computers (6th-order RK)',     tag: 'OK',   ms: 250 },
    { text: 'Calibrating formation station-keeping thrusters',           tag: 'OK',   ms: 300 },
    { text: 'Establishing 256-qubit QKD fleet datalink',                 tag: 'OK',   ms: 430 },
    { text: 'Priming interceptor & bomber munition interlocks',          tag: 'OK',   ms: 330 },
    { text: 'Plotting Lense–Thirring nav corrections for the lane',      tag: 'OK',   ms: 360 },
    { text: 'Minkowski threat-detection array — sweep online',           tag: 'OK',   ms: 285 },
    { text: 'Tachyonic flux monitor: 2.1σ above background',             tag: 'WARN', ms: 450 },
    { text: 'All squadrons report ready — fleet at muster',              tag: 'OK',   ms: 600 },
  ]

  const [lines,       setLines]       = useState([])
  const [barPct,      setBarPct]      = useState(0)
  const [showBar,     setShowBar]     = useState(false)
  const [showWelcome, setShowWelcome] = useState(false)
  const [exiting,     setExiting]     = useState(false)
  const [motto1,      setMotto1]      = useState(false)
  const [motto2,      setMotto2]      = useState(false)
  const processingSfx = useRef(null)
  const linesOuterRef = useRef(null)
  const onCompleteRef = useRef(onComplete)
  useEffect(() => { onCompleteRef.current = onComplete }, [onComplete])

  useEffect(() => {
    const audio = new Audio(`${import.meta.env.BASE_URL}processing.wav`)
    audio.preload = 'auto'
    audio.loop = true
    processingSfx.current = audio
  }, [])

  useEffect(() => {
    const timers = []

    // Motto reveal: part 1 → pause → part 2 → pause → lines
    const MOTTO_OFFSET = 1300
    timers.push(setTimeout(() => setMotto1(true), 300))
    timers.push(setTimeout(() => setMotto2(true), 800))

    let delay = 450 + MOTTO_OFFSET

    BOOT_LINES.forEach((entry, i) => {
      delay += entry.ms
      timers.push(setTimeout(() => {
        setLines(prev => [...prev, entry])
        if (i === 0) {
          setShowBar(true)
          processingSfx.current?.play().catch(() => {})
        }
        setBarPct(((i + 1) / BOOT_LINES.length) * 100)

        if (i === BOOT_LINES.length - 1) {
          processingSfx.current?.pause()
          setShowWelcome(true)
          timers.push(setTimeout(() => {
            setExiting(true)
            setTimeout(() => onCompleteRef.current?.(), 850)
          }, 1100))
        }
      }, delay))
    })

    return () => {
      timers.forEach(clearTimeout)
      processingSfx.current?.pause()
    }
    // run the sequence once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (linesOuterRef.current) {
      linesOuterRef.current.scrollTop = linesOuterRef.current.scrollHeight
    }
  }, [lines, showWelcome])

  return (
    <div id="boot-screen" className={`fleet-boot${exiting ? ' fade-out' : ''}`}>
      <div className="boot-inner">
        <div className="boot-header">
          <img className="boot-emblem" src={`${import.meta.env.BASE_URL}logo.png`} alt="Imperial Space Force Emblem" />
          <div className="boot-title">IMPERIAL SPACE FORCE</div>
          <div className="boot-subtitle">
            FLEET COMMAND // MUSTER PROTOCOL // ORBITAL DEPLOYMENT SUITE v6.2.41
          </div>
          <div className="boot-divider" />
        </div>

        <div className="boot-motto">
          <span className={`boot-motto-half${motto1 ? ' boot-motto-half--visible' : ''}`}>✦ CAELUM CANIT</span>
          <span className={`boot-motto-half${motto2 ? ' boot-motto-half--visible' : ''}`}> ✦ ILLA AVDIT ✦</span>
        </div>

        <div className="boot-lines-outer" ref={linesOuterRef}>
          <ul className="boot-lines">
            {lines.map((entry, i) => {
              const tagClass = entry.tag === 'OK' ? 'ok' : entry.tag === 'WARN' ? 'warn' : 'fail'
              return (
                <li key={i} className="boot-line">
                  <span className="bl-text">{entry.text}</span>
                  <span className={`bl-tag ${tagClass}`}>[ {entry.tag} ]</span>
                </li>
              )
            })}
          </ul>

          {showBar && (
            <div className="boot-bar-wrap">
              <div className="boot-bar" style={{ width: `${barPct}%` }} />
            </div>
          )}

          {showWelcome && (
            <div className="boot-welcome">THE FLEET STANDS READY, ADMIRAL.</div>
          )}
        </div>
      </div>
    </div>
  )
}
