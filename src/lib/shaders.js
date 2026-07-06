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

// ── Spiral galaxy — ray-marched disc volume on a camera-facing quad ────────────
// Same trick as the lensed black hole: each fragment marches its true camera ray,
// here through a flattened galactic disc — log-spiral arms, clumpy interstellar
// medium, dust lanes, a spheroidal bulge — so the galaxy reads correctly from any
// angle (face-on spiral, edge-on a thin blade split by its dust lane). Every look
// parameter is a uniform so it can be retuned live without a rebuild.
export const GALAXY_VERT = LENSED_BH_VERT
export const GALAXY_FRAG = /* glsl */`
  precision highp float;
  uniform float uTime;      // pattern rotation phase (pre-integrated with spin speed)
  uniform vec3  uCenter;    // galaxy centre (world)
  uniform vec3  uPlaneN;    // disc plane normal (world, unit)
  uniform float uRadius;    // disc radius (world units)
  uniform float uThick;     // disc half-thickness as a fraction of radius
  uniform float uArms;      // spiral arm count — keep integer-valued: the arm wave
                            // is evaluated across the atan branch cut
  uniform float uTwist;     // arm winding; sign sets handedness, 0 = radial spokes
  uniform float uBulge;     // central bulge radius as a fraction of radius
  uniform float uDust;      // dust-lane absorption strength
  uniform float uGlow;      // overall emission multiplier
  uniform vec3  uCoreCol;   // old-star bulge colour
  uniform vec3  uArmCol;    // young-star arm colour
  uniform vec3  uDustCol;   // dust tint (lanes absorb its complement)
  varying vec3 vWorld;

  float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float noise(vec2 p){
    vec2 i = floor(p), f = fract(p);
    float a = hash(i), b = hash(i + vec2(1.0, 0.0));
    float c = hash(i + vec2(0.0, 1.0)), d = hash(i + vec2(1.0, 1.0));
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
  }
  float fbm(vec2 p){
    return noise(p) * 0.5 + noise(p * 2.17 + 3.1) * 0.3 + noise(p * 4.31 + 7.7) * 0.2;
  }

  void main(){
    vec3 rd = normalize(vWorld - cameraPosition);
    vec3 ro = cameraPosition - uCenter;

    // entry/exit of the galaxy's bounding sphere
    float R = uRadius * 1.12;
    float bq = dot(-ro, rd);
    float det = bq * bq - dot(ro, ro) + R * R;
    if (det < 0.0) { gl_FragColor = vec4(0.0); return; }
    float sq = sqrt(det);
    float t0 = max(bq - sq, 0.0), t1 = bq + sq;
    if (t1 <= t0) { gl_FragColor = vec4(0.0); return; }

    // disc-plane basis
    vec3 T1 = normalize(cross(uPlaneN, abs(uPlaneN.y) < 0.95 ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0)));
    vec3 T2 = cross(uPlaneN, T1);

    float ds = (t1 - t0) / 60.0;
    // break slab-sampling banding into grain — interleaved gradient noise stays
    // uniform at large frag coords where the sin-based hash loses precision
    float jit = fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715)))) - 0.5;
    vec3 acc = vec3(0.0);
    vec3 trans = vec3(1.0);
    vec3 ext = clamp(vec3(1.05) - uDustCol, 0.0, 1.0);   // dust absorbs its complement

    for (int i = 0; i < 60; i++){
      vec3 p = ro + rd * (t0 + (float(i) + 0.5 + jit) * ds);
      float x = dot(p, T1), y = dot(p, T2), z = dot(p, uPlaneN);
      float rr = length(vec2(x, y));
      float r01 = rr / uRadius;
      if (r01 > 1.06) continue;

      // thin disc: vertical gaussian (flaring outward) × radial exponential
      float hz = uRadius * uThick * (0.30 + 0.80 * r01) + 1e-3;
      float vert = exp(-z * z / (hz * hz));
      float radial = exp(-r01 * 3.2) * (1.0 - smoothstep(0.86, 1.06, r01));

      // log-spiral arm wave, the whole pattern slowly rotating with uTime
      float th = atan(y, x) + uTime * 0.10;
      float w = uArms * th + uTwist * log(r01 + 0.045);
      float armWave = 0.5 + 0.5 * cos(w);
      float arm = 0.18 + 0.82 * pow(armWave, 2.6);
      arm = mix(1.0, arm, smoothstep(uBulge * 0.5, uBulge * 1.7, r01));   // arms fade into the bulge

      // clumpy interstellar medium, sheared by differential rotation
      float thN = th + uTime * 0.16 / (r01 + 0.3);
      vec2 pn = vec2(cos(thN), sin(thN)) * r01;
      float n = fbm(pn * 7.0 + 13.1);
      float clump = 0.45 + 0.9 * n;

      float disc = vert * radial * arm * clump;

      // flattened spheroidal bulge of old stars
      float qb = length(vec3(x, y, z * 2.4)) / (uRadius * uBulge + 1e-3);
      float bulge = exp(-qb * qb * 1.8);

      // warm core -> cool arms; young star clusters spark along the arm ridges
      vec3 col = mix(uCoreCol, uArmCol, smoothstep(0.08, 0.50, r01));
      float spark = smoothstep(0.80, 0.95, noise(pn * 26.0 + 4.7)) * max(arm - 0.3, 0.0) * vert * radial;
      vec3 em = col * disc + uCoreCol * bulge * 0.55 + (uArmCol * 0.6 + vec3(0.4)) * spark * 1.2;

      // dust lanes hugging the inner edge of each arm, pinched to the midplane
      float lane = smoothstep(0.25, 0.9, 0.5 + 0.5 * cos(w + 1.1))
                 * smoothstep(0.06, 0.18, r01) * (1.0 - smoothstep(0.72, 0.95, r01));
      float dust = uDust * lane * exp(-z * z / (hz * hz * 0.22)) * (0.5 + 0.8 * n);

      acc += em * trans * (ds * 0.62);
      trans *= exp(-dust * ext * (ds * 0.55));
    }

    // hue-preserving cap keeps the core from nuking the bloom pass
    acc *= uGlow;
    float mx = max(acc.r, max(acc.g, acc.b));
    if (mx > 2.4) acc *= 2.4 / mx;
    gl_FragColor = vec4(acc, 1.0);   // additive — pure light over the scene
  }
`

