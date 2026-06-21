import { useState, useEffect, useRef } from 'react'
import { useScreenScale } from '../hooks/useScreenScale'
import './character-select.css'

const BASE = import.meta.env.BASE_URL

// Selectable operators. Placeholder roster for now — existing portraits paired
// with fitting names/dossiers. `ok` marks a green ("verified") status value.
const OPERATORS = [
  {
    portrait: `${BASE}portrait.png`,
    name: 'PRINCESS V. ASTRAIA',
    rows: [
      ['RANK', 'O-10 · ADMIRAL'],
      ['CLEARANCE', 'CLR-Ω · IMPERIAL'],
      ['POSTING', 'HMSS HER ANNUNCIATOR'],
      ['STATUS', 'ACTIVE · VERIFIED', true],
    ],
    body: 'Imperial Princess — 11th in line to the Royal and Imperial Throne. Steady hand, line-of-battle doctrine.',
  },
  {
    portrait: `${BASE}portrait2.jpg`,
    name: 'PRINCESS T. SEVERINE',
    rows: [
      ['RANK', 'O-9 · VICE ADMIRAL'],
      ['CLEARANCE', 'CLR-IX · CROWN'],
      ['POSTING', 'FLEET CALLIOPE'],
      ['STATUS', 'ACTIVE · VERIFIED', true],
    ],
    body: 'Decorated for the relief of the Outer Marches. Aggressive, cruiser-forward; trades ships for ground.',
  },
  {
    portrait: `${BASE}portrait3.jpg`,
    name: 'PRINCESS C. LUCIA',
    rows: [
      ['RANK', 'O-7 · COMMODORE'],
      ['CLEARANCE', 'CLR-VII · CROWN'],
      ['POSTING', 'FLEET POLYHYMNIA'],
      ['STATUS', 'ACTIVE · VERIFIED', true],
    ],
    body: 'Princess of the cadet branch. Voidborne since childhood; favours fast carriers and closer odds.',
  },
]

export default function CharacterSelect({ onComplete, onBack }) {
  const [idx, setIdx] = useState(0)
  const [dir, setDir] = useState(1)      // last carousel direction → drives the slide-in
  const innerRef = useScreenScale()
  const clickSfx = useRef(null)

  useEffect(() => {
    const a = new Audio(`${BASE}click.wav`); a.preload = 'auto'; clickSfx.current = a
  }, [])
  const ping = () => { const a = clickSfx.current; if (a) { a.currentTime = 0; a.play().catch(() => {}) } }

  const go = (d) => { ping(); setDir(d); setIdx(i => (i + d + OPERATORS.length) % OPERATORS.length) }
  const confirm = () => { ping(); onComplete?.(OPERATORS[idx]) }

  // ‹ / › arrow keys cycle the carousel; Enter confirms. Re-bound on idx change
  // so confirm() always reads the current selection.
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'ArrowLeft') go(-1)
      else if (e.key === 'ArrowRight') go(1)
      else if (e.key === 'Enter') confirm()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [idx])

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

      <footer className="login-footer">
        <button className="login-debug-link" onClick={onBack}>← back</button>
      </footer>
    </div>
  )
}
