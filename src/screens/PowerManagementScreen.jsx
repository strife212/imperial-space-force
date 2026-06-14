import { useRef, useEffect } from 'react'
import * as THREE from 'three'
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js'
import HudHeader from '../components/HudHeader'
import HudFooter from '../components/HudFooter'

// ── Shared shaders (compact copies of the full reactor / black-hole screens) ───
const PLASMA_VERT = /* glsl */`
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`
const PLASMA_FRAG = /* glsl */`
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
    float tor = vUv.x, pol = vUv.y;
    float swirl = tor + uTime * 0.04;
    float n = noise(vec2(swirl * 70.0, pol * 11.0)) * 0.6
            + noise(vec2(swirl * 150.0, pol * 24.0)) * 0.4;
    float fil = smoothstep(0.38, 0.98, n);
    vec3 cool = vec3(1.0, 0.28, 0.70);
    vec3 hot  = vec3(1.0, 0.62, 0.88);
    vec3 col  = mix(cool, hot, clamp(uPlasma, 0.0, 1.0));
    float intensity = (0.16 + 0.42 * fil) * uPlasma;
    gl_FragColor = vec4(col * intensity, clamp(intensity, 0.0, 1.0));
  }
`

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
    float speed = 1.6 / (0.35 + t);
    float swirl = ang + uTime * speed * 0.18;
    float n = noise(vec2(swirl * 2.0, r * 1.4)) * 0.6
            + noise(vec2(swirl * 5.0, r * 4.0)) * 0.4;
    float bright = smoothstep(0.15, 0.95, n);
    vec3 hot  = vec3(1.00, 0.96, 0.90);
    vec3 mid  = vec3(1.00, 0.55, 0.16);
    vec3 cool = vec3(0.60, 0.12, 0.04);
    vec3 col  = mix(hot, mid, smoothstep(0.0, 0.4, t));
    col       = mix(col, cool, smoothstep(0.4, 1.0, t));
    float falloff = mix(1.7, 0.28, t);
    float doppler = 0.65 + 0.6 * cos(ang - 1.1);
    float intensity = bright * falloff * doppler;
    float edge = smoothstep(0.0, 0.07, t) * (1.0 - smoothstep(0.86, 1.0, t));
    float alpha = edge * clamp(intensity, 0.0, 1.0);
    gl_FragColor = vec4(col * intensity, alpha);
  }