// ── Star — emissive photosphere: granulation, sunspots, limb darkening ─────────
// A main-sequence star as a sibling of the planet makers: the body shader paints
// convection granules, dark sunspot groups with bright faculae rims and real limb
// darkening; a camera-facing corona quad (below) adds streamers, and makeStar
// pairs them with a PointLight + prominence sprites for actual light emission.
export const STAR_VERT = /* glsl */`
  varying vec3 vPosL;
  varying vec3 vWN;
  varying vec3 vWPos;
  void main() {
    vPosL = position;
    vWN = normalize(mat3(modelMatrix) * normal);
    vWPos = (modelMatrix * vec4(position, 1.0)).xyz;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`
export const STAR_FRAG = /* glsl */`
  precision highp float;
  uniform float uTime;
  uniform vec3 uCol;    // chromosphere base (deep orange)
  uniform vec3 uHot;    // granule peaks (near white)
  varying vec3 vPosL;
  varying vec3 vWN;
  varying vec3 vWPos;

  float hash3(vec3 p){ return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
  float noise3(vec3 p){
    vec3 i = floor(p), f = fract(p);
    vec3 u = f * f * (3.0 - 2.0 * f);
    float a = hash3(i),                    b = hash3(i + vec3(1.0, 0.0, 0.0));
    float c = hash3(i + vec3(0.0, 1.0, 0.0)), d = hash3(i + vec3(1.0, 1.0, 0.0));
    float e = hash3(i + vec3(0.0, 0.0, 1.0)), f2 = hash3(i + vec3(1.0, 0.0, 1.0));
    float g = hash3(i + vec3(0.0, 1.0, 1.0)), h = hash3(i + vec3(1.0, 1.0, 1.0));
    return mix(mix(mix(a, b, u.x), mix(c, d, u.x), u.y),
               mix(mix(e, f2, u.x), mix(g, h, u.x), u.y), u.z);
  }
  float fbm3(vec3 p){
    return noise3(p) * 0.5 + noise3(p * 2.13 + 3.7) * 0.3 + noise3(p * 4.42 + 9.1) * 0.2;
  }

  void main(){
    vec3 p = normalize(vPosL);
    float ca = cos(uTime * 0.03), sa = sin(uTime * 0.03);   // slow stellar rotation
    p = vec3(ca * p.x + sa * p.z, p.y, -sa * p.x + ca * p.z);

    // convection: large slow cells + fine simmering granules
    float g1 = fbm3(p * 5.0 + vec3(0.0, uTime * 0.02, 0.0));
    float g2 = fbm3(p * 14.0 - vec3(uTime * 0.035));
    float gran = g1 * 0.62 + g2 * 0.38;
    float cells = smoothstep(0.30, 0.75, gran);

    // sunspot groups, ringed by bright faculae
    float sp = fbm3(p * 3.2 + vec3(7.7));
    float spot = smoothstep(0.66, 0.78, sp);
    float fac = smoothstep(0.58, 0.66, sp) * (1.0 - spot);

    vec3 vd = normalize(cameraPosition - vWPos);
    float mu = clamp(dot(normalize(vWN), vd), 0.0, 1.0);
    float limb = 0.35 + 0.65 * pow(mu, 0.7);   // limb darkening — stars dim at the edge

    vec3 col = mix(uCol * 0.72, uHot, cells * 0.75 + fac * 0.45);
    col *= (0.62 + 0.55 * gran);
    col = mix(col, uCol * 0.16, spot * 0.85);   // dark umbra
    col *= limb * 1.15;                          // it is a star — let it bloom
    float mx = max(col.r, max(col.g, col.b));
    if (mx > 1.7) col *= 1.7 / mx;
    gl_FragColor = vec4(col, 1.0);
  }
`
export const STAR_CORONA_VERT = /* glsl */`
  varying vec2 vLocal;
  void main() {
    vLocal = position.xy;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`
