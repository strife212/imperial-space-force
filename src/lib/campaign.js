// ── Campaign layer ───────────────────────────────────────────────────────────
// Turns the standalone skirmish into a 10-node campaign: a persistent player
// fleet, a requisition currency that carries between missions, and a fixed,
// escalating enemy for each node — culminating in a massive finale.
//
// The skirmish battle is untouched; campaign mode just feeds SpaceBattleScreen a
// locked pair of fleet compositions plus a result callback.
import { compStrength, randomBlueCapName } from '../screens/battle/constants'
import { getFlag, setFlag } from './store'

// Cost (in Requisition) to add one ship of each class to your standing fleet.
export const SHIP_COST = { fighters: 100, bombers: 350, cruisers: 450 }

// The fleet you begin the campaign with — deliberately small. It grows as you
// win battles and spend the rewards in the shipyard.
export const STARTING_FLEET = { fighters: 8, bombers: 0, cruisers: 0 }

// ── Per-node battles ─────────────────────────────────────────────────────────
// One entry per campaign node, in story order. `enemy` is the fixed Red fleet
// (a flagship is always added on top by the battle). `reward` is the Requisition
// granted the first time the node is cleared. Fleets escalate to a finale.
export const NODE_BATTLES = [
  { title: 'First Contact',     enemyName: 'Aleph Sentinels',       enemy: { fighters: 4,  bombers: 0, cruisers: 0 }, reward: 700,
    brief: 'Hostiles of unknown origin have swarmed the Cassiopeia. Break the ambush.' },
  { title: 'The Muster',        enemyName: 'Rebel Vanguard',        enemy: { fighters: 8,  bombers: 1, cruisers: 0 }, reward: 900,
    brief: 'A rebel screen tests the mustering fleet. Hold the line and scatter them.' },
  { title: 'The Warfront',      enemyName: 'Heretic Battlegroup',   enemy: { fighters: 12, bombers: 1, cruisers: 1 }, reward: 1100,
    brief: 'The front is open. Punch through the heretic battlegroup and take the lane.' },
  { title: 'The Hush',          enemyName: 'The Silent Fleet',      enemy: { fighters: 14, bombers: 2, cruisers: 1 }, reward: 1400,
    brief: 'They came without signal or hail. Answer the silence in kind.' },
  { title: 'The Great Litany',  enemyName: 'Apostate Armada',       enemy: { fighters: 18, bombers: 2, cruisers: 2 }, reward: 1700,
    brief: 'Guard the relays of the Great Litany. Do not let the apostates break the chant.' },
  { title: 'The Fall',          enemyName: 'The Unsung Host',       enemy: { fighters: 22, bombers: 3, cruisers: 2 }, reward: 2000,
    brief: 'The Unsung Host swarms out of the dark. Hold the line, whatever it costs.' },
  { title: 'The Final Hearing', enemyName: 'Inquisitorial Cordon',  enemy: { fighters: 26, bombers: 3, cruisers: 3 }, reward: 2400,
    brief: 'The cordon stands between you and the hearing. Force the judgement.' },
  { title: 'The Annunciator',   enemyName: 'Heralds of the Hush',   enemy: { fighters: 30, bombers: 4, cruisers: 3 }, reward: 2800,
    brief: 'Her Annunciator is arming. Hold the Heralds of the Hush off the firing lane until the Lance can be cast.' },
  { title: 'The Lance',         enemyName: 'Throneward Blockade',    enemy: { fighters: 36, bombers: 5, cruisers: 4 }, reward: 3400,
    brief: 'Clear the blockade so the Lance can be cast. Everything rides on the lane.' },
  { title: 'Order Restored',    enemyName: "Discord's Last Stand",   enemy: { fighters: 50, bombers: 7, cruisers: 6 }, reward: 5000,
    brief: "The Discord's last stand, laid bare at last. Break it utterly and the Song returns." },
]

export const NODE_COUNT = NODE_BATTLES.length
export const FINALE_INDEX = NODE_COUNT - 1

// ── Economy / persistence helpers ────────────────────────────────────────────
export function getCredits() { return getFlag('credits') || 0 }
export function addCredits(n) { setFlag('credits', Math.max(0, getCredits() + Math.round(n))) }
export function spendCredits(n) {
  if (getCredits() < n) return false
  setFlag('credits', getCredits() - n)
  return true
}

export function getFleet() {
  const f = getFlag('campaignFleet')
  return f ? { fighters: f.fighters | 0, bombers: f.bombers | 0, cruisers: f.cruisers | 0 } : { ...STARTING_FLEET }
}
export function setFleet(f) {
  setFlag('campaignFleet', { fighters: Math.max(0, f.fighters | 0), bombers: Math.max(0, f.bombers | 0), cruisers: Math.max(0, f.cruisers | 0) })
}

export function getFlagshipName() {
  let n = getFlag('campaignFlagship')
  if (!n) { n = randomBlueCapName(); setFlag('campaignFlagship', n) }
  return n
}

export function getProgress() { return getFlag('campaignProgress') || 0 }

// Total Requisition value of a fleet (re-uses the skirmish point valuation so the
// shipyard can show your strength against the enemy's on the same scale).
export function fleetStrength(comp) { return compStrength(comp) }
export const fleetBuyCost = (comp) =>
  comp.fighters * SHIP_COST.fighters + comp.bombers * SHIP_COST.bombers + comp.cruisers * SHIP_COST.cruisers

// What a battle outcome is worth, without committing it. Requisition is paid out
// only for the first clear of a node — replaying an already-cleared node (or
// losing) banks nothing, so the currency can't be farmed.
export function previewReward(nodeIndex, won) {
  const node = NODE_BATTLES[nodeIndex]
  if (!node || !won) return 0
  const firstClear = nodeIndex >= getProgress()
  return firstClear ? node.reward : 0
}

// Commit a battle result: bank the Requisition and, on a first win, unlock the
// next node. Returns a summary for the post-battle screen.
export function recordBattle(nodeIndex, won) {
  const firstClear = won && nodeIndex >= getProgress()
  const award = previewReward(nodeIndex, won)
  addCredits(award)
  if (firstClear) setFlag('campaignProgress', Math.min(NODE_COUNT, nodeIndex + 1))
  return { award, won, firstClear, progress: getProgress() }
}

export function resetCampaign() {
  setFlag('campaignProgress', 0)
  setFlag('credits', 0)
  setFlag('campaignFleet', { ...STARTING_FLEET })
  setFlag('campaignFlagship', '')
}
