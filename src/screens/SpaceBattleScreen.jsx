import { useRef, useEffect, useState } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js'
import HudHeader from '../components/HudHeader'
import HudFooter from '../components/HudFooter'

// ── Battle parameters ──────────────────────────────────────────────────────────
const FLEET_SIZE = 25
const SHIP_HP    = 6
const BOLT_SPEED = 44       // world units / second
const MISS_CHANCE = 0.3
const TEAMS = {
  blue: { color: 0x3a93ff, bolt: 0x8fc6ff },
  red:  { color: 0xff3322, bolt: 0xff7a5a },
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
      const hullGeo = new THREE.ConeGeometry(0.5, 1.7, 8)
      const boltGeo = new THREE.CylinderGeometry(0.08, 0.08, 1.7, 6)
      const blastGeo = new THREE.SphereGeometry(1, 12, 12)
      disposables.push(hullGeo, boltGeo, blastGeo)
      const boltMat = {
        blue: new THREE.MeshBasicMaterial({ color: TEAMS.blue.bolt, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }),
        red:  new THREE.MeshBasicMaterial({ color: TEAMS.red.bolt,  transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }),
      }
      disposables.push(boltMat.blue, boltMat.red)

      // ── Spawn the two fleets (5×5 grids facing each other) ───────────────────
      const ships = []
      const yAxis = new THREE.Vector3(0, 1, 0)
      const spawnFleet = (team, sx, faceZRot) => {
        for (let i = 0; i < FLEET_SIZE; i++) {
          const row = i % 5, col = Math.floor(i / 5)
          const mat = new THREE.MeshStandardMaterial({
            color: TEAMS[team].color, emissive: TEAMS[team].color,
            emissiveIntensity: 0.45, metalness: 0.6, roughness: 0.4,
          })
          disposables.push(mat)
          const mesh = new THREE.Mesh(hullGeo, mat)
          const baseX = sx + (Math.random() - 0.5) * 2
          const baseY = (row - 2) * 3.0 + (Math.random() - 0.5)
          const baseZ = (col - 2) * 3.2 + (Math.random() - 0.5)
          mesh.position.set(baseX, baseY, baseZ)
          mesh.rotation.z = faceZRot                  // point the cone toward the enemy (±X)
          scene.add(mesh)
          ships.push({
            mesh, mat, team, hp: SHIP_HP, alive: true,
            baseX, baseY, baseZ, phase: Math.random() * Math.PI * 2,
            fireCd: 0.5 + Math.random() * 2.5, flash: 0,
          })
        }
      }
      spawnFleet('blue', -16, -Math.PI / 2)   // blue on the left, nose toward +X
      spawnFleet('red',   16,  Math.PI / 2)   // red on the right, nose toward -X

      // ── Bolts & explosions ───────────────────────────────────────────────────
      const bolts = []
      const blasts = []

      const fireBolt = (shooter, target) => {
        const willHit = Math.random() > MISS_CHANCE
        const aim = target.mesh.position.clone()
        if (!willHit) aim.add(new THREE.Vector3((Math.random() - 0.5) * 6, (Math.random() - 0.5) * 6, (Math.random() - 0.5) * 6))
        const start = shooter.mesh.position.clone()
        const dir = aim.clone().sub(start).normalize()
        const dist = start.distanceTo(aim)
        const mesh = new THREE.Mesh(boltGeo, boltMat[shooter.team])
        mesh.position.copy(start)
        mesh.quaternion.setFromUnitVectors(yAxis, dir)
        scene.add(mesh)
        bolts.push({ mesh, dir, target, willHit, travelled: 0, dist })
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
          spawnBlast(ship.mesh.position)
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
        const t  = clock.elapsedTime

        // ships: bob in formation, fire at enemies
        for (const s of ships) {
          if (!s.alive) continue
          s.mesh.position.y = s.baseY + Math.sin(t * 0.8 + s.phase) * 0.5
          s.mesh.position.z = s.baseZ + Math.cos(t * 0.6 + s.phase) * 0.5
          if (s.flash > 0) {
            s.flash -= dt
            s.mat.emissiveIntensity = s.flash > 0 ? 1.6 : 0.45
          }
          if (!gameOver) {
            s.fireCd -= dt
            if (s.fireCd <= 0) {
              const enemies = ships.filter(e => e.alive && e.team !== s.team)
              if (enemies.length) fireBolt(s, enemies[(Math.random() * enemies.length) | 0])
              s.fireCd = 1.3 + Math.random() * 3.0
            }
          }
        }

        // bolts: travel, then resolve
        for (let i = bolts.length - 1; i >= 0; i--) {
          const b = bolts[i]
          const step = BOLT_SPEED * dt
          b.travelled += step
          b.mesh.position.addScaledVector(b.dir, step)
          if (b.travelled >= b.dist) {
            if (b.willHit && b.target.alive) damage(b.target)
            scene.remove(b.mesh)
            bolts.splice(i, 1)
          }
        }

        // explosions: expand & fade
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

        // scoreboard + victory check
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
          <span className="sb-score sb-score--blue">BLUE FLEET <span ref={blueCountRef} className="sb-count">{FLEET_SIZE}</span></span>
          <span className="sb-vs">⚔ ENGAGED ⚔</span>
          <span className="sb-score sb-score--red"><span ref={redCountRef} className="sb-count">{FLEET_SIZE}</span> RED FLEET</span>
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
