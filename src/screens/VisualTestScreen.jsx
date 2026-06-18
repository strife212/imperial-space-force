import { useState, useRef, useEffect } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js'
import HudHeader from '../components/HudHeader'
import {
  TEAMS, BOMBER_SCALE, CRUISER_SCALE, CAP_WEAPONS,
  MISSILE_SPEED, MISSILE_LIFE, MISSILE_TURN, MISSILE_ACCEL, MISSILE_LAUNCH_SPEED, MISSILE_SALVO,
  BOLT_SPEED, BOMB_LIFE,
} from './battle/constants'
import {
  NEBULA_VERT, NEBULA_FRAG, buildBlueModel, buildRedModel, buildBlueCapital, buildRedCapital,
  buildBlueBomber, buildRedBomber, buildBlueCruiser, buildRedCruiser, makeShield,
} from './battle/geometry'

const TYPES = ['fighter', 'bomber', 'cruiser', 'capital']
const LABEL = { fighter: 'Fighter', bomber: 'Bomber', cruiser: 'Cruiser', capital: 'Capital' }
const scaleFor = (k) => k === 'capital' ? 3.2 : k === 'bomber' ? BOMBER_SCALE : k === 'cruiser' ? CRUISER_SCALE : 1
const buildGeo = (k, team) =>
  k === 'capital' ? (team === 'blue' ? buildBlueCapital() : buildRedCapital())
  : k === 'bomber' ? (team === 'blue' ? buildBlueBomber() : buildRedBomber())
  : k === 'cruiser' ? (team === 'blue' ? buildBlueCruiser() : buildRedCruiser())
  : (team === 'blue' ? buildBlueModel() : buildRedModel())

