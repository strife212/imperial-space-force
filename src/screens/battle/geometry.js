import * as THREE from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import { RIM_VERT, RIM_FRAG, DISK_VERT, DISK_FRAG, LENSED_BH_VERT, LENSED_BH_FRAG, GALAXY_VERT, GALAXY_FRAG, STAR_VERT, STAR_FRAG, STAR_CORONA_VERT, STAR_CORONA_FRAG } from '../../lib/shaders'

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
// The extra uniforms (uColC dust lanes, uGlowDir/uGlowCol core glow, uTime drift)
// are all zero-safe: callers that only supply uColA/B/Warm — the cutscene stage
// and the campaign map — render exactly the original static picture.
const NEBULA_FRAG = /* glsl */`
  precision highp float;
  varying vec3 vDir;
  uniform vec3 uColA; uniform vec3 uColB; uniform vec3 uColWarm;
  uniform vec3 uColC;                      // ridged dust-lane accent
  uniform vec3 uGlowDir; uniform vec3 uGlowCol;   // distant luminous core
  uniform float uTime;                     // slow cloud drift
  uniform vec3 uBaseShift;                 // zero-safe: added to the deep-space base tint
` + GLSL_NOISE + /* glsl */`
  void main() {
    vec3 d = normalize(vDir);
    vec3 dd = d + vec3(uTime * 0.0100, uTime * 0.0042, -uTime * 0.0071);
    float n  = fbm(dd * 2.4 + 3.1);
    float n2 = fbm(dd * 5.3 + 9.7);
    float clouds = smoothstep(0.30, 0.95, n * 0.75 + n2 * 0.35);
    vec3 col = max(vec3(0.0), vec3(0.012, 0.020, 0.045) + uBaseShift);   // deep-space base
    col = mix(col, uColA, clouds * 0.7);                  // cool nebula body
    col = mix(col, uColB, smoothstep(0.55, 1.05, n) * 0.55);  // denser cores
    float warm = smoothstep(0.15, 1.0, d.x * 0.5 + 0.5) * smoothstep(0.45, 0.95, n2);
    col += uColWarm * warm * 0.22;                        // faint warm region to one side
    // ridged filaments threading the brighter cloud bodies
    float ridge = 1.0 - abs(2.0 * fbm(dd * 3.6 - 4.2) - 1.0);
    col += uColC * pow(ridge, 3.0) * clouds * 0.9;
    // soft directional glow — a far-off luminous core behind the field
    float g = max(dot(d, uGlowDir), 0.0);
    col += uGlowCol * (pow(g, 3.0) * 0.5 + pow(g, 9.0) * 0.5);
    gl_FragColor = vec4(col, 1.0);
  }
`

// ── Battle skies — selectable nebula palettes for the skydome ──────────────────
// Five looks sharing NEBULA_FRAG. `key` is what battles reference (campaign nodes
// pick one; anything unset falls back to the first entry, Void Indigo — the
// classic backdrop). `drift` scales the cloud-drift rate.
const SKIES = [
  { key: 'void',    name: 'Void Indigo',    a: [0.030, 0.055, 0.140], b: [0.090, 0.035, 0.150], warm: [0.180, 0.070, 0.030], accent: [0.050, 0.045, 0.110], glowDir: [0.55, 0.20, -0.35], glowCol: [0.10, 0.09, 0.17], drift: 1.0 },
  { key: 'ember',   name: 'Ember Reach',    a: [0.115, 0.038, 0.018], b: [0.150, 0.032, 0.055], warm: [0.240, 0.110, 0.030], accent: [0.130, 0.050, 0.018], glowDir: [-0.45, 0.30, 0.45], glowCol: [0.22, 0.09, 0.03], drift: 1.25 },
  { key: 'verdant', name: 'Verdant Drift',  a: [0.020, 0.095, 0.075], b: [0.030, 0.075, 0.130], warm: [0.060, 0.180, 0.100], accent: [0.025, 0.105, 0.070], glowDir: [0.30, 0.50, 0.30],  glowCol: [0.05, 0.14, 0.10], drift: 0.9 },
  { key: 'rose',    name: 'Rose Cathedral', a: [0.100, 0.025, 0.120], b: [0.160, 0.040, 0.100], warm: [0.220, 0.070, 0.130], accent: [0.120, 0.030, 0.100], glowDir: [-0.35, 0.42, -0.40], glowCol: [0.18, 0.06, 0.12], drift: 0.8 },
  { key: 'aurum',   name: 'Aurum Dawn',     a: [0.055, 0.045, 0.085], b: [0.150, 0.105, 0.035], warm: [0.235, 0.160, 0.055], accent: [0.140, 0.100, 0.030], glowDir: [0.60, 0.28, 0.20],  glowCol: [0.24, 0.15, 0.05], drift: 1.1 },
]
const skyByKey = (key) => SKIES.find(s => s.key === key) || SKIES[0]

// Build the nebula skydome for a battle. Returns { tick, setSky }: tick(t)
// drives the slow cloud drift; setSky(key) recolours the dome live.
function makeNebulaSky(scene, disposables, skyKey, radius = 330) {
  let sky = skyByKey(skyKey)
  const geo = new THREE.SphereGeometry(radius, 32, 32)
  const mat = new THREE.ShaderMaterial({
    vertexShader: NEBULA_VERT, fragmentShader: NEBULA_FRAG,
    uniforms: {
      uColA:    { value: new THREE.Color(...sky.a) },
      uColB:    { value: new THREE.Color(...sky.b) },
      uColWarm: { value: new THREE.Color(...sky.warm) },
      uColC:    { value: new THREE.Color(...sky.accent) },
      uGlowDir: { value: new THREE.Vector3(...sky.glowDir).normalize() },
      uGlowCol: { value: new THREE.Color(...sky.glowCol) },
      uTime:    { value: 0 },
    },
    side: THREE.BackSide, depthWrite: false, depthTest: false,
  })
  const mesh = new THREE.Mesh(geo, mat)
  mesh.renderOrder = -10
  scene.add(mesh)
  disposables.push(geo, mat)
  return {
    tick: (t) => { mat.uniforms.uTime.value = t * sky.drift },
    setSky: (key) => {
      sky = skyByKey(key)
      mat.uniforms.uColA.value.setRGB(...sky.a)
      mat.uniforms.uColB.value.setRGB(...sky.b)
      mat.uniforms.uColWarm.value.setRGB(...sky.warm)
      mat.uniforms.uColC.value.setRGB(...sky.accent)
      mat.uniforms.uGlowDir.value.set(...sky.glowDir).normalize()
      mat.uniforms.uGlowCol.value.setRGB(...sky.glowCol)
    },
  }
}

