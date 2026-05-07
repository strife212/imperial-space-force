import { useState } from 'react'
import { ENCYCLOPEDIA } from '../data/encyclopediaData'
import { getFlag } from '../lib/store'

// Renders a string supporting **bold**, *italic*, and \n line breaks
const splitBreaks = (str, kp) =>
  str.split('\n').flatMap((line, i, a) =>
    i < a.length - 1 ? [line, <br key={`${kp}-${i}`} />] : [line]
  )

const renderInline = (text) => {
  const result = []
  const regex = /\*\*([^*]+)\*\*|\*([^*]+)\*/g
  let last = 0, match
  while ((match = regex.exec(text)) !== null) {
    if (match.index > last) result.push(...splitBreaks(text.slice(last, match.index), `t${last}`))
    if (match[1] !== undefined)
      result.push(<strong key={match.index}>{splitBreaks(match[1], `b${match.index}`)}</strong>)
    else
      result.push(<em key={match.index}>{splitBreaks(match[2], `e${match.index}`)}</em>)
    last = match.index + match[0].length
  }
  if (last < text.length) result.push(...splitBreaks(text.slice(last), `t${last}`))
  return result
}

export default function EncyclopediaScreen({ onReturn }) {
  const [topicId,       setTopicId]       = useState(ENCYCLOPEDIA[0].id)
  const [entryId,       setEntryId]       = useState(null)
  const [imageExpanded, setImageExpanded] = useState(false)

  const topic   = ENCYCLOPEDIA.find(t => t.id === topicId)
  const entries = topic?.entries ?? []
  const entry   = entries.find(e => e.id === entryId) ?? null

  const isLocked = (e) => {
    if (!e.locked) return false
    if (e.locked.anyOf) return !e.locked.anyOf.some(f => getFlag(f))
    return !getFlag(e.locked.flag)
  }

  const handleTopicClick = (id) => {
    setTopicId(id)
    setEntryId(null)
    setImageExpanded(false)
  }

  const handleEntryClick = (id) => {
    setEntryId(id)
    setImageExpanded(false)
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
              const locked     = isLocked(e)
              const isActive   = e.id === entryId
              const isStub     = !hasContent && !locked
              return (
                <li key={e.id}>
                  <button
                    className={`enc-entry-btn${isActive ? ' enc-entry-btn--active' : ''}${isStub ? ' enc-entry-btn--stub' : ''}${locked ? ' enc-entry-btn--locked' : ''}`}
                    onClick={hasContent || locked ? () => handleEntryClick(e.id) : undefined}
                    disabled={isStub}
                    title={isStub ? 'No data available' : undefined}
                  >
                    {locked && <span className="enc-lock-icon">🔒</span>}
                    {e.title}
                  </button>
                </li>
              )
            })}
          </ul>
        </div>

        {/* Content panel */}
        <div className="enc-content">
          {entry && isLocked(entry) ? (
            <div className="enc-content-locked">
              [ FIND INFORMATION TO UNLOCK ]
            </div>
          ) : entry?.content ? (
            <div className="enc-article">
              <h2 className="enc-article-heading">{entry.content.heading}</h2>
              <div className="enc-article-divider" />
              {entry.content.image && (
                <div className="enc-article-image-block">
                  <img
                    className={`enc-article-image${imageExpanded ? ' enc-article-image--expanded' : ''}`}
                    src={`${import.meta.env.BASE_URL}${entry.content.image.src}`}
                    alt={entry.content.image.caption}
                    onClick={() => setImageExpanded(x => !x)}
                    title={imageExpanded ? 'Click to shrink' : 'Click to enlarge'}
                  />
                  <p className="enc-article-image-caption">{entry.content.image.caption}</p>
                </div>
              )}
              {entry.content.body.map((para, i) => (
                <p key={i} className="enc-article-para">{renderInline(para)}</p>
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
