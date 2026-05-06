// ── Encyclopedia data ─────────────────────────────────────────────────────────
// content: null              →  stub entry (unclickable, greyed out)
// content: { heading, body } →  full article (or minimal placeholder)
// locked: { flag }           →  locked until localStorage flag is true

// ── Placeholder bodies ────────────────────────────────────────────────────────
const PENDING = `[ Full article pending. ]`

// ── Helpers ───────────────────────────────────────────────────────────────────

// image: { src, caption } — optional, displayed below heading before body text
const entry = (id, title, body, lockedFlag = null, image = null) => ({
  id,
  title,
  ...(lockedFlag ? { locked: { flag: lockedFlag } } : {}),
  content: {
    heading: title,
    ...(image ? { image } : {}),
    body: Array.isArray(body) ? body : [body],
  },
})

// ── Topics ────────────────────────────────────────────────────────────────────
export const ENCYCLOPEDIA = [
  {
    id:    'imperial-lore',
    label: 'Imperial Lore',
    entries: [
      entry('imperial-space-force', 'Imperial Space Force',
        [
          `The Imperial Space Force, also known as the Imperial Navy, is the empire's roughly three thousand ships and, by every accounting that signifies, the most powerful force in known space. Its existence is the empire's settled position on the question of who rules the heavens.`,
          `For all this, the fleet has not fought a fleet engagement in a generation. The last great war ended before most current officers were born and the empire has been at peace since. This peace is the fleet's vindication; it is also, increasingly, its mood. A Stellaris captain today is more likely to spend her career escorting a Princess to a treaty signing, conducting an antiquarian survey of some long-quiet system, or running anti-piracy sweeps along the trade routes than to fire her primary armament in earnest. Drills are kept; doctrine is rehearsed; the gunnery officers earn their qualifications and their ribbons. But the fleet has learned, slowly and without anyone naming it, the habits of a parade: polished surfaces, exact formations, the careful ceremony of arriving in order.`,
          `Some among the Empress's councilors have begun, in private, to wonder what would happen if the Navy were ever again asked to be a blade rather than a banner. The fleet would say, of course, that it is ready.`,
        ],
        null,
        { src: 'logo.png', caption: 'Seal of the Imperial Space Force.' },
      ),
      entry('imperial-anthem',           'Imperial Anthem',                  PENDING),
      entry('imperial-theology',         'Imperial Theology',                PENDING),
      entry('the-empress',               'The Empress',                      PENDING, 'empressPanelVisited'),
      entry('the-final-hearing',         'The Final Hearing',                PENDING, 'empressPanelVisited'),
      entry('the-discord',               'The Discord',                      PENDING, 'empressPanelVisited'),
      entry('throneworld',               'Throneworld',                      PENDING, 'throneworldTargeted'),
      entry('world-engine',              "The World Engine; 'Litania Magna'", PENDING, 'worldengineTargeted'),
      entry('annunciator-battlestation', 'Annunciator Class Battlestation',  PENDING),
      entry('princess-astraia',          'Princess V. ASTRAIA',              PENDING),
      entry('princess-selene',           'Princess L. SELENE',               PENDING, 'seenSelene'),

    ],
  },
  {
    id:    'technology',
    label: 'Technology',
    entries: [
      entry('quantum-communication',      'Quantum Communication',          PENDING),
      entry('relativistic-kill-vehicles', 'Relativistic Kill Vehicles',     PENDING, 'mainPanelSeen'),
      entry('d3he-fusor',                 'D-³He Fusor Reactor',            PENDING, 'mainPanelSeen'),
      entry('chronology-protection',      'Chronology Protection',          PENDING, 'mainPanelSeen'),
    ],
  },
  {
    id:    'world',
    label: 'World',
    entries: [
      entry('world-placeholder', 'Placeholder', 'Work in Progress.'),
    ],
  },
]
