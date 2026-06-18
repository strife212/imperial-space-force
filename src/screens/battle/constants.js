// ── Battle parameters ──────────────────────────────────────────────────────────
const FLEET_SIZE  = 25
const SHIP_HP     = 6
const BOMBER_COUNT = 5       // heavy bombers per side
const BOMBER_HP    = 12      // tankier than a fighter
const BOMBER_SPEED = 4.5     // slower than fighters (MAX_SPEED 7.5)
const BOMBER_MIN   = 1.62
const BOMBER_SCALE = 1.43    // slightly larger than fighters
const BOMB_DMG     = 5       // 5× a regular fighter bolt
const BOMB_RANGE   = 30      // bombers must close to this range before bombing
const BOMB_LIFE    = 1.0     // bombs are short-ranged — expire sooner than bolts
const PD_RANGE     = 30      // bomber point-defence laser only engages fighters within this range
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
const FIGHTER_RANGE = 45     // fighters hold fire past this (was 50; −10% weapon range)
const TURN_RATE   = 7        // orientation slerp responsiveness
const FIELD_FIGHTER_CAP = 25 // max fighters a team can have on the field at once
const REINFORCE_INTERVAL = 10 // seconds between reinforcement waves from the reserve
const BOMBER_AUTO_DISPATCH = 15 // sim-seconds before the blue bomber wing auto-launches if the player hasn't
// Missile cruiser — a ranged support ship that holds back and lobs homing missiles
const CRUISER_HP    = 16
const CRUISER_SPEED = 5.0
const CRUISER_MIN   = 2.0
const CRUISER_SCALE = 1.7    // larger than a bomber
const CRUISER_STANDOFF = 30  // keeps its distance and bombards from range
const MISSILE_DMG   = 3
const MISSILE_SPEED = 30      // slower than a bolt (46) so the smoke trail reads
const MISSILE_LIFE  = 3.0
const MISSILE_RANGE = 60      // long reach — cruisers open fire well before the brawl
const MISSILE_MISS_CHANCE = 0.15
const MISSILE_HOMING = 0.22   // per-step turn toward target (vs 0.12 for fighter bolts)
const MISSILE_CD_MIN = 2.2
const MISSILE_CD_RND = 2.0
// Armour: % chance an incoming hit that connects is deflected to zero damage.
// Only fighter bolts are mitigated — capital-ship attacks and bomber bombs
// always land in full.
const ARMOR_FIGHTER  = 0
const ARMOR_BOMBER   = 10
const ARMOR_FLAGSHIP = 25
const ARMOR_CRUISER  = 10

// Fleet "strength" valuation, balanced so the standard fleet (1 flagship +
// 5 bombers + 25 fighters) totals exactly 1000. Started from HP × DPS, then
// adjusted for role: fighters are dearer than raw stats suggest (they engage
// everything and mass compounds), while bombers are cheaper (strong but purely
// anti-flagship — they sit out the fighter brawl that decides most battles).
const PTS_FIGHTER  = 10
const PTS_BOMBER   = 40
const PTS_CRUISER  = 50
const PTS_FLAGSHIP = 550
// A living flagship is never worth less than this in fleet strength: its guns
// and the morale of an intact command vessel keep it valuable even at 1 HP.
const PTS_FLAGSHIP_MIN = 50
const FLEET_BUDGET = 1000
const RETREAT_STRENGTH = 100 // a fleet that drops below this remaining power breaks and warps out
const MORALE_BROKEN_STRENGTH = 150 // higher rout threshold once a fleet's flagship is destroyed
const compStrength = (c) => c.fighters * PTS_FIGHTER + c.bombers * PTS_BOMBER + (c.cruisers || 0) * PTS_CRUISER + PTS_FLAGSHIP
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
// Comms-broadcast portraits: player portrait for blue, the Discord image for red.
// BASE_URL is guarded so this module also loads under plain Node (e.g. the battle
// sim harness), where import.meta.env is undefined.
const BASE_URL = import.meta.env?.BASE_URL ?? '/'
const COMMS_PORTRAIT = {
  blue: `${BASE_URL}portrait.png`,
  red:  `${BASE_URL}darkness.webp`,
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
  BOMB_DMG, BOMB_RANGE, BOMB_LIFE, PD_RANGE, CAP_HP, CAP_SPEED, CAP_WEAPONS, BOLT_SPEED, MISS_CHANCE,
  BOMB_MISS_CHANCE, MAX_SPEED, MIN_SPEED, SEP_RADIUS, BOUND_R, STANDOFF, FIGHTER_RANGE, TURN_RATE,
  FIELD_FIGHTER_CAP, REINFORCE_INTERVAL, BOMBER_AUTO_DISPATCH, ARMOR_FIGHTER, ARMOR_BOMBER, ARMOR_FLAGSHIP, ARMOR_CRUISER,
  CRUISER_HP, CRUISER_SPEED, CRUISER_MIN, CRUISER_SCALE, CRUISER_STANDOFF,
  MISSILE_DMG, MISSILE_SPEED, MISSILE_LIFE, MISSILE_RANGE, MISSILE_MISS_CHANCE, MISSILE_HOMING, MISSILE_CD_MIN, MISSILE_CD_RND,
  PTS_FIGHTER, PTS_BOMBER, PTS_CRUISER, PTS_FLAGSHIP, PTS_FLAGSHIP_MIN, FLEET_BUDGET, RETREAT_STRENGTH, MORALE_BROKEN_STRENGTH, compStrength, TEAMS, SOUND_FILES,
  RED_CAP_NAME, BLUE_CAP_NAMES, CAP_PREFIX, randomBlueCapName, splitCapName, COMMS_PORTRAIT,
  VICTORY_SEGMENTS,
}
