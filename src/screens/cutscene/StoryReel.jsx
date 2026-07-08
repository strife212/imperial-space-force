import { useState } from 'react'
import Cutscene from './Cutscene'
import { SCENES } from './scenes'
import '../battle/battle.css'

// The abridged saga, deep-linked at /story: the seven beats that carry the
// arc — First Contact, the Hush, the Great Litany, the Final Hearing, the
// Annunciator, the Lance, the Order Restored — played back to back. (The
// muster, the warfront and the fall are the campaign's own battles to fight.)
//
// A single START gate up front supplies the user gesture that unlocks audio
// for the whole reel; each scene then advances straight into the next (SKIP
// jumps a scene, not the reel), and the end card offers a replay.
const REEL = ['firstContact', 'theHush', 'theLitany', 'theResolve', 'theAnnunciator', 'theLance', 'theOrderRestored']

export default function StoryReel() {
  const [started, setStarted] = useState(false)
  const [idx, setIdx] = useState(0)
  const [done, setDone] = useState(false)
  const next = () => { if (idx < REEL.length - 1) setIdx(idx + 1); else setDone(true) }
  const replay = () => { setIdx(0); setDone(false) }

  if (!started) {
    return (
      <div id="cutscene-screen">
        <div className="cut-start cut-start--story">
          <div className="story-gate-title">Caelum Canit</div>
          <div className="story-gate-sub">A Chronicle of the Hush · Seven Transmissions</div>
          <button className="cut-start-btn" onClick={() => setStarted(true)}>▶ START</button>
        </div>
      </div>
    )
  }
  if (done) {
    return (
      <div id="cutscene-screen">
        <div className="cut-replay cut-replay--story">
          <div className="story-gate-sub">Finis · Caelum Canit · Illa Audit</div>
          <button className="cut-replay-btn" onClick={replay}>⟳ REPLAY</button>
        </div>
      </div>
    )
  }
  return <Cutscene key={REEL[idx]} scene={SCENES[REEL[idx]]} hideChrome showOverlays={false} onComplete={next} onReturn={next} />
}
