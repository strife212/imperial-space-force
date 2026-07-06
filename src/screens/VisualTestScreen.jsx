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
  buildBlueModel, buildRedModel, buildBlueCapital, buildRedCapital,
  buildBlueBomber, buildRedBomber, buildBlueCruiser, buildRedCruiser, buildScienceVessel, buildBlueCapital2, buildAleph, makeShield,
  buildGasGiantModel, buildRingedPlanetModel, buildEarthlikeModel, buildMachinePlanetModel, buildBlackHoleModel, buildBlackHoleLensedModel, buildGalaxyModel, buildStarModel,
  GALAXY_DEFAULTS,
  SKIES, makeNebulaSky,
} from './battle/geometry'
import { buildStation, buildCathedra, buildRelay, buildWorldEngine, buildAnnunciator } from './cutscene/models'
import './battle/battle.css'

// Faction-less cutscene props + celestial bodies: each is a self-contained group
// (owns its materials), shown on its own in the model viewer.
const PROP_BUILD = {
  aleph:       buildAleph,
  worldengine: buildWorldEngine,
  station:     buildStation,
  cathedra:    buildCathedra,
  relay:       buildRelay,
  annunciator: buildAnnunciator,
  blackhole:   buildBlackHoleModel,
  blackhole2:  buildBlackHoleLensedModel,
  gasgiant:    buildGasGiantModel,
  ringedplanet: buildRingedPlanetModel,
  earthlike:   buildEarthlikeModel,
  machineplanet: buildMachinePlanetModel,
  star:        buildStarModel,
  galaxy:      buildGalaxyModel,
}
const PROP_LABEL = {
  aleph: 'Aleph', worldengine: 'World Engine', station: 'Orbital Station', cathedra: 'Cathedra', relay: 'Sensor Relay', annunciator: 'Annunciator · RKV',
  blackhole: 'Black Hole', blackhole2: 'Black Hole · Lensed', gasgiant: 'Gas Giant', ringedplanet: 'Ringed Planet',
  earthlike: 'Earthlike Planet', machineplanet: 'Litania Magna', star: 'Star · Main Sequence', galaxy: 'Spiral Galaxy',
}
const PROP_RIM = {
  aleph: 0xffcf5a, worldengine: 0x6f86ff, station: 0xffd28a, cathedra: 0xfff0c4, relay: 0x9fe0ff, annunciator: 0xffb08a,
  blackhole: 0xacdcff, blackhole2: 0xffd9a0, gasgiant: 0x5fa0ff, ringedplanet: 0xd8b88a, earthlike: 0x74b8ff,
  machineplanet: 0x6f86ff, star: 0xffb060, galaxy: 0x9fb0ff,
}

// ── Galaxy tuning panel ──────────────────────────────────────────────────────
// Every galaxy look parameter is a shader uniform, so the sliders retune the
// live material through userData.galaxy without rebuilding the model.
const GAL_SLIDERS = [
  { key: 'radius', label: 'Size',    min: 14,   max: 44,   step: 1,     fmt: v => v.toFixed(0) },
  { key: 'arms',   label: 'Arms',    min: 1,    max: 7,    step: 1,     fmt: v => v.toFixed(0) },
  { key: 'twist',  label: 'Twist',   min: -9,   max: 9,    step: 0.1,   fmt: v => v.toFixed(1) },
  { key: 'bulge',  label: 'Core',    min: 0.12, max: 0.55, step: 0.01,  fmt: v => v.toFixed(2) },
  { key: 'thick',  label: 'Thick',   min: 0.03, max: 0.22, step: 0.005, fmt: v => v.toFixed(2) },
  { key: 'dust',   label: 'Dust',    min: 0,    max: 1.4,  step: 0.05,  fmt: v => v.toFixed(2) },
  { key: 'glow',   label: 'Glow',    min: 0.2,  max: 2.5,  step: 0.05,  fmt: v => v.toFixed(2) },
  { key: 'spin',   label: 'Spin',    min: 0,    max: 3,    step: 0.1,   fmt: v => v.toFixed(1) },
]
const GAL_COLORS = [
  { key: 'coreCol', label: 'Core' },
  { key: 'armCol',  label: 'Arms' },
  { key: 'dustCol', label: 'Dust' },
]
const GAL_PRESETS = [
  { name: 'Azure',     coreCol: '#ffe2b8', armCol: '#7fa8ff', dustCol: '#8a5a3a' },
  { name: 'Ember',     coreCol: '#ffd9a0', armCol: '#ff9a5a', dustCol: '#6e3a2a' },
  { name: 'Verdigris', coreCol: '#fff2c8', armCol: '#63e0c0', dustCol: '#2a4a44' },
  { name: 'Heretic',   coreCol: '#ffc8ee', armCol: '#c86bff', dustCol: '#4a2a5e' },
]
function applyGalaxy(obj, p) {
  const gx = obj?.userData?.galaxy
  if (!gx || !p) return
  const u = gx.uniforms
  u.uRadius.value = p.radius; u.uThick.value = p.thick
  u.uArms.value = p.arms; u.uTwist.value = p.twist; u.uBulge.value = p.bulge
  u.uDust.value = p.dust; u.uGlow.value = p.glow
  u.uCoreCol.value.set(p.coreCol); u.uArmCol.value.set(p.armCol); u.uDustCol.value.set(p.dustCol)
  gx.params.spin = p.spin
}

