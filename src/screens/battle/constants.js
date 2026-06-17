// ── Battle parameters ──────────────────────────────────────────────────────────
const FLEET_SIZE  = 25
const SHIP_HP     = 6
const BOMBER_COUNT = 5       // heavy bombers per side
const BOMBER_HP    = 10      // tankier than a fighter
const BOMBER_SPEED = 4.05    // slower than fighters (MAX_SPEED 7.5)
const BOMBER_MIN   = 1.62
const BOMBER_SCALE = 1.43    // slightly larger than fighters
const BOMB_DMG     = 5       // 5× a regular fighter bolt
const BOMB_RANGE   = 30      // bombers must close to this range before bombing
const BOMB_LIFE    = 1.0     // bombs are short-ranged — expire sooner than bolts
const CAP_HP      = 60       // capital ship — tanky flagship
const CAP_SPEED   = 1.25     // capital ships lumber (very slow & ponderous)
const CAP_WEAPONS = 4        // bolts per capital volley
const BOLT_SPEED  = 46       // world units / second
const MISS_CHANCE = 0.28
const BOMB_MISS_CHANCE = 0.1   // bombers are deadly accurate (90% hit) — devastating if they get through
const MAX_SPEED   = 7.5
const MIN_SPEED   = 2.6
const SEP_RADIUS  = 3.0
const BOUND_R     = 34       // ships steer back inside this radius
const STANDOFF    = 14       // preferred engagement range — keeps a frontline gap
const TURN_RATE   = 7        // orientation slerp responsiveness
const FIELD_FIGHTER_CAP = 30 // max fighters a team can have on the field at once
const REINFORCE_INTERVAL = 10 // seconds between reinforcement waves from the reserve
// Armour: % chance an incoming hit that connects is deflected to zero damage.
// Only fighter bolts are mitigated — capital-ship attacks and bomber bombs
// always land in full.
const ARMOR_FIGHTER  = 0
const ARMOR_BOMBER   = 8
const ARMOR_FLAGSHIP = 12

// Fleet "strength" valuation, balanced so the standard fleet (1 flagship +
// 5 bombers + 25 fighters) totals exactly 1000. Started from HP × DPS, then
// adjusted for role: fighters are dearer than raw stats suggest (they engage
// everything and mass compounds), while bombers are cheaper (strong but purely
// anti-flagship — they sit out the fighter brawl that decides most battles).
const PTS_FIGHTER  = 10
const PTS_BOMBER   = 40
const PTS_FLAGSHIP = 550
const FLEET_BUDGET = 1000
const compStrength = (c) => c.fighters * PTS_FIGHTER + c.bombers * PTS_BOMBER + PTS_FLAGSHIP
const TEAMS = {
  blue: { color: 0x3a93ff, bolt: 0x8fc6ff },
  red:  { color: 0xff3322, bolt: 0xff7a5a },
}

// Optional sound assets. Drop matching files into public/sfx/ to override the
// synthesised sounds; any missing file simply falls back to the procedural synth.
// (Team/size-specific keys are preferred, with a generic fallback in brackets.)
const SOUND_FILES = {
  laser:        'sfx/laser.mp3',          // generic laser (both teams)
  laserBlue:    'sfx/laser-blue.wav',     // optional per-team override → falls back to `laser`
  laserRed:     'sfx/laser-red.wav',
  explosion:    'sfx/explosion.mp3',      // fighter / secondary blast
  explosionBig: 'sfx/explosion-big.wav',  // capital blast → falls back to `explosion`
  jump:         'sfx/jump.wav',           // hyperspace jump-in
  victory:      'sfx/victory.wav',        // engagement resolved
}

const RED_CAP_NAME = 'Rebel Capital Ship'
// Blue flagship names (always prefixed "HMSS "); rolled at random, re-rollable on the briefing
const BLUE_CAP_NAMES = [
  'Limitless Light', "Saint Berenike's Lance", 'The Long Patience of the Throne',
  'And This Too Was Foreseen', 'Everything In Its Set Place', 'All Things Toward the Throne',
  'And Then She Heard It', 'The Empress Has Considered Your Position', 'The Lance of Saint Concordia',
  "Saint Astraia's Promise", 'The Empress Remembers Saint Polyhymnia', 'Saint Concordia Heard First',
  "Stelladrach's Reach", "Mirelne's Descant", 'She Hears', 'Lumen Concordiae',
  'Empress of the Stars', 'Princess of Midnight',
]
const CAP_PREFIX = 'HMSS'
const randomBlueCapName = () => CAP_PREFIX + ' ' + BLUE_CAP_NAMES[Math.floor(Math.random() * BLUE_CAP_NAMES.length)]
// Peel the "HMSS" prefix off a full name so it can be shown as a small supertitle above the name
const splitCapName = (full) => full.startsWith(CAP_PREFIX + ' ')
  ? { prefix: CAP_PREFIX, name: full.slice(CAP_PREFIX.length + 1) }
  : { prefix: null, name: full }
// Comms-broadcast portraits: player portrait for blue, the Discord image for red
const COMMS_PORTRAIT = {
  blue: `${import.meta.env.BASE_URL}portrait.png`,
  red:  `${import.meta.env.BASE_URL}darkness.webp`,
}
// Persistent end-of-battle broadcast from the victor. Rich segments so the
// typewriter can break after the first sentence and colour the key phrase.
const VICTORY_SEGMENTS = {
  blue: [
    { text: 'Enemy destroyed.\n' },
    { text: 'Long live the ' },
    { text: 'Universal Order', cls: 'sb-comms-em--blue' },
    { text: '!' },
  ],
  red: [
    { text: 'Enemy destroyed.\n' },
    { text: 'Down with the ' },
    { text: 'false Empire', cls: 'sb-comms-em--red' },
    { text: '!' },
  ],
}

export {
  FLEET_SIZE, SHIP_HP, BOMBER_COUNT, BOMBER_HP, BOMBER_SPEED, BOMBER_MIN, BOMBER_SCALE,
  BOMB_DMG, BOMB_RANGE, BOMB_LIFE, CAP_HP, CAP_SPEED, CAP_WEAPONS, BOLT_SPEED, MISS_CHANCE,
  BOMB_MISS_CHANCE, MAX_SPEED, MIN_SPEED, SEP_RADIUS, BOUND_R, STANDOFF, TURN_RATE,
  FIELD_FIGHTER_CAP, REINFORCE_INTERVAL, ARMOR_FIGHTER, ARMOR_BOMBER, ARMOR_FLAGSHIP,
  PTS_FIGHTER, PTS_BOMBER, PTS_FLAGSHIP, FLEET_BUDGET, compStrength, TEAMS, SOUND_FILES,
  RED_CAP_NAME, BLUE_CAP_NAMES, CAP_PREFIX, randomBlueCapName, splitCapName, COMMS_PORTRAIT,
  VICTORY_SEGMENTS,
}
