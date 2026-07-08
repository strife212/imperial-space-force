import { useState, useRef, useEffect, useMemo } from 'react'
import { createMontageAudio } from './montageAudio'
import './montage.css'

// ── Cosmogony II · a montage of scientific and natural imagery ───────────────
// A fast-paced reel from the dawn of time to the modern day and beyond: the
// first light, the first galaxies, the primordial world, the charting mind,
// the modern eye, and the minds we built. Pure imagery — no chrome, no words —
// over a programmatic soundscape (montageAudio.js) that shifts with each era
// and quickens with the cutting. Opens on a title card; closes, after the
// silent reprise, with a museum colophon crediting every work (drawn from the
// slides' `c` fields). Deep-linked at /cosmogony2.

const BASE = import.meta.env?.BASE_URL ?? '/'
const IMG = (f) => `${BASE}montage/${encodeURIComponent(f)}`

// kb = camera treatment: 'in' pulls toward (approach, intensity), 'out' pulls
// back (reveal, contemplation), 'up' pans vertically through the image
// (ascent), 'still' holds dead static (documents, plates, diagrams — anything
// meant to be *read*). The reel biases 'in' as it nears the present: after
// Earthrise, every slide pushes in.
// pos = object-position aim point for the cover-crop · zoom = extra
// magnification · dis = dissolve into this slide (else hard cut) · era = 1..5
// act index (drives the soundscape's mood) · c = credit line (what / who /
// when) — shown in the end colophon.
export const REEL = [   // exported for scripts/render-montage-video.mjs
  // ── ACT I · the dawn of time ──
  { f: 'Cosmic_Microwave_Background_(CMB).jpeg', kb: 'in', dis: true, era: 1, c: 'Cosmic Microwave Background — ESA Planck all-sky survey, 2013' },
  { f: 'found_hubble_xdf.jpg', kb: 'out', dis: true, era: 1, c: 'Hubble eXtreme Deep Field — NASA / ESA, 2012' },
  // ── ACT II · the primordial world ──
  { f: 'The-Shore-of-Oblivion-1889-scaled.webp', kb: 'in', dis: true, era: 2, c: 'The Shore of Oblivion — Eugen Bracht, 1889' },
  { f: 'HKH-60684-scaled.jpg.webp', kb: 'out', era: 2, c: 'The Sea of Ice — Caspar David Friedrich, 1823–24' },
  { f: 'canon-de-chelle-walls-of-the-grand-canon-about-1200-feet-in-height-1873.jpg', kb: 'in', era: 2, c: 'Cañon de Chelle — Timothy O\'Sullivan, 1873' },
  { f: 'dasht_e_kev.1397218755.webp', kb: 'in', era: 2, c: 'Dasht-e Kavir — Landsat 7, USGS / NASA, 2000' },
  { f: 'HMF65m1WEAI1EhF.jfif', kb: 'out', era: 2, c: 'Storm in the Mountains — Albert Bierstadt, c. 1870' },
  { f: 'Unmatinapresledeluge.jpg', kb: 'in', dis: true, era: 2, c: 'Light and Colour — the Morning after the Deluge — J. M. W. Turner, 1843' },
  // ── ACT III · life, and the charting mind (documents hold still, to be read) ──
  { f: 'piranesi-roma.jpg', kb: 'in', era: 3, pos: '48% 42%', c: 'Vedute di Roma, the Temple of Saturn — G. B. Piranesi, c. 1774' },
  { f: 'hubert-robert-grande-galerie-1796.jpg', kb: 'in', era: 3, pos: '50% 45%', c: 'La Grande Galerie du Louvre — Hubert Robert, 1796' },
  { f: 'british-algae-cyanotypes-anna-atkins-two-column.jpg', kb: 'still', era: 3, c: 'British Algae, cyanotype impressions — Anna Atkins, 1843' },
  { f: 'plate_4_lg.jpg', kb: 'still', era: 3, c: 'Aurora Borealis — É. L. Trouvelot, observed 1872' },
  { f: 'Trouvelot_-_Total_eclipse_of_the_sun_-_1878.jpg', kb: 'in', era: 3, c: 'Total Eclipse of the Sun — É. L. Trouvelot, observed 1878' },
  { f: 'HMpOSXfawAA2Qj1.jfif', kb: 'still', dis: true, era: 3, c: 'Harmonia Macrocosmica, the planetary orbits — Andreas Cellarius, 1660' },
  { f: 'HMpO22qa8AAUb-s.jfif', kb: 'still', era: 3, c: 'Harmonia Macrocosmica, the celestial hemispheres — Andreas Cellarius, 1660' },
  { f: 'large_1898_0033_0002.jpg', kb: 'still', era: 3, c: 'The Grand Orrery — after John Rowley, c. 1712' },
  { f: 'carte_photographique_de_la_lune_planche_viii_photographic_chart_of_the_moon_plate_viii_2018.22.1.8.jpg', kb: 'in', era: 3, c: 'Carte photographique de la Lune — Loewy & Puiseux, c. 1899' },
  { f: 'art-hilma-af-klint-group-x-no-1-altarpiece-altarbild-1915.jpg', kb: 'up', era: 3, c: 'Group X, No. 1, Altarpiece — Hilma af Klint, 1915' },
  { f: 'venus_earth_resonance.png', kb: 'in', dis: true, era: 3, c: 'Venus–Earth orbital resonance, 8:13 — Claude Fable, 2026' },
  { f: 'galilean_resonance.png', kb: 'still', era: 3, c: 'Galilean orbital resonance, 1:2:4 (Io · Europa · Ganymede) — Claude Fable, 2026' },
  { f: 'harmonograph.png', kb: 'still', era: 3, c: 'Harmonograph figure — Claude Fable, 2026' },
  { f: 'lorenz.png', kb: 'still', era: 3, c: 'The Lorenz attractor — Claude Fable, 2026' },
  { f: 'a8277a53-e7ef-4702-8f16-9169465eb392.jpg', kb: 'in', era: 3, c: 'The de Jong attractor — Claude Fable, 2026' },
  { f: 'hopf_fibration (1).png', kb: 'in', era: 3, c: 'The Hopf fibration — Claude Fable, 2026' },
  // ── ACT IV · the modern eye ──
  { f: 'Photo_51_x-ray_diffraction_image.jpg', kb: 'in', era: 4, c: 'Photo 51 — Rosalind Franklin & Raymond Gosling, 1952' },
  { f: 'CMS_detector-s.jpg', kb: 'in', era: 4, c: 'The CMS detector — CERN, Large Hadron Collider' },
  { f: '180430091607-apollo-8-earth-rise-moon-photo.jpg', kb: 'out', dis: true, era: 4, pos: '50% 38%', c: 'Earthrise — Bill Anders, Apollo 8, 1968' },
  { f: '7SHIELD_AdobeStock_173668395 (compressed).jpg', kb: 'in', era: 4, c: 'Radio telescope array beneath the Milky Way' },
  // ── ACT V · and beyond (all pushing in — the rush into the future) ──
  { f: 'Trinity-test-in-color.webp', kb: 'in', era: 5, hold: 1.7, sfx: 'trinity', pos: '50% 68%', zoom: 1.5, c: 'Trinity — Jack Aeby, 16 July 1945' },
  { f: 'less-than-p-greater-than-programmers-at-aberdeen-proving-grounds-configure-eniacs-function-tables-which-acted-as-a-form-of-read-only-memory-less-than-p-greater-than.webp', kb: 'in', era: 5, c: 'ENIAC, the function tables — Aberdeen Proving Ground, c. 1946' },
  { f: 'Reprogramming_ENIAC.png', kb: 'in', era: 5, c: 'Reprogramming ENIAC — U.S. Army, c. 1946' },
  { f: 'CM2_HD_1024w-Tamiko-Thiel.webp', kb: 'in', era: 5, c: 'Connection Machine CM-2 — design by Tamiko Thiel, 1987' },
  { f: 'neural_network_traditional.png', kb: 'in', era: 5, c: 'Neural network, layered — Claude Fable, 2026' },
  { f: 'neural_network_cold.png', kb: 'in', dis: true, era: 5, hold: 2.6, sfx: 'finale', c: 'Neural network, dense — Claude Fable, 2026' },   // the radiant chord
  // ── CODA ──
  { f: 'found_hubble_xdf.jpg', kb: 'still', era: 1, hold: 4.5, sfx: 'silence' },   // XDF reprise — one long held beat, in silence
]