`

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

// ── Tiny renderer harness shared by both viewports ─────────────────────────────
function useViewport(buildScene) {
  const canvasRef = useRef(null)
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    let renderer, composer, raf
    const disposables = []
    try {
      const w = canvas.clientWidth || 1, h = canvas.clientHeight || 1
      const scene = new THREE.Scene()
      const camera = new THREE.PerspectiveCamera(45, w / h, 0.1, 100)

      renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true })
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
      renderer.setSize(w, h, false)
      renderer.setClearColor(0x000000, 0)

      composer = new EffectComposer(renderer)
      composer.addPass(new RenderPass(scene, camera))

      const clock = new THREE.Clock()
      const tick = buildScene({ scene, camera, composer, disposables, w, h })

      const frame = () => {
        tick(clock.getElapsedTime())
        composer.render()
        raf = requestAnimationFrame(frame)
      }
      frame()

      const onResize = () => {
        const nw = canvas.clientWidth, nh = canvas.clientHeight
        if (!nw || !nh) return
        camera.aspect = nw / nh
        camera.updateProjectionMatrix()
        renderer.setSize(nw, nh, false)
        composer.setSize(nw, nh)
      }
      const ro = new ResizeObserver(onResize)
      ro.observe(canvas)

      return () => {
        cancelAnimationFrame(raf)
        ro.disconnect()
        disposables.forEach(o => o.dispose && o.dispose())
        composer.dispose && composer.dispose()
        renderer.dispose()
      }
    } catch (err) {
      console.error('Power-management viewport failed to initialise:', err)
      if (renderer) { try { renderer.dispose() } catch (_) {} }
    }
  }, [])
  return canvasRef
}

// ── Stage 1 — fusion reactor torus ─────────────────────────────────────────────
function ReactorMini({ plasma = 0.72 }) {
  const ref = useViewport(({ scene, camera, composer, disposables, w, h }) => {
    camera.position.set(2.47, 1.39, 2.61)
    camera.lookAt(0, 0, 0)

    const tilt = new THREE.Group()
    tilt.rotation.x = -1.0
    scene.add(tilt)
    const spin = new THREE.Group()
    tilt.add(spin)

    scene.add(new THREE.AmbientLight(0x33507f, 0.7))
    const key = new THREE.DirectionalLight(0xbcd4ff, 0.9)
    key.position.set(2, 3, 4)
    scene.add(key)
    const coreLight = new THREE.PointLight(0xff5bb0, plasma * 2.4, 8, 2)
    scene.add(coreLight)

    const R_MAJ = 1.0, R_TUBE = 0.34, COIL_MAJ = 0.46, NUM_COILS = 16
    const coilGeo = new THREE.TorusGeometry(COIL_MAJ, 0.045, 10, 40)
    const coilMat = new THREE.MeshStandardMaterial({ color: 0x1b3f8c, metalness: 0.85, roughness: 0.35, emissive: 0x07142e })
    disposables.push(coilGeo, coilMat)
    const zAxis = new THREE.Vector3(0, 0, 1)
    for (let i = 0; i < NUM_COILS; i++) {
      const u = (i / NUM_COILS) * Math.PI * 2
      const coil = new THREE.Mesh(coilGeo, coilMat)
      coil.position.set(R_MAJ * Math.cos(u), R_MAJ * Math.sin(u), 0)
      coil.quaternion.setFromUnitVectors(zAxis, new THREE.Vector3(-Math.sin(u), Math.cos(u), 0))
      spin.add(coil)
    }

    const shellGeo = new THREE.TorusGeometry(R_MAJ, R_TUBE * 1.7, 12, 80)
    const shellMat = new THREE.MeshBasicMaterial({ color: 0x12356f, wireframe: true, transparent: true, opacity: 0.12 })
    spin.add(new THREE.Mesh(shellGeo, shellMat))
    disposables.push(shellGeo, shellMat)

    const plasmaGeo = new THREE.TorusGeometry(R_MAJ, R_TUBE, 28, 200)
    const plasmaMat = new THREE.ShaderMaterial({
      vertexShader: PLASMA_VERT, fragmentShader: PLASMA_FRAG,
      uniforms: { uTime: { value: 0 }, uPlasma: { value: plasma } },
      transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
    })
    spin.add(new THREE.Mesh(plasmaGeo, plasmaMat))
    disposables.push(plasmaGeo, plasmaMat)

    const coreGeo = new THREE.TorusGeometry(R_MAJ, R_TUBE * 0.42, 16, 160)
    const coreMat = new THREE.MeshBasicMaterial({ color: 0xffc8e8, transparent: true, opacity: plasma * 0.22, blending: THREE.AdditiveBlending, depthWrite: false })
    spin.add(new THREE.Mesh(coreGeo, coreMat))
    disposables.push(coreGeo, coreMat)

    composer.addPass(new UnrealBloomPass(new THREE.Vector2(w, h), 0.7, 0.5, 0.2))

    return (t) => {
      spin.rotation.z += 0.006
      plasmaMat.uniforms.uTime.value = t
    }
  })
  return <canvas className="pm-canvas" ref={ref} />
}

// ── Stage 2 — black hole energy extraction ─────────────────────────────────────
function BlackHoleMini() {
  const ref = useViewport(({ scene, camera, composer, disposables, w, h }) => {
    camera.position.set(0, 3.0, 9.0)
    camera.lookAt(0, 0, 0)

    const R_HORIZON = 1.35, R_PHOTON = 1.42, R_DISK_IN = 2.9, R_DISK_OUT = 6.2

    const ehGeo = new THREE.SphereGeometry(R_HORIZON, 48, 48)
    const ehMat = new THREE.MeshBasicMaterial({ color: 0x000000 })
    const spin = new THREE.Group()
    scene.add(spin)
    spin.add(new THREE.Mesh(ehGeo, ehMat))
    disposables.push(ehGeo, ehMat)

    const rimGeo = new THREE.SphereGeometry(R_PHOTON, 48, 48)
    const rimMat = new THREE.ShaderMaterial({
      vertexShader: RIM_VERT, fragmentShader: RIM_FRAG,
      uniforms: { uColor: { value: new THREE.Color(0xacdcff) }, uPower: { value: 5.0 } },
      transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
    })
    spin.add(new THREE.Mesh(rimGeo, rimMat))
    disposables.push(rimGeo, rimMat)

    const diskGeo = new THREE.RingGeometry(R_DISK_IN, R_DISK_OUT, 200, 10)
    const diskMat = new THREE.ShaderMaterial({
      vertexShader: DISK_VERT, fragmentShader: DISK_FRAG,
      uniforms: { uTime: { value: 0 }, uInner: { value: R_DISK_IN }, uOuter: { value: R_DISK_OUT } },
      transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
    })
    const disk = new THREE.Mesh(diskGeo, diskMat)
    disk.rotation.x = -Math.PI / 2
    spin.add(disk)
    disposables.push(diskGeo, diskMat)

    composer.addPass(new UnrealBloomPass(new THREE.Vector2(w, h), 1.1, 0.5, 0.12))

    return (t) => {
      spin.rotation.y = t * 0.18
      diskMat.uniforms.uTime.value = t
    }
  })
  return <canvas className="pm-canvas" ref={ref} />
}

// ── Component ──────────────────────────────────────────────────────────────────
export default function PowerManagementScreen({ onReactor, onBlackHole, onReturn, reactorPlasma = 0, bhOutput = 0, bhYield = 0, unreadCount = 0, onMailOpen }) {
  const reactorOnline = reactorPlasma >= 25
  const plasmaGlow = Math.max(reactorPlasma, 62) / 100   // always renders a healthy glow
  // Mirror the reactor screen's CORE FLUX telemetry: flux = 0.35 + density·3.85 GW
  const coreFlux = Math.max(0, 0.35 + (reactorPlasma / 100) * 3.85)
  const bhActive = bhOutput > 0.05

  return (
    <div id="power-mgmt-screen">
      <HudHeader
        onLogout={onReturn}
        center={
          <span className={`status-pill mail-pill${unreadCount > 0 ? ' mail-pill--unread' : ''}`} onClick={onMailOpen}>
            {unreadCount > 0 && <span className="mail-unread-dot" />}
            ✉ IMPERIAL MESSAGING SERVICE // UNREAD: {unreadCount}
          </span>
        }
        right={<span className="label">PNL-009 / POWER MANAGEMENT BUS</span>}
      />

      <header className="pm-header">
        <div className="pm-title">⬢ POWER MANAGEMENT // PRIMARY BUS</div>
        <div className="pm-subtitle">TWO-STAGE IGNITION SEQUENCE // SELECT SUBSYSTEM</div>
        <button className="pm-back" onClick={onReturn}>← RETURN</button>
      </header>

      <main className="pm-body">
        <button className="pm-stage" onClick={onReactor}>
          <div className="pm-stage-head">
            <span className="pm-stage-num">POWER STAGE 1</span>
            <span className="pm-stage-name">FUSION REACTOR</span>
          </div>
          <div className="pm-viewport">
            <ReactorMini plasma={plasmaGlow} />
            <span className={`pm-status-badge${reactorOnline ? ' pm-status-badge--on' : ''}`}>
              {reactorOnline ? 'ONLINE' : 'OFFLINE'}
            </span>
          </div>
          <div className="pm-readout">
            <div className="pm-ro-cell">
              <span className="pm-ro-label">CORE FLUX</span>
              <span className="pm-ro-val">{coreFlux.toFixed(3)}<span className="pm-ro-unit"> GW</span></span>
            </div>
            <div className="pm-ro-cell">
              <span className="pm-ro-label">PLASMA DENSITY</span>
              <span className="pm-ro-val">{reactorPlasma}<span className="pm-ro-unit"> %</span></span>
            </div>
          </div>
          <div className="pm-stage-foot">
            <span className={`pm-stage-status${reactorOnline ? ' pm-status--online' : ''}`}>
              {reactorOnline ? '● REACTOR ONLINE' : '○ STANDBY'}
            </span>
            <span className="pm-stage-go">CONFIGURE →</span>
          </div>
        </button>

        <div className="pm-arrow" aria-hidden="true">
          <span className="pm-arrow-glyph">→</span>
          <span className="pm-arrow-label">CASCADE</span>
        </div>

        <button
          className={`pm-stage${reactorOnline ? '' : ' pm-stage--locked'}`}
          onClick={onBlackHole}
          disabled={!reactorOnline}
        >
          <div className="pm-stage-head">
            <span className="pm-stage-num">POWER STAGE 2</span>
            <span className="pm-stage-name">BLACK HOLE ENERGY EXTRACTION</span>
          </div>
          <div className="pm-viewport">
            <BlackHoleMini />
            {!reactorOnline && (
              <div className="pm-locked-overlay">
                <span className="pm-locked-text">[STAGE ONE POWER OFFLINE]</span>
              </div>
            )}
            <span className={`pm-status-badge${bhActive ? ' pm-status-badge--on' : ''}`}>
              {bhActive ? 'ONLINE' : 'OFFLINE'}
            </span>
          </div>
          <div className="pm-readout">
            <div className="pm-ro-cell">
              <span className="pm-ro-label">OUTPUT</span>
              <span className="pm-ro-val">{bhOutput.toFixed(2)}<span className="pm-ro-unit"> PW</span></span>
            </div>
            <div className="pm-ro-cell">
              <span className="pm-ro-label">CUMULATIVE YIELD</span>
              <span className="pm-ro-val">{bhYield.toFixed(1)}<span className="pm-ro-unit"> PJ</span></span>
            </div>
          </div>
          <div className="pm-stage-foot">
            <span className={`pm-stage-status${bhActive ? ' pm-status--online' : ''}`}>
              {bhActive ? '● ERGOSPHERE TAP ACTIVE' : '○ ERGOSPHERE TAP OFFLINE'}
            </span>
            <span className="pm-stage-go">CONFIGURE →</span>
          </div>
        </button>
      </main>

      <div className="pm-hint">SELECT A STAGE TO CONFIGURE ITS SUBSYSTEM</div>

      <HudFooter>
        <span>HMSS / FCS v6.2.41 / POWER DISTRIBUTION BUS</span>
        <span className="sep">│</span>
        <span>STAGE 1: <em className={reactorOnline ? 'ok' : 'warn'}>{reactorOnline ? 'ONLINE' : 'STANDBY'}</em></span>
        <span className="sep">│</span>
        <span>STAGE 2: <em className={bhActive ? 'ok' : 'warn'}>{bhActive ? 'ONLINE' : 'OFFLINE'}</em></span>
        <span className="sep">│</span>
        <span>PRIMARY BUS: <em className="ok">NOMINAL</em></span>
      </HudFooter>
    </div>
  )
}
