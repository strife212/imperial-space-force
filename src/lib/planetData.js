// ── Star systems ──────────────────────────────────────────────────────────────
// Each system has a sun and a list of planets. Planets may have moons.
// Each body type fields:
//   sun:    { name, type, mass, lum, temp, color, description }
//   planet: { name, climate, distAU, speed, r, color, description, moons: [...] }
//   moon:   { name, type, orbitR (px from planet center), speed, r, color, description }

export const SYSTEMS = [
  {
    id:       'throne-system',
    name:     'Novaraya System',
    imperial: true,
    sun:  {
      name:  'Novaraya',
      type:  'F-Type Main Sequence',
      mass:  '1.20 M☉',
      lum:   '2.00 L☉',
      temp:  '6,800 K',
      color: '#fff0b0',
      description: `Hotter and brighter than the empire's home star of legend, Novaraya bathes the throneworld in radiation that has shaped its theology as much as its climate. Its corona is famously visible from the throneworld's surface, even at noon.\n\nThe empire's high holy day, the Festival of Greater Light, coincides with the star's summer solstice as observed from the imperial capital. The Synod's astronomers maintain its observation schedule down to the second.`,
    },
    planets: [
      {
        name:    'Throneworld',
        climate: 'Imperial Capital / Temperate',
        distAU:  1.00,
        speed:   0.00048,
        r:       12,
        color:   '#7090d0',
        description: `Capital of the empire. Officially designated as such by the First Empress and never since renamed, an unusual omission for an institution that habitually renames every other facet of its environment. Temperate, oceanic, with the imperial capital (also unnamed in formal usage) set on the continent of Aurelia.\n\nApproximately twelve billion subjects reside on Throneworld, the vast majority within the orbital ring's downward shadow. The Empress's residence is the Cathedra, a structure whose internal volume exceeds that of any other sovereign palace ever constructed.`,
        moons: [
          {
            name: 'The Ecumenologion',
            type: 'Computational Moon',
            orbitR: 32,
            speed: 0.0014,
            r: 5,
            color: '#a8c0e0',
            description: `The throneworld's natural moon, every square metre of its surface long since converted into the substrate of the imperial computational engine known as the Litania Magna. From orbit, the moon appears as a sphere of indigo tracery, encircled by the wider arc of its diadem, an orbital field of solar collectors.\n\nThe Engine is the precondition of the empire as a coherent thing. Without it, the quantum-entangled communications binding three thousand ships and ten thousand worlds would collapse into the speed of light and the patience of distance. See the encyclopaedia entry for further detail.`,
          },
        ],
      },
    ],
  },
  {
    id:   'system-x',
    name: 'Karath System',
    sun:  {
      name:  'Karath',
      type:  'G-Type Main Sequence',
      mass:  '1.00 M☉',
      lum:   '1.00 L☉',
      temp:  '5,778 K',
      color: '#ffd060',
      description: `An unremarkable yellow main-sequence star anchoring the planetary arrangement designated Karath System. Long observed by Imperial cartography but never visited in the modern era; preliminary surveys confirm parameters essentially identical to the empire's home star of legend.\n\nKarath's chief distinction is administrative rather than astrophysical: it was the empire's first long-range cartographic confirmation of life-bearing systems in the outer sectors, and its catalogue entry initiated the present round of expansion.`,
    },
    planets: [
      {
        name: 'Verath', climate: 'Scorched / Barren', distAU: 0.39, speed: 0.00090, r: 5, color: '#b87040', moons: [],
        description: `Innermost world of Karath System. A scorched, barren rock with surface temperatures regularly exceeding nine hundred kelvin on the dayside. No atmosphere of note. The crust is iron-rich and tectonically dead.\n\nOf academic interest only, though several metallurgical concessions have been informally proposed in council. None has yet been ratified.`,
      },
      {
        name: 'Solen II', climate: 'Arid / Volcanic', distAU: 0.72, speed: 0.00065, r: 7, color: '#d4a843', moons: [],
        description: `An arid, volcanic world with continuous tectonic disruption visible from orbit. Its name presupposes a Solen I that long-range survey has yet to identify; current orthodoxy holds the body to be a misnaming, but the appellation has persisted through three catalogue revisions.\n\nAtmosphere is thick with sulphurous compounds. The surface is unsuited for any conceivable Imperial presence.`,
      },
      {
        name: 'Aethon', climate: 'Temperate / Oceanic', distAU: 1.00, speed: 0.00048, r: 9, color: '#4a8fd4', moons: [],
        description: `A temperate oceanic world bearing strong superficial resemblance to several core Imperial worlds. Continental coverage approximately thirty percent. Atmospheric composition is breathable within tolerance.\n\nLong-range spectroscopy is ambiguous on the question of biology; the signatures are consistent with either a complex biosphere or with mineralogical artefacts of similar appearance. Flagged for priority survey.`,
      },
      {
        name: 'Maren', climate: 'Cold / Arid Desert', distAU: 1.52, speed: 0.00033, r: 6, color: '#c4714a', moons: [],
        description: `A cold, arid desert world. Atmosphere thin enough to walk under unprotected, though only just, and only briefly. No standing water in any meaningful quantity. The surface is a uniform rust-coloured regolith broken by long, shallow canyon systems.\n\nAncient watercourses suggest a wetter past. The empire's astrobiologists consider Maren the more interesting of the two candidate worlds in this system.`,
      },
      {
        name: 'Joras', climate: 'Gas Giant / Tempestuous', distAU: 2.80, speed: 0.00018, r: 20, color: '#c4a875', moons: [],
        description: `A tempestuous gas giant with continuous storms visible across its equatorial bands at every observed wavelength. Eight known moons, none catalogued in detail. Estimated mass approximately three hundred Imperial reference units.\n\nIts magnetosphere extends well past the orbit of its outermost moon; any future expedition would require shielding well beyond Standard Imperial Survey grade.`,
      },
      {
        name: 'Calveth', climate: 'Gas Giant / Ringed', distAU: 4.50, speed: 0.00010, r: 16, color: '#d4c4a0', moons: [],
        description: `A ringed gas giant of striking aesthetic interest. The rings are unusually dense and consist primarily of ice fragments measuring under a metre across. Three distinct gaps are visible at high magnification, suggesting unconfirmed shepherd moons.\n\nThe empire's poets, of whom there is no shortage, have used Calveth's image more times than any other body outside the throneworld system.`,
      },
      {
        name: 'Ulren', climate: 'Ice Giant / Frozen', distAU: 6.20, speed: 0.000060, r: 13, color: '#7ab4d4', moons: [],
        description: `A frozen ice giant in the outer reaches of Karath System. Methane and ammonia dominate the upper atmosphere. Surface temperature, to whatever extent that word is meaningful here, is below eighty kelvin.\n\nNothing is known of its interior. Survey priority: low.`,
      },
      {
        name: 'Nethis', climate: 'Ice Giant / Methane', distAU: 8.00, speed: 0.000040, r: 12, color: '#4a6ab4', moons: [],
        description: `A methane-rich ice giant with a distinct deep-blue colouration. The outermost gas world in Karath System. Its axial tilt is anomalously steep, suggesting a violent event in its early history; theories remain speculative.\n\nLong-period oscillations in its orbit have been detected but not yet explained.`,
      },
      {
        name: 'Vorax', climate: 'Frozen / Dwarf World', distAU: 9.50, speed: 0.000028, r: 4, color: '#a0b4c4', moons: [],
        description: `A frozen dwarf world at the system's edge. Its eccentric orbit periodically brings it inward of Nethis, and its inclination is sharply offset from the system's ecliptic, suggesting it may have been captured rather than formed in place.\n\nComposition appears similar to the kuiper-belt objects observed in other catalogued systems. Diameter approximately twelve hundred kilometres.`,
      },
    ],
  },
]