const TYPES = ['fighter', 'bomber', 'cruiser', 'capital']
const LABEL = { fighter: 'Fighter', bomber: 'Bomber', cruiser: 'Cruiser', capital: 'Capital' }
const scaleFor = (k) => k === 'capital' || k === 'capital2' || k === 'science' ? 3.2 : k === 'bomber' ? BOMBER_SCALE : k === 'cruiser' ? CRUISER_SCALE : 1
const buildGeo = (k, team) =>
  k === 'science' ? buildScienceVessel()
  : k === 'capital2' ? buildBlueCapital2()
  : k === 'capital' ? (team === 'blue' ? buildBlueCapital() : buildRedCapital())
  : k === 'bomber' ? (team === 'blue' ? buildBlueBomber() : buildRedBomber())
  : k === 'cruiser' ? (team === 'blue' ? buildBlueCruiser() : buildRedCruiser())
  : (team === 'blue' ? buildBlueModel() : buildRedModel())

// Descriptive class name for the model-viewer list
const CLASS_NAME = (k, team) =>
  team === 'prop' ? PROP_LABEL[k]
  : k === 'science' ? 'Science Vessel'
  : k === 'capital2' ? 'Capital Ship II'
  : k === 'capital' ? 'Capital Ship'
  : k === 'bomber' ? 'Heavy Bomber'
  : k === 'cruiser' ? 'Missile Cruiser'
  : team === 'blue' ? 'Interceptor' : 'Marauder'
// Every model: each team's ships (grouped by class) plus faction-less cutscene props
const MODELS = [
  ...TYPES.flatMap(kind => ['blue', 'red'].map(team => ({ kind, team }))),
  { kind: 'capital2', team: 'blue' },
  { kind: 'science', team: 'blue' },
  ...['aleph', 'worldengine', 'station', 'cathedra', 'relay', 'annunciator', 'blackhole', 'blackhole2', 'gasgiant', 'ringedplanet', 'earthlike', 'machineplanet', 'star', 'galaxy'].map(kind => ({ kind, team: 'prop' })),
]

