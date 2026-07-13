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
// `sky` picks the battle's nebula backdrop (see SKIES in battle/geometry.js);
// omit it to use the default first sky (Void Indigo).
//
// Enemy comps follow per-node archetypes — swarm, balanced, cruiser line,
// bomber wave — so consecutive nodes ask different tactical questions, while
// each fleet's requisition value stays ~90-96% of the player's max possible
// spend at that point. Previous values + restore notes live in balance.md.
export const NODE_BATTLES = [
  { title: 'First Light',     enemyName: 'Aleph Sentinels',       enemy: { fighters: 7,  bombers: 0,  cruisers: 0 }, reward: 620,  sky: 'void',
    brief: 'Hostiles of unknown origin have swarmed the Cassiopeia. Break the ambush.' },
  { title: 'Critical Mass',        enemyName: 'Rebel Vanguard',        enemy: { fighters: 10, bombers: 1,  cruisers: 0 }, reward: 790,  sky: 'aurum',
    brief: 'A rebel screen tests the mustering fleet. Hold the line and scatter them.' },
  { title: 'Antithesis',      enemyName: 'Heretic Battlegroup',   enemy: { fighters: 7,  bombers: 0,  cruisers: 3 }, reward: 970,  sky: 'ember',
    brief: 'The front is open. Punch through the heretic battlegroup and take the lane.' },
  { title: 'Decoherence',          enemyName: 'The Silent Fleet',      enemy: { fighters: 13, bombers: 5,  cruisers: 0 }, reward: 1100, sky: 'rose',
    brief: 'They came without signal or hail. Answer the silence in kind.' },
  { title: 'Logos',  enemyName: 'Apostate Armada',       enemy: { fighters: 23, bombers: 3,  cruisers: 2 }, reward: 1340, sky: 'verdant',
    brief: 'Guard the relays of the Great Litany. Do not let the apostates break the chant.' },
  { title: 'Catabasis',          enemyName: 'The Unsung Host',       enemy: { fighters: 56, bombers: 0,  cruisers: 0 }, reward: 1580, sky: 'ember',
    brief: 'The Unsung Host swarms out of the dark. Hold the line, whatever it costs.' },
  { title: 'Providence', enemyName: 'The Hush at the Gates', enemy: { fighters: 36, bombers: 0,  cruisers: 8 }, reward: 1900, sky: 'aurum',
    brief: 'The Discord has reached the Throneworld itself. Hold the skies over Novaraya while the Empress renders the Final Hearing.' },
  { title: 'Ultima Ratio',   enemyName: 'Heralds of the Hush',   enemy: { fighters: 49, bombers: 12, cruisers: 0 }, reward: 2220, sky: 'rose',
    brief: 'Her Annunciator is arming. Hold the Heralds of the Hush off the firing lane until the Lance can be cast.' },
  { title: 'Singularity',         enemyName: 'Throneward Blockade',    enemy: { fighters: 65, bombers: 6,  cruisers: 6 }, reward: 2700, sky: 'void',
    brief: 'Clear the blockade so the Lance can be cast. Everything rides on the lane.' },
  { title: 'Eschaton',    enemyName: "Discord's Last Stand",   enemy: { fighters: 81, bombers: 8,  cruisers: 7 }, reward: 3960, sky: 'aurum',
    brief: "The wheel is broken, and everything they have left is coming. Break it utterly and the Song returns." },
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
  // Staged combat-stat upgrades (cards defined in UpgradeScreen, not yet offered).
  // Their effects are aggregated by getCombatMods() and applied to blue ships.
  capArmor:          { name: 'Ablative Plating',        category: 'capital' },
  capFlares:         { name: 'Decoy Launchers',         category: 'capital' },
  capWeapons:        { name: 'Forward Batteries',       category: 'capital' },
  capRegen:          { name: 'Auto-Repair Bays',        category: 'capital' },
  bastionHull:       { name: 'Bastion Bulwark',         category: 'capital' },
  throneAegis:       { name: 'Throne-Forged Aegis',     category: 'capital' },
  fighterArmor:      { name: 'Hardened Hulls',          category: 'fleet' },
  fighterHp:         { name: 'Veteran Squadrons',       category: 'fleet' },
  fighterRof:        { name: 'Targeting Uplink',        category: 'fleet' },
  praetorianWing:    { name: 'Praetorian Wing',         category: 'fleet' },
}
export function getUpgrades() { return getFlag('upgrades') || {} }
export function addUpgrade(id) { const u = { ...getUpgrades() }; u[id] = (u[id] || 0) + 1; setFlag('upgrades', u) }
export function getUnsellableFighters() { return getUpgrades().unsellableFighter || 0 }     // permanent fighters, can't be sold
export function getCapMaxHp() { return CAP_HP + 5 * (getUpgrades().capHp || 0) }             // flagship hull, +5 per upgrade
export function hasCapMissile() { return (getUpgrades().capMissile || 0) > 0 }               // flagship homing-missile launcher
export function hasMacroMissile() { return (getUpgrades().macroMissile || 0) > 0 }           // 2nd admiral skill: macro-missile barrage

