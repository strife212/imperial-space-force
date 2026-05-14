import { useState, useEffect } from 'react'
import { getFlags } from '../lib/store'

const FAIL_INTRO_TEXT = "Astraia! What in the throne are you doing? The deep space array is showing that the Annunciator has launched towards the Throne System. You'd destroy the Universal Order?"
const TYPE_SPEED_MS   = 35
const INTRO_HOLD_MS   = 1000
const INTRO_FADE_MS   = 500

export default function GameOverScreen({ initialFlagCount = 0, onEncyclopedia, fail = false }) {
  const currentFlagCount = Object.values(getFlags()).filter(Boolean).length
  const hasNewUnlocks    = currentFlagCount > initialFlagCount

  // ── Fail intro state ──────────────────────────────────────────────────────
  // 'typing' → 'fading' → 'done' (intro hidden, dossier shown)
  const [introPhase, setIntroPhase] = useState(fail ? 'typing' : 'done')
  const [typedChars, setTypedChars] = useState(0)

  // ── Fail sequence state ───────────────────────────────────────────────────
  const [rankRevoked,      setRankRevoked]      = useState(false)
  const [clearanceRevoked, setClearanceRevoked] = useState(false)
  const [statusRevoked,    setStatusRevoked]    = useState(false)
  const [slashed,          setSlashed]          = useState(false)
  const [idFading,         setIdFading]         = useState(false)
  const [idGone,           setIdGone]           = useState(false)

  // ── Intro driver: type chars → hold → fade → done ────────────────────────
  useEffect(() => {
    if (!fail) return
    if (introPhase === 'typing') {
      if (typedChars < FAIL_INTRO_TEXT.length) {
        const id = setTimeout(() => setTypedChars(c => c + 1), TYPE_SPEED_MS)
        return () => clearTimeout(id)
      }
      const id = setTimeout(() => setIntroPhase('fading'), INTRO_HOLD_MS)
      return () => clearTimeout(id)
    }
    if (introPhase === 'fading') {
      const id = setTimeout(() => setIntroPhase('done'), INTRO_FADE_MS)
      return () => clearTimeout(id)
    }
  }, [fail, introPhase, typedChars])

  // ── Dossier revocation timers — only start after intro is done ────────────
  useEffect(() => {
    if (!fail || introPhase !== 'done') return
    const timers = [
      setTimeout(() => setRankRevoked(true),      3600),
      setTimeout(() => setClearanceRevoked(true), 4440),
      setTimeout(() => setStatusRevoked(true),    5280),
      setTimeout(() => setSlashed(true),          6120),
      setTimeout(() => setIdFading(true),         8520),
      setTimeout(() => setIdGone(true),           10920),
    ]
    return () => timers.forEach(clearTimeout)
  }, [fail, introPhase])

  // ── Fail intro render ─────────────────────────────────────────────────────
  if (fail && introPhase !== 'done') {
    return (
      <div id="game-over-screen">
        <div className={`go-fail-intro${introPhase === 'fading' ? ' go-fail-intro--fading' : ''}`}>
          {FAIL_INTRO_TEXT.slice(0, typedChars)}
          {typedChars < FAIL_INTRO_TEXT.length && <span className="go-fail-intro-cursor">▌</span>}
        </div>
      </div>
    )
  }

  // ── Fail sequence render ──────────────────────────────────────────────────
  if (fail && !idGone) {
    return (
      <div id="game-over-screen">
        <div className={`go-id-card${idFading ? ' go-id-card--fading' : ''}`}>
          <div className="go-id-header">IMPERIAL SPACE FORCE // OPERATOR DOSSIER</div>
          <div className="go-id-divider" />
          <div className="go-id-body">
            <div className="go-id-portrait-wrap">
              <img
                className="go-id-portrait"
                src={`${import.meta.env.BASE_URL}portrait.png`}
                alt="Operator Portrait"
              />
              {slashed && <div className="go-id-slash" />}
            </div>
            <div className="go-id-info">
              <div className="lip-row">
                <span className="lip-label">DESIGNATION</span>
                <span className="lip-value">HER IMPERIAL HIGHNESS VALERIA ASTRAIA</span>
              </div>
              <div className="lip-row">
                <span className="lip-label">RANK</span>
                <span className={`lip-value${rankRevoked ? ' go-id-revoked' : ''}`}>
                  {rankRevoked ? 'REVOKED' : 'O-10: ADMIRAL'}
                </span>
              </div>
              <div className="lip-row">
                <span className="lip-label">CLEARANCE</span>
                <span className={`lip-value${clearanceRevoked ? ' go-id-revoked' : ''}`}>
                  {clearanceRevoked ? 'REVOKED' : 'CLR-Ω // IMPERIAL'}
                </span>
              </div>
              <div className="lip-row">
                <span className="lip-label">POSTING</span>
                <span className="lip-value">HMSS HER ANNUNCIATOR</span>
              </div>
              <div className="lip-row">
                <span className="lip-label">STATUS</span>
                <span className={`lip-value${statusRevoked ? ' go-id-revoked' : ' lip-value--ok'}`}>
                  {statusRevoked ? 'TRAITOR // HIGH TREASON' : 'ACTIVE // VERIFIED'}
                </span>
              </div>
              <div className="go-id-divider" style={{ marginTop: 8 }} />
              <div className="lip-body">Imperial Princess — 11th in line to the Royal and Imperial Throne.</div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // ── Normal game over ──────────────────────────────────────────────────────
  return (
    <div id="game-over-screen" className={fail && idGone ? 'go-fade-in' : ''}>
      <div className="go-fin">[ FIN. ]</div>
      <div className="go-wip">WORK IN PROGRESS</div>
      {hasNewUnlocks && (
        <div className="go-unlocked" onClick={onEncyclopedia}>
          {currentFlagCount - initialFlagCount === 1
            ? '1 NEW ENCYCLOPEDIA ENTRY PERMANENTLY UNLOCKED - CLICK TO READ'
            : `${currentFlagCount - initialFlagCount} NEW ENCYCLOPEDIA ENTRIES PERMANENTLY UNLOCKED - CLICK TO READ`
          }
        </div>
      )}
      <button className="go-again" onClick={() => window.location.reload()}>
        Play again?
      </button>
    </div>
  )
}