// ── Gas-giant planet — sheared zonal bands, storm oval, limb-aware lighting ────
const PLANET_VERT = /* glsl */`
  varying vec3 vWN; varying vec3 vPosL; varying vec3 vWPos;
  void main() {
    vWN = normalize(mat3(modelMatrix) * normal);
    vPosL = position;
    vWPos = (modelMatrix * vec4(position, 1.0)).xyz;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`
// Shared by the gas giant and the ringed planet. uTime drifts the bands (0 =
// static, so untimed cutscene callers render a fixed frame); uStorm paints the
// anticyclone oval; uHasRing enables the ring-shadow march using uRing*.
const PLANET_FRAG = /* glsl */`
  precision highp float;
  varying vec3 vWN; varying vec3 vPosL; varying vec3 vWPos;
  uniform vec3 uLightDir; uniform vec3 uColA; uniform vec3 uColB; uniform vec3 uColC;
  uniform vec3 uAtmoCol;
  uniform float uTime; uniform float uStorm; uniform float uHasRing;
  uniform vec3 uRingN; uniform float uRingIn; uniform float uRingOut;
` + GLSL_NOISE + /* glsl */`
  void main() {
    vec3 n = normalize(vPosL);
    // drift the sampling frame prograde instead of rotating the mesh
    float ang = uTime * 0.012;
    float ca = cos(ang), sa = sin(ang);
    vec3 p = vec3(n.x * ca - n.z * sa, n.y, n.x * sa + n.z * ca);

    // zonal bands at three latitude frequencies, sheared by turbulent flow
    float flow = fbm(vec3(p.x * 1.2, p.y * 3.4, p.z * 1.2) + uTime * 0.006);
    float y = p.y + (flow - 0.5) * 0.30;
    float zones = 0.50 * sin(y * 9.5) + 0.30 * sin(y * 21.0 + 1.7) + 0.34 * sin(y * 4.3 - 0.6);
    float t = smoothstep(0.22, 0.78, clamp(zones * 0.75 + 0.5, 0.0, 1.0));   // steepen belt edges
    vec3 surf = mix(uColB, uColA, t);
    // fine cirrus streaks stretched along the flow
    float streak = fbm(vec3(p.x * 3.2, y * 16.0, p.z * 3.2));
    surf = mix(surf, uColA * 1.06, smoothstep(0.60, 0.88, streak) * 0.22);
    // small pale storm cells punched through the belts
    surf = mix(surf, uColC, smoothstep(0.64, 0.95, fbm(p * 5.5 + 5.0)) * 0.5);
    surf = min(surf, uColA * 1.10);   // keep accents below the bloom knee

    // great anticyclone — a swirling oval pinned in the drifting frame
    if (uStorm > 0.5) {
      float lon = atan(p.z, p.x);
      vec2 o = vec2((lon - 0.9) * 0.62, asin(clamp(p.y, -1.0, 1.0)) + 0.42);
      float d = length(o) * 6.5;
      if (d < 1.3) {
        float sw = atan(o.y, o.x) + (1.3 - d) * 4.5 + uTime * 0.05;
        float swirl = fbm(vec3(cos(sw), sin(sw), d * 1.8) * 2.0);
        // dark vortex core with a thin pale collar
        vec3 eye = mix(uColB * 0.75, uColA * 1.05, smoothstep(0.55, 0.95, d));
        surf = mix(surf, eye * (0.85 + swirl * 0.25), 1.0 - smoothstep(0.55, 1.25, d));
      }
    }

    vec3 N = normalize(vWN);
    vec3 L = normalize(uLightDir);
    float ndl = dot(N, L);
    float lit = smoothstep(-0.28, 0.55, ndl);            // soft terminator

    // ring shadow: march from the surface point toward the light, test the ring span
    if (uHasRing > 0.5) {
      float dn = dot(L, uRingN);
      float s = -dot(vPosL, uRingN) / (abs(dn) > 1e-4 ? dn : 1e-4);
      if (s > 0.0) {
        float r = length(vPosL + L * s);
        float rt = clamp((r - uRingIn) / (uRingOut - uRingIn), 0.0, 1.0);
        float inRing = smoothstep(uRingIn - 0.8, uRingIn + 0.8, r) * (1.0 - smoothstep(uRingOut - 0.8, uRingOut + 0.8, r));
        float gap = smoothstep(0.40, 0.44, rt) * (1.0 - smoothstep(0.53, 0.57, rt));
        lit *= 1.0 - inRing * (1.0 - gap * 0.9) * 0.55;
      }
    }

    vec3 V = normalize(cameraPosition - vWPos);
    float limb = 1.0 - max(dot(N, V), 0.0);
    vec3 col = surf * (1.0 - 0.34 * pow(limb, 1.7)) * (0.045 + lit * 1.0);    // limb darkening
    col += uAtmoCol * pow(limb, 2.6) * (0.10 + lit * 0.45);                   // limb scattering
    col += uAtmoCol * (1.0 - smoothstep(0.0, 0.40, abs(ndl))) * lit * 0.25;   // twilight band
    gl_FragColor = vec4(col, 1.0);
  }
`

