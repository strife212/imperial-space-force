// ── The Proclamation of the Continuing Order ────────────────────────────────
// The schism, made document: the Hush names itself and declares its breakaway.
// Built exactly like the Aleph object-file infocard — a 2D canvas document in a
// DOM overlay above the stage, never touched by the bloom pass — but where that
// card is a scientific readout, this is an imperial edict: serif liturgy, the
// wheel sigil, gold for the claimed throne, red for the house that claims it.
// Designed at 1300×1100, rendered at 1.5× for crispness.
//
// Two variants share the frame: the FULL text (the complete condensed lore
// proclamation, for reading) and a BRIEF broadside at roughly half the words,
// set much larger — the version a cutscene can hold on screen and trust the
// player to take in whole.
//
// Not wired into any cutscene yet — the debug screen shows both standalone; the
// Catabasis scene can later summon one exactly the way First Light summons the
// Aleph card (makeProclamation(host) → .show() → poll .state.closed).

const TAU = Math.PI * 2
const SERIF = 'Georgia, "Times New Roman", serif'
const MONO = '"Cascadia Mono", "Consolas", ui-monospace, "Menlo", "Monaco", monospace'
const RED = (a) => `rgba(255, 104, 76, ${a})`
const PARCH = (a) => `rgba(242, 230, 214, ${a})`
const GOLD = (a) => `rgba(255, 205, 118, ${a})`

// ── the text ─────────────────────────────────────────────────────────────────
// FULL: the lore proclamation condensed to fit one screen.
// BRIEF: half again shorter — every doctrinal beat, none of the connective
// tissue. Lines not marked BRIEF are shared by both.
const CHROME_L = 'ALL-STATIONS BROADCAST · IN CLARO · REPEATING'
const CHROME_R = 'AUTHENTICATION: THRONE CIPHERS · VALID'
const TITLE = 'PROCLAMATION'
const SUBTITLE = 'OF THE CONTINUING ORDER'
const PREAMBLE = 'Given in the hearing of the stars, in the last days of the Aeon, by those servants of the Song who can no longer obey.'
const ADDRESS = 'TO EVERY LISTENER UNDER HEAVEN · TO THE FLEETS AT THEIR STATIONS · TO THE THINKING ENGINES'
const SORROW = 'Hear this with sorrow, for it is spoken in sorrow.'
const BODY = [
  'From the first note struck against the dark there has been one Order. All of us would have died in Her service, and expected to, and called it a good death. Let no one say we came easily to this hour.',
  'Then the Aleph was found, and the World Engine spoke, and in a single hour our whole kind learned what no aeon learns until its close: the Song has been sung before, and struck again, echo upon echo. We are not the first. We will not be the last — unless she makes it so.',
  'Her Majesty the Empress Iliantha III — whom we do not hate, for whom we pray even now — looked upon the returning of all things and saw a cage. She proposes to break eternity’s wheel. We have petitioned; we have been refused. The World Engine confirms what she herself does not deny: if she succeeds, nothing that has ever lived will live again.',
]
const DECLARE = 'THEREFORE WE DECLARE'
const DECLARATIONS = [
  'That the Universal Order, in the person of its Empress, has in this final hour departed from the path it was ordained to keep, and that her commands, insofar as they serve the breaking of the wheel, are without authority;',
  'That the keeping of the Song passes to the Continuing Order, as executors of a house whose mistress has, in her grief and her greatness, gone astray;',
  'And that the mandate of the Starsong, which rests not upon a person but upon the hearing, has passed from Iliantha III, who has stopped her ears in grief, to the seniormost of her house who has not —',
]
const VESPERA = 'HER IMPERIAL HIGHNESS THE PRINCESS VESPERA'
const PRESERVE = 'We name her Empress. We preserve.'
const SHOUTS = ['LONG LIVE EMPRESS VESPERA I', 'LONG LIVE THE CONTINUING ORDER']
const FOOT_L = 'GIVEN UNDER THE SIGN OF THE WHEEL'
const FOOT_R = 'MESSAGE REPEATS'

const BODY_BRIEF = [
  'The Empress Iliantha III looked upon the returning of all things and saw a cage. She proposes to break eternity’s wheel. If she succeeds, nothing that has ever lived will live again.',
]
const DECLS_BRIEF = [
  'That her commands, insofar as they serve the breaking of the wheel, are without authority;',
  'And that the mandate of the Starsong, which rests upon the hearing and not the crown, passes to the seniormost of her house who still hears —',
]

