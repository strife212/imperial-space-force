import * as THREE from 'three'
import { buildBlueModel, makeRingedPlanet } from '../../battle/geometry'
import { NAV_GRID_VERT, NAV_GRID_FRAG } from '../../CampaignStarMap'
import { buildFleet } from '../actors'
import { buildStation, asteroidField } from '../models'
import { getFlag } from '../../../lib/store'

// The Empire answers the Cassiopeia's distress — in three movements:
//   A. the flagship nearly alone in deep space, a thin fighter picket, the
//      orbital platform a distant silhouette;
//   B. cut to the stellar chart — the reinforcement request propagates out
//      across the sector, every imperial garrison acknowledging in turn;
//   C. cut back — squadrons warp in from every bearing until the muster is a
//      fleet, and the advance order comes through.
const LINE0 = 'All sector garrisons: reinforcements requested. Rally to the flag at the deep-space muster point.'
const LINE1 = 'Every ship the Throne could spare. The first true muster in a generation.'
// LINE2 names the player's chosen fleet, e.g. "Fleet Concordia — advance. …"

const CUT_MAP = 8.8, CUT_BACK = 22.6, END_T = 37.8
const MAP_Y = 1500                        // the chart lives far above the world
const RAY_T0 = CUT_MAP + 1.5, RAY_TRAVEL = 0.45, RAY_STEP = 0.55   // one transmission per garrison, in turn
const RET_T0 = CUT_MAP + 7.7, RET_STAGGER = 0.35, RET_DUR = 1.15   // reinforcement vectors, reverse order
const ADDL = { transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }
const MONO = '"Cascadia Mono", "Consolas", monospace'

// the sector garrisons, and where each hangs on the holographic nav chart —
// true 3D positions above/below the radar grid, spiralling out from the fleet
const CHART_POS = [
  [13, 7, -6], [-15, -9, 13], [6, 14, -25], [-28, -12, -12], [-16, 18, 27],
  [33, 12, 14], [43, -16, -8], [24, 22, -38], [-42, 17, -33], [-34, -19, 21],
].map((p) => new THREE.Vector3(...p))
const MARKER_POS = new THREE.Vector3(0, 5, 0)   // the fleet beacon, above the grid's origin pad

const GARRISONS = [
  { name: 'NOVARAYA',          kind: 'planet', color: 0x2f86b0, atmo: 0x9fd0ff },
  { name: 'VIGIL STATION',     kind: 'base' },
  { name: 'AURELIA',           kind: 'planet', color: 0xb07830, atmo: 0xffc890 },
  { name: 'LITANIA MAGNA',     kind: 'ringed', color: 0x8a7ab8, atmo: 0xcabaff },
  { name: 'PALLAS DRYDOCK',    kind: 'base' },
  { name: 'PROVIDENTIA',       kind: 'planet', color: 0x3a8a5a, atmo: 0xa0ffcc },
  { name: 'THRONEWORLD',       kind: 'planet', color: 0xc4901a, atmo: 0xffd98a },
  { name: 'KHARSIS ANCHORAGE', kind: 'base' },
  { name: 'SEPTIMA REACH',     kind: 'planet', color: 0x9a4a32, atmo: 0xff9a80 },
  { name: 'CAELUM VERGE',      kind: 'ringed', color: 0x5a7a98, atmo: 0x88a8c8 },
]