// ── Earthlike planet — oceans, biome-tinted continents, night lights, clouds ───
const EARTH_FRAG = /* glsl */`
  precision highp float;
  varying vec3 vWN; varying vec3 vPosL; varying vec3 vWPos;
  uniform vec3 uLightDir; uniform float uTime;
` + GLSL_NOISE + /* glsl */`
  void main() {
    vec3 n = normalize(vPosL);
    float ang = uTime * 0.009;
    float ca = cos(ang), sa = sin(ang);
    vec3 p = vec3(n.x * ca - n.z * sa, n.y, n.x * sa + n.z * ca);

    // elevation: broad continental plates + ridge detail
    float h = fbm(p * 1.8 + 11.3) * 0.68 + fbm(p * 4.6 + 3.1) * 0.32;
    float sea = 0.52;
    float landM = smoothstep(sea - 0.006, sea + 0.006, h);
    float lat = abs(p.y);

    // ocean: deep basins darken, shelves brighten toward the coast
    float shelf = smoothstep(sea - 0.06, sea, h);
    vec3 ocean = mix(vec3(0.012, 0.052, 0.115), vec3(0.055, 0.19, 0.26), shelf);
    // land: moisture picks desert→steppe→forest, altitude adds rock and snow
    float moist = fbm(p * 3.1 + 27.0);
    vec3 land = mix(vec3(0.40, 0.33, 0.19), vec3(0.11, 0.26, 0.11), smoothstep(0.38, 0.62, moist));
    land = mix(land, vec3(0.045, 0.16, 0.065), smoothstep(0.55, 0.80, moist) * (1.0 - smoothstep(0.30, 0.65, lat)));
    land = mix(land, vec3(0.31, 0.29, 0.27), smoothstep(0.64, 0.76, h) * 0.75);
    land = mix(land, vec3(0.60, 0.63, 0.68), smoothstep(0.73, 0.80, h));
    vec3 surf = mix(ocean, land, landM);
    // polar ice with a noisy shoreline
    float cap = smoothstep(0.76, 0.85, lat + (fbm(p * 5.0 + 8.0) - 0.5) * 0.10);
    surf = mix(surf, vec3(0.64, 0.68, 0.76), cap);

    vec3 N = normalize(vWN);
    vec3 L = normalize(uLightDir);
    float ndl = dot(N, L);
    float lit = smoothstep(-0.18, 0.42, ndl);
    vec3 V = normalize(cameraPosition - vWPos);
    float limb = 1.0 - max(dot(N, V), 0.0);

    vec3 col = surf * (1.0 - 0.30 * pow(limb, 1.8)) * (0.030 + lit * 0.98);
    // sun glint on open water
    float spec = pow(max(dot(N, normalize(L + V)), 0.0), 120.0) * (1.0 - landM) * (1.0 - cap) * lit;
    col += vec3(1.0, 0.93, 0.76) * spec * 0.5;
    // city lights speckling the night-side land clusters
    float night = 1.0 - smoothstep(-0.24, 0.06, ndl);
    float clus = fbm(p * 7.0 + 41.0);
    float dots = smoothstep(0.70, 0.95, vnoise(p * 55.0));
    col += vec3(1.0, 0.70, 0.34) * landM * (1.0 - cap) * smoothstep(0.52, 0.85, clus) * dots * night * 1.2;
    // blue atmospheric limb, strongest on the day side
    col += vec3(0.09, 0.19, 0.40) * pow(limb, 2.4) * (0.10 + lit * 0.55);
    gl_FragColor = vec4(col, 1.0);
  }
`
// ── Machine planet — the Ecumenologion: a planet-sized computer in indigo ──────
// Panel plating with grout seams, concentric circuit tracery organised around a
// machine axis, broken glowing arc segments, trench lines with lit floors, a
// blanket of window lights (brightest on the night side) and a radiant polar
// eye — the great mind at the pole. uTime drifts the sphere and pulses lights.
const MACHINE_FRAG = /* glsl */`
  precision highp float;
  varying vec3 vWN; varying vec3 vPosL; varying vec3 vWPos;
  uniform vec3 uLightDir; uniform float uTime;
` + GLSL_NOISE + /* glsl */`
  float hash2(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  void main() {
    vec3 n = normalize(vPosL);
    float ang = uTime * 0.005;
    float ca = cos(ang), sa = sin(ang);
    vec3 p = vec3(n.x * ca - n.z * sa, n.y, n.x * sa + n.z * ca);

    // the machine axis: all tracery is organised around this pole
    vec3 A = normalize(vec3(0.20, 0.42, 0.88));
    float axCos = clamp(dot(p, A), -1.0, 1.0);
    float axLat = acos(axCos);                                   // 0 at the eye pole
    vec3 T1 = normalize(cross(A, vec3(0.0, 0.0, 1.0)));
    vec3 T2 = cross(A, T1);
    float axAz = atan(dot(p, T2), dot(p, T1));

    // ── panel plating: coarse plates and fine tiles, dark grout seams ──
    vec2 uv = vec2(axAz, axLat);
    vec2 f1 = fract(uv * vec2(4.0, 7.0));
    vec2 e1 = min(f1, 1.0 - f1);
    float seam1 = smoothstep(0.0, 0.030, min(e1.x, e1.y));
    float plate = 0.80 + 0.40 * hash2(floor(uv * vec2(4.0, 7.0)));
    vec2 f2 = fract(uv * vec2(16.0, 28.0));
    vec2 e2 = min(f2, 1.0 - f2);
    float seam2 = smoothstep(0.0, 0.012, min(e2.x, e2.y));
    float tile = 0.88 + 0.24 * hash2(floor(uv * vec2(16.0, 28.0)));
    vec3 base = vec3(0.016, 0.024, 0.050) * plate * tile * (0.45 + 0.55 * seam1) * (0.72 + 0.28 * seam2);

    // ── concentric circuit tracery: rings and broken arc segments ──
    float ringF = fract(axLat * 22.0);
    float ringLine = 1.0 - smoothstep(0.0, 0.07, min(ringF, 1.0 - ringF));
    float ringSel = step(0.35, hash2(vec2(floor(axLat * 22.0), 3.0)));
    float segSel  = step(0.45, hash2(vec2(floor(axAz * 6.0), floor(axLat * 22.0))));
    float flicker = 0.8 + 0.2 * sin(uTime * 0.7 + hash2(vec2(floor(axLat * 22.0), floor(axAz * 6.0))) * 6.28);
    float traces = ringLine * ringSel * (0.35 + 0.65 * segSel) * flicker;

    // ── two great-circle trenches with lit floors ──
    vec3 N1 = normalize(vec3(0.70, 0.20, 0.70));
    vec3 N2 = normalize(vec3(-0.50, 0.55, 0.60));
    float d1 = abs(dot(p, N1)), d2 = abs(dot(p, N2));
    float trench = max(1.0 - smoothstep(0.010, 0.030, d1), 1.0 - smoothstep(0.010, 0.030, d2));
    float trenchGlow = max(1.0 - smoothstep(0.0, 0.006, d1), 1.0 - smoothstep(0.0, 0.006, d2));
    base *= 1.0 - 0.6 * trench;

    // ── window lights: fine points, denser where the districts cluster ──
    float fine = smoothstep(0.72, 0.90, vnoise(p * 60.0));
    float coarse = smoothstep(0.60, 0.92, vnoise(p * 26.0 + 7.0));
    float dots = fine * (0.40 + 0.85 * coarse);
    float clus = smoothstep(0.25, 0.65, fbm(p * 5.0 + 13.0));
    float pulse = 0.85 + 0.15 * sin(uTime * 1.3 + vnoise(p * 9.0) * 6.28);
    float lights = dots * clus * pulse;

    vec3 N = normalize(vWN);
    vec3 L = normalize(uLightDir);
    float lit = smoothstep(-0.25, 0.50, dot(N, L));
    vec3 V = normalize(cameraPosition - vWPos);
    float limb = 1.0 - max(dot(N, V), 0.0);

    vec3 traceCol = vec3(0.30, 0.42, 1.00);
    vec3 col = base * (0.24 + 0.55 * lit) * (1.0 - 0.30 * pow(limb, 1.8));   // dim day side; machine floor-light
    col += traceCol * traces * (0.42 + 0.22 * lit);
    col += traceCol * trenchGlow * 0.6;
    col += vec3(0.75, 0.85, 1.0) * lights * (1.05 - 0.55 * lit);             // windows shine hardest at night
    // the polar eye: spiral iris converging on a radiant core
    float eye = 1.0 - smoothstep(0.0, 0.40, axLat);
    float spiral = smoothstep(0.2, 0.9, sin(axLat * 55.0 - axAz * 2.0 - uTime * 0.25));
    col += vec3(0.40, 0.55, 1.05) * eye * (0.18 + 0.22 * spiral);
    col += vec3(0.55, 0.70, 1.20) * pow(max(1.0 - axLat / 0.10, 0.0), 2.0);
    // faint indigo limb glow
    col += vec3(0.14, 0.19, 0.42) * pow(limb, 2.6) * 0.5;
    gl_FragColor = vec4(col, 1.0);
  }
`

