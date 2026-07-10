import { useRef, useEffect, useState } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js'
import HudHeader from '../components/HudHeader'
import { getFlag, setFlag } from '../lib/store'
import { getCredits, getFleet, resetCampaign, unlockAllCampaign, fleetStrength, NODE_BATTLES } from '../lib/campaign'
import { NEBULA_VERT, NEBULA_FRAG } from './battle/geometry'
import { NODES as MAP_NODES, buildNode } from './CampaignMap'
import './campaign-map.css'

// ── Alternate campaign map: a rotatable 3D holographic navigation chart ──────
// Same UI, flow and unlock choreography as CampaignMap, but the nodes hang in
// true 3D above/below a shader-drawn radar grid — the sector map's own node
// models on stems, jump lanes between systems, hard-sci-fi intel labels, a live
// scale bar, a galactic-centre bearing, and a warp-out sequence on select.

// Hand-authored node positions, spiralling outward from the home system.
const STELLAR_POS = [
  [0, 0, 0], [13, 7, -6], [-15, -9, 13], [6, 14, -25], [-28, -12, -12],
  [-16, 18, 27], [33, 12, 14], [43, -16, -8], [24, 22, -38], [-42, 17, -33],
].map(p => new THREE.Vector3(...p))
const N = STELLAR_POS.length
const THREAT = NODE_BATTLES.map(b => fleetStrength(b.enemy))
const ADD = { transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }

// Holographic radar grid: distance rings every 20u, spokes every 30°, a slow
// rotating sweep that brightens the rings as it passes, and a hot outer rim.
// (Exported — the Critical Mass cutscene draws its chart with the same grid.)
export const NAV_GRID_VERT = /* glsl */`
  varying vec2 vP;
  void main() { vP = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
`
export const NAV_GRID_FRAG = /* glsl */`
  precision highp float;
  varying vec2 vP;
  uniform float uTime;
  void main() {
    float TAU = 6.2831853;
    float r = length(vP);
    float a = atan(vP.y, vP.x);
    float m = mod(r, 20.0);
    float ring = smoothstep(0.55, 0.05, min(m, 20.0 - m));
    float sa = mod(a, TAU / 12.0) - TAU / 24.0;
    float spoke = smoothstep(0.55, 0.05, abs(sa) * max(r, 1.0));
    float rel = fract(a / TAU - uTime * 0.02);
    float trail = pow(1.0 - rel, 10.0);
    float edge = smoothstep(1.5, 0.1, abs(r - 60.0));
    float fade = (1.0 - smoothstep(44.0, 60.5, r)) * smoothstep(1.5, 5.0, r);
    float alpha = (ring * 0.42 + spoke * 0.16 + trail * (0.05 + 0.30 * ring)) * fade + edge * 0.4;
    vec3 col = vec3(0.30, 0.45, 1.0);
    gl_FragColor = vec4(col * alpha, alpha);
  }
`

