import { useRef, useEffect, useState } from 'react'
import * as THREE from 'three'
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js'
import HudHeader from '../components/HudHeader'
import { getFlag, setFlag } from '../lib/store'
import { getCredits, getFleet, resetCampaign, unlockAllCampaign } from '../lib/campaign'
import { STORY } from './cutscene/scenes'
import {
  NEBULA_VERT, NEBULA_FRAG,
  buildAleph, buildBlueModel, buildRedModel, buildBlueCapital2,
} from './battle/geometry'
import { buildStation, buildCathedra } from './cutscene/models'
import './campaign-map.css'

// Each campaign node: title + a 3D visual keyed to its cutscene's events.
const NODES = [
  { title: 'First Contact',   model: 'aleph' },
  { title: 'The Muster',      model: 'station' },
  { title: 'The Warfront',    model: 'battle' },
  { title: 'The Hush',        model: 'hush' },
  { title: 'The Great Litany', model: 'engine' },
  { title: 'The Fall',        model: 'wreck' },
  { title: 'The Final Hearing', model: 'cathedra' },
  { title: 'The Annunciator', model: 'gun' },
  { title: 'The Lance',       model: 'blackhole' },
  { title: 'Order Restored',  model: 'world' },
]

const ADD = { transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }
// Centre an imported builder's group and scale it to roughly radius `r`.
function fit(group, r) {
  const box = new THREE.Box3().setFromObject(group)
  const c = box.getCenter(new THREE.Vector3())
  group.children.forEach(ch => ch.position.sub(c))
  const rad = box.getSize(new THREE.Vector3()).length() / 2 || 1
  group.scale.setScalar(r / rad)
  return group
}

