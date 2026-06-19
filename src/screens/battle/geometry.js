import * as THREE from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import { RIM_VERT, RIM_FRAG, DISK_VERT, DISK_FRAG } from '../../lib/shaders'

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

// ── Capital energy shield ──────────────────────────────────────────────────────
// A fresnel bubble that hugs the flagship silhouette. Invisible at rest
// (uIntensity 0); pulsed bright for a moment when armour deflects an incoming
// bolt, so the deflection reads as the shield catching the shot.
const SHIELD_FRAG = /* glsl */`
  precision highp float;
  uniform vec3 uColor;
  uniform float uPower;
  uniform float uIntensity;
  varying vec3 vN;
  varying vec3 vView;
  void main() {
    float f = pow(1.0 - max(dot(vN, vView), 0.0), uPower);   // bright toward the grazing silhouette
    float fill = f * 0.85 + 0.10;                            // rim glow + faint full-bubble fill
    gl_FragColor = vec4(uColor * fill, fill) * uIntensity;   // uIntensity 0 → fully invisible
  }
`
function makeShield(color) {
  const geo = new THREE.SphereGeometry(1, 32, 24)
  const mat = new THREE.ShaderMaterial({
    vertexShader: RIM_VERT, fragmentShader: SHIELD_FRAG,
    uniforms: {
      uColor:     { value: new THREE.Color(color) },
      uPower:     { value: 2.4 },
      uIntensity: { value: 0 },
    },
    transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.FrontSide,
  })
  const mesh = new THREE.Mesh(geo, mat)
  mesh.renderOrder = 3
  mesh.raycast = () => {}   // never intercept ship-selection clicks
  return { mesh, geo, mat }
}

// Bombers — heavier than fighters, same team aesthetic. Blue: broad sleek delta
// with a bomb bay + twin pods.  Red: bulky forked hull with a ventral bomb pod.
function buildBlueBomber() {
  const parts = []
  let g = new THREE.ConeGeometry(0.32, 1.0, 6); g.rotateX(Math.PI / 2); g.translate(0, 0, 0.7); parts.push(g)  // nose
  g = new THREE.BoxGeometry(0.54, 0.36, 1.6); g.translate(0, 0, -0.1); parts.push(g)        // fuller fuselage / bomb bay
  g = new THREE.BoxGeometry(2.2, 0.07, 0.95); g.translate(0, 0, -0.25); parts.push(g)       // broad delta wing
  g = new THREE.BoxGeometry(0.05, 0.42, 0.5); g.translate(0, 0.27, -0.7); parts.push(g)     // tail fin
  g = new THREE.BoxGeometry(0.24, 0.24, 0.85); g.translate(0.66, -0.04, -0.7); parts.push(g)  // engine pod R
  g = new THREE.BoxGeometry(0.24, 0.24, 0.85); g.translate(-0.66, -0.04, -0.7); parts.push(g) // engine pod L
  return mergeGeometries(parts, false)
}
function buildRedBomber() {
  const parts = []
  let g = new THREE.BoxGeometry(1.2, 0.64, 2.1); parts.push(g)                                // heavy slab hull
  g = new THREE.BoxGeometry(0.2, 0.2, 1.3); g.translate(0.5, 0, 1.25);  parts.push(g)         // forked ram prong R
  g = new THREE.BoxGeometry(0.2, 0.2, 1.3); g.translate(-0.5, 0, 1.25); parts.push(g)         // forked ram prong L
  g = new THREE.BoxGeometry(0.52, 0.54, 1.7); g.translate(0.92, -0.04, -0.1);  parts.push(g)  // outboard ordnance sponson R
  g = new THREE.BoxGeometry(0.52, 0.54, 1.7); g.translate(-0.92, -0.04, -0.1); parts.push(g)  // outboard ordnance sponson L
  for (const sx of [0.92, -0.92]) for (const sz of [0.42, -0.12, -0.66]) {                    // slung bomb racks under each sponson
    g = new THREE.BoxGeometry(0.16, 0.2, 0.32); g.translate(sx, -0.44, sz); parts.push(g)
  }
  g = new THREE.BoxGeometry(0.5, 0.52, 0.85); g.translate(0, 0.5, -0.15); parts.push(g)       // command tower
  g = new THREE.BoxGeometry(0.84, 0.54, 1.4); g.translate(0, -0.46, 0.1); parts.push(g)       // deep ventral bomb bay
  g = new THREE.BoxGeometry(0.5, 0.5, 0.95); g.translate(0.5, 0, -1.45);  parts.push(g)       // engine block R
  g = new THREE.BoxGeometry(0.5, 0.5, 0.95); g.translate(-0.5, 0, -1.45); parts.push(g)       // engine block L
  return mergeGeometries(parts, false)
}

