import { useMemo } from 'react'
import { STORY } from './cutscene/scenes'

// ── Cutscene dialogue reader ─────────────────────────────────────────────────
// A read-only script of every line spoken across the cutscenes, scanned straight
// from the scene source at build time so it can never drift from what actually
// plays. Each scene drives its comms box with `comms.show(speaker, LINE, opts)`,
// where LINE is a string const declared up top; we resolve that const table and
// walk the show() calls in source order (which the scenes author in story order).
//
// Vite inlines every scene file as a raw string here — no runtime file access,
// no executing the scenes (which would need a full 3D stage). The projection
// narration in Logos is drawn on its own canvas overlay, not through comms, so
// it isn't part of this radio script.
const RAW = import.meta.glob('./cutscene/scenes/*.js', { query: '?raw', import: 'default', eager: true })

// every `const NAME = '…'` / `const NAME = "…"` string literal in a file, so a
// show() call referencing LINE_X can be resolved back to its text
function constTable(src) {
  const t = {}
  const re = /const\s+([A-Z][A-Z0-9_]*)\s*=\s*(['"])((?:\\.|(?!\2)[\s\S])*?)\2/g
  let m
  while ((m = re.exec(src))) t[m[1]] = m[3].replace(/\\(['"\\])/g, '$1')
  return t
}
// resolve a show() argument: a quoted literal, or an identifier looked up in the table
function resolveArg(tok, table) {
  if (!tok) return null
  const c = tok[0]
  if (c === "'" || c === '"') return tok.slice(1, -1)
  return table[tok] ?? null
}

function parseScene(src) {
  const table = constTable(src)
  const est = src.match(/establishing:\s*\{\s*name:\s*'([^']+)'(?:\s*,\s*sub:\s*'([^']*)')?/)
  const label = src.match(/\blabel:\s*'([^']+)'/)
  const lines = []
  const re = /comms\.show\(\s*('[^']*'|"[^"]*"|[A-Za-z_$][\w$]*)\s*,\s*('[^']*'|"[^"]*"|[A-Za-z_$][\w$]*)\s*(?:,\s*(\{[^}]*\}))?/g
  let m
  while ((m = re.exec(src))) {
    const speaker = resolveArg(m[1], table)
    const text = resolveArg(m[2], table)
    if (!speaker || !text) continue
    const opts = m[3] || ''
    lines.push({ speaker, text, team: /team:\s*'red'/.test(opts) ? 'red' : 'blue' })
  }
  const title = est?.[1] || label?.[1]?.replace(/^CUTSCENE\s*\/\s*/i, '') || null
  return { title, sub: est?.[2] || null, lines }
}

// 'Princess Astraia' stands in for the player's chosen operator at runtime
const PLAYER_SPEAKER = 'Princess Astraia'

export default function DialogueScreen({ onBack }) {
  const scenes = useMemo(() => {
    const out = []
    for (const [path, src] of Object.entries(RAW)) {
      const id = path.split('/').pop().replace(/\.js$/, '')
      let parsed
      try { parsed = parseScene(src) } catch { continue }
      if (!parsed.lines.length) continue          // skip files with no spoken dialogue (index, score, …)
      const storyIdx = STORY.indexOf(id)
      out.push({ id, storyIdx, ...parsed })
    }
    // campaign order first (1…N), then extras (victory scene, cosmogony) by title
    out.sort((a, b) => {
      const ai = a.storyIdx < 0 ? Infinity : a.storyIdx
      const bi = b.storyIdx < 0 ? Infinity : b.storyIdx
      if (ai !== bi) return ai - bi
      return (a.title || a.id).localeCompare(b.title || b.id)
    })
    return out
  }, [])

  const lineCount = scenes.reduce((n, s) => n + s.lines.length, 0)

  return (
    <div className="dlgview">
      <div className="dlgview-bar">
        <button className="dlgview-back" onClick={onBack}>◂ BACK</button>
        <div className="dlgview-bar-title">CUTSCENE DIALOGUE</div>
        <div className="dlgview-bar-meta">{scenes.length} scenes · {lineCount} lines</div>
      </div>

      <div className="dlgview-scroll">
        <div className="dlgview-inner">
          <header className="dlgview-head">
            <h1>The Spoken Record</h1>
            <p>Every line across the cutscenes, in story order — scanned from the scenes themselves.</p>
          </header>

          {scenes.map((s) => (
            <section key={s.id} className="dlgview-scene">
              <div className="dlgview-scene-head">
                <span className="dlgview-scene-num">{s.storyIdx >= 0 ? String(s.storyIdx + 1).padStart(2, '0') : '✦'}</span>
                <span className="dlgview-scene-title">{s.title || s.id}</span>
                {s.sub && <span className="dlgview-scene-sub">{s.sub}</span>}
              </div>
              <div className="dlgview-lines">
                {s.lines.map((l, i) => (
                  <div key={i} className={`dlgview-line dlgview-line--${l.team}`}>
                    <div className="dlgview-speaker">{l.speaker === PLAYER_SPEAKER ? 'Princess Astraia / Operator' : l.speaker}</div>
                    <div className="dlgview-text">{l.text}</div>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>
    </div>
  )
}
