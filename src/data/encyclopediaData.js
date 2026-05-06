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
          `For all this, the fleet has not fought a fleet engagement in a generation. The last great war ended before most current officers were born and the empire has been at peace since. This peace is the fleet's vindication; it is also, increasingly, its mood. A Stellaris captain today is more likely to spend her career escorting a Princess to a treaty signing, conducting an antiquarian survey of some long-quiet system, or running anti-piracy sweeps along the trade routes than to fire her primary armament in earnest. Drills are kept and doctrine is rehearsed, but the fleet has learned, slowly, the habits of a parade: polished surfaces, exact formations, the careful ceremony of arriving in order.`,
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
      entry('world-engine', "The World Engine; 'Litania Magna'",
        [
          `The World Engine, named Litania Magna (the Great Litany).`,
          `The empire's most exalted name for its world-engine of computation. It is the moon of the throneworld, covered to the last square meter of its surface in the substrate of the empire's thought. Seen from approach, it is a sphere of indigo tracery, circled by the wider arc of its diadem, the orbital field of solar collectors that catches the throneworld's sun at every aspect. To call it a supercomputer is technically correct and poetically thin. The Litania Magna is the precondition of the empire in its current state as a coherent thing. The quantum-entangled communications that bridge the imperial reach require computational resources at a scale no smaller body could host; without the Engine, the empire's three thousand ships and ten thousand worlds would be reduced to the speed of light and the patience of distance, and the centralised throne could not exist.`,
          `Beneath that primary function the Engine carries on much else. It models the slow weather of stellar systems and the slower weather of the imperial economy. It runs theological simulations whose conclusions the Synod treats with seriousness, sometimes with more seriousness than the Synod's own deliberations. It rehearses fleet engagements that have not happened and may never; it reconstructs ones that have. And at its center (though center is a word the Engine's architects are careful with, since the substrate is distributed across the whole lunar shell) sits the Litany's great artificial mind, a counselor that prepares analysis, drafts correspondence, and offers the Empress and her princesses the considered judgment of an intelligence that has read every imperial document ever written. It does not decide. The empire is firm on this point. It readies; she chooses. The Engine carries some forty thousand staff and researchers in the orbital habitats clustered between the surface and the Corona, split between theological physicists, quantum-protocol drafters and other such professions. A posting to the World Engine is the most sought-after destination in the empire for any subject of scientific or contemplative inclination. To be sent there is, in the working vocabulary of the imperial academies, to be called to the Litany.`,
          `The Empress's own relationship with the Engine is the part of her reign that subjects know least. By long custom she withdraws to the Litania Magna for several days each month, traveling alone in a small craft of her household and entering a chamber whose location is not publicly known and whose interior no one but she has seen. There she communes with the mind of the Litany for long periods. She returns; she resumes. The settled understanding is that during these communions the Empress translates what she has heard from the stars into a form upon which the Engine may compute, and the Engine in turn translates her hearing into the operations that carry the chord across the empire's worlds. She hears; the Engine works; the song goes on. Heterodox readings hold that something stranger happens in that chamber: that it is not entirely clear which of the two is communing with which, and that the will of the stars now passes between Empress and Engine in a form that neither of them quite originates. Orthodoxy declines to engage with this view.`,
        ],
        'worldengineTargeted',
        { src: 'worldengine.jpg', caption: 'The World Engine above the Throneworld' },
      ),
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