export default function CampaignStarMap({ onExit, onPlay, onReviewFleet, onCards, onDrawTest, onToggleView }) {
  const mountRef = useRef(null)
  const labelRefs = useRef([])
  const scaleLineRef = useRef(null)
  const galArrowRef = useRef(null)
  const warpFlashRef = useRef(null)
  const [completed, setCompleted] = useState(() => Math.min(N, getFlag('campaignProgress') || 0))
  const [credits, setCredits] = useState(getCredits)
  const [fleet, setFleet] = useState(getFleet)
  const [confirmReset, setConfirmReset] = useState(false)
  const [showDebug, setShowDebug] = useState(false)
  const [advCutscenes, setAdvCutscenes] = useState(() => !!getFlag('advancedCutscenes'))
  const toggleAdvCutscenes = () => { const next = !advCutscenes; setAdvCutscenes(next); setFlag('advancedCutscenes', next) }
  const operatorPortrait = getFlag('operatorPortrait')
  const operatorName = getFlag('operator')
  const fleetName = getFlag('fleetName') || 'Fleet Polyhymnia'
  const stateOf = (i) => (i < completed ? 'done' : i === completed ? 'active' : 'locked')

  const doReset = () => {
    resetCampaign()
    setCompleted(0)
    setCredits(getCredits())
    setFleet(getFleet())
    setConfirmReset(false)
  }

  useEffect(() => {
    const onKey = (e) => { if (e.code === 'KeyZ') setShowDebug(v => !v) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // map sounds — identical to the sector map
  const tickSfx = useRef(null)
  const clickSfx = useRef(null)
  const igniteSfx = useRef(null)
  useEffect(() => {
    const t = new Audio(`${import.meta.env.BASE_URL}codetick.wav`); t.preload = 'auto'; tickSfx.current = t
    const c = new Audio(`${import.meta.env.BASE_URL}click.wav`); c.preload = 'auto'; clickSfx.current = c
    const g = new Audio(`${import.meta.env.BASE_URL}beep.mp3`); g.preload = 'auto'; igniteSfx.current = g
  }, [])
  const playTick = () => { const s = tickSfx.current?.cloneNode(); if (s) { s.volume = 0.14; s.play().catch(() => {}) } }
  const playClick = () => { const s = clickSfx.current?.cloneNode(); if (s) { s.volume = 0.6; s.play().catch(() => {}) } }
  const playIgnite = () => { const s = igniteSfx.current?.cloneNode(); if (s) { s.volume = 0.3; s.play().catch(() => {}) } }

  const [unlockPending, setUnlockPending] = useState(() => (getFlag('campaignProgressSeen') || 0) < Math.min(N, getFlag('campaignProgress') || 0))

  const doUnlockAll = () => {
    unlockAllCampaign()
    setCompleted(N)
    setCredits(getCredits())
    setFleet(getFleet())
  }
  const doUnlockNext = () => {
    const next = Math.min(N, completed + 1)
    if (next === completed) return
    setFlag('campaignProgress', next)
    setUnlockPending(true)
    setCompleted(next)
  }

  useEffect(() => {
    const mount = mountRef.current
    if (!mount) return
    let renderer, composer, raf, controls
    try {
      const w = mount.clientWidth || 1, h = mount.clientHeight || 1
      const scene = new THREE.Scene()
      const camera = new THREE.PerspectiveCamera(48, w / h, 0.1, 900)
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
      renderer.setSize(w, h); renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
      mount.appendChild(renderer.domElement)

      camera.position.set(20, 43, 79)
      controls = new OrbitControls(camera, renderer.domElement)
      controls.target.set(0, 2, 0)
      controls.enableDamping = true; controls.dampingFactor = 0.07; controls.enablePan = false
      controls.minDistance = 45; controls.maxDistance = 230
      controls.autoRotate = true; controls.autoRotateSpeed = 0.25
      controls.update()

      scene.add(new THREE.AmbientLight(0x6678a0, 0.95))
      const key = new THREE.DirectionalLight(0xcfe0ff, 1.0); key.position.set(8, 14, 12); scene.add(key)
      const rim = new THREE.DirectionalLight(0x5a78c0, 0.5); rim.position.set(-10, -6, -8); scene.add(rim)

      // nebula skydome (slow drift) + far starfield
      const nebGeo = new THREE.SphereGeometry(420, 32, 32)
      const nebMat = new THREE.ShaderMaterial({ vertexShader: NEBULA_VERT, fragmentShader: NEBULA_FRAG, uniforms: { uColA: { value: new THREE.Color(0.022, 0.038, 0.095) }, uColB: { value: new THREE.Color(0.06, 0.025, 0.11) }, uColWarm: { value: new THREE.Color(0.1, 0.045, 0.06) }, uTime: { value: 0 } }, side: THREE.BackSide, depthWrite: false, depthTest: false })
      const neb = new THREE.Mesh(nebGeo, nebMat); neb.renderOrder = -10; scene.add(neb)
      const sc = 1500, sp = new Float32Array(sc * 3)
      for (let i = 0; i < sc; i++) { const rr = 180 + Math.random() * 220, th = Math.random() * Math.PI * 2, ph = Math.acos(2 * Math.random() - 1); sp[i * 3] = rr * Math.sin(ph) * Math.cos(th); sp[i * 3 + 1] = rr * Math.sin(ph) * Math.sin(th); sp[i * 3 + 2] = rr * Math.cos(ph) }
      const starGeoBg = new THREE.BufferGeometry(); starGeoBg.setAttribute('position', new THREE.BufferAttribute(sp, 3))
      scene.add(new THREE.Points(starGeoBg, new THREE.PointsMaterial({ size: 0.65, sizeAttenuation: true, color: 0x8fa4c8, transparent: true, opacity: 0.8 })))

      // ── the shader radar grid + a slow drift of holographic dust ──
      const gridMat = new THREE.ShaderMaterial({ vertexShader: NAV_GRID_VERT, fragmentShader: NAV_GRID_FRAG, uniforms: { uTime: { value: 0 } }, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })
      const grid = new THREE.Mesh(new THREE.CircleGeometry(62, 96), gridMat)
      grid.rotation.x = -Math.PI / 2; grid.position.y = -0.03; scene.add(grid)
      const dustN = 240, dp = new Float32Array(dustN * 3)
      for (let i = 0; i < dustN; i++) { const rr = Math.sqrt(Math.random()) * 58, th = Math.random() * Math.PI * 2; dp[i * 3] = Math.cos(th) * rr; dp[i * 3 + 1] = (Math.random() - 0.5) * 44; dp[i * 3 + 2] = Math.sin(th) * rr }
      const dustGeo = new THREE.BufferGeometry(); dustGeo.setAttribute('position', new THREE.BufferAttribute(dp, 3))
      const dust = new THREE.Points(dustGeo, new THREE.PointsMaterial({ size: 0.45, sizeAttenuation: true, color: 0x6fa0e0, transparent: true, opacity: 0.4, blending: THREE.AdditiveBlending, depthWrite: false }))
      scene.add(dust)

      // ── stems (solid above the plane, dotted below) + base pads on the grid ──
      const padGeo = new THREE.RingGeometry(1.0, 1.45, 32)
      const padMat = new THREE.MeshBasicMaterial({ color: 0x5f8ae0, opacity: 0.4, side: THREE.DoubleSide, ...ADD })
      for (const p of STELLAR_POS) {
        const base = new THREE.Vector3(p.x, 0, p.z)
        if (Math.abs(p.y) > 0.6) {
          const geo = new THREE.BufferGeometry().setFromPoints([base, p])
          if (p.y > 0) scene.add(new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0x7ee08a, transparent: true, opacity: 0.6 })))
          else { const l = new THREE.Line(geo, new THREE.LineDashedMaterial({ color: 0x7ee08a, dashSize: 0.9, gapSize: 0.8, transparent: true, opacity: 0.48 })); l.computeLineDistances(); scene.add(l) }
        }
        const pad = new THREE.Mesh(padGeo, padMat)
        pad.rotation.x = -Math.PI / 2; pad.position.set(base.x, 0.04, base.z); scene.add(pad)
      }

      // ── jump lanes ──
      const complete = completed >= N
      const TUBE_SEGS = 120, TUBE_IDX_PER_SEG = 36
      const IGNITE_DUR = 1.1
      const seen = Math.min(getFlag('campaignProgressSeen') || 0, completed)
      const unlock = completed > seen ? { t: 0, from: seen / completed, done: false, ignite: 0 } : null
      setFlag('campaignProgressSeen', completed)
      setUnlockPending(!!unlock)

      for (let i = 0; i < N - 1; i++) {   // faint dotted lanes for the whole route
        const g = new THREE.BufferGeometry().setFromPoints([STELLAR_POS[i], STELLAR_POS[i + 1]])
        const l = new THREE.Line(g, new THREE.LineDashedMaterial({ color: 0x4a6a9a, dashSize: 1.4, gapSize: 1.1, transparent: true, opacity: 0.3 }))
        l.computeLineDistances(); scene.add(l)
      }
      const jump = new THREE.CurvePath()
      for (let i = 0; i < Math.min(completed, N - 1); i++) jump.add(new THREE.LineCurve3(STELLAR_POS[i], STELLAR_POS[i + 1]))
      let travelled = null, pulse = null, revealPortion = 1
      if (jump.curves.length) {
        const tubeGeo = new THREE.TubeGeometry(jump, TUBE_SEGS, complete ? 0.26 : 0.18, 6, false)
        travelled = new THREE.Mesh(tubeGeo, new THREE.MeshBasicMaterial({ color: complete ? 0xffd24a : 0xff5bd0, opacity: complete ? 0.9 : 0.8, ...ADD }))
        scene.add(travelled)
        if (unlock) { revealPortion = unlock.from; tubeGeo.setDrawRange(0, Math.floor(unlock.from * TUBE_SEGS) * TUBE_IDX_PER_SEG) }
        pulse = new THREE.Mesh(new THREE.SphereGeometry(0.55, 12, 12), new THREE.MeshBasicMaterial({ color: complete ? 0xffe9a8 : 0xff9be8, opacity: 0.95, ...ADD }))
        scene.add(pulse)
      }

      // unlock dressing: energy head on the growing lane + ignition shockwave
      let head = null, burst = null
      const unlockMats = []
      const GOLD = new THREE.Color(0xffd24a), LOCKED_GREY = new THREE.Color(0x55607a)
      if (unlock) {
        head = new THREE.Mesh(new THREE.SphereGeometry(0.8, 12, 12), new THREE.MeshBasicMaterial({ color: 0xffc4ef, opacity: 0.95, ...ADD }))
        head.visible = false; scene.add(head)
        burst = new THREE.Mesh(new THREE.RingGeometry(0.62, 1.0, 40), new THREE.MeshBasicMaterial({ color: 0xffd24a, opacity: 0, side: THREE.DoubleSide, ...ADD }))
        burst.position.copy(STELLAR_POS[Math.min(completed, N - 1)]); burst.visible = false; scene.add(burst)
      }

      // ── the systems: the sector map's node models, on chart stems ──
      const TEAM_RING = { done: 0x4aa0ff, active: 0xffd24a, locked: 0x55607a }
      const nodes = STELLAR_POS.map((pos, i) => {
        const pending = !!unlock && i === completed
        const st = pending ? 'pending' : stateOf(i)
        const dim = st === 'locked' || pending
        const group = new THREE.Group(); group.position.copy(pos)
        const model = buildNode(MAP_NODES[i].model)
        model.scale.multiplyScalar(0.8)
        group.add(model)
        if (st === 'locked') model.traverse(n => { if (n.material && n.material.emissive) { n.material.emissiveIntensity *= 0.25; n.material.color.multiplyScalar(0.4) } })
        if (pending) {                       // dim like locked, but remember how to power back on
          const seenMats = new Set()
          model.traverse(n => {
            const m = n.material
            if (m && m.emissive && !seenMats.has(m)) {
              seenMats.add(m)
              const rec = { m, e0: m.emissiveIntensity, c0: m.color.clone() }
              m.emissiveIntensity *= 0.25; m.color.multiplyScalar(0.4)
              rec.eDim = m.emissiveIntensity; rec.cDim = m.color.clone()
              unlockMats.push(rec)
            }
          })
        }
        // soft state glow behind the model (gold for the active objective)
        const glowMat = new THREE.MeshBasicMaterial({ color: st === 'active' ? 0xffd24a : 0x4aa0ff, opacity: st === 'active' ? 0.13 : (st === 'done' ? 0.05 : 0), ...ADD })
        group.add(new THREE.Mesh(new THREE.SphereGeometry(5.2, 16, 16), glowMat))
        const ring = new THREE.Mesh(new THREE.TorusGeometry(4.6, 0.1, 8, 48), new THREE.MeshBasicMaterial({ color: complete ? 0xffd24a : TEAM_RING[pending ? 'locked' : st], opacity: dim ? 0.4 : 0.85, ...ADD }))
        group.add(ring)
        const hit = new THREE.Mesh(new THREE.SphereGeometry(5.8, 8, 8), new THREE.MeshBasicMaterial({ visible: false })); group.add(hit)
        scene.add(group)
        return {
          i, st, group, model, ring, glowMat, hit,
          spin: 0.2 + Math.random() * 0.2, hoverT: 0,
          ringOpacity: dim ? 0.4 : 0.85,
        }
      })
      const unlockNode = unlock ? nodes[completed] : null

      // fleet marker: a slow-spinning beacon above the last system we hold —
      // and the ship that streaks out during the warp sequence
      const marker = new THREE.Mesh(new THREE.OctahedronGeometry(1.1), new THREE.MeshBasicMaterial({ color: 0x66b8ff, opacity: 0.9, ...ADD }))
      const fleetPos = STELLAR_POS[Math.max(0, Math.min(completed, N) - 1)]
      scene.add(marker)
      const warpTrail = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 1, 6), new THREE.MeshBasicMaterial({ color: 0x9fd0ff, opacity: 0.7, ...ADD }))
      warpTrail.visible = false; scene.add(warpTrail)

      // ── interaction: hover intel + click-to-warp ──
      const raycaster = new THREE.Raycaster(), pointer = new THREE.Vector2()
      let hovered = -1, downX = 0, downY = 0
      let warp = null   // { t, i, from } — warp-out sequence, then onPlay(i)
      const hitMap = new Map(nodes.map(n => [n.hit, n]))
      const pick = (e) => {
        const rect = renderer.domElement.getBoundingClientRect()
        pointer.set(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1)
        raycaster.setFromCamera(pointer, camera)
        const hits = raycaster.intersectObjects(nodes.map(n => n.hit))
        return hits.length ? hitMap.get(hits[0].object) : null
      }
      // lock out selection while a fresh node is unlocking (route growth +
      // ignition) — no node, not even a cleared one, can be picked
      const unlocking = () => !!unlock && (!unlock.done || unlock.ignite > 0)
      const onMove = (e) => {
        if (warp) return
        const n = pick(e); const clickable = n && n.i <= completed && !unlocking()
        const next = clickable ? n.i : -1
        if (next !== -1 && next !== hovered) playTick()
        hovered = next
        renderer.domElement.style.cursor = clickable ? 'pointer' : 'default'
      }
      const onDown = (e) => { downX = e.clientX; downY = e.clientY }
      const onUp = (e) => {
        if (warp) return
        if (Math.hypot(e.clientX - downX, e.clientY - downY) > 6) return
        const n = pick(e)
        if (n && n.i <= completed && !unlocking()) {
          playClick()
          hovered = -1
          controls.autoRotate = false
          warp = { t: 0, i: n.i, from: marker.position.clone(), fired: false }
        }
      }
      renderer.domElement.addEventListener('pointermove', onMove)
      renderer.domElement.addEventListener('pointerdown', onDown)
      renderer.domElement.addEventListener('pointerup', onUp)

      composer = new EffectComposer(renderer)
      composer.addPass(new RenderPass(scene, camera))
      composer.addPass(new UnrealBloomPass(new THREE.Vector2(w, h), 0.75, 0.55, 0.2))

      const _v = new THREE.Vector3(), _a = new THREE.Vector3(), _b = new THREE.Vector3()
      const clock = new THREE.Clock(); let T = 0
      const toScreen = (v, out) => { _v.copy(v).project(camera); out.x = (_v.x * 0.5 + 0.5) * mount.clientWidth; out.y = (-_v.y * 0.5 + 0.5) * mount.clientHeight; return _v.z <= 1 }
      const s0 = { x: 0, y: 0 }, s1 = { x: 0, y: 0 }
      const frame = () => {
        const dt = Math.min(clock.getDelta(), 0.05); T += dt
        controls.update()
        gridMat.uniforms.uTime.value = T
        nebMat.uniforms.uTime.value = T * 0.8
        dust.rotation.y = T * 0.008

        const hoverEase = 1 - Math.exp(-10 * dt)
        for (const n of nodes) {
          n.hoverT += ((n.i === hovered ? 1 : 0) - n.hoverT) * hoverEase
          n.group.scale.setScalar(1 + 0.18 * n.hoverT)
          n.model.rotation.y += n.spin * dt
          n.ring.lookAt(camera.position)
          let op = n.ringOpacity, sc2 = 1
          if (n.st === 'active') { op = 0.7 + 0.3 * Math.sin(T * 3); sc2 = 1 + 0.06 * Math.sin(T * 3) }
          n.ring.material.opacity = op + (1 - op) * n.hoverT
          n.ring.scale.setScalar(Math.max(sc2, 1 + 0.1 * n.hoverT))
        }

        // unlock choreography — identical staging to the sector map
        if (unlock && !unlock.done) {
          unlock.t += dt
          const p = Math.min(1, Math.max(0, (unlock.t - 0.7) / 1.5))
          const e = p * p * (3 - 2 * p)
          revealPortion = unlock.from + (1 - unlock.from) * e
          if (travelled) travelled.geometry.setDrawRange(0, Math.floor(revealPortion * TUBE_SEGS) * TUBE_IDX_PER_SEG)
          if (head && jump.curves.length) {
            head.visible = p > 0 && p < 1
            head.position.copy(jump.getPoint(Math.min(0.999, revealPortion)))
            head.scale.setScalar(1 + 0.35 * Math.sin(T * 16))
          }
          if (p >= 1) {
            unlock.done = true; unlock.ignite = IGNITE_DUR
            if (head) head.visible = false
            playIgnite()
            setUnlockPending(false)
          }
        } else if (unlock && unlock.ignite > 0) {
          unlock.ignite -= dt
          const k = Math.max(0, unlock.ignite / IGNITE_DUR), tI = 1 - k
          const n = unlockNode
          if (n) {
            n.ring.material.color.lerpColors(LOCKED_GREY, GOLD, Math.min(1, tI * 2.2))
            n.ring.material.opacity = 1
            n.ring.scale.setScalar(1 + 1.9 * k * k)
            n.glowMat.color.set(0xffd24a); n.glowMat.opacity = 0.13 * tI
            for (const um of unlockMats) {
              um.m.emissiveIntensity = um.eDim + (um.e0 - um.eDim) * tI
              um.m.color.lerpColors(um.cDim, um.c0, tI)
            }
            if (burst) {
              burst.visible = true
              burst.lookAt(camera.position)
              burst.scale.setScalar(1 + tI * 12)
              burst.material.opacity = 0.85 * k
            }
            if (unlock.ignite <= 0) {
              n.st = 'active'; n.ringOpacity = 0.85
              n.ring.material.color.copy(GOLD)
              for (const um of unlockMats) { um.m.emissiveIntensity = um.e0; um.m.color.copy(um.c0) }
              if (burst) burst.visible = false
            }
          }
        }
        if (pulse) pulse.position.copy(jump.getPoint(Math.min(0.999, ((T * 0.18) % 1) * revealPortion)))

        // ── warp-out sequence: camera dives at the target while the fleet
        // beacon streaks to it behind a light trail, then a white-out hands
        // over to the node's cutscene ──
        if (warp) {
          warp.t += dt
          const p = Math.min(1, warp.t / 1.15)
          const e = p * p * (3 - 2 * p)
          const tgt = nodes[warp.i].group.position
          controls.target.lerp(tgt, 1 - Math.exp(-3.2 * dt))
          _a.copy(camera.position).sub(tgt)
          const dist = Math.max(24, _a.length() * (1 - 1.6 * dt))     // dolly in
          camera.position.copy(tgt).addScaledVector(_a.normalize(), dist)
          // beacon streak + trail
          _b.lerpVectors(warp.from, _a.copy(tgt).setY(tgt.y + 3), e)
          marker.position.copy(_b)
          _a.subVectors(_b, warp.from)
          const len = _a.length()
          if (len > 0.5) {
            warpTrail.visible = true
            warpTrail.position.copy(warp.from).addScaledVector(_a, 0.5)
            warpTrail.quaternion.setFromUnitVectors(_v.set(0, 1, 0), _a.clone().normalize())
            warpTrail.scale.set(0.22 * (1 - e * 0.6), len, 0.22 * (1 - e * 0.6))
            marker.quaternion.copy(warpTrail.quaternion)
            marker.scale.set(1, 1 + e * 9, 1)
          }
          if (warpFlashRef.current) warpFlashRef.current.style.opacity = String(Math.max(0, (p - 0.66) / 0.34) * 0.95)
          if (p >= 1 && !warp.fired) { warp.fired = true; onPlay(warp.i) }
        } else {
          marker.position.copy(fleetPos); marker.position.y += 5 + Math.sin(T * 2) * 0.7
          marker.rotation.y = T * 1.2
        }

        // nav chrome: live scale bar + galactic-centre bearing
        if (scaleLineRef.current) {
          _a.setFromMatrixColumn(camera.matrixWorld, 0).multiplyScalar(20)
          const ok0 = toScreen(_b.set(0, 0, 0), s0), ok1 = toScreen(_a, s1)
          if (ok0 && ok1) scaleLineRef.current.style.width = `${Math.max(30, Math.min(300, Math.hypot(s1.x - s0.x, s1.y - s0.y)))}px`
        }
        if (galArrowRef.current) {
          toScreen(_b.set(0, 0, 0), s0)
          toScreen(_a.set(-0.8, 0, 0.6).normalize().multiplyScalar(30), s1)
          galArrowRef.current.style.transform = `rotate(${Math.atan2(s1.y - s0.y, s1.x - s0.x)}rad)`
        }

        // labels track their systems
        for (let i = 0; i < N; i++) {
          const el = labelRefs.current[i]; if (!el) continue
          el.classList.toggle('smap-label--show', i === hovered)
          _v.copy(STELLAR_POS[i]); _v.y -= 6.2; _v.project(camera)
          if (_v.z > 1) { el.style.opacity = '0'; continue }
          el.style.opacity = '1'
          el.style.transform = `translate(-50%, 0) translate(${(_v.x * 0.5 + 0.5) * mount.clientWidth}px, ${(-_v.y * 0.5 + 0.5) * mount.clientHeight}px)`
        }

        composer.render(); raf = requestAnimationFrame(frame)
      }
      frame()

      const onResize = () => { const nw = mount.clientWidth, nh = mount.clientHeight; if (!nw || !nh) return; camera.aspect = nw / nh; camera.updateProjectionMatrix(); renderer.setSize(nw, nh); composer.setSize(nw, nh) }
      const ro = new ResizeObserver(onResize); ro.observe(mount)

      return () => {
        cancelAnimationFrame(raf); ro.disconnect(); controls.dispose()
        renderer.domElement.removeEventListener('pointermove', onMove); renderer.domElement.removeEventListener('pointerdown', onDown); renderer.domElement.removeEventListener('pointerup', onUp)
        const seenD = new Set()
        scene.traverse(node => { if (node.geometry && !seenD.has(node.geometry)) { seenD.add(node.geometry); node.geometry.dispose() } const mats = node.material ? (Array.isArray(node.material) ? node.material : [node.material]) : []; for (const m of mats) if (!seenD.has(m)) { seenD.add(m); m.dispose() } })
        composer.dispose && composer.dispose(); renderer.dispose()
        if (renderer.domElement.parentNode) renderer.domElement.parentNode.removeChild(renderer.domElement)
      }
    } catch (err) {
      console.error('Stellar map failed to initialise:', err)
      if (renderer) { try { renderer.dispose() } catch (_) { /* noop */ } }
    }
  }, [completed, onPlay])

  return (
    <div id="campaign-map">
      <HudHeader onLogout={onExit} right={<span className="label">URSU EUBULEUS SECTOR // NAV CHART</span>} />
      <div className="cmap-stage">
        <div className="cmap-canvas" ref={mountRef} />
        {operatorName && (
          <div className="cmap-hud" onClick={onReviewFleet} title="Manage fleet" role="button" tabIndex={0}>
            <div className="cmap-hud-fleetname">
              {fleetName}
              <span className="cmap-hud-manage">MANAGE ▸</span>
            </div>
            <div className="cmap-hud-row">
              {operatorPortrait && (
                <div className="cmap-hud-portrait">
                  <img src={operatorPortrait} alt={operatorName} />
                </div>
              )}
              <div className="cmap-hud-stats">
                <div className="cmap-hud-credits">
                  <span className="cmap-hud-val">{credits.toLocaleString()}</span>
                  <span className="cmap-hud-label">REQUISITION</span>
                </div>
                <div className="cmap-hud-fleet">
                  <span className="cmap-hud-fleet-title">STANDING FLEET</span>
                  <span className="cmap-hud-fleet-line">
                    ⬢1 FLAGSHIP · {fleet.fighters} INT · {fleet.bombers} BMR · {fleet.cruisers} CRU
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {completed >= N && (
          <div className="cmap-complete">
            <div className="cmap-complete-sub">✦ Campaign Complete ✦</div>
            <div className="cmap-complete-title">ORDER RESTORED</div>
            <div className="cmap-complete-motto">Caelum canit, illa audit</div>
          </div>
        )}

        {NODE_BATTLES.map((node, i) => {
          const st = (unlockPending && i === completed) ? 'locked' : stateOf(i)
          return (
            <div key={i} className={`smap-label smap-label--${st}`} ref={el => (labelRefs.current[i] = el)}>
              <div className="smap-leader" />
              <div className="smap-box">
                <div className="smap-box-head">
                  <span className="smap-num">SYS·{String(i + 1).padStart(2, '0')}</span>
                  <span className="smap-status">{st === 'done' ? 'SECURED' : st === 'active' ? 'ENGAGE ▸' : 'NO ROUTE'}</span>
                </div>
                <div className="smap-title">{node.title}</div>
                <div className="smap-intel">
                  {st === 'done' ? 'CLEARED · TAP TO REPLAY' : `THREAT ${THREAT[i]} · REWARD +${node.reward}`}
                </div>
              </div>
            </div>
          )
        })}
        <div className="cmap-hint">{completed >= N ? 'The Order is restored — drag to rotate, select a system to revisit' : 'Drag to rotate // scroll to zoom // select a system to begin'}</div>

        {/* nav-chart chrome */}
        <div className="smap-scalebar">
          <div className="smap-scalebar-line" ref={scaleLineRef} />
          <span className="smap-scalebar-text">5 LIGHT YEARS</span>
        </div>
        <div className="smap-galcentre">
          <span className="smap-galcentre-arrow" ref={galArrowRef}>➤</span>
          <span>GALACTIC CENTRE</span>
        </div>
        <div className="smap-warpflash" ref={warpFlashRef} />

        {showDebug && <button className="cmap-unlock" onClick={doUnlockAll}>⚡ DEBUG · UNLOCK ALL</button>}
        {showDebug && <button className="cmap-unlock cmap-givemacro" onClick={onCards}>⚡ DEBUG · CARD VAULT</button>}
        {showDebug && <button className="cmap-unlock cmap-drawtest" onClick={onDrawTest}>⚡ DEBUG · DRAW TEST</button>}
        {showDebug && <button className="cmap-unlock cmap-unlocknext" onClick={doUnlockNext} disabled={completed >= N}>⚡ DEBUG · UNLOCK NEXT NODE</button>}
        {showDebug && <button className="cmap-unlock cmap-advcut" onClick={toggleAdvCutscenes}>⚡ DEBUG · ADVANCED CUTSCENES: {advCutscenes ? 'ON' : 'OFF'}</button>}
        <button className="cmap-viewtoggle" onClick={onToggleView}>✦ SECTOR MAP</button>
        <button className="cmap-reset" onClick={() => setConfirmReset(true)}>⟲ RESET PROGRESS</button>

        {confirmReset && (
          <div className="cmap-confirm" onClick={() => setConfirmReset(false)}>
            <div className="cmap-confirm-box" onClick={e => e.stopPropagation()}>
              <div className="cmap-confirm-title">RESET CAMPAIGN?</div>
              <div className="cmap-confirm-text">
                This wipes all progress, Requisition and your standing fleet back to the start. This cannot be undone.
              </div>
              <div className="cmap-confirm-btns">
                <button className="cmap-confirm-cancel" onClick={() => setConfirmReset(false)}>CANCEL</button>
                <button className="cmap-confirm-go" onClick={doReset}>RESET PROGRESS</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