function buildNode(model) {
  switch (model) {
    case 'aleph': return fit(buildAleph(), 4.2)
    case 'station': return fit(buildStation(), 4.6)
    case 'cathedra': return fit(buildCathedra(), 4.6)
    case 'battle': {
      const g = new THREE.Group()
      const bm = new THREE.MeshStandardMaterial({ color: 0x3a93ff, emissive: 0x3a93ff, emissiveIntensity: 0.6, metalness: 0.6, roughness: 0.4 })
      const rm = new THREE.MeshStandardMaterial({ color: 0xff3322, emissive: 0xff3322, emissiveIntensity: 0.6, metalness: 0.6, roughness: 0.4 })
      const b = new THREE.Mesh(buildBlueModel(), bm); b.scale.setScalar(1.7); b.position.set(-2.4, 0.8, 0); b.rotation.set(0.2, 0.7, 0.2); g.add(b)
      const r = new THREE.Mesh(buildRedModel(), rm); r.scale.setScalar(1.7); r.position.set(2.4, -0.8, 0); r.rotation.set(-0.2, Math.PI - 0.7, -0.2); g.add(r)
      return g
    }
    case 'wreck': {
      const g = new THREE.Group()
      const m = new THREE.Mesh(buildBlueCapital2(), new THREE.MeshStandardMaterial({ color: 0x2b2e34, emissive: 0x451c06, emissiveIntensity: 0.7, metalness: 0.4, roughness: 0.92 }))
      m.scale.setScalar(0.75); g.add(m)
      for (let i = 0; i < 4; i++) { const e = new THREE.Mesh(new THREE.SphereGeometry(0.4, 8, 8), new THREE.MeshBasicMaterial({ color: 0xff7a30, opacity: 0.9, ...ADD })); e.position.set((Math.random() - 0.5) * 5, (Math.random() - 0.5) * 2, (Math.random() - 0.5) * 5); g.add(e) }
      return g
    }
    case 'engine': {
      const g = new THREE.Group()
      g.add(new THREE.Mesh(new THREE.SphereGeometry(3, 32, 24), new THREE.MeshStandardMaterial({ color: 0x3a4a8a, emissive: 0x141f44, emissiveIntensity: 0.55, metalness: 0.5, roughness: 0.6 })))
      const ring = new THREE.Mesh(new THREE.TorusGeometry(4.6, 0.16, 8, 56), new THREE.MeshBasicMaterial({ color: 0x6f86ff, opacity: 0.75, ...ADD })); ring.rotation.set(-1.1, 0.4, 0); g.add(ring)
      return g
    }
    case 'hush': {
      const g = new THREE.Group()
      g.add(new THREE.Mesh(new THREE.SphereGeometry(3, 24, 24), new THREE.MeshStandardMaterial({ color: 0x06060c, emissive: 0x0c0420, emissiveIntensity: 0.5, roughness: 1 })))
      g.add(new THREE.Mesh(new THREE.SphereGeometry(3.7, 24, 24), new THREE.MeshBasicMaterial({ color: 0x6a4cff, opacity: 0.28, side: THREE.BackSide, ...ADD })))
      return g
    }
    case 'gun': {
      const g = new THREE.Group()
      const metal = new THREE.MeshStandardMaterial({ color: 0x5a6470, emissive: 0x0a1422, emissiveIntensity: 0.4, metalness: 0.85, roughness: 0.45 })
      const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.7, 9.5, 14), metal); barrel.rotation.z = Math.PI / 2; g.add(barrel)
      const breech = new THREE.Mesh(new THREE.BoxGeometry(2.4, 2.4, 2.8), metal); breech.position.x = -5.2; g.add(breech)
      for (const x of [-2, 1, 3.6]) { const ring = new THREE.Mesh(new THREE.TorusGeometry(1, 0.2, 6, 16), metal); ring.rotation.y = Math.PI / 2; ring.position.x = x; g.add(ring) }
      const muzzle = new THREE.Mesh(new THREE.SphereGeometry(1.0, 16, 16), new THREE.MeshBasicMaterial({ color: 0xfff0c4, opacity: 0.95, ...ADD })); muzzle.position.x = 5.4; g.add(muzzle)
      g.rotation.set(0.2, -0.5, 0.1)
      return g
    }
    case 'blackhole': {
      const g = new THREE.Group()
      g.add(new THREE.Mesh(new THREE.SphereGeometry(2.3, 24, 24), new THREE.MeshBasicMaterial({ color: 0x000000 })))
      g.add(new THREE.Mesh(new THREE.SphereGeometry(2.45, 24, 24), new THREE.MeshBasicMaterial({ color: 0xacdcff, opacity: 0.32, ...ADD })))
      const disk = new THREE.Mesh(new THREE.RingGeometry(3.1, 6.0, 56), new THREE.MeshBasicMaterial({ color: 0xffd9a0, opacity: 0.6, side: THREE.DoubleSide, ...ADD })); disk.rotation.set(-1.2, 0.3, 0); g.add(disk)
      return g
    }
    case 'world':
    default: {
      const g = new THREE.Group()
      g.add(new THREE.Mesh(new THREE.SphereGeometry(3.2, 32, 24), new THREE.MeshStandardMaterial({ color: 0x2f86b0, emissive: 0x0a3550, emissiveIntensity: 0.5, metalness: 0.2, roughness: 0.7 })))
      g.add(new THREE.Mesh(new THREE.SphereGeometry(3.5, 24, 24), new THREE.MeshBasicMaterial({ color: 0x9fd0ff, opacity: 0.18, side: THREE.BackSide, ...ADD })))
      const ring = new THREE.Mesh(new THREE.RingGeometry(4.4, 6.6, 56), new THREE.MeshBasicMaterial({ color: 0x9fd0ff, opacity: 0.4, side: THREE.DoubleSide, ...ADD })); ring.rotation.set(-1.15, 0.4, 0); g.add(ring)
      return g
    }
  }
}

