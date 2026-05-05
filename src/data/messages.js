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
//   reply     — optional. If present, shows a reply button in the content panel:
//     reply.buttonLabel — text shown on the reply button
//     reply.response    — message that appears below after replying

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
  {
    id: 2,
    enabled: true,
    verified: true,
    sender: 'Princess Lucia',
    subject: 'Hiiiiiiii',
    timestamp: '2026-05-04 // 09:14:22',
    portrait: null,
    body: "Heyyy! Big sis!! You said you'd message me but you haven't written for weeks now!",
    reply: {
      buttonLabel: 'Reply: I will when I can. This is a secure military line, please refrain from messaging me unnecessarily on it...',
      response: 'Uuuu..............',
    },
  },
]

// Only export messages that are enabled, with `read` initialised to false
export const INITIAL_MESSAGES = ALL_MESSAGES
  .filter(m => m.enabled)
  .map(({ enabled: _enabled, ...rest }) => ({ ...rest, read: false }))