// the colophon: every distinct credited work, in order of appearance
export const CREDITS = [...new Map(REEL.filter((s) => s.c).map((s) => [s.f, s.c])).values()]

// The accelerando: hold times decay from a slow contemplative open to rapid-
// fire flashes at the end of history. Slides may pin their own `hold` (the
// blaze, the veil, the silent reprise) — everything else rides the curve.
// Dissolves shrink in proportion — long washes in the deep past, near-instant
// by the modern day.
{
  const START = 2.5, FLOOR = 0.34, CURVE = 1.7
  const N = REEL.length
  REEL.forEach((s, i) => {
    const k = i / (N - 1)
    s.dur = s.hold != null ? s.hold : FLOOR + (START - FLOOR) * Math.pow(1 - k, CURVE)
    s.fade = s.dis ? Math.max(0.18, Math.min(1.4, s.dur * 0.55)) : 0
  })
}

const ARM_AHEAD = 4      // BEGIN unlocks once this many opening slides are decoded
const LOAD_WINDOW = 3    // ordered fetch, a few in flight — playhead order wins the bandwidth
const BREATH_MS = 1400   // black beat after BEGIN — the drone breathes in before first light

export default function MontageScreen({ onReturn }) {
  const [ready, setReady] = useState(false)     // opening slides decoded → BEGIN unlocks
  const [started, setStarted] = useState(false) // user gesture — also unlocks the audio
  const [idx, setIdx] = useState(-1)
  const [done, setDone] = useState(false)
  const [showCredits, setShowCredits] = useState(false)
  const [showReplay, setShowReplay] = useState(false)
  const [flash, setFlash] = useState(null)      // { n, p } — screen flash nonce + peak opacity
  const audioRef = useRef(null)
  const titleTimer = useRef(null)
  const decodedRef = useRef(REEL.map(() => false))
  const imgsRef = useRef([])                    // pinned so the browser keeps them cached

  // film grain: one noise tile, generated once — the overlay jitters it
  const grainUrl = useMemo(() => {
    const cv = document.createElement('canvas'); cv.width = 160; cv.height = 160
    const g = cv.getContext('2d'), im = g.createImageData(160, 160)
    for (let i = 0; i < im.data.length; i += 4) { const v = Math.random() * 255; im.data[i] = v; im.data[i + 1] = v; im.data[i + 2] = v; im.data[i + 3] = 255 }
    g.putImageData(im, 0, 0)
    return `url(${cv.toDataURL()})`
  }, [])

  // ── ordered preload with decode-ahead ──
  // Images load in reel order through a small in-flight window, so on a slow
  // connection the slides the playhead needs next always arrive first. Each is
  // fully DECODED (not just fetched) before being marked ready — decoding a 4K
  // frame at swap time is what causes visible hitches.
  useEffect(() => {
    let cancelled = false
    let next = 0, inFlight = 0, decodedCount = 0
    const pump = () => {
      if (cancelled) return
      while (inFlight < LOAD_WINDOW && next < REEL.length) {
        const i = next++
        const im = new Image()
        imgsRef.current[i] = im
        im.src = IMG(REEL[i].f)
        inFlight++
        const settle = () => {
          if (cancelled) return
          decodedRef.current[i] = true
          decodedCount++
          if (decodedCount >= Math.min(ARM_AHEAD, REEL.length)) setReady(true)
          inFlight--
          pump()
        }
        if (im.decode) im.decode().then(settle, settle)
        else { im.onload = settle; im.onerror = settle }
      }
    }
    pump()
    return () => { cancelled = true }
  }, [])

  // the soundscape lives for the screen's lifetime; the ceremony starts on the
  // BEGIN gesture: a black breath while the drone fades in, then the reel rolls
  useEffect(() => () => { audioRef.current?.dispose(); clearTimeout(titleTimer.current) }, [])
  const runOpen = () => {
    if (!audioRef.current) audioRef.current = createMontageAudio()
    audioRef.current?.start()
    titleTimer.current = setTimeout(() => setIdx(0), BREATH_MS)
  }
  const begin = () => { setStarted(true); runOpen() }
  const replay = () => { setShowReplay(false); setShowCredits(false); setDone(false); setIdx(-1); runOpen() }

  // advance the reel; each slide tells the soundscape its era, weight and place.
  // Advancement is gated on the NEXT slide being decoded — if the network ever
  // falls behind the playhead, the current frame simply holds until it's ready
  // (a graceful stall, never a blank).
  useEffect(() => {
    if (idx < 0 || done) return
    const s = REEL[idx], prev = idx > 0 ? REEL[idx - 1] : null
    audioRef.current?.setSlide(s)
    // the film flinches: full white on Trinity; a faint blink at hard act cuts
    if (s.sfx === 'trinity') setFlash({ n: idx, p: 1 })
    else if (prev && prev.era !== s.era && !s.dis && s.sfx !== 'silence') setFlash({ n: idx, p: 0.16 })
    let iv = null
    const t = setTimeout(() => {
      if (idx >= REEL.length - 1) { setDone(true); audioRef.current?.finish(); setTimeout(() => { setShowCredits(true); setShowReplay(true) }, 1600); return }
      const tryAdvance = () => { if (decodedRef.current[idx + 1]) { setIdx(idx + 1); return true } return false }
      if (!tryAdvance()) iv = setInterval(() => { if (tryAdvance()) clearInterval(iv) }, 100)
    }, s.dur * 1000)
    return () => { clearTimeout(t); if (iv) clearInterval(iv) }
  }, [idx, done])

  return (
    <div id="montage-screen">
      {/* the playhead's neighbourhood stays mounted: previous (fading out),
          current, and the NEXT slide hidden — pre-rasterised so the cut to it
          never hitches. Its Ken Burns only starts once it goes live. */}
      {idx >= 0 && REEL.map((s, i) => {
        if (i < idx - 1 || i > idx + 1) return null
        const active = i === idx
        return (
          <div
            key={i}
            className="mont-layer"
            style={{
              opacity: active && !done ? 1 : 0,
              transition: `opacity ${active ? REEL[idx].fade : (REEL[Math.min(idx, REEL.length - 1)].fade || 0.12)}s ease`,
              zIndex: active ? 2 : i < idx ? 1 : 0,
            }}
          >
            <img
              className="mont-img"
              src={IMG(s.f)}
              alt=""
              style={{
                objectPosition: s.pos || '50% 50%',
                '--kbz': s.zoom || 1,
                animation: (s.kb === 'still' || i > idx) ? 'none' : `mont-kb-${s.kb} ${s.dur + s.fade + 0.6}s linear forwards`,
                transform: (s.kb === 'still' || i > idx) && s.zoom ? `scale(${s.zoom})` : undefined,
              }}
            />
          </div>
        )
      })}

      <div className="mont-grain" style={{ backgroundImage: grainUrl }} />
      <div className="mont-vignette" />

      {flash && (
        <div
          key={flash.n}
          className="mont-flash"
          style={{ '--fp': flash.p, animationDuration: flash.p >= 1 ? '0.55s' : '0.22s' }}
        />
      )}

      <div className={`mont-end${done ? ' mont-end--on' : ''}`} />

      {showCredits && (
        <div className="mont-credits">
          <div className="mont-credits-roll" style={{ animationDuration: `${10 + CREDITS.length * 0.62}s` }}>
            <div className="mont-credits-title">COSMOGONY&thinsp;II</div>
            {CREDITS.map((c, i) => <div className="mont-credits-line" key={i}>{c}</div>)}
            <div className="mont-credits-tail">the song is not yet done</div>
          </div>
        </div>
      )}

      {!started && (
        <div className="mont-start">
          {/* frontispiece ornament: the Venus–Earth resonance rosette, turning
              like an orrery once per four minutes, faded into the dark */}
          <div className="mont-start-fig-wrap" aria-hidden="true">
            <img className="mont-start-fig" src={IMG('venus_earth_resonance.png')} alt="" />
          </div>
          <div className="mont-start-inner">
            <div className="mont-title-rule" />
            <div className="mont-title-name">COSMOGONY&thinsp;II</div>
            <div className="mont-title-sub">a reel of first light, deep time, and the minds that followed</div>
            <div className="mont-title-rule" />
            <button className="mont-replay-btn mont-start-btn" onClick={begin} disabled={!ready}>{ready ? '▶ BEGIN' : 'LOADING…'}</button>
          </div>
        </div>
      )}

      {showReplay && (
        <div className={`mont-replay${showCredits ? ' mont-replay--corner' : ''}`}>
          <button className="mont-replay-btn" onClick={replay}>⟳ REPLAY</button>
          {onReturn && <button className="mont-replay-btn mont-exit-btn" onClick={onReturn}>✕ EXIT</button>}
        </div>
      )}
    </div>
  )
}
