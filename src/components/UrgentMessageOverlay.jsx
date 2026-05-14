import { useState, useEffect, useMemo, useRef } from 'react'
import { SENDER_PORTRAITS } from '../data/portraits'

const TYPE_SPEED_MS = 25     // per visible character
const EXIT_MS       = 240    // exit animation duration

// ── Tokenize a paragraph into [{ text, bold?, highlight?, red? }, ...] ───────
function tokenize(text) {
  const tokens = []
  const regex = /\*\*([^*]+)\*\*|!!([^!]+)!!|##([^#]+)##/g
  let last = 0, m
  while ((m = regex.exec(text)) !== null) {
    if (m.index > last) tokens.push({ text: text.slice(last, m.index) })
    if (m[1] !== undefined)      tokens.push({ text: m[1], bold: true })
    else if (m[2] !== undefined) tokens.push({ text: m[2], highlight: true })
    else                         tokens.push({ text: m[3], red: true })
    last = m.index + m[0].length
  }
  if (last < text.length) tokens.push({ text: text.slice(last) })
  return tokens
}

// Convert "\n" to <br /> within a string slice
const splitBreaks = (str, kp) =>
  str.split('\n').flatMap((line, i, a) =>
    i < a.length - 1 ? [line, <br key={`${kp}-${i}`} />] : [line]
  )

// Render a tokenised paragraph up to `charsRevealed` visible chars
function renderTypedTokens(tokens, charsRevealed, keyBase) {
  const out = []
  let remaining = charsRevealed
  tokens.forEach((tok, i) => {
    if (remaining <= 0) return
    const slice = tok.text.slice(0, remaining)
    remaining -= slice.length
    const content = splitBreaks(slice, `${keyBase}-${i}`)
    if (tok.bold)           out.push(<strong key={i}>{content}</strong>)
    else if (tok.highlight) out.push(<strong key={i} className="urg-text-highlight">{content}</strong>)
    else if (tok.red)       out.push(<strong key={i} className="urg-text-red">{content}</strong>)
    else                    out.push(<span key={i}>{content}</span>)
  })
  return out
}

export default function UrgentMessageOverlay({
  sender,
  subject,
  body,
  portrait,
  onClose,
  dismissLabel = 'ACKNOWLEDGE',
}) {
  const portraitSrc = portrait ?? SENDER_PORTRAITS[sender] ?? null

  // Pre-process paragraphs once
  const paragraphs = useMemo(() => {
    const arr = Array.isArray(body) ? body : (body || '').split('\n\n')
    return arr.map(p => ({
      tokens:     tokenize(p),
      visibleLen: p.replace(/\*\*([^*]+)\*\*|!!([^!]+)!!|##([^#]+)##/g, '$1$2$3').length,
    }))
  }, [body])
  const totalChars = useMemo(
    () => paragraphs.reduce((s, p) => s + p.visibleLen, 0),
    [paragraphs],
  )

  const [typedChars, setTypedChars] = useState(0)
  const [closing,    setClosing]    = useState(false)
  const closeTimer = useRef(null)

  // Type-out loop
  useEffect(() => {
    if (typedChars >= totalChars) return
    const id = setTimeout(() => setTypedChars(c => c + 1), TYPE_SPEED_MS)
    return () => clearTimeout(id)
  }, [typedChars, totalChars])

  useEffect(() => () => clearTimeout(closeTimer.current), [])

  const done = typedChars >= totalChars

  const handleAck = () => {
    if (!done || closing) return
    setClosing(true)
    closeTimer.current = setTimeout(() => onClose?.(), EXIT_MS)
  }

  return (
    <>
      <div className={`urg-dim${closing ? ' urg-dim--closing' : ''}`} />
      <div
        className={`urg-panel${closing ? ' urg-panel--closing' : ''}`}
        role="dialog"
        aria-modal="true"
      >

        <div className="urg-header">
          <span className="urg-header-pulse" />
          <span className="urg-header-title">PRIORITY ALPHA // URGENT TRANSMISSION</span>
        </div>

        <div className="urg-body">
          <div className="urg-portrait-wrap">
            {portraitSrc
              ? <img className="urg-portrait" src={portraitSrc} alt={sender} />
              : <div className="urg-no-portrait">[ NO IMAGE ]</div>
            }
          </div>

          <div className="urg-content">
            {sender  && <div className="urg-sender">{sender}</div>}
            {subject && <div className="urg-subject">{subject}</div>}
            <div className="urg-divider" />
            <div className="urg-text">
              {paragraphs.map((p, i) => {
                const prior = paragraphs.slice(0, i).reduce((s, pp) => s + pp.visibleLen, 0)
                const here  = Math.max(0, Math.min(p.visibleLen, typedChars - prior))
                const isLastTyping = !done && (
                  here > 0 && here < p.visibleLen
                  || (here === p.visibleLen && prior + p.visibleLen === typedChars && i < paragraphs.length - 1)
                  || (i === paragraphs.length - 1 && here < p.visibleLen)
                )
                return (
                  <p key={i} className="urg-para">
                    {renderTypedTokens(p.tokens, here, `p${i}`)}
                    {isLastTyping && here > 0 && <span className="urg-cursor">▌</span>}
                  </p>
                )
              })}
            </div>
            {onClose && (
              <button
                className={`urg-dismiss-btn${done ? '' : ' urg-dismiss-btn--disabled'}`}
                onClick={handleAck}
                disabled={!done}
              >
                {dismissLabel}
              </button>
            )}
          </div>
        </div>

      </div>
    </>
  )
}
