import * as THREE from 'three'
import { TEAMS } from '../../battle/constants'
import { buildBlueModel, buildAleph, makeGasGiant, buildScienceVessel } from '../../battle/geometry'
import { createFlagship, createBomberWing } from '../actors'
import { asteroidField } from '../models'

// The science vessel Cassiopeia warps in, pulls up alongside a mysterious gold
// artifact (the Aleph) and scans it with a scout fighter. The survey compiles
// into a full-screen object-file infocard (rotating model + hard numbers) —
// then the ambush by red bombers → urgent transmission.
const WARP_FROM_X = -210, WARP_TO_X = -95, WARP_DUR = 1.0, CRUISE_SPEED = 17
const SHIP_LANE_Z = 22, STOP_X = 0, REVEAL_X = -78
const ALEPH_SCALE = 2.0, ALEPH_HALF_H = 7
const SCAN_POS = new THREE.Vector3(0, 4, 13), SCAN_DUR = 4.5, FLY_DUR = 2.2
const CARD_IN = 1.1, AMBUSH_DELAY = 4.4   // infocard up after the scan; bombers only once it's closed —
                                          // with a quiet beat for the crew's half-finished thought between
const N_BOMBERS = 8

const SHIP_NAME = 'Imperial Science Vessel Cassiopeia'
const DLG1 = 'Leaving relativistic speed, entering newtonian flight model. Approaching source of unknown radio signal.'
const DLG2 = 'Radiation levels are off the charts. Spectrogram readings are indeterminate. This is it, no doubt.'
const DLG3 = 'Ambush by unknown attackers! Abandon ship! Call for reinforcements!'
const DLG4 = '13.4 billion years... that would make this thing as old as...'   // cut short by the ambush

const easeOut3 = (p) => 1 - Math.pow(1 - p, 3)
const easeInOut = (p) => (p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2)

// ── The Aleph object-file infocard ───────────────────────────────────────────
// A 2D survey card (canvas texture) with a live rotating Aleph beside hard
// numbers: nucleocosmochronometric age, exotic-matter equation of state, the
// carrier line. Designed at 1440×880, rendered at 1800×1100 for crispness.
const MONO = '"Cascadia Mono", "Consolas", monospace'
const INK = (a) => `rgba(148,214,255,${a})`

