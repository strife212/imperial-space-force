// ── Enemy fleet upgrades ──────────────────────────────────────────────────────
// From battle 5 on, the enemy fields its own card buffs — the same catalog the
// player draws from after each victory, rolled with the player's rarity rules
// (legendaries excluded). The roll happens the first time a node is played in a
// campaign and is saved, so that node fields the same buffs for the whole run;
// resetCampaign() wipes the saves and the next run rerolls.
import { getFlag, setFlag } from './store'
import { aggregateCombatMods } from './campaign'
import { UPGRADE_CARDS } from '../screens/UpgradeScreen'

// How many card buffs each node fields (index = nodeIndex, battle 1 = index 0).
export const ENEMY_CARD_COUNTS = [0, 0, 0, 0, 1, 2, 3, 3, 4, 5]

// The player's rarity cascade minus the legendary tier — its 1% simply never
// fires for the enemy, so that slot stays basic like any failed roll.
const rollRarity = () => {
  if (Math.random() < 0.15) return 'uncommon'
  if (Math.random() < 0.10) return 'rare'
  if (Math.random() < 0.05) return 'epic'
  return 'basic'
}

// Roll n buffs into an { id: level } map with the player's draw rules: each
// slot rolls a rarity then a random card of that tier; epics are one-per-fleet
// (no repeats), lesser tiers stack just like the player's owned cards do.
export function rollEnemyCards(n) {
  const rolled = {}
  const pool = (rarity) => Object.entries(UPGRADE_CARDS)
    .filter(([id, c]) => c.rarity === rarity && !(rarity === 'epic' && rolled[id]))
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
  const rolled = rollEnemyCards(n)
  setFlag('enemyUpgrades', { ...saved, [nodeIndex]: rolled })
  return rolled
}

// The node's full buff map: the saved random roll plus the guaranteed hull
// cards, merged at read time — so the battle and the shipyard intel always
// agree, and existing saves inherit the guarantee without a reroll.
export function getEnemyUpgrades(nodeIndex) {
  const rolled = rolledEnemyUpgrades(nodeIndex)
  const bonus = guaranteedCapHp(nodeIndex)
  return bonus ? { ...rolled, capHp: (rolled.capHp || 0) + bonus } : rolled
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