export default function CampaignMap({ onExit, onPlay, onReviewFleet, onCards, onDrawTest }) {
  const mountRef = useRef(null)
  const labelRefs = useRef([])
  const [completed, setCompleted] = useState(() => Math.min(NODES.length, getFlag('campaignProgress') || 0))
  const [credits, setCredits] = useState(getCredits)
  const [fleet, setFleet] = useState(getFleet)
  const [confirmReset, setConfirmReset] = useState(false)
  const [showDebug, setShowDebug] = useState(false)      // debug unlock hidden until Z is pressed
  const operatorPortrait = getFlag('operatorPortrait')   // set once an operator is chosen
  const operatorName = getFlag('operator')
  const fleetName = getFlag('fleetName') || 'Fleet Polyhymnia'
  const stateOf = (i) => (i < completed ? 'done' : i === completed ? 'active' : 'locked')

  // wipe all campaign progress, currency and fleet back to the start, then
  // rebuild the map (changing `completed` re-runs the scene effect)
  const doReset = () => {
    resetCampaign()
    setCompleted(0)
    setCredits(getCredits())
    setFleet(getFleet())
    setConfirmReset(false)
  }

  // the Z key toggles the hidden debug controls
  useEffect(() => {
    const onKey = (e) => { if (e.code === 'KeyZ') setShowDebug(v => !v) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // map sounds: a soft tick when the pointer finds a node, a click on select,
  // and a chime when a fresh node ignites at the end of the unlock animation
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

  // While an unlock animation is pending, the freshly-cleared node keeps its
  // locked look (grey ring, dim model, locked label) until the route reaches it
  // and it ignites. Initialised from the persisted seen-progress flag so the
  // very first render doesn't flash the gold state.
  const [unlockPending, setUnlockPending] = useState(() => (getFlag('campaignProgressSeen') || 0) < Math.min(NODES.length, getFlag('campaignProgress') || 0))

  // debug: clear every node and grant the matching Requisition
  const doUnlockAll = () => {
    unlockAllCampaign()
    setCompleted(NODES.length)
    setCredits(getCredits())
    setFleet(getFleet())
  }
  // debug: clear just the next node — the seen-progress flag still holds the old
  // value, so the scene rebuilds straight into the unlock animation
  const doUnlockNext = () => {
    const next = Math.min(NODES.length, completed + 1)
    if (next === completed) return
    setFlag('campaignProgress', next)
    setUnlockPending(true)   // keep the new node's label locked until it ignites
    setCompleted(next)
  }

  useEffect(() => {
    const mount = mountRef.current
    if (!mount) return
    let renderer, composer, raf
    try {
      const w = mount.clientWidth || 1, h = mount.clientHeight || 1
      const scene = new THREE.Scene()
      const camera = new THREE.PerspectiveCamera(48, w / h, 0.1, 900)
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
      renderer.setSize(w, h); renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
      mount.appendChild(renderer.domElement)

      scene.add(new THREE.AmbientLight(0x6678a0, 0.95))
      const key = new THREE.DirectionalLight(0xcfe0ff, 1.0); key.position.set(8, 14, 12); scene.add(key)
      const rim = new THREE.DirectionalLight(0x5a78c0, 0.5); rim.position.set(-10, -6, -8); scene.add(rim)

      // nebula skydome + stars
      const nebGeo = new THREE.SphereGeometry(420, 32, 32)
      const nebMat = new THREE.ShaderMaterial({ vertexShader: NEBULA_VERT, fragmentShader: NEBULA_FRAG, uniforms: { uColA: { value: new THREE.Color(0.035, 0.06, 0.15) }, uColB: { value: new THREE.Color(0.10, 0.04, 0.17) }, uColWarm: { value: new THREE.Color(0.18, 0.07, 0.10) } }, side: THREE.BackSide, depthWrite: false, depthTest: false })
      const neb = new THREE.Mesh(nebGeo, nebMat); neb.renderOrder = -10; scene.add(neb)
      const sc = 1400, sp = new Float32Array(sc * 3)
      for (let i = 0; i < sc; i++) { const rr = 150 + Math.random() * 230, th = Math.random() * Math.PI * 2, ph = Math.acos(2 * Math.random() - 1); sp[i * 3] = rr * Math.sin(ph) * Math.cos(th); sp[i * 3 + 1] = rr * Math.sin(ph) * Math.sin(th); sp[i * 3 + 2] = rr * Math.cos(ph) }
      const starGeo = new THREE.BufferGeometry(); starGeo.setAttribute('position', new THREE.BufferAttribute(sp, 3))
      const stars = new THREE.Points(starGeo, new THREE.PointsMaterial({ size: 0.7, sizeAttenuation: true, color: 0x9fb4d8, transparent: true, opacity: 0.85 })); scene.add(stars)

      // node positions — a serpentine route across the sector
      const N = NODES.length
      const complete = completed >= N   // every node cleared → victory state
      const positions = []
      for (let i = 0; i < N; i++) positions.push(new THREE.Vector3(-62 + (124 / (N - 1)) * i, Math.sin(i * 0.9) * 16, Math.cos(i * 0.6) * 8))

      // the jump route: a faint base conduit, with the travelled portion lit
      const curve = new THREE.CatmullRomCurve3(positions)
      const baseTube = new THREE.Mesh(new THREE.TubeGeometry(curve, 220, 0.12, 6, false), new THREE.MeshBasicMaterial({ color: 0x4a6a9a, opacity: 0.3, ...ADD })); scene.add(baseTube)
      let pulse = null, travelled = null, revealPortion = 1
      // unlock moment: if the player cleared new ground since they last saw the
      // map, grow the fresh route segment in and ignite the new node's ring
      const TUBE_SEGS = 120, TUBE_IDX_PER_SEG = 36   // radial 6 × 2 tris × 3 indices
      const IGNITE_DUR = 1.1
      const seen = Math.min(getFlag('campaignProgressSeen') || 0, completed)
      const unlock = completed > seen ? { t: 0, from: seen / completed, done: false, ignite: 0 } : null
      setFlag('campaignProgressSeen', completed)
      setUnlockPending(!!unlock)   // keep the React labels in step with the scene
      if (completed > 0) {
        const frac = Math.min(1, completed / (N - 1))
        const pts = []; for (let t = 0; t <= frac + 1e-4; t += frac / 80) pts.push(curve.getPoint(Math.min(frac, t)))
        // travelled route is rose in-progress; the whole route turns gold on completion
        if (pts.length > 1) {
          const tubeGeo = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), TUBE_SEGS, complete ? 0.3 : 0.22, 6, false)
          travelled = new THREE.Mesh(tubeGeo, new THREE.MeshBasicMaterial({ color: complete ? 0xffd24a : 0xff5bd0, opacity: complete ? 0.9 : 0.8, ...ADD }))
          scene.add(travelled)
          if (unlock) {   // start revealed only up to the previously-seen node
            revealPortion = unlock.from
            tubeGeo.setDrawRange(0, Math.floor(unlock.from * TUBE_SEGS) * TUBE_IDX_PER_SEG)
          }
        }
        pulse = new THREE.Mesh(new THREE.SphereGeometry(0.6, 12, 12), new THREE.MeshBasicMaterial({ color: complete ? 0xffe9a8 : 0xff9be8, opacity: 0.95, ...ADD })); scene.add(pulse)
      }

      // unlock dressing: a bright energy head rides the growing route tip, and a
      // shockwave ring detonates at the new node the moment it ignites
      let head = null, burst = null
      const GOLD = new THREE.Color(0xffd24a), LOCKED_GREY = new THREE.Color(0x55607a)
      if (unlock) {
        head = new THREE.Mesh(new THREE.SphereGeometry(0.9, 12, 12), new THREE.MeshBasicMaterial({ color: 0xffc4ef, opacity: 0.95, ...ADD }))
        head.visible = false; scene.add(head)
        burst = new THREE.Mesh(new THREE.RingGeometry(0.62, 1.0, 40), new THREE.MeshBasicMaterial({ color: 0xffd24a, opacity: 0, side: THREE.DoubleSide, ...ADD }))
        burst.position.copy(positions[Math.min(completed, N - 1)]); burst.visible = false; scene.add(burst)
      }
      const unlockMats = []   // the pending node's dimmed materials, restored as it powers on

      // nodes
      const TEAM_RING = { done: 0x4aa0ff, active: 0xffd24a, locked: 0x55607a }
      const nodes = positions.map((pos, i) => {
        const pending = !!unlock && i === completed        // freshly unlocked — stays dark until it ignites
        const st = pending ? 'pending' : stateOf(i)
        const group = new THREE.Group(); group.position.copy(pos)
        const model = buildNode(NODES[i].model); group.add(model)
        if (st === 'locked') model.traverse(n => { if (n.material && n.material.emissive) { n.material.emissiveIntensity *= 0.25; n.material.color.multiplyScalar(0.4) } })
        if (pending) {                                     // dim like a locked node, but remember how to power back on
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
        const dimmed = st === 'locked' || pending
        const ring = new THREE.Mesh(new THREE.TorusGeometry(5.5, 0.14, 8, 56), new THREE.MeshBasicMaterial({ color: complete ? 0xffd24a : TEAM_RING[pending ? 'locked' : st], opacity: dimmed ? 0.4 : 0.85, ...ADD }))
        group.add(ring)
        const hit = new THREE.Mesh(new THREE.SphereGeometry(6.6, 8, 8), new THREE.MeshBasicMaterial({ visible: false })); group.add(hit)
        scene.add(group)
        return {
          i, st, group, model, ring, hit, spin: 0.2 + Math.random() * 0.2,
          modelBase: model.scale.x,                       // fit() baked a scale — hover multiplies it
          ringOpacity: dimmed ? 0.4 : 0.85,
          hoverT: 0,                                      // eased 0..1 hover response
        }
      })

      // interaction
      const raycaster = new THREE.Raycaster(), pointer = new THREE.Vector2()
      let hovered = -1, downX = 0, downY = 0
      const hitMap = new Map(nodes.map(n => [n.hit, n]))
      const pick = (e) => {
        const rect = renderer.domElement.getBoundingClientRect()
        pointer.set(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1)
        raycaster.setFromCamera(pointer, camera)
        const hits = raycaster.intersectObjects(nodes.map(n => n.hit))
        return hits.length ? hitMap.get(hits[0].object) : null
      }
      const onMove = (e) => {
        const n = pick(e); const clickable = n && n.i <= completed
        const next = clickable ? n.i : -1
        if (next !== -1 && next !== hovered) playTick()   // blip when the pointer finds a node
        hovered = next
        renderer.domElement.style.cursor = clickable ? 'pointer' : 'default'
      }
      const onDown = (e) => { downX = e.clientX; downY = e.clientY }
      const onUp = (e) => { if (Math.hypot(e.clientX - downX, e.clientY - downY) > 6) return; const n = pick(e); if (n && n.i <= completed) { playClick(); onPlay(n.i) } }
      renderer.domElement.addEventListener('pointermove', onMove)
      renderer.domElement.addEventListener('pointerdown', onDown)
      renderer.domElement.addEventListener('pointerup', onUp)

      composer = new EffectComposer(renderer)
      composer.addPass(new RenderPass(scene, camera))
      composer.addPass(new UnrealBloomPass(new THREE.Vector2(w, h), 0.7, 0.55, 0.2))

      const _v = new THREE.Vector3(), clock = new THREE.Clock(); let T = 0
      const camBase = new THREE.Vector3(0, 6, 104)
      const frame = () => {
        const dt = Math.min(clock.getDelta(), 0.05); T += dt
        // gentle parallax drift
        camera.position.set(camBase.x + Math.sin(T * 0.18) * 4, camBase.y + Math.sin(T * 0.13) * 2, camBase.z)
        camera.lookAt(0, 0, 0)
        stars.rotation.y += dt * 0.005

        const hoverEase = 1 - Math.exp(-10 * dt)
        for (const n of nodes) {
          n.hoverT += ((n.i === hovered ? 1 : 0) - n.hoverT) * hoverEase
          n.model.rotation.y += n.spin * dt
          n.model.scale.setScalar(n.modelBase * (1 + 0.16 * n.hoverT))   // the node itself swells on hover
          n.ring.lookAt(camera.position)
          let op = n.ringOpacity, sc = 1
          if (n.st === 'active') { op = 0.7 + 0.3 * Math.sin(T * 3); sc = 1 + 0.06 * Math.sin(T * 3) }
          n.ring.material.opacity = op + (1 - op) * n.hoverT             // ring brightens toward full
          n.ring.scale.setScalar(Math.max(sc, 1 + 0.14 * n.hoverT))
        }

        // unlock moment: after a short beat the fresh route segment grows in
        // behind a bright energy head; when it arrives, the new node ignites —
        // ring flashes grey→gold, the model powers on, a shockwave ring blooms
        if (unlock && !unlock.done) {
          unlock.t += dt
          const p = Math.min(1, Math.max(0, (unlock.t - 0.7) / 1.5))
          const e = p * p * (3 - 2 * p)                                  // smoothstep growth
          revealPortion = unlock.from + (1 - unlock.from) * e
          if (travelled) travelled.geometry.setDrawRange(0, Math.floor(revealPortion * TUBE_SEGS) * TUBE_IDX_PER_SEG)
          if (head) {
            head.visible = p > 0 && p < 1
            const frac = Math.min(1, completed / (N - 1))
            head.position.copy(curve.getPoint(frac * revealPortion))
            head.scale.setScalar(1 + 0.35 * Math.sin(T * 16))            // crackling tip
          }
          if (p >= 1) {
            unlock.done = true; unlock.ignite = IGNITE_DUR
            if (head) head.visible = false
            playIgnite()
            setUnlockPending(false)   // the gold label appears only now, as the node powers on
          }
        } else if (unlock && unlock.ignite > 0) {
          unlock.ignite -= dt
          const k = Math.max(0, unlock.ignite / IGNITE_DUR)              // 1 → 0
          const tI = 1 - k                                               // ignition progress 0 → 1
          const n = nodes[completed]                                     // the node the new route just reached
          if (n) {
            n.ring.material.color.lerpColors(LOCKED_GREY, GOLD, Math.min(1, tI * 2.2))
            n.ring.material.opacity = 1
            n.ring.scale.setScalar(1 + 1.9 * k * k)
            for (const um of unlockMats) {                               // the node's lights come back on
              um.m.emissiveIntensity = um.eDim + (um.e0 - um.eDim) * tI
              um.m.color.lerpColors(um.cDim, um.c0, tI)
            }
            if (burst) {
              burst.visible = true
              burst.lookAt(camera.position)
              burst.scale.setScalar(1 + tI * 13)
              burst.material.opacity = 0.85 * k
            }
            if (unlock.ignite <= 0) {                                    // hand over to the normal active pulse
              n.st = 'active'
              n.ringOpacity = 0.85
              n.ring.material.color.copy(GOLD)
              for (const um of unlockMats) { um.m.emissiveIntensity = um.e0; um.m.color.copy(um.c0) }
              if (burst) burst.visible = false
            }
          }
        }
        if (pulse) { const frac = Math.min(1, completed / (N - 1)); pulse.position.copy(curve.getPoint(((T * 0.18) % 1) * frac * revealPortion)) }

        // position the HTML labels
        for (let i = 0; i < nodes.length; i++) {
          const el = labelRefs.current[i]; if (!el) continue
          el.classList.toggle('cmap-label--show', i === hovered)
          _v.copy(positions[i]); _v.y -= 7; _v.project(camera)
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
        cancelAnimationFrame(raf); ro.disconnect()
        renderer.domElement.removeEventListener('pointermove', onMove); renderer.domElement.removeEventListener('pointerdown', onDown); renderer.domElement.removeEventListener('pointerup', onUp)
        const seen = new Set()
        scene.traverse(node => { if (node.geometry && !seen.has(node.geometry)) { seen.add(node.geometry); node.geometry.dispose() } const mats = node.material ? (Array.isArray(node.material) ? node.material : [node.material]) : []; for (const m of mats) if (!seen.has(m)) { seen.add(m); m.dispose() } })
        composer.dispose && composer.dispose(); renderer.dispose()
        if (renderer.domElement.parentNode) renderer.domElement.parentNode.removeChild(renderer.domElement)
      }
    } catch (err) {
      console.error('Campaign map failed to initialise:', err)
      if (renderer) { try { renderer.dispose() } catch (_) { /* noop */ } }
    }
  }, [completed, onPlay])

  return (
    <div id="campaign-map">
      <HudHeader onLogout={onExit} right={<span className="label">URSU EUBULEUS SECTOR // CAMPAIGN</span>} />
      <div className="cmap-stage">
        <div className="cmap-canvas" ref={mountRef} />
        {/* the whole readout — fleet name + portrait + requisition/fleet — only
            makes sense once an operator has been chosen, so hide it until then.
            Clicking it opens the Fleet Review. */}
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

        {completed >= NODES.length && (
          <div className="cmap-complete">
            <div className="cmap-complete-sub">✦ Campaign Complete ✦</div>
            <div className="cmap-complete-title">ORDER RESTORED</div>
            <div className="cmap-complete-motto">Caelum canit, illa audit</div>
          </div>
        )}

        {NODES.map((node, i) => {
          // during an unlock animation the fresh node's label stays locked; the
          // gold active state appears only once the route reaches it and ignites
          const st = (unlockPending && i === completed) ? 'locked' : stateOf(i)
          return (
            <div key={i} className={`cmap-label cmap-label--${st}`} ref={el => (labelRefs.current[i] = el)}>
              <div className="cmap-num">{String(i + 1).padStart(2, '0')}</div>
              <div className="cmap-title">{node.title}</div>
              <div className="cmap-state">{st === 'done' ? '✓ COMPLETE' : st === 'active' ? '▶ PLAY' : '🔒 LOCKED'}</div>
            </div>
          )
        })}
        <div className="cmap-hint">{completed >= NODES.length ? 'The Order is restored — select a system to revisit' : 'Select a system to begin the operation'}</div>

        {showDebug && <button className="cmap-unlock" onClick={doUnlockAll}>⚡ DEBUG · UNLOCK ALL</button>}
        {showDebug && <button className="cmap-unlock cmap-givemacro" onClick={onCards}>⚡ DEBUG · CARD VAULT</button>}
        {showDebug && <button className="cmap-unlock cmap-drawtest" onClick={onDrawTest}>⚡ DEBUG · DRAW TEST</button>}
        {showDebug && <button className="cmap-unlock cmap-unlocknext" onClick={doUnlockNext} disabled={completed >= NODES.length}>⚡ DEBUG · UNLOCK NEXT NODE</button>}
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
