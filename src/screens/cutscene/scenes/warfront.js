import * as THREE from 'three'
import { TEAMS } from '../../battle/constants'
import { buildBlueModel, buildRedModel, makeGasGiant, makeShield } from '../../battle/geometry'
import { buildFleet } from '../actors'
import { asteroidField } from '../models'

// The first true fleet engagement in a generation, in two movements:
//   A. the imperial line cruising its patrol lane — until the long-range sweep
//      paints a wall of uncatalogued contacts and the scope screams;
//   B. the reveal and the release — the Discord ignites out of the dark and
//      closes, the batteries answer, and the lines slug it out on a 45° axis
//      under a gas giant hanging in the sky.
const ASTRAIA = 'Princess Astraia'
const LINE_SCAN    = 'Scanning for signs of enemy...'
const LINE_CONTACT = 'Contact!'
const LINE_NOWHERE = 'They came out of nowhere — just like the Cassiopeia reported.'
const LINE_FIRE    = 'All batteries, open fire. For the Universal Order!'

// timeline (scene seconds)
const RADAR_ON = 5.0, CONTACT_T = 7.5, RADAR_OFF = 11.8   // the sweep paints the wall on its 2nd east pass, ≈7.6, and re-pings it every pass after
const REVEAL_T = 11.9, OPEN_FIRE = 17.2   // the wall holds fully lit a beat longer, so "they came out of nowhere" can land before the order
const END_T = 30.0
const MONO = '"Cascadia Mono", "Consolas", ui-monospace, "Menlo", "Monaco", monospace'
const TAU = Math.PI * 2