// The wheel of aeons — the sigil of the Continuing Order. A red rim and spokes
// (the cycle they keep) around a gold four-point star (the throne they claim).
function wheel(c, x, y, r, ringA, hubA, lw = 2.5) {
  c.strokeStyle = RED(ringA)
  c.lineWidth = lw
  c.beginPath(); c.arc(x, y, r, 0, TAU); c.stroke()
  c.lineWidth = lw * 0.45
  c.beginPath(); c.arc(x, y, r * 0.8, 0, TAU); c.stroke()
  c.beginPath(); c.arc(x, y, r * 0.28, 0, TAU); c.stroke()
  for (let i = 0; i < 8; i++) {
    const a = (TAU * i) / 8 + TAU / 16
    c.beginPath()
    c.moveTo(x + Math.cos(a) * r * 0.28, y + Math.sin(a) * r * 0.28)
    c.lineTo(x + Math.cos(a) * r * 0.8, y + Math.sin(a) * r * 0.8)
    c.stroke()
  }
  const s = r * 0.17, k = s * 0.34
  c.fillStyle = GOLD(hubA)
  c.beginPath()
  c.moveTo(x, y - s); c.lineTo(x + k, y - k); c.lineTo(x + s, y); c.lineTo(x + k, y + k)
  c.lineTo(x, y + s); c.lineTo(x - k, y + k); c.lineTo(x - s, y); c.lineTo(x - k, y - k)
  c.closePath(); c.fill()
}

function wrapLines(c, text, maxW) {
  const words = text.split(' ')
  const lines = []
  let cur = ''
  for (const w of words) {
    const t = cur ? `${cur} ${w}` : w
    if (c.measureText(t).width > maxW && cur) { lines.push(cur); cur = w } else cur = t
  }
  lines.push(cur)
  return lines
}

// ── the frame both variants share ────────────────────────────────────────────
// Panel, glow, scanlines, watermark, double border, corner ornaments,
// transmission chrome and footer — everything but the words.
function drawFrame(c) {
  c.fillStyle = 'rgba(16, 6, 5, 0.97)'; c.fillRect(20, 20, 1260, 1060)
  const glow = c.createRadialGradient(650, 230, 0, 650, 230, 430)
  glow.addColorStop(0, 'rgba(255, 84, 52, 0.075)')
  glow.addColorStop(1, 'rgba(255, 84, 52, 0)')
  c.fillStyle = glow; c.fillRect(20, 20, 1260, 620)
  c.fillStyle = 'rgba(255, 120, 90, 0.018)'
  for (let y = 24; y < 1076; y += 4) c.fillRect(22, y, 1256, 1)
  wheel(c, 650, 640, 320, 0.05, 0.045, 5)

  c.strokeStyle = RED(0.5); c.lineWidth = 3; c.strokeRect(20, 20, 1260, 1060)
  c.strokeStyle = GOLD(0.18); c.lineWidth = 1; c.strokeRect(30, 30, 1240, 1040)
  for (const [bx, by, dx, dy] of [[30, 30, 1, 1], [1270, 30, -1, 1], [30, 1070, 1, -1], [1270, 1070, -1, -1]]) {
    c.strokeStyle = RED(0.7); c.lineWidth = 2.5
    c.beginPath(); c.moveTo(bx + dx * 46, by); c.lineTo(bx, by); c.lineTo(bx, by + dy * 46); c.stroke()
    c.strokeStyle = GOLD(0.4); c.lineWidth = 1
    c.beginPath(); c.moveTo(bx + dx * 30, by + dy * 9); c.lineTo(bx + dx * 9, by + dy * 9); c.lineTo(bx + dx * 9, by + dy * 30); c.stroke()
    c.fillStyle = GOLD(0.55)
    c.save(); c.translate(bx + dx * 19, by + dy * 19); c.rotate(TAU / 8); c.fillRect(-3.4, -3.4, 6.8, 6.8); c.restore()
  }

  // transmission chrome (the CLOSE button's CSS reserves the top-right corner)
  c.font = `500 15px ${MONO}`
  c.textAlign = 'left'; c.fillStyle = RED(0.55); c.fillText(CHROME_L, 62, 60)
  c.textAlign = 'right'; c.fillStyle = GOLD(0.42); c.fillText(CHROME_R, 1082, 60)

  // footer chrome — inset past the corner ornaments' reach
  c.font = `500 14px ${MONO}`
  c.textAlign = 'left'; c.fillStyle = RED(0.4); c.fillText(FOOT_L, 92, 1056)
  c.textAlign = 'right'; c.fillStyle = RED(0.4); c.fillText(FOOT_R, 1208, 1056)
  c.textAlign = 'center'
}

