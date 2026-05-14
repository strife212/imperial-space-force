import { useState, useEffect, useRef } from 'react'
import { SENDER_PORTRAITS } from '../data/portraits'

// Inline formatter: **bold**, !!red!!, \n line breaks
const renderMailInline = (text) => {
  const result = []
  const regex = /\*\*([^*]+)\*\*|!!([^!]+)!!/g
  let last = 0, match
  const addText = (str, key) =>
    str.split('\n').flatMap((line, i, a) =>
      i < a.length - 1 ? [line, <br key={`${key}-${i}`} />] : [line]
    )
  while ((match = regex.exec(text)) !== null) {
    if (match.index > last) result.push(...addText(text.slice(last, match.index), `t${last}`))
    if (match[1] !== undefined)
      result.push(<strong key={match.index}>{match[1]}</strong>)
    else
      result.push(<strong key={match.index} className="mail-text-highlight">{match[2]}</strong>)
    last = match.index + match[0].length
  }
  if (last < text.length) result.push(...addText(text.slice(last), `t${last}`))
  return result
}

export default function MailOverlay({ messages, onRead, onClose, repliedIds, onReply }) {
  const [selected,     setSelected]     = useState(null)
  const [typingId,     setTypingId]     = useState(null)
  const [typedChars,   setTypedChars]   = useState(0)
  const typingRef = useRef(null)

  const handleSelect = (msg) => {
    setSelected(msg)
    if (!msg.read) onRead(msg.id)
  }

  const handleReply = (id, responseText) => {
    onReply(id)
    setTypingId(id)
    setTypedChars(0)
  }

  // Typing effect — increments one character at a time
  useEffect(() => {
    if (typingId === null) return
    const response = messages.find(m => m.id === typingId)?.reply?.response ?? ''
    if (typedChars >= response.length) {
      setTypingId(null)
      return
    }
    typingRef.current = setTimeout(() => setTypedChars(c => c + 1), 40)
    return () => clearTimeout(typingRef.current)
  }, [typingId, typedChars, messages])

  return (
    <>
      <div className="mail-dim" onClick={onClose} />
      <div className="mail-panel">

        <div className="mail-panel-header">
          <span className="mail-panel-title">✉ IMPERIAL MESSAGING SERVICE</span>
          <button className="mail-close-btn" onClick={onClose}>✕</button>
        </div>

        <div className="mail-panel-body">

          {/* ── Message list ── */}
          <div className="mail-list">
            {messages.map(msg => (
              <div
                key={msg.id}
                className={`mail-item${selected?.id === msg.id ? ' mail-item--active' : ''}${!msg.read ? ' mail-item--unread' : ''}`}
                onClick={() => handleSelect(msg)}
              >
                <div className="mail-item-top">
                  <span className="mail-item-sender">{msg.sender}</span>
                  {!msg.read && <span className="mail-item-dot" />}
                </div>
                <div className="mail-item-subject">{msg.subject}</div>
                <div className="mail-item-time">{msg.timestamp}</div>
              </div>
            ))}
          </div>

          {/* ── Message content ── */}
          <div className="mail-content">
            {selected ? (
              <>
                <div className="mail-content-header">
                  <div className="mail-portrait">
                    {(() => {
                      const src = SENDER_PORTRAITS[selected.sender] ?? selected.portrait ?? null
                      return src
                        ? <img src={src} alt={selected.sender} className="mail-portrait-img" />
                        : <div className="mail-no-portrait">[ NO IMAGE ]</div>
                    })()}
                  </div>
                  <div className="mail-content-meta">
                    <div className="mail-content-sender">{selected.sender}</div>
                    <div className="mail-content-subject">{selected.subject}</div>
                    <div className="mail-content-time">{selected.timestamp}</div>
                    <div className={`mail-verified${selected.verified ? '' : ' mail-verified--fail'}`}>
                      {selected.verified
                        ? 'QUANTUM CRYPTOGRAPHY PASS — SENDER VERIFIED'
                        : 'QUANTUM CRYPTOGRAPHY FAIL — SENDER UNVERIFIED'}
                    </div>
                  </div>
                </div>
                <div className="mail-content-divider" />
                <div className="mail-content-body">
                  {selected.body.split('\n\n').map((para, i) => (
                    <p key={i} className="mail-body-para">
                      {renderMailInline(para)}
                    </p>
                  ))}
                </div>

                {selected.reply && (
                  <div className="mail-reply-wrap">
                    {repliedIds.has(selected.id) ? (
                      <>
                        <div className="mail-reply-sent">{selected.reply.buttonLabel}</div>
                        <div className="mail-reply-response">
                          {typingId === selected.id
                            ? selected.reply.response.slice(0, typedChars)
                            : selected.reply.response}
                          {typingId === selected.id && <span className="mail-reply-cursor">▌</span>}
                        </div>
                      </>
                    ) : (
                      <button className="mail-reply-btn" onClick={() => handleReply(selected.id, selected.reply.response)}>
                        {selected.reply.buttonLabel}
                      </button>
                    )}
                  </div>
                )}
              </>
            ) : (
              <div className="mail-no-selection">[ SELECT A MESSAGE ]</div>
            )}
          </div>

        </div>
      </div>
    </>
  )
}
