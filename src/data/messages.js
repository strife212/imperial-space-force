// ── Imperial Messaging Service — Message Definitions ─────────────────────────
//
// Two lists:
//
//   ALWAYS_ON_MESSAGES  — appear immediately when the game loads
//   TRIGGERED_MESSAGES  — arrive mid-session when a session flag is set
//
// Set `enabled: false` to hide a message without deleting it.
//
// Fields (all messages):
//   id        — unique number, never reuse
//   enabled   — true/false
//   verified  — true/false, shown as quantum-cryptography pass/fail
//   sender    — display name
//   subject   — short subject line
//   timestamp — display string, e.g. '2026-05-04 // 14:32:01'
//   portrait  — path relative to /public, or null for [ NO IMAGE ]
//   body      — full message body text
//   reply     — optional { buttonLabel, response }
//
// Extra field (TRIGGERED_MESSAGES only):
//   requires  — session flag name; message arrives when triggerFlag(name) is called

const ALWAYS_ON_MESSAGES = [
  {
    id: 1,
    enabled: true,
    verified: true,
    sender: 'Admiralty Command',
    subject: 'Reactor Power-Up Notice',
    timestamp: '2026-05-04 // 14:32:01',
    portrait: null,
    body: 'The installation has been kept in low power mode for recent maintenance - make sure you !!power up the reactor!! first to get things started.\n\nThe power system is two phase, with a Fusion Reactor to give the initial kickstart and a Black Hole Ergosphere power extraction system for the main load.\n\nStart with the reactor for now.',
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

const TRIGGERED_MESSAGES = [
  {
    id: 100,
    enabled: true,
    requires: 'reactorPoweredUp',
    verified: true,
    sender: 'Admiralty Command',
    subject: 'Antenna Misalignment',
    timestamp: '2026-05-04 // 14:44:17',
    portrait: null,
    body: "We can see the power readings increasing - looks like all systems are coming back online.\n\nHowever, we're not getting all the diagnostic readings we expect. It looks like the X-Band radio antenna isn't aligned correctly. Can you !!check the alignment?!!\n\nThe panel should be in the top right of the main control system.",
  },
  {
    id: 101,
    enabled: true,
    requires: 'antennaAligned',
    verified: true,
    sender: 'Admiralty Command',
    subject: 'Receiving signals',
    timestamp: '2026-05-04 // 15:02:49',
    portrait: null,
    body: "The deep space X-band relay has been reconnected.\n\nAll systems green. Targeting system is now active.\n\nWe're picking up some strange interference around 9.2ghz - can you try !!tuning the radio to 9.2ghz!! using the X-Band Radio frequency dial on your panel and see what you pick up?",
  },
]

export const INITIAL_MESSAGES = ALWAYS_ON_MESSAGES
  .filter(m => m.enabled)
  .map(({ enabled: _e, ...rest }) => ({ ...rest, read: false }))

export const ALL_TRIGGERED_MESSAGES = TRIGGERED_MESSAGES
