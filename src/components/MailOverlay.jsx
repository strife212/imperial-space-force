import { useState } from 'react'

export default function MailOverlay({ messages, onRead, onClose }) {
  const [selected, setSelected] = useState(null)

  const handleSelect = (msg) => {
    setSelected(msg)
    if (!msg.read) onRead(msg.id)
  }

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
                    {selected.portrait
                      ? <img src={selected.portrait} alt={selected.sender} className="mail-portrait-img" />
                      : <div className="mail-no-portrait">[ NO IMAGE ]</div>
                    }
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
                <div className="mail-content-body">{selected.body}</div>
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
