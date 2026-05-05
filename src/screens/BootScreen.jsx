import { useState, useEffect, useRef } from 'react'
import { BOOT_LINES } from '../lib/constants'

export default function BootScreen({ onComplete }) {
  const [lines,       setLines]       = useState([])
  const [barPct,      setBarPct]      = useState(0)
  const [showBar,     setShowBar]     = useState(false)
  const [showWelcome, setShowWelcome] = useState(false)
  const [exiting,     setExiting]     = useState(false)
  const processingSfx  = useRef(null)
  const linesOuterRef  = useRef(null)

  useEffect(() => {
    const audio = new Audio(`${import.meta.env.BASE_URL}processing.wav`)
    audio.preload = 'auto'
    audio.loop = true
    processingSfx.current = audio
  }, [])

  useEffect(() => {
    const timers = []
    let delay = 450

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
            setTimeout(onComplete, 850)
          }, 1100))
        }
      }, delay))
    })

    return () => {
      timers.forEach(clearTimeout)
      processingSfx.current?.pause()
    }
  }, [onComplete])

  useEffect(() => {
    if (linesOuterRef.current) {
      linesOuterRef.current.scrollTop = linesOuterRef.current.scrollHeight
    }
  }, [lines, showWelcome])

  return (
    <div id="boot-screen" className={exiting ? 'fade-out' : ''}>
      <div className="boot-inner">
        <div className="boot-header">
          <img className="boot-emblem" src={`${import.meta.env.BASE_URL}logo.png`} alt="Imperial Space Force Emblem" />
          <div className="boot-title">IMPERIAL SPACE FORCE</div>
          <div className="boot-subtitle">
            TACTICAL COMMAND INTERFACE // HMSS &quot;HER ANNUNCIATOR&quot; // FIRE CONTROL SYSTEM v6.2.41
          </div>
          <div className="boot-divider" />
        </div>

        <div className="boot-motto">✦ CAELUM CANIT ✦ ILLA AVDIT ✦</div>

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
            <div className="boot-welcome">WELCOME, ADMIRAL.</div>
          )}
        </div>
      </div>
    </div>
  )
}
