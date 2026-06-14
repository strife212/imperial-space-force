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