function drawAlephCard(c, W, H) {
  c.scale(W / 1440, H / 880)

  // panel: near-solid black glass, hairline border, corner brackets, scanlines
  c.fillStyle = 'rgba(5,12,20,0.97)'; c.fillRect(24, 24, 1392, 832)
  c.strokeStyle = INK(0.5); c.lineWidth = 2; c.strokeRect(24, 24, 1392, 832)
  c.strokeStyle = INK(0.14); c.lineWidth = 1; c.strokeRect(34, 34, 1372, 812)
  c.fillStyle = INK(0.022)
  for (let y = 28; y < 852; y += 4) c.fillRect(26, y, 1388, 1)
  c.strokeStyle = INK(0.95); c.lineWidth = 3
  for (const [bx, by, dx, dy] of [[24, 24, 1, 1], [1416, 24, -1, 1], [24, 856, 1, -1], [1416, 856, -1, -1]]) {
    c.beginPath(); c.moveTo(bx + dx * 34, by); c.lineTo(bx, by); c.lineTo(bx, by + dy * 34); c.stroke()
  }

  // header
  c.font = `500 20px ${MONO}`; c.fillStyle = INK(0.6)
  c.fillText('XENOARCHAEOLOGICAL SURVEY // OBJECT FILE XAO-0001', 60, 76)
  c.font = `700 84px ${MONO}`; c.fillStyle = '#ffcf5a'
  c.shadowColor = 'rgba(255,190,80,0.55)'; c.shadowBlur = 26
  c.fillText('ALEPH', 56, 152)
  c.shadowBlur = 0
  c.strokeStyle = 'rgba(255,138,90,0.9)'; c.lineWidth = 2; c.strokeRect(986, 58, 254, 50)
  c.fillStyle = 'rgba(255,138,90,0.14)'; c.fillRect(986, 58, 254, 50)
  c.font = `600 23px ${MONO}`; c.fillStyle = '#ffab8a'; c.fillText('PRIORITY · ULTRA', 1003, 91)
  c.font = `500 16px ${MONO}`; c.fillStyle = INK(0.45); c.fillText('DIST: IMPERIAL EYES ONLY', 1162, 138)
  c.strokeStyle = INK(0.4); c.lineWidth = 1
  c.beginPath(); c.moveTo(48, 176); c.lineTo(1392, 176); c.stroke()

  // left figure panel: reticle rings behind the live model, caption below
  const rx = 304, ry = 468
  c.strokeStyle = INK(0.4); c.lineWidth = 1.5
  c.beginPath(); c.arc(rx, ry, 238, 0, Math.PI * 2); c.stroke()
  c.setLineDash([5, 7]); c.strokeStyle = INK(0.26)
  c.beginPath(); c.arc(rx, ry, 168, 0, Math.PI * 2); c.stroke()
  c.setLineDash([])
  c.strokeStyle = INK(0.16)
  c.beginPath(); c.ellipse(rx, ry, 238, 62, -0.5, 0, Math.PI * 2); c.stroke()
  c.strokeStyle = INK(0.7); c.lineWidth = 2
  for (const [tx, ty, hx, hy] of [[rx, ry - 238, 0, 1], [rx, ry + 238, 0, -1], [rx - 238, ry, 1, 0], [rx + 238, ry, -1, 0]]) {
    c.beginPath(); c.moveTo(tx, ty); c.lineTo(tx + hx * 16, ty + hy * 16); c.stroke()
  }
  c.font = `500 16px ${MONO}`; c.fillStyle = INK(0.55)
  c.fillText('FIG. 1 · GROSS MORPHOLOGY', 80, 764)
  c.fillStyle = INK(0.38)
  c.fillText('H 14.2 m · TUMBLE P 22.4 s · SPECULAR Au-CLASS', 80, 788)
  c.strokeStyle = INK(0.18)
  c.beginPath(); c.moveTo(580, 196); c.lineTo(580, 800); c.stroke()

  // stat block
  const rows = [
    ['OBJECT CLASS', 'NON-BARYONIC ARTEFACT', null, null],
    ['EPOCH / AGE', '13.4 ± 0.6 Gyr', 'Th-232 / U-238 NUCLEOCOSMOCHRONOMETRY', null],
    ['COMPOSITION', 'EXOTIC MATTER · w < −1', 'NULL ENERGY CONDITION: VIOLATED', null],
    ['ORIGIN', 'UNKNOWN', null, '#ffcf5a'],
    ['REST MASS', '3.1 × 10⁹ kg', 'EQUIVALENCE VIOLATION · η = 0.42 (NORDTVEDT)', null],
    ['SURFACE TEMP', '2.7255 K', 'ISOTHERMAL WITH CMB · ZERO NET EMISSION', null],
    ['CARRIER', '10.3 GHz · Δν < 1 Hz', 'FLUX 11.3σ ABOVE INSTRUMENT CEILING', null],
  ]
  let y = 232
  for (const [label, value, sub, col] of rows) {
    c.font = `500 19px ${MONO}`; c.fillStyle = INK(0.5); c.fillText(label, 604, y)
    c.font = `600 25px ${MONO}`; c.fillStyle = col || 'rgba(214,240,255,0.95)'; c.fillText(value, 902, y)
    if (sub) { c.font = `500 16px ${MONO}`; c.fillStyle = INK(0.36); c.fillText(sub, 902, y + 22) }
    y += sub ? 56 : 44
  }

  // fig. A — age posterior from Th/U chronometry
  const ax = 600, ay = 612, aw = 380, ah = 178
  c.strokeStyle = INK(0.28); c.lineWidth = 1; c.strokeRect(ax, ay, aw, ah)
  c.fillStyle = INK(0.05); c.fillRect(ax, ay, aw, ah)
  c.font = `500 15px ${MONO}`; c.fillStyle = INK(0.6)
  c.fillText('FIG. A · AGE POSTERIOR · Th/U', ax + 12, ay + 24)
  const gx = (v) => ax + 18 + ((v - 11.6) / 3.6) * (aw - 36)
  const gy0 = ay + ah - 26
  c.fillStyle = INK(0.1); c.fillRect(gx(12.8), ay + 36, gx(14.0) - gx(12.8), gy0 - ay - 36)
  c.strokeStyle = INK(0.85); c.lineWidth = 2; c.beginPath()
  for (let i = 0; i <= 90; i++) {
    const v = 11.6 + (i / 90) * 3.6
    const g = Math.exp(-0.5 * Math.pow((v - 13.4) / 0.6, 2))
    const px = gx(v), py = gy0 - g * (ah - 74)
    i === 0 ? c.moveTo(px, py) : c.lineTo(px, py)
  }
  c.stroke()
  c.strokeStyle = 'rgba(255,207,90,0.8)'; c.setLineDash([4, 4])
  c.beginPath(); c.moveTo(gx(13.4), ay + 34); c.lineTo(gx(13.4), gy0); c.stroke()
  c.setLineDash([])
  c.strokeStyle = INK(0.4); c.beginPath(); c.moveTo(ax + 14, gy0); c.lineTo(ax + aw - 14, gy0); c.stroke()
  c.font = `500 14px ${MONO}`; c.fillStyle = INK(0.42)
  for (const v of [12, 13, 14, 15]) c.fillText(String(v), gx(v) - 8, gy0 + 20)
  c.fillStyle = '#ffcf5a'; c.fillText('13.4', gx(13.4) + 8, ay + 48)
  c.fillStyle = INK(0.42); c.fillText('Gyr', ax + aw - 44, gy0 + 20)

  // fig. B — the carrier line, clipping the detector ceiling
  const bx = 1012, bw = 380
  c.strokeStyle = INK(0.28); c.strokeRect(bx, ay, bw, ah)
  c.fillStyle = INK(0.05); c.fillRect(bx, ay, bw, ah)
  c.font = `500 15px ${MONO}`; c.fillStyle = INK(0.6)
  c.fillText('FIG. B · RF SPECTRUM · X-BAND', bx + 12, ay + 24)
  const fx = (f) => bx + 18 + ((f - 8) / 4) * (bw - 36)
  const fy0 = ay + ah - 26
  c.strokeStyle = 'rgba(255,138,90,0.55)'; c.setLineDash([6, 5])
  c.beginPath(); c.moveTo(bx + 14, ay + 52); c.lineTo(bx + bw - 14, ay + 52); c.stroke()
  c.setLineDash([])
  c.font = `500 13px ${MONO}`; c.fillStyle = 'rgba(255,138,90,0.6)'
  c.fillText('INSTRUMENT CEILING', bx + 24, ay + 47)
  c.strokeStyle = INK(0.8); c.lineWidth = 1.6; c.beginPath()
  for (let i = 0; i <= 120; i++) {
    const f = 8 + (i / 120) * 4
    const n = Math.sin(i * 12.9898) * 43758.5453
    const jitter = (n - Math.floor(n)) * 9
    const px = fx(f), py = fy0 - 4 - jitter
    i === 0 ? c.moveTo(px, py) : c.lineTo(px, py)
  }
  c.stroke()
  c.strokeStyle = 'rgba(214,240,255,0.98)'; c.lineWidth = 3.5
  c.beginPath(); c.moveTo(fx(10.3), fy0); c.lineTo(fx(10.3), ay + 34); c.stroke()
  c.strokeStyle = INK(0.4); c.lineWidth = 1
  c.beginPath(); c.moveTo(bx + 14, fy0); c.lineTo(bx + bw - 14, fy0); c.stroke()
  c.font = `500 14px ${MONO}`; c.fillStyle = INK(0.42)
  for (const f of [8, 9, 10, 11, 12]) c.fillText(String(f), fx(f) - 8, fy0 + 20)
  c.fillText('GHz', bx + bw - 44, fy0 + 20)
  c.fillStyle = 'rgba(214,240,255,0.9)'; c.fillText('10.300', fx(10.3) + 10, ay + 74)

  // footer
  c.strokeStyle = INK(0.4)
  c.beginPath(); c.moveTo(48, 812); c.lineTo(1392, 812); c.stroke()
  c.font = `500 16px ${MONO}`; c.fillStyle = INK(0.45)
  c.fillText('ISV CASSIOPEIA · SENSORIUM CLR-3 · SURVEY PASS α', 60, 842)
  c.fillStyle = 'rgba(255,207,90,0.5)'
  c.fillText('ENC AEGIS-VII · RELAY → ADMIRALTY / THRONEWORLD', 918, 842)
}

