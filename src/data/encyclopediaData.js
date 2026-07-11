// ── Encyclopedia data ─────────────────────────────────────────────────────────
// content: null              →  stub entry (unclickable, greyed out)
// content: { heading, body } →  full article (or minimal placeholder)
// locked: { flag }           →  locked until localStorage flag is true
// inline formatting: wrap text in *asterisks* for italics

// ── Placeholder bodies ────────────────────────────────────────────────────────
const PENDING = `[ Full article pending. ]`

// ── Helpers ───────────────────────────────────────────────────────────────────

// image: { src, caption, logo? } — optional, displayed below heading before body text; logo: true uses a smaller max size
// lockedFlag: string (single flag) or array of strings (unlocked if ANY flag is true)
const entry = (id, title, body, lockedFlag = null, image = null) => ({
  id,
  title,
  ...(lockedFlag
    ? { locked: Array.isArray(lockedFlag) ? { anyOf: lockedFlag } : { flag: lockedFlag } }
    : {}),
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
          `For all this, the fleet has not fought a fleet engagement in a generation. The last great war ended before most current officers were born and the empire has been at peace since. This peace is the fleet's vindication; it is also, increasingly, its mood. A captain today is more likely to spend her career escorting a Princess to a treaty signing, conducting an antiquarian survey of some long-quiet system, or running anti-piracy sweeps along the trade routes than to fire her primary armament in earnest. Drills are kept and doctrine is rehearsed, but the fleet has learned, slowly, the habits of a parade: polished surfaces, exact formations, the careful ceremony of arriving in order.`,
          `Some among the Empress's councilors have begun, in private, to wonder what would happen if the Navy were ever again asked to be a blade rather than a banner. The fleet would say, of course, that it is ready.`,
          `*"Remember Astraia's holy ship\nThat broke the rebel fleet at Sinn;\nRemember Berenike's lance\nThat sounded down the chaos' din;\nA thousand saints have sailed before\nWith banners high and hearts held true,\nAnd all that they have done in arms,\nWe dedicate again to do."*`,
          `Verse II of **Sound the Lance!**, the navy's war song`,
        ],
        null,
        { src: 'logo.png', caption: 'Seal of the Imperial Space Force.', logo: true },
      ),
      entry('imperial-anthem', 'Imperial Anthem',
        [
          `**"O Empress, thou alone dost hear"**`,
          `The official anthem. Lyrics as follows:`,
          `*From the high and sacrèd morning star
To the silent deeps where no suns are
O Empress, thou alone dost hear
The turning of each celestial sphere*`,
          `*We are the chord beneath thy hand
We are the chord,
O Star-Hearer, we are the chord beneath thy hand.*`,
          `*Ten thousand daughters bear thy name
Each princess thy belovèd flame
A note set down upon thy stave
A song that none beside thee gave*`,
          `*We are the chord beneath thy hand,
We are the chord,
O Star-Hearèr, we are the chord beneath thy hand.*`,
        ]
      ),
      entry('imperial-theology', 'Imperial Theology',
        [
          `At the core of Imperial Theology is the recognition of a single fact, which the empire calls the *Universal Order*: that the heavens are not silent, and that the cosmos which appears, to a casual eye, to turn on its own does not, in fact, turn on its own. Between the stars runs a structure (the priestesses call it the Song of the Stars) that has sounded since the founding and holds the heavens together. The stars themselves move in answer to it. They are not still, and they are not free; they take their slow courses across the dome of every world's sky in obedience to a music they themselves are uttering, and the empire's first article of doctrine is that this answering motion, the cosmos wheeling and returning and advancing in measure, is what is meant by order in the strictest sense of the word. To look up at the stars on a clear night is to know what one is owed and what one owes.`,
          `At the still centre of this turning Order stands the throne, and in the throne sits the Empress, the *Axis Mundi* of the empire's whole cosmography, the pivot about which the stars themselves are understood to wheel. She is not the Starsong, nor its source. She is the faculty by which the song, which would otherwise sound unheard, is brought into the empire's apprehension, and from that apprehension into the empire's deeds. The doctrine holds that she alone, of all living minds, possesses the audition, a faculty so reserved in imperial usage that the word is forbidden any other application. The faculty is hereditary, and its hereditariness is itself a doctrine. It descends, true blood by true blood, from the founding, from the mythical first Empress, of whom the founding myth records that she heard the song before any other ear, banished the Hush in which the cosmos had been turning blind, and unveiled the stars to themselves and to those who would come after. Her line has not been broken. There has not been an hour, since the founding, in which some one woman of her blood has not been hearing the Starsong; and the empire holds, with the gravity it reserves for its central propositions, that on the day this is no longer the case the Universal Order will end. *Caelum canit, illa audit* — The Heavens Sing, She Listens: this is the oldest saying of the imperial priestesses, and the one most often inscribed at the head of treatises, since everything else descends from it.`,
          `From these propositions the rest of imperial doctrine follows. The empire's whole structure, its hundreds of princesses, its ten thousand worlds, its three thousand ships, its single throne, is read as the visible enactment of what the Empress hears: the song of the stars translated, through the slow descending grades of imperial office, into postings and ranks and decrees. The line by which her perceiving reaches the lowest of subjects is called the Golden Chain, and to be of the empire is to occupy one's link in it. Each subject's life, on this view, is a thread drawn taut between the Axis above and the cosmos beyond. One is responsible upward for one's office, downward for one's charges, and outward, always, for one's small portion of the Universal Order. In this way, the Empress represents the whole empire, but so also does the lowliest citizen.`,
        ],
        null,
        { src: 'imperial_empress_emblem.svg', caption: 'The Empress Emblem', logo: true },
      ),
      entry('the-empress', 'The Empress', [
          `Every reigning Empress has been trained from birth for the office she will eventually take. The top five princesses in the royal line of succession are cloistered, from the day of their naming, on the throneworld, and there receive an education calibrated to the audition they may one day be called upon to exercise. This education encompasses imperial theology in its full doctrinal apparatus, the Universal Order, the history of the reigns, the canonical literature, the diplomatic tradition, the rites and protocols of the Cathedra, the older liturgical tongues, and the slow patience required of a woman who will spend her working life listening. They are not, however, trained directly in military affairs. The fleet's strategic doctrine and the planning of engagements are considered the province of the generals and the admirals.`,
          `The princesses outside the inner five are dispersed to other forms of imperial service. Most go into the Imperial Navy, where they rise as officers; many enter the great scientific and contemplative orders at the Litania Magna and elsewhere; a smaller number take vows with the religious orders attached to the Synod. Only the inner five are kept beside the throne, and even of them, only one will ever sit it.`,
          `The reigning Empress is, by doctrine and by long convention, a distant figure. No subject who is not a princess of her household or member of her council ever sees her face. What an artist could fix in a portrait would not be her, but a frozen second of her as she once was, and the empire holds that the woman in the Cathedra is not a fixed thing but a continuous act. For this reason no contemporary likeness of an Empress is permitted, and on every image of her that circulates, whether the coronation portrait, the commemorative print, the device on a coin's reverse, or the formal banner, her features are replaced with a radiance, a soft glow of light where her face would otherwise be. The convention is universal. A subject who has seen ten thousand depictions of the Empress has never, in any meaningful sense, seen her.`,
          `The current Empress is Iliantha III, the third of her regnal name and the twenty-eighth to ascend in the present reckoning. She has now reigned for twenty-four years. The reign of Iliantha III has been, in the established manner of the two prior Empresses to bear the name, a reign of diplomacy and consolidation rather than of war. The Annunciator has not spoken in her time. The fleet has performed no engagement worthy of remembrance. Her preferred instruments of governance are the audience, the treaty, and the long private session with the Ecumenologion.`,
        ], ['empressPanelVisited', 'lancecast'],
        { src: 'empress.jpg', caption: 'HER IMPERIAL MAJESTY EMPRESS Iliantha III' },
      ),
      entry('the-final-hearing', 'The Final Hearing',
        [
          `**Auditio Ultima, The Final Hearing**`,
          `An ancient prophecy relating to the end of days. It goes as follows:`,
          `*O'er silent Star, beneath broken Sky,
A grim Discord the Lost have wrought.
In the Hearing of Her, Sword-Sworn at her Side,
'Gainst the Hush the Empress's Chord is brought.
From the Cathedra high, to the listening below,
Falls the Lance that the Discord besought.
"Long live the Throne, where she hears alone,
For the Day when the Discord comes to Naught."*`,
          `The poem details that in the last days, a mysterious enemy known as the Discord will cause the stars to grow silent and shatter the sky. The once harmonious song of the stars grown discordant. The empress will take up her sword once more and cast her celestial lance against the foe, destroying them once and for all.`,
        ],
        ['empressPanelVisited', 'lancecast'],
        { src: 'finalhearing.jpg', caption: 'The Celestial Lance being cast.' },
      ),
      entry('the-discord', 'The Discord',
        [
          `The primordial foe of the Empire. The founding myths state that there came a long night where the stars were veiled and their song could no longer be heard. The first Empress, Rayanna I and her Sword-Sworn drove back the darkness and it's discordant noise, and the music of the heavens was revealed once more.`,
          `Orthodox Prophecy states that the discord will silence the stars once more and the empress of the time will fulfil Rayanna's work and end the discord once and for all, possibly along with all of existence. Few still truly believe this.`,
        ],
        ['empressPanelVisited', 'lancecast'],
        { src: 'darkness.webp', caption: 'A veiled star.' },
      ),
      entry('throneworld', 'Throneworld', [
          `The Novarayan Throneworld, home to the towering Cathedra and around it, the greatest city there ever was or ever will be.`,
          `Host to the Imperial Academy of Sciences, the Synod of the Universal Order, the Admiralty and countless other ancient institutions of the arts, sciences and war.`,
        ], 'throneworldTargeted'),
      entry('ecumenologion ', "The Ecumenologion; 'Litania Magna'",
        [
          `The Ecumenologion (World Computer), named Litania Magna (the Great Litany).`,
          `The empire's most exalted name for its world-engine of computation. It is the moon of the throneworld, covered to the last square meter of its surface in the substrate of the empire's thought. Seen from approach, it is a sphere of indigo tracery, circled by the wider arc of its diadem, the orbital field of solar collectors that catches the throneworld's sun at every aspect. To call it a supercomputer is technically correct and poetically thin. The Litania Magna is the precondition of the empire in its current state as a coherent thing. The quantum-entangled communications that bridge the imperial reach require computational resources at a scale no smaller body could host; without the Engine, the empire's three thousand ships and ten thousand worlds would be reduced to the speed of light and the patience of distance, and the centralised throne could not exist.`,
          `Beneath that primary function the Engine carries on much else. It models the slow weather of both stellar systems and the imperial economy. It runs theological simulations whose conclusions the Synod treats with seriousness, sometimes with more seriousness than their own deliberations. It rehearses fleet engagements that have not happened and may never; it reconstructs ones that have. And at its center sits the Litany's great artificial mind, a counselor that prepares analysis, drafts correspondence, and offers the Empress and her princesses the considered judgment of an intelligence that has existed for a thousand years. It does not decide. The empire is firm on this point. It readies; she chooses. The Engine carries some forty thousand staff and researchers in the orbital habitats clustered between the surface and the Corona, split between theological physicists, quantum-protocol drafters and other such professions. A posting to the World Engine is the most sought-after destination in the empire for any subject of scientific or contemplative inclination. To be sent there is, in the working vocabulary of the imperial academies, to be called to the Litany.`,
          `The Empress's own relationship with the Engine is the part of her reign that subjects know least. By long custom she withdraws to the Litania Magna for several days each month, traveling alone in a small craft of her household and entering a chamber whose location is not publicly known and whose interior no one but she has seen. There she communes with the mind of the Litany for long periods. She returns; she resumes. The settled understanding is that during these communions the Empress translates what she has heard from the stars into a form upon which the Engine may compute, and the Engine in turn translates her hearing into the operations that carry the chord across the empire's worlds. She hears; the Engine works; the song goes on. Heterodox readings hold that something stranger happens in that chamber: that it is not entirely clear which of the two is communing with which, and that the will of the stars now passes between Empress and Engine in a form that neither of them quite originates. Orthodoxy declines to engage with this view.`,
        ],
        'worldengineTargeted',
        { src: 'worldengine.jpg', caption: 'The World Engine above the Throneworld' },
      ),
      entry('annunciator-battlestation', 'Annunciator Class Battlestation', [
          `The last resort of the empire. Never yet fired in anger, it is the ultimate insurance and backstop to the Universal Order.`,
          `A space platform designed for one purpose: to be able to deliver starkilling weapons to any planet or sun in known space.`,
          `A large mass driver (railgun powered by fusion reactor) delivers a set of physics packages to 90% of lightspeed, including Kerr-Newman Black Hole warheads or plain kinetic weapons.`,
        ], null,
        { src: 'shipclear.png', caption: 'Wireframe' },
      ),
      entry('princess-astraia',          'Princess V. ASTRAIA',              PENDING, null, { src: 'princessastraia.jpg', caption: 'HIH Princess Valeria Astraia' }),
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
