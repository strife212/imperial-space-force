import { useState, useEffect } from 'react'

// The campaign's closing card: shown once the Anastasis victory scene fades,
// after the last battle is won. It rises out of black, holds, then fades and
// hands control back to the caller (→ the campaign map).
const HOLD_MS = 10000   // total time on screen before we return
const FADE_MS = 1100    // matches the .credits-* opacity transitions

const ROWS = [
  { role: 'Game Design, Scenario, Story, Dialogue', name: 'Strife212' },
  { role: 'Code', name: 'Fable/Opus' },
]

export default function CreditsScreen({ onComplete }) {
  const [shown, setShown] = useState(false)
  const [leaving, setLeaving] = useState(false)

  useEffect(() => {
    const enter = setTimeout(() => setShown(true), 40)          // let initial styles commit, then fade in
    const leave = setTimeout(() => setLeaving(true), HOLD_MS - FADE_MS)
    const done = setTimeout(() => onComplete?.(), HOLD_MS)
    return () => { clearTimeout(enter); clearTimeout(leave); clearTimeout(done) }
  }, [onComplete])

  return (
    <div className={`credits${shown && !leaving ? ' credits--in' : ''}`}>
      <div className="credits-inner">
        <div className="credits-title">Imperial Space Force</div>
        <div className="credits-rule" />
        <div className="credits-roles">
          {ROWS.map((r) => (
            <div key={r.role} className="credits-row">
              <div className="credits-role">{r.role}</div>
              <div className="credits-name">{r.name}</div>
            </div>
          ))}
        </div>
        <div className="credits-hail">Long Live the Universal Order!</div>
      </div>
    </div>
  )
}