// ── The long-range tactical scope ────────────────────────────────────────────
// A DOM overlay in the First Light infocard's mould: above the bloom composer,
// mounted beside the comms box, drawn with the 2D canvas API. Own-fleet
// chevrons ride the IFF net (steady); hostiles exist only where the rotating
// sweep has painted them — so the wall of red lands as one pass of the beam,
// announced by the low hostile-return ping.
function makeContactRadar({ track, sfx }, blues) {
  const wrap = document.createElement('div'); wrap.className = 'wf-radar-wrap'
  const panel = document.createElement('div'); panel.className = 'wf-radar'
  const cv = document.createElement('canvas'); cv.width = 940; cv.height = 940
  panel.appendChild(cv); wrap.appendChild(panel)
  const host = document.querySelector('#cutscene-screen .sb-stage') || document.body
  host.appendChild(wrap)
  const c = cv.getContext('2d')

  const ROT = TAU / 2.2, CX = 470, CY = 520, R = 380
  // the hostile wall: ranks deep off the eastern rim — some returns sit beyond
  // the display ceiling entirely (the feed calls this out)
  const reds = []
  for (let i = 0; i < 56; i++) reds.push({
    x: 0.72 + Math.random() * 0.36,
    z: (Math.random() - 0.5) * 0.9,
    big: i < 7, paint: -1,
  })
  const st = { on: false, T: 0, prevA: -Math.PI / 2 - 1e-4, contactAt: Infinity, alarmed: false, alarmCd: 0, lastPing: -Infinity, off: false, offT: 0, done: false }

  const tri = (x, y, ang, s, fill) => {
    c.save(); c.translate(x, y); c.rotate(ang)
    c.beginPath(); c.moveTo(s, 0); c.lineTo(-s * 0.8, s * 0.62); c.lineTo(-s * 0.8, -s * 0.62); c.closePath()
    c.fillStyle = fill; c.fill(); c.restore()
  }

  const fmtT = (t) => `T+${Math.floor(t / 60)}:${String(Math.floor(Math.max(0, t)) % 60).padStart(2, '0')}`
  const draw = (A) => {
    const ink = (a) => `rgba(150,214,255,${a})`
    const hot = (a) => `rgba(255,110,80,${a})`
    let painted = 0
    for (const r of reds) if (r.paint >= 0) painted++
    const hostileN = painted >= 50 ? '50+' : String(painted)

    c.clearRect(0, 0, 940, 940)
    c.fillStyle = 'rgba(4, 11, 22, 0.92)'; c.fillRect(0, 0, 940, 940)
    // corner brackets — the instrument's chassis, running hot with the alarm
    c.strokeStyle = st.alarmed ? hot(0.5) : ink(0.35); c.lineWidth = 2
    for (const [bx, by, dx, dy] of [[12, 12, 1, 1], [928, 12, -1, 1], [12, 928, 1, -1], [928, 928, -1, -1]]) {
      c.beginPath(); c.moveTo(bx + dx * 34, by); c.lineTo(bx, by); c.lineTo(bx, by + dy * 34); c.stroke()
    }
    // header: title left, mission clock + sweep counter right
    c.font = `500 25px ${MONO}`; c.fillStyle = ink(0.85)
    c.fillText('LONG-RANGE TACTICAL SWEEP', 34, 50)
    c.textAlign = 'right'
    c.font = `500 19px ${MONO}`; c.fillStyle = ink(0.5)
    c.fillText(`${fmtT(RADAR_ON + st.T)} · SWP ${String(Math.floor((A + Math.PI / 2) / TAU) + 1).padStart(3, '0')}`, 906, 50)
    c.textAlign = 'left'
    c.strokeStyle = 'rgba(120,190,255,0.28)'; c.lineWidth = 1
    c.beginPath(); c.moveTo(34, 72); c.lineTo(906, 72); c.stroke()
    // left column: array configuration
    c.font = `500 16px ${MONO}`
    ;[['MODE', 'X-BAND ACT'], ['PRF', '1.42 kHz'], ['ANT', '27 RPM'], ['GAIN', 'AUTO +6 dB'], ['IFF', 'CONCORD NET']].forEach(([k, v], i) => {
      c.fillStyle = ink(0.35); c.fillText(k, 34, 106 + i * 22)
      c.fillStyle = ink(0.7); c.fillText(v, 108, 106 + i * 22)
    })
    // right column: the track ledger — flips hostile the moment the wall paints
    c.textAlign = 'right'
    const ledger = st.alarmed
      ? [['TRACKS', `${blues.length} ALLIED`, 0], ['HOSTILE', hostileN, 1], ['XPDR', 'SILENT', 1], ['DRIVE SIG', 'NONE', 1], ['THREAT', 'CAPITAL', 1]]
      : [['TRACKS', `${blues.length} ALLIED`, 0], ['HOSTILE', '0', 0], ['XPDR', 'ALL GREEN', 0]]
    ledger.forEach(([k, v, bad], i) => {
      c.fillStyle = bad ? hot(0.45) : ink(0.35); c.fillText(k, 810, 106 + i * 22)
      c.fillStyle = bad ? hot(0.9) : ink(0.7); c.fillText(v, 906, 106 + i * 22)
    })
    c.textAlign = 'left'

    // scope face
    c.save()
    c.beginPath(); c.arc(CX, CY, R, 0, TAU); c.clip()
    c.fillStyle = 'rgba(6, 16, 30, 0.9)'; c.fillRect(CX - R, CY - R, R * 2, R * 2)
    c.strokeStyle = 'rgba(90,160,220,0.2)'; c.lineWidth = 1
    for (const k of [0.25, 0.5, 0.75, 1]) { c.beginPath(); c.arc(CX, CY, R * k, 0, TAU); c.stroke() }
    for (let i = 0; i < 12; i++) {
      const a = (i * TAU) / 12
      c.beginPath(); c.moveTo(CX, CY); c.lineTo(CX + Math.cos(a) * R, CY + Math.sin(a) * R); c.stroke()
    }
    // range labels stepping up the north spoke
    c.font = `500 15px ${MONO}`; c.fillStyle = ink(0.32)
    for (const [k, lab] of [[0.25, '60'], [0.5, '120'], [0.75, '180 Mm']]) c.fillText(lab, CX + 8, CY - R * k + 18)
    // static speckle + stray interference — a live instrument, not a picture of one
    c.fillStyle = 'rgba(140,220,255,0.06)'
    for (let i = 0; i < 30; i++) {
      const a = Math.random() * TAU, r = Math.sqrt(Math.random()) * R
      c.fillRect(CX + Math.cos(a) * r, CY + Math.sin(a) * r, 2, 2)
    }
    if (Math.random() < 0.08) {
      c.fillStyle = 'rgba(140,220,255,0.05)'
      c.fillRect(CX - R, CY - R + Math.random() * R * 2, R * 2, 1.5)
    }
    // the sweep — a trailing wedge of slices, brightest at the leading edge
    for (let i = 0; i < 26; i++) {
      const a1 = A - i * 0.05
      c.fillStyle = `rgba(120,210,255,${0.15 * (1 - i / 26)})`
      c.beginPath(); c.moveTo(CX, CY); c.arc(CX, CY, R, a1 - 0.052, a1); c.closePath(); c.fill()
    }
    c.strokeStyle = 'rgba(190,240,255,0.7)'; c.lineWidth = 2
    c.beginPath(); c.moveTo(CX, CY); c.lineTo(CX + Math.cos(A) * R, CY + Math.sin(A) * R); c.stroke()

    // hostiles: painted by the sweep, decaying until the next pass
    for (const r of reds) {
      if (r.paint < 0) continue
      const al = Math.max(0, 1 - (st.T - r.paint) / 3.0)   // fades between passes, refreshed by each
      if (al <= 0) continue
      const x = CX + r.x * R, y = CY + r.z * R
      if (r.big) {
        tri(x, y, Math.PI, 17, `rgba(255,122,90,${al * 0.3})`)
        // track vector: the heavies are making way, straight at the fleet
        c.strokeStyle = `rgba(255,122,90,${al * 0.6})`; c.lineWidth = 2
        c.beginPath(); c.moveTo(x - 16, y); c.lineTo(x - 38, y); c.stroke()
      }
      tri(x, y, Math.PI, r.big ? 13 : 9, `rgba(255,122,90,${al})`)
    }
    // own fleet: steady chevrons on the datalink, heading 090
    for (const b of blues) {
      const x = CX + (-0.4 + (b.x + 6) * 0.0045) * R, y = CY + (0.06 + b.z * 0.0045) * R
      tri(x, y, 0, b.big ? 16 : 9, 'rgba(159,214,255,0.28)')
      tri(x, y, 0, b.big ? 12 : 7, 'rgba(159,214,255,0.95)')
      if (b.big) {
        c.strokeStyle = 'rgba(159,214,255,0.5)'; c.lineWidth = 1.5
        c.beginPath(); c.arc(x, y, 22, 0, TAU); c.stroke()
        c.textAlign = 'center'
        c.font = `500 15px ${MONO}`; c.fillStyle = 'rgba(159,214,255,0.45)'
        c.fillText('CONCORD', x, y + 44)
        c.textAlign = 'left'
      }
    }
    c.restore()

    // bezel, graduation ticks + bearings
    c.strokeStyle = 'rgba(140,210,255,0.5)'; c.lineWidth = 2
    c.beginPath(); c.arc(CX, CY, R, 0, TAU); c.stroke()
    c.lineWidth = 1.5
    for (let i = 0; i < 72; i++) {
      const a = (i * TAU) / 72, major = i % 6 === 0
      c.strokeStyle = ink(major ? 0.45 : 0.2)
      c.beginPath()
      c.moveTo(CX + Math.cos(a) * (R + 2), CY + Math.sin(a) * (R + 2))
      c.lineTo(CX + Math.cos(a) * (R + 2 + (major ? 11 : 5)), CY + Math.sin(a) * (R + 2 + (major ? 11 : 5)))
      c.stroke()
    }
    c.font = `500 17px ${MONO}`; c.fillStyle = ink(0.5)
    c.fillText('000', CX - 14, CY - R + 30)
    c.fillText('090', CX + R - 48, CY + 6)
    c.fillText('180', CX - 14, CY + R - 16)
    c.fillText('270', CX - R + 14, CY + 6)
    c.textAlign = 'center'
    c.font = `500 15px ${MONO}`; c.fillStyle = ink(0.3)
    for (const [brg, a] of [['045', -Math.PI / 4], ['135', Math.PI / 4], ['225', Math.PI * 0.75], ['315', -Math.PI * 0.75]]) {
      c.fillText(brg, CX + Math.cos(a) * (R - 36), CY + Math.sin(a) * (R - 36) + 5)
    }
    c.textAlign = 'left'

    // status line — the array stamp yields the row once the alarm banner owns it
    if (!st.alarmed) {
      c.textAlign = 'right'
      c.font = `500 15px ${MONO}`; c.fillStyle = ink(0.28)
      c.fillText('ARRAY SPECULA-VII · MK XI', 906, 926)
      c.textAlign = 'left'
      c.font = `500 22px ${MONO}`; c.fillStyle = ink(0.6)
      c.fillText('SWEEP NOMINAL · HOSTILE CONTACTS: 0', 34, 926)
    } else if (Math.sin(st.T * 9) > -0.25) {
      c.font = `700 26px ${MONO}`; c.fillStyle = 'rgba(255,96,66,0.95)'
      c.fillText(`MASS CONTACT · BRG 090 · COUNT ${hostileN} · CLOSING`, 34, 927)
    }
  }

  track({ dispose: () => wrap.remove() })
  return {
    show() { st.on = true; void panel.offsetWidth; panel.classList.add('is-on'); sfx?.blip(880, 0.14, 0.3) },
    contact() { st.contactAt = st.T },
    off() { st.off = true; st.offT = 0; panel.classList.remove('is-on'); panel.classList.add('is-off'); sfx?.blip(240, 0.2, 0.4) },
    tick(dt) {
      if (!st.on || st.done) return
      if (st.off) { st.offT += dt; if (st.offT > 0.6) { st.done = true; wrap.style.display = 'none' } return }
      const prevA = st.prevA
      st.T += dt
      const A = -Math.PI / 2 + ROT * st.T
      st.prevA = A
      if (st.T >= st.contactAt) {
        for (const r of reds) {
          if (r.paint >= 0) r.x -= 0.014 * dt   // painted returns creep closer
          const phi = ((Math.atan2(r.z, r.x) % TAU) + TAU) % TAU
          if (Math.floor((A - phi) / TAU) > Math.floor((prevA - phi) / TAU)) {
            r.paint = st.T   // a fresh return every pass
            if (st.T - st.lastPing > 0.9) {   // one hostile ping per beam pass, not one per contact
              st.lastPing = st.T
              sfx?.ping(640, st.alarmed ? 0.45 : 0.6)
              if (!st.alarmed) { st.alarmed = true; panel.classList.add('is-alarm') }
            }
          }
        }
      }
      if (st.alarmed) { st.alarmCd -= dt; if (st.alarmCd <= 0) { sfx?.blip(452, 0.2, 0.28); st.alarmCd = 0.62 } }
      // one soft ping per revolution, as the beam crosses due north
      if (Math.floor((A + Math.PI / 2) / TAU) > Math.floor((prevA + Math.PI / 2) / TAU)) sfx?.ping(1240, 0.14)
      draw(A)
    },
  }
}