// Missile cruisers — boxy, rectangular missile platforms (no wings or pods).
// Blue: slim brick with a dorsal missile deck.  Red: heavier slab with flush
// side missile banks. Built entirely from boxes for a blunt, angular silhouette.
function buildBlueCruiser() {
  const parts = []
  let g = new THREE.BoxGeometry(0.8, 0.6, 3.0); parts.push(g)                                  // main rectangular hull
  g = new THREE.BoxGeometry(0.72, 0.5, 0.6); g.translate(0, 0, 1.75); parts.push(g)            // blunt prow block
  g = new THREE.BoxGeometry(0.44, 0.3, 0.9); g.translate(0, 0.44, -0.4); parts.push(g)         // low bridge box
  g = new THREE.BoxGeometry(0.78, 0.16, 1.6); g.translate(0, 0.36, 0.45); parts.push(g)        // dorsal missile deck
  for (const sx of [0.22, -0.22]) {                                                            // recessed missile tubes (flush, no wings)
    g = new THREE.BoxGeometry(0.16, 0.16, 1.4); g.translate(sx, 0.5, 0.55); parts.push(g)
  }
  g = new THREE.BoxGeometry(0.66, 0.5, 0.5); g.translate(0, 0, -1.75); parts.push(g)           // engine block
  return mergeGeometries(parts, false)
}
function buildRedCruiser() {
  const parts = []
  let g = new THREE.BoxGeometry(1.2, 0.82, 3.0); parts.push(g)                                 // heavy slab hull
  g = new THREE.BoxGeometry(1.1, 0.7, 0.6); g.translate(0, 0, 1.75); parts.push(g)             // blunt ram prow
  for (const sx of [0.78, -0.78]) {                                                            // flush rectangular side missile banks
    g = new THREE.BoxGeometry(0.36, 0.66, 2.4); g.translate(sx, 0, -0.1); parts.push(g)
    for (const sz of [0.7, 0.0, -0.7]) {                                                        // tube mouths
      g = new THREE.BoxGeometry(0.18, 0.18, 0.5); g.translate(sx, 0.12, sz); parts.push(g)
    }
  }
  g = new THREE.BoxGeometry(0.56, 0.42, 0.9); g.translate(0, 0.6, -0.1); parts.push(g)          // command box
  g = new THREE.BoxGeometry(1.0, 0.6, 0.6); g.translate(0, 0, -1.75); parts.push(g)             // engine block
  return mergeGeometries(parts, false)
}