export default function VisualTestScreen({ onReturn }) {
  const mountRef = useRef(null)
  const [blueType, setBlueType] = useState('fighter')
  const [redType, setRedType]   = useState('fighter')
  const [resetKey, setResetKey] = useState(0)
  const [flares, setFlares]     = useState(false)   // unlimited flares (capital/bomber decoy every missile)
  const flaresRef = useRef(flares)
  useEffect(() => { flaresRef.current = flares }, [flares])

  useEffect(() => {
    const mount = mountRef.current
    if (!mount) return
    let renderer, composer, raf
    const disposables = []
    try {
      const w = mount.clientWidth || 1, h = mount.clientHeight || 1
      const scene = new THREE.Scene()
      const camera = new THREE.PerspectiveCamera(50, w / h, 0.1, 600)
      camera.position.set(0, 16, 46)

      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
      renderer.setSize(w, h)
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
      mount.appendChild(renderer.domElement)

      const controls = new OrbitControls(camera, renderer.domElement)
      controls.enableDamping = true; controls.dampingFactor = 0.06; controls.enablePan = false
      controls.minDistance = 14; controls.maxDistance = 120
      controls.autoRotate = true; controls.autoRotateSpeed = 0.2
      controls.target.set(0, 0, 0)

      scene.add(new THREE.AmbientLight(0x4a5a80, 0.8))
      const key = new THREE.DirectionalLight(0xcfe0ff, 0.85); key.position.set(6, 12, 8); scene.add(key)
      const rim = new THREE.DirectionalLight(0x4060a0, 0.4); rim.position.set(-10, -4, -12); scene.add(rim)

      // nebula skydome + stars (matches the battle backdrop)
      const nebGeo = new THREE.SphereGeometry(330, 32, 32)
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
      const starCount = 900, sp = new Float32Array(starCount * 3)
      for (let i = 0; i < starCount; i++) {
        const rr = 120 + Math.random() * 180, th = Math.random() * Math.PI * 2, ph = Math.acos(2 * Math.random() - 1)
        sp[i * 3] = rr * Math.sin(ph) * Math.cos(th); sp[i * 3 + 1] = rr * Math.sin(ph) * Math.sin(th); sp[i * 3 + 2] = rr * Math.cos(ph)
      }
      const starGeo = new THREE.BufferGeometry(); starGeo.setAttribute('position', new THREE.BufferAttribute(sp, 3))
      const starMat = new THREE.PointsMaterial({ size: 0.7, sizeAttenuation: true, color: 0x9fb4d8, transparent: true, opacity: 0.85 })
      scene.add(new THREE.Points(starGeo, starMat)); disposables.push(starGeo, starMat)

      // shared projectile geometry / materials
      const boltGeo = new THREE.CylinderGeometry(0.08, 0.08, 1.7, 6)
      const bombGeo = new THREE.BoxGeometry(0.6, 1.5, 0.2)
      const missileGeo = new THREE.CylinderGeometry(0.13, 0.07, 1.4, 6)
      const blastGeo = new THREE.SphereGeometry(1, 12, 12)
      const ringGeo = new THREE.RingGeometry(0.62, 1.0, 24)
      disposables.push(boltGeo, bombGeo, missileGeo, blastGeo, ringGeo)
      const boltMat = {
        blue: new THREE.MeshBasicMaterial({ color: TEAMS.blue.bolt, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }),
        red:  new THREE.MeshBasicMaterial({ color: TEAMS.red.bolt,  transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }),
      }
      const glowMat = {
        blue: new THREE.MeshBasicMaterial({ color: TEAMS.blue.bolt, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false }),
        red:  new THREE.MeshBasicMaterial({ color: TEAMS.red.bolt,  transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false }),
      }
      const bombMat = new THREE.MeshBasicMaterial({ color: 0xffb030, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false })
      const missileMat = new THREE.MeshBasicMaterial({ color: 0xffcaa0, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false })
      const smokeProto = new THREE.MeshBasicMaterial({ color: 0x8c8c8c, transparent: true, opacity: 0.5, depthWrite: false })
      disposables.push(boltMat.blue, boltMat.red, glowMat.blue, glowMat.red, bombMat, missileMat, smokeProto)

      const UP = new THREE.Vector3(0, 1, 0), ORIGIN = new THREE.Vector3(), yAxis = new THREE.Vector3(0, 1, 0)
      const _m = new THREE.Matrix4(), _q = new THREE.Quaternion()
      const _dir = new THREE.Vector3(), _tmp = new THREE.Vector3(), _acc = new THREE.Vector3(), _tan = new THREE.Vector3()
      const orient = (q, dir, smooth) => {
        if (dir.lengthSq() < 1e-6) return
        _m.lookAt(dir, ORIGIN, UP); _q.setFromRotationMatrix(_m)
        if (smooth == null) q.copy(_q); else q.slerp(_q, smooth)
      }

      // ── Build the two ships ───────────────────────────────────────────────────
      const makeShip = (team, kind, x) => {
        const geo = buildGeo(kind, team)
        const mat = new THREE.MeshStandardMaterial({ color: TEAMS[team].color, emissive: TEAMS[team].color, emissiveIntensity: 0.5, metalness: 0.6, roughness: 0.4 })
        disposables.push(geo, mat)
        const group = new THREE.Group()
        group.add(new THREE.Mesh(geo, mat))
        const glows = []
        const tails = kind === 'capital' ? [[-0.45, -3.1], [0.45, -3.1]] : kind === 'cruiser' ? [[0, -1.5]] : kind === 'bomber' ? [[0, -1.4]] : [[0, -0.95]]
        for (const [gx, gz] of tails) { const g = new THREE.Mesh(blastGeo, glowMat[team]); g.scale.setScalar(kind === 'capital' ? 0.7 : 0.4); g.position.set(gx, 0, gz); group.add(g); glows.push(g) }
        let shield = null
        if (kind === 'capital') {
          shield = makeShield(TEAMS[team].bolt)
          const ss = team === 'blue' ? { x: 2.2, y: 2.0, z: 4.8, z0: 1.2 } : { x: 3.0, y: 2.4, z: 4.6, z0: 0.5 }
          shield.mesh.scale.set(ss.x, ss.y, ss.z); shield.mesh.position.set(0, 0, ss.z0)
          group.add(shield.mesh); disposables.push(shield.geo, shield.mat)
        }
        const s = scaleFor(kind)
        group.scale.setScalar(s)
        const pos = new THREE.Vector3(x, (Math.random() - 0.5) * 4, (Math.random() - 0.5) * 8)
        group.position.copy(pos)
        scene.add(group)
        const speed = kind === 'capital' ? 2.6 : kind === 'bomber' ? 4.5 : kind === 'cruiser' ? 5.0 : 7.2
        const standoff = kind === 'cruiser' ? 26 : kind === 'capital' ? 24 : 14
        const fireBase = kind === 'capital' ? 1.2 : kind === 'cruiser' ? 3.0 : kind === 'bomber' ? 1.8 : 1.0
        return {
          team, kind, group, mat, glows, shield, baseScale: s, pos,
          vel: new THREE.Vector3((team === 'blue' ? 1 : -1) * 2, 0, 0), quat: new THREE.Quaternion(),
          speed, standoff, fireBase, fireCd: 0.6 + Math.random() * fireBase, shieldFlash: 0,
        }
      }
      const blue = makeShip('blue', blueType, -20)
      const red  = makeShip('red', redType, 20)
      const ships = [blue, red]
      ships.forEach(s => orient(s.quat, s.vel))

      // ── Projectiles / FX ──────────────────────────────────────────────────────
      const bolts = [], blasts = [], puffs = [], flameFX = []
      // small balls of flame ejected from a ship when it pops flares — burst
      // outward from just off the hull in all directions so they read clearly
      const spawnFlares = (sh) => {
        const big = sh.kind === 'capital' ? 2.4 : sh.kind === 'bomber' ? 1.4 : 1
        for (let n = 0; n < 10; n++) {
          const mat = new THREE.MeshBasicMaterial({ color: n % 2 ? 0xffe070 : 0xff8a30, transparent: true, opacity: 1, blending: THREE.AdditiveBlending, depthWrite: false })
          const m = new THREE.Mesh(blastGeo, mat)
          const dir = new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize()
          m.position.copy(sh.pos).addScaledVector(dir, 1.6 * big)   // start off the hull
          m.scale.setScalar((0.8 + Math.random() * 0.6) * big)
          scene.add(m)
          flameFX.push({ mesh: m, mat, vel: dir.multiplyScalar(15 + Math.random() * 11), life: 0, max: 0.9 + Math.random() * 0.6 })
        }
      }
      const spawnSmoke = (p) => {
        const mat = smokeProto.clone(); const m = new THREE.Mesh(blastGeo, mat)
        m.position.copy(p); m.scale.setScalar(0.22 + Math.random() * 0.16); scene.add(m)
        puffs.push({ mesh: m, mat, life: 0, max: 0.5 + Math.random() * 0.3 })
      }
      const spawnBlast = (p, big) => {
        const sc = big ? 1.7 : 1
        const fmat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 1, blending: THREE.AdditiveBlending, depthWrite: false })
        const fire = new THREE.Mesh(blastGeo, fmat); fire.position.copy(p); fire.scale.setScalar(0.3 * sc); scene.add(fire)
        const rmat = new THREE.MeshBasicMaterial({ color: 0xffd9a0, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })
        const ring = new THREE.Mesh(ringGeo, rmat); ring.position.copy(p); ring.scale.setScalar(0.5 * sc); scene.add(ring)
        blasts.push({ fire, fmat, ring, rmat, life: 0, max: 0.6, s: sc })
      }
      const impact = (pos, target, big) => {
        spawnBlast(pos, big)
        if (target.shield) target.shieldFlash = 0.45   // capital shield flares on a hit
      }
      const fireBolt = (sh, target, big = false) => {
        _tmp.set(0, 0, 1).applyQuaternion(sh.quat)
        const start = sh.pos.clone().addScaledVector(_tmp, big ? 2.6 : 1.0)
        if (big) start.add(new THREE.Vector3((Math.random() - 0.5) * 3, (Math.random() - 0.5) * 1.6, (Math.random() - 0.5) * 3))
        const dir = target.pos.clone().sub(start).normalize()
        const mesh = new THREE.Mesh(boltGeo, boltMat[sh.team]); if (big) mesh.scale.set(2.3, 1.5, 2.3)
        mesh.position.copy(start); mesh.quaternion.setFromUnitVectors(yAxis, dir); scene.add(mesh)
        bolts.push({ mesh, dir, target, life: 0, maxLife: 2.4, speed: BOLT_SPEED, homing: 0.05, big })
      }
      const fireBomb = (sh, target) => {
        _tmp.set(0, 0, 1).applyQuaternion(sh.quat)
        const start = sh.pos.clone().addScaledVector(_tmp, 1.2)
        const dir = target.pos.clone().sub(start).normalize()
        const mesh = new THREE.Mesh(bombGeo, bombMat); mesh.position.copy(start); mesh.quaternion.setFromUnitVectors(yAxis, dir); scene.add(mesh)
        bolts.push({ mesh, dir, target, life: 0, maxLife: BOMB_LIFE * 2.4, speed: 34, homing: 0.06, bomb: true, smokeCd: 0 })
      }
      const fireMissile = (sh, target) => {
        const fwd = new THREE.Vector3(0, 0, 1).applyQuaternion(sh.quat).normalize()
        const down = new THREE.Vector3(0, -1, 0).applyQuaternion(sh.quat).normalize()
        const start = sh.pos.clone().addScaledVector(down, 0.5).addScaledVector(fwd, 0.3)
        const mesh = new THREE.Mesh(missileGeo, missileMat); mesh.position.copy(start); mesh.quaternion.setFromUnitVectors(yAxis, fwd); scene.add(mesh)
        bolts.push({ mesh, dir: fwd.clone(), target, life: 0, maxLife: MISSILE_LIFE, speed: MISSILE_SPEED, missile: true, smokeCd: 0, phase: 'drop', dropT: 0, dropDur: 0.32, dropDist: 1.7, dropDir: down, dropStart: start.clone(), fwd })
      }
      const fire = (sh, target) => {
        if (sh.kind === 'capital') for (let k = 0; k < CAP_WEAPONS; k++) fireBolt(sh, target, true)
        else if (sh.kind === 'cruiser') for (let k = 0; k < MISSILE_SALVO; k++) fireMissile(sh, target)
        else if (sh.kind === 'bomber') fireBomb(sh, target)
        else fireBolt(sh, target)
      }

      const clock = new THREE.Clock()
      const frame = () => {
        const dt = Math.min(clock.getDelta(), 0.05)

        for (const s of ships) {
          const e = s === blue ? red : blue
          // steer: hold a standoff range and orbit the opponent + wander
          _tmp.subVectors(e.pos, s.pos); const dist = _tmp.length() || 1; _tmp.divideScalar(dist)
          _acc.copy(_tmp).multiplyScalar(THREE.MathUtils.clamp((dist - s.standoff) * 0.8, -5, 8))
          _tan.crossVectors(UP, _tmp).normalize(); _acc.addScaledVector(_tan, 3)
          _acc.x += (Math.random() - 0.5) * 3; _acc.y += (Math.random() - 0.5) * 2.5; _acc.z += (Math.random() - 0.5) * 3
          const r = s.pos.length(); if (r > 30) _acc.addScaledVector(_dir.copy(s.pos).normalize(), -(r - 30) * 2)
          s.vel.addScaledVector(_acc, dt)
          const sp = s.vel.length(); if (sp > s.speed) s.vel.multiplyScalar(s.speed / sp); else if (sp < s.speed * 0.4 && sp > 0) s.vel.multiplyScalar(s.speed * 0.4 / sp)
          s.pos.addScaledVector(s.vel, dt); s.group.position.copy(s.pos)
          orient(s.quat, _dir.copy(s.vel), 1 - Math.exp(-6 * dt)); s.group.quaternion.copy(s.quat)
          // shield flash decay
          if (s.shield) s.shield.mat.uniforms.uIntensity.value = s.shieldFlash > 0 ? Math.pow((s.shieldFlash -= dt) > 0 ? s.shieldFlash / 0.45 : 0, 0.7) : 0
          // fire
          s.fireCd -= dt
          if (s.fireCd <= 0) { fire(s, e); s.fireCd = s.fireBase * (0.8 + Math.random() * 0.6) }
        }

        for (let i = bolts.length - 1; i >= 0; i--) {
          const b = bolts[i]; b.life += dt
          if (b.missile && b.phase === 'drop') {
            b.dropT += dt; const p = Math.min(1, b.dropT / b.dropDur); const ez = 1 - Math.pow(1 - p, 2)
            b.mesh.position.copy(b.dropStart).addScaledVector(b.dropDir, b.dropDist * ez)
            if (p >= 1) { b.dir.copy(b.fwd); b.phase = 'fly'; b.life = 0; b.curSpeed = MISSILE_LAUNCH_SPEED }
            continue
          }
          let done = false
          _tmp.subVectors(b.target.pos, b.mesh.position); const d = _tmp.length()
          // flare decoy: as the missile closes, the ship pops flares, the missile
          // loses its lock, flies straight past, and detonates harmlessly beyond.
          if (b.missile && !b.decoyed && flaresRef.current && (b.target.kind === 'capital' || b.target.kind === 'bomber') && d < 12) {
            b.decoyed = true
            b.fuse = 0.45 + Math.random() * 0.45
            spawnFlares(b.target)
          }
          if (b.decoyed) {
            b.fuse -= dt
            if (b.fuse <= 0) { spawnBlast(b.mesh.position.clone(), false); done = true }   // explodes after sailing past
          } else if (d < (b.target.kind === 'capital' ? 6 : 1.6)) {
            impact(b.mesh.position.clone(), b.target, b.big || b.bomb || b.missile)
            done = true
          } else {
            _tmp.normalize()
            if (b.missile) { const ang = b.dir.angleTo(_tmp), st = MISSILE_TURN * dt; if (ang <= st) b.dir.copy(_tmp); else { _tan.crossVectors(b.dir, _tmp).normalize(); if (_tan.lengthSq() > 1e-6) b.dir.applyAxisAngle(_tan, st).normalize() } }
            else b.dir.lerp(_tmp, b.homing).normalize()
            b.mesh.quaternion.setFromUnitVectors(yAxis, b.dir)
          }
          if (!done) {
            let spd = b.speed
            if (b.missile) { b.curSpeed = Math.min(b.speed, (b.curSpeed ?? MISSILE_LAUNCH_SPEED) + MISSILE_ACCEL * dt); spd = b.curSpeed }
            b.mesh.position.addScaledVector(b.dir, spd * dt)
            if (b.life > b.maxLife) done = true
          }
          if ((b.bomb || b.missile) && !done) { b.smokeCd -= dt; if (b.smokeCd <= 0) { spawnSmoke(b.mesh.position); b.smokeCd = 0.03 } }
          if (done) { scene.remove(b.mesh); bolts.splice(i, 1) }
        }

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
        for (let i = flameFX.length - 1; i >= 0; i--) {
          const f = flameFX[i]; f.life += dt
          f.mesh.position.addScaledVector(f.vel, dt); f.vel.multiplyScalar(0.985); f.mesh.scale.multiplyScalar(0.99)
          const k = f.life / f.max
          f.mat.color.setRGB(1, 0.7 - k * 0.45, 0.25 - k * 0.2)   // cool from yellow → deep orange as it dies
          f.mat.opacity = Math.max(0, 1 - k)
          if (f.life >= f.max) { scene.remove(f.mesh); f.mat.dispose(); flameFX.splice(i, 1) }
        }

        controls.update()
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
        cancelAnimationFrame(raf); ro.disconnect(); controls.dispose()
        disposables.forEach(d => d.dispose && d.dispose())
        blasts.forEach(x => { x.fmat.dispose(); x.rmat.dispose() }); puffs.forEach(p => p.mat.dispose()); flameFX.forEach(f => f.mat.dispose())
        composer.dispose && composer.dispose(); renderer.dispose()
        if (renderer.domElement.parentNode) renderer.domElement.parentNode.removeChild(renderer.domElement)
      }
    } catch (err) {
      console.error('Visual test failed to initialise:', err)
      if (renderer) { try { renderer.dispose() } catch (_) {} }
    }
  }, [blueType, redType, resetKey])

  const typeRow = (team, val, setVal) => (
    <div className={`vistest-team vistest-team--${team}`}>
      <span className="vistest-team-name">{team.toUpperCase()}</span>
      {TYPES.map(t => (
        <button key={t} className={`vistest-btn${val === t ? ' vistest-btn--on' : ''}`} onClick={() => setVal(t)}>{LABEL[t]}</button>
      ))}
    </div>
  )

  return (
    <div id="vistest-screen">
      <HudHeader onLogout={onReturn} right={<span className="label">VFX-LAB / COMBAT VISUAL TEST</span>} />
      <div className="vistest-stage">
        <div className="vistest-canvas" ref={mountRef} />
        <div className="vistest-controls">
          {typeRow('blue', blueType, setBlueType)}
          <div className="vistest-mid">
            <button className="vistest-reset" onClick={() => setResetKey(k => k + 1)}>⟳ RESET</button>
            <label className="vistest-check">
              <input type="checkbox" checked={flares} onChange={(e) => setFlares(e.target.checked)} />
              Flares: {flares ? 'unlimited' : 'off'}
            </label>
          </div>
          {typeRow('red', redType, setRedType)}
        </div>
        <div className="vistest-hint">Drag to orbit // scroll to zoom // ships are indestructible</div>
      </div>
    </div>
  )
}
