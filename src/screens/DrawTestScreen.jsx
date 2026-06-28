import { useState } from 'react'
import { useScreenScale, SCREEN_DESIGN_HEIGHT } from '../hooks/useScreenScale'
import { pickUpgrades, UpgradeCard } from './UpgradeScreen'
import './upgrade.css'

// Debug "draw test": shows a random three-card post-battle draw and a re-roll
// button, so the rarity-roll odds can be eyeballed. Reached from the Z-toggled
// campaign debug controls. Purely a preview — clicking a card just re-rolls.
export default function DrawTestScreen({ onBack }) {
  const [draw, setDraw] = useState(() => pickUpgrades(3))
  const reroll = () => setDraw(pickUpgrades(3))
  const innerRef = useScreenScale(SCREEN_DESIGN_HEIGHT)

  return (
    <div id="upgrade-screen">
      <div className="up-inner" ref={innerRef}>
        <div className="up-head">
          <div className="up-eyebrow">⚡ DEBUG · DRAW TEST ⚡</div>
          <div className="up-title">RANDOM CARD DRAW</div>
          <div className="up-sub">RE-ROLL TO SAMPLE THE RARITY ODDS</div>
        </div>
        <div className="up-cards">
          {draw.map((card) => (
            <UpgradeCard key={card.id} card={card} onClick={reroll} cta="↻ DRAW AGAIN" />
          ))}
        </div>
        <div className="up-debug-controls">
          <button className="up-debug-btn" onClick={onBack}>◂ BACK TO MAP</button>
          <button className="up-debug-btn up-debug-btn--go" onClick={reroll}>↻ RE-ROLL</button>
        </div>
      </div>
    </div>
  )
}