// ── Backward compat exports (Karath System) ────────────────────────────────────────
const SYSTEM_X = SYSTEMS.find(s => s.id === 'system-x')
export const PLANETS = SYSTEM_X.planets
export const SUN     = SYSTEM_X.sun

// ── Flat target index across all systems ──────────────────────────────────────
// Order is fixed to preserve old indices (Karath System planets 0–8, sun 9):
//   0–8  : Karath System planets
//   9    : Karath System sun (Karath)
//   10   : Novaraya System sun (Novaraya)
//   11   : Novaraya System planet (Throneworld)
//   12   : Novaraya System moon (The Ecumenologion)
function buildTargets() {
  const out = []
  // Karath System always comes first (planets then sun) to keep old SUN_IDX = 9
  SYSTEM_X.planets.forEach(p => out.push({ systemId: 'system-x', kind: 'planet', body: p, system: SYSTEM_X }))
  out.push({ systemId: 'system-x', kind: 'sun', body: SYSTEM_X.sun, system: SYSTEM_X })
  // Other systems: sun, planets, each planet's moons in order
  SYSTEMS.filter(sys => sys.id !== 'system-x').forEach(sys => {
    out.push({ systemId: sys.id, kind: 'sun', body: sys.sun, system: sys })
    sys.planets.forEach(p => {
      out.push({ systemId: sys.id, kind: 'planet', body: p, system: sys })
      p.moons.forEach(m => out.push({ systemId: sys.id, kind: 'moon', body: m, planet: p, system: sys }))
    })
  })
  return out
}

export const TARGETS  = buildTargets()
export const SUN_IDX  = TARGETS.findIndex(t => t.systemId === 'system-x' && t.kind === 'sun')

// ── Helpers ───────────────────────────────────────────────────────────────────
export function getTargetName(idx) {
  return TARGETS[idx]?.body.name ?? 'CLASSIFIED'
}

export function getTargetInfo(idx) {
  return TARGETS[idx] ?? null
}

// Index of the first target entry for a given system+kind+body (used for click → flat index)
export function findTargetIdx(systemId, kind, bodyName) {
  return TARGETS.findIndex(t => t.systemId === systemId && t.kind === kind && t.body.name === bodyName)
}