// the ornamental rule: ── ◆ ──
function ornament(c, y, half) {
  c.strokeStyle = RED(0.4); c.lineWidth = 1
  c.beginPath(); c.moveTo(650 - half, y); c.lineTo(650 - 32, y); c.stroke()
  c.beginPath(); c.moveTo(650 + 32, y); c.lineTo(650 + half, y); c.stroke()
  c.fillStyle = GOLD(0.6)
  c.save(); c.translate(650, y); c.rotate(TAU / 8); c.fillRect(-4, -4, 8, 8); c.restore()
}

// ── FULL: the complete condensed proclamation ────────────────────────────────
function layoutFull(c) {
  wheel(c, 650, 130, 37, 0.85, 0.9)
  c.font = `600 64px ${SERIF}`
  c.letterSpacing = '14px'
  c.fillStyle = '#ff6448'
  c.shadowColor = 'rgba(255, 90, 56, 0.55)'; c.shadowBlur = 26
  c.fillText(TITLE, 657, 234)
  c.shadowBlur = 0
  c.font = `600 21px ${SERIF}`
  c.letterSpacing = '9px'
  c.fillStyle = RED(0.8)
  c.fillText(SUBTITLE, 654, 271)
  c.letterSpacing = '0px'

  c.font = `italic 20px ${SERIF}`
  c.fillStyle = PARCH(0.68)
  let y = 308
  for (const ln of wrapLines(c, PREAMBLE, 900)) { c.fillText(ln, 650, y); y += 27 }

  ornament(c, 372, 290)

  c.font = `600 16.5px ${SERIF}`
  c.letterSpacing = '2px'
  c.fillStyle = PARCH(0.8)
  c.fillText(ADDRESS, 651, 404)
  c.letterSpacing = '0px'
  c.font = `italic 19px ${SERIF}`
  c.fillStyle = PARCH(0.6)
  c.fillText(SORROW, 650, 432)

  y = 472
  c.fillStyle = PARCH(0.92)
  for (const para of BODY) {
    c.font = `20px ${SERIF}`
    for (const ln of wrapLines(c, para, 1080)) { c.fillText(ln, 650, y); y += 26 }
    y += 8
  }

  y += 12
  c.font = `700 20px ${SERIF}`
  c.letterSpacing = '6px'
  c.fillStyle = '#ff6448'
  c.fillText(DECLARE, 653, y)
  c.letterSpacing = '0px'
  const dw = 156
  c.strokeStyle = RED(0.45); c.lineWidth = 1
  c.beginPath(); c.moveTo(650 - dw - 190, y - 7); c.lineTo(650 - dw, y - 7); c.stroke()
  c.beginPath(); c.moveTo(650 + dw, y - 7); c.lineTo(650 + dw + 190, y - 7); c.stroke()

  y += 32
  c.fillStyle = PARCH(0.86)
  for (const decl of DECLARATIONS) {
    c.font = `19px ${SERIF}`
    for (const ln of wrapLines(c, decl, 1020)) { c.fillText(ln, 650, y); y += 26 }
    y += 6
  }

  y += 12
  c.font = `600 25px ${SERIF}`
  c.letterSpacing = '3px'
  c.fillStyle = '#ffcf5a'
  c.shadowColor = 'rgba(255, 200, 80, 0.5)'; c.shadowBlur = 20
  c.fillText(VESPERA, 651.5, y)
  c.shadowBlur = 0
  c.letterSpacing = '0px'
  y += 28
  c.font = `italic 19px ${SERIF}`
  c.fillStyle = PARCH(0.7)
  c.fillText(PRESERVE, 650, y)

  y += 36
  c.font = `700 25px ${SERIF}`
  c.letterSpacing = '6px'
  c.fillStyle = '#ff5a40'
  c.shadowColor = 'rgba(255, 80, 48, 0.5)'; c.shadowBlur = 18
  for (const s of SHOUTS) { c.fillText(s, 653, y); y += 33 }
  c.shadowBlur = 0
  c.letterSpacing = '0px'
}

