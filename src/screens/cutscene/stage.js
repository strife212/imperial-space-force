import * as THREE from 'three'
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js'
import { NEBULA_VERT, NEBULA_FRAG } from '../battle/geometry'
import { createFX } from './fx'
import { createCutsceneSfx } from './sfx'

const UP = new THREE.Vector3(0, 1, 0), _ORIGIN = new THREE.Vector3()
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion()
// Point an object's +Z down `dir` (snap, or eased toward it when `smooth` given)
export function orient(obj, dir, smooth) {
  if (dir.lengthSq() < 1e-6) return
  _m.lookAt(dir, _ORIGIN, UP); _q.setFromRotationMatrix(_m)
  if (smooth == null) obj.quaternion.copy(_q); else obj.quaternion.slerp(_q, smooth)
}

// Nebula skydome + starfield, matching the battle backdrop. Returns disposables.
function makeBackdrop(scene) {
  const disposables = []
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
  const n = 1200, sp = new Float32Array(n * 3)
  for (let i = 0; i < n; i++) {
    const rr = 140 + Math.random() * 210, th = Math.random() * Math.PI * 2, ph = Math.acos(2 * Math.random() - 1)
    sp[i * 3] = rr * Math.sin(ph) * Math.cos(th); sp[i * 3 + 1] = rr * Math.sin(ph) * Math.sin(th); sp[i * 3 + 2] = rr * Math.cos(ph)
  }
  const starGeo = new THREE.BufferGeometry(); starGeo.setAttribute('position', new THREE.BufferAttribute(sp, 3))
  const starMat = new THREE.PointsMaterial({ size: 0.7, sizeAttenuation: true, color: 0x9fb4d8, transparent: true, opacity: 0.85 })
  scene.add(new THREE.Points(starGeo, starMat)); disposables.push(starGeo, starMat)
  return { disposables, starMat, nebMat }
}

// Boot a cutscene's three.js stage — renderer, scene, camera, bloom, lights,
// backdrop and FX — then run the scene's per-frame update in a rAF loop. The
// scene is `{ bloom?, create(ctx) -> update(dt) }`; `hooks` bridges to React
// ({ comms, end }). Returns a teardown fn.
export function createStage(mount, sceneDef, hooks) {
  const w = mount.clientWidth || 1, h = mount.clientHeight || 1
  const scene = new THREE.Scene()
  const camera = new THREE.PerspectiveCamera(50, w / h, 0.1, 900)

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
  renderer.setSize(w, h); renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  mount.appendChild(renderer.domElement)

  const ambient = new THREE.AmbientLight(0x4a5a80, 0.8); scene.add(ambient)
  const keyLight = new THREE.DirectionalLight(0xcfe0ff, 0.85); keyLight.position.set(6, 12, 8); scene.add(keyLight)
  const rimLight = new THREE.DirectionalLight(0x4060a0, 0.4); rimLight.position.set(-10, -4, -12); scene.add(rimLight)

  const backdrop = makeBackdrop(scene)
  // passive stages (menu backdrop) pass no comms hook — they get no audio engine
  const sfx = hooks.comms ? createCutsceneSfx() : null
  const fx = createFX(scene, sfx)   // bolts + blasts play their own laser/boom

  const tracked = []
  const ctx = {
    scene, camera, fx, sfx, orient, rimLight,
    lights: { ambient, key: keyLight, rim: rimLight },
    backdrop: { starMat: backdrop.starMat, nebMat: backdrop.nebMat },
    // every comms box opens with the battle's radio chirp (scenes with their own
    // scored soundtrack opt out via `quietComms`)
    comms: hooks.comms
      ? { show: (...a) => { if (!sceneDef.quietComms) sfx.comms(); hooks.comms.show(...a) }, hide: hooks.comms.hide }
      : { show: () => {}, hide: () => {} },
    end: hooks.end,
    track: (...ds) => { for (const d of ds) tracked.push(d) },
  }
  const update = sceneDef.create(ctx)

  const composer = new EffectComposer(renderer)
  composer.addPass(new RenderPass(scene, camera))
  composer.addPass(new UnrealBloomPass(new THREE.Vector2(w, h), sceneDef.bloom ?? 0.7, 0.5, 0.25))

  const clock = new THREE.Clock()
  let raf
  const frame = () => {
    const dt = Math.min(clock.getDelta(), 0.05)
    update(dt)
    fx.update(dt, camera)
    composer.render()
    raf = requestAnimationFrame(frame)
  }
  frame()

  const onResize = () => {
    const nw = mount.clientWidth, nh = mount.clientHeight; if (!nw || !nh) return
    camera.aspect = nw / nh; camera.updateProjectionMatrix(); renderer.setSize(nw, nh); composer.setSize(nw, nh)
  }
  const ro = new ResizeObserver(onResize); ro.observe(mount)

  return () => {
    cancelAnimationFrame(raf); ro.disconnect()
    sfx?.dispose()
    fx.dispose()
    backdrop.disposables.forEach(d => d.dispose && d.dispose())
    tracked.forEach(d => d.dispose && d.dispose())
    // catch-all: dispose every geometry/material still attached to the scene
    const seen = new Set()
    scene.traverse(node => {
      if (node.geometry && !seen.has(node.geometry)) { seen.add(node.geometry); node.geometry.dispose() }
      const mats = node.material ? (Array.isArray(node.material) ? node.material : [node.material]) : []
      for (const m of mats) if (!seen.has(m)) { seen.add(m); m.dispose() }
    })
    composer.dispose && composer.dispose(); renderer.dispose()
    if (renderer.domElement.parentNode) renderer.domElement.parentNode.removeChild(renderer.domElement)
  }
}
