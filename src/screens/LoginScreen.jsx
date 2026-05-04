import { useState, useRef, useEffect } from 'react'

const OPERATOR_ID = 'HIH V. ASTRAIA // CLR-Ω'
const PASSWORD    = 'IMPERIAL-CLEARANCE-OMEGA'
const ID_SPEED    = 38   // ms per character
const PW_SPEED    = 60   // ms per character

export default function LoginScreen({ onComplete }) {
  const [exiting,      setExiting]      = useState(false)
  const [phase,        setPhase]        = useState('idle')  // idle | typing | ready
  const [operatorText, setOperatorText] = useState('')
  const [passwordText, setPasswordText] = useState('')
  const timers = useRef([])

  useEffect(() => () => timers.current.forEach(clearTimeout), [])

  const startFill = () => {
    if (phase !== 'idle') return
    setPhase('typing')

    // Type operator ID
    OPERATOR_ID.split('').forEach((_, i) => {
      timers.current.push(setTimeout(() => {
        setOperatorText(OPERATOR_ID.slice(0, i + 1))
      }, i * ID_SPEED))
    })

    // Type password after operator ID finishes
    const pwStart = OPERATOR_ID.length * ID_SPEED + 120
    PASSWORD.split('').forEach((_, i) => {
      timers.current.push(setTimeout(() => {
        setPasswordText(PASSWORD.slice(0, i + 1))
      }, pwStart + i * PW_SPEED))
    })

    // Mark ready after both done
    timers.current.push(setTimeout(() => {
      setPhase('ready')
    }, pwStart + PASSWORD.length * PW_SPEED + 100))
  }

  const handleLogin = () => {
    setExiting(true)
    setTimeout(onComplete, 700)
  }

  const portraitVisible = phase !== 'idle'
  const btnDisabled     = phase !== 'ready' || exiting

  return (
    <div id="login-screen" className={exiting ? 'fade-out' : ''}>
      <div className="login-inner">
        <div className="boot-header">
          <img className="boot-emblem" src={`${import.meta.env.BASE_URL}logo.png`} alt="Imperial Space Force Emblem" />
          <div className="boot-title">IMPERIAL SPACE FORCE</div>
          <div className="boot-subtitle">
            TACTICAL COMMAND INTERFACE // HMSS &quot;HER ANNUNCIATOR&quot; // FIRE CONTROL SYSTEM v6.2.41
          </div>
          <div className="boot-divider" />
        </div>

        <div className="login-form">
          <div className="login-portrait-wrap">
            <img
              className={`login-portrait${portraitVisible ? ' visible' : ''}`}
              src={`${import.meta.env.BASE_URL}portrait.png`}
              alt="Operator Portrait"
            />
            {!portraitVisible && <span className="login-portrait-empty">[NO USER]</span>}
          </div>
          <div className="login-fields">
            <div className="login-field-row">
              <label className="login-label">OPERATOR ID</label>
              <input
                className="login-input"
                type="text"
                value={operatorText}
                onFocus={startFill}
                onChange={() => {}}
                readOnly
              />
            </div>
            <div className="login-field-row">
              <label className="login-label">ACCESS CODE</label>
              <input
                className="login-input"
                type="password"
                value={passwordText}
                onFocus={startFill}
                onChange={() => {}}
                readOnly
              />
            </div>
            <button className="login-btn" onClick={handleLogin} disabled={btnDisabled}>
              AUTHENTICATE &amp; ENTER
            </button>
          </div>
        </div>

        <div className="login-anthem">
          <p>
            From the high and sacrèd morning star<br />
            To the silent deeps where no suns are<br />
            O Empress, thou alone dost hear<br />
            The turning of each celestial sphere
          </p>
          <p>
            We are the chord beneath thy hand<br />
            We are the chord,<br />
            O Star-Hearer, we are the chord beneath thy hand.
          </p>
          <p>
            Ten thousand daughters bear thy name<br />
            Each princess thy belovèd flame<br />
            A note set down upon thy stave<br />
            A song that none beside thee gave
          </p>
          <p>
            We are the chord beneath thy hand,<br />
            We are the chord,<br />
            O Star-Hearèr, we are the chord beneath thy hand.
          </p>
        </div>
      </div>
    </div>
  )
}
