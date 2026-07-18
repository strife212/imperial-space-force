// ── Enemy fleet upgrades ──────────────────────────────────────────────────────
// From battle 4 on, the enemy fields its own card buffs — the same catalog the
// player draws from after each victory, rolled with the player's rarity rules
// (legendaries excluded). The roll happens the first time a node is played in a
// campaign and is saved, so that node fields the same buffs for the whole run;
// resetCampaign() wipes the saves and the next run rerolls.
import { getFlag, setFlag } from './store'
import { aggregateCombatMods, getUpgrades, NODE_BATTLES } from './campaign'
import { UPGRADE_CARDS } from '../screens/UpgradeScreen'

// How many card buffs each node fields (index = nodeIndex, battle 1 = index 0).
export const ENEMY_CARD_COUNTS = [0, 0, 0, 1, 1, 2, 3, 3, 4, 5]

// The player's rarity cascade minus the legendary tier — its 1% simply never
// fires for the enemy, so that slot stays basic like any failed roll.
const rollRarity = () => {
  if (Math.random() < 0.15) return 'uncommon'
  if (Math.random() < 0.10) return 'rare'
  if (Math.random() < 0.05) return 'epic'
  return 'basic'
}

// Class-specific cards (tagged BOMBERS / CRUISERS) are dead weight to a fleet
// that doesn't field the class, so the enemy only draws them when its node's
// composition has the ships. The player's own draw is not gated — they pick one
// of three and can always rebuild their fleet around a card.
const usableBy = (card, comp) =>
  !comp || (card.tag === 'BOMBERS' ? comp.bombers > 0 : card.tag === 'CRUISERS' ? comp.cruisers > 0 : true)

// Roll n buffs into an { id: level } map with the player's draw rules: each
// slot rolls a rarity then a random card of that tier; epics are one-per-fleet
// (no repeats), lesser tiers stack just like the player's owned cards do.
// `comp` (the rolling fleet's composition) gates the class-specific cards.
export function rollEnemyCards(n, comp = null) {
  const rolled = {}
  const pool = (rarity) => Object.entries(UPGRADE_CARDS)
    .filter(([id, c]) => c.rarity === rarity && !(rarity === 'epic' && rolled[id]) && usableBy(c, comp))
    .map(([id]) => id)
  for (let i = 0; i < n; i++) {
    let bucket = pool(rollRarity())
    if (!bucket.length) bucket = pool('basic')
    if (!bucket.length) break
    const id = bucket[(Math.random() * bucket.length) | 0]
    rolled[id] = (rolled[id] || 0) + 1
  }
  return rolled
}

// From battle 5 on, the enemy flagship also fields GUARANTEED Reinforced Hull
// cards on top of the random roll — one more level every SECOND node (battle
// 5 = +1, 7 = +2, 9 = +3; +5 hull each, finale caps at +15) — so
// late-campaign flagships take visibly more killing however the random
// cards land.
const guaranteedCapHp = (nodeIndex) => Math.max(0, Math.floor((nodeIndex - 2) / 2))

// The node's random buffs — rolled and locked into the save on first request.
function rolledEnemyUpgrades(nodeIndex) {
  const n = ENEMY_CARD_COUNTS[nodeIndex] || 0
  if (!n) return {}
  const saved = getFlag('enemyUpgrades') || {}
  if (saved[nodeIndex]) return saved[nodeIndex]
  const rolled = rollEnemyCards(n, NODE_BATTLES[nodeIndex]?.enemy)
  setFlag('enemyUpgrades', { ...saved, [nodeIndex]: rolled })
  return rolled
}

// ── Player-scaled difficulty ─────────────────────────────────────────────────
// The stronger the player's own deck, the more cards every enemy node fields.
// Evaluated live whenever a node's upgrades are read (i.e. on entering the
// battle screen), so it tracks the current inventory:
//   · +1 card once the player holds an epic, OR two-or-more rare (blue) cards
//   · +1 more (stacking) once the player owns BOTH legendary cards
// The rolled bonus is cached per node+count so the shipyard briefing and the
// battle field the identical fleet within a single deploy.
function inventoryBonusCards() {
  const owned = getUpgrades()
  let epics = 0, rares = 0
  for (const [id, lvl] of Object.entries(owned)) {
    const r = UPGRADE_CARDS[id]?.rarity
    if (r === 'epic') epics += lvl
    else if (r === 'rare') rares += lvl
  }
  let bonus = 0
  if (epics >= 1 || rares >= 2) bonus += 1
  const legendaryIds = Object.entries(UPGRADE_CARDS).filter(([, c]) => c.rarity === 'legendary').map(([id]) => id)
  if (legendaryIds.length && legendaryIds.every(id => (owned[id] || 0) > 0)) bonus += 1
  return bonus
}

// In-memory bonus roll, stable per node while the triggering count is unchanged
// (cleared on reload; re-rolls only when the player's deck crosses a threshold).
const bonusCache = {}
function bonusRoll(nodeIndex, count) {
  const c = bonusCache[nodeIndex]
  if (c && c.count === count) return c.cards
  const cards = rollEnemyCards(count, NODE_BATTLES[nodeIndex]?.enemy)
  bonusCache[nodeIndex] = { count, cards }
  return cards
}

// The node's full buff map: the saved random roll, the guaranteed hull cards,
// and the live player-scaled bonus cards, merged at read time — so the battle
// and the shipyard intel always agree, and existing saves inherit both without
// a reroll of the base cards.
export function getEnemyUpgrades(nodeIndex) {
  const rolled = rolledEnemyUpgrades(nodeIndex)
  const merged = { ...rolled }
  const hull = guaranteedCapHp(nodeIndex)
  if (hull) merged.capHp = (merged.capHp || 0) + hull
  const bonusN = inventoryBonusCards()
  if (bonusN > 0) {
    for (const [id, lvl] of Object.entries(bonusRoll(nodeIndex, bonusN))) merged[id] = (merged[id] || 0) + lvl
  }
  return merged
}

// Everything the battle (and the shipyard intel) needs for a node's enemy:
// aggregated stat mods plus the special cards' concrete effects.
export function getEnemyBattleExtras(nodeIndex) {
  const u = getEnemyUpgrades(nodeIndex)
  return {
    upgrades: u,
    count: Object.values(u).reduce((s, lvl) => s + lvl, 0),
    mods: aggregateCombatMods(u),
    capHpBonus: 5 * (u.capHp || 0),        // Reinforced Hull, +5 per level
    capMissile: (u.capMissile || 0) > 0,   // Spinal Missile Battery
    extraFighters: u.unsellableFighter || 0,  // Volunteer Wing joins the enemy comp
  }
}
