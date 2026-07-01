// Shared GLSL shaders for the three.js visualisers (reactor torus, black hole,
// and the power-management mini previews). Kept in one place so a tweak to the
// look propagates everywhere instead of drifting between copies.

// ── Plasma — swirling toroidal filaments, brightness driven by density ─────────
export const PLASMA_VERT = /* glsl */`
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`
export const PLASMA_FRAG = /* glsl */`
  precision highp float;
  uniform float uTime;
  uniform float uPlasma;
  varying vec2 vUv;
  float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float noise(vec2 p){
    vec2 i = floor(p), f = fract(p);
    float a = hash(i), b = hash(i + vec2(1.0, 0.0));
    float c = hash(i + vec2(0.0, 1.0)), d = hash(i + vec2(1.0, 1.0));
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
  }
  void main() {
    float tor = vUv.x;   // around the big ring
    float pol = vUv.y;   // around the tube
    // filaments streaming around the torus
    float swirl = tor + uTime * 0.04;
    float n = noise(vec2(swirl * 70.0, pol * 11.0)) * 0.6
            + noise(vec2(swirl * 150.0, pol * 24.0)) * 0.4;
    float fil = smoothstep(0.38, 0.98, n);
    // cool pink at low density -> hot white-pink as it heats up
    vec3 cool = vec3(1.0, 0.28, 0.70);
    vec3 hot  = vec3(1.0, 0.62, 0.88);
    vec3 col  = mix(cool, hot, clamp(uPlasma, 0.0, 1.0));
    float intensity = (0.16 + 0.42 * fil) * uPlasma;
    gl_FragColor = vec4(col * intensity, clamp(intensity, 0.0, 1.0));
  }
`

// ── Accretion disk — differential rotation, temperature gradient, beaming ──────
export const DISK_VERT = /* glsl */`
  varying vec2 vPos;
  void main() {
    vPos = position.xy;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`
export const DISK_FRAG = /* glsl */`
  precision highp float;
  uniform float uTime;
  uniform float uInner;
  uniform float uOuter;
  varying vec2 vPos;

  float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float noise(vec2 p){
    vec2 i = floor(p), f = fract(p);
    float a = hash(i), b = hash(i + vec2(1.0, 0.0));
    float c = hash(i + vec2(0.0, 1.0)), d = hash(i + vec2(1.0, 1.0));
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
  }

  void main() {
    float r   = length(vPos);
    float t   = clamp((r - uInner) / (uOuter - uInner), 0.0, 1.0);
    float ang = atan(vPos.y, vPos.x);

    // differential rotation — inner material orbits faster
    float speed = 1.6 / (0.35 + t);
    float swirl = ang + uTime * speed * 0.18;

    // turbulent spiral banding
    float n = noise(vec2(swirl * 2.0, r * 1.4)) * 0.6
            + noise(vec2(swirl * 5.0, r * 4.0)) * 0.4;
    float bright = smoothstep(0.15, 0.95, n);

    // temperature gradient: hot inner -> cool outer
    vec3 hot  = vec3(1.00, 0.96, 0.90);
    vec3 mid  = vec3(1.00, 0.55, 0.16);
    vec3 cool = vec3(0.60, 0.12, 0.04);
    vec3 col  = mix(hot, mid, smoothstep(0.0, 0.4, t));
    col       = mix(col, cool, smoothstep(0.4, 1.0, t));

    float falloff = mix(1.7, 0.28, t);              // inner brighter
    float doppler = 0.65 + 0.6 * cos(ang - 1.1);    // relativistic beaming (fixed side)
    float intensity = bright * falloff * doppler;

    float edge = smoothstep(0.0, 0.07, t) * (1.0 - smoothstep(0.86, 1.0, t));
    float alpha = edge * clamp(intensity, 0.0, 1.0);
    gl_FragColor = vec4(col * intensity, alpha);
  }
`

// ── Lensed black hole — ray-marched null geodesics on a camera-facing quad ─────
// Each fragment shoots its true camera ray past the hole and integrates the
// Schwarzschild bending equation (d²x/dλ² = -3/2 h² x / r⁵), accumulating disk
// emission at every crossing of the disk plane. This produces the "recent
// realistic render" look: the far side of the accretion disk lenses into arcs
// above and below the shadow, a photon ring hugs the silhouette, and Doppler
// beaming brightens the approaching side — all view-dependent, so the image
// responds correctly as the battle camera orbits. Additive: the black shadow
// itself is occluded by a separate opaque sphere at the capture radius.
export const LENSED_BH_VERT = /* glsl */`
  varying vec3 vWorld;
  void main() {
    vWorld = (modelMatrix * vec4(position, 1.0)).xyz;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`