// Build the card as a DOM overlay above the stage canvas — it never passes
// through the bloom composer, sits over every scene element, and can hold a
// real button. The rotating miniature gets its own tiny bloom-free renderer.
function makeAlephInfocard({ track }) {
  const wrap = document.createElement('div'); wrap.className = 'aleph-card-wrap'
  const cardEl = document.createElement('div'); cardEl.className = 'aleph-card'
  const bg = document.createElement('canvas'); bg.className = 'aleph-card-bg'
  bg.width = 1800; bg.height = 1100
  drawAlephCard(bg.getContext('2d'), 1800, 1100)
  const c3 = document.createElement('canvas'); c3.className = 'aleph-card-3d'
  const btn = document.createElement('button'); btn.className = 'aleph-card-close'; btn.textContent = 'CLOSE ✕'
  cardEl.append(bg, c3, btn); wrap.appendChild(cardEl)
  // mount beside the comms box (same stacking world) so dialogue outranks it
  const host = document.querySelector('#cutscene-screen .sb-stage') || document.body
  host.appendChild(wrap)

  const r3 = new THREE.WebGLRenderer({ canvas: c3, alpha: true, antialias: true })
  r3.setSize(560, 560, false)
  const s3 = new THREE.Scene()
  const cam3 = new THREE.PerspectiveCamera(36, 1, 0.1, 60)
  cam3.position.set(0, 0.9, 11.5); cam3.lookAt(0, 0, 0)
  s3.add(new THREE.AmbientLight(0x8090b0, 1.1))
  const key3 = new THREE.DirectionalLight(0xfff0d8, 1.7); key3.position.set(4, 6, 5); s3.add(key3)
  const rim3 = new THREE.DirectionalLight(0x88aaff, 0.9); rim3.position.set(-5, -2, -6); s3.add(rim3)
  const mini = buildAleph()
  const bb = new THREE.Box3().setFromObject(mini)
  mini.position.sub(bb.getCenter(new THREE.Vector3()))
  const half = bb.getSize(new THREE.Vector3()).y / 2
  const pivot = new THREE.Group(); pivot.add(mini)
  pivot.scale.setScalar(3.1 / half)
  pivot.rotation.x = 0.12
  mini.rotation.y = -0.45
  s3.add(pivot)

  const state = { shown: false, closed: false }
  btn.addEventListener('click', () => {
    if (state.closed) return
    state.closed = true
    cardEl.classList.remove('is-on')
    setTimeout(() => { wrap.style.display = 'none' }, 500)
  })
  track({
    dispose: () => {
      wrap.remove(); r3.dispose()
      mini.traverse((o) => {
        if (!o.isMesh) return
        o.geometry.dispose()
        for (const m of Array.isArray(o.material) ? o.material : [o.material]) m.dispose()
      })
    },
  })
  return {
    state,
    show() {
      state.shown = true
      void cardEl.offsetWidth   // commit initial styles so the transition runs
      cardEl.classList.add('is-on')
    },
    tick(dt) {
      if (!state.shown || state.closed) return
      mini.rotation.y += dt * 0.6
      r3.render(s3, cam3)
    },
  }
}

