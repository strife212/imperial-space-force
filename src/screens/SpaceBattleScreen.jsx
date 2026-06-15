import { useRef, useEffect, useState } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import HudHeader from '../components/HudHeader'
import HudFooter from '../components/HudFooter'

// ── Battle parameters ──────────────────────────────────────────────────────────
const FLEET_SIZE  = 25
const SHIP_HP     = 6
const CAP_HP      = 60       // capital ship — tanky flagship
const CAP_SPEED   = 3.3      // capital ships lumber
const CAP_WEAPONS = 4        // bolts per capital volley
const BOLT_SPEED  = 46       // world units / second
const MISS_CHANCE = 0.28
const MAX_SPEED   = 7.5
const MIN_SPEED   = 2.6
const SEP_RADIUS  = 3.0
const BOUND_R     = 22       // ships steer back inside this radius
const TURN_RATE   = 7        // orientation slerp responsiveness
const TEAMS = {
  blue: { color: 0x3a93ff, bolt: 0x8fc6ff },
  red:  { color: 0xff3322, bolt: 0xff7a5a },
}

// Ship models — forward axis is +Z. Distinct silhouettes per side.
// Blue: sleek delta-wing interceptor.  Red: blocky forked cruiser.
function buildBlueModel() {
  const parts = []
  let g = new THREE.ConeGeometry(0.26, 1.2, 6); g.rotateX(Math.PI / 2); g.translate(0, 0, 0.35); parts.push(g)  // nose
  g = new THREE.BoxGeometry(0.3, 0.2, 0.95); g.translate(0, 0, -0.35); parts.push(g)         // fuselage body
  g = new THREE.BoxGeometry(1.6, 0.05, 0.72); g.translate(0, 0, -0.2); parts.push(g)         // delta wing
  g = new THREE.BoxGeometry(0.05, 0.44, 0.46); g.translate(0, 0.22, -0.55); parts.push(g)    // tail fin
  return mergeGeometries(parts, false)
}
function buildRedModel() {
  const parts = []
  let g = new THREE.BoxGeometry(0.74, 0.46, 1.7); parts.push(g)                              // chunky hull
  g = new THREE.BoxGeometry(0.16, 0.16, 1.15); g.translate(0.3, 0, 1.0);  parts.push(g)      // forward prong R
  g = new THREE.BoxGeometry(0.16, 0.16, 1.15); g.translate(-0.3, 0, 1.0); parts.push(g)      // forward prong L
  g = new THREE.BoxGeometry(0.36, 0.42, 0.55); g.translate(0, 0.36, -0.25); parts.push(g)    // command tower
  g = new THREE.BoxGeometry(0.22, 0.24, 1.15); g.translate(0.52, 0, -0.2);  parts.push(g)    // engine pod R
  g = new THREE.BoxGeometry(0.22, 0.24, 1.15); g.translate(-0.52, 0, -0.2); parts.push(g)    // engine pod L
  return mergeGeometries(parts, false)
}

// Capital ships — large flagships, same team aesthetic scaled up with more detail.
function buildBlueCapital() {
  const parts = []
  let g = new THREE.BoxGeometry(0.9, 0.62, 5.0); parts.push(g)                                        // slim hull
  g = new THREE.ConeGeometry(0.5, 3.6, 4); g.rotateX(Math.PI / 2); g.rotateZ(Math.PI / 4); g.translate(0, 0, 3.9); parts.push(g)  // long sharp prow
  g = new THREE.BoxGeometry(0.5, 0.4, 2.0); g.translate(0, 0.46, 0.3); parts.push(g)                  // low bridge spine
  g = new THREE.BoxGeometry(0.05, 0.78, 1.5); g.translate(0, 0.64, -1.9); parts.push(g)               // dorsal fin
  g = new THREE.BoxGeometry(0.72, 0.5, 0.8); g.translate(0, 0, -2.7); parts.push(g)                   // engine block
  return mergeGeometries(parts, false)
}
function buildRedCapital() {
  const parts = []
  let g = new THREE.BoxGeometry(2.1, 1.5, 5.6); parts.push(g)                                         // massive hull
  g = new THREE.BoxGeometry(0.45, 0.45, 2.6); g.translate(0.85, 0, 3.2);  parts.push(g)               // ram prong R
  g = new THREE.BoxGeometry(0.45, 0.45, 2.6); g.translate(-0.85, 0, 3.2); parts.push(g)               // ram prong L
  g = new THREE.BoxGeometry(0.72, 0.72, 3.6); g.translate(1.35, 0, -0.3);  parts.push(g)              // gun sponson R
  g = new THREE.BoxGeometry(0.72, 0.72, 3.6); g.translate(-1.35, 0, -0.3); parts.push(g)              // gun sponson L
  g = new THREE.BoxGeometry(0.65, 0.5, 0.85); g.translate(0, 0.98, 1.5);  parts.push(g)               // turret fwd
  g = new THREE.BoxGeometry(0.65, 0.5, 0.85); g.translate(0, 0.98, -0.2); parts.push(g)               // turret mid
  g = new THREE.BoxGeometry(0.65, 0.5, 0.85); g.translate(0, 0.98, -1.9); parts.push(g)               // turret aft
  g = new THREE.BoxGeometry(1.7, 1.15, 1.0); g.translate(0, 0, -3.1); parts.push(g)                   // engine block
  return mergeGeometries(parts, false)
}