const CLOUD_FRAG = /* glsl */`
  precision highp float;
  varying vec3 vWN; varying vec3 vPosL; varying vec3 vWPos;
  uniform vec3 uLightDir; uniform float uTime;
` + GLSL_NOISE + /* glsl */`
  void main() {
    vec3 n = normalize(vPosL);
    float ang = uTime * 0.016;                       // clouds outrun the ground below
    float ca = cos(ang), sa = sin(ang);
    vec3 p = vec3(n.x * ca - n.z * sa, n.y, n.x * sa + n.z * ca);
    float c = fbm(p * 2.5 + vec3(0.0, uTime * 0.004, 0.0));
    c += 0.10 * sin(p.y * 6.0 + 1.3);                // zonal cloud belts
    float a = smoothstep(0.56, 0.88, c);
    a += smoothstep(0.58, 0.85, fbm(p * 5.4 + 9.0)) * 0.30 * a;   // curdled storm texture
    vec3 N = normalize(vWN);
    float ndl = dot(N, normalize(uLightDir));
    float lit = smoothstep(-0.14, 0.45, ndl);
    vec3 V = normalize(cameraPosition - vWPos);
    float limb = 1.0 - max(dot(N, V), 0.0);
    vec3 col = vec3(0.70, 0.73, 0.78) * (0.05 + lit * 0.92);
    float alpha = clamp(a, 0.0, 1.0) * (0.08 + 0.92 * lit) * (1.0 - 0.55 * pow(limb, 3.0));
    gl_FragColor = vec4(col, alpha);
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
  uniform vec3 uLightLocal;   // light direction in the ring's local frame
  uniform float uPlanetR;     // radius of the shadow-casting planet
` + GLSL_NOISE + /* glsl */`
  void main() {
    float r = length(vPos);
    float t = clamp((r - uInner) / (uOuter - uInner), 0.0, 1.0);
    // irregular ringlets: two noise scales over a soft sine carrier
    float n1 = vnoise(vec3(t * 42.0, 3.7, 9.2));
    float n2 = vnoise(vec3(t * 150.0, 8.1, 1.4));
    float bands = clamp(0.28 + n1 * 0.52 + n2 * 0.42 + 0.16 * sin(t * 70.0), 0.0, 1.0);
    // divisions: broad Cassini gap plus two thin lanes
    float gap   = smoothstep(0.40, 0.44, t) * (1.0 - smoothstep(0.53, 0.57, t));
    float lane1 = smoothstep(0.165, 0.175, t) * (1.0 - smoothstep(0.19, 0.20, t));
    float lane2 = smoothstep(0.775, 0.783, t) * (1.0 - smoothstep(0.802, 0.81, t));
    float density = bands * (1.0 - gap * 0.93) * (1.0 - lane1 * 0.75) * (1.0 - lane2 * 0.85);
    float edge = smoothstep(0.0, 0.05, t) * (1.0 - smoothstep(0.90, 1.0, t));
    // planet shadow: the dark cylinder cast down-light across the far ansa
    vec3 P = vec3(vPos, 0.0);
    float along = dot(P, uLightLocal);
    float perp = length(P - uLightLocal * along);
    float shadow = (1.0 - smoothstep(uPlanetR * 0.85, uPlanetR * 1.15, perp))
                 * (1.0 - smoothstep(0.0, uPlanetR * 0.5, along));
    vec3 col = mix(uColB, uColA, clamp(bands * 1.15, 0.0, 1.0));
    col *= 0.28 + 0.62 * (1.0 - shadow * 0.9);
    float alpha = edge * (0.24 + 0.50 * density) * (1.0 - shadow * 0.3);
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

// The Cassiopeia-class science vessel — long and slender, about a capital's
// length but unmistakably an instrument rather than a weapon: a probe spine
// tipped with a sensor globe, encircled by collar rings, carrying a dorsal
// survey dish and outrigger instrument booms in place of guns.
function buildScienceVessel() {
  const parts = []
  let g = new THREE.CylinderGeometry(0.4, 0.46, 8.6, 10); g.rotateX(Math.PI / 2); parts.push(g)        // long slender spine
  g = new THREE.SphereGeometry(0.72, 16, 12); g.translate(0, 0, 4.6); parts.push(g)                    // forward sensor globe
  g = new THREE.ConeGeometry(0.28, 1.2, 8); g.rotateX(Math.PI / 2); g.translate(0, 0, 5.7); parts.push(g)  // fine probe spike
  for (const z of [2.2, 3.0]) { g = new THREE.TorusGeometry(0.8, 0.1, 8, 24); g.translate(0, 0, z); parts.push(g) }  // sensor collar rings
  g = new THREE.BoxGeometry(0.46, 0.4, 1.9); g.translate(0.74, 0, 0.1); parts.push(g)                  // laboratory pod R
  g = new THREE.BoxGeometry(0.46, 0.4, 1.9); g.translate(-0.74, 0, 0.1); parts.push(g)                 // laboratory pod L
  g = new THREE.BoxGeometry(3.4, 0.06, 0.16); g.translate(0, 0, 1.1); parts.push(g)                    // lateral sensor spar
  g = new THREE.BoxGeometry(0.08, 1.2, 0.08); g.translate(0, 0.85, -0.4); parts.push(g)                // dorsal dish mast
  g = new THREE.ConeGeometry(1.1, 0.42, 22); g.rotateX(-Math.PI / 2.3); g.translate(0, 1.48, 0.1); parts.push(g)  // parabolic survey dish
  g = new THREE.BoxGeometry(0.07, 0.95, 0.07); g.translate(0, -0.85, 1.1); parts.push(g)               // ventral instrument boom
  g = new THREE.BoxGeometry(0.6, 0.2, 0.6); g.translate(0, -1.3, 1.1); parts.push(g)                   // ventral sensor pod
  g = new THREE.BoxGeometry(0.9, 0.74, 1.3); g.translate(0, 0, -4.0); parts.push(g)                    // aft reactor block
  g = new THREE.CylinderGeometry(0.22, 0.3, 1.1, 8); g.rotateX(Math.PI / 2); g.translate(0.5, 0, -4.8); parts.push(g)   // nacelle R
  g = new THREE.CylinderGeometry(0.22, 0.3, 1.1, 8); g.rotateX(Math.PI / 2); g.translate(-0.5, 0, -4.8); parts.push(g)  // nacelle L
  return mergeGeometries(parts, false)
}

// An alternate blue capital — a long, angular frigate in the spirit of a UNSC
// warship: an elevated main hull over a forward-projecting keel, a tall blocky
// engine stern, a forward bridge tower, twin forward MAC cannons and flared aft
// vanes.
function buildBlueCapital2() {
  const parts = []
  // upper main hull
  let g = new THREE.BoxGeometry(1.3, 1.0, 5.2); g.translate(0, 0.2, 0); parts.push(g)                 // long main hull
  g = new THREE.BoxGeometry(1.0, 0.8, 1.4); g.translate(0, 0.1, 3.0); parts.push(g)                   // bow taper
  g = new THREE.BoxGeometry(0.7, 0.6, 0.8); g.translate(0, 0.05, 3.9); parts.push(g)                  // blunt bow tip
  // tall blocky engine stern
  g = new THREE.BoxGeometry(1.45, 1.4, 1.5); g.translate(0, 0.3, -2.9); parts.push(g)                 // stern block
  g = new THREE.BoxGeometry(1.1, 0.4, 0.6); g.translate(0, 1.1, -2.9); parts.push(g)                  // raised aft deck
  // forward bridge / superstructure
  g = new THREE.BoxGeometry(0.6, 0.55, 1.5); g.translate(0, 0.9, 1.1); parts.push(g)                  // bridge block
  g = new THREE.BoxGeometry(0.45, 0.35, 0.6); g.translate(0, 1.2, 1.5); parts.push(g)                 // bridge step
  g = new THREE.BoxGeometry(0.08, 0.6, 0.08); g.translate(0, 1.55, 1.7); parts.push(g)                // sensor mast
  // lower keel, projecting forward under the bow
  g = new THREE.BoxGeometry(0.7, 0.6, 3.0); g.translate(0, -0.35, 0.4); parts.push(g)                 // hull-to-keel connector
  g = new THREE.BoxGeometry(0.95, 0.7, 4.4); g.translate(0, -0.95, 0.7); parts.push(g)                // ventral keel
  g = new THREE.BoxGeometry(0.85, 0.6, 1.2); g.translate(0, -1.0, 3.0); parts.push(g)                 // forward gun housing
  // twin forward MAC cannons
  g = new THREE.CylinderGeometry(0.1, 0.13, 2.6, 8); g.rotateX(Math.PI / 2); g.translate(0.28, -1.05, 3.9); parts.push(g)   // barrel R
  g = new THREE.CylinderGeometry(0.1, 0.13, 2.6, 8); g.rotateX(Math.PI / 2); g.translate(-0.28, -1.05, 3.9); parts.push(g)  // barrel L
  // side sponsons / plating
  g = new THREE.BoxGeometry(0.24, 0.5, 2.6); g.translate(0.78, 0.05, -0.2); parts.push(g)             // sponson R
  g = new THREE.BoxGeometry(0.24, 0.5, 2.6); g.translate(-0.78, 0.05, -0.2); parts.push(g)            // sponson L
  // flared aft vanes
  g = new THREE.BoxGeometry(0.1, 1.3, 1.4); g.rotateZ(-0.4); g.translate(0.55, 0.55, -3.2); parts.push(g)   // vane R
  g = new THREE.BoxGeometry(0.1, 1.3, 1.4); g.rotateZ(0.4); g.translate(-0.55, 0.55, -3.2); parts.push(g)   // vane L
  // engine nozzles
  for (const x of [-0.45, 0, 0.45]) { g = new THREE.CylinderGeometry(0.18, 0.22, 0.5, 8); g.rotateX(Math.PI / 2); g.translate(x, 0.25, -3.8); parts.push(g) }
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
      uColA: { value: new THREE.Color(0.175, 0.215, 0.285) },  // pale zones
      uColB: { value: new THREE.Color(0.035, 0.06, 0.105) },   // dark belts
      uColC: { value: new THREE.Color(0.36, 0.35, 0.33) },     // cream storms
      uAtmoCol: { value: new THREE.Color(0.07, 0.14, 0.30) },
      uTime: { value: 0 }, uStorm: { value: 1 }, uHasRing: { value: 0 },
      uRingN: { value: new THREE.Vector3(0, 1, 0) }, uRingIn: { value: 0 }, uRingOut: { value: 1 },
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
  return (t) => { mat.uniforms.uTime.value = t }
}

function makeRingedPlanet(scene, disposables, pos, lightDir) {
  const R = 26
  const ringEuler = new THREE.Euler(-1.15, 0.4, 0)                       // tilt for a 3/4 view
  const ringN = new THREE.Vector3(0, 0, 1).applyEuler(ringEuler)
  const rIn = R * 1.4, rOut = R * 2.4
  const geo = new THREE.SphereGeometry(R, 64, 64)
  const mat = new THREE.ShaderMaterial({
    vertexShader: PLANET_VERT, fragmentShader: PLANET_FRAG,
    uniforms: {
      uLightDir: { value: lightDir },
      uColA: { value: new THREE.Color(0.30, 0.235, 0.135) },   // sandy tan
      uColB: { value: new THREE.Color(0.145, 0.115, 0.065) },
      uColC: { value: new THREE.Color(0.45, 0.39, 0.26) },
      uAtmoCol: { value: new THREE.Color(0.13, 0.095, 0.045) },
      uTime: { value: 0 }, uStorm: { value: 0 }, uHasRing: { value: 1 },
      uRingN: { value: ringN }, uRingIn: { value: rIn }, uRingOut: { value: rOut },
    },
  })
  const body = new THREE.Mesh(geo, mat); body.position.copy(pos); scene.add(body)
  // light expressed in the ring's local frame, for the planet's shadow across it
  const lightLocal = lightDir.clone()
    .applyQuaternion(new THREE.Quaternion().setFromEuler(ringEuler).invert()).normalize()
  const rGeo = new THREE.RingGeometry(rIn, rOut, 160, 1)
  const rMat = new THREE.ShaderMaterial({
    vertexShader: RING_VERT, fragmentShader: RING_FRAG,
    uniforms: {
      uInner: { value: rIn }, uOuter: { value: rOut },
      uColA: { value: new THREE.Color(0.42, 0.36, 0.255) },
      uColB: { value: new THREE.Color(0.185, 0.15, 0.10) },
      uLightLocal: { value: lightLocal }, uPlanetR: { value: R },
    },
    transparent: true, depthWrite: false, side: THREE.DoubleSide,
  })
  const ring = new THREE.Mesh(rGeo, rMat)
  ring.position.copy(pos)
  ring.rotation.copy(ringEuler)
  scene.add(ring)
  disposables.push(geo, mat, rGeo, rMat)
  return (t) => { mat.uniforms.uTime.value = t }
}

function makeEarthlike(scene, disposables, pos, lightDir) {
  const R = 22
  const geo = new THREE.SphereGeometry(R, 72, 72)
  const mat = new THREE.ShaderMaterial({
    vertexShader: PLANET_VERT, fragmentShader: EARTH_FRAG,
    uniforms: { uLightDir: { value: lightDir }, uTime: { value: 0 } },
  })
  const body = new THREE.Mesh(geo, mat); body.position.copy(pos); scene.add(body)
  const cGeo = new THREE.SphereGeometry(R * 1.018, 64, 64)
  const cMat = new THREE.ShaderMaterial({
    vertexShader: PLANET_VERT, fragmentShader: CLOUD_FRAG,
    uniforms: { uLightDir: { value: lightDir }, uTime: { value: 0 } },
    transparent: true, depthWrite: false,
  })
  const clouds = new THREE.Mesh(cGeo, cMat); clouds.position.copy(pos); scene.add(clouds)
  const aGeo = new THREE.SphereGeometry(R * 1.055, 48, 48)
  const aMat = new THREE.ShaderMaterial({
    vertexShader: RIM_VERT, fragmentShader: RIM_FRAG,
    uniforms: { uColor: { value: new THREE.Color(0x4f8fe8) }, uPower: { value: 3.2 } },
    transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.FrontSide,
  })
  const atmo = new THREE.Mesh(aGeo, aMat); atmo.position.copy(pos); scene.add(atmo)
  disposables.push(geo, mat, cGeo, cMat, aGeo, aMat)
  return (t) => { mat.uniforms.uTime.value = t; cMat.uniforms.uTime.value = t }
}

function makeMachinePlanet(scene, disposables, pos, lightDir) {
  const R = 40
  const geo = new THREE.SphereGeometry(R, 96, 96)
  const mat = new THREE.ShaderMaterial({
    vertexShader: PLANET_VERT, fragmentShader: MACHINE_FRAG,
    uniforms: { uLightDir: { value: lightDir }, uTime: { value: 0 } },
  })
  const body = new THREE.Mesh(geo, mat); body.position.copy(pos); scene.add(body)
  const aGeo = new THREE.SphereGeometry(R * 1.045, 48, 48)
  const aMat = new THREE.ShaderMaterial({
    vertexShader: RIM_VERT, fragmentShader: RIM_FRAG,
    uniforms: { uColor: { value: new THREE.Color(0x3d4d8e) }, uPower: { value: 3.6 } },
    transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.FrontSide,
  })
  const atmo = new THREE.Mesh(aGeo, aMat); atmo.position.copy(pos); scene.add(atmo)
  disposables.push(geo, mat, aGeo, aMat)
  return (t) => { mat.uniforms.uTime.value = t }
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

// A more physical black hole: a camera-facing quad ray-marches bent light paths
// through the disk (see LENSED_BH_FRAG), so the far side of the accretion disk
// lenses into arcs over and under the shadow and the beaming follows the real
// camera. The additive quad can't darken the sky, so an opaque sphere at the
// photon-capture radius (b ≈ 2.6 rs — view-independent) renders the shadow.
function makeBlackHoleLensed(scene, disposables, pos) {
  const RS = 6                                   // Schwarzschild radius (world units)
  const DISK_IN = RS * 2.0, DISK_OUT = RS * 8.5  // ≈ the classic maker's disk span
  const half = DISK_OUT * 1.45                   // quad reach: disk + lensed-arc margin

  const shGeo = new THREE.SphereGeometry(RS * 2.6, 48, 48)
  const shMat = new THREE.MeshBasicMaterial({ color: 0x000000 })
  const shadow = new THREE.Mesh(shGeo, shMat); shadow.position.copy(pos); scene.add(shadow)

  const qGeo = new THREE.PlaneGeometry(half * 2, half * 2)
  const qMat = new THREE.ShaderMaterial({
    vertexShader: LENSED_BH_VERT, fragmentShader: LENSED_BH_FRAG,
    uniforms: {
      uTime:    { value: 0 },
      uCenter:  { value: pos.clone() },
      uDiskN:   { value: new THREE.Vector3(0.55, 0.78, 0.22).normalize() },
      uRs:      { value: RS },
      uDiskIn:  { value: DISK_IN },
      uDiskOut: { value: DISK_OUT },
    },
    transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
  })
  const quad = new THREE.Mesh(qGeo, qMat)
  quad.position.copy(pos)
  // keep the quad facing the live camera and its centre uniform tracking the mesh
  quad.onBeforeRender = (renderer, sc, camera) => {
    quad.quaternion.copy(camera.quaternion)
    quad.getWorldPosition(qMat.uniforms.uCenter.value)
  }
  scene.add(quad)
  disposables.push(shGeo, shMat, qGeo, qMat)
  return (t) => { qMat.uniforms.uTime.value = t }
}

// A spiral galaxy on a camera-facing quad, same construction as the lensed black
// hole above: the fragment shader marches the true camera ray through a flattened
// disc volume (see GALAXY_FRAG), so the image responds correctly as the camera
// orbits. Every look parameter is a uniform; the returned tick carries a handle
// (uniforms + params) so the model viewer's sliders retune the material live.
const GALAXY_MAX_R = 44   // quad is sized for the largest uRadius the sliders allow
const GALAXY_DEFAULTS = {
  radius: 30, thick: 0.085, arms: 2, twist: 4.6, bulge: 0.30, dust: 0.55,
  glow: 1.0, spin: 1.0, coreCol: '#ffe2b8', armCol: '#7fa8ff', dustCol: '#8a5a3a',
}
function makeGalaxy(scene, disposables, pos, opts = {}) {
  const P = { ...GALAXY_DEFAULTS, ...opts }
  // quad sized for the largest radius this instance will use — the viewer keeps
  // the full slider range; fixed-size scene dressing passes maxRadius: radius
  const half = (P.maxRadius ?? GALAXY_MAX_R) * 1.15
  const qGeo = new THREE.PlaneGeometry(half * 2, half * 2)
  const qMat = new THREE.ShaderMaterial({
    vertexShader: GALAXY_VERT, fragmentShader: GALAXY_FRAG,
    uniforms: {
      uTime:    { value: 0 },
      uCenter:  { value: pos.clone() },
      uPlaneN:  { value: (P.normal ?? new THREE.Vector3(0.22, 0.62, 0.76)).clone().normalize() },   // ~45° inclination toward the default camera
      uRadius:  { value: P.radius },
      uThick:   { value: P.thick },
      uArms:    { value: P.arms },
      uTwist:   { value: P.twist },
      uBulge:   { value: P.bulge },
      uDust:    { value: P.dust },
      uGlow:    { value: P.glow },
      uCoreCol: { value: new THREE.Color(P.coreCol) },
      uArmCol:  { value: new THREE.Color(P.armCol) },
      uDustCol: { value: new THREE.Color(P.dustCol) },
    },
    transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
  })
  const quad = new THREE.Mesh(qGeo, qMat)
  quad.position.copy(pos)
  quad.onBeforeRender = (renderer, sc, camera) => {
    quad.quaternion.copy(camera.quaternion)
    quad.getWorldPosition(qMat.uniforms.uCenter.value)
  }
  scene.add(quad)
  disposables.push(qGeo, qMat)
  // spin is integrated (not uTime = t * spin) so a live speed change never jumps
  // the pattern; the viewer retunes P.spin through tick.params
  let phase = 0, last = 0
  const tick = (t) => { phase += (t - last) * P.spin; last = t; qMat.uniforms.uTime.value = phase }
  tick.uniforms = qMat.uniforms
  tick.params = P
  return tick
}

// A main-sequence star, built like the planet makers but emissive: a granulated
// photosphere (STAR_FRAG), a camera-facing corona quad with drifting streamers,
// erupting prominence sprites, and a real PointLight so nearby hulls catch its
// glow. Returns a tick driving the surface simmer, flares and light flicker.
function makeStar(scene, disposables, pos, opts = {}) {
  const P = { radius: 10, color: 0xffa347, hot: 0xfff3d8, corona: 2.6, light: 2.2, ...opts }
  const geo = new THREE.SphereGeometry(P.radius, 48, 48)
  const mat = new THREE.ShaderMaterial({
    vertexShader: STAR_VERT, fragmentShader: STAR_FRAG,
    uniforms: {
      uTime: { value: 0 },
      uCol:  { value: new THREE.Color(P.color) },
      uHot:  { value: new THREE.Color(P.hot) },
    },
  })
  const body = new THREE.Mesh(geo, mat); body.position.copy(pos); scene.add(body)

  const half = P.radius * P.corona
  const cGeo = new THREE.PlaneGeometry(half * 2, half * 2)
  const cMat = new THREE.ShaderMaterial({
    vertexShader: STAR_CORONA_VERT, fragmentShader: STAR_CORONA_FRAG,
    uniforms: {
      uTime: { value: 0 },
      uR:    { value: P.radius },
      uCol:  { value: new THREE.Color(P.color).lerp(new THREE.Color(0xffffff), 0.25) },
    },
    transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
  })
  const corona = new THREE.Mesh(cGeo, cMat)
  corona.position.copy(pos)
  corona.onBeforeRender = (renderer, sc, camera) => { corona.quaternion.copy(camera.quaternion) }
  scene.add(corona)

  const light = new THREE.PointLight(P.color, P.light, P.radius * 45, 1.8)
  light.position.copy(pos); scene.add(light)

  // prominences — stretched blobs that erupt off the limb, arc, and sink back
  const yAxisL = new THREE.Vector3(0, 1, 0)
  const flares = []
  for (let i = 0; i < 5; i++) {
    const fMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(P.color).lerp(new THREE.Color(0xffffff), 0.3), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false })
    const m = new THREE.Mesh(new THREE.SphereGeometry(1, 10, 10), fMat)
    m.visible = false; scene.add(m)
    disposables.push(m.geometry, fMat)
    flares.push({ m, fMat, phase: i * 1.37, dir: new THREE.Vector3() })
  }
  disposables.push(geo, mat, cGeo, cMat)

  const _fd = new THREE.Vector3()
  return (t) => {
    mat.uniforms.uTime.value = t
    cMat.uniforms.uTime.value = t
    light.intensity = P.light * (0.92 + 0.08 * Math.sin(t * 2.7))
    for (const fl of flares) {
      const cyc = t * 0.55 + fl.phase
      const k = (cyc % 3) / 1.2               // active for the first 1.2s of each 3s cycle
      if (k >= 1) { fl.m.visible = false; continue }
      const seed = Math.floor(cyc / 3) * 12.9898 + fl.phase * 78.233
      const rnd = Math.abs(Math.sin(seed) * 43758.5453) % 1
      const th = rnd * Math.PI * 2, ph = ((rnd * 7.13) % 1) * 1.6 - 0.8
      _fd.set(Math.cos(ph) * Math.cos(th), Math.sin(ph), Math.cos(ph) * Math.sin(th))
      const lift = Math.sin(k * Math.PI)
      fl.m.visible = true
      fl.m.position.copy(pos).addScaledVector(_fd, P.radius * (0.96 + 0.28 * lift))
      fl.m.quaternion.setFromUnitVectors(yAxisL, _fd)
      const s = P.radius * 0.11 * (0.6 + lift)
      fl.m.scale.set(s * 0.5, s * 1.7, s * 0.5)
      fl.fMat.opacity = 0.85 * lift
    }
  }
}

// ── Cheap distant-object sprites ─────────────────────────────────────────────
// Billboarded stand-ins for stars and galaxies seen from far away: a Sprite with
// a pre-baked grayscale texture, tinted / scaled / rotated per instance. Vastly
// cheaper than makeStar / makeGalaxy (no shaders, lights, raymarch or per-frame
// tick), so dozens can dress the deep field. The textures are baked once and
// shared across every instance and scene.
let _starSpriteTex = null, _galaxySpriteTexes = null
function _starSprTex() {
  if (_starSpriteTex) return _starSpriteTex
  const cv = document.createElement('canvas'); cv.width = cv.height = 64
  const g = cv.getContext('2d')
  const core = g.createRadialGradient(32, 32, 0, 32, 32, 18)
  core.addColorStop(0, 'rgba(255,255,255,1)')
  core.addColorStop(0.4, 'rgba(255,255,255,0.4)')
  core.addColorStop(1, 'rgba(255,255,255,0)')
  g.fillStyle = core; g.fillRect(0, 0, 64, 64)
  g.globalCompositeOperation = 'lighter'          // faint 4-point diffraction spikes
  for (const [dx, dy] of [[1, 0], [0, 1]]) {
    const gr = g.createLinearGradient(32 - dx * 30, 32 - dy * 30, 32 + dx * 30, 32 + dy * 30)
    gr.addColorStop(0, 'rgba(255,255,255,0)')
    gr.addColorStop(0.5, 'rgba(255,255,255,0.55)')
    gr.addColorStop(1, 'rgba(255,255,255,0)')
    g.strokeStyle = gr; g.lineWidth = 1.3
    g.beginPath(); g.moveTo(32 - dx * 30, 32 - dy * 30); g.lineTo(32 + dx * 30, 32 + dy * 30); g.stroke()
  }
  _starSpriteTex = new THREE.CanvasTexture(cv)
  return _starSpriteTex
}
function _galaxySprTexes() {
  if (_galaxySpriteTexes) return _galaxySpriteTexes
  const spiral = (arms, twist, seed) => {
    const cv = document.createElement('canvas'); cv.width = cv.height = 128
    const g = cv.getContext('2d')
    let s = seed
    const rnd = () => { s = (s * 16807) % 2147483647; return s / 2147483647 }
    const core = g.createRadialGradient(64, 64, 0, 64, 64, 24)
    core.addColorStop(0, 'rgba(255,255,255,0.95)')
    core.addColorStop(0.4, 'rgba(255,255,255,0.30)')
    core.addColorStop(1, 'rgba(255,255,255,0)')
    g.fillStyle = core; g.fillRect(0, 0, 128, 128)
    g.globalCompositeOperation = 'lighter'
    for (let a = 0; a < arms; a++) {
      const a0 = a * (Math.PI * 2 / arms)
      for (let t = 0.05; t < 1; t += 0.011) {
        const ang = a0 + twist * t, r = t * 57
        const x = 64 + Math.cos(ang) * r + (rnd() - 0.5) * 9 * t
        const y = 64 + Math.sin(ang) * r + (rnd() - 0.5) * 9 * t
        const rad = 2.5 + (1 - t) * 4, b = (1 - t) * 0.45
        const dot = g.createRadialGradient(x, y, 0, x, y, rad)
        dot.addColorStop(0, `rgba(255,255,255,${b})`); dot.addColorStop(1, 'rgba(255,255,255,0)')
        g.fillStyle = dot; g.beginPath(); g.arc(x, y, rad, 0, Math.PI * 2); g.fill()
      }
    }
    return new THREE.CanvasTexture(cv)
  }
  _galaxySpriteTexes = [spiral(2, 6.2, 11), spiral(3, 5.0, 37), spiral(2, 7.6, 71)]
  return _galaxySpriteTexes
}
// A far-off star: a small tintable glow sprite (opts: color, size).
function buildSimpleStar({ color = 0xffffff, size = 3 } = {}) {
  const mat = new THREE.SpriteMaterial({ map: _starSprTex(), color, transparent: true, opacity: 1, blending: THREE.AdditiveBlending, depthWrite: false })
  const spr = new THREE.Sprite(mat); spr.scale.set(size, size, 1)
  return spr
}
// A far-off spiral galaxy: a tintable sprite; `tilt` (<1) foreshortens it into an
// inclined disc and `rotation` spins that disc (opts: color, size, variant, tilt, rotation).
function buildSimpleGalaxy({ color = 0xc8d6ff, size = 8, variant = 0, tilt = 0.5, rotation = 0 } = {}) {
  const texes = _galaxySprTexes()
  const mat = new THREE.SpriteMaterial({ map: texes[variant % texes.length], color, transparent: true, opacity: 1, blending: THREE.AdditiveBlending, depthWrite: false, rotation })
  const spr = new THREE.Sprite(mat); spr.scale.set(size, size * tilt, 1)
  return spr
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
  return makeBlackHoleLensed(scene, disposables, pos)
}

// Standalone celestial-body models for the model viewer. The scene-adding makers
// above only call `scene.add(...)`, so passing a Group as the "scene" builds a
// self-contained group. The black hole returns a per-frame tick (accretion-disk
// swirl), stashed on userData.tick for the viewer to drive.
const _CELESTIAL_LIGHT = new THREE.Vector3(0.5, 0.35, 0.8).normalize()
function buildGasGiantModel() {
  const g = new THREE.Group()
  g.userData.tick = makeGasGiant(g, [], new THREE.Vector3(), _CELESTIAL_LIGHT.clone())
  return g
}
function buildRingedPlanetModel() {
  const g = new THREE.Group()
  g.userData.tick = makeRingedPlanet(g, [], new THREE.Vector3(), _CELESTIAL_LIGHT.clone())
  return g
}
function buildEarthlikeModel() {
  const g = new THREE.Group()
  g.userData.tick = makeEarthlike(g, [], new THREE.Vector3(), _CELESTIAL_LIGHT.clone())
  return g
}
function buildMachinePlanetModel() {
  const g = new THREE.Group()
  g.userData.tick = makeMachinePlanet(g, [], new THREE.Vector3(), _CELESTIAL_LIGHT.clone())
  return g
}
function buildBlackHoleModel() {
  const g = new THREE.Group()
  g.userData.tick = makeBlackHole(g, [], new THREE.Vector3())
  return g
}
function buildBlackHoleLensedModel() {
  const g = new THREE.Group()
  g.userData.tick = makeBlackHoleLensed(g, [], new THREE.Vector3())
  return g
}
function buildGalaxyModel() {
  const g = new THREE.Group()
  const tick = makeGalaxy(g, [], new THREE.Vector3())
  g.userData.tick = tick
  g.userData.galaxy = { uniforms: tick.uniforms, params: tick.params }   // live-tuning handle
  return g
}
function buildStarModel() {
  const g = new THREE.Group()
  g.userData.tick = makeStar(g, [], new THREE.Vector3())
  return g
}

export {
  NEBULA_VERT, NEBULA_FRAG,
  buildBlueModel, buildRedModel, buildBlueCapital, buildRedCapital, buildBlueBomber, buildRedBomber,
  buildBlueCruiser, buildRedCruiser, buildScienceVessel, buildBlueCapital2, buildAleph, makeShield, makeBackdrop,
  makeGasGiant, makeRingedPlanet, makeEarthlike, makeMachinePlanet, makeBlackHole, makeBlackHoleLensed, makeGalaxy, makeStar,
  buildGasGiantModel, buildRingedPlanetModel, buildEarthlikeModel, buildMachinePlanetModel, buildBlackHoleModel, buildBlackHoleLensedModel, buildGalaxyModel, buildStarModel,
  buildSimpleStar, buildSimpleGalaxy,
  GALAXY_DEFAULTS,
  SKIES, makeNebulaSky,
}