export default {
  label: 'CUTSCENE / ANTITHESIS',
  establishing: { name: 'ANTITHESIS', sub: 'The Warfront · The First Fleet Engagement in a Generation', stamp: 'TAC-SIM LIVE · DEFCON-2 IN EFFECT' },
  feed: [
    { t: 1.0,  level: 'info', text: 'Patrol lane P-9 · convoy formation · drives at cruise' },
    { t: 5.4,  level: 'info', text: 'Long-range sweep active · IFF net nominal' },
    { t: 8.0,  level: 'crit', text: 'MASS CONTACT · bearing 090 · uncatalogued hulls' },
    { t: 10.2, level: 'crit', text: 'Count exceeds display ceiling · closing at combat velocity' },
    { t: 12.8, level: 'warn', text: 'Firing solutions degraded · Schwarzschild correction unstable' },
    { t: 14.5, level: 'info', text: 'All batteries release · doctrine: ATTRITION' },
    { t: 18.0, level: 'warn', text: 'Losses within projection · line holding' },
    { t: 23.2, level: 'crit', text: 'Line integrity 71% · the Discord does not parade' },
  ],
  readout: {
    id: 'Fire Control · HMSS',
    rows: [
      { label: 'Solutions', value: (t) => (t < OPEN_FIRE ? 'HOLD' : `${120 + Math.floor(58 * Math.abs(Math.sin(t * 0.9)))}/s`) },
      { label: 'Line',      value: (t) => `${Math.max(71, 100 - Math.floor(Math.max(0, t - OPEN_FIRE) * 2.3))}%` },
      { label: 'Doctrine',  value: (t) => (t < OPEN_FIRE ? 'PATROL' : 'ATTRITION') },
    ],
  },
  bloom: 0.7,
  create(ctx) {
    const { scene, camera, fx, sfx, comms, end, orient } = ctx
    const blue = buildFleet(ctx, { team: 'blue', fighters: 28, bombers: 10, cruisers: 4 })
    const red  = buildFleet(ctx, { team: 'red',  fighters: 40, bombers: 14, cruisers: 6 })   // the wall outnumbers the line
    blue.group.position.set(-118, 0, 18)
    red.group.position.set(135, 0, -16); red.group.rotation.y = Math.PI
    red.group.visible = false                       // nothing out here — until the scope says otherwise

    // the gas giant hanging over the engagement — seated on the wide shot's
    // view axis so its disc fills the no-man's-land between the lines; lit
    // from the flank so the terminator models it as a world, not a marble
    const giantTick = makeGasGiant(scene, [], new THREE.Vector3(37, -40, -132), new THREE.Vector3(-0.6, 0.35, 0.5).normalize())
    const field = asteroidField(ctx, { count: 26, center: new THREE.Vector3(0, 0, 0), inner: 70, outer: 220, scaleMax: 5 })
    // the pull-back camera lives out at z ≈ 84–104: mirror any rock seeded on
    // that side of the battle plane so nothing tumbles across the lens
    for (const rock of field.group.children) if (rock.position.z > 40) rock.position.z *= -1

    const radar = makeContactRadar(ctx, blue.ships.map((s, i) => ({ x: s.position.x, z: s.position.z, big: i === 0 })))

    // flagship shields — a rim-lit bubble that flares when a broadside lands
    const shields = {}
    for (const [team, fleetRef] of [['blue', blue], ['red', red]]) {
      const sh = makeShield(TEAMS[team].bolt)
      sh.mesh.scale.set(2.4, 2.0, 4.4)
      fleetRef.ships[0].add(sh.mesh)
      shields[team] = sh
    }

    // charred drifting hulks instead of vanishing ships
    const charred = new THREE.MeshStandardMaterial({ color: 0x23262c, emissive: 0x180b05, emissiveIntensity: 0.5, metalness: 0.3, roughness: 0.95 })
    const wrecks = []
    const wreckify = (s) => {
      s.userData.dead = true
      s.children[0].material = charred
      if (s.children[1]) s.children[1].visible = false      // engine plume dies
      wrecks.push({ s, sx: (Math.random() - 0.5) * 1.4, sy: (Math.random() - 0.5) * 1.4, vy: (Math.random() - 0.5) * 1.6 })
    }

    // slow torpedoes arcing across the gap over the laser fire
    const torps = []
    const fireTorp = (att, def) => {
      const s = pick(att), t = pick(def); if (!s || !t) return
      s.getWorldPosition(_a); t.getWorldPosition(_b)
      const m = new THREE.Mesh(fx.bombGeo, fx.bombMat); m.position.copy(_a); scene.add(m)
      torps.push({ m, from: _a.clone(), to: _b.clone(), t: 0, dur: 2.2 + Math.random() * 0.8, smokeCd: 0 })
    }

    // skirmishers tearing across the no-man's-land — held in the tubes until
    // the batteries release
    const skirm = []
    const mkSkirm = (team) => {
      const mat = new THREE.MeshStandardMaterial({ color: TEAMS[team].color, emissive: TEAMS[team].color, emissiveIntensity: 0.55, metalness: 0.6, roughness: 0.4 })
      const g = new THREE.Group(); g.add(new THREE.Mesh(team === 'blue' ? buildBlueModel() : buildRedModel(), mat))
      const glow = new THREE.Mesh(fx.blastGeo, fx.glowMat[team]); glow.scale.setScalar(0.3); glow.position.set(0, 0, -0.95); g.add(glow)
      g.visible = false; scene.add(g)
      const o = { g, mat, glow, team, dir: team === 'blue' ? 1 : -1, t: Math.random() * 6, fire: Math.random() }
      reseed(o); return o
    }
    const reseed = (o) => { o.x = -o.dir * (70 + Math.random() * 20); o.y = (Math.random() - 0.5) * 26; o.z = (Math.random() - 0.5) * 26; o.amp = 4 + Math.random() * 6; o.spd = 34 + Math.random() * 16 }
    for (let i = 0; i < 7; i++) { skirm.push(mkSkirm('blue')); skirm.push(mkSkirm('red')) }

    const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _d = new THREE.Vector3()
    const pick = (f) => { const live = f.ships.filter(s => !s.userData.dead); return live[Math.floor(Math.random() * live.length)] }
    const volley = (att, def, color) => { const s = pick(att), t = pick(def); if (!s || !t) return; s.getWorldPosition(_a); t.getWorldPosition(_b); fx.bolt(_a, _b, color, { speed: 100 }) }
    let shake = 0
    // random losses never claim a flagship — the capitals duel behind shields
    const detonate = (f) => { const live = f.ships.filter((s, i) => i > 0 && !s.userData.dead); if (live.length <= 6) return; const s = live[Math.floor(Math.random() * live.length)]; s.getWorldPosition(_a); fx.blast(_a, true); wreckify(s); shake = Math.min(1.4, shake + 0.7) }
    // the capital duel: a heavy lance every few seconds, flaring the target's shield
    const broadside = (att, def, defShield, color) => {
      att.ships[0].getWorldPosition(_a); def.ships[0].getWorldPosition(_b)
      _b.x += (Math.random() - 0.5) * 4; _b.y += (Math.random() - 0.5) * 3
      fx.bolt(_a, _b, color, { speed: 130, big: true, size: 3.2, blastOnHit: false })
      defShield.pending = 0.35 + _a.distanceTo(_b) / 130   // flare when the lance arrives
    }

    let T = 0, c0 = false, c1 = false, c2 = false, c3 = false, ended = false
    let radarShown = false, radarContacted = false, radarOffed = false
    let revealed = false, skirmOut = false
    let fireCd = 0, detCd = 1.5, torpCd = 2.2, bsCd = 0
    return (dt) => {
      T += dt
      field.tick(dt)
      giantTick(T)
      radar.tick(dt)

      // ── A · the patrol lane ──
      // the scanning line yields the stage to the scope the moment it powers on
      if (!radarShown && T >= RADAR_ON) { radarShown = true; comms.hide(); radar.show() }
      if (!radarContacted && T >= CONTACT_T) { radarContacted = true; radar.contact() }
      if (!radarOffed && T >= RADAR_OFF) { radarOffed = true; radar.off() }

      // fleet motion: cruise to contact, then the lines never stop — they grind
      // slowly into each other across the planet's disc for the whole battle
      blue.group.position.x += (T < OPEN_FIRE ? 6.5 : 1.6) * dt
      if (revealed) {
        const gap = red.group.position.x - blue.group.position.x
        if (gap > 96) red.group.position.x -= Math.min(34, Math.max(7, (gap - 94) * 0.55)) * dt
        else if (gap > 52) red.group.position.x -= 1.6 * dt   // combat creep, floored short of a collision
      }

      // ── B · the reveal: the wall ignites out of the dark and closes ──
      if (!revealed && T >= REVEAL_T) {
        revealed = true; red.group.visible = true
        red.hullMat.emissiveIntensity = 0.12
        sfx.rumble(0.55, 1.6)
        for (const s of red.ships) if (s.children[1]) { s.children[1].visible = false; s.userData.ignite = REVEAL_T + 0.15 + Math.random() * 1.1 }
      }
      if (revealed && T < REVEAL_T + 1.8) {
        red.hullMat.emissiveIntensity = Math.min(0.5, 0.12 + (T - REVEAL_T) * 0.32)
        for (const s of red.ships) if (s.userData.ignite && T >= s.userData.ignite) { s.children[1].visible = true; s.userData.ignite = 0 }
      }

      // skirmishers launch with the release, weave across, firing forward
      if (!skirmOut && T > OPEN_FIRE + 0.4) { skirmOut = true; for (const o of skirm) { o.g.visible = true; reseed(o) } }
      for (const o of skirm) {
        o.t += dt; o.x += o.dir * o.spd * dt
        o.g.position.set(o.x, o.y + Math.sin(o.t * 2.2) * o.amp, o.z + Math.cos(o.t * 1.7) * o.amp)
        orient(o.g, _d.set(o.dir, Math.cos(o.t * 2.2) * 0.4, -Math.sin(o.t * 1.7) * 0.4))
        if (skirmOut) {
          o.fire -= dt
          if (o.fire <= 0) { _b.copy(o.g.position).addScaledVector(_d.set(o.dir, 0, 0), 40); fx.bolt(o.g.position, _b, o.team === 'blue' ? 0x8fc6ff : 0xff7a5a, { speed: 110, blastOnHit: false }); o.fire = 0.5 + Math.random() }
        }
        if (o.dir > 0 ? o.x > 80 : o.x < -80) reseed(o)
      }

      // main-line gunnery + ships dying — batteries release on the order
      if (T > OPEN_FIRE) {
        fireCd -= dt
        if (fireCd <= 0) { volley(blue, red, 0x8fc6ff); volley(red, blue, 0xff7a5a); fireCd = 0.05 }
        detCd -= dt
        if (detCd <= 0) { detonate(Math.random() < 0.62 ? red : blue); detCd = 0.5 + Math.random() * 0.5 }   // the Discord gives ground slowly
        torpCd -= dt
        if (torpCd <= 0) { fireTorp(Math.random() < 0.5 ? blue : red, Math.random() < 0.5 ? red : blue); torpCd = 1.6 + Math.random() * 1.4 }
        bsCd -= dt
        if (bsCd <= 0) { const bf = Math.random() < 0.5; broadside(bf ? blue : red, bf ? red : blue, shields[bf ? 'red' : 'blue'], bf ? 0x8fc6ff : 0xff7a5a); bsCd = 2.6 + Math.random() * 0.8 }
      }

      // shields: flare as the lance lands, then bleed away
      for (const team of ['blue', 'red']) {
        const sh = shields[team]
        if (sh.pending != null) { sh.pending -= dt; if (sh.pending <= 0) { sh.pending = null; sh.mat.uniforms.uIntensity.value = 1.3; shake = Math.min(1.4, shake + 0.4) } }
        sh.mat.uniforms.uIntensity.value = Math.max(0, sh.mat.uniforms.uIntensity.value - dt * 1.7)
      }

      // torpedoes: slow ordnance arcing over the bolt streams, smoke behind
      for (let i = torps.length - 1; i >= 0; i--) {
        const tp = torps[i]; tp.t += dt
        const p = Math.min(1, tp.t / tp.dur)
        tp.m.position.lerpVectors(tp.from, tp.to, p); tp.m.position.y += Math.sin(p * Math.PI) * 14
        tp.m.rotation.set(T * 3, T * 2, 0)
        tp.smokeCd -= dt; if (tp.smokeCd <= 0) { fx.smoke(tp.m.position); tp.smokeCd = 0.05 }
        if (p >= 1) { fx.blast(tp.m.position.clone(), true); shake = Math.min(1.4, shake + 0.5); scene.remove(tp.m); torps.splice(i, 1) }
      }

      // wrecks: tumble, drift, shed the odd ember
      for (const w of wrecks) {
        w.s.rotation.x += w.sx * dt; w.s.rotation.z += w.sy * dt; w.s.position.y += w.vy * dt
        if (Math.random() < 0.02) { w.s.getWorldPosition(_a); fx.ember(_a, 0xff6a30) }
      }

      // camera: riding abeam on the patrol → down-range at the reveal → then
      // the battle wide, rolled 45° so the lines cross the frame corner-to-
      // corner with the gas giant centred beyond them
      const bp = blue.group.position
      const mid = (bp.x + red.group.position.x) / 2
      shake = Math.max(0, shake - dt * 1.6)
      if (T < REVEAL_T) {
        camera.up.set(0, 1, 0)
        camera.position.set(bp.x - 30 + Math.sin(T * 0.23) * 2, 9 + Math.sin(T * 0.4) * 1.2, bp.z + 36)
        camera.lookAt(bp.x + 26, 0, bp.z - 8)
      } else if (T < OPEN_FIRE) {
        // over the line's shoulder: bombers foreground, the igniting wall beyond
        camera.up.set(0, 1, 0)
        camera.position.set(bp.x - 44, 14, bp.z + 10)
        camera.lookAt(red.group.position.x, 2, red.group.position.z + 4)
      } else {
        camera.up.set(1, 1, 0).normalize()   // the 45° roll: blue lower-left, red upper-right
        // open tight on the release, then pull slowly back as the lines converge
        camera.position.set(mid - 8 + (Math.random() - 0.5) * shake * 3, 24 + (Math.random() - 0.5) * shake * 2, 84 + Math.min(20, (T - OPEN_FIRE) * 1.55))
        camera.lookAt(mid, 0, 0)
      }

      if (!c0 && T >= 1.8)  { c0 = true; comms.show('Fleet Tactical', LINE_SCAN, { persist: true }) }
      if (!c1 && T >= 8.1)  { c1 = true; comms.show('Fleet Tactical', LINE_CONTACT) }
      if (!c2 && T >= 12.2) { c2 = true; comms.show(ASTRAIA, LINE_NOWHERE) }
      if (!c3 && T >= 16.8) { c3 = true; comms.show(ASTRAIA, LINE_FIRE, { persist: true }) }
      if (!ended && T >= END_T) { ended = true; end() }
    }
  },
}
