import { useRef, useEffect, useState } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import { RIM_VERT, RIM_FRAG, DISK_VERT, DISK_FRAG } from '../lib/shaders'
import HudHeader from '../components/HudHeader'
import HudFooter from '../components/HudFooter'

// ── Shared GLSL value-noise / fbm (for the nebula skydome and the planet) ──────
const GLSL_NOISE = /* glsl */`
  float hash(vec3 p){ p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
  float vnoise(vec3 x){
    vec3 i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(mix(hash(i + vec3(0,0,0)), hash(i + vec3(1,0,0)), f.x),
                   mix(hash(i + vec3(0,1,0)), hash(i + vec3(1,1,0)), f.x), f.y),
               mix(mix(hash(i + vec3(0,0,1)), hash(i + vec3(1,0,1)), f.x),
                   mix(hash(i + vec3(0,1,1)), hash(i + vec3(1,1,1)), f.x), f.y), f.z);
  }
  float fbm(vec3 p){ float v = 0.0, a = 0.5; for (int i = 0; i < 5; i++){ v += a * vnoise(p); p *= 2.03; a *= 0.5; } return v; }
`

// ── Nebula skydome — soft fbm gas clouds painted on the inside of a far sphere ──
const NEBULA_VERT = /* glsl */`
  varying vec3 vDir;
  void main() { vDir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
`
const NEBULA_FRAG = /* glsl */`
  precision highp float;
  varying vec3 vDir;
  uniform vec3 uColA; uniform vec3 uColB; uniform vec3 uColWarm;
` + GLSL_NOISE + /* glsl */`
  void main() {
    vec3 d = normalize(vDir);
    float n  = fbm(d * 2.4 + 3.1);
    float n2 = fbm(d * 5.3 + 9.7);
    float clouds = smoothstep(0.30, 0.95, n * 0.75 + n2 * 0.35);
    vec3 col = vec3(0.012, 0.020, 0.045);                 // deep-space base
    col = mix(col, uColA, clouds * 0.7);                  // cool nebula body
    col = mix(col, uColB, smoothstep(0.55, 1.05, n) * 0.55);  // denser purple cores
    float warm = smoothstep(0.15, 1.0, d.x * 0.5 + 0.5) * smoothstep(0.45, 0.95, n2);
    col += uColWarm * warm * 0.22;                        // faint warm region to one side
    gl_FragColor = vec4(col, 1.0);
  }
`

// ── Gas-giant planet — banded fbm surface with a soft day/night terminator ─────
const PLANET_VERT = /* glsl */`
  varying vec3 vWN; varying vec3 vPosL;
  void main() {
    vWN = normalize(mat3(modelMatrix) * normal);
    vPosL = position;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`
const PLANET_FRAG = /* glsl */`
  precision highp float;
  varying vec3 vWN; varying vec3 vPosL;
  uniform vec3 uLightDir; uniform vec3 uColA; uniform vec3 uColB; uniform vec3 uColC;
` + GLSL_NOISE + /* glsl */`
  void main() {
    vec3 n = normalize(vPosL);
    float bands = sin(n.y * 9.0 + fbm(vPosL * 1.4) * 2.6);
    float t = bands * 0.5 + 0.5;
    vec3 surf = mix(uColA, uColB, t);
    surf = mix(surf, uColC, smoothstep(0.62, 0.96, fbm(vPosL * 2.1 + 5.0)));   // storm highlights
    float ndl = dot(normalize(vWN), normalize(uLightDir));
    float lit = smoothstep(-0.3, 0.55, ndl);              // soft terminator
    gl_FragColor = vec4(surf * (0.04 + lit * 1.05), 1.0);
  }
`

// ── Planetary ring — concentric dust bands with a Cassini-style gap ─────────────
const RING_VERT = /* glsl */`
  varying vec2 vPos;
  void main() { vPos = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
`
const RING_FRAG = /* glsl */`
  precision highp float;
  varying vec2 vPos;
  uniform float uInner; uniform float uOuter;
  uniform vec3 uColA; uniform vec3 uColB;
  void main() {
    float r = length(vPos);
    float t = clamp((r - uInner) / (uOuter - uInner), 0.0, 1.0);
    float bands = 0.5 + 0.5 * sin(t * 70.0);
    float gap = smoothstep(0.40, 0.45, t) * (1.0 - smoothstep(0.52, 0.57, t));   // dark division
    float edge = smoothstep(0.0, 0.05, t) * (1.0 - smoothstep(0.92, 1.0, t));
    vec3 col = mix(uColA, uColB, bands);
    float alpha = edge * (0.45 + 0.4 * bands) * (1.0 - gap * 0.92);
    gl_FragColor = vec4(col, alpha * 0.9);
  }
`

// ── Battle parameters ──────────────────────────────────────────────────────────
const FLEET_SIZE  = 25
const SHIP_HP     = 6
const CAP_HP      = 60       // capital ship — tanky flagship
const CAP_SPEED   = 1.25     // capital ships lumber (very slow & ponderous)
const CAP_WEAPONS = 4        // bolts per capital volley
const BOLT_SPEED  = 46       // world units / second
const MISS_CHANCE = 0.28
const MAX_SPEED   = 7.5
const MIN_SPEED   = 2.6
const SEP_RADIUS  = 3.0
const BOUND_R     = 34       // ships steer back inside this radius
const STANDOFF    = 14       // preferred engagement range — keeps a frontline gap
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

// ── Background bodies ──────────────────────────────────────────────────────────
// Each builder adds its meshes to the scene and pushes geometry/materials to
// `disposables`; it returns an optional per-frame tick(t) for animated bodies.
function makeGasGiant(scene, disposables, pos, lightDir) {
  const R = 40
  const geo = new THREE.SphereGeometry(R, 64, 64)
  const mat = new THREE.ShaderMaterial({
    vertexShader: PLANET_VERT, fragmentShader: PLANET_FRAG,
    uniforms: {
      uLightDir: { value: lightDir },
      uColA: { value: new THREE.Color(0.17, 0.21, 0.29) },
      uColB: { value: new THREE.Color(0.09, 0.14, 0.19) },
      uColC: { value: new THREE.Color(0.42, 0.44, 0.48) },
    },
  })
  const body = new THREE.Mesh(geo, mat); body.position.copy(pos); scene.add(body)
  const aGeo = new THREE.SphereGeometry(R * 1.05, 48, 48)
  const aMat = new THREE.ShaderMaterial({
    vertexShader: RIM_VERT, fragmentShader: RIM_FRAG,
    uniforms: { uColor: { value: new THREE.Color(0x5fa0ff) }, uPower: { value: 3.4 } },
    transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.FrontSide,
  })
  const atmo = new THREE.Mesh(aGeo, aMat); atmo.position.copy(pos); scene.add(atmo)
  disposables.push(geo, mat, aGeo, aMat)
  return null
}