// A single large viewer that renders the selected ship on an orbitable turntable.
// One WebGL context for the whole gallery — the hull is swapped in place when the
// selection changes, so the list scales to any number of models.
function ModelStage({ kind, team, galaxy }) {
  const mountRef = useRef(null)
  const sceneRef = useRef(null)
  const galRef = useRef(galaxy)   // latest galaxy params, for applying after a model swap

  // set up the renderer / scene / controls once
  useEffect(() => {
    const mount = mountRef.current
    if (!mount) return
    let raf
    try {
      const w = mount.clientWidth || 1, h = mount.clientHeight || 1
      const scene = new THREE.Scene()
      const camera = new THREE.PerspectiveCamera(45, w / h, 0.1, 600)
      const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
      renderer.setSize(w, h)
      mount.appendChild(renderer.domElement)
      const controls = new OrbitControls(camera, renderer.domElement)
      controls.enableDamping = true; controls.dampingFactor = 0.06; controls.enablePan = false
      controls.autoRotate = true; controls.autoRotateSpeed = 0.5
      scene.add(new THREE.AmbientLight(0x90a8d0, 0.75))
      const key = new THREE.DirectionalLight(0xffffff, 1.2); key.position.set(4, 6, 5); scene.add(key)
      const rim = new THREE.DirectionalLight(0x4060a0, 0.6); rim.position.set(-5, -2, -4); scene.add(rim)
      const holder = new THREE.Group(); scene.add(holder)
      const composer = new EffectComposer(renderer)
      composer.addPass(new RenderPass(scene, camera))
      composer.addPass(new UnrealBloomPass(new THREE.Vector2(w, h), 0.7, 0.5, 0.25))   // glow for emissive cores
      sceneRef.current = { scene, camera, renderer, controls, holder, rim }
      const clock = new THREE.Clock()
      const loop = () => {
        const top = holder.children[0]
        top?.userData.tick?.(clock.getElapsedTime())   // drive any animated body (black-hole disk)
        controls.update(); composer.render(); raf = requestAnimationFrame(loop)
      }
      loop()
      const onResize = () => {
        const nw = mount.clientWidth, nh = mount.clientHeight; if (!nw || !nh) return
        camera.aspect = nw / nh; camera.updateProjectionMatrix(); renderer.setSize(nw, nh); composer.setSize(nw, nh)
      }
      const ro = new ResizeObserver(onResize); ro.observe(mount)
      return () => {
        cancelAnimationFrame(raf); ro.disconnect(); controls.dispose()
        holder.traverse(n => { n.geometry?.dispose?.(); if (n.material) (Array.isArray(n.material) ? n.material : [n.material]).forEach(m => m.dispose()) })
        composer.dispose?.(); renderer.dispose()
        if (renderer.domElement.parentNode) renderer.domElement.parentNode.removeChild(renderer.domElement)
        sceneRef.current = null
      }
    } catch (err) {
      console.error('Model stage failed to initialise:', err)
    }
  }, [])

  // swap the displayed model whenever the selection changes
  useEffect(() => {
    const st = sceneRef.current
    if (!st) return
    const { holder, camera, controls, rim } = st
    while (holder.children.length) {
      const c = holder.children[0]; holder.remove(c)
      c.traverse(n => { n.geometry?.dispose?.(); if (n.material) (Array.isArray(n.material) ? n.material : [n.material]).forEach(m => m.dispose()) })
    }
    let radius
    if (team === 'prop') {
      // self-contained cutscene prop (its own materials) — recentre via bounding box
      const obj = (PROP_BUILD[kind] || buildAleph)()
      applyGalaxy(obj, galRef.current)
      holder.add(obj)
      const box = new THREE.Box3().setFromObject(obj)
      obj.position.sub(box.getCenter(new THREE.Vector3()))
      radius = box.getSize(new THREE.Vector3()).length() / 2
      rim.color.set(PROP_RIM[kind] ?? 0xffcf5a)
    } else {
      const geo = buildGeo(kind, team); geo.center(); geo.computeBoundingSphere()
      const mat = new THREE.MeshStandardMaterial({ color: TEAMS[team].color, emissive: TEAMS[team].color, emissiveIntensity: 0.34, metalness: 0.6, roughness: 0.4 })
      holder.add(new THREE.Mesh(geo, mat))
      radius = geo.boundingSphere.radius || 1
      rim.color.set(TEAMS[team].color)
    }
    const r = radius || 1
    // set the zoom limits before update(): update() clamps to the previous
    // model's limits, which strands the camera when sizes differ wildly
    controls.minDistance = r * 1.2; controls.maxDistance = r * 6
    camera.position.set(0, r * 0.5, r * 2.8); controls.target.set(0, 0, 0); controls.update()
  }, [kind, team])

  // retune the live galaxy material as the sliders move (no rebuild)
  useEffect(() => {
    galRef.current = galaxy
    const st = sceneRef.current
    if (st) applyGalaxy(st.holder.children[0], galaxy)
  }, [galaxy])

  return <div className="vistest-stage-canvas" ref={mountRef} />
}

