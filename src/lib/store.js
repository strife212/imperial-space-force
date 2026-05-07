// ── Persistent game flags (localStorage) ─────────────────────────────────────
const KEY = 'orbital_flags'

const DEFAULTS = {
  // persistent flags — saved in localStorage
  empressPanelVisited:  false,
  throneworldTargeted:  false,
  worldengineTargeted:  false,
  seenSelene:           false,
  mainPanelSeen:        false,
  lancecast:            false,
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