export default {
  label: 'CUTSCENE / CRITICAL MASS',
  establishing: { name: 'CRITICAL MASS', sub: 'Deep Space · The First Muster in a Generation', stamp: 'FLEET COMMAND BUS · STRATCON 3 IN EFFECT' },
  feed: [
    { t: 0.8,  level: 'info', text: 'Picket formation · flagship + escort screen' },
    { t: 3.4,  level: 'warn', text: 'Strength insufficient for the warfront · muster authorised' },
    { t: 7.0,  level: 'ok',   text: '[OK] REINFORCEMENTS REQUESTED · all-garrison broadcast' },
    { t: 10.4, level: 'info', text: 'Stellar chart uplink · polling sector garrisons' },
    { t: 16.2, level: 'ok',   text: '[OK] 10 of 10 acknowledgements · squadrons underway' },
    { t: 17.8, level: 'info', text: 'Garrison squadrons detached · vectors laid to muster point' },
    { t: 24.6, level: 'info', text: 'Arrivals translating in · lanes 4–7 cleared' },
    { t: 30.0, level: 'info', text: 'Fleet chord tuned · entangled comms synced via Litania Magna' },
    { t: 34.6, level: 'ok',   text: '[OK] Advance order committed · geodesic laid for the warfront' },
  ],
  readout: {
    id: 'Fleet Command · PNL-009',
    rows: [
      { label: 'Hulls',     value: (t) => `${t < 23.2 ? 7 : Math.min(55, 7 + Math.floor((t - 23.2) * 6))}` },
      { label: 'Reactors',  value: 'NOMINAL' },
      { label: 'Formation', value: (t) => (t < CUT_BACK ? 'PICKET' : t < 32 ? 'CONVERGING' : 'LOCKED') },
    ],
  },
  bloom: 0.6,
  create(ctx) {
    const { scene, camera, fx, sfx, comms, end, orient, track } = ctx
    const fleetName = getFlag('fleetName') || 'Fleet Polyhymnia'
    const LINE2 = `${fleetName} — advance. Find what silenced the Cassiopeia.`

    // ── the world: a lone flagship, its picket, and a very distant drydock ──
    const fleet = buildFleet(ctx, { team: 'blue', fighters: 34, bombers: 14, cruisers: 6 })
    const escortIdx = new Set([0, 1, 7, 13, 19, 25, 31])   // flagship + six fighters spread round the ring
    const pending = []
    fleet.ships.forEach((g, i) => {
      if (escortIdx.has(i)) return
      g.visible = false
      const dir = new THREE.Vector3(Math.random() - 0.5, (Math.random() - 0.5) * 0.5, Math.random() - 0.5).normalize()
      pending.push({ g, slot: g.position.clone(), from: g.position.clone().addScaledVector(dir, 190 + Math.random() * 70), t: 0, dur: 0.9 + Math.random() * 0.5, delay: 0, howl: false, started: false, arrived: false, s0: g.scale.x })
    })
    for (let i = pending.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); const sw = pending[i]; pending[i] = pending[j]; pending[j] = sw }
    pending.forEach((a, i) => { a.delay = CUT_BACK + 0.6 + i * 0.16; a.howl = i % 5 === 0 })

    // the orbital platform, far off ahead — a silhouette with a blinking masthead
    const station = buildStation(); station.position.set(190, 72, -300); station.scale.setScalar(2.4); scene.add(station)
    const beaconMat = new THREE.MeshBasicMaterial({ color: 0xff6a52, opacity: 0.9, ...ADDL })
    const beacon = new THREE.Mesh(fx.blastGeo, beaconMat); beacon.scale.setScalar(0.7); beacon.position.set(0, 19.5, 0); station.add(beacon)
    makeRingedPlanet(scene, [], new THREE.Vector3(80, -110, -560), new THREE.Vector3(0.4, 0.5, 0.6).normalize())
    const field = asteroidField(ctx, { count: 16, center: new THREE.Vector3(0, 0, -30), inner: 90, outer: 240, scaleMax: 3 })

    // ── the stellar chart: the campaign map's serpentine route, garrisoned ──
    const texes = []
    const makeLabel = (text, color, { w = 768, glow = null, size = 46, scale = 2.0 } = {}) => {
      const cv = document.createElement('canvas'); cv.width = w; cv.height = 96
      const c = cv.getContext('2d')
      c.font = `600 ${size}px ${MONO}`; c.textAlign = 'center'; c.textBaseline = 'middle'
      if (glow) { c.shadowColor = glow; c.shadowBlur = 12 }
      c.fillStyle = color; c.fillText(text, w / 2, 50)
      const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; texes.push(tex)
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }))
      sp.scale.set(scale * (w / 96), scale, 1)
      sp.userData.s = sp.scale.clone()
      return sp
    }
    track({ dispose: () => texes.forEach((t) => t.dispose()) })

    const map = new THREE.Group(); map.position.set(0, MAP_Y, 0); scene.add(map)

    // the holographic radar grid — the nav chart's floor — plus drifting dust
    const gridMat = new THREE.ShaderMaterial({ vertexShader: NAV_GRID_VERT, fragmentShader: NAV_GRID_FRAG, uniforms: { uTime: { value: 0 } }, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })
    const grid = new THREE.Mesh(new THREE.CircleGeometry(62, 96), gridMat)
    grid.rotation.x = -Math.PI / 2; grid.position.y = -0.03; map.add(grid)
    const dustN = 240, dp = new Float32Array(dustN * 3)
    for (let i = 0; i < dustN; i++) { const rr = Math.sqrt(Math.random()) * 58, th = Math.random() * Math.PI * 2; dp[i * 3] = Math.cos(th) * rr; dp[i * 3 + 1] = (Math.random() - 0.5) * 44; dp[i * 3 + 2] = Math.sin(th) * rr }
    const dustGeo = new THREE.BufferGeometry(); dustGeo.setAttribute('position', new THREE.BufferAttribute(dp, 3))
    const dust = new THREE.Points(dustGeo, new THREE.PointsMaterial({ size: 0.45, sizeAttenuation: true, color: 0x6fa0e0, transparent: true, opacity: 0.4, blending: THREE.AdditiveBlending, depthWrite: false }))
    map.add(dust)

    // stems (solid above the plane, dotted below) + base pads on the grid
    const padGeo = new THREE.RingGeometry(1.0, 1.45, 32)
    const padMat = new THREE.MeshBasicMaterial({ color: 0x5f8ae0, opacity: 0.4, side: THREE.DoubleSide, ...ADDL })
    for (const p of [MARKER_POS, ...CHART_POS]) {
      const base = new THREE.Vector3(p.x, 0, p.z)
      if (Math.abs(p.y) > 0.6) {
        const geo = new THREE.BufferGeometry().setFromPoints([base, p])
        if (p.y > 0) map.add(new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0x7ee08a, transparent: true, opacity: 0.6 })))
        else { const l = new THREE.Line(geo, new THREE.LineDashedMaterial({ color: 0x7ee08a, dashSize: 0.9, gapSize: 0.8, transparent: true, opacity: 0.48 })); l.computeLineDistances(); map.add(l) }
      }
      const pad = new THREE.Mesh(padGeo, padMat)
      pad.rotation.x = -Math.PI / 2; pad.position.set(base.x, 0.04, base.z); map.add(pad)
    }

    // faint dotted jump lanes threading the garrisons
    const laneChain = [MARKER_POS, ...CHART_POS]
    for (let i = 0; i < laneChain.length - 1; i++) {
      const g = new THREE.BufferGeometry().setFromPoints([laneChain[i], laneChain[i + 1]])
      const l = new THREE.Line(g, new THREE.LineDashedMaterial({ color: 0x4a6a9a, dashSize: 1.4, gapSize: 1.1, transparent: true, opacity: 0.3 }))
      l.computeLineDistances(); map.add(l)
    }

    const rings = []   // every ring billboards to the camera
    const nodes = GARRISONS.map((spec, k) => {
      const grp = new THREE.Group(); grp.position.copy(CHART_POS[k]); map.add(grp)
      let spinTarget
      if (spec.kind === 'base') {
        const st = buildStation()
        const box = new THREE.Box3().setFromObject(st)
        const ctr = box.getCenter(new THREE.Vector3())
        st.children.forEach((ch) => ch.position.sub(ctr))
        st.scale.setScalar(2.0 / (box.getSize(new THREE.Vector3()).length() / 2 || 1))
        grp.add(st); spinTarget = st
      } else {
        const m = new THREE.Mesh(new THREE.SphereGeometry(1.9, 24, 18), new THREE.MeshStandardMaterial({ color: spec.color, emissive: spec.color, emissiveIntensity: 0.28, metalness: 0.15, roughness: 0.7 }))
        grp.add(m)
        grp.add(new THREE.Mesh(new THREE.SphereGeometry(2.15, 18, 14), new THREE.MeshBasicMaterial({ color: spec.atmo, opacity: 0.16, side: THREE.BackSide, ...ADDL })))
        if (spec.kind === 'ringed') { const rg = new THREE.Mesh(new THREE.RingGeometry(2.6, 3.9, 48), new THREE.MeshBasicMaterial({ color: spec.atmo, opacity: 0.3, side: THREE.DoubleSide, ...ADDL })); rg.rotation.set(-1.15, 0.35, 0); grp.add(rg) }
        spinTarget = m
      }
      // soft holo glow behind the model, and the chart ring
      grp.add(new THREE.Mesh(new THREE.SphereGeometry(4.4, 16, 16), new THREE.MeshBasicMaterial({ color: 0x4aa0ff, opacity: 0.05, ...ADDL })))
      const ring = new THREE.Mesh(new THREE.TorusGeometry(3.3, 0.08, 8, 48), new THREE.MeshBasicMaterial({ color: 0x4aa0ff, opacity: 0.45, ...ADDL }))
      grp.add(ring); rings.push(ring)
      const label = makeLabel(spec.name, '#a8cdf0')
      label.position.y = 4.6 + (k % 2) * 1.6; grp.add(label)
      const ack = makeLabel('✓ REQUEST RECEIVED', '#5effa0', { size: 58, scale: 2.6 })
      ack.position.y = label.position.y + 2.6; ack.visible = false; grp.add(ack)
      return { ring, spinTarget, ack, dist: CHART_POS[k].distanceTo(MARKER_POS), ackT: -1, flash: -1 }
    })
    // transmissions run nearest-first; the reinforcements come home in reverse
    const ackOrder = nodes.map((n, k) => k).sort((a, b) => nodes[a].dist - nodes[b].dist)

    // the muster point itself: the fleet beacon bobbing over the origin pad
    const fm = new THREE.Group(); fm.position.copy(MARKER_POS); map.add(fm)
    const oct = new THREE.Mesh(new THREE.OctahedronGeometry(1.1), new THREE.MeshBasicMaterial({ color: 0x66b8ff, opacity: 0.9, ...ADDL }))
    fm.add(oct)
    const fmRing = new THREE.Mesh(new THREE.TorusGeometry(2.6, 0.1, 8, 40), new THREE.MeshBasicMaterial({ color: 0xffd24a, opacity: 0.85, ...ADDL }))
    fm.add(fmRing); rings.push(fmRing)
    const fmLabel = makeLabel(fleetName.toUpperCase(), '#ffd98a'); fmLabel.position.y = 4.4; fm.add(fmLabel)
    const reqLabel = makeLabel('✦ REINFORCEMENTS REQUESTED', '#ffb454', { w: 1152, size: 58, scale: 2.6 })
    reqLabel.position.set(2.5, 7.0, 0); reqLabel.visible = false; fm.add(reqLabel)
    const chartTitle = makeLabel('URSU EUBULEUS SECTOR // NAVIGATION CHART', '#8fa8cc', { w: 1280 })
    chartTitle.position.set(0, 30, -14); chartTitle.scale.multiplyScalar(0.8); chartTitle.userData.s.copy(chartTitle.scale); map.add(chartTitle)

    // the outgoing signal: one bright ray per garrison, sent in turn
    const rayMat = new THREE.MeshBasicMaterial({ color: 0x8fd6ff, opacity: 0.8, ...ADDL })
    const ray = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 1, 6), rayMat); ray.visible = false; map.add(ray)
    const rayHead = new THREE.Mesh(new THREE.SphereGeometry(0.3, 10, 10), new THREE.MeshBasicMaterial({ color: 0xd8f2ff, opacity: 0.95, ...ADDL }))
    rayHead.visible = false; map.add(rayHead)

    // the answers: blue reinforcement vectors home to the beacon, a small
    // vessel riding each arrowhead — launched in reverse acknowledgement order
    const retShaftMat = new THREE.MeshBasicMaterial({ color: 0x66b8ff, opacity: 0.65, ...ADDL })
    const retConeMat = new THREE.MeshBasicMaterial({ color: 0x9fd0ff, opacity: 0.9, ...ADDL })
    const retShipMat = new THREE.MeshStandardMaterial({ color: 0x3a93ff, emissive: 0x3a93ff, emissiveIntensity: 0.7, metalness: 0.6, roughness: 0.4 })
    const retShipGeo = buildBlueModel()
    const yAxisV = new THREE.Vector3(0, 1, 0)
    const returns = [...ackOrder].reverse().map((k) => {
      const from = CHART_POS[k]
      const dir = new THREE.Vector3().subVectors(MARKER_POS, from).normalize()
      const quat = new THREE.Quaternion().setFromUnitVectors(yAxisV, dir)
      const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 1, 6), retShaftMat)
      shaft.quaternion.copy(quat); shaft.visible = false; map.add(shaft)
      const cone = new THREE.Mesh(new THREE.ConeGeometry(0.5, 1.3, 10), retConeMat)
      cone.quaternion.copy(quat); cone.visible = false; map.add(cone)
      const ship = new THREE.Group(); ship.add(new THREE.Mesh(retShipGeo, retShipMat))
      ship.scale.setScalar(0.9); ship.visible = false; map.add(ship)
      orient(ship, dir)
      return { from, dir, shaft, cone, ship, started: false, done: false }
    })

    const center = new THREE.Vector3(), off = new THREE.Vector3(-10, 2, 0)
    const FWD = new THREE.Vector3(1, 0, 0)
    const GREEN = new THREE.Color(0x5effa0), NODE_BLUE = new THREE.Color(0x4aa0ff)
    const _t = new THREE.Vector3(), _d = new THREE.Vector3(), _p1 = new THREE.Vector3(), _p2 = new THREE.Vector3(), _l1 = new THREE.Vector3()

    let T = 0, c0 = false, c1 = false, c2 = false, ended = false
    let cutMapDone = false, cutBackDone = false, reqShown = false, beaconPop = 0
    return (dt) => {
      T += dt
      const underway = T >= 34.6                          // the advance order takes hold
      fleet.group.position.x += (underway ? 11 : 5) * dt
      field.tick(dt)
      station.rotation.y += 0.04 * dt
      beaconMat.opacity = 0.25 + 0.65 * (0.5 + 0.5 * Math.sin(T * 2.4))

      // chart idles throughout — sweep turning, worlds spinning, beacon bobbing
      gridMat.uniforms.uTime.value = T
      dust.rotation.y = T * 0.008
      for (const n of nodes) n.spinTarget.rotation.y += 0.22 * dt
      oct.rotation.y = T * 1.2
      fm.position.y = MARKER_POS.y + Math.sin(T * 2) * 0.7
      fmRing.material.opacity = 0.5 + 0.4 * (0.5 + 0.5 * Math.sin(T * 3.2))
      for (const r of rings) r.lookAt(camera.position)

      // ── the request goes out: one ray per garrison, each answering as the
      //    transmission lands ──
      if (!reqShown && T >= CUT_MAP + 0.9) { reqShown = true; reqLabel.visible = true; sfx.blip(620, 0.25, 0.32) }
      const ri = Math.floor((T - RAY_T0) / RAY_STEP)
      if (T >= RAY_T0 && ri < ackOrder.length) {
        const k = ackOrder[ri]
        const n = nodes[k]
        const p = Math.min(1, (T - RAY_T0 - ri * RAY_STEP) / RAY_TRAVEL)
        _t.lerpVectors(MARKER_POS, CHART_POS[k], p)
        _d.subVectors(_t, MARKER_POS)
        const len = Math.max(0.01, _d.length())
        ray.visible = rayHead.visible = true
        ray.position.copy(MARKER_POS).addScaledVector(_d, 0.5)
        ray.quaternion.setFromUnitVectors(yAxisV, _d.multiplyScalar(1 / len))
        ray.scale.set(1, len, 1)
        rayHead.position.copy(_t)
        if (p >= 1 && n.ackT < 0) { n.ackT = T; n.ack.visible = true; n.flash = 0; sfx.blip(1450 + n.dist * 4, 0.1, 0.2) }
      } else if (ray.visible) { ray.visible = rayHead.visible = false }
      for (const n of nodes) {
        if (n.ackT >= 0) {
          const k = Math.min(1, (T - n.ackT) / 0.32), e = 1 - Math.pow(1 - k, 3)
          n.ack.scale.copy(n.ack.userData.s).multiplyScalar(0.55 + 0.45 * e)
        }
        if (n.flash >= 0) {
          n.flash += dt
          const f = Math.min(1, n.flash / 1.4)
          n.ring.material.color.lerpColors(GREEN, NODE_BLUE, f)
          n.ring.material.opacity = 1 - 0.55 * f
        }
      }

      // ── the garrisons answer in kind: blue vectors home, hulls riding them ──
      returns.forEach((r, j) => {
        if (r.done || T < RET_T0 + j * RET_STAGGER) return
        if (!r.started) { r.started = true; r.shaft.visible = r.cone.visible = r.ship.visible = true; sfx.blip(720 + j * 24, 0.1, 0.16) }
        const p = Math.min(1, (T - RET_T0 - j * RET_STAGGER) / RET_DUR)
        _t.lerpVectors(r.from, MARKER_POS, p)
        _d.subVectors(_t, r.from)
        const len = Math.max(0.01, _d.length())
        r.shaft.position.copy(r.from).addScaledVector(_d, 0.5)
        r.shaft.scale.set(1, len, 1)
        r.cone.position.copy(_t)
        r.ship.position.lerpVectors(r.from, MARKER_POS, Math.max(0, p - 0.07))
        if (p >= 1) { r.done = true; r.shaft.visible = r.cone.visible = r.ship.visible = false; beaconPop = 1; sfx.blip(920, 0.1, 0.18) }
      })
      if (beaconPop > 0) { beaconPop = Math.max(0, beaconPop - dt * 2.5); oct.scale.setScalar(1 + 0.55 * beaconPop) }

      // ── the muster: squadrons translate in and slot into the formation ──
      for (const a of pending) {
        if (a.arrived || T < a.delay) continue
        if (!a.started) { a.started = true; a.g.visible = true; if (a.howl) sfx.jump(0.45) }
        a.t += dt
        const p = Math.min(1, a.t / a.dur), e = 1 - Math.pow(1 - p, 3)
        a.g.position.lerpVectors(a.from, a.slot, e)
        orient(a.g, _d.subVectors(a.slot, a.from))
        a.g.scale.set(a.s0, a.s0, a.s0 * (1 + 6 * Math.pow(1 - p, 2)))   // translation stretch, relaxing on approach
        if (p >= 1) { a.arrived = true; a.g.scale.setScalar(a.s0); orient(a.g, FWD) }
      }

      // ── camera: lone picket → hard cut to the chart → hard cut back, then
      //    crane wide as the formation fills in ──
      center.copy(fleet.group.position).add(off)
      if (T < CUT_MAP) {
        const push = T / CUT_MAP
        camera.position.set(center.x - 30, center.y + 7, center.z + 56 - 7 * push)
        camera.lookAt(center.x + 12, center.y + 3, center.z - 5)
      } else if (T < CUT_BACK) {
        if (!cutMapDone) { cutMapDone = true; sfx.blip(980, 0.18, 0.3) }
        // a slow orbital drift round the chart, dollying gently in
        const mt = T - CUT_MAP
        const az = -0.42 + mt * 0.055, rr = 108 - mt * 1.5
        camera.position.set(Math.sin(az) * rr * 0.95, MAP_Y + 46 - mt * 0.7, Math.cos(az) * rr)
        camera.lookAt(0, MAP_Y + 4, 0)
      } else {
        if (!cutBackDone) { cutBackDone = true; sfx.blip(980, 0.18, 0.3) }
        const k = Math.min(1, Math.max(0, (T - CUT_BACK - 3.5) / 5.5)), ke = k * k * (3 - 2 * k)
        _p1.set(center.x - 26, center.y + 4, center.z + 42)                      // low, close, alongside
        const az = 0.6 + 0.2 * T
        _p2.set(center.x + 104 * Math.cos(az), center.y + 30 + 8 * Math.sin(az * 0.5), center.z + 104 * Math.sin(az))
        camera.position.lerpVectors(_p1, _p2, ke)
        _l1.copy(center).add(_t.set(14, 2, 0)); _l1.lerp(center, ke)
        camera.lookAt(_l1)
      }

      if (!c0 && T >= 2.2) { c0 = true; comms.show('Admiralty Command', LINE0) }
      if (!c1 && T >= 25.8) { c1 = true; comms.show('Princess Astraia', LINE1, { persist: true }) }
      if (!c2 && T >= 34.0) { c2 = true; comms.show('Admiralty Command', LINE2, { persist: true }) }
      if (!ended && T >= END_T) { ended = true; end() }
    }
  },
}