export default {
  label: 'CUTSCENE / FIRST LIGHT',
  establishing: { name: 'FIRST LIGHT', sub: 'Uncharted Space · Source of the Unknown Signal', stamp: 'ISV CASSIOPEIA · SENSORIUM FEED · CLR-3' },
  feed: [
    { t: 1.0,  level: 'ok',   text: '[OK] Relativistic translation complete · newtonian flight model' },
    { t: 3.6,  level: 'info', text: 'X-band acq · carrier 10.3 GHz · bearing locked' },
    { t: 6.4,  level: 'warn', text: 'Radiation flux exceeds instrument ceiling' },
    { t: 9.2,  level: 'info', text: 'Spectrogram indeterminate · pattern non-repeating' },
    { t: 13.5, level: 'info', text: 'Scout away · geodetic survey pass α' },
    { t: 17.0, level: 'ok',   text: '[OK] Survey telemetry relayed to Admiralty' },
    { t: 20.2, level: 'info', text: 'Survey pass complete · compiling object file' },
    { t: 21.3, level: 'ok',   text: '[OK] XAO-0001 "ALEPH" · object file committed' },
    { t: 28.3, level: 'crit', text: 'PROXIMITY ALERT · multiple uncatalogued contacts' },
    { t: 30.1, level: 'crit', text: 'DEFCON-2 · point defence unresponsive' },
  ],
  readout: {
    id: 'ISV Cassiopeia · PNL-012-EXT',
    rows: [
      { label: 'Range',    value: (t) => `${Math.max(0.08, 4.2 - t * 0.45).toFixed(2)} km` },
      { label: 'Rad flux', value: (t) => `${(2.4 + Math.min(9, t * 0.6)).toFixed(1)} σ` },
      { label: 'Carrier',  value: (t) => (t < 3.6 ? 'SEARCHING' : '10.3 GHz · LOCK') },
    ],
  },
  bloom: 0.6,
  create(ctx) {
    const { scene, camera, fx, sfx, comms, end, orient } = ctx

    // The Aleph — built off-centre, so wrap it in a pivot at the model's centre.
    const alephInner = buildAleph()
    const abox = new THREE.Box3().setFromObject(alephInner)
    alephInner.position.sub(abox.getCenter(new THREE.Vector3()))
    const aleph = new THREE.Group(); aleph.add(alephInner)
    aleph.scale.setScalar(0.001); aleph.visible = false   // grows in when revealed
    scene.add(aleph)

    // gold radiance + drifting motes shed by the artifact, lit with the reveal
    const alephLight = new THREE.PointLight(0xffc878, 0, 260); alephLight.position.set(0, 2, 0); scene.add(alephLight)
    const moteMat = new THREE.MeshBasicMaterial({ color: 0xffd9a0, transparent: true, opacity: 0.7, blending: THREE.AdditiveBlending, depthWrite: false })
    const motes = []
    for (let i = 0; i < 10; i++) {
      const m = new THREE.Mesh(fx.blastGeo, moteMat)
      m.scale.setScalar(0.12 + Math.random() * 0.1); m.visible = false; scene.add(m)
      motes.push({ m, r: 10 + Math.random() * 8, a: Math.random() * Math.PI * 2, s: 0.15 + Math.random() * 0.2, y: (Math.random() - 0.5) * 9 })
    }

    // a dim gas giant far off, and a debris field strewn around the find
    makeGasGiant(scene, [], new THREE.Vector3(-150, 50, -240), new THREE.Vector3(0.5, 0.4, 0.7).normalize())
    const field = asteroidField(ctx, { count: 46, center: new THREE.Vector3(0, 0, 0), inner: 46, outer: 190, scaleMin: 0.6, scaleMax: 5.5 })

    const flagship = createFlagship(ctx, {
      deathDrift: 0,
      model: buildScienceVessel,                // the Cassiopeia-class hull — an instrument, not a warship
      glowPos: [[0.38, -3.95], [-0.38, -3.95]], // seated in the twin stern nozzles
      onDestroyed: () => {
        shake = 1.6
        comms.show(SHIP_NAME, DLG3, { persist: true })
        end({ holdMs: 4200, overlay: { sender: 'Admiralty Command', body: "We've had an urgent distress call from the Science Vessel Cassiopeia, on a classified mission. They've called for immediate assistance. Get ready to deploy the fleet.", dismissLabel: 'TO BATTLE' } })
      },
    })
    flagship.ship.pos.set(WARP_FROM_X, 0, SHIP_LANE_Z)
    orient(flagship.group, new THREE.Vector3(1, 0, 0))
    flagship.group.position.copy(flagship.ship.pos)

    // an instrument hull reads by its shapes, not by glow — ease the emissive
    // so the key light can model the dish, masts and keel
    flagship.group.children[0].material.emissiveIntensity = 0.3

    // every bomb that lands rocks the camera
    const damage0 = flagship.damage
    flagship.damage = (n) => { damage0(n); shake = Math.min(1.3, shake + 0.3) }

    const wing = createBomberWing(ctx, { count: N_BOMBERS })
    const card = makeAlephInfocard(ctx)

    // camera rides behind-and-above the vessel, biased toward the artifact
    const CAM_OFF = new THREE.Vector3(-34, 14, 30)
    const camTarget = new THREE.Vector3()
    const _e = new THREE.Vector3(), _tmp = new THREE.Vector3(), _dir = new THREE.Vector3(), _v = new THREE.Vector3()
    const yAxis = new THREE.Vector3(0, 1, 0), ORIGIN = new THREE.Vector3()
    const lookGoal = () => _e.copy(flagship.ship.pos).add(_tmp.set(8, 1, -8))
    camera.position.copy(flagship.ship.pos).add(CAM_OFF)
    camTarget.copy(lookGoal()); camera.lookAt(camTarget)

    // scout fighter + scan FX
    let fighter = null, scanBeam = null, scanBand = null
    const spawnFighter = () => {
      const mat = new THREE.MeshStandardMaterial({ color: TEAMS.blue.color, emissive: TEAMS.blue.color, emissiveIntensity: 0.6, metalness: 0.6, roughness: 0.4 })
      const group = new THREE.Group(); group.add(new THREE.Mesh(buildBlueModel(), mat))
      const glow = new THREE.Mesh(fx.blastGeo, fx.glowMat.blue); glow.scale.setScalar(0.28); glow.position.set(0, 0, -0.95); group.add(glow)
      group.scale.setScalar(1.0); scene.add(group)
      fighter = { group, mat, phase: 'fly', t: 0, from: flagship.ship.pos.clone(), pos: flagship.ship.pos.clone(), warpDir: new THREE.Vector3(0.4, 0.5, 0.9).normalize() }
      group.position.copy(fighter.pos)
    }
    const startScanFX = () => {
      const beamMat = new THREE.MeshBasicMaterial({ color: 0x8fe6ff, transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending, depthWrite: false })
      scanBeam = { mesh: new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1, 8), beamMat), mat: beamMat }
      scene.add(scanBeam.mesh)
      const bandMat = new THREE.MeshBasicMaterial({ color: 0x7fd4ff, transparent: true, opacity: 0.4, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })
      scanBand = { mesh: new THREE.Mesh(new THREE.BoxGeometry(10, 0.3, 5), bandMat), mat: bandMat }
      scene.add(scanBand.mesh)
    }
    const endScanFX = () => {
      if (scanBeam) { scene.remove(scanBeam.mesh); scanBeam.mesh.geometry.dispose(); scanBeam.mat.dispose(); scanBeam = null }
      if (scanBand) { scene.remove(scanBand.mesh); scanBand.mesh.geometry.dispose(); scanBand.mat.dispose(); scanBand = null }
    }

    let T = 0, firedDlg1 = false, firedDlg2 = false, firedDlg4 = false, revealing = false, revealT = 0
    let stationaryT = 0, scanStarted = false, scanT = 0, scanDone = false, postScanT = 0, bombersSpawned = false, fighterWarped = false
    let shake = 0, warpDone = false, camAz = 0, camDist = 1, prevSweep = 0, cardPinged = false, cardDismissed = false, closedAt = 0

    return (dt) => {
      T += dt
      const ship = flagship.ship
      field.tick(dt)

      // artifact: slow tumble, grow in on reveal, gold light breathing
      aleph.rotation.y += 0.28 * dt
      aleph.rotation.x += 0.13 * dt
      if (revealing && revealT < 1) { revealT = Math.min(1, revealT + dt / 1.3); aleph.scale.setScalar(ALEPH_SCALE * easeOut3(revealT)) }
      if (revealing) {
        alephLight.intensity = 1.5 * revealT * (0.85 + 0.15 * Math.sin(T * 2.4))
        for (const mo of motes) {
          mo.m.visible = true
          mo.a += mo.s * dt
          mo.m.position.set(Math.cos(mo.a) * mo.r, mo.y + Math.sin(T * 0.7 + mo.r) * 1.4, Math.sin(mo.a) * mo.r)
        }
      }

      // vessel: warp in (hull stretched by the translation, snapping back on
      // arrival with the hyperspace howl), cruise to the artifact, pull up
      // alongside (actor owns the wreck)
      if (!ship.dying) {
        if (T < WARP_DUR) {
          const p = Math.min(1, T / WARP_DUR), e = 1 - Math.pow(1 - p, 3)
          ship.pos.x = THREE.MathUtils.lerp(WARP_FROM_X, WARP_TO_X, e)
          flagship.group.scale.set(3.2, 3.2, 3.2 * (1 + 9 * Math.pow(1 - p, 2)))
        } else if (!warpDone) {
          warpDone = true; flagship.group.scale.setScalar(3.2); sfx.jump(0.8)
        } else if (!ship.stationary) {
          const remaining = STOP_X - ship.pos.x
          if (remaining > 0.06) {
            const speed = Math.min(CRUISE_SPEED, Math.max(2.2, remaining * 1.3))   // ease in to the stop
            ship.pos.x += Math.min(speed * dt, remaining)
          } else { ship.stationary = true }
        }
        if (!revealing && ship.pos.x >= REVEAL_X) { revealing = true; aleph.visible = true; sfx.blip(880, 0.2, 0.5) }
      }
      flagship.tick(dt)

      // scripted beats
      if (!firedDlg1 && T >= 2.4) { firedDlg1 = true; comms.show(SHIP_NAME, DLG1) }
      if (ship.stationary && !ship.dying) {
        stationaryT += dt
        if (!firedDlg2 && stationaryT >= 1.2) { firedDlg2 = true; comms.show(SHIP_NAME, DLG2) }
        if (!scanStarted && stationaryT >= 4.8) { scanStarted = true; spawnFighter() }
      }

      // scout fighter: fly out, scan, then hold
      if (fighter && fighter.phase !== 'warp') {
        if (fighter.phase === 'fly') {
          fighter.t += dt
          const p = Math.min(1, fighter.t / FLY_DUR)
          fighter.pos.lerpVectors(fighter.from, SCAN_POS, easeInOut(p))
          orient(fighter.group, _dir.subVectors(SCAN_POS, fighter.from), 1 - Math.exp(-5 * dt))
          if (p >= 1) { fighter.phase = 'scan'; scanT = 0; startScanFX() }
        } else if (fighter.phase === 'scan' || fighter.phase === 'idle') {
          fighter.pos.copy(SCAN_POS); fighter.pos.y += Math.sin(T * 1.6) * 0.5
          orient(fighter.group, _dir.subVectors(ORIGIN, fighter.pos), 1 - Math.exp(-4 * dt))
        }
        fighter.group.position.copy(fighter.pos)
      }
      if (fighter && fighter.phase === 'scan') {
        scanT += dt
        if (scanBeam) {
          _v.subVectors(ORIGIN, fighter.pos); const len = _v.length()
          scanBeam.mesh.position.copy(fighter.pos).addScaledVector(_v, 0.5 / len)
          scanBeam.mesh.quaternion.setFromUnitVectors(yAxis, _tmp.copy(_v).multiplyScalar(1 / len))
          scanBeam.mesh.scale.set(1, len, 1)
          scanBeam.mat.opacity = 0.4 + 0.3 * Math.abs(Math.sin(T * 9))
        }
        if (scanBand) {
          const sweep = ((scanT * 6) % (ALEPH_HALF_H * 2)) - ALEPH_HALF_H   // bottom → top, looping
          if (sweep < prevSweep) sfx.blip(1500, 0.16, 0.18)                 // sweep wrapped → sensor ping
          prevSweep = sweep
          scanBand.mesh.position.set(0, sweep, 0)
          scanBand.mat.opacity = 0.5 * (0.6 + 0.4 * Math.sin(T * 8))
        }
        if (scanT >= SCAN_DUR) { fighter.phase = 'idle'; scanDone = true; endScanFX() }
      }

      // post-scan: the object file comes up and holds until CLOSE is pressed —
      // only after acknowledgement do the red bombers warp in
      if (scanDone && !bombersSpawned) {
        postScanT += dt
        if (!cardPinged && postScanT >= CARD_IN) { cardPinged = true; card.show(); sfx.blip(1400, 0.3, 0.4) }
        card.tick(dt)
        if (!cardDismissed && card.state.closed) { cardDismissed = true; closedAt = postScanT; sfx.blip(760, 0.22, 0.3) }
        if (cardDismissed && !firedDlg4 && postScanT >= closedAt + 0.6) { firedDlg4 = true; comms.show(SHIP_NAME, DLG4) }
        if (cardDismissed && postScanT >= closedAt + AMBUSH_DELAY) { bombersSpawned = true; wing.spawn(ship.pos) }
      }
      wing.tick(dt, flagship)

      // scout fighter warps out the moment the vessel is lost
      if (fighter && ship.dying && !fighterWarped) { fighterWarped = true; fighter.phase = 'warp'; fighter.t = 0; endScanFX(); sfx.jump(0.5) }
      if (fighter && fighter.phase === 'warp') {
        fighter.t += dt
        const accel = 30 + fighter.t * 220
        fighter.pos.addScaledVector(fighter.warpDir, accel * dt)
        fighter.group.position.copy(fighter.pos)
        orient(fighter.group, fighter.warpDir, 1 - Math.exp(-8 * dt))
        fighter.group.scale.set(1, 1, 1 + fighter.t * 16)
        if (fighter.t > 0.5) { scene.remove(fighter.group); fighter = null }
      }

      // camera: chase in, drift round the find once the vessel holds station,
      // then pull wide and shudder when the ambush lands
      const azGoal = bombersSpawned ? 0.5 : (ship.stationary ? -0.45 : 0)
      const distGoal = bombersSpawned ? 1.4 : 1
      camAz += (azGoal - camAz) * (1 - Math.exp(-0.55 * dt))
      camDist += (distGoal - camDist) * (1 - Math.exp(-0.8 * dt))
      _v.copy(CAM_OFF).applyAxisAngle(yAxis, camAz).multiplyScalar(camDist).add(ship.pos)
      camera.position.lerp(_v, 1 - Math.exp(-3 * dt))
      shake = Math.max(0, shake - dt * 1.6)
      if (shake > 0) camera.position.add(_tmp.set((Math.random() - 0.5) * shake * 1.6, (Math.random() - 0.5) * shake * 1.2, (Math.random() - 0.5) * shake * 1.6))
      camTarget.lerp(lookGoal(), 1 - Math.exp(-3 * dt)); camera.lookAt(camTarget)
    }
  },
}