export default function VisualTestScreen({ onReturn }) {
  const mountRef = useRef(null)
  const [mode, setMode] = useState('combat')        // 'combat' duel sandbox | 'viewer' model gallery
  const [selected, setSelected] = useState(MODELS[0])  // model shown in the viewer
  const [blueType, setBlueType] = useState('fighter')
  const [redType, setRedType]   = useState('fighter')
  const [resetKey, setResetKey] = useState(0)
  const [flares, setFlares]     = useState(false)   // unlimited flares (capital/bomber decoy every missile)
  const flaresRef = useRef(flares)
  useEffect(() => { flaresRef.current = flares }, [flares])
  const [sky, setSky] = useState(SKIES[0].key)      // combat-mode nebula backdrop
  const skyRef = useRef(null)                       // live sky handle from the scene
  useEffect(() => { skyRef.current?.setSky(sky) }, [sky])
  const [gal, setGal] = useState({ ...GALAXY_DEFAULTS })   // galaxy-viewer tuning params

  useEffect(() => {
    if (mode !== 'combat') return       // the duel scene only runs in combat mode
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

      // nebula skydome + stars (matches the battle backdrop); the dropdown swaps
      // the sky palette live via skyRef
      const nebulaSky = makeNebulaSky(scene, disposables, sky)
      skyRef.current = nebulaSky
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
        // no death/impact blast in the sandbox — ships are indestructible, so a
        // burst on every hit just clutters the view. (Capital shields still flare.)
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
      let sceneT = 0
      const frame = () => {
        const dt = Math.min(clock.getDelta(), 0.05)
        sceneT += dt
        nebulaSky.tick(sceneT)   // slow nebula cloud drift

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
        skyRef.current = null
        disposables.forEach(d => d.dispose && d.dispose())
        blasts.forEach(x => { x.fmat.dispose(); x.rmat.dispose() }); puffs.forEach(p => p.mat.dispose()); flameFX.forEach(f => f.mat.dispose())
        composer.dispose && composer.dispose(); renderer.dispose()
        if (renderer.domElement.parentNode) renderer.domElement.parentNode.removeChild(renderer.domElement)
      }
    } catch (err) {
      console.error('Visual test failed to initialise:', err)
      if (renderer) { try { renderer.dispose() } catch (_) {} }
    }
  }, [blueType, redType, resetKey, mode])

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
      <HudHeader onLogout={onReturn} right={<span className="label">VFX-LAB / {mode === 'combat' ? 'COMBAT VISUAL TEST' : 'MODEL VIEWER'}</span>} />
      <div className="vistest-stage">
        <div className="vistest-modes">
          <button className={`vistest-mode-btn${mode === 'combat' ? ' vistest-mode-btn--on' : ''}`} onClick={() => setMode('combat')}>Combat</button>
          <button className={`vistest-mode-btn${mode === 'viewer' ? ' vistest-mode-btn--on' : ''}`} onClick={() => setMode('viewer')}>Model Viewer</button>
        </div>

        {mode === 'combat' ? (
          <>
            <div className="vistest-canvas" ref={mountRef} />
            <div className="vistest-controls">
              {typeRow('blue', blueType, setBlueType)}
              <div className="vistest-mid">
                <button className="vistest-reset" onClick={() => setResetKey(k => k + 1)}>⟳ RESET</button>
                <label className="vistest-check">
                  <input type="checkbox" checked={flares} onChange={(e) => setFlares(e.target.checked)} />
                  Flares: {flares ? 'unlimited' : 'off'}
                </label>
                <label className="vistest-check vistest-sky">
                  Sky:
                  <select className="vistest-select" value={sky} onChange={(e) => setSky(e.target.value)}>
                    {SKIES.map(s => <option key={s.key} value={s.key}>{s.name}</option>)}
                  </select>
                </label>
              </div>
              {typeRow('red', redType, setRedType)}
            </div>
            <div className="vistest-hint">Drag to orbit // scroll to zoom // ships are indestructible</div>
          </>
        ) : (
          <div className="vistest-viewer">
            <div className="vistest-list">
              {MODELS.map(({ kind, team }) => {
                const on = selected.kind === kind && selected.team === team
                return (
                  <button
                    key={team + kind}
                    className={`vistest-list-item vistest-list-item--${team}${on ? ' vistest-list-item--on' : ''}`}
                    onClick={() => setSelected({ kind, team })}
                  >
                    <span className="vistest-list-dot" />
                    <span className="vistest-list-team">{team.toUpperCase()}</span>
                    <span className="vistest-list-name">{CLASS_NAME(kind, team)}</span>
                  </button>
                )
              })}
            </div>
            <div className="vistest-stage-main">
              <ModelStage kind={selected.kind} team={selected.team} galaxy={gal} />
              <div className={`vistest-stage-label vistest-stage-label--${selected.team}`}>
                <span className="vistest-stage-team">{selected.team.toUpperCase()}</span>
                <span className="vistest-stage-class">{CLASS_NAME(selected.kind, selected.team)}</span>
              </div>
              {selected.team === 'prop' && selected.kind === 'galaxy' && (
                <div className="vistest-gal-panel">
                  <div className="vistest-gal-title">GALAXY PARAMETERS</div>
                  {GAL_SLIDERS.map(({ key, label, min, max, step, fmt }) => (
                    <label className="vistest-gal-row" key={key}>
                      <span className="vistest-gal-label">{label}</span>
                      <input
                        type="range" min={min} max={max} step={step} value={gal[key]}
                        onChange={(e) => { const v = parseFloat(e.target.value); setGal(g => ({ ...g, [key]: v })) }}
                      />
                      <span className="vistest-gal-val">{fmt(gal[key])}</span>
                    </label>
                  ))}
                  <div className="vistest-gal-colors">
                    {GAL_COLORS.map(({ key, label }) => (
                      <label className="vistest-gal-col" key={key}>
                        <input type="color" value={gal[key]} onChange={(e) => { const v = e.target.value; setGal(g => ({ ...g, [key]: v })) }} />
                        {label}
                      </label>
                    ))}
                  </div>
                  <div className="vistest-gal-presets">
                    {GAL_PRESETS.map(p => (
                      <button key={p.name} className="vistest-gal-preset" onClick={() => setGal(g => ({ ...g, coreCol: p.coreCol, armCol: p.armCol, dustCol: p.dustCol }))}>
                        <span className="vistest-gal-swatch" style={{ background: `linear-gradient(90deg, ${p.coreCol}, ${p.armCol})` }} />
                        {p.name}
                      </button>
                    ))}
                  </div>
                  <button className="vistest-gal-reset" onClick={() => setGal({ ...GALAXY_DEFAULTS })}>⟳ RESET</button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
