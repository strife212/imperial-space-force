import { useState, useRef, useEffect } from 'react'
import HudHeader from '../../components/HudHeader'
import { COMMS_PORTRAIT } from '../battle/constants'
import { renderCommsBody } from '../battle/RosterUI'
import UrgentMessageOverlay from '../battle/UrgentMessageOverlay'
import { createStage } from './stage'
import { getFlag } from '../../lib/store'
import '../battle/battle.css'

// "PRINCESS V. ASTRAIA" → "Princess V. Astraia"
const titleCase = (s) => s.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase())

const COMMS_DWELL_MS = 4200   // how long a line lingers after it's fully typed
const FADE_MS = 1300          // matches the .cut-fade transition before we resolve
const FEED_TICK_MS = 200      // shell clock driving the telemetry feed + readout
const FEED_MAX_LINES = 6

// "[T+0:04]" — mission-elapsed stamp for the telemetry feed
const fmtT = (t) => `T+${Math.floor(t / 60)}:${String(Math.floor(Math.max(0, t) % 60)).padStart(2, '0')}`

// Per-character comms portraits, keyed by speaker name. These are cropped from
// the encyclopedia art and override the generic team portrait when that speaker
// has the comms. (BASE_URL mirrors constants.js so it works under a sub-path.)
const BASE_URL = import.meta.env?.BASE_URL ?? '/'
const CHAR_PORTRAIT = {
  'The Empress':   `${BASE_URL}empress_portrait.jpg`,
  'Litania Magna': `${BASE_URL}worldengine_portrait.jpg`,
  'Imperial Science Vessel Cassiopeia': `${BASE_URL}scienceofficer.jpg`,
}

