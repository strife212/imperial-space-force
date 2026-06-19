import { useState, useRef, useEffect } from 'react'
import * as THREE from 'three'
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js'
import HudHeader from '../components/HudHeader'
import { TEAMS, BOMBER_SCALE, COMMS_PORTRAIT } from './battle/constants'
import { NEBULA_VERT, NEBULA_FRAG, buildBlueModel, buildBlueCapital, buildRedBomber, buildAleph } from './battle/geometry'
import { renderCommsBody } from './battle/RosterUI'
import UrgentMessageOverlay from './battle/UrgentMessageOverlay'
import './battle/battle.css'

// ── Scripted timeline ────────────────────────────────────────────────────────
const WARP_FROM_X = -210   // science vessel streaks in from far behind
const WARP_TO_X   = -95
const WARP_DUR    = 1.0
const CRUISE_SPEED = 17     // forward drift toward the artifact
const SHIP_LANE_Z = 22      // the vessel travels in a lane offset from the artifact (kept clear of it)
const STOP_X      = 0       // pulls up alongside the artifact here
const REVEAL_X    = -78     // the artifact reveals once the vessel closes to here
const ALEPH_SCALE = 2.0
const ALEPH_HALF_H = 7      // ≈ artifact half-height after scaling (for the scan sweep)
const SCAN_POS    = new THREE.Vector3(0, 4, 13)   // where the fighter holds to scan
const SCAN_DUR    = 4.5
const FLY_DUR     = 2.2     // fighter's flight out to the artifact
const N_BOMBERS   = 8
const BOMB_SPEED  = 36
const CUT_HP      = 60
const CUT_BOMB_DMG = 3
const DEATH_DUR   = 1.8

const SHIP_NAME = 'Imperial Science Vessel Cassiopeia'
const DLG1 = 'Leaving relativistic speed, entering newtonian flight model. Approaching source of unknown radio signal.'
const DLG2 = 'Radiation levels are off the charts. Spectrogram readings are indeterminate. This is it, no doubt.'
const DLG3 = 'Ambush by unknown attackers! Abandon ship! Call for reinforcements!'

const COMMS_DWELL_MS = 4200   // how long a line lingers after it's fully typed
const easeOut3 = (p) => 1 - Math.pow(1 - p, 3)
const easeInOut = (p) => (p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2)

