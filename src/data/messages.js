// ── Imperial Messaging Service — Message Definitions ─────────────────────────
//
// Add new messages here. Set `enabled: false` to hide a message without
// deleting it. Messages appear in the order listed.
//
// Fields:
//   id        — unique number, never reuse
//   enabled   — true/false, controls whether the message appears in-game
//   sender    — display name shown in the list and content panel
//   subject   — short subject line
//   timestamp — display string, e.g. '2026-05-04 // 14:32:01'
//   portrait  — path relative to /public (e.g. 'portraits/astraia.jpg'),
//               or null for [ NO IMAGE ]
//   body      — full message body text

const ALL_MESSAGES = [
  {
    id: 1,
    enabled: true,
    verified: true,
    sender: 'Admiralty Command',
    subject: 'Reactor Power-Up Notice',
    timestamp: '2026-05-04 // 14:32:01',
    portrait: null,
    body: 'The installation has been kept in low power mode for recent maintenance - make sure you power up the reactor first to get things started.',
  },
]

// Only export messages that are enabled, with `read` initialised to false
export const INITIAL_MESSAGES = ALL_MESSAGES
  .filter(m => m.enabled)
  .map(({ enabled: _enabled, ...rest }) => ({ ...rest, read: false }))
