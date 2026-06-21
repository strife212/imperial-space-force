import { useState, useEffect, useRef } from 'react'
import { useScreenScale, SCREEN_DESIGN_HEIGHT } from '../hooks/useScreenScale'
import './character-select.css'

const BASE = import.meta.env.BASE_URL

// Selectable operators. Placeholder roster for now — existing portraits paired
// with fitting names/dossiers. `ok` marks a green ("verified") status value;
// `code` is the (masked) access code typed on authentication.
const OPERATORS = [
  {
    portrait: `${BASE}portrait.png`,
    name: 'PRINCESS V. ASTRAIA',
    code: 'IMPERIAL-CLEARANCE-OMEGA',
    flagship: "Saint Berenike's Lance",
    fleet: 'Fleet Berenike',
    elite: { name: 'LANCE STRIKE', desc: 'Turns the flagship onto the enemy capital, charges the spinal lance and looses a single beam for 20 damage.' },
    rows: [
      ['RANK', 'O-10 · ADMIRAL'],
      ['CLEARANCE', 'CLR-Ω · IMPERIAL'],
      ['POSTING', 'FLEET BERENIKE'],
      ['STATUS', 'ACTIVE · VERIFIED', true],
    ],
    body: 'Imperial Princess — 11th in line to the Royal and Imperial Throne. Steady hand, line-of-battle doctrine.',
  },
  {
    portrait: `${BASE}portrait2.jpg`,
    name: 'PRINCESS T. SEVERINE',
    code: 'CROWN-CLEARANCE-NINE',
    flagship: 'Saint Concordia Heard First',
    fleet: 'Fleet Concordia',
    elite: { name: 'FIGHTER ACE', desc: 'Warps in an elite gold fighter — double hull, 1.5× speed and twice the rate of fire.' },
    rows: [
      ['RANK', 'O-9 · VICE ADMIRAL'],
      ['CLEARANCE', 'CLR-IX · CROWN'],
      ['POSTING', 'FLEET CONCORDIA'],
      ['STATUS', 'ACTIVE · VERIFIED', true],
    ],
    body: 'Decorated for the relief of the Outer Marches. Aggressive, cruiser-forward; trades ships for ground.',
  },
  {
    portrait: `${BASE}portrait3.jpg`,
    name: 'PRINCESS C. LUCIA',
    code: 'CROWN-CLEARANCE-SEVEN',
    flagship: 'The Empress Remembers Saint Polyhymnia',
    fleet: 'Fleet Polyhymnia',
    elite: { name: 'NANO REPAIR', desc: 'Releases a nanite swarm that repairs the fleet — +1 hull to every ship and +20 to the flagship.' },
    rows: [
      ['RANK', 'O-7 · COMMODORE'],
      ['CLEARANCE', 'CLR-VII · CROWN'],
      ['POSTING', 'FLEET POLYHYMNIA'],
      ['STATUS', 'ACTIVE · VERIFIED', true],
    ],
    body: 'Princess of the cadet branch. Voidborne since childhood; favours fast carriers and closer odds.',
  },
]

const ID_SPEED = 42   // ms per character — operator id
const PW_SPEED = 55   // ms per character — access code