function makeRingedPlanet(scene, disposables, pos, lightDir) {
  const R = 26
  const geo = new THREE.SphereGeometry(R, 64, 64)
  const mat = new THREE.ShaderMaterial({
    vertexShader: PLANET_VERT, fragmentShader: PLANET_FRAG,
    uniforms: {
      uLightDir: { value: lightDir },
      uColA: { value: new THREE.Color(0.26, 0.20, 0.12) },   // sandy tan (dimmed)
      uColB: { value: new THREE.Color(0.16, 0.13, 0.075) },
      uColC: { value: new THREE.Color(0.39, 0.34, 0.225) },
    },
  })
  const body = new THREE.Mesh(geo, mat); body.position.copy(pos); scene.add(body)
  const rIn = R * 1.4, rOut = R * 2.4
  const rGeo = new THREE.RingGeometry(rIn, rOut, 120, 1)
  const rMat = new THREE.ShaderMaterial({
    vertexShader: RING_VERT, fragmentShader: RING_FRAG,
    uniforms: {
      uInner: { value: rIn }, uOuter: { value: rOut },
      uColA: { value: new THREE.Color(0.435, 0.375, 0.27) },
      uColB: { value: new THREE.Color(0.225, 0.19, 0.13) },
    },
    transparent: true, depthWrite: false, side: THREE.DoubleSide,
  })
  const ring = new THREE.Mesh(rGeo, rMat)
  ring.position.copy(pos)
  ring.rotation.set(-1.15, 0.4, 0)        // tilt for a 3/4 view
  scene.add(ring)
  disposables.push(geo, mat, rGeo, rMat)
  return null
}

function makeBlackHole(scene, disposables, pos) {
  const HR = 12
  const ehGeo = new THREE.SphereGeometry(HR, 48, 48)
  const ehMat = new THREE.MeshBasicMaterial({ color: 0x000000 })
  const eh = new THREE.Mesh(ehGeo, ehMat); eh.position.copy(pos); scene.add(eh)
  const rimGeo = new THREE.SphereGeometry(HR * 1.05, 48, 48)
  const rimMat = new THREE.ShaderMaterial({
    vertexShader: RIM_VERT, fragmentShader: RIM_FRAG,
    uniforms: { uColor: { value: new THREE.Color(0xacdcff) }, uPower: { value: 5.0 } },
    transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.FrontSide,
  })
  const rim = new THREE.Mesh(rimGeo, rimMat); rim.position.copy(pos); scene.add(rim)
  const dIn = HR * 1.9, dOut = HR * 4.4
  const dGeo = new THREE.RingGeometry(dIn, dOut, 180, 12)
  const dMat = new THREE.ShaderMaterial({
    vertexShader: DISK_VERT, fragmentShader: DISK_FRAG,
    uniforms: { uTime: { value: 0 }, uInner: { value: dIn }, uOuter: { value: dOut } },
    transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
  })
  const disk = new THREE.Mesh(dGeo, dMat)
  disk.position.copy(pos)
  disk.rotation.set(-Math.PI / 2 + 0.5, 0.3, 0)   // tilt for a 3/4 view
  scene.add(disk)
  disposables.push(ehGeo, ehMat, rimGeo, rimMat, dGeo, dMat)
  return (t) => { dMat.uniforms.uTime.value = t }
}

// Pick a random background body and place it at a random spot that is on-screen
// in the opening shot (by unprojecting a random point of the camera's view).
function makeBackdrop(scene, disposables, lightDir, camera) {
  const ndcX = Math.random() * 1.5 - 0.75    // -0.75 .. 0.75 (horizontal)
  const ndcY = Math.random() * 1.05 - 0.30   // -0.30 .. 0.75 (biased upward)
  const ray = new THREE.Vector3(ndcX, ndcY, 0.5).unproject(camera).sub(camera.position).normalize()
  const dist = 120 + Math.random() * 45
  const pos = camera.position.clone().addScaledVector(ray, dist)
  const pick = Math.floor(Math.random() * 3)
  if (pick === 0) return makeGasGiant(scene, disposables, pos, lightDir)
  if (pick === 1) return makeRingedPlanet(scene, disposables, pos, lightDir)
  return makeBlackHole(scene, disposables, pos)
}

// Optional sound assets. Drop matching files into public/sfx/ to override the
// synthesised sounds; any missing file simply falls back to the procedural synth.
// (Team/size-specific keys are preferred, with a generic fallback in brackets.)
const SOUND_FILES = {
  laser:        'sfx/laser.wav',          // generic laser (both teams)
  laserBlue:    'sfx/laser-blue.wav',     // optional per-team override → falls back to `laser`
  laserRed:     'sfx/laser-red.wav',
  explosion:    'sfx/explosion.wav',      // fighter / secondary blast
  explosionBig: 'sfx/explosion-big.wav',  // capital blast → falls back to `explosion`
  jump:         'sfx/jump.wav',           // hyperspace jump-in
  victory:      'sfx/victory.wav',        // engagement resolved
}

const CAP_NAME = { blue: 'HMSS Limitless Light', red: 'Rebel Capital Ship' }

// ── 2D ship sprites (top-down silhouettes) for the pre-battle order of battle —
// They echo the 3D hulls: blue = sleek delta interceptor / dagger flagship,
// red = forked marauder / blocky battlecruiser.
const SPRITE_PATHS = {
  blueFighter: 'M12 2 L15 13 L21 20 L12 17 L3 20 L9 13 Z',
  redFighter:  'M6 3 L12 11 L18 3 L16 9 L21 21 L12 17 L3 21 L8 9 Z',
  blueCapital: 'M12 2 L16 24 L15 52 L18 61 L12 57 L6 61 L9 52 L8 24 Z',
  redCapital:  'M14 3 L20 12 L20 20 L25 26 L25 34 L20 38 L20 56 L16 61 L12 61 L8 56 L8 38 L3 34 L3 26 L8 20 L8 12 Z',
}
function ShipSprite({ team, kind }) {
  const cap = kind === 'capital'
  const vb = cap ? (team === 'blue' ? '0 0 24 64' : '0 0 28 64') : '0 0 24 24'
  return (
    <svg className={`sb-sprite sb-sprite--${team}${cap ? ' sb-sprite--cap' : ''}`} viewBox={vb} aria-hidden="true">
      <path d={SPRITE_PATHS[team + (cap ? 'Capital' : 'Fighter')]} />
    </svg>
  )
}
function TeamRoster({ team }) {
  return (
    <div className={`sb-brief-team sb-brief-team--${team}`}>
      <div className="sb-brief-team-title">{team === 'blue' ? 'BLUE FLEET' : 'RED FLEET'}</div>
      <div className="sb-brief-cap">
        <ShipSprite team={team} kind="capital" />
        <div className="sb-brief-cap-info">
          <div className="sb-brief-cap-name">{CAP_NAME[team]}</div>
          <div className="sb-brief-cap-class">CAPITAL SHIP</div>
        </div>
      </div>
      <div className="sb-brief-fighters-label">FIGHTERS <span className="sb-brief-fighters-count">×{FLEET_SIZE}</span></div>
      <div className="sb-brief-fighters">
        {Array.from({ length: FLEET_SIZE }, (_, i) => <ShipSprite key={i} team={team} kind="fighter" />)}
      </div>
    </div>
  )
}

