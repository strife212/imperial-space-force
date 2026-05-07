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
