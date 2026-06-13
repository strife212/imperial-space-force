import { useRef, useEffect } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js'

// ── Geometry radii (in event-horizon units) ───────────────────────────────────
const R_HORIZON = 1.35   // black "shadow" sphere — the dominant central feature
const R_PHOTON  = 1.42   // thin bright rim hugging the silhouette (photon ring)
const R_ISCO    = 3.0
const R_DISK_IN = 2.9
const R_DISK_OUT= 6.2
const R_ERGO    = 1.7
const JET_LEN   = 5.4

// anchor helper: point on the equatorial (XZ) plane at angle `deg`, radius `rad`
const A = (deg, rad, y = 0) => {
  const a = (deg * Math.PI) / 180
  return new THREE.Vector3(Math.cos(a) * rad, y, Math.sin(a) * rad)
}

// Labelled features. `dir` is the preferred screen-space push direction so the
// labels splay out around the edges with leader lines pointing back inward.
const LABELS = [
  { id: 'sing',   title: 'SINGULARITY',      sub: 'r = 0 // curvature ∞',     anchor: new THREE.Vector3(0, 0, 0), dir: [0.15, 1] },
  { id: 'eh',     title: 'EVENT HORIZON',    sub: 'Schwarzschild radius rₛ',  anchor: A(205, R_HORIZON),          dir: [-1, 0.45] },
  { id: 'ergo',   title: 'ERGOSPHERE',       sub: 'frame-dragging region',    anchor: A(250, R_ERGO, 0.05),       dir: [-1, -0.25] },
  { id: 'photon', title: 'PHOTON SPHERE',    sub: 'r = 1.5 rₛ // light orbit', anchor: A(150, R_PHOTON),          dir: [-0.8, -1] },
  { id: 'isco',   title: 'ISCO',             sub: 'innermost stable orbit',   anchor: A(325, R_ISCO),             dir: [1, 0.6] },
  { id: 'disk',   title: 'ACCRETION DISK',   sub: 'superheated plasma',       anchor: A(38, R_DISK_OUT * 0.72),   dir: [1, -0.25] },
  { id: 'jet',    title: 'RELATIVISTIC JET', sub: 'collimated polar outflow', anchor: new THREE.Vector3(0, JET_LEN, 0), dir: [0.1, -1] },
]

// ── Accretion-disk shader ──────────────────────────────────────────────────────
const DISK_VERT = /* glsl */`
  varying vec2 vPos;
  void main() {
    vPos = position.xy;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`
const DISK_FRAG = /* glsl */`
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

// ── Fresnel rim (photon-ring glow around the silhouette) ───────────────────────
const RIM_VERT = /* glsl */`
  varying vec3 vN;
  varying vec3 vView;
  void main() {
    vN = normalize(normalMatrix * normal);
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vView = normalize(-mv.xyz);
    gl_Position = projectionMatrix * mv;
  }
`
const RIM_FRAG = /* glsl */`
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