// ── Cutscene prop: the Aleph ─────────────────────────────────────────────────
// A neutral, faction-less artefact in the spirit of the 2001 monolith — an
// ornate golden arched tablet with a glowing halo emblem.
// Unlike the ship builders (which return one geometry for the caller to skin),
// this returns a self-contained THREE.Group with its own gold + emissive
// materials. The near-white core reads as a glow under a bloom pass. Recentre at
// the call site via Box3, and dispose by traversing the group.
function buildAleph() {
  const group = new THREE.Group()

  const gold       = new THREE.MeshStandardMaterial({ color: 0xc4901a, emissive: 0x3a2400, emissiveIntensity: 0.6, metalness: 1.0, roughness: 0.3 })
  const goldBright = new THREE.MeshStandardMaterial({ color: 0xffcf5a, emissive: 0xffa820, emissiveIntensity: 1.1, metalness: 0.95, roughness: 0.22 })
  const coreMat    = new THREE.MeshBasicMaterial({ color: 0xfff0c4 })   // near-white → blooms into a glow
  const glowMat    = new THREE.MeshBasicMaterial({ color: 0xffd070, transparent: true, opacity: 0.4, blending: THREE.AdditiveBlending, depthWrite: false })

  // arched "tablet" outline: a vertical rectangle capped by a semicircle
  const arch = (halfW, bottom, top) => {
    const s = new THREE.Shape()
    s.moveTo(-halfW, -bottom)
    s.lineTo(-halfW, top)
    s.absarc(0, top, halfW, Math.PI, 0, true)
    s.lineTo(halfW, -bottom)
    s.lineTo(-halfW, -bottom)
    return s
  }

  // main body slab
  const body = new THREE.ExtrudeGeometry(arch(1.5, 3.2, 1.8), { depth: 0.7, bevelEnabled: true, bevelThickness: 0.1, bevelSize: 0.1, bevelSegments: 2, curveSegments: 28 })
  group.add(new THREE.Mesh(body, gold))
  const frontZ = 0.95   // clear of the body's front face + bevel

  // raised inner panel (brighter gold), set proud of the front face
  const panel = new THREE.ExtrudeGeometry(arch(1.15, 2.6, 1.5), { depth: 0.14, bevelEnabled: true, bevelThickness: 0.05, bevelSize: 0.06, bevelSegments: 1, curveSegments: 24 })
  const panelMesh = new THREE.Mesh(panel, goldBright); panelMesh.position.z = frontZ - 0.16
  group.add(panelMesh)

  // halo emblem ring + glowing core, in the upper third on the front
  const emblemY = 1.5, emblemZ = frontZ + 0.06
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.92, 0.12, 14, 48), goldBright)
  ring.position.set(0, emblemY, emblemZ)
  group.add(ring)
  const core = new THREE.Mesh(new THREE.SphereGeometry(0.46, 24, 24), coreMat)
  core.position.set(0, emblemY, emblemZ + 0.04)
  group.add(core)
  const glow = new THREE.Mesh(new THREE.SphereGeometry(1.0, 24, 24), glowMat)
  glow.position.copy(core.position)
  group.add(glow)

  // vertical light seam down the lower body
  const seam = new THREE.Mesh(new THREE.BoxGeometry(0.16, 3.4, 0.06), coreMat)
  seam.position.set(0, -1.0, frontZ + 0.02)
  group.add(seam)

  // horizontal ornament bands across the slab
  for (const y of [-0.2, -1.4, -2.5]) {
    const band = new THREE.Mesh(new THREE.BoxGeometry(2.7, 0.14, 0.12), goldBright)
    band.position.set(0, y, frontZ)
    group.add(band)
  }

  // base plinth to ground it
  const base = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.5, 1.4), gold)
  base.position.set(0, -3.5, 0.1)
  group.add(base)

  return group
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
  const pick = Math.floor(Math.random() * 3)
  const bodyR = pick === 0 ? 40 : pick === 1 ? 26 : 12   // solid radius of the chosen body
  // keep the body's nearest surface well outside the capital patrol (~43) so ships
  // never fly inside it; push it further down the view ray if a near spot was rolled
  const CLEARANCE = 55
  let dist = 120 + Math.random() * 45
  const pos = camera.position.clone().addScaledVector(ray, dist)
  while (pos.length() - bodyR < CLEARANCE && dist < 400) {
    dist += 12
    pos.copy(camera.position).addScaledVector(ray, dist)
  }
  if (pick === 0) return makeGasGiant(scene, disposables, pos, lightDir)
  if (pick === 1) return makeRingedPlanet(scene, disposables, pos, lightDir)
  return makeBlackHole(scene, disposables, pos)
}

export {
  NEBULA_VERT, NEBULA_FRAG,
  buildBlueModel, buildRedModel, buildBlueCapital, buildRedCapital, buildBlueBomber, buildRedBomber,
  buildBlueCruiser, buildRedCruiser, buildAleph, makeShield, makeBackdrop,
}