// Generic cutscene shell. Owns the screen chrome — comms typewriter box, replay,
// fade-to-black, and the ending (auto-advance, or an urgent-transmission overlay)
// — and runs the supplied `scene` definition on a three.js stage. Scenes drive
// dialogue and the ending through the ctx passed to their `create()`:
//   ctx.comms.show(name, text, { persist, team, portrait, segments })
//   ctx.end({ holdMs, overlay })   // overlay → urgent transmission, else advance
export default function Cutscene({ scene, onReturn, onComplete, canSkip = true, standalone = false }) {
  const mountRef = useRef(null)
  const [comms, setComms] = useState(null)
  const [commsText, setCommsText] = useState('')
  const commsSeq = useRef(0)
  const [ending, setEnding] = useState(null)   // { holdMs, overlay } once the scene ends
  const [fadeBlack, setFadeBlack] = useState(false)
  const [urgent, setUrgent] = useState(null)   // overlay config while shown
  const [showReplay, setShowReplay] = useState(false)   // standalone: black end-card + replay
  const [replayNonce, setReplayNonce] = useState(0)     // bump to re-run the scene
  // Deep-linked (standalone) playback has no prior user gesture, so the browser
  // blocks the scene's audio. Gate it behind a START button that supplies the
  // gesture; the in-game cutscene is always reached by a click, so it starts hot.
  const [started, setStarted] = useState(!standalone)
  const endedRef = useRef(false)
  const [now, setNow] = useState(0)            // shell clock (≈ scene T) for telemetry
  // telemetry feed + PNL readout are opt-in (campaign debug: "advanced cutscenes")
  const advanced = !!getFlag('advancedCutscenes')

  // standalone (deep-linked) playback ends on a black replay card instead of
  // navigating anywhere; the campaign version advances as before
  const advance = () => {
    if (standalone) { setShowReplay(true); return }
    ;(onComplete ?? onReturn)?.()
  }
  const replay = () => {
    endedRef.current = false
    setShowReplay(false); setEnding(null); setFadeBlack(false)
    setUrgent(null); setComms(null); setCommsText('')
    setReplayNonce((n) => n + 1)
  }

  // telemetry clock — drives scene.feed reveal and scene.readout live values
  useEffect(() => {
    setNow(0)
    if (!started || !advanced || (!scene.feed && !scene.readout)) return
    const t0 = performance.now()
    const iv = setInterval(() => setNow((performance.now() - t0) / 1000), FEED_TICK_MS)
    return () => clearInterval(iv)
  }, [scene, replayNonce, started])

  // typewriter: type the line out, let it sit, then (unless it persists) hide
  useEffect(() => {
    if (!comms) { setCommsText(''); return }
    setCommsText('')
    let i = 0, hide
    const full = comms.text
    const typer = setInterval(() => {
      i++; setCommsText(full.slice(0, i))
      if (i >= full.length) { clearInterval(typer); if (!comms.persist) hide = setTimeout(() => setComms(null), COMMS_DWELL_MS) }
    }, 42)
    return () => { clearInterval(typer); clearTimeout(hide) }
  }, [comms?.id])

  // ending → hold the final beat, then fade to black
  useEffect(() => {
    if (!ending) return
    const t = setTimeout(() => setFadeBlack(true), ending.holdMs)
    return () => clearTimeout(t)
  }, [ending])
  // faded → show the urgent transmission, or auto-advance
  useEffect(() => {
    if (!fadeBlack) return
    const t = setTimeout(() => { if (ending?.overlay) setUrgent(ending.overlay); else advance() }, FADE_MS)
    return () => clearTimeout(t)
  }, [fadeBlack])

  // three.js stage (re-created on replay). Held until the user hits START on a
  // deep-linked run, and torn down once the replay card appears — tearing down
  // runs the scene's dispose, which cuts the looping audio dead on the end-card.
  useEffect(() => {
    if (!started || showReplay) return
    const mount = mountRef.current
    if (!mount) return
    const commsApi = {
      show: (name, text, opts = {}) => {
        const team = opts.team || 'blue'
        // 'Princess Astraia' stands in for the player's chosen operator, so all
        // her cutscene lines use the selected princess's name and portrait.
        let displayName = name, portrait = opts.portrait
        if (name === 'Princess Astraia') {
          const op = getFlag('operator')
          if (op) { displayName = titleCase(op); portrait = portrait || getFlag('operatorPortrait') }
        }
        setComms({ id: ++commsSeq.current, team, name: displayName, portrait: portrait || CHAR_PORTRAIT[displayName] || COMMS_PORTRAIT[team], text, segments: opts.segments || [{ text }], persist: !!opts.persist })
      },
      hide: () => setComms(null),
    }
    const end = (opts = {}) => {
      if (endedRef.current) return
      endedRef.current = true
      setEnding({ holdMs: opts.holdMs ?? 0, overlay: opts.overlay ?? null })
    }
    let teardown
    try { teardown = createStage(mount, scene, { comms: commsApi, end }) }
    catch (err) { console.error('Cutscene failed to initialise:', err) }
    return () => { try { teardown && teardown() } catch (_) { /* noop */ } }
  }, [scene, replayNonce, started, showReplay])

  return (
    <div id="cutscene-screen">
      {!scene.hideChrome && <HudHeader onLogout={onReturn} right={<span className="label">{scene.label}</span>} />}
      <div className="sb-stage">
        <div className="sb-canvas" ref={mountRef} />

        {standalone && !started && (
          <div className="cut-start">
            <button className="cut-start-btn" onClick={() => setStarted(true)}>▶ START</button>
          </div>
        )}

        {scene.establishing && !urgent && (
          <div className="cut-establish">
            <div className="cut-establish-name">{scene.establishing.name}</div>
            {scene.establishing.sub && <div className="cut-establish-sub">{scene.establishing.sub}</div>}
            {scene.establishing.stamp && <div className="cut-establish-stamp">{scene.establishing.stamp}</div>}
          </div>
        )}

        {advanced && scene.feed && !urgent && (
          <div className="cut-feed">
            {scene.feed.filter((l) => l.t <= now).slice(-FEED_MAX_LINES).map((l) => (
              <div key={l.t} className={`cut-feed-line${l.level && l.level !== 'info' ? ` cut-feed-line--${l.level}` : ''}`}>
                <span className="cut-feed-t">[{fmtT(l.t)}]</span>{l.text}
              </div>
            ))}
          </div>
        )}

        {advanced && scene.readout && !urgent && (
          <div className="cut-readout">
            <div className="cut-readout-title">{scene.readout.id}</div>
            {scene.readout.rows.map((r) => (
              <div key={r.label} className="cut-readout-row">
                <span className="cut-readout-label">{r.label}</span>
                <span className="cut-readout-value">{typeof r.value === 'function' ? r.value(now) : r.value}</span>
              </div>
            ))}
          </div>
        )}

        {comms && (
          <div className={`sb-comms sb-comms--${comms.team}`} key={comms.id}>
            <img className="sb-comms-portrait" src={comms.portrait} alt="" />
            <div className="sb-comms-body">
              <div className="sb-comms-name">{comms.name}</div>
              <div className="sb-comms-text">{renderCommsBody(comms.segments, commsText.length)}<span className="sb-comms-cursor">▋</span></div>
            </div>
          </div>
        )}

        {!urgent && canSkip && (
          <div className="cut-controls">
            <button className="cut-btn" onClick={advance}>SKIP ▸</button>
          </div>
        )}
      </div>

      <div className={`cut-fade${fadeBlack ? ' cut-fade--on' : ''}`} />

      {standalone && showReplay && (
        <div className="cut-replay">
          <button className="cut-replay-btn" onClick={replay}>⟳ REPLAY</button>
        </div>
      )}

      {urgent && (
        <UrgentMessageOverlay sender={urgent.sender} body={urgent.body} dismissLabel={urgent.dismissLabel} onClose={advance} />
      )}
    </div>
  )
}