export default function BlackHoleScreen({ onReturn }) {
  const mountRef  = useRef(null)
  const labelRefs = useRef([])
  const lineRefs  = useRef([])

  useEffect(() => {
    const mount = mountRef.current
    if (!mount) return
    let renderer, composer, raf
    const disposables = []

    try {
      const w = mount.clientWidth, h = mount.clientHeight

      const scene = new THREE.Scene()
      const camera = new THREE.PerspectiveCamera(50, w / h, 0.1, 1000)
      camera.position.set(0, 3.4, 9.5)

      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
      renderer.setSize(w, h)
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
      mount.appendChild(renderer.domElement)

      const controls = new OrbitControls(camera, renderer.domElement)
      controls.enableDamping = true
      controls.dampingFactor = 0.06
      controls.enablePan = false
      controls.minDistance = 5
      controls.maxDistance = 22
      controls.autoRotate = true
      controls.autoRotateSpeed = 0.35
      controls.target.set(0, 0, 0)

      // ── Starfield ──────────────────────────────────────────────────────────
      const starCount = 1600
      const starPos = new Float32Array(starCount * 3)
      for (let i = 0; i < starCount; i++) {
        const rr = 60 + Math.random() * 120
        const th = Math.random() * Math.PI * 2
        const ph = Math.acos(2 * Math.random() - 1)
        starPos[i * 3]     = rr * Math.sin(ph) * Math.cos(th)
        starPos[i * 3 + 1] = rr * Math.sin(ph) * Math.sin(th)
        starPos[i * 3 + 2] = rr * Math.cos(ph)
      }
      const starGeo = new THREE.BufferGeometry()
      starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3))
      const starMat = new THREE.PointsMaterial({ color: 0x9fc4ff, size: 0.35, sizeAttenuation: true, transparent: true, opacity: 0.85 })
      scene.add(new THREE.Points(starGeo, starMat))
      disposables.push(starGeo, starMat)

      // ── Event horizon (black sphere) ─────────────────────────────────────────
      const ehGeo = new THREE.SphereGeometry(R_HORIZON, 64, 64)
      const ehMat = new THREE.MeshBasicMaterial({ color: 0x000000 })
      scene.add(new THREE.Mesh(ehGeo, ehMat))
      disposables.push(ehGeo, ehMat)

      // ── Photon ring (fresnel rim glow just outside the horizon) ──────────────
      const rimGeo = new THREE.SphereGeometry(R_PHOTON, 64, 64)
      const rimMat = new THREE.ShaderMaterial({
        vertexShader: RIM_VERT, fragmentShader: RIM_FRAG,
        uniforms: { uColor: { value: new THREE.Color(0xacdcff) }, uPower: { value: 5.0 } },
        transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.FrontSide,
      })
      scene.add(new THREE.Mesh(rimGeo, rimMat))
      disposables.push(rimGeo, rimMat)

      // ── Ergosphere (faint oblate wireframe) ──────────────────────────────────
      const ergoGeo = new THREE.SphereGeometry(R_ERGO, 22, 14)
      const ergoMat = new THREE.MeshBasicMaterial({ color: 0x244f96, wireframe: true, transparent: true, opacity: 0.09 })
      const ergo = new THREE.Mesh(ergoGeo, ergoMat)
      ergo.scale.set(1.0, 0.7, 1.0)    // flattened at the poles
      scene.add(ergo)
      disposables.push(ergoGeo, ergoMat)

      // ── Accretion disk ───────────────────────────────────────────────────────
      const diskGeo = new THREE.RingGeometry(R_DISK_IN, R_DISK_OUT, 220, 12)
      const diskMat = new THREE.ShaderMaterial({
        vertexShader: DISK_VERT, fragmentShader: DISK_FRAG,
        uniforms: { uTime: { value: 0 }, uInner: { value: R_DISK_IN }, uOuter: { value: R_DISK_OUT } },
        transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
      })
      const disk = new THREE.Mesh(diskGeo, diskMat)
      disk.rotation.x = -Math.PI / 2          // lay flat in the XZ plane
      scene.add(disk)
      disposables.push(diskGeo, diskMat)

      // ── Relativistic jets (faint flared cones along the spin axis) ───────────
      const jetMat = new THREE.MeshBasicMaterial({ color: 0x6fb0ff, transparent: true, opacity: 0.06, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })
      disposables.push(jetMat)
      for (const sign of [1, -1]) {
        const jGeo = new THREE.ConeGeometry(0.55, JET_LEN, 28, 1, true)
        const jet = new THREE.Mesh(jGeo, jetMat)
        jet.position.y = sign * JET_LEN / 2
        if (sign === 1) jet.rotation.x = Math.PI   // apex toward the centre
        scene.add(jet)
        disposables.push(jGeo)
      }

      // ── Post-processing bloom ────────────────────────────────────────────────
      composer = new EffectComposer(renderer)
      composer.addPass(new RenderPass(scene, camera))
      const bloom = new UnrealBloomPass(new THREE.Vector2(w, h), 1.1, 0.5, 0.12)
      composer.addPass(bloom)

      // ── Label projection ─────────────────────────────────────────────────────
      const v = new THREE.Vector3()
      const updateLabels = () => {
        const rect = renderer.domElement.getBoundingClientRect()
        const cw = rect.width, ch = rect.height
        const off = Math.min(cw, ch) * 0.17
        LABELS.forEach((L, i) => {
          const el = labelRefs.current[i]
          const ln = lineRefs.current[i]
          if (!el || !ln) return
          v.copy(L.anchor).project(camera)
          const behind = v.z > 1
          const ax = (v.x * 0.5 + 0.5) * cw
          const ay = (-v.y * 0.5 + 0.5) * ch
          const dl = Math.hypot(L.dir[0], L.dir[1]) || 1
          const lx = ax + (L.dir[0] / dl) * off
          const ly = ay + (L.dir[1] / dl) * off
          el.style.opacity = behind ? '0' : '1'
          el.style.transform = `translate(-50%, -50%) translate(${lx}px, ${ly}px)`
          ln.setAttribute('x1', lx); ln.setAttribute('y1', ly)
          ln.setAttribute('x2', ax); ln.setAttribute('y2', ay)
          ln.style.opacity = behind ? '0' : '0.55'
        })
      }

      const clock = new THREE.Clock()
      const loop = () => {
        diskMat.uniforms.uTime.value = clock.getElapsedTime()
        controls.update()
        composer.render()
        updateLabels()
        raf = requestAnimationFrame(loop)
      }
      loop()

      const onResize = () => {
        const nw = mount.clientWidth, nh = mount.clientHeight
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
        composer.dispose && composer.dispose()
        renderer.dispose()
        if (renderer.domElement.parentNode) renderer.domElement.parentNode.removeChild(renderer.domElement)
      }
    } catch (err) {
      // WebGL unavailable — leave the canvas area empty; the header/labels still show
      console.error('Black hole visualiser failed to initialise:', err)
      if (renderer) { try { renderer.dispose() } catch (_) {} }
    }
  }, [])

  return (
    <div id="blackhole-screen">
      <header className="bh-header">
        <div className="bh-title">⬢ GRAVITATIONAL SINGULARITY // SCHEMATIC</div>
        <div className="bh-subtitle">KERR–NEWMAN BODY // GR-CORRECTED RENDER</div>
        <button className="bh-back" onClick={onReturn}>← RETURN</button>
      </header>

      <div className="bh-stage">
        <div className="bh-canvas" ref={mountRef} />
        <svg className="bh-lines" preserveAspectRatio="none">
          {LABELS.map((L, i) => (
            <line key={L.id} ref={el => (lineRefs.current[i] = el)} className="bh-line" />
          ))}
        </svg>
        {LABELS.map((L, i) => (
          <div key={L.id} className="bh-label" ref={el => (labelRefs.current[i] = el)}>
            <div className="bh-label-title">{L.title}</div>
            <div className="bh-label-sub">{L.sub}</div>
          </div>
        ))}
      </div>

      <div className="bh-hint">DRAG TO ORBIT // SCROLL TO ZOOM</div>
    </div>
  )
}