export default function SpaceBattleScreen({ onReturn, unreadCount = 0, onMailOpen }) {
  const mountRef     = useRef(null)
  const blueCountRef = useRef(null)
  const redCountRef  = useRef(null)
  const [winner, setWinner] = useState(null)   // null | 'BLUE' | 'RED' | 'DRAW'
  const [runId,  setRunId]  = useState(0)

  useEffect(() => {
    const mount = mountRef.current
    if (!mount) return
    let renderer, composer, raf
    const disposables = []

    try {
      const w = mount.clientWidth || 1, h = mount.clientHeight || 1

      const scene = new THREE.Scene()
      const camera = new THREE.PerspectiveCamera(52, w / h, 0.1, 600)
      camera.position.set(0, 17, 40)

      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
      renderer.setSize(w, h)
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
      mount.appendChild(renderer.domElement)

      const controls = new OrbitControls(camera, renderer.domElement)
      controls.enableDamping = true
      controls.dampingFactor = 0.06
      controls.enablePan = false
      controls.minDistance = 18
      controls.maxDistance = 110
      controls.autoRotate = true
      controls.autoRotateSpeed = 0.25
      controls.target.set(0, 0, 0)

      // ── Lighting ─────────────────────────────────────────────────────────────
      scene.add(new THREE.AmbientLight(0x4a5a80, 0.8))
      const key = new THREE.DirectionalLight(0xbcd4ff, 0.7)
      key.position.set(0, 8, 12)
      scene.add(key)

      // ── Starfield ────────────────────────────────────────────────────────────
      const starCount = 1400
      const starPos = new Float32Array(starCount * 3)
      for (let i = 0; i < starCount; i++) {
        const rr = 90 + Math.random() * 200
        const th = Math.random() * Math.PI * 2
        const ph = Math.acos(2 * Math.random() - 1)
        starPos[i * 3]     = rr * Math.sin(ph) * Math.cos(th)
        starPos[i * 3 + 1] = rr * Math.sin(ph) * Math.sin(th)
        starPos[i * 3 + 2] = rr * Math.cos(ph)
      }
      const starGeo = new THREE.BufferGeometry()
      starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3))
      const starMat = new THREE.PointsMaterial({ color: 0x9fc4ff, size: 0.5, sizeAttenuation: true, transparent: true, opacity: 0.8 })
      scene.add(new THREE.Points(starGeo, starMat))
      disposables.push(starGeo, starMat)

      // ── Shared geometry ──────────────────────────────────────────────────────
      const teamGeo = { blue: buildBlueModel(), red: buildRedModel() }
      const capGeo  = { blue: buildBlueCapital(), red: buildRedCapital() }
      const boltGeo = new THREE.CylinderGeometry(0.08, 0.08, 1.7, 6)
      const blastGeo = new THREE.SphereGeometry(1, 12, 12)
      disposables.push(teamGeo.blue, teamGeo.red, capGeo.blue, capGeo.red, boltGeo, blastGeo)
      const boltMat = {
        blue: new THREE.MeshBasicMaterial({ color: TEAMS.blue.bolt, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }),
        red:  new THREE.MeshBasicMaterial({ color: TEAMS.red.bolt,  transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }),
      }
      disposables.push(boltMat.blue, boltMat.red)

      // reusable scratch objects (avoid per-frame allocation)
      const yAxis = new THREE.Vector3(0, 1, 0)
      const UP    = new THREE.Vector3(0, 1, 0)
      const ORIGIN = new THREE.Vector3(0, 0, 0)
      const _dir = new THREE.Vector3(), _tmp = new THREE.Vector3(), _acc = new THREE.Vector3()
      const _m = new THREE.Matrix4(), _q = new THREE.Quaternion()

      const orient = (mesh, dir, smooth) => {
        if (dir.lengthSq() < 1e-6) return
        _m.lookAt(dir, ORIGIN, UP)        // model +Z aligns to dir
        _q.setFromRotationMatrix(_m)
        if (smooth == null) mesh.quaternion.copy(_q)
        else mesh.quaternion.slerp(_q, smooth)
      }

      // ── Spawn the two fleets (loose cloud on each flank, charging inward) ─────
      const ships = []
      const spawnFleet = (team, sx, vdir) => {
        for (let i = 0; i < FLEET_SIZE; i++) {
          const row = i % 5, col = Math.floor(i / 5)
          const mat = new THREE.MeshStandardMaterial({
            color: TEAMS[team].color, emissive: TEAMS[team].color,
            emissiveIntensity: 0.5, metalness: 0.6, roughness: 0.4,
          })
          disposables.push(mat)
          const mesh = new THREE.Mesh(teamGeo[team], mat)
          const pos = new THREE.Vector3(
            sx + (Math.random() - 0.5) * 5,
            (row - 2) * 2.6 + (Math.random() - 0.5) * 2,
            (col - 2) * 2.8 + (Math.random() - 0.5) * 2,
          )
          const vel = new THREE.Vector3(vdir * (2 + Math.random() * 2), (Math.random() - 0.5), (Math.random() - 0.5))
          mesh.position.copy(pos)
          orient(mesh, vel)
          scene.add(mesh)
          ships.push({
            mesh, mat, team, hp: SHIP_HP, alive: true, pos, vel,
            fireCd: 0.5 + Math.random() * 2.5, flash: 0,
            isCapital: false, weapons: 1, maxSpeed: MAX_SPEED, minSpeed: MIN_SPEED, radius: 0,
          })
        }
      }
      spawnFleet('blue', -17, 1)    // blue charges from the left (+X)
      spawnFleet('red',   17, -1)   // red charges from the right (-X)

      // ── Capital ships (one tanky, heavily-armed flagship per side) ───────────
      const spawnCapital = (team, sx, vdir) => {
        const mat = new THREE.MeshStandardMaterial({
          color: TEAMS[team].color, emissive: TEAMS[team].color,
          emissiveIntensity: 0.55, metalness: 0.65, roughness: 0.35,
        })
        disposables.push(mat)
        const mesh = new THREE.Mesh(capGeo[team], mat)
        const pos = new THREE.Vector3(sx, 0, (Math.random() - 0.5) * 4)
        const vel = new THREE.Vector3(vdir * 2, 0, 0)
        mesh.position.copy(pos)
        orient(mesh, vel)
        scene.add(mesh)
        ships.push({
          mesh, mat, team, hp: CAP_HP, alive: true, pos, vel,
          fireCd: 0.5 + Math.random(), flash: 0,
          isCapital: true, weapons: CAP_WEAPONS, maxSpeed: CAP_SPEED, minSpeed: 0.8, radius: 5.5,
        })
      }
      spawnCapital('blue', -28, 1)
      spawnCapital('red',   28, -1)

      // ── Bolts & explosions ───────────────────────────────────────────────────
      const bolts = []
      const blasts = []

      const fireBolt = (shooter, target, big = false) => {
        const willHit = Math.random() > MISS_CHANCE
        _tmp.set(0, 0, 1).applyQuaternion(shooter.mesh.quaternion)        // muzzle direction
        const start = shooter.pos.clone().addScaledVector(_tmp, big ? 2.6 : 1.0)
        if (big) start.add(new THREE.Vector3((Math.random() - 0.5) * 3, (Math.random() - 0.5) * 1.6, (Math.random() - 0.5) * 3))  // spread across hardpoints
        const aim = target.pos.clone()
        if (!willHit) aim.add(new THREE.Vector3((Math.random() - 0.5) * 9, (Math.random() - 0.5) * 9, (Math.random() - 0.5) * 9))
        const dir = aim.sub(start).normalize()
        const mesh = new THREE.Mesh(boltGeo, boltMat[shooter.team])
        if (big) mesh.scale.set(2.3, 1.5, 2.3)
        mesh.position.copy(start)
        mesh.quaternion.setFromUnitVectors(yAxis, dir)
        scene.add(mesh)
        bolts.push({ mesh, dir, target, willHit, life: 0 })
      }

      const spawnBlast = (pos) => {
        const mat = new THREE.MeshBasicMaterial({ color: 0xffb04a, transparent: true, opacity: 1, blending: THREE.AdditiveBlending, depthWrite: false })
        const mesh = new THREE.Mesh(blastGeo, mat)
        mesh.position.copy(pos)
        mesh.scale.setScalar(0.4)
        scene.add(mesh)
        blasts.push({ mesh, mat, life: 0, max: 0.55 })
      }

      const damage = (ship) => {
        ship.hp -= 1
        ship.flash = 0.12
        if (ship.hp <= 0 && ship.alive) {
          ship.alive = false
          spawnBlast(ship.pos)
          scene.remove(ship.mesh)
        }
      }

      let gameOver = false
      const counts = () => ({
        blue: ships.filter(s => s.team === 'blue' && s.alive).length,
        red:  ships.filter(s => s.team === 'red'  && s.alive).length,
      })

      // ── Frame loop ───────────────────────────────────────────────────────────
      const clock = new THREE.Clock()
      const frame = () => {
        const dt = Math.min(clock.getDelta(), 0.05)

        // ── Ships: steer (seek nearest enemy + separation + bounds), then fire ──
        for (const s of ships) {
          if (!s.alive) continue

          // find nearest living enemy
          let nearest = null, nd = Infinity
          for (const e of ships) {
            if (!e.alive || e.team === s.team) continue
            const d = s.pos.distanceToSquared(e.pos)
            if (d < nd) { nd = d; nearest = e }
          }

          _acc.set(0, 0, 0)
          if (nearest) {
            _tmp.subVectors(nearest.pos, s.pos).normalize()
            _acc.addScaledVector(_tmp, 9)                       // seek
          }
          // separation from all nearby ships (keeps the melee from collapsing;
          // larger ships claim more space via their radius)
          for (const o of ships) {
            if (o === s || !o.alive) continue
            const d = s.pos.distanceTo(o.pos)
            const sepR = SEP_RADIUS + s.radius + o.radius
            if (d > 0 && d < sepR) {
              // small ships are pushed away from capitals far more firmly so they
              // don't clip into the hull; capitals aren't shoved by their escorts
              const w = (o.isCapital && !s.isCapital) ? 65 : 16
              _tmp.subVectors(s.pos, o.pos).multiplyScalar((sepR - d) / (d * sepR))
              _acc.addScaledVector(_tmp, w)
            }
          }
          // wander + keep inside the arena
          _acc.x += (Math.random() - 0.5) * 5
          _acc.y += (Math.random() - 0.5) * 4
          _acc.z += (Math.random() - 0.5) * 5
          const r = s.pos.length()
          if (r > BOUND_R) _acc.addScaledVector(_tmp.copy(s.pos).normalize(), -(r - BOUND_R) * 2.2)

          s.vel.addScaledVector(_acc, dt)
          let sp = s.vel.length()
          if (sp > s.maxSpeed) s.vel.multiplyScalar(s.maxSpeed / sp)
          else if (sp < s.minSpeed && sp > 0) s.vel.multiplyScalar(s.minSpeed / sp)
          s.pos.addScaledVector(s.vel, dt)
          s.mesh.position.copy(s.pos)
          orient(s.mesh, _dir.copy(s.vel), 1 - Math.exp(-TURN_RATE * dt))

          if (s.flash > 0) {
            s.flash -= dt
            s.mat.emissiveIntensity = s.flash > 0 ? 1.7 : 0.5
          }
          if (!gameOver) {
            s.fireCd -= dt
            if (s.fireCd <= 0) {
              if (s.weapons > 1) {
                // capital: rapid multi-bolt broadside spread across the enemy fleet
                const enemies = ships.filter(e => e.alive && e.team !== s.team)
                if (enemies.length) for (let k = 0; k < s.weapons; k++) fireBolt(s, enemies[(Math.random() * enemies.length) | 0], true)
                s.fireCd = 0.7 + Math.random() * 0.9
              } else if (nearest) {
                fireBolt(s, nearest)
                s.fireCd = 1.2 + Math.random() * 2.8
              }
            }
          }
        }

        // ── Bolts: home gently toward target (hits), or streak straight (misses)
        for (let i = bolts.length - 1; i >= 0; i--) {
          const b = bolts[i]
          b.life += dt
          let done = false
          if (b.willHit && b.target.alive) {
            _tmp.subVectors(b.target.pos, b.mesh.position)
            const d = _tmp.length()
            if (d < 1.3) { damage(b.target); done = true }
            else {
              b.dir.lerp(_tmp.normalize(), 0.12).normalize()
              b.mesh.quaternion.setFromUnitVectors(yAxis, b.dir)
            }
          }
          if (!done) {
            b.mesh.position.addScaledVector(b.dir, BOLT_SPEED * dt)
            if (b.life > 2.2) done = true
          }
          if (done) { scene.remove(b.mesh); bolts.splice(i, 1) }
        }

        // ── Explosions: expand & fade ──────────────────────────────────────────
        for (let i = blasts.length - 1; i >= 0; i--) {
          const x = blasts[i]
          x.life += dt
          const k = x.life / x.max
          x.mesh.scale.setScalar(0.4 + k * 5)
          x.mat.opacity = Math.max(0, 1 - k)
          if (x.life >= x.max) {
            scene.remove(x.mesh)
            x.mat.dispose()
            blasts.splice(i, 1)
          }
        }

        // ── Scoreboard + victory check ─────────────────────────────────────────
        const c = counts()
        if (blueCountRef.current) blueCountRef.current.textContent = c.blue
        if (redCountRef.current)  redCountRef.current.textContent  = c.red
        if (!gameOver && (c.blue === 0 || c.red === 0)) {
          gameOver = true
          setWinner(c.blue > 0 ? 'BLUE' : c.red > 0 ? 'RED' : 'DRAW')
        }

        controls.update()
        composer.render()
        raf = requestAnimationFrame(frame)
      }

      // ── Bloom ────────────────────────────────────────────────────────────────
      composer = new EffectComposer(renderer)
      composer.addPass(new RenderPass(scene, camera))
      composer.addPass(new UnrealBloomPass(new THREE.Vector2(w, h), 0.85, 0.55, 0.15))

      frame()

      const onResize = () => {
        const nw = mount.clientWidth, nh = mount.clientHeight
        if (!nw || !nh) return
        camera.aspect = nw / nh
        camera.updateProjectionMatrix()
        renderer.setSize(nw, nh)
        composer.setSize(nw, nh)
      }
      const ro = new ResizeObserver(onResize)
      ro.observe(mount)

      return () => {
        cancelAnimationFrame(raf)
        ro.disconnect()
        controls.dispose()
        disposables.forEach(d => d.dispose && d.dispose())
        blasts.forEach(x => x.mat.dispose())
        composer.dispose && composer.dispose()
        renderer.dispose()
        if (renderer.domElement.parentNode) renderer.domElement.parentNode.removeChild(renderer.domElement)
      }
    } catch (err) {
      console.error('Space battle failed to initialise:', err)
      if (renderer) { try { renderer.dispose() } catch (_) {} }
    }
  }, [runId])

  return (
    <div id="battle-screen">
      <HudHeader
        onLogout={onReturn}
        center={
          <span className={`status-pill mail-pill${unreadCount > 0 ? ' mail-pill--unread' : ''}`} onClick={onMailOpen}>
            {unreadCount > 0 && <span className="mail-unread-dot" />}
            ✉ IMPERIAL MESSAGING SERVICE // UNREAD: {unreadCount}
          </span>
        }
        right={<span className="label">TAC-SIM / FLEET ENGAGEMENT</span>}
      />

      <div className="sb-stage">
        <div className="sb-canvas" ref={mountRef} />

        <div className="sb-scoreboard">
          <span className="sb-score sb-score--blue">BLUE FLEET <span ref={blueCountRef} className="sb-count">{FLEET_SIZE + 1}</span></span>
          <span className="sb-vs">⚔ ENGAGED ⚔</span>
          <span className="sb-score sb-score--red"><span ref={redCountRef} className="sb-count">{FLEET_SIZE + 1}</span> RED FLEET</span>
        </div>

        {winner && (
          <div className="sb-victory">
            <div className="sb-victory-sub">ENGAGEMENT RESOLVED</div>
            <div className={`sb-victory-title sb-victory-title--${winner.toLowerCase()}`}>
              {winner === 'DRAW' ? 'MUTUAL ANNIHILATION' : `${winner} FLEET VICTORIOUS`}
            </div>
            <button className="sb-restart" onClick={() => { setWinner(null); setRunId(k => k + 1) }}>
              ⟳ RUN NEW ENGAGEMENT
            </button>
          </div>
        )}

        <div className="sb-hint">DRAG TO ORBIT // SCROLL TO ZOOM</div>
      </div>

      <HudFooter>
        <span>HMSS / TAC-SIM / FLEET ENGAGEMENT MODEL</span>
        <span className="sep">│</span>
        <span>DOCTRINE: <em className="ok">ATTRITION</em></span>
        <span className="sep">│</span>
        <span>SIM STATE: <em className={winner ? 'warn' : 'ok'}>{winner ? 'RESOLVED' : 'LIVE'}</em></span>
      </HudFooter>
    </div>
  )
}
