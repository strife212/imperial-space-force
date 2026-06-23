import { useState } from 'react'
import { addUpgrade, getUpgrades } from '../lib/campaign'
import { UPGRADE_CARDS, UpgradeCard } from './UpgradeScreen'
import './upgrade.css'
import './card-vault.css'

// Debug "card vault": a scrollable gallery of every defined upgrade card. Click a
// card to grant its upgrade (stacking on repeat clicks) — reached from the hidden
// Z-toggled debug control on the campaign map. Lets the whole catalog be tested
// without waiting for it to roll in the post-battle pick.
const RARITY_ORDER = { legendary: 0, epic: 1, rare: 2, uncommon: 3, basic: 4 }
const SORTED_IDS = Object.keys(UPGRADE_CARDS)
  .sort((a, b) => RARITY_ORDER[UPGRADE_CARDS[a].rarity] - RARITY_ORDER[UPGRADE_CARDS[b].rarity])

export default function CardVaultScreen({ onBack }) {
  const [owned, setOwned] = useState(() => getUpgrades())
  const grant = (id) => { addUpgrade(id); setOwned({ ...getUpgrades() }) }

  return (
    <div id="card-vault">
      <div className="cv-head">
        <button className="cv-back" onClick={onBack}>◂ BACK TO MAP</button>
        <div className="cv-titles">
          <div className="cv-eyebrow">⚡ DEBUG · CARD VAULT ⚡</div>
          <div className="cv-title">UPGRADE CATALOG</div>
          <div className="cv-sub">CLICK A CARD TO GRANT ITS UPGRADE</div>
        </div>
      </div>
      <div className="cv-scroll">
        <div className="cv-grid">
          {SORTED_IDS.map((id) => {
            const lvl = owned[id] || 0
            return (
              <UpgradeCard
                key={id}
                card={UPGRADE_CARDS[id]}
                onClick={() => grant(id)}
                cta={lvl > 0 ? 'GRANT AGAIN ▸' : 'GRANT ▸'}
                badge={lvl > 0 ? <span className="cv-owned">OWNED ×{lvl}</span> : null}
              />
            )
          })}
        </div>
      </div>
    </div>
  )
}