export const LENSED_BH_FRAG = /* glsl */`
  precision highp float;
  uniform float uTime;
  uniform vec3  uCenter;    // hole position (world)
  uniform vec3  uDiskN;     // accretion-disk plane normal (world, unit)
  uniform float uRs;        // Schwarzschild radius (world units)
  uniform float uDiskIn;    // disk inner radius
  uniform float uDiskOut;   // disk outer radius
  varying vec3 vWorld;

  float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float noise(vec2 p){
    vec2 i = floor(p), f = fract(p);
    float a = hash(i), b = hash(i + vec2(1.0, 0.0));
    float c = hash(i + vec2(0.0, 1.0)), d = hash(i + vec2(1.0, 1.0));
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
  }

  // emission where a bent ray crosses the disk plane (hit is centre-relative)
  vec4 diskEmission(vec3 hit, vec3 rd, vec3 T1, vec3 T2){
    float hr = length(hit);
    float t = clamp((hr - uDiskIn) / (uDiskOut - uDiskIn), 0.0, 1.0);
    float ang = atan(dot(hit, T2), dot(hit, T1));
    float swirl = ang + uTime * 0.22 * (1.6 / (0.35 + t));   // differential rotation
    float n = noise(vec2(swirl * 2.0, hr * 0.55)) * 0.6
            + noise(vec2(swirl * 5.0, hr * 1.5)) * 0.4;
    float bright = 0.35 + 0.75 * smoothstep(0.12, 0.95, n);
    // temperature gradient: white-hot inner edge -> deep orange rim
    vec3 col = mix(vec3(1.00, 0.97, 0.92), vec3(1.00, 0.60, 0.20), smoothstep(0.0, 0.42, t));
    col      = mix(col, vec3(0.55, 0.16, 0.05), smoothstep(0.42, 1.0, t));
    float falloff = mix(2.1, 0.26, sqrt(t));
    // relativistic beaming: matter orbits along the disk tangent; the side coming
    // toward the camera is boosted and blue-shifted, the receding side dimmed
    vec3 tangent = normalize(cross(uDiskN, hit));
    float beta = clamp(sqrt(uRs / max(2.0 * hr, uRs)), 0.05, 0.6);
    float g = 1.0 / max(1.0 - beta * dot(tangent, -rd), 0.30);
    col *= mix(vec3(1.0), vec3(0.82, 0.90, 1.12), clamp((g - 1.0) * 1.4, 0.0, 1.0));
    float inten = bright * falloff * min(g * g * g, 4.5);
    float edge = smoothstep(0.0, 0.10, t) * (1.0 - smoothstep(0.78, 1.0, t));
    return vec4(col * inten * edge, edge * clamp(inten * 0.8, 0.0, 1.0));
  }

  void main(){
    vec3 rd = normalize(vWorld - cameraPosition);
    vec3 ro = cameraPosition - uCenter;
    // disk-plane basis for the swirl angle
    vec3 T1 = normalize(cross(uDiskN, abs(uDiskN.y) < 0.95 ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0)));
    vec3 T2 = cross(uDiskN, T1);

    // jump straight to the strong-field region, march through, stop when clear
    float span = uDiskOut * 1.7;
    float t0 = max(0.0, dot(-ro, rd) - span);
    vec3 p = ro + rd * t0;
    vec3 v = rd;
    vec3 L = cross(p, v);
    float h2 = dot(L, L);          // conserved angular momentum² (|v| = 1)
    float b = sqrt(h2);            // impact parameter

    vec3 acc = vec3(0.0);
    float trans = 1.0;
    for (int i = 0; i < 110; i++){
      float r2 = dot(p, p); float r = sqrt(r2);
      if (r < uRs) break;                                   // captured
      if (r > span * 1.9 && dot(p, v) > 0.0) break;         // escaped, heading out
      float dt = clamp(r * 0.12, 0.35, 6.0);                // fine steps near the hole
      v += (-1.5 * h2 / (r2 * r2 * r)) * p * dt;            // geodesic bending
      v = normalize(v);
      float sidePrev = dot(p, uDiskN);
      vec3 pPrev = p;
      p += v * dt;
      float side = dot(p, uDiskN);
      if (sidePrev * side < 0.0 && trans > 0.02) {          // crossed the disk plane
        vec3 hit = mix(pPrev, p, sidePrev / (sidePrev - side));
        float hr = length(hit);
        if (hr > uDiskIn && hr < uDiskOut) {
          vec4 e = diskEmission(hit, v, T1, T2);
          acc += e.rgb * trans;
          trans *= (1.0 - e.a * 0.85);
        }
      }
    }
    // photon ring — a thin hot halo where rays graze the capture radius (~2.6 rs)
    float ring = 0.6 * exp(-pow((b - 2.68 * uRs) / (0.34 * uRs), 2.0));
    acc += vec3(1.0, 0.88, 0.66) * ring;
    gl_FragColor = vec4(acc, 1.0);   // additive — pure light on top of the scene
  }
`

// ── Fresnel rim — photon-ring glow hugging the event-horizon silhouette ────────
export const RIM_VERT = /* glsl */`
  varying vec3 vN;
  varying vec3 vView;
  void main() {
    vN = normalize(normalMatrix * normal);
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vView = normalize(-mv.xyz);
    gl_Position = projectionMatrix * mv;
  }
`
export const RIM_FRAG = /* glsl */`
  precision highp float;
  uniform vec3 uColor;
  uniform float uPower;
  varying vec3 vN;
  varying vec3 vView;
  void main() {
    float f = pow(1.0 - max(dot(vN, vView), 0.0), uPower);
    gl_FragColor = vec4(uColor * f, f);
  }
`
