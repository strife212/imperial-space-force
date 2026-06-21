import { useState, useRef, useEffect } from 'react'
import HudHeader from '../../components/HudHeader'
import { COMMS_PORTRAIT } from '../battle/constants'
import { renderCommsBody } from '../battle/RosterUI'
import UrgentMessageOverlay from '../battle/UrgentMessageOverlay'
import { createStage } from './stage'
import '../battle/battle.css'

const COMMS_DWELL_MS = 4200   // how long a line lingers after it's fully typed
const FADE_MS = 1300          // matches the .cut-fade transition before we resolve

// Per-character comms portraits, keyed by speaker name. These are cropped from
// the encyclopedia art and override the generic team portrait when that speaker
// has the comms. (BASE_URL mirrors constants.js so it works under a sub-path.)
const BASE_URL = import.meta.env?.BASE_URL ?? '/'
const CHAR_PORTRAIT = {
  'The Empress':   `${BASE_URL}empress_portrait.jpg`,
  'Litania Magna': `${BASE_URL}worldengine_portrait.jpg`,
}

// Generic cutscene shell. Owns the screen chrome — comms typewriter box, replay,
// fade-to-black, and the ending (auto-advance, or an urgent-transmission overlay)
// — and runs the supplied `scene` definition on a three.js stage. Scenes drive
// dialogue and the ending through the ctx passed to their `create()`:
//   ctx.comms.show(name, text, { persist, team, portrait, segments })
//   ctx.end({ holdMs, overlay })   // overlay → urgent transmission, else advance
export default function Cutscene({ scene, onReturn, onComplete }) {
  const mountRef = useRef(null)
  const [comms, setComms] = useState(null)
  const [commsText, setCommsText] = useState('')
  const commsSeq = useRef(0)
  const [ending, setEnding] = useState(null)   // { holdMs, overlay } once the scene ends
  const [fadeBlack, setFadeBlack] = useState(false)
  const [urgent, setUrgent] = useState(null)   // overlay config while shown
  const endedRef = useRef(false)

  const advance = () => (onComplete ?? onReturn)?.()

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

  // three.js stage (re-created on replay)
  useEffect(() => {
    const mount = mountRef.current
    if (!mount) return
    const commsApi = {
      show: (name, text, opts = {}) => {
        const team = opts.team || 'blue'
        setComms({ id: ++commsSeq.current, team, name, portrait: opts.portrait || CHAR_PORTRAIT[name] || COMMS_PORTRAIT[team], text, segments: opts.segments || [{ text }], persist: !!opts.persist })
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
  }, [scene])

  return (
    <div id="cutscene-screen">
      <HudHeader onLogout={onReturn} right={<span className="label">{scene.label}</span>} />
      <div className="sb-stage">
        <div className="sb-canvas" ref={mountRef} />

        {scene.establishing && !urgent && (
          <div className="cut-establish">
            <div className="cut-establish-name">{scene.establishing.name}</div>
            {scene.establishing.sub && <div className="cut-establish-sub">{scene.establishing.sub}</div>}
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

        {!urgent && (
          <div className="cut-controls">
            <button className="cut-btn" onClick={advance}>SKIP ▸</button>
          </div>
        )}
      </div>

      <div className={`cut-fade${fadeBlack ? ' cut-fade--on' : ''}`} />

      {urgent && (
        <UrgentMessageOverlay sender={urgent.sender} body={urgent.body} dismissLabel={urgent.dismissLabel} onClose={advance} />
      )}
    </div>
  )
}
