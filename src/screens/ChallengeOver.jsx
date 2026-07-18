import './campaign-map.css'

// Endless-challenge gate: a plain fullscreen intro in the same dress as the
// epitaph below — what the mode is, then a single way in.
export function ChallengeIntro({ onStart, onBack }) {
  return (
    <div id="challenge-over">
      <div className="chov-box">
        <div className="chov-sub">✦ Post-Campaign ✦</div>
        <div className="chov-title chov-title--gold">ENDLESS CHALLENGE MODE</div>
        <div className="chov-text">
          Battle an enemy fleet of escalating strength. Every round the Hush
          returns with everything it had — and one more card. The run ends when
          your fleet falls; nothing is banked, nothing is lost.
        </div>
        <button className="chov-start" onClick={onStart}>▶ START</button>
        <button className="chov-btn chov-btn--ghost" onClick={onBack}>◂ RETURN TO THE CAMPAIGN MAP</button>
      </div>
    </div>
  )
}

// Endless-challenge epitaph: a fullscreen record of how far the run got before
// the fleet broke. Nothing is saved anywhere — this screen IS the result.
export default function ChallengeOver({ round, onReturn }) {
  const cleared = round - 1
  return (
    <div id="challenge-over">
      <div className="chov-box">
        <div className="chov-sub">✦ ENDLESS CHALLENGE ✦</div>
        <div className="chov-title">THE LINE BREAKS</div>
        <div className="chov-rounds">
          <span className="chov-rounds-num">{cleared}</span>
          <span className="chov-rounds-label">ROUND{cleared === 1 ? '' : 'S'} CLEARED</span>
        </div>
        <div className="chov-text">
          {cleared === 0
            ? 'The Hush closed over the fleet in the first engagement.'
            : `The fleet threw back ${cleared} escalating assault${cleared === 1 ? '' : 's'} before the Hush closed over it in round ${round}.`}
          {' '}The Song remembers those who answered.
        </div>
        <button className="chov-btn" onClick={onReturn}>◂ RETURN TO THE CAMPAIGN MAP</button>
      </div>
    </div>
  )
}