export const STAR_CORONA_FRAG = /* glsl */`
  precision highp float;
  uniform float uTime;
  uniform float uR;      // photosphere radius (quad-local units)
  uniform vec3 uCol;
  varying vec2 vLocal;

  float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float noise(vec2 p){
    vec2 i = floor(p), f = fract(p);
    float a = hash(i), b = hash(i + vec2(1.0, 0.0));
    float c = hash(i + vec2(0.0, 1.0)), d = hash(i + vec2(1.0, 1.0));
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
  }
  float fbm(vec2 p){
    return noise(p) * 0.5 + noise(p * 2.17 + 3.1) * 0.3 + noise(p * 4.31 + 7.7) * 0.2;
  }

  void main(){
    float r = length(vLocal) / uR;   // 1.0 = photosphere edge
    if (r < 0.98) { gl_FragColor = vec4(0.0); return; }   // the body draws itself
    float th = atan(vLocal.y, vLocal.x);
    vec2 dir = vec2(cos(th), sin(th));   // angle sampled through cos/sin — no branch cut
    float fil = fbm(dir * 3.1 + vec2(uTime * 0.05, -uTime * 0.04));
    float fil2 = fbm(dir * 6.4 - vec2(uTime * 0.03, 0.0));
    float streak = 0.45 + 0.55 * smoothstep(0.35, 0.85, fil * 0.6 + fil2 * 0.4);
    float fall = exp(-(r - 1.0) * (2.6 - 1.2 * streak));   // long streamers reach further
    float ring = exp(-abs(r - 1.02) * 22.0) * 0.9;         // thin chromosphere rim
    float edge = 1.0 - smoothstep(2.05, 2.5, r);           // die out before the quad edge
    vec3 col = uCol * (fall * 0.55 * streak + ring) * edge;
    gl_FragColor = vec4(col, 1.0);   // additive — pure light
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
