// ── Campaign layer ───────────────────────────────────────────────────────────
// Turns the standalone skirmish into a 10-node campaign: a persistent player
// fleet, a requisition currency that carries between missions, and a fixed,
// escalating enemy for each node — culminating in a massive finale.
//
// The skirmish battle is untouched; campaign mode just feeds SpaceBattleScreen a
// locked pair of fleet compositions plus a result callback.
import { compStrength, randomBlueCapName, CAP_HP } from '../screens/battle/constants.js'
import { getFlag, setFlag } from './store.js'

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
  { title: 'First Contact',     enemyName: 'Aleph Sentinels',       enemy: { fighters: 7,  bombers: 0, cruisers: 0 }, reward: 560,
    brief: 'Hostiles of unknown origin have swarmed the Cassiopeia. Break the ambush.' },
  { title: 'The Muster',        enemyName: 'Rebel Vanguard',        enemy: { fighters: 9,  bombers: 1, cruisers: 0 }, reward: 720,
    brief: 'A rebel screen tests the mustering fleet. Hold the line and scatter them.' },
  { title: 'The Warfront',      enemyName: 'Heretic Battlegroup',   enemy: { fighters: 11, bombers: 1, cruisers: 1 }, reward: 880,
    brief: 'The front is open. Punch through the heretic battlegroup and take the lane.' },
  { title: 'The Hush',          enemyName: 'The Silent Fleet',      enemy: { fighters: 17, bombers: 2, cruisers: 1 }, reward: 1000,
    brief: 'They came without signal or hail. Answer the silence in kind.' },
  { title: 'The Great Litany',  enemyName: 'Apostate Armada',       enemy: { fighters: 22, bombers: 2, cruisers: 2 }, reward: 1220,
    brief: 'Guard the relays of the Great Litany. Do not let the apostates break the chant.' },
  { title: 'The Fall',          enemyName: 'The Unsung Host',       enemy: { fighters: 29, bombers: 3, cruisers: 2 }, reward: 1440,
    brief: 'The Unsung Host swarms out of the dark. Hold the line, whatever it costs.' },
  { title: 'The Final Hearing', enemyName: 'The Hush at the Gates', enemy: { fighters: 39, bombers: 3, cruisers: 3 }, reward: 1730,
    brief: 'The Discord has reached the Throneworld itself. Hold the skies over Novaraya while the Empress renders the Final Hearing.' },
  { title: 'The Annunciator',   enemyName: 'Heralds of the Hush',   enemy: { fighters: 51, bombers: 4, cruisers: 3 }, reward: 2020,
    brief: 'Her Annunciator is arming. Hold the Heralds of the Hush off the firing lane until the Lance can be cast.' },
  { title: 'The Lance',         enemyName: 'Throneward Blockade',    enemy: { fighters: 64, bombers: 5, cruisers: 4 }, reward: 2450,
    brief: 'Clear the blockade so the Lance can be cast. Everything rides on the lane.' },
  { title: 'Order Restored',    enemyName: "Discord's Last Stand",   enemy: { fighters: 69, bombers: 7, cruisers: 6 }, reward: 3600,
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

// ── Roguelike fleet upgrades ──────────────────────────────────────────────────
// Won as a choice after each campaign victory and stored as a { id: level } map.
// Helpers below translate the map into concrete effects the battle/shipyard read.
//
// Catalog: every upgrade's display name + category ('capital' = flagship, 'fleet').
// Used by the fleet-review summary; extend this alongside the upgrade pool.
export const UPGRADE_INFO = {
  capHp:             { name: 'Reinforced Hull',         category: 'capital' },
  capMissile:        { name: 'Spinal Missile Launcher', category: 'capital' },
  unsellableFighter: { name: 'Additional Fighter',      category: 'fleet' },
  macroMissile:      { name: 'Macro-Missile Barrage',   category: 'capital' },
}
export function getUpgrades() { return getFlag('upgrades') || {} }
export function addUpgrade(id) { const u = { ...getUpgrades() }; u[id] = (u[id] || 0) + 1; setFlag('upgrades', u) }
export function getUnsellableFighters() { return getUpgrades().unsellableFighter || 0 }     // permanent fighters, can't be sold
export function getCapMaxHp() { return CAP_HP + 5 * (getUpgrades().capHp || 0) }             // flagship hull, +5 per upgrade
export function hasCapMissile() { return (getUpgrades().capMissile || 0) > 0 }               // flagship homing-missile launcher
export function hasMacroMissile() { return (getUpgrades().macroMissile || 0) > 0 }           // 2nd admiral skill: macro-missile barrage

// The fleet actually deployed to battle: the buyable fleet plus any permanent
// (unsellable) fighters granted by upgrades.
export function getDeployFleet() {
  const f = getFleet()
  return { fighters: f.fighters + getUnsellableFighters(), bombers: f.bombers, cruisers: f.cruisers }
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
  setFlag('operator', '')          // clear the chosen operator so the
  setFlag('operatorPortrait', '')  // campaign-map portrait hides again
  setFlag('fleetName', '')
  setFlag('upgrades', {})           // wipe roguelike upgrades back to none
}

// Selectable operators, in carousel order. Mirrors the roster in CharacterSelect
// so the debug unlock can assign / cycle them (name, portrait, fleet, flagship).
const OPERATOR_ROSTER = [
  { name: 'PRINCESS V. ASTRAIA',  portrait: 'portrait.png',  fleet: 'Fleet Berenike',   flagship: "HMSS Saint Berenike's Lance" },
  { name: 'PRINCESS T. SEVERINE', portrait: 'portrait2.jpg', fleet: 'Fleet Concordia',   flagship: 'HMSS Saint Concordia Heard First' },
  { name: 'PRINCESS C. LUCIA',    portrait: 'portrait3.jpg', fleet: 'Fleet Polyhymnia',  flagship: 'HMSS The Empress Remembers Saint Polyhymnia' },
]

// Debug shortcut: mark every node cleared and grant the full Requisition you'd
// have earned from completing the whole campaign. Also assigns an operator: the
// first one if none is chosen yet, otherwise CYCLES to the next on each press —
// so different operators (and their elite skills) are easy to test.
export function unlockAllCampaign() {
  const total = NODE_BATTLES.reduce((sum, n) => sum + n.reward, 0)
  setFlag('campaignProgress', NODE_COUNT)
  setFlag('credits', total)
  const base = import.meta.env?.BASE_URL ?? '/'
  const idx = OPERATOR_ROSTER.findIndex(o => o.name === getFlag('operator'))
  const next = OPERATOR_ROSTER[idx < 0 ? 0 : (idx + 1) % OPERATOR_ROSTER.length]
  setFlag('operator', next.name)
  setFlag('operatorPortrait', `${base}${next.portrait}`)
  setFlag('fleetName', next.fleet)
  setFlag('campaignFlagship', next.flagship)
  setFlag('everSelectedOperator', true)   // persists through resets → node 1 stays skippable
}