export default function CutsceneAlephScreen({ onReturn, onComplete }) {
  const mountRef = useRef(null)
  const [resetKey, setResetKey] = useState(0)
  const [comms, setComms] = useState(null)
  const [commsText, setCommsText] = useState('')
  const commsSeq = useRef(0)
  const [ending,     setEnding]     = useState(false)
  const [fadeBlack,  setFadeBlack]  = useState(false)
  const [showUrgent, setShowUrgent] = useState(false)

  // typewriter: type the line out, let it sit a while, then (unless it persists) auto-hide
  useEffect(() => {
    if (!comms) { setCommsText(''); return }
    setCommsText('')
    let i = 0, hide
    const full = comms.text
    const typer = setInterval(() => {
      i++; setCommsText(full.slice(0, i))
      if (i >= full.length) {
        clearInterval(typer)
        if (!comms.persist) hide = setTimeout(() => setComms(null), COMMS_DWELL_MS)   // dwell after fully typed
      }
    }, 42)
    return () => { clearInterval(typer); clearTimeout(hide) }
  }, [comms?.id])

  useEffect(() => { setComms(null); setEnding(false); setFadeBlack(false); setShowUrgent(false) }, [resetKey])

  // End sequence: after "abandon ship", fade to black, then the urgent transmission
  useEffect(() => {
    if (!ending) return
    const t = setTimeout(() => setFadeBlack(true), 4200)
    return () => clearTimeout(t)
  }, [ending])
  useEffect(() => {
    if (!fadeBlack) return
    const t = setTimeout(() => setShowUrgent(true), 1300)
    return () => clearTimeout(t)
  }, [fadeBlack])

  useEffect(() => {
    const mount = mountRef.current
    if (!mount) return
    let renderer, composer, raf
    const disposables = []
    try {
      const w = mount.clientWidth || 1, h = mount.clientHeight || 1
      const scene = new THREE.Scene()
      const camera = new THREE.PerspectiveCamera(50, w / h, 0.1, 900)

      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
      renderer.setSize(w, h)
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
      mount.appendChild(renderer.domElement)

      scene.add(new THREE.AmbientLight(0x4a5a80, 0.8))
      const key = new THREE.DirectionalLight(0xcfe0ff, 0.85); key.position.set(6, 12, 8); scene.add(key)
      const rim = new THREE.DirectionalLight(0x4060a0, 0.4); rim.position.set(-10, -4, -12); scene.add(rim)

      // nebula skydome + stars (matches the battle backdrop)
      const nebGeo = new THREE.SphereGeometry(380, 32, 32)
      const nebMat = new THREE.ShaderMaterial({
        vertexShader: NEBULA_VERT, fragmentShader: NEBULA_FRAG,
        uniforms: {
          uColA: { value: new THREE.Color(0.030, 0.055, 0.140) },
          uColB: { value: new THREE.Color(0.090, 0.035, 0.150) },
          uColWarm: { value: new THREE.Color(0.180, 0.070, 0.030) },
        },
        side: THREE.BackSide, depthWrite: false, depthTest: false,
      })
      const neb = new THREE.Mesh(nebGeo, nebMat); neb.renderOrder = -10; scene.add(neb)
      disposables.push(nebGeo, nebMat)
      const starCount = 1100, sp = new Float32Array(starCount * 3)
      for (let i = 0; i < starCount; i++) {
        const rr = 130 + Math.random() * 200, th = Math.random() * Math.PI * 2, ph = Math.acos(2 * Math.random() - 1)
        sp[i * 3] = rr * Math.sin(ph) * Math.cos(th); sp[i * 3 + 1] = rr * Math.sin(ph) * Math.sin(th); sp[i * 3 + 2] = rr * Math.cos(ph)
      }
      const starGeo = new THREE.BufferGeometry(); starGeo.setAttribute('position', new THREE.BufferAttribute(sp, 3))
      const starMat = new THREE.PointsMaterial({ size: 0.7, sizeAttenuation: true, color: 0x9fb4d8, transparent: true, opacity: 0.85 })
      scene.add(new THREE.Points(starGeo, starMat)); disposables.push(starGeo, starMat)

      // ── shared geometry / materials ───────────────────────────────────────────
      const blastGeo = new THREE.SphereGeometry(1, 12, 12)
      const ringGeo = new THREE.RingGeometry(0.62, 1.0, 24)
      const bombGeo = new THREE.BoxGeometry(0.6, 1.5, 0.2)
      const trailGeo = new THREE.CylinderGeometry(1, 1, 1, 6)
      const beamGeo = new THREE.CylinderGeometry(0.05, 0.05, 1, 8)
      disposables.push(blastGeo, ringGeo, bombGeo, trailGeo, beamGeo)
      const glowMat = {
        blue: new THREE.MeshBasicMaterial({ color: TEAMS.blue.bolt, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false }),
        red:  new THREE.MeshBasicMaterial({ color: TEAMS.red.bolt,  transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false }),
      }
      const bombMat = new THREE.MeshBasicMaterial({ color: 0xffb030, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false })
      const smokeProto = new THREE.MeshBasicMaterial({ color: 0x8c8c8c, transparent: true, opacity: 0.5, depthWrite: false })
      disposables.push(glowMat.blue, glowMat.red, bombMat, smokeProto)

      const UP = new THREE.Vector3(0, 1, 0), ORIGIN = new THREE.Vector3(), yAxis = new THREE.Vector3(0, 1, 0)
      const _m = new THREE.Matrix4(), _q = new THREE.Quaternion()
      const _dir = new THREE.Vector3(), _tmp = new THREE.Vector3(), _v = new THREE.Vector3(), _e = new THREE.Vector3()
      const orient = (obj, dir, smooth) => {
        if (dir.lengthSq() < 1e-6) return
        _m.lookAt(dir, ORIGIN, UP); _q.setFromRotationMatrix(_m)
        if (smooth == null) obj.quaternion.copy(_q); else obj.quaternion.slerp(_q, smooth)
      }

      // ── The Aleph: a stationary artifact at the centre, slowly tumbling ─────────
      // Built off-centre, so wrap it in a pivot whose origin is the model's centre.
      const alephInner = buildAleph()
      const abox = new THREE.Box3().setFromObject(alephInner)
      alephInner.position.sub(abox.getCenter(new THREE.Vector3()))
      const aleph = new THREE.Group()
      aleph.add(alephInner)
      aleph.position.set(0, 0, 0)
      aleph.scale.setScalar(0.001)   // grows in when revealed
      aleph.visible = false
      scene.add(aleph)

      // ── Build the science vessel (blue capital) ────────────────────────────────
      const shipMat = new THREE.MeshStandardMaterial({ color: TEAMS.blue.color, emissive: TEAMS.blue.color, emissiveIntensity: 0.55, metalness: 0.65, roughness: 0.35 })
      const shipGeo = buildBlueCapital()
      disposables.push(shipMat, shipGeo)
      const shipGroup = new THREE.Group()
      shipGroup.add(new THREE.Mesh(shipGeo, shipMat))
      const glows = []
      for (const ex of [-0.45, 0.45]) {
        const g = new THREE.Mesh(blastGeo, glowMat.blue); g.scale.setScalar(0.7); g.position.set(ex, 0, -3.1); shipGroup.add(g); glows.push(g)
      }
      const fires = []
      for (let i = 0; i < 6; i++) {
        const fMat = new THREE.MeshBasicMaterial({ color: 0xff7a30, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false })
        const fm = new THREE.Mesh(blastGeo, fMat)
        fm.scale.setScalar(0.16)
        fm.position.set((Math.random() - 0.5) * 1.4, (Math.random() - 0.5) * 0.9, (Math.random() - 0.5) * 5)
        fm.visible = false
        shipGroup.add(fm); fires.push({ mesh: fm, mat: fMat }); disposables.push(fMat)
      }
      shipGroup.scale.setScalar(3.2)
      scene.add(shipGroup)
      const ship = {
        group: shipGroup, mat: shipMat, glows, fires,
        pos: new THREE.Vector3(WARP_FROM_X, 0, SHIP_LANE_Z),
        hp: CUT_HP, alive: true, dying: false, stationary: false, driftVel: null, trailPrev: null,
      }
      orient(shipGroup, new THREE.Vector3(1, 0, 0))   // faces +X (its travel direction)
      shipGroup.position.copy(ship.pos)

      // camera rides behind-and-above the vessel, biased toward the artifact
      const CAM_OFF = new THREE.Vector3(-34, 14, 30)
      const camTarget = new THREE.Vector3()
      const lookGoal = () => _e.copy(ship.pos).add(_tmp.set(8, 1, -8))
      camera.position.copy(ship.pos).add(CAM_OFF)
      camTarget.copy(lookGoal()); camera.lookAt(camTarget)

      // ── Red bomber ambushers (spawned later) ───────────────────────────────────
      const bombers = []
      const makeBomber = () => {
        const mat = new THREE.MeshStandardMaterial({ color: TEAMS.red.color, emissive: TEAMS.red.color, emissiveIntensity: 0.5, metalness: 0.6, roughness: 0.4 })
        const geo = buildRedBomber()
        disposables.push(mat, geo)
        const group = new THREE.Group()
        group.add(new THREE.Mesh(geo, mat))
        const glow = new THREE.Mesh(blastGeo, glowMat.red); glow.scale.setScalar(0.4); glow.position.set(0, 0, -1.4); group.add(glow)
        group.scale.setScalar(BOMBER_SCALE)
        group.visible = false
        scene.add(group)
        return { group, mat, pos: new THREE.Vector3(), fireCd: 0.3 + Math.random() * 0.6 }
      }

      // ── Scout fighter (scans the artifact) ─────────────────────────────────────
      let fighter = null
      const spawnFighter = () => {
        const mat = new THREE.MeshStandardMaterial({ color: TEAMS.blue.color, emissive: TEAMS.blue.color, emissiveIntensity: 0.6, metalness: 0.6, roughness: 0.4 })
        const geo = buildBlueModel()
        disposables.push(mat, geo)
        const group = new THREE.Group()
        group.add(new THREE.Mesh(geo, mat))
        const glow = new THREE.Mesh(blastGeo, glowMat.blue); glow.scale.setScalar(0.28); glow.position.set(0, 0, -0.95); group.add(glow)
        group.scale.setScalar(1.0)
        scene.add(group)
        fighter = { group, mat, phase: 'fly', t: 0, from: ship.pos.clone(), pos: ship.pos.clone(), warpDir: new THREE.Vector3(0.4, 0.5, 0.9).normalize() }
        group.position.copy(fighter.pos)
      }
      // scan FX (created when the fighter reaches the artifact)
      let scanBeam = null, scanBand = null
      const startScanFX = () => {
        const beamMat = new THREE.MeshBasicMaterial({ color: 0x8fe6ff, transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending, depthWrite: false })
        scanBeam = { mesh: new THREE.Mesh(beamGeo, beamMat), mat: beamMat }
        scene.add(scanBeam.mesh)
        const bandMat = new THREE.MeshBasicMaterial({ color: 0x7fd4ff, transparent: true, opacity: 0.4, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })
        const bandGeo = new THREE.BoxGeometry(10, 0.3, 5)
        scanBand = { mesh: new THREE.Mesh(bandGeo, bandMat), mat: bandMat, geo: bandGeo }
        scene.add(scanBand.mesh)
      }
      const endScanFX = () => {
        if (scanBeam) { scene.remove(scanBeam.mesh); scanBeam.mat.dispose(); scanBeam = null }
        if (scanBand) { scene.remove(scanBand.mesh); scanBand.mat.dispose(); scanBand.geo.dispose(); scanBand = null }
      }

      // ── Projectiles / FX ──────────────────────────────────────────────────────
      const bombs = [], blasts = [], puffs = [], embers = [], trails = []
      const spawnBlast = (pos, big = false) => {
        const s = big ? 1.7 : 1.0
        const fmat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 1, blending: THREE.AdditiveBlending, depthWrite: false })
        const fire = new THREE.Mesh(blastGeo, fmat); fire.position.copy(pos); fire.scale.setScalar(0.3 * s); scene.add(fire)
        const rmat = new THREE.MeshBasicMaterial({ color: 0xffd9a0, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })
        const ring = new THREE.Mesh(ringGeo, rmat); ring.position.copy(pos); ring.scale.setScalar(0.5 * s); scene.add(ring)
        blasts.push({ fire, fmat, ring, rmat, life: 0, max: 0.6, s })
      }
      const spawnSmoke = (p) => {
        const mat = smokeProto.clone(); const m = new THREE.Mesh(blastGeo, mat)
        m.position.copy(p); m.scale.setScalar(0.22 + Math.random() * 0.16); scene.add(m)
        puffs.push({ mesh: m, mat, life: 0, max: 0.5 + Math.random() * 0.3 })
      }
      const spawnEmber = (pos, color) => {
        const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false })
        const m = new THREE.Mesh(blastGeo, mat); m.position.copy(pos); m.scale.setScalar(0.3 + Math.random() * 0.4); scene.add(m)
        embers.push({ mesh: m, mat, vel: new THREE.Vector3((Math.random() - 0.5) * 2.5, (Math.random() - 0.5) * 2.5 + 0.4, (Math.random() - 0.5) * 2.5), life: 0, max: 0.6 + Math.random() * 0.5 })
      }
      const hullPoint = () => _e.set((Math.random() - 0.5) * 7, (Math.random() - 0.5) * 5, (Math.random() - 0.5) * 18).applyQuaternion(shipGroup.quaternion).add(ship.pos)
      const TRAIL_GAP = 6, _td = new THREE.Vector3(), _tn = new THREE.Vector3()
      const emitTrail = () => {
        if (!ship.trailPrev) { ship.trailPrev = ship.pos.clone(); return }
        if (ship.pos.distanceTo(ship.trailPrev) < TRAIL_GAP) return
        _td.subVectors(ship.pos, ship.trailPrev); const len = _td.length(); if (len < 1e-3) return
        const mat = new THREE.MeshBasicMaterial({ color: TEAMS.blue.bolt, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false })
        const m = new THREE.Mesh(trailGeo, mat)
        m.position.copy(ship.trailPrev).addScaledVector(_td, 0.5)
        m.quaternion.setFromUnitVectors(yAxis, _tn.copy(_td).multiplyScalar(1 / len))
        m.scale.set(0.6, len, 0.6); scene.add(m)
        trails.push({ mesh: m, mat, life: 0, max: 0.5 })
        ship.trailPrev.copy(ship.pos)
      }
      const revealFires = () => {
        const frac = 1 - Math.max(0, ship.hp) / CUT_HP
        const n = Math.min(fires.length, Math.floor(frac * fires.length) + 1)
        for (let k = 0; k < fires.length; k++) { fires[k].mesh.visible = k < n; if (k < n) fires[k].mat.opacity = Math.max(fires[k].mat.opacity, 0.5) }
      }
      const fireBomb = (b) => {
        const start = b.pos.clone()
        const dir = _v.subVectors(ship.pos, start).normalize().clone()
        const mesh = new THREE.Mesh(bombGeo, bombMat); mesh.position.copy(start); mesh.quaternion.setFromUnitVectors(yAxis, dir); scene.add(mesh)
        bombs.push({ mesh, dir, life: 0, max: 3.0, smokeCd: 0 })
      }

      // scripted-event latches / accumulators
      let wreck = null, T = 0, firedDlg1 = false, firedDlg2 = false, firedDlg3 = false
      let revealing = false, revealT = 0
      let stationaryT = 0, scanStarted = false, scanT = 0, scanDone = false
      let postScanT = 0, bombersSpawned = false, fighterWarped = false
      const showComms = (text, persist) => setComms({ id: ++commsSeq.current, team: 'blue', name: SHIP_NAME, portrait: COMMS_PORTRAIT.blue, text, segments: [{ text }], persist })

      const clock = new THREE.Clock()
      const frame = () => {
        const dt = Math.min(clock.getDelta(), 0.05)
        T += dt

        // ── Artifact: slow tumble on two axes, grow-in on reveal ─────────────────
        aleph.rotation.y += 0.28 * dt
        aleph.rotation.x += 0.13 * dt
        if (revealing && revealT < 1) {
          revealT = Math.min(1, revealT + dt / 1.3)
          aleph.scale.setScalar(ALEPH_SCALE * easeOut3(revealT))
        }

        // ── Vessel: warp in, cruise to the artifact, pull up alongside — or wreck ─
        if (!ship.dying) {
          if (T < WARP_DUR) {
            const p = Math.min(1, T / WARP_DUR), e = 1 - Math.pow(1 - p, 3)
            ship.pos.x = THREE.MathUtils.lerp(WARP_FROM_X, WARP_TO_X, e)
            emitTrail()
          } else if (!ship.stationary) {
            ship.trailPrev = null
            const remaining = STOP_X - ship.pos.x
            if (remaining > 0.06) {
              const speed = Math.min(CRUISE_SPEED, Math.max(2.2, remaining * 1.3))   // ease in to the stop
              ship.pos.x += Math.min(speed * dt, remaining)
            } else { ship.stationary = true }
          }
          shipGroup.position.copy(ship.pos)
          if (!revealing && ship.pos.x >= REVEAL_X) { revealing = true; aleph.visible = true }
        } else {
          wreck.t += dt
          ship.pos.addScaledVector(ship.driftVel, dt); shipGroup.position.copy(ship.pos)
          shipGroup.rotateZ(0.06 * dt); shipGroup.rotateX(0.025 * dt)
          if (wreck.t < DEATH_DUR) {
            wreck.blastCd -= dt
            if (wreck.blastCd <= 0) { spawnBlast(hullPoint(), false); wreck.blastCd = 0.1 + Math.random() * 0.2 }
            shipMat.emissiveIntensity = 0.6 + Math.random() * 1.2
            for (const f of fires) if (f.mesh.visible) f.mat.opacity = 0.5 + 0.5 * Math.random()
          } else if (!wreck.final) {
            wreck.final = true
            spawnBlast(ship.pos.clone(), true)
            shipMat.color.setHex(0x2b2e34); shipMat.emissive.setHex(0x160b06)
            shipMat.emissiveIntensity = 0.25; shipMat.metalness = 0.3; shipMat.roughness = 0.95
            glows.forEach(g => (g.visible = false))
            fires.forEach((f, i) => { f.mesh.visible = i < 2 })
            if (!firedDlg3) { firedDlg3 = true; showComms(DLG3, true); setEnding(true) }
          } else {
            for (const f of fires) if (f.mesh.visible) f.mat.opacity = 0.2 + 0.2 * Math.abs(Math.sin(T * 4 + ship.pos.x))
            if (Math.random() < 0.04) spawnEmber(hullPoint(), 0xff6a30)
          }
        }

        // ── Scripted beats ───────────────────────────────────────────────────────
        if (!firedDlg1 && T >= 2.4) { firedDlg1 = true; showComms(DLG1, false) }
        if (ship.stationary && !ship.dying) {
          stationaryT += dt
          if (!firedDlg2 && stationaryT >= 1.2) { firedDlg2 = true; showComms(DLG2, false) }
          if (!scanStarted && stationaryT >= 4.8) { scanStarted = true; spawnFighter() }
        }

        // ── Scout fighter: fly out, scan, then hold ──────────────────────────────
        if (fighter && fighter.phase !== 'warp') {
          if (fighter.phase === 'fly') {
            fighter.t += dt
            const p = Math.min(1, fighter.t / FLY_DUR)
            fighter.pos.lerpVectors(fighter.from, SCAN_POS, easeInOut(p))
            orient(fighter.group, _dir.subVectors(SCAN_POS, fighter.from), 1 - Math.exp(-5 * dt))
            if (p >= 1) { fighter.phase = 'scan'; scanT = 0; startScanFX() }
          } else if (fighter.phase === 'scan' || fighter.phase === 'idle') {
            // gentle bob + face the artifact
            fighter.pos.copy(SCAN_POS); fighter.pos.y += Math.sin(T * 1.6) * 0.5
            orient(fighter.group, _dir.subVectors(ORIGIN, fighter.pos), 1 - Math.exp(-4 * dt))
          }
          fighter.group.position.copy(fighter.pos)
        }
        // scan beam + sweeping band while scanning
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
            scanBand.mesh.position.set(0, sweep, 0)
            scanBand.mat.opacity = 0.5 * (0.6 + 0.4 * Math.sin(T * 8))
          }
          if (scanT >= SCAN_DUR) { fighter.phase = 'idle'; scanDone = true; endScanFX() }
        }

        // ── Ambush: red bombers warp in once the scan is done ────────────────────
        if (scanDone && !bombersSpawned) {
          postScanT += dt
          if (postScanT >= 1.4) {
            bombersSpawned = true
            for (let i = 0; i < N_BOMBERS; i++) {
              const ang = (i / N_BOMBERS) * Math.PI * 2 + Math.random() * 0.6
              const b = makeBomber()
              b.pos.copy(ship.pos).add(new THREE.Vector3(18 + Math.random() * 16, (Math.random() - 0.5) * 18, Math.cos(ang) * (22 + Math.random() * 16)))
              b.pos.z += Math.sin(ang) * 6
              b.group.position.copy(b.pos); b.group.visible = true
              orient(b.group, _dir.subVectors(ship.pos, b.pos))
              spawnBlast(b.pos.clone(), false)
              bombers.push(b)
            }
          }
        }
        if (bombersSpawned && !ship.dying) {
          for (const b of bombers) {
            orient(b.group, _dir.subVectors(ship.pos, b.pos), 1 - Math.exp(-4 * dt))
            b.fireCd -= dt
            if (b.fireCd <= 0) { fireBomb(b); b.fireCd = 0.35 + Math.random() * 0.4 }
          }
        }

        // ── Bombs home onto the vessel, trail smoke, detonate on contact ─────────
        for (let i = bombs.length - 1; i >= 0; i--) {
          const bo = bombs[i]; bo.life += dt
          _tmp.subVectors(ship.pos, bo.mesh.position); const d = _tmp.length(); _tmp.normalize()
          bo.dir.lerp(_tmp, 0.05).normalize()
          bo.mesh.quaternion.setFromUnitVectors(yAxis, bo.dir)
          bo.mesh.position.addScaledVector(bo.dir, BOMB_SPEED * dt)
          bo.smokeCd -= dt; if (bo.smokeCd <= 0) { spawnSmoke(bo.mesh.position); bo.smokeCd = 0.03 }
          let done = false
          if (d < 6 && ship.alive) {
            spawnBlast(bo.mesh.position.clone(), false)
            ship.hp -= CUT_BOMB_DMG; revealFires()
            done = true
            if (ship.hp <= 0 && !ship.dying) {
              ship.dying = true; ship.alive = false
              ship.driftVel = new THREE.Vector3((Math.random() - 0.5) * 0.6, (Math.random() - 0.5) * 0.4, (Math.random() - 0.5) * 0.6)
              wreck = { t: 0, blastCd: 0, final: false }
            }
          } else if (bo.life > bo.max) done = true
          if (done) { scene.remove(bo.mesh); bombs.splice(i, 1) }
        }

        // ── Scout fighter warps out the moment the vessel is lost ────────────────
        if (fighter && ship.dying && !fighterWarped) { fighterWarped = true; fighter.phase = 'warp'; fighter.t = 0; endScanFX() }
        if (fighter && fighter.phase === 'warp') {
          fighter.t += dt
          const accel = 30 + fighter.t * 220
          fighter.pos.addScaledVector(fighter.warpDir, accel * dt)
          fighter.group.position.copy(fighter.pos)
          orient(fighter.group, fighter.warpDir, 1 - Math.exp(-8 * dt))
          const stretch = 1 + fighter.t * 16
          fighter.group.scale.set(1, 1, stretch)
          if (fighter.t > 0.5) { scene.remove(fighter.group); fighter = null }
        }

        // ── FX updates ───────────────────────────────────────────────────────────
        for (let i = blasts.length - 1; i >= 0; i--) {
          const x = blasts[i]; x.life += dt; const k = x.life / x.max
          x.fire.scale.setScalar((0.3 + k * 3.4) * x.s); x.fmat.color.setRGB(1, 0.85 - k * 0.55, 0.5 - k * 0.45); x.fmat.opacity = Math.max(0, 1 - k)
          const rk = Math.min(1, k * 1.4); x.ring.scale.setScalar((0.5 + rk * 6) * x.s); x.ring.lookAt(camera.position); x.rmat.opacity = Math.max(0, 0.85 * (1 - rk))
          if (x.life >= x.max) { scene.remove(x.fire); scene.remove(x.ring); x.fmat.dispose(); x.rmat.dispose(); blasts.splice(i, 1) }
        }
        for (let i = puffs.length - 1; i >= 0; i--) {
          const p = puffs[i]; p.life += dt; p.mesh.scale.multiplyScalar(1 + dt * 1.6); p.mat.opacity = Math.max(0, 0.5 * (1 - p.life / p.max))
          if (p.life >= p.max) { scene.remove(p.mesh); p.mat.dispose(); puffs.splice(i, 1) }
        }
        for (let i = embers.length - 1; i >= 0; i--) {
          const em = embers[i]; em.life += dt; em.mesh.position.addScaledVector(em.vel, dt); em.mesh.scale.multiplyScalar(0.986); em.mat.opacity = Math.max(0, 0.9 * (1 - em.life / em.max))
          if (em.life >= em.max) { scene.remove(em.mesh); em.mat.dispose(); embers.splice(i, 1) }
        }
        for (let i = trails.length - 1; i >= 0; i--) {
          const tr = trails[i]; tr.life += dt; tr.mat.opacity = Math.max(0, 0.55 * (1 - tr.life / tr.max))
          if (tr.life >= tr.max) { scene.remove(tr.mesh); tr.mat.dispose(); trails.splice(i, 1) }
        }

        // camera rides with the vessel, easing toward a two-shot once alongside
        _v.copy(ship.pos).add(CAM_OFF)
        camera.position.lerp(_v, 1 - Math.exp(-3 * dt))
        camTarget.lerp(lookGoal(), 1 - Math.exp(-3 * dt)); camera.lookAt(camTarget)

        composer.render()
        raf = requestAnimationFrame(frame)
      }

      composer = new EffectComposer(renderer)
      composer.addPass(new RenderPass(scene, camera))
      composer.addPass(new UnrealBloomPass(new THREE.Vector2(w, h), 0.6, 0.5, 0.25))
      frame()

      const onResize = () => {
        const nw = mount.clientWidth, nh = mount.clientHeight; if (!nw || !nh) return
        camera.aspect = nw / nh; camera.updateProjectionMatrix(); renderer.setSize(nw, nh); composer.setSize(nw, nh)
      }
      const ro = new ResizeObserver(onResize); ro.observe(mount)

      return () => {
        cancelAnimationFrame(raf); ro.disconnect()
        disposables.forEach(d => d.dispose && d.dispose())
        aleph.traverse(n => { n.geometry?.dispose?.(); if (n.material) (Array.isArray(n.material) ? n.material : [n.material]).forEach(m => m.dispose()) })
        endScanFX()
        blasts.forEach(x => { x.fmat.dispose(); x.rmat.dispose() })
        puffs.forEach(p => p.mat.dispose()); embers.forEach(e => e.mat.dispose()); trails.forEach(tr => tr.mat.dispose())
        bombs.forEach(b => scene.remove(b.mesh))
        composer.dispose && composer.dispose(); renderer.dispose()
        if (renderer.domElement.parentNode) renderer.domElement.parentNode.removeChild(renderer.domElement)
      }
    } catch (err) {
      console.error('Cutscene failed to initialise:', err)
      if (renderer) { try { renderer.dispose() } catch (_) {} }
    }
  }, [resetKey])

  return (
    <div id="cutscene-screen">
      <HudHeader onLogout={onReturn} right={<span className="label">CUTSCENE / FIRST CONTACT</span>} />
      <div className="sb-stage">
        <div className="sb-canvas" ref={mountRef} />

        {comms && (
          <div className={`sb-comms sb-comms--${comms.team}`} key={comms.id}>
            <img className="sb-comms-portrait" src={comms.portrait} alt="" />
            <div className="sb-comms-body">
              <div className="sb-comms-name">{comms.name}</div>
              <div className="sb-comms-text">{renderCommsBody(comms.segments, commsText.length)}<span className="sb-comms-cursor">▋</span></div>
            </div>
          </div>
        )}

        {!showUrgent && <button className="cut-replay" onClick={() => setResetKey(k => k + 1)}>⟳ REPLAY</button>}
      </div>

      <div className={`cut-fade${fadeBlack ? ' cut-fade--on' : ''}`} />

      {showUrgent && (
        <UrgentMessageOverlay
          sender="Admiralty Command"
          body="We've had an urgent distress call from the Science Vessel Cassiopeia, on a classified mission. They've called for immediate assistance. Get ready to deploy the fleet."
          dismissLabel="TO BATTLE"
          onClose={() => (onComplete ?? onReturn)?.()}
        />
      )}
    </div>
  )
}
