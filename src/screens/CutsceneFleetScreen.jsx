import { useState, useRef, useEffect } from 'react'
import * as THREE from 'three'
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js'
import HudHeader from '../components/HudHeader'
import { TEAMS, COMMS_PORTRAIT } from './battle/constants'
import {
  NEBULA_VERT, NEBULA_FRAG, buildBlueCapital, buildBlueModel, buildBlueBomber, buildBlueCruiser,
} from './battle/geometry'
import { renderCommsBody } from './battle/RosterUI'
import './battle/battle.css'

// ── Scripted timeline ────────────────────────────────────────────────────────
const FLEET_SPEED = 6       // the whole formation glides forward at one speed
const RING_R      = 22      // radius of the fighter escort ring around the flagship
const N_FIGHTERS  = 35
const N_BOMBERS   = 20
const ORBIT_R     = 96      // camera orbit radius around the fleet
const ORBIT_ELEV  = 34
const ORBIT_SPEED = 0.42    // rad / sec
const AZ0         = 0.7     // starting camera angle (a front three-quarter view)
const COMMS_T     = 1.0     // line appears
const FADE_T      = 12.5    // begin the fade-out
const COMMS_DWELL_MS = 4200

const CAP_NAME = 'HMSS The Empress Remembers Saint Polyhymnia'
const LINE = 'Fleet Polyhymnia, assembled.'