export default function CharacterSelect({ onComplete, onBack }) {
  const [idx, setIdx] = useState(0)
  const [dir, setDir] = useState(1)            // last carousel direction → drives the slide-in
  const [phase, setPhase] = useState('select') // select → fading → auth
  const [authOp, setAuthOp] = useState(null)
  const [operatorText, setOperatorText] = useState('')
  const [passwordText, setPasswordText] = useState('')
  const [authDone, setAuthDone] = useState(false)
  const innerRef = useScreenScale(SCREEN_DESIGN_HEIGHT)
  const clickSfx = useRef(null)
  const beepSfx = useRef(null)
  const timers = useRef([])

  useEffect(() => {
    const a = new Audio(`${BASE}click.wav`); a.preload = 'auto'; clickSfx.current = a
    const b = new Audio(`${BASE}beep.mp3`); b.preload = 'auto'; beepSfx.current = b
    return () => timers.current.forEach(clearTimeout)
  }, [])
  const ping = () => { const a = clickSfx.current; if (a) { a.currentTime = 0; a.play().catch(() => {}) } }
  // cloneNode so rapid flashes can overlap (matches the legacy crypto module)
  const beep = () => { const b = beepSfx.current; if (b) b.cloneNode().play().catch(() => {}) }

  const go = (d) => { ping(); setDir(d); setIdx(i => (i + d + OPERATORS.length) % OPERATORS.length) }

  // Authenticate: fade the card out, then type the operator id + access code
  // character by character before continuing (à la the legacy login screen).
  const startTyping = (op) => {
    const id = op.name, pw = op.code
    id.split('').forEach((_, i) => timers.current.push(setTimeout(() => setOperatorText(id.slice(0, i + 1)), i * ID_SPEED)))
    const pwStart = id.length * ID_SPEED + 220
    pw.split('').forEach((_, i) => timers.current.push(setTimeout(() => setPasswordText(pw.slice(0, i + 1)), pwStart + i * PW_SPEED)))
    const grantAt = pwStart + pw.length * PW_SPEED + 260
    timers.current.push(setTimeout(() => setAuthDone(true), grantAt))
    // flash "ACCESS GRANTED" a few times with a beep on each flash, then go
    const FLASH = 800, FLASHES = 3
    for (let i = 0; i < FLASHES; i++) timers.current.push(setTimeout(beep, grantAt + i * FLASH))
    timers.current.push(setTimeout(() => onComplete?.(op), grantAt + FLASHES * FLASH + 400))
  }
  const confirm = () => {
    if (phase !== 'select') return
    ping()
    const op = OPERATORS[idx]
    setAuthOp(op)
    setPhase('fading')
    timers.current.push(setTimeout(() => { setPhase('auth'); startTyping(op) }, 430))
  }

  // ‹ / › cycle the carousel; Enter confirms — only while still selecting.
  useEffect(() => {
    const onKey = (e) => {
      if (phase !== 'select') return
      if (e.key === 'ArrowLeft') go(-1)
      else if (e.key === 'ArrowRight') go(1)
      else if (e.key === 'Enter') confirm()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [idx, phase])

  const op = OPERATORS[idx]

  return (
    <div id="character-select">
      <div className="cs-inner" ref={innerRef}>
        <div className="boot-header">
          <img className="boot-emblem" src={`${BASE}logo.png`} alt="Imperial Space Force Emblem" />
          <div className="boot-title">IMPERIAL SPACE FORCE</div>
          <div className="boot-subtitle">OPERATOR SELECTION // ASSUME COMMAND OF THE MUSTERING FLEET</div>
          <div className="boot-divider" />
        </div>

        {phase === 'auth' ? (
          <div className="cs-card cs-card--auth">
            <div className="cs-portrait-frame">
              <img className="cs-portrait" src={authOp.portrait} alt={authOp.name} />
              <div className="cs-portrait-scan" />
            </div>
            <div className="cs-auth-fields">
              <div className="cs-heading">SECURE AUTHENTICATION</div>
              <div className="cs-divider" />
              <div className="login-fields">
                <div className="login-field-row">
                  <label className="login-label">OPERATOR ID</label>
                  <div className="login-input-wrap">
                    <input className="login-input" type="text" value={operatorText} readOnly />
                    {operatorText.length < authOp.name.length && (
                      <span className="login-cursor" style={{ left: `calc(12px + ${operatorText.length} * 1ch + ${operatorText.length * 0.08}em)` }} aria-hidden>▌</span>
                    )}
                  </div>
                </div>
                <div className="login-field-row">
                  <label className="login-label">ACCESS CODE</label>
                  <div className="login-input-wrap">
                    <input className="login-input" type="password" value={passwordText} readOnly />
                    {operatorText.length >= authOp.name.length && passwordText.length < authOp.code.length && (
                      <span className="login-cursor" style={{ left: `calc(12px + ${passwordText.length} * 1ch + ${passwordText.length * 0.08}em)` }} aria-hidden>▌</span>
                    )}
                  </div>
                </div>
              </div>
              <div className="cs-divider" />
              <div className={`cs-auth-status${authDone ? ' cs-auth-status--ok' : ''}`}>
                {authDone ? '✓ ACCESS GRANTED' : 'AUTHENTICATING…'}
              </div>
            </div>
          </div>
        ) : (
          <div className={`cs-carousel${phase === 'fading' ? ' cs-fade-out' : ''}`}>
            <div className="cs-stage">
              <button className="cs-arrow cs-arrow--left" onClick={() => go(-1)} aria-label="Previous operator">‹</button>

              <div className="cs-card" key={idx} data-dir={dir > 0 ? 'next' : 'prev'}>
                <div className="cs-portrait-frame">
                  <img className="cs-portrait" src={op.portrait} alt={op.name} />
                  <div className="cs-portrait-scan" />
                </div>
                <div className="cs-dossier">
                  <div className="cs-heading">OPERATOR DOSSIER</div>
                  <div className="cs-divider" />
                  <div className="cs-name">{op.name}</div>
                  <div className="cs-rows">
                    {op.rows.map(([label, value, ok]) => (
                      <div className="cs-row" key={label}>
                        <span className="cs-row-label">{label}</span>
                        <span className={`cs-row-value${ok ? ' cs-row-value--ok' : ''}`}>{value}</span>
                      </div>
                    ))}
                  </div>
                  <div className="cs-divider" />
                  <div className="cs-flagship"><span className="cs-flagship-label">FLAGSHIP:</span> <span className="cs-flagship-name">{op.flagship}</span></div>
                  <div className="cs-elite"><span className="cs-elite-label">ELITE SKILL:</span> <span className="cs-elite-name">{op.elite.name}</span></div>
                  <div className="cs-elite-desc">{op.elite.desc}</div>
                  <div className="cs-body">{op.body}</div>
                </div>
              </div>

              <button className="cs-arrow cs-arrow--right" onClick={() => go(1)} aria-label="Next operator">›</button>
            </div>

            <div className="cs-dots">
              {OPERATORS.map((_, i) => (
                <button
                  key={i}
                  className={`cs-dot${i === idx ? ' cs-dot--on' : ''}`}
                  aria-label={`Operator ${i + 1}`}
                  onClick={() => { ping(); setDir(i > idx ? 1 : -1); setIdx(i) }}
                />
              ))}
            </div>

            <button className="cs-confirm" onClick={confirm}>AUTHENTICATE &amp; ENTER</button>
          </div>
        )}
      </div>

      {phase === 'select' && (
        <footer className="login-footer">
          <button className="login-debug-link" onClick={onBack}>← back</button>
        </footer>
      )}
    </div>
  )
}