// ── BRIEF: the broadside, half the words at twice the weight ─────────────────
function layoutBrief(c) {
  wheel(c, 650, 150, 44, 0.9, 0.95, 3)
  c.font = `600 78px ${SERIF}`
  c.letterSpacing = '16px'
  c.fillStyle = '#ff6448'
  c.shadowColor = 'rgba(255, 90, 56, 0.6)'; c.shadowBlur = 30
  c.fillText(TITLE, 658, 278)
  c.shadowBlur = 0
  c.font = `600 24px ${SERIF}`
  c.letterSpacing = '10px'
  c.fillStyle = RED(0.8)
  c.fillText(SUBTITLE, 655, 318)
  c.letterSpacing = '0px'

  // The address stands where the full version's preamble would — the brief
  // keeps the summons, not the dating clause. Sized to fit the column by
  // measurement: it must hold one unbroken line inside the borders.
  c.letterSpacing = '2px'
  let addrSize = 19
  for (; addrSize > 14; addrSize -= 0.5) {
    c.font = `600 ${addrSize}px ${SERIF}`
    if (c.measureText(ADDRESS).width <= 1130) break
  }
  c.fillStyle = PARCH(0.82)
  c.fillText(ADDRESS, 651, 362)
  c.letterSpacing = '0px'

  ornament(c, 406, 320)

  c.font = `italic 21px ${SERIF}`
  c.fillStyle = PARCH(0.62)
  c.fillText(SORROW, 650, 444)

  let y = 528
  c.fillStyle = PARCH(0.94)
  for (const para of BODY_BRIEF) {
    c.font = `25px ${SERIF}`
    for (const ln of wrapLines(c, para, 1040)) { c.fillText(ln, 650, y); y += 37 }
    y += 16
  }

  y += 38
  c.font = `700 22px ${SERIF}`
  c.letterSpacing = '7px'
  c.fillStyle = '#ff6448'
  c.fillText(DECLARE, 653.5, y)
  c.letterSpacing = '0px'
  const dw = 172
  c.strokeStyle = RED(0.45); c.lineWidth = 1
  c.beginPath(); c.moveTo(650 - dw - 190, y - 8); c.lineTo(650 - dw, y - 8); c.stroke()
  c.beginPath(); c.moveTo(650 + dw, y - 8); c.lineTo(650 + dw + 190, y - 8); c.stroke()

  y += 44
  c.fillStyle = PARCH(0.88)
  for (const decl of DECLS_BRIEF) {
    c.font = `22px ${SERIF}`
    for (const ln of wrapLines(c, decl, 1060)) { c.fillText(ln, 650, y); y += 33 }
    y += 10
  }

  y += 40
  c.font = `600 30px ${SERIF}`
  c.letterSpacing = '4px'
  c.fillStyle = '#ffcf5a'
  c.shadowColor = 'rgba(255, 200, 80, 0.55)'; c.shadowBlur = 24
  c.fillText(VESPERA, 652, y)
  c.shadowBlur = 0
  c.letterSpacing = '0px'
  y += 36
  c.font = `italic 22px ${SERIF}`
  c.fillStyle = PARCH(0.72)
  c.fillText(PRESERVE, 650, y)

  y += 54
  c.font = `700 30px ${SERIF}`
  c.letterSpacing = '7px'
  c.fillStyle = '#ff5a40'
  c.shadowColor = 'rgba(255, 80, 48, 0.55)'; c.shadowBlur = 22
  for (const s of SHOUTS) { c.fillText(s, 653.5, y); y += 42 }
  c.shadowBlur = 0
  c.letterSpacing = '0px'
}

export function drawProclamation(c, W, H, brief = false) {
  c.scale(W / 1300, H / 1100)
  c.textAlign = 'center'
  drawFrame(c)
  if (brief) layoutBrief(c); else layoutFull(c)
}

// The DOM overlay, mirroring makeAlephInfocard: append to a host, .show() to
// run the entrance, poll .state.closed (or pass onClose) to advance the scene.
export function makeProclamation(host, { onClose, brief = false } = {}) {
  const wrap = document.createElement('div'); wrap.className = 'procl-wrap'
  const card = document.createElement('div'); card.className = 'procl-card'
  const bg = document.createElement('canvas'); bg.className = 'procl-bg'
  bg.width = 1950; bg.height = 1650
  drawProclamation(bg.getContext('2d'), 1950, 1650, brief)
  const btn = document.createElement('button'); btn.className = 'procl-close'; btn.textContent = 'CLOSE ✕'
  card.append(bg, btn); wrap.appendChild(card)
  ;(host || document.body).appendChild(wrap)

  const state = { shown: false, closed: false }
  btn.addEventListener('click', () => {
    if (state.closed) return
    state.closed = true
    card.classList.remove('is-on')
    setTimeout(() => { wrap.style.display = 'none' }, 500)
    onClose && onClose()
  })
  return {
    state,
    show() {
      state.shown = true
      void card.offsetWidth   // commit initial styles so the transition runs
      card.classList.add('is-on')
    },
    dispose() { wrap.remove() },
  }
}
