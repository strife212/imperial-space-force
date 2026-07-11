import { useState } from 'react'
import Cutscene from './cutscene/Cutscene'
import { cosmogonyHybrid } from './cutscene/scenes/cosmogony'
import './battle/battle.css'

// Cosmogony III, deep-linked at /cosmogony3: the full 3D cosmogony, shot
// through with photographic memory. At every age transition the reel freezes
// inside the cut and flashes imagery from the Cosmogony II montage —
// landscapes as the world rushes up, temples of stone and art, the drawn
// figures of mathematics, the first machines, one glowing mind — each flash
// struck with its era's montage voice. The interludes live in the scene
// itself (cosmogonyHybrid in scenes/cosmogony.js); this shell only supplies
// the START gate (the audio gesture) and the end card.
export default function Cosmogony3() {
  const [started, setStarted] = useState(false)
  const [ended, setEnded] = useState(false)
  const [nonce, setNonce] = useState(0)   // bump to re-run the reel
  const replay = () => { setEnded(false); setNonce((n) => n + 1) }

  if (!started) {
    return (
      <div id="cutscene-screen">
        <div className="cut-start cut-start--story">
          <div className="story-gate-title">Cosmogony III</div>
          <div className="story-gate-sub">from the seed to the long watch · shot through with memory</div>
          <button className="cut-start-btn" onClick={() => setStarted(true)}>▶ START</button>
        </div>
      </div>
    )
  }
  if (ended) {
    return (
      <div id="cutscene-screen">
        <div className="cut-replay cut-replay--story">
          <div className="story-gate-sub">Caelum canit · illa audit</div>
          <button className="cut-replay-btn" onClick={replay}>⟳ REPLAY</button>
        </div>
      </div>
    )
  }
  return (
    <Cutscene
      key={nonce}
      scene={cosmogonyHybrid}
      hideChrome
      canSkip={false}
      showOverlays={false}
      onComplete={() => setEnded(true)}
      onReturn={() => {}}
    />
  )
}
