import { useState, useRef, useEffect } from 'react'
import * as THREE from 'three'
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js'
import HudHeader from '../components/HudHeader'
import { TEAMS, BOMBER_SCALE, COMMS_PORTRAIT } from './battle/constants'
import { NEBULA_VERT, NEBULA_FRAG, buildBlueCapital, buildRedBomber } from './battle/geometry'
import { renderCommsBody } from './battle/RosterUI'
import UrgentMessageOverlay from './battle/UrgentMessageOverlay'
import './battle/battle.css'

// ── Scripted timeline (seconds from scene start) ─────────────────────────────
const WARP_FROM_X = -210   // supply ship streaks in from far behind
const WARP_DUR    = 1.0
const CRUISE_SPEED = 7      // steady forward drift along +X
const COMMS1_T    = 3.6    // "Arrived in system. All looks clear."
const BOMBERS_T   = 8.0    // red bombers ambush out of nowhere
const N_BOMBERS   = 6
const BOMB_SPEED  = 36
const CUT_HP      = 60
const CUT_BOMB_DMG = 3
const DEATH_DUR   = 1.8

const LINE_1 = 'Arrived in system. All looks clear.'
const LINE_2 = 'Abandon ship! Contact high command, we need reinforcements immediately!'

export default function CutsceneScreen({ onReturn, onComplete }) {
  const mountRef = useRef(null)
  const [resetKey, setResetKey] = useState(0)
  const [comms, setComms] = useState(null)        // { id, team, name, portrait, text, segments, persist }
  const [commsText, setCommsText] = useState('')  // progressively-typed body
  const commsSeq = useRef(0)
  const [ending,     setEnding]     = useState(false)  // abandon-ship shown → end sequence begins
  const [fadeBlack,  setFadeBlack]  = useState(false)  // screen fading to black
  const [showUrgent, setShowUrgent] = useState(false)  // urgent transmission overlay visible

  // typewriter: type the line out, then (unless it persists) auto-hide
  useEffect(() => {
    if (!comms) { setCommsText(''); return }
    setCommsText('')
    let i = 0
    const full = comms.text
    const typer = setInterval(() => { i++; setCommsText(full.slice(0, i)); if (i >= full.length) clearInterval(typer) }, 42)
    if (comms.persist) return () => clearInterval(typer)
    const hide = setTimeout(() => setComms(null), 4200)
    return () => { clearInterval(typer); clearTimeout(hide) }
  }, [comms?.id])

  // reset comms / end-sequence whenever the scene replays
  useEffect(() => { setComms(null); setEnding(false); setFadeBlack(false); setShowUrgent(false) }, [resetKey])

  // End sequence: a few seconds after "abandon ship", fade to black, then show
  // the urgent transmission from Admiralty Command.
  useEffect(() => {
    if (!ending) return
    const t = setTimeout(() => setFadeBlack(true), 4200)
    return () => clearTimeout(t)
  }, [ending])
  useEffect(() => {
    if (!fadeBlack) return
    const t = setTimeout(() => setShowUrgent(true), 1300)   // after the 1.2s fade completes
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
      const camera = new THREE.PerspectiveCamera(50, w / h, 0.1, 800)

      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
      renderer.setSize(w, h)
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
      mount.appendChild(renderer.domElement)

      scene.add(new THREE.AmbientLight(0x4a5a80, 0.8))
      const key = new THREE.DirectionalLight(0xcfe0ff, 0.85); key.position.set(6, 12, 8); scene.add(key)
      const rim = new THREE.DirectionalLight(0x4060a0, 0.4); rim.position.set(-10, -4, -12); scene.add(rim)

      // nebula skydome + stars (matches the battle backdrop)
      const nebGeo = new THREE.SphereGeometry(360, 32, 32)
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
      disposables.push(blastGeo, ringGeo, bombGeo, trailGeo)
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

      // ── Build the blue supply (capital) ship ──────────────────────────────────
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
        pos: new THREE.Vector3(WARP_FROM_X, 0, 0),
        hp: CUT_HP, alive: true, dying: false, driftVel: null, trailPrev: null,
      }
      orient(shipGroup, new THREE.Vector3(1, 0, 0))   // faces +X (its travel direction)
      shipGroup.position.copy(ship.pos)

      // camera rides behind-and-above the ship for a 3/4 cinematic view
      const CAM_OFF = new THREE.Vector3(-34, 14, 30)
      camera.position.copy(ship.pos).add(CAM_OFF)
      camera.lookAt(ship.pos.x + 8, ship.pos.y, ship.pos.z)

      // ── Red bomber ambushers (spawned later) ──────────────────────────────────
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
      // a random world point within an oriented box around the hull
      const hullPoint = () => _e.set((Math.random() - 0.5) * 7, (Math.random() - 0.5) * 5, (Math.random() - 0.5) * 18).applyQuaternion(shipGroup.quaternion).add(ship.pos)
      // glowing warp streak left behind the ship as it jumps in
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

      // scripted-event latches
      let wreck = null, T = 0, firedComms1 = false, bombersSpawned = false, firedComms2 = false
      const showComms = (text, persist) => setComms({ id: ++commsSeq.current, team: 'blue', name: 'Supply Ship', portrait: COMMS_PORTRAIT.blue, text, segments: [{ text }], persist })

      const clock = new THREE.Clock()
      const frame = () => {
        const dt = Math.min(clock.getDelta(), 0.05)
        T += dt

        // ── Supply ship: warp in, then cruise forward — or drift as a wreck ──────
        if (!ship.dying) {
          if (T < WARP_DUR) {
            const p = Math.min(1, T / WARP_DUR), e = 1 - Math.pow(1 - p, 3)
            ship.pos.x = THREE.MathUtils.lerp(WARP_FROM_X, 0, e)
            emitTrail()
          } else {
            ship.pos.x += CRUISE_SPEED * dt
            ship.trailPrev = null
          }
          shipGroup.position.copy(ship.pos)
        } else {
          wreck.t += dt
          ship.pos.addScaledVector(ship.driftVel, dt); shipGroup.position.copy(ship.pos)
          shipGroup.rotateZ(0.06 * dt); shipGroup.rotateX(0.025 * dt)   // slow tumble
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
            if (!firedComms2) { firedComms2 = true; showComms(LINE_2, true); setEnding(true) }
          } else {
            for (const f of fires) if (f.mesh.visible) f.mat.opacity = 0.2 + 0.2 * Math.abs(Math.sin(T * 4 + ship.pos.x))
            if (Math.random() < 0.04) spawnEmber(hullPoint(), 0xff6a30)
          }
        }

        // ── Scripted beats ──────────────────────────────────────────────────────
        if (!firedComms1 && T >= COMMS1_T) { firedComms1 = true; showComms(LINE_1, false) }
        if (!bombersSpawned && T >= BOMBERS_T) {
          bombersSpawned = true
          for (let i = 0; i < N_BOMBERS; i++) {
            const ang = (i / N_BOMBERS) * Math.PI * 2 + Math.random() * 0.6
            const b = makeBomber()
            b.pos.copy(ship.pos).add(new THREE.Vector3(20 + Math.random() * 16, (Math.random() - 0.5) * 18, Math.cos(ang) * (24 + Math.random() * 18)))
            b.pos.z += Math.sin(ang) * 6
            b.group.position.copy(b.pos); b.group.visible = true
            orient(b.group, _dir.subVectors(ship.pos, b.pos))
            spawnBlast(b.pos.clone(), false)   // pop-in flash
            bombers.push(b)
          }
        }

        // bombers bombard while the ship still lives
        if (bombersSpawned && !ship.dying) {
          for (const b of bombers) {
            orient(b.group, _dir.subVectors(ship.pos, b.pos), 1 - Math.exp(-4 * dt))
            b.fireCd -= dt
            if (b.fireCd <= 0) { fireBomb(b); b.fireCd = 0.35 + Math.random() * 0.4 }
          }
        }

        // ── Bombs: gently home onto the ship, trail smoke, detonate on contact ──
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
              ship.driftVel = new THREE.Vector3(CRUISE_SPEED * 0.25 + (Math.random() - 0.5) * 0.6, (Math.random() - 0.5) * 0.4, (Math.random() - 0.5) * 0.6)
              wreck = { t: 0, blastCd: 0, final: false }
            }
          } else if (bo.life > bo.max) done = true
          if (done) { scene.remove(bo.mesh); bombs.splice(i, 1) }
        }

        // ── FX updates ──────────────────────────────────────────────────────────
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

        // camera rides with the ship
        _v.copy(ship.pos).add(CAM_OFF)
        camera.position.lerp(_v, 1 - Math.exp(-3 * dt))
        camera.lookAt(ship.pos.x + 8, ship.pos.y, ship.pos.z)

        composer.render()
        raf = requestAnimationFrame(frame)
      }

      composer = new EffectComposer(renderer)
      composer.addPass(new RenderPass(scene, camera))
      composer.addPass(new UnrealBloomPass(new THREE.Vector2(w, h), 0.9, 0.6, 0.2))
      frame()

      const onResize = () => {
        const nw = mount.clientWidth, nh = mount.clientHeight; if (!nw || !nh) return
        camera.aspect = nw / nh; camera.updateProjectionMatrix(); renderer.setSize(nw, nh); composer.setSize(nw, nh)
      }
      const ro = new ResizeObserver(onResize); ro.observe(mount)

      return () => {
        cancelAnimationFrame(raf); ro.disconnect()
        disposables.forEach(d => d.dispose && d.dispose())
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
      <HudHeader onLogout={onReturn} right={<span className="label">CUTSCENE / SUPPLY RUN</span>} />
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

      {/* fade the whole screen to black before the transmission */}
      <div className={`cut-fade${fadeBlack ? ' cut-fade--on' : ''}`} />

      {showUrgent && (
        <UrgentMessageOverlay
          sender="Admiralty Command"
          body="One of our ships has just been ambushed by unknown attackers. Activating the fleet now. Get ready to command, Admiral."
          dismissLabel="TO BATTLE"
          onClose={() => (onComplete ?? onReturn)?.()}
        />
      )}
    </div>
  )
}
