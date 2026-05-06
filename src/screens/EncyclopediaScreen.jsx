import { useState } from 'react'
import { ENCYCLOPEDIA } from '../data/encyclopediaData'

export default function EncyclopediaScreen({ onReturn }) {
  const [topicId, setTopicId] = useState(ENCYCLOPEDIA[0].id)
  const [entryId, setEntryId] = useState(null)

  const topic   = ENCYCLOPEDIA.find(t => t.id === topicId)
  const entries = topic?.entries ?? []
  const entry   = entries.find(e => e.id === entryId) ?? null

  const handleTopicClick = (id) => {
    setTopicId(id)
    setEntryId(null)
  }

  return (
    <div id="encyclopedia-screen">

      {/* ── Title bar ──────────────────────────────────────────────── */}
      <div className="enc-titlebar">
        IMPERIAL KNOWLEDGE DATABANK
      </div>

      {/* ── Body (three columns) ───────────────────────────────────── */}
      <div className="enc-body">

        {/* Topics column */}
        <div className="enc-topics">
          <div className="enc-section-label">SUBJECTS</div>
          <nav className="enc-topic-list">
            {ENCYCLOPEDIA.map(t => (
              <button
                key={t.id}
                className={`enc-topic-btn${topicId === t.id ? ' enc-topic-btn--active' : ''}`}
                onClick={() => handleTopicClick(t.id)}
              >
                {t.label}
              </button>
            ))}
          </nav>
          <div className="enc-topics-spacer" />
          <button className="enc-return-btn" onClick={onReturn}>
            ← Return to Menu
          </button>
        </div>

        {/* Entry list column */}
        <div className="enc-entries">
          <div className="enc-section-label">{topic?.label ?? ''}</div>
          <ul className="enc-entry-list">
            {entries.map(e => {
              const hasContent = e.content !== null
              const isActive   = e.id === entryId
              return (
                <li key={e.id}>
                  <button
                    className={`enc-entry-btn${isActive ? ' enc-entry-btn--active' : ''}${!hasContent ? ' enc-entry-btn--stub' : ''}`}
                    onClick={hasContent ? () => setEntryId(e.id) : undefined}
                    disabled={!hasContent}
                    title={!hasContent ? 'No data available' : undefined}
                  >
                    {e.title}
                  </button>
                </li>
              )
            })}
          </ul>
        </div>

        {/* Content panel */}
        <div className="enc-content">
          {entry?.content ? (
            <div className="enc-article">
              <h2 className="enc-article-heading">{entry.content.heading}</h2>
              <div className="enc-article-divider" />
              {entry.content.body.map((para, i) => (
                <p key={i} className="enc-article-para">{para}</p>
              ))}
            </div>
          ) : (
            <div className="enc-content-empty">
              {entryId ? '// NO DATA //' : '// SELECT AN ENTRY //'}
            </div>
          )}
        </div>

      </div>
    </div>
  )
}