export default function CutsceneFleetScreen({ onReturn, onComplete }) {
  const mountRef = useRef(null)
  const [resetKey, setResetKey] = useState(0)
  const [comms, setComms] = useState(null)
  const [commsText, setCommsText] = useState('')
  const commsSeq = useRef(0)
  const [fadeBlack, setFadeBlack] = useState(false)
  const advanceRef = useRef(null)
  advanceRef.current = () => (onComplete ?? onReturn)?.()

  // typewriter
  useEffect(() => {
    if (!comms) { setCommsText(''); return }
    setCommsText('')
    let i = 0, hide
    const full = comms.text
    const typer = setInterval(() => {
      i++; setCommsText(full.slice(0, i))
      if (i >= full.length) {
        clearInterval(typer)
        if (!comms.persist) hide = setTimeout(() => setComms(null), COMMS_DWELL_MS)
      }
    }, 42)
    return () => { clearInterval(typer); clearTimeout(hide) }
  }, [comms?.id])

  useEffect(() => { setComms(null); setFadeBlack(false) }, [resetKey])

  // once the screen has faded to black, auto-progress to the next screen
  useEffect(() => {
    if (!fadeBlack) return
    const t = setTimeout(() => advanceRef.current?.(), 1300)
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

      scene.add(new THREE.AmbientLight(0x4a5a80, 0.85))
      const key = new THREE.DirectionalLight(0xcfe0ff, 0.9); key.position.set(6, 12, 8); scene.add(key)
      const rim = new THREE.DirectionalLight(0x4878c0, 0.5); rim.position.set(-10, -4, -12); scene.add(rim)

      // nebula skydome + stars
      const nebGeo = new THREE.SphereGeometry(400, 32, 32)
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
      const starCount = 1200, sp = new Float32Array(starCount * 3)
      for (let i = 0; i < starCount; i++) {
        const rr = 150 + Math.random() * 220, th = Math.random() * Math.PI * 2, ph = Math.acos(2 * Math.random() - 1)
        sp[i * 3] = rr * Math.sin(ph) * Math.cos(th); sp[i * 3 + 1] = rr * Math.sin(ph) * Math.sin(th); sp[i * 3 + 2] = rr * Math.cos(ph)
      }
      const starGeo = new THREE.BufferGeometry(); starGeo.setAttribute('position', new THREE.BufferAttribute(sp, 3))
      const starMat = new THREE.PointsMaterial({ size: 0.7, sizeAttenuation: true, color: 0x9fb4d8, transparent: true, opacity: 0.85 })
      scene.add(new THREE.Points(starGeo, starMat)); disposables.push(starGeo, starMat)

      const UP = new THREE.Vector3(0, 1, 0), ORIGIN = new THREE.Vector3(), FORWARD = new THREE.Vector3(1, 0, 0)
      const _m = new THREE.Matrix4(), _q = new THREE.Quaternion()
      const orient = (obj, dir) => { _m.lookAt(dir, ORIGIN, UP); _q.setFromRotationMatrix(_m); obj.quaternion.copy(_q) }

      const blastGeo = new THREE.SphereGeometry(1, 10, 10)
      const glowMat = new THREE.MeshBasicMaterial({ color: TEAMS.blue.bolt, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false })
      disposables.push(blastGeo, glowMat)

      // ── Build the fleet (one geometry/material per type, reused per ship) ───────
      const fleet = new THREE.Group(); scene.add(fleet)
      const geoFlag = buildBlueCapital(), geoFighter = buildBlueModel(), geoBomber = buildBlueBomber(), geoCruiser = buildBlueCruiser()
      disposables.push(geoFlag, geoFighter, geoBomber, geoCruiser)
      const hullMat = new THREE.MeshStandardMaterial({ color: TEAMS.blue.color, emissive: TEAMS.blue.color, emissiveIntensity: 0.5, metalness: 0.62, roughness: 0.36 })
      disposables.push(hullMat)
      const addShip = (geo, scale, rear, x, y, z) => {
        const g = new THREE.Group()
        g.add(new THREE.Mesh(geo, hullMat))
        const glow = new THREE.Mesh(blastGeo, glowMat); glow.scale.setScalar(0.42); glow.position.set(0, 0, -rear); g.add(glow)
        g.scale.setScalar(scale); g.position.set(x, y, z); orient(g, FORWARD)
        fleet.add(g)
      }
      // flagship at the heart of the formation
      addShip(geoFlag, 3.2, 3.1, 0, 0, 0)
      // 35 fighters in an escort ring around it
      for (let i = 0; i < N_FIGHTERS; i++) {
        const a = (i / N_FIGHTERS) * Math.PI * 2
        addShip(geoFighter, 1.0, 0.95, RING_R * Math.cos(a), 0, RING_R * Math.sin(a))
      }
      // 20 bombers in a block behind
      const bz = [-18, -9, 0, 9, 18], by = [-9, -3, 3, 9]
      let bi = 0
      for (const y of by) for (const z of bz) { if (bi++ >= N_BOMBERS) break; addShip(geoBomber, 1.43, 1.4, -36, y, z) }
      // 8 missile cruisers out on the flanks
      for (const side of [-1, 1]) for (const x of [-15, -5, 5, 15]) addShip(geoCruiser, 1.7, 1.5, x, 0, 30 * side)

      // camera orbits a point a little behind the flagship (≈ fleet centroid)
      const CENTER_OFF = new THREE.Vector3(-12, 0, 0)
      const center = new THREE.Vector3()
      const placeCamera = (az) => {
        center.copy(fleet.position).add(CENTER_OFF)
        camera.position.set(center.x + ORBIT_R * Math.cos(az), center.y + ORBIT_ELEV, center.z + ORBIT_R * Math.sin(az))
        camera.lookAt(center)
      }
      placeCamera(AZ0)

      let T = 0, firedComms = false, fadeStarted = false
      const showComms = (text) => setComms({ id: ++commsSeq.current, team: 'blue', name: CAP_NAME, portrait: COMMS_PORTRAIT.blue, text, segments: [{ text }], persist: true })

      const clock = new THREE.Clock()
      const frame = () => {
        const dt = Math.min(clock.getDelta(), 0.05)
        T += dt

        fleet.position.x += FLEET_SPEED * dt          // the whole formation glides forward
        placeCamera(AZ0 + ORBIT_SPEED * T)            // sweep around it

        if (!firedComms && T >= COMMS_T) { firedComms = true; showComms(LINE) }
        if (!fadeStarted && T >= FADE_T) { fadeStarted = true; setFadeBlack(true) }

        composer.render()
        raf = requestAnimationFrame(frame)
      }

      composer = new EffectComposer(renderer)
      composer.addPass(new RenderPass(scene, camera))
      composer.addPass(new UnrealBloomPass(new THREE.Vector2(w, h), 0.55, 0.5, 0.25))
      frame()

      const onResize = () => {
        const nw = mount.clientWidth, nh = mount.clientHeight; if (!nw || !nh) return
        camera.aspect = nw / nh; camera.updateProjectionMatrix(); renderer.setSize(nw, nh); composer.setSize(nw, nh)
      }
      const ro = new ResizeObserver(onResize); ro.observe(mount)

      return () => {
        cancelAnimationFrame(raf); ro.disconnect()
        disposables.forEach(d => d.dispose && d.dispose())
        composer.dispose && composer.dispose(); renderer.dispose()
        if (renderer.domElement.parentNode) renderer.domElement.parentNode.removeChild(renderer.domElement)
      }
    } catch (err) {
      console.error('Fleet cutscene failed to initialise:', err)
      if (renderer) { try { renderer.dispose() } catch (_) {} }
    }
  }, [resetKey])

  return (
    <div id="cutscene-screen">
      <HudHeader onLogout={onReturn} right={<span className="label">CUTSCENE / FLEET REVIEW</span>} />
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

        {!fadeBlack && <button className="cut-replay" onClick={() => setResetKey(k => k + 1)}>⟳ REPLAY</button>}
      </div>

      <div className={`cut-fade${fadeBlack ? ' cut-fade--on' : ''}`} />
    </div>
  )
}