// Flagship/fleet combat modifiers granted by roguelike upgrades, aggregated for
// the battle to apply to a team's ships at spawn. Takes any { id: level } map —
// the player's owned upgrades or an enemy node's rolled buffs. Every term is
// additive and scales with the upgrade's level; an unowned upgrade contributes 0,
// so with no upgrades this returns an all-zero (no-op) modifier set. Designed so
// higher-rarity cards simply contribute larger numbers to the same knobs.
export function aggregateCombatMods(u) {
  const L = (id) => u[id] || 0
  return {
    flagship: {
      hp:      30 * L('bastionHull') + 50 * L('throneAegis'),                   // extra max hull
      armor:    8 * L('capArmor')    + 15 * L('bastionHull') + 25 * L('throneAegis'),  // +% bolt deflect
      flares:   5 * L('capFlares')   +  8 * L('bastionHull') + 15 * L('throneAegis'),  // extra missile decoys
      weapons:  1 * L('capWeapons')  +  2 * L('throneAegis'),                   // extra bolts per broadside
      regen:  0.5 * L('capRegen')    +  2 * L('throneAegis'),                   // hull repaired per second (auto-repair: 1 per 2s)
    },
    fighter: {
      hp:      1 * L('fighterHp')    + 3 * L('praetorianWing'),                 // extra interceptor hull
      armor:   6 * L('fighterArmor') + 10 * L('praetorianWing'),               // +% bolt deflect
      fireMul: Math.pow(0.82, L('fighterRof')),                                // each level fires 18% faster
    },
  }
}
export function getCombatMods() { return aggregateCombatMods(getUpgrades()) }

// Human-readable per-stat totals for any { id: level } upgrade map — the same
// list the Fleet Review shows, shared with the shipyard's hover intel for both
// the player's fleet and a buffed enemy node. Numbers come from the same
// aggregation the battle applies, so the readout can never drift from combat.
export function upgradeStatLines(u) {
  const mods = aggregateCombatMods(u)
  const t = []
  if (u.macroMissile) t.push({ text: 'MACRO MISSILE BARRAGE', gold: true })   // the legendary leads the list
  const capHull = 5 * (u.capHp || 0) + mods.flagship.hp
  if (capHull) t.push({ text: `+${capHull} FLAGSHIP HULL` })
  if (mods.flagship.armor) t.push({ text: `+${mods.flagship.armor}% FLAGSHIP ARMOUR` })
  if (mods.flagship.weapons) t.push({ text: `+${mods.flagship.weapons} BROADSIDE GUN${mods.flagship.weapons > 1 ? 'S' : ''}` })
  if (mods.flagship.regen) t.push({ text: `+${mods.flagship.regen} HP/SEC REPAIR` })
  if (mods.flagship.flares) t.push({ text: `+${mods.flagship.flares} FLARES` })
  if (u.capMissile) t.push({ text: 'HOMING MISSILE BATTERY' })
  if (mods.fighter.hp) t.push({ text: `+${mods.fighter.hp} HP PER FIGHTER` })
  if (mods.fighter.armor) t.push({ text: `+${mods.fighter.armor}% FIGHTER ARMOUR` })
  if (mods.fighter.fireMul < 1) t.push({ text: `+${Math.round((1 - mods.fighter.fireMul) * 100)}% FIGHTER FIRE RATE` })
  if (u.unsellableFighter) t.push({ text: `+${u.unsellableFighter} PERMANENT FIGHTER${u.unsellableFighter > 1 ? 'S' : ''}` })
  return t
}

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
  setFlag('cosmogonySeen', false)   // erasing the save replays the Cosmogony intro
  setFlag('campaignProgress', 0)
  setFlag('credits', 0)
  setFlag('campaignFleet', { ...STARTING_FLEET })
  setFlag('campaignFlagship', '')
  setFlag('operator', '')          // clear the chosen operator so the
  setFlag('operatorPortrait', '')  // campaign-map portrait hides again
  setFlag('fleetName', '')
  setFlag('upgrades', {})           // wipe roguelike upgrades back to none
  setFlag('enemyUpgrades', {})      // enemy nodes reroll their buffs next campaign
  setFlag('tutSkillSeen', false)    // first-battle tutorial nudges re-arm
  setFlag('tutBomberSeen', false)
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