export default function SpaceBattleScreen({ onReturn, unreadCount = 0, onMailOpen }) {
  const mountRef     = useRef(null)
  const blueCountRef = useRef(null)
  const redCountRef  = useRef(null)
  const [winner, setWinner] = useState(null)   // null | 'BLUE' | 'RED' | 'DRAW'
  const [runId,  setRunId]  = useState(0)
  const [kills,  setKills]  = useState([])      // recent kill-feed entries
  const [stats,  setStats]  = useState(null)    // post-battle breakdown
  const [muted,  setMuted]  = useState(true)    // sound off by default
  const [started, setStarted] = useState(false) // pre-battle briefing until START
  const killSeq = useRef(0)
  const audioRef = useRef(null)
  const blueCapRef = useRef(null), blueShieldRef = useRef(null)
  const redCapRef  = useRef(null), redShieldRef  = useRef(null)

  // ── Player tactics (blue fleet only) ──────────────────────────────────────
  const [capTactic,     setCapTactic]     = useState('hold')   // 'hold' | 'engage'
  const [fighterTactic, setFighterTactic] = useState('all')    // 'all' | 'fighters' | 'capital'
  const capTacticRef     = useRef(capTactic)
  const fighterTacticRef = useRef(fighterTactic)
  useEffect(() => { capTacticRef.current = capTactic }, [capTactic])
  useEffect(() => { fighterTacticRef.current = fighterTactic }, [fighterTactic])

  // ── Procedural audio engine (synthesised — no asset files) ─────────────────
  useEffect(() => {
    let ctx
    try { ctx = new (window.AudioContext || window.webkitAudioContext)() } catch (_) { return }
    const TARGET_VOL = 0.42

    // master bus: soft-clip saturation + compressor for glue and punch
    const master = ctx.createGain(); master.gain.value = 0   // ramp up on resume
    const shaper = ctx.createWaveShaper()
    { const n = 1024, c = new Float32Array(n); for (let i = 0; i < n; i++) { const x = (i / (n - 1)) * 2 - 1; c[i] = Math.tanh(x * 1.5) } shaper.curve = c; shaper.oversample = '2x' }
    const comp = ctx.createDynamicsCompressor()
    comp.threshold.value = -16; comp.knee.value = 22; comp.ratio.value = 3.2; comp.attack.value = 0.003; comp.release.value = 0.25
    comp.connect(shaper); shaper.connect(master); master.connect(ctx.destination)

    // reverb send (synthetic impulse) for a sense of space
    const conv = ctx.createConvolver()
    { const len = Math.floor(ctx.sampleRate * 1.3), b = ctx.createBuffer(2, len, ctx.sampleRate)
      for (let ch = 0; ch < 2; ch++) { const d = b.getChannelData(ch); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.6) }
      conv.buffer = b }
    const wet = ctx.createGain(); wet.gain.value = 0.5; conv.connect(wet); wet.connect(comp)
    const dry = ctx.createGain(); dry.connect(comp)
    const sendTo = (node, amt) => { const s = ctx.createGain(); s.gain.value = amt; node.connect(s); s.connect(conv) }

    // saturation curve reused for explosion grit
    const satCurve = (() => { const n = 1024, c = new Float32Array(n); for (let i = 0; i < n; i++) { const x = (i / (n - 1)) * 2 - 1; c[i] = Math.tanh(x * 3) } return c })()

    // shared white-noise buffer
    const noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate)
    const nd = noiseBuf.getChannelData(0)
    for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1

    let mutedLocal = true, lastLaser = 0, lastBoom = 0   // sound off by default

    // sample buffers — loaded from public/sfx/ when present; missing files are
    // ignored so each sound keeps its synthesised fallback below.
    const buffers = {}
    Object.entries(SOUND_FILES).forEach(([key, file]) => {
      fetch(`${import.meta.env.BASE_URL}${file}`)
        .then(r => { const ct = r.headers.get('content-type') || ''; if (!r.ok || ct.includes('text/html')) throw 0; return r.arrayBuffer() })
        .then(ab => ctx.decodeAudioData(ab))
        .then(buf => { buffers[key] = buf })
        .catch(() => {})   // no file (or not audio) → keep the synth version
    })
    // play a loaded sample through the same bus (so reverb / compression / mute apply)
    const playSample = (buf, gain, rate, reverb) => {
      const src = ctx.createBufferSource(); src.buffer = buf
      src.playbackRate.value = rate || 1
      const g = ctx.createGain(); g.gain.value = gain == null ? 1 : gain
      src.connect(g); g.connect(dry)
      if (reverb) sendTo(g, reverb)
      src.start()
    }

    const playLaser = (team) => {
      if (mutedLocal) return
      const now = ctx.currentTime
      if (now - lastLaser < 0.05) return         // rate-limit the crackle
      lastLaser = now
      const lbuf = (team === 'blue' ? buffers.laserBlue : buffers.laserRed) || buffers.laser
      if (lbuf) { playSample(lbuf, 0.9, 0.95 + Math.random() * 0.1, 0.1); return }
      const out = ctx.createGain()
      out.gain.setValueAtTime(0.0001, now)
      out.gain.linearRampToValueAtTime(0.18, now + 0.005)
      out.gain.exponentialRampToValueAtTime(0.0001, now + 0.18)
      // warm tone body — resonant lowpass tames the harsh top end
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'
      lp.frequency.value = team === 'blue' ? 2400 : 1900; lp.Q.value = 7
      const f0 = (team === 'blue' ? 700 : 500) * (0.95 + Math.random() * 0.1)
      const o1 = ctx.createOscillator(); o1.type = 'triangle'
      o1.frequency.setValueAtTime(f0 * 2.0, now); o1.frequency.exponentialRampToValueAtTime(f0 * 0.55, now + 0.14)
      const o2 = ctx.createOscillator(); o2.type = 'sine'
      o2.frequency.setValueAtTime(f0, now); o2.frequency.exponentialRampToValueAtTime(f0 * 0.4, now + 0.16)
      o1.connect(lp); o2.connect(lp); lp.connect(out)
      o1.start(now); o2.start(now); o1.stop(now + 0.19); o2.stop(now + 0.19)
      // attack "crack" — short high-passed noise transient for punch
      const nb = ctx.createBufferSource(); nb.buffer = noiseBuf
      const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 1500
      const ng = ctx.createGain(); ng.gain.setValueAtTime(0.22, now); ng.gain.exponentialRampToValueAtTime(0.0001, now + 0.045)
      nb.connect(hp); hp.connect(ng); ng.connect(out); nb.start(now); nb.stop(now + 0.05)
      out.connect(dry); sendTo(out, 0.1)
    }

    const playExplosion = (big) => {
      if (mutedLocal) return
      const now = ctx.currentTime
      if (now - lastBoom < 0.05) return
      lastBoom = now
      const ebuf = (big && buffers.explosionBig) || buffers.explosion
      if (ebuf) { playSample(ebuf, big ? 1 : 0.8, big ? 1 : 1.05 + Math.random() * 0.1, big ? 0.6 : 0.4); return }
      const dur = big ? 1.1 : 0.6
      const out = ctx.createGain()
      // 1) sharp initial crack — high-passed noise transient
      const cb = ctx.createBufferSource(); cb.buffer = noiseBuf
      const chp = ctx.createBiquadFilter(); chp.type = 'highpass'; chp.frequency.value = 800
      const cg = ctx.createGain(); cg.gain.setValueAtTime(big ? 0.55 : 0.4, now); cg.gain.exponentialRampToValueAtTime(0.0001, now + 0.09)
      cb.connect(chp); chp.connect(cg); cg.connect(out); cb.start(now); cb.stop(now + 0.1)
      // 2) saturated body roar — noise → soft clip → downward lowpass sweep
      const bb = ctx.createBufferSource(); bb.buffer = noiseBuf; bb.loop = true
      const ws = ctx.createWaveShaper(); ws.curve = satCurve
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'
      lp.frequency.setValueAtTime(big ? 1700 : 1200, now); lp.frequency.exponentialRampToValueAtTime(big ? 110 : 190, now + dur)
      const bg = ctx.createGain(); bg.gain.setValueAtTime(big ? 0.55 : 0.38, now); bg.gain.exponentialRampToValueAtTime(0.0001, now + dur)
      bb.connect(ws); ws.connect(lp); lp.connect(bg); bg.connect(out); bb.start(now); bb.stop(now + dur + 0.05)
      // 3) sub-bass thump for chest punch
      const o = ctx.createOscillator(); o.type = 'sine'
      o.frequency.setValueAtTime(big ? 110 : 145, now); o.frequency.exponentialRampToValueAtTime(big ? 32 : 50, now + dur * 0.5)
      const og = ctx.createGain(); og.gain.setValueAtTime(big ? 0.95 : 0.6, now); og.gain.exponentialRampToValueAtTime(0.0001, now + dur * 0.7)
      o.connect(og); og.connect(out); o.start(now); o.stop(now + dur)
      out.connect(dry); sendTo(out, big ? 0.6 : 0.4)
    }

    const playJump = () => {
      if (mutedLocal) return
      const now = ctx.currentTime
      if (buffers.jump) { playSample(buffers.jump, 0.9, 1, 0.5); return }
      const src = ctx.createBufferSource(); src.buffer = noiseBuf
      const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 1.4
      bp.frequency.setValueAtTime(180, now)
      bp.frequency.exponentialRampToValueAtTime(2600, now + 0.6)
      const g = ctx.createGain()
      g.gain.setValueAtTime(0.0001, now)
      g.gain.linearRampToValueAtTime(0.26, now + 0.4)
      g.gain.exponentialRampToValueAtTime(0.0001, now + 1.0)
      src.connect(bp); bp.connect(g); g.connect(dry); sendTo(g, 0.5); src.start(now); src.stop(now + 1.1)
      const o = ctx.createOscillator(), og = ctx.createGain()
      o.type = 'sawtooth'
      o.frequency.setValueAtTime(70, now); o.frequency.exponentialRampToValueAtTime(520, now + 0.6)
      const olp = ctx.createBiquadFilter(); olp.type = 'lowpass'; olp.frequency.value = 1800
      og.gain.setValueAtTime(0.0001, now)
      og.gain.linearRampToValueAtTime(0.13, now + 0.4); og.gain.exponentialRampToValueAtTime(0.0001, now + 0.9)
      o.connect(olp); olp.connect(og); og.connect(dry); o.start(now); o.stop(now + 0.95)
    }

    const playVictory = (winner) => {
      if (mutedLocal) return
      const now = ctx.currentTime
      if (buffers.victory) { playSample(buffers.victory, 0.9, 1, 0.4); return }
      const freqs = winner === 'RED' ? [98, 196, 233.1, 294] : [130.8, 261.6, 329.6, 392]
      freqs.forEach((f, i) => {
        const o = ctx.createOscillator(), g = ctx.createGain(), lp = ctx.createBiquadFilter()
        o.type = i === 0 ? 'sine' : 'triangle'; o.frequency.value = f
        lp.type = 'lowpass'; lp.frequency.value = 2200
        const tt = now + i * 0.08
        g.gain.setValueAtTime(0.0001, tt)
        g.gain.linearRampToValueAtTime(i === 0 ? 0.2 : 0.13, tt + 0.05)
        g.gain.exponentialRampToValueAtTime(0.0001, tt + 1.5)
        o.connect(lp); lp.connect(g); g.connect(dry); sendTo(g, 0.4); o.start(tt); o.stop(tt + 1.6)
      })
    }

    // subtle ambient drone (two detuned low sines)
    const droneG = ctx.createGain(); droneG.gain.value = 0.03; droneG.connect(dry)
    const d1 = ctx.createOscillator(); d1.type = 'sine'; d1.frequency.value = 54;   d1.connect(droneG); d1.start()
    const d2 = ctx.createOscillator(); d2.type = 'sine'; d2.frequency.value = 54.5; d2.connect(droneG); d2.start()

    const applyVol = () => master.gain.setTargetAtTime(mutedLocal ? 0 : TARGET_VOL, ctx.currentTime, 0.06)
    const setMutedFn = (m) => { mutedLocal = m; applyVol() }
    const resume = () => { if (ctx.state === 'suspended') ctx.resume(); applyVol() }
    resume()
    window.addEventListener('pointerdown', resume)

    audioRef.current = { playLaser, playExplosion, playJump, playVictory, setMuted: setMutedFn }

    return () => {
      window.removeEventListener('pointerdown', resume)
      try { d1.stop(); d2.stop() } catch (_) {}
      audioRef.current = null
      ctx.close()
    }
  }, [])

  useEffect(() => { audioRef.current?.setMuted(muted) }, [muted])

  useEffect(() => {
    if (!started) return   // hold on the briefing until the player starts
    const mount = mountRef.current
    if (!mount) return
    let renderer, composer, raf
    const disposables = []
    setKills([])   // fresh kill feed each battle

    try {
      const w = mount.clientWidth || 1, h = mount.clientHeight || 1

      const scene = new THREE.Scene()
      const camera = new THREE.PerspectiveCamera(52, w / h, 0.1, 600)
      camera.position.set(0, 25, 60)   // ~30% further back

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
      scene.add(new THREE.AmbientLight(0x4a5a80, 0.75))
      const lightDir = new THREE.Vector3(0.12, 0.42, 0.9).normalize()
      const key = new THREE.DirectionalLight(0xcfe0ff, 0.8)
      key.position.copy(lightDir).multiplyScalar(40)
      scene.add(key)
      const rim = new THREE.DirectionalLight(0x4060a0, 0.35)   // cool back-fill
      rim.position.set(-20, -6, -30)
      scene.add(rim)

      // ── Nebula skydome ─────────────────────────────────────────────────────────
      const nebGeo = new THREE.SphereGeometry(330, 32, 32)
      const nebMat = new THREE.ShaderMaterial({
        vertexShader: NEBULA_VERT, fragmentShader: NEBULA_FRAG,
        uniforms: {
          uColA:    { value: new THREE.Color(0.030, 0.055, 0.140) },
          uColB:    { value: new THREE.Color(0.090, 0.035, 0.150) },
          uColWarm: { value: new THREE.Color(0.180, 0.070, 0.030) },
        },
        side: THREE.BackSide, depthWrite: false, depthTest: false,
      })
      const neb = new THREE.Mesh(nebGeo, nebMat)
      neb.renderOrder = -10
      scene.add(neb)
      disposables.push(nebGeo, nebMat)

      // ── Background body — random type, placed somewhere on-screen up front ──────
      camera.lookAt(0, 0, 0)            // orient the camera so the unproject is correct
      camera.updateMatrixWorld()
      const backdropTick = makeBackdrop(scene, disposables, lightDir, camera)

      // ── Starfield (cool dim field + a few bright stars) ─────────────────────────
      const starCount = 1500
      const starPos = new Float32Array(starCount * 3)
      const starCol = new Float32Array(starCount * 3)
      for (let i = 0; i < starCount; i++) {
        const rr = 120 + Math.random() * 180
        const th = Math.random() * Math.PI * 2
        const ph = Math.acos(2 * Math.random() - 1)
        starPos[i * 3]     = rr * Math.sin(ph) * Math.cos(th)
        starPos[i * 3 + 1] = rr * Math.sin(ph) * Math.sin(th)
        starPos[i * 3 + 2] = rr * Math.cos(ph)
        const roll = Math.random()
        let r, g, b
        if (roll > 0.95)      { r = 0.95; g = 0.97; b = 1.0 }                              // bright blue-white
        else if (roll > 0.92) { r = 1.0;  g = 0.85; b = 0.62 }                             // occasional warm star
        else { const v = 0.3 + Math.random() * 0.4; r = v * 0.72; g = v * 0.85; b = v }    // dim cool field
        starCol[i * 3] = r; starCol[i * 3 + 1] = g; starCol[i * 3 + 2] = b
      }
      const starGeo = new THREE.BufferGeometry()
      starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3))
      starGeo.setAttribute('color', new THREE.BufferAttribute(starCol, 3))
      const starMat = new THREE.PointsMaterial({ size: 0.75, sizeAttenuation: true, vertexColors: true, transparent: true, opacity: 0.9 })
      scene.add(new THREE.Points(starGeo, starMat))
      disposables.push(starGeo, starMat)

      // ── Shared geometry ──────────────────────────────────────────────────────
      const teamGeo = { blue: buildBlueModel(), red: buildRedModel() }
      const capGeo  = { blue: buildBlueCapital(), red: buildRedCapital() }
      const boltGeo = new THREE.CylinderGeometry(0.08, 0.08, 1.7, 6)
      const blastGeo = new THREE.SphereGeometry(1, 12, 12)
      const ringGeo = new THREE.RingGeometry(0.62, 1.0, 32)
      disposables.push(teamGeo.blue, teamGeo.red, capGeo.blue, capGeo.red, boltGeo, blastGeo, ringGeo)
      const boltMat = {
        blue: new THREE.MeshBasicMaterial({ color: TEAMS.blue.bolt, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }),
        red:  new THREE.MeshBasicMaterial({ color: TEAMS.red.bolt,  transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }),
      }
      const glowMat = {   // engine glow — bright additive, tucked at each ship's tail
        blue: new THREE.MeshBasicMaterial({ color: TEAMS.blue.bolt, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false }),
        red:  new THREE.MeshBasicMaterial({ color: TEAMS.red.bolt,  transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false }),
      }
      disposables.push(boltMat.blue, boltMat.red, glowMat.blue, glowMat.red)

      // reusable scratch objects (avoid per-frame allocation)
      const yAxis = new THREE.Vector3(0, 1, 0)
      const UP    = new THREE.Vector3(0, 1, 0)
      const ORIGIN = new THREE.Vector3(0, 0, 0)
      const _dir = new THREE.Vector3(), _tmp = new THREE.Vector3(), _acc = new THREE.Vector3()
      const _proj = new THREE.Vector3()
      const _m = new THREE.Matrix4(), _q = new THREE.Quaternion()
      let cw = w, ch = h   // canvas size, for projecting labels to screen px

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
          const mesh = new THREE.Group()
          mesh.add(new THREE.Mesh(teamGeo[team], mat))
          const glow = new THREE.Mesh(blastGeo, glowMat[team])  // engine glow at the tail
          glow.scale.setScalar(0.3)
          glow.position.set(0, 0, -0.95)
          mesh.add(glow)
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
            name: team === 'blue' ? 'Blue Interceptor' : 'Red Marauder',
            fireCd: 0.5 + Math.random() * 2.5, flash: 0,
            isCapital: false, kills: 0, weapons: 1, maxSpeed: MAX_SPEED, minSpeed: MIN_SPEED, radius: 0, turn: TURN_RATE,
            standoff: STANDOFF, bound: BOUND_R,
          })
        }
      }
      spawnFleet('blue', -31, 1)    // blue charges from the left (+X)
      spawnFleet('red',   31, -1)   // red charges from the right (-X)

      // ── Capital ships — huge flagships that fly a fixed circular patrol ───────
      // The orbit (radius, height, direction) is rolled once at the start of the
      // battle; the two flagships ride it 180° apart, sweeping the rear of the
      // field on a smooth, predictable route instead of steering randomly.
      const orbitR = 38 + Math.random() * 5   // capital patrol scaled out with the arena
      const orbit = {
        R: orbitR,
        y: (Math.random() - 0.5) * 6,
        omega: (CAP_SPEED / orbitR) * (Math.random() < 0.5 ? 1 : -1),
      }
      const spawnCapital = (team, startAngle) => {
        const mat = new THREE.MeshStandardMaterial({
          color: TEAMS[team].color, emissive: TEAMS[team].color,
          emissiveIntensity: 0.55, metalness: 0.65, roughness: 0.35,
        })
        disposables.push(mat)
        const mesh = new THREE.Group()
        mesh.add(new THREE.Mesh(capGeo[team], mat))
        const glows = []
        for (const ex of [-0.45, 0.45]) {          // twin engine glows
          const glow = new THREE.Mesh(blastGeo, glowMat[team])
          glow.scale.setScalar(0.7)
          glow.position.set(ex, 0, -3.1)
          mesh.add(glow); glows.push(glow)
        }
        // damage-state hull fires — revealed progressively as the ship is worn down
        const fires = []
        for (let i = 0; i < 6; i++) {
          const fMat = new THREE.MeshBasicMaterial({ color: 0xff7a30, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false })
          const fm = new THREE.Mesh(blastGeo, fMat)
          fm.scale.setScalar(0.16)
          fm.position.set((Math.random() - 0.5) * 1.4, (Math.random() - 0.5) * 0.9, (Math.random() - 0.5) * 5)
          fm.visible = false
          mesh.add(fm)
          fires.push({ mesh: fm, mat: fMat })
          disposables.push(fMat)
        }
        mesh.scale.setScalar(3.2)                   // huge flagship
        const route = { R: orbit.R, y: orbit.y, omega: orbit.omega, angle: startAngle }
        const pos = new THREE.Vector3(Math.cos(startAngle) * route.R, route.y, Math.sin(startAngle) * route.R)
        const sgn = route.omega >= 0 ? 1 : -1
        const vel = new THREE.Vector3(-Math.sin(startAngle) * sgn, 0, Math.cos(startAngle) * sgn)
        mesh.position.copy(pos)
        orient(mesh, vel)
        scene.add(mesh)
        ships.push({
          mesh, mat, team, hp: CAP_HP, alive: true, pos, vel,
          name: CAP_NAME[team],
          labelEl:  team === 'blue' ? blueCapRef.current   : redCapRef.current,
          shieldEl: team === 'blue' ? blueShieldRef.current : redShieldRef.current,
          fireCd: 0.5 + Math.random(), flash: 0,
          isCapital: true, kills: 0, weapons: CAP_WEAPONS, radius: 16, route, glows, fires, emitCd: 0,
        })
      }
      spawnCapital('blue', Math.PI)   // start on the left
      spawnCapital('red', 0)          // start opposite, on the right
      const redCapital = ships.find(s => s.isCapital && s.team === 'red')

      // ── Hyperspace jump-in: stage every ship far out along its flank, then
      // streak it into its formation slot before combat begins ──────────────────
      const STREAK_DUR = 0.85, CAP_LEAD = 0.6, FIGHTER_STAGGER = 0.5
      const INTRO_TOTAL = CAP_LEAD + FIGHTER_STAGGER + STREAK_DUR + 0.1
      const jumpAxis = {
        blue: new THREE.Vector3(-1, 0.05, -0.3).normalize(),
        red:  new THREE.Vector3( 1, 0.05, -0.3).normalize(),
      }
      for (const s of ships) {
        s.home = s.pos.clone()
        s.baseScale = s.isCapital ? 3.2 : 1
        // capitals jump in first; the fighters follow them in
        s.jumpDelay = s.isCapital ? Math.random() * 0.15 : CAP_LEAD + Math.random() * FIGHTER_STAGGER
        if (s.route) {
          // capitals warp in *along* their patrol tangent, so they arrive already
          // pointed the right way and slide straight onto the route — no post-warp turn
          const sgn = s.route.omega >= 0 ? 1 : -1
          _dir.set(-Math.sin(s.route.angle) * sgn, 0, Math.cos(s.route.angle) * sgn)
          s.jumpFrom = s.home.clone().addScaledVector(_dir, -95)
        } else {
          s.jumpFrom = s.home.clone().addScaledVector(jumpAxis[s.team], 95)
        }
        s.pos.copy(s.jumpFrom)
        s.mesh.position.copy(s.pos)
      }
      let introT = 0
      audioRef.current?.playJump()

      // ── Bolts, explosions, embers, capital wrecks ─────────────────────────────
      const bolts = []
      const blasts = []
      const embers = []
      const wrecks = []
      const DEATH_DUR = 1.8
      const _e = new THREE.Vector3()
      // a random world point within an oriented box around a capital's hull
      const hullPoint = (sh) => _e.set((Math.random() - 0.5) * 7, (Math.random() - 0.5) * 5, (Math.random() - 0.5) * 18)
        .applyQuaternion(sh.mesh.quaternion).add(sh.pos)
      const spawnEmber = (pos, color) => {
        const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false })
        const m = new THREE.Mesh(blastGeo, mat)
        m.position.copy(pos)
        m.scale.setScalar(0.3 + Math.random() * 0.4)
        scene.add(m)
        embers.push({ mesh: m, mat, vel: new THREE.Vector3((Math.random() - 0.5) * 2.5, (Math.random() - 0.5) * 2.5 + 0.4, (Math.random() - 0.5) * 2.5), life: 0, max: 0.6 + Math.random() * 0.5 })
      }

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
        bolts.push({ mesh, dir, target, willHit, life: 0, shooter })
        audioRef.current?.playLaser(shooter.team)
      }

      const spawnBlast = (pos, big = false) => {
        const s = big ? 1.7 : 1.0
        const fmat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 1, blending: THREE.AdditiveBlending, depthWrite: false })
        const fire = new THREE.Mesh(blastGeo, fmat)
        fire.position.copy(pos); fire.scale.setScalar(0.3 * s)
        scene.add(fire)
        const rmat = new THREE.MeshBasicMaterial({ color: 0xffd9a0, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })
        const ring = new THREE.Mesh(ringGeo, rmat)
        ring.position.copy(pos); ring.scale.setScalar(0.5 * s)
        scene.add(ring)
        blasts.push({ fire, fmat, ring, rmat, life: 0, max: 0.6, s })
        audioRef.current?.playExplosion(big)
      }

      const addKill = (killer, victim) => {
        killer.kills = (killer.kills || 0) + 1
        setKills(prev => [...prev, {
          id: killSeq.current++,
          kName: killer.name, kTeam: killer.team,
          vName: victim.name, vTeam: victim.team,
        }].slice(-7))
      }

      const damage = (ship, killer) => {
        ship.hp -= 1
        ship.flash = 0.12
        if (ship.hp <= 0 && ship.alive) {
          ship.alive = false
          if (killer) addKill(killer, ship)
          if (ship.isCapital) {
            // begin the drawn-out death; the hull stays as drifting wreckage
            ship.driftVel = _tmp.set(0, 0, 1).applyQuaternion(ship.mesh.quaternion).multiplyScalar(0.9).clone()
            wrecks.push({ ship, t: 0, blastCd: 0, final: false })
          } else {
            spawnBlast(ship.pos, false)
            scene.remove(ship.mesh)
          }
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
        introT += dt
        const intro = introT < INTRO_TOTAL

        // ── Ships: steer (seek nearest enemy + separation + bounds), then fire ──
        for (const s of ships) {
          if (!s.alive) continue

          // hyperspace jump-in: streak from the staging point into formation
          if (intro) {
            const p = Math.min(1, Math.max(0, (introT - s.jumpDelay) / STREAK_DUR))
            const e = 1 - Math.pow(1 - p, 3)                       // ease-out into place
            s.pos.lerpVectors(s.jumpFrom, s.home, e)
            s.mesh.position.copy(s.pos)
            orient(s.mesh, _dir.subVectors(s.home, s.jumpFrom))    // face travel direction
            const stretch = 1 + Math.pow(1 - p, 3) * (s.isCapital ? 4 : 14)
            s.mesh.scale.set(s.baseScale, s.baseScale, s.baseScale * stretch)
            continue
          }
          if (s.mesh.scale.z !== s.baseScale) s.mesh.scale.set(s.baseScale, s.baseScale, s.baseScale)

          // find nearest living enemy (and nearest enemy fighter)
          let nearest = null, nd = Infinity, nearestFighter = null, nfd = Infinity
          for (const e of ships) {
            if (!e.alive || e.team === s.team) continue
            const d = s.pos.distanceToSquared(e.pos)
            if (d < nd) { nd = d; nearest = e }
            if (!e.isCapital && d < nfd) { nfd = d; nearestFighter = e }
          }
          // blue fighters obey the player's targeting tactic; everyone else hits nearest
          let target = nearest
          if (s.team === 'blue' && !s.isCapital) {
            const tac = fighterTacticRef.current
            if (tac === 'capital') target = (redCapital && redCapital.alive) ? redCapital : nearest
            else if (tac === 'fighters') target = nearestFighter || nearest
          }

          if (s.route) {
            // capitals cruise toward their patrol-slot on the circle (smooth,
            // predictable). The blue flagship can be ordered to leave the patrol
            // and push to the centre, then later make its way back to the route.
            const rt = s.route
            rt.angle += rt.omega * dt
            let tx = Math.cos(rt.angle) * rt.R, ty = rt.y, tz = Math.sin(rt.angle) * rt.R
            if (s.team === 'blue' && capTacticRef.current === 'engage') { tx = 0; ty = 0; tz = 0 }
            const dx = tx - s.pos.x, dy = ty - s.pos.y, dz = tz - s.pos.z
            const dist = Math.hypot(dx, dy, dz)
            const step = CAP_SPEED * dt
            if (dist > 1e-4) {
              const f = Math.min(step, dist) / dist
              s.pos.x += dx * f; s.pos.y += dy * f; s.pos.z += dz * f
              orient(s.mesh, _dir.set(dx, dy, dz), 1 - Math.exp(-1.5 * dt))
            }
            s.mesh.position.copy(s.pos)
          } else {
            _acc.set(0, 0, 0)
            if (target) {
              // approach the enemy only down to STANDOFF, then ease off / back away —
              // this holds a gap between the two fleets rather than one merged blob
              _tmp.subVectors(target.pos, s.pos)
              const dist = _tmp.length() || 1
              _tmp.divideScalar(dist)
              const drive = THREE.MathUtils.clamp((dist - s.standoff) * 0.8, -5, 9)
              _acc.addScaledVector(_tmp, drive)
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
            if (r > s.bound) _acc.addScaledVector(_tmp.copy(s.pos).normalize(), -(r - s.bound) * 2.2)

            s.vel.addScaledVector(_acc, dt)
            let sp = s.vel.length()
            if (sp > s.maxSpeed) s.vel.multiplyScalar(s.maxSpeed / sp)
            else if (sp < s.minSpeed && sp > 0) s.vel.multiplyScalar(s.minSpeed / sp)
            s.pos.addScaledVector(s.vel, dt)
            s.mesh.position.copy(s.pos)
            orient(s.mesh, _dir.copy(s.vel), 1 - Math.exp(-s.turn * dt))
          }

          if (s.flash > 0) {
            s.flash -= dt
            s.mat.emissiveIntensity = s.flash > 0 ? 1.7 : (s.isCapital ? 0.55 : 0.5)
          }
          // capital damage states: reveal hull fires and spit embers as HP falls
          if (s.isCapital) {
            const dmg = 1 - s.hp / CAP_HP
            const nf = Math.floor(dmg * s.fires.length)
            for (let i = 0; i < s.fires.length; i++) {
              const f = s.fires[i]
              f.mesh.visible = i < nf
              if (i < nf) f.mat.opacity = 0.4 + 0.5 * Math.abs(Math.sin(t * 7 + i * 1.7))
            }
            if (dmg > 0.15) {
              s.emitCd -= dt
              if (s.emitCd <= 0) {
                spawnEmber(hullPoint(s), dmg > 0.6 ? 0xff5424 : 0xffa848)
                s.emitCd = 0.3 - dmg * 0.22
              }
            }
          }
          if (!gameOver) {
            s.fireCd -= dt
            if (s.fireCd <= 0) {
              if (s.weapons > 1) {
                // capital: rapid multi-bolt broadside spread across the enemy fleet
                const enemies = ships.filter(e => e.alive && e.team !== s.team)
                if (enemies.length) for (let k = 0; k < s.weapons; k++) fireBolt(s, enemies[(Math.random() * enemies.length) | 0], true)
                s.fireCd = 0.7 + Math.random() * 0.9
              } else if (target) {
                fireBolt(s, target)
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
            if (d < 1.3) { damage(b.target, b.shooter); done = true }
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

        // ── Explosions: fireball (white→orange→red) + expanding shockwave ring ──
        for (let i = blasts.length - 1; i >= 0; i--) {
          const x = blasts[i]
          x.life += dt
          const k = x.life / x.max
          // fireball
          x.fire.scale.setScalar((0.3 + k * 3.4) * x.s)
          x.fmat.color.setRGB(1.0, 0.85 - k * 0.55, 0.5 - k * 0.45)
          x.fmat.opacity = Math.max(0, 1 - k)
          // shockwave ring — expands faster, fades sooner, billboarded to camera
          const rk = Math.min(1, k * 1.4)
          x.ring.scale.setScalar((0.5 + rk * 6.0) * x.s)
          x.ring.lookAt(camera.position)
          x.rmat.opacity = Math.max(0, 0.85 * (1 - rk))
          if (x.life >= x.max) {
            scene.remove(x.fire); scene.remove(x.ring)
            x.fmat.dispose(); x.rmat.dispose()
            blasts.splice(i, 1)
          }
        }

        // ── Dying / wrecked capitals ────────────────────────────────────────────
        for (const wk of wrecks) {
          const sh = wk.ship
          wk.t += dt
          sh.pos.addScaledVector(sh.driftVel, dt)
          sh.mesh.position.copy(sh.pos)
          sh.mesh.rotateZ(0.06 * dt); sh.mesh.rotateX(0.025 * dt)   // slow tumble
          if (wk.t < DEATH_DUR) {
            // secondary explosions ripple along the hull, hull flickers violently
            wk.blastCd -= dt
            if (wk.blastCd <= 0) { spawnBlast(hullPoint(sh), false); wk.blastCd = 0.1 + Math.random() * 0.2 }
            sh.mat.emissiveIntensity = 0.6 + Math.random() * 1.2
            for (const f of sh.fires) if (f.mesh.visible) f.mat.opacity = 0.5 + 0.5 * Math.random()
          } else if (!wk.final) {
            // final blast, then settle into a darkened drifting hulk
            wk.final = true
            spawnBlast(sh.pos, true)
            sh.mat.color.setHex(0x2b2e34); sh.mat.emissive.setHex(0x160b06)
            sh.mat.emissiveIntensity = 0.25; sh.mat.metalness = 0.3; sh.mat.roughness = 0.95
            sh.glows.forEach(g => (g.visible = false))
            sh.fires.forEach((f, i) => { f.mesh.visible = i < 2 })
          } else {
            // persistent wreckage: a couple of smouldering fires + the odd ember
            for (const f of sh.fires) if (f.mesh.visible) f.mat.opacity = 0.2 + 0.2 * Math.abs(Math.sin(t * 4 + sh.pos.x))
            if (Math.random() < 0.04) spawnEmber(hullPoint(sh), 0xff6a30)
          }
        }

        // ── Embers: damage sparks / wreck smoulder ──────────────────────────────
        for (let i = embers.length - 1; i >= 0; i--) {
          const em = embers[i]
          em.life += dt
          em.mesh.position.addScaledVector(em.vel, dt)
          em.mesh.scale.multiplyScalar(0.986)
          em.mat.opacity = Math.max(0, 0.9 * (1 - em.life / em.max))
          if (em.life >= em.max) { scene.remove(em.mesh); em.mat.dispose(); embers.splice(i, 1) }
        }

        // ── Capital ship labels (name + shield %), projected above each hull ────
        for (const s of ships) {
          if (!s.labelEl) continue
          if (!s.alive || intro) { s.labelEl.style.opacity = '0'; continue }
          _proj.copy(s.pos); _proj.y += 7
          _proj.project(camera)
          if (_proj.z > 1) { s.labelEl.style.opacity = '0'; continue }
          const lx = (_proj.x * 0.5 + 0.5) * cw
          const ly = (-_proj.y * 0.5 + 0.5) * ch
          s.labelEl.style.opacity = '1'
          s.labelEl.style.transform = `translate(-50%, -100%) translate(${lx}px, ${ly}px)`
          if (s.shieldEl) s.shieldEl.textContent = Math.max(0, Math.round(s.hp / CAP_HP * 100))
        }

        // ── Scoreboard + victory check ─────────────────────────────────────────
        const c = counts()
        if (blueCountRef.current) blueCountRef.current.textContent = c.blue
        if (redCountRef.current)  redCountRef.current.textContent  = c.red
        if (!gameOver && (c.blue === 0 || c.red === 0)) {
          gameOver = true
          setWinner(c.blue > 0 ? 'BLUE' : c.red > 0 ? 'RED' : 'DRAW')
          audioRef.current?.playVictory(c.blue > 0 ? 'BLUE' : 'RED')
          const sumKills = team => ships.filter(s => s.team === team).reduce((a, s) => a + (s.kills || 0), 0)
          const cap = team => { const k = ships.find(s => s.isCapital && s.team === team); return { name: k.name, kills: k.kills || 0, alive: k.alive } }
          setStats({
            blueKills: sumKills('blue'), redKills: sumKills('red'),
            blueLeft: c.blue, redLeft: c.red,
            blueCap: cap('blue'), redCap: cap('red'),
          })
        }

        if (backdropTick) backdropTick(clock.elapsedTime)
        controls.update()
        composer.render()
        raf = requestAnimationFrame(frame)
      }

      // ── Bloom ────────────────────────────────────────────────────────────────
      composer = new EffectComposer(renderer)
      composer.addPass(new RenderPass(scene, camera))
      composer.addPass(new UnrealBloomPass(new THREE.Vector2(w, h), 0.9, 0.6, 0.2))

      frame()

      const onResize = () => {
        const nw = mount.clientWidth, nh = mount.clientHeight
        if (!nw || !nh) return
        cw = nw; ch = nh
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
        blasts.forEach(x => { x.fmat.dispose(); x.rmat.dispose() })
        embers.forEach(e => e.mat.dispose())
        composer.dispose && composer.dispose()
        renderer.dispose()
        if (renderer.domElement.parentNode) renderer.domElement.parentNode.removeChild(renderer.domElement)
      }
    } catch (err) {
      console.error('Space battle failed to initialise:', err)
      if (renderer) { try { renderer.dispose() } catch (_) {} }
    }
  }, [runId, started])

  const startBattle = () => { setWinner(null); setKills([]); setStats(null); setStarted(true); setRunId(k => k + 1) }

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

        {!started && (
          <div className="sb-briefing">
            <div className="sb-brief-head">
              <div className="sb-brief-sub">FLEET ENGAGEMENT // ORDER OF BATTLE</div>
              <button className="sb-brief-start" onClick={startBattle}>▶ START BATTLE</button>
            </div>
            <div className="sb-brief-teams">
              <TeamRoster team="blue" />
              <TeamRoster team="red" />
            </div>
          </div>
        )}

        <div className="sb-cap-label sb-cap-label--blue" ref={blueCapRef}>
          <div className="sb-cap-name">{CAP_NAME.blue}</div>
          <div className="sb-cap-shield">SHIELD <span ref={blueShieldRef}>100</span>%</div>
        </div>
        <div className="sb-cap-label sb-cap-label--red" ref={redCapRef}>
          <div className="sb-cap-name">{CAP_NAME.red}</div>
          <div className="sb-cap-shield">SHIELD <span ref={redShieldRef}>100</span>%</div>
        </div>

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

            {stats && (
              <div className="sb-stats">
                <div className="sb-stats-grid">
                  <span className="sb-stat-val sb-stat--blue">{stats.blueKills}</span>
                  <span className="sb-stat-mid">TOTAL KILLS</span>
                  <span className="sb-stat-val sb-stat--red">{stats.redKills}</span>
                  <span className="sb-stat-val sb-stat--blue">{stats.blueLeft}</span>
                  <span className="sb-stat-mid">SHIPS REMAINING</span>
                  <span className="sb-stat-val sb-stat--red">{stats.redLeft}</span>
                </div>
                <div className="sb-stat-caps">
                  <div className="sb-stat-cap">
                    <span className="sb-stat--blue">{stats.blueCap.name}</span>
                    <span className="sb-stat-cap-meta">{stats.blueCap.kills} KILLS · {stats.blueCap.alive ? 'SURVIVED' : 'DESTROYED'}</span>
                  </div>
                  <div className="sb-stat-cap">
                    <span className="sb-stat--red">{stats.redCap.name}</span>
                    <span className="sb-stat-cap-meta">{stats.redCap.kills} KILLS · {stats.redCap.alive ? 'SURVIVED' : 'DESTROYED'}</span>
                  </div>
                </div>
              </div>
            )}

            <button className="sb-restart" onClick={() => { setWinner(null); setKills([]); setStats(null); setStarted(false) }}>
              ⟳ NEW ENGAGEMENT
            </button>
          </div>
        )}

        <div className="sb-killfeed">
          {kills.map(k => (
            <div key={k.id} className="sb-kill">
              <span className={`sb-kill-name sb-kill-name--${k.kTeam}`}>{k.kName}</span>
              <span className="sb-kill-verb"> destroyed </span>
              <span className={`sb-kill-name sb-kill-name--${k.vTeam}`}>{k.vName}</span>
            </div>
          ))}
        </div>

        <div className="sb-tactics">
          <div className="sb-tac-title">⬢ TACTICAL COMMAND // BLUE FLEET</div>
          <div className="sb-tac-group">
            <div className="sb-tac-label">CAPITAL SHIP</div>
            <div className="sb-tac-btns">
              <button className={`sb-tac-btn${capTactic === 'hold' ? ' sb-tac-btn--on' : ''}`} onClick={() => setCapTactic('hold')}>HOLD BACK</button>
              <button className={`sb-tac-btn${capTactic === 'engage' ? ' sb-tac-btn--on' : ''}`} onClick={() => setCapTactic('engage')}>DIRECTLY ENGAGE</button>
            </div>
          </div>
          <div className="sb-tac-group">
            <div className="sb-tac-label">FIGHTERS</div>
            <div className="sb-tac-btns">
              <button className={`sb-tac-btn${fighterTactic === 'all' ? ' sb-tac-btn--on' : ''}`} onClick={() => setFighterTactic('all')}>ATTACK ALL</button>
              <button className={`sb-tac-btn${fighterTactic === 'fighters' ? ' sb-tac-btn--on' : ''}`} onClick={() => setFighterTactic('fighters')}>ENEMY FIGHTERS</button>
              <button className={`sb-tac-btn${fighterTactic === 'capital' ? ' sb-tac-btn--on' : ''}`} onClick={() => setFighterTactic('capital')}>ENEMY CAPITAL SHIP</button>
            </div>
          </div>
        </div>

        <button className={`sb-sound${muted ? ' sb-sound--off' : ''}`} onClick={() => setMuted(m => !m)}>
          {muted ? '♪ SOUND OFF' : '♪ SOUND ON'}
        </button>

        <div className="sb-hint">DRAG TO ORBIT // SCROLL TO ZOOM</div>
      </div>

      <HudFooter>
        <span>HMSS / TAC-SIM / FLEET ENGAGEMENT MODEL</span>
        <span className="sep">│</span>
        <span>DOCTRINE: <em className="ok">ATTRITION</em></span>
        <span className="sep">│</span>
        <span>SIM STATE: <em className={winner || !started ? 'warn' : 'ok'}>{winner ? 'RESOLVED' : started ? 'LIVE' : 'STANDBY'}</em></span>
      </HudFooter>
    </div>
  )
}
