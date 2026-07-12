import { useState } from 'react'
import Cutscene from './Cutscene'
import { SCENES, STORY } from './scenes'
import '../battle/battle.css'

// The full saga, deep-linked at /story: every story cutscene in campaign order,
// capped by the Order Restored victory coda — played back to back. (The
// Cosmogony creation myth has its own deep links, /cosmogony and /cosmogony3.)
//
// Built straight off STORY so it never drifts as the campaign changes; the
// battles' cinematic cutscenes (muster, warfront, the fall) play too, standing
// in for the fights the campaign has the player fight.
//
// A single START gate up front supplies the user gesture that unlocks audio
// for the whole reel; each scene then advances straight into the next (SKIP
// jumps a scene, not the reel), and the end card offers a replay.
const REEL = [...STORY, 'theOrderRestored']   // the ten story beats, then the victory coda

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
          <div className="story-gate-title">The Complete Saga</div>
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
