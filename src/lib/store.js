// ── Persistent game flags (localStorage) ─────────────────────────────────────
const KEY = 'orbital_flags'

const DEFAULTS = {
  // persistent flags — saved in localStorage
  empressPanelVisited:  false, // set in HudFooter.jsx — on empress panel open
  throneworldTargeted:  false, // set in TargetingScreen.jsx — on mount (orbital map seen)
  worldengineTargeted:  false, // set in TargetingScreen.jsx — on mount (orbital map seen)
  seenSelene:           false, // set in App.jsx — on first mail overlay open
  mainPanelSeen:        false, // set in MainPanel.jsx — on mount
  lancecast:            false, // set in MainPanel.jsx — when PACKAGE AWAY fires
  cosmogonySeen:        false, // set in App.jsx — plays the Cosmogony intro once on first campaign open
  campaignProgress:     0,     // number of campaign nodes cleared (battle won) — gates the map
  credits:              0,     // persistent requisition currency, spent in the shipyard
  campaignFleet:        null,  // persistent player fleet { fighters, bombers, cruisers }; null → starting fleet
  campaignFlagship:     '',    // persistent player flagship name; '' → rolled on first muster
  challengeBest:        0,     // endless-challenge personal best — most rounds cleared in one run
  tutSkillSeen:         false, // set in SpaceBattleScreen.jsx — admiral-skill tutorial shown, or a skill used (campaign)
  tutBomberSeen:        false, // set in SpaceBattleScreen.jsx — bomber tutorial shown, or bombers dispatched (campaign)
}

export function getFlags() {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? { ...DEFAULTS, ...JSON.parse(raw) } : { ...DEFAULTS }
  } catch {
    return { ...DEFAULTS }
  }
}

export function setFlag(name, value) {
  try {
    const flags = getFlags()
    flags[name] = value
    localStorage.setItem(KEY, JSON.stringify(flags))
  } catch {
    // storage unavailable — fail silently
  }
}

export function getFlag(name) {
  return getFlags()[name] ?? DEFAULTS[name] ?? null
}
