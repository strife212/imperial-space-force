import { useState } from 'react'
import Cutscene from './cutscene/Cutscene'
import MontageScreen from './MontageScreen'
import { cosmogonyOpening, cosmogonyFinale } from './cutscene/scenes/cosmogony'
import './battle/battle.css'

// Cosmogony III, deep-linked at /cosmogony3: the whole of it in one reel.
// The 3D cosmogony's opening (the seed in the dark, the bang, the young
// universe) hands off into the 2D image montage (Cosmogony II without its
// silent XDF coda), which rings its finale chord down into the 3D finale —
// the Litania Magna in its diadem and the Home Fleet's long watch.
//
// One START gate up front supplies the audio gesture for all three movements.
export default function Cosmogony3() {
  const [started, setStarted] = useState(false)
  const [phase, setPhase] = useState('open')   // 'open' → 'montage' → 'finale' → 'end'
  const replay = () => setPhase('open')

  if (!started) {
    return (
      <div id="cutscene-screen">
        <div className="cut-start cut-start--story">
          <div className="story-gate-title">Cosmogony III</div>
          <div className="story-gate-sub">from the seed to the long watch · in three movements</div>
          <button className="cut-start-btn" onClick={() => setStarted(true)}>▶ START</button>
        </div>
      </div>
    )
  }
  if (phase === 'end') {
    return (
      <div id="cutscene-screen">
        <div className="cut-replay cut-replay--story">
          <div className="story-gate-sub">Caelum canit · illa audit</div>
          <button className="cut-replay-btn" onClick={replay}>⟳ REPLAY</button>
        </div>
      </div>
    )
  }
  if (phase === 'montage') {
    return <MontageScreen embedded onComplete={() => setPhase('finale')} />
  }
  return (
    <Cutscene
      key={phase}
      scene={phase === 'open' ? cosmogonyOpening : cosmogonyFinale}
      hideChrome
      canSkip={false}
      showOverlays={false}
      onComplete={() => setPhase(phase === 'open' ? 'montage' : 'end')}
      onReturn={() => {}}
    />
  )
}
