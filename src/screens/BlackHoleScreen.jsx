import { useRef, useEffect, useState } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js'
import HudHeader from '../components/HudHeader'
import HudFooter from '../components/HudFooter'
import { DISK_VERT, DISK_FRAG, RIM_VERT, RIM_FRAG } from '../lib/shaders'

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
  { id: 'sing',   title: 'SINGULARITY',      sub: 'r = 0 // curvature ∞',     anchor: new THREE.Vector3(0, 0, 0), dir: [0.15, 1],
    desc: 'The point at the core where the collapsed mass is compressed to infinite density and spacetime curvature diverges. The known laws of physics cease to predict here.' },
  { id: 'eh',     title: 'EVENT HORIZON',    sub: 'Schwarzschild radius rₛ',  anchor: A(205, R_HORIZON),          dir: [-1, 0.45],
    desc: 'The boundary of no return. Once matter or light crosses it, escape is impossible. Its radius (rₛ) is set entirely by the black hole’s mass.' },
  { id: 'ergo',   title: 'ERGOSPHERE',       sub: 'frame-dragging region',    anchor: A(250, R_ERGO, 0.05),       dir: [-1, -0.25],
    desc: 'A region just outside the horizon where the black hole’s spin drags spacetime itself, forcing everything to co-rotate. Rotational energy can be tapped here via the Penrose process.' },
  { id: 'photon', title: 'PHOTON SPHERE',    sub: 'r = 1.5 rₛ // light orbit', anchor: A(150, R_PHOTON),          dir: [-0.8, -1],
    desc: 'The radius (1.5 rₛ) where gravity bends light into unstable circular orbits. Photons here can loop the black hole before escaping or falling in.' },
  { id: 'isco',   title: 'ISCO',             sub: 'innermost stable orbit',   anchor: A(325, R_ISCO),             dir: [1, 0.6],
    desc: 'Innermost Stable Circular Orbit — the closest distance at which matter can orbit steadily. Inside it, no stable orbit exists and material plunges inward.' },
  { id: 'disk',   title: 'ACCRETION DISK',   sub: 'superheated plasma',       anchor: A(38, R_DISK_OUT * 0.72),   dir: [1, -0.25],
    desc: 'A flattened disk of infalling gas spiralling toward the horizon. Friction heats it to millions of kelvin, radiating intensely in X-rays.' },
  { id: 'jet',    title: 'RELATIVISTIC JET', sub: 'collimated polar outflow', anchor: new THREE.Vector3(0, JET_LEN, 0), dir: [0.1, -1],
    desc: 'Narrow beams of plasma fired along the spin axis at near light-speed, collimated and powered by the black hole’s twisted magnetic field and rotation.' },
]

export default function BlackHoleScreen({ onReturn, unreadCount = 0, onMailOpen, initialYield = 0, onPower }) {
  const mountRef  = useRef(null)
  const labelRefs = useRef([])
  const lineRefs  = useRef([])

  // ── Penrose-process energy extraction (right-hand panel) ──────────────────
  const [extracting, setExtracting] = useState(false)
  const [prog,     setProg]     = useState(0)   // 0 = payload raised, 1 = lowered into ergosphere
  const [pulse,    setPulse]    = useState(0)   // rising energy quantum, 0..1
  const [output,   setOutput]   = useState(0)             // current output, PW
  const [yieldVal, setYieldVal] = useState(initialYield)  // cumulative yield, PJ
  const progRef  = useRef(0)
  const pulseRef = useRef(0)
  const outRef   = useRef(0)
  const yieldRef = useRef(initialYield)
  const onPowerRef = useRef(onPower)
  useEffect(() => { onPowerRef.current = onPower }, [onPower])

  useEffect(() => {
    const id = setInterval(() => {
      // lower the payload while engaged, raise it back when disengaged
      progRef.current = Math.max(0, Math.min(1, progRef.current + (extracting ? 0.035 : -0.05)))
      const lowered = progRef.current
      // power is only drawn once the payload reaches the ergosphere
      const target = extracting ? lowered * (4.4 + (Math.random() - 0.5) * 0.5) : 0
      outRef.current += (target - outRef.current) * 0.18
      if (extracting && lowered > 0.5) {
        yieldRef.current += outRef.current * 0.08          // PW · 0.08s ≈ PJ
        pulseRef.current = (pulseRef.current + 0.05) % 1   // energy quantum climbs the tether
      } else {
        pulseRef.current = 0
      }
      setProg(progRef.current)
      setOutput(outRef.current)
      setYieldVal(yieldRef.current)
      setPulse(pulseRef.current)
      onPowerRef.current?.(outRef.current, yieldRef.current)
    }, 80)
    return () => clearInterval(id)
  }, [extracting])

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
          el.style.pointerEvents = behind ? 'none' : 'auto'
          // anchor side drives which way the tooltip opens (avoids running off-screen)
          el.classList.toggle('bh-label--right', ax > cw * 0.5)
          el.classList.toggle('bh-label--bottom', ay > ch * 0.62)
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

  // Penrose diagram geometry (SVG user units, viewBox 0 0 200 210)
  const payloadY     = 30 + prog * 86      // descends from anchor toward the ergosphere
  const pulseY       = 150 - pulse * 124   // extracted quantum climbs the tether
  const pulseVisible = extracting && prog > 0.5

  return (
    <div id="blackhole-screen">
      <HudHeader
        onLogout={onReturn}
        center={
          <span className={`status-pill mail-pill${unreadCount > 0 ? ' mail-pill--unread' : ''}`} onClick={onMailOpen}>
            {unreadCount > 0 && <span className="mail-unread-dot" />}
            ✉ IMPERIAL MESSAGING SERVICE // UNREAD: {unreadCount}
          </span>
        }
        right={<span className="label">OBS-014 / GRAVITATIONAL SURVEY</span>}
      />

      <header className="bh-header">
        <div className="bh-title">⬢ GRAVITATIONAL SINGULARITY // SCHEMATIC</div>
        <div className="bh-subtitle">KERR–NEWMAN BODY // GR-CORRECTED RENDER</div>
        <button className="bh-back" onClick={onReturn}>← RETURN</button>
      </header>

      <div className="bh-body">
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
              <div className="bh-tooltip">
                <div className="bh-tooltip-title">{L.title}</div>
                <div className="bh-tooltip-body">{L.desc}</div>
              </div>
            </div>
          ))}
          <div className="bh-hint">DRAG TO ORBIT // SCROLL TO ZOOM</div>
        </div>

        {/* ── Ergosphere energy-extraction panel ───────────────────────────── */}
        <aside className="ee-panel">
          <div className="ee-title">⬢ ERGOSPHERE ENERGY EXTRACTION</div>
          <div className="ee-sub">PENROSE PROCESS // ROTATIONAL ENERGY TAP</div>

          <p className="ee-text">
            A payload is lowered into the <em>ergosphere</em> — the region where
            frame-dragging forces all matter to co-rotate with the hole. There it is
            split: one fragment is dropped onto a <em>negative-energy</em> trajectory
            through the horizon, while the other is flung outward carrying
            <em> more energy than was input</em>. The surplus is drawn directly from
            the black hole's rotational energy.
          </p>

          <div className={`ee-diagram${extracting ? ' ee-active' : ''}`}>
            <svg viewBox="0 0 200 210" preserveAspectRatio="xMidYMid meet">
              {/* ergosphere (oblate) */}
              <ellipse cx="100" cy="150" rx="44" ry="30" className="ee-ergo" />
              {/* event horizon */}
              <circle cx="100" cy="150" r="24" className="ee-horizon" />
              <circle cx="100" cy="150" r="24" className="ee-horizon-rim" />
              {/* spin indicator */}
              <path d="M 70 150 A 30 30 0 0 1 130 150" className="ee-spin" />
              <polygon points="130,150 125,145 135,145" className="ee-spin-tip" />

              {/* tether anchor / station */}
              <rect x="84" y="14" width="32" height="9" rx="1.5" className="ee-anchor" />
              <line x1="100" y1="23" x2="100" y2={payloadY} className="ee-tether" />

              {/* extracted energy quantum rising up the tether */}
              {pulseVisible && (
                <circle cx="100" cy={pulseY} r="3.4" className="ee-quantum"
                        style={{ opacity: 0.25 + 0.75 * (1 - pulse) }} />
              )}

              {/* payload being lowered */}
              <g style={{ transform: `translateY(${payloadY - 30}px)` }} className="ee-payload-g">
                <rect x="93" y="24" width="14" height="12" rx="1.5" className="ee-payload" />
              </g>

              {/* captions */}
              <text x="100" y="200" className="ee-cap">ERGOSPHERE</text>
              <text x="100" y="11" className="ee-cap">TETHER ANCHOR</text>
            </svg>
          </div>

          <button
            className={`ee-btn${extracting ? ' ee-btn--active' : ''}`}
            onClick={() => setExtracting(v => !v)}
          >
            {extracting ? '■ DISENGAGE PROCESS' : '▶ ENGAGE PENROSE PROCESS'}
          </button>

          <div className="ee-readout">
            <div className="ee-readout-row">
              <span className="ee-ro-label">OUTPUT</span>
              <span className="ee-ro-val">{output.toFixed(2)}<span className="ee-ro-unit"> PW</span></span>
            </div>
            <div className="ee-bar"><div className="ee-bar-fill" style={{ width: `${Math.min(100, output / 5 * 100)}%` }} /></div>
            <div className="ee-readout-row">
              <span className="ee-ro-label">CUMULATIVE YIELD</span>
              <span className="ee-ro-val">{yieldVal.toFixed(1)}<span className="ee-ro-unit"> PJ</span></span>
            </div>
            <div className="ee-readout-row">
              <span className="ee-ro-label">STATUS</span>
              <span className={`ee-ro-status${extracting ? ' ee-ro-status--on' : ''}`}>
                {extracting ? (prog > 0.5 ? 'EXTRACTING' : 'LOWERING…') : 'STANDBY'}
              </span>
            </div>
          </div>
        </aside>
      </div>

      <HudFooter>
        <span>HMSS / OBS / DEEP FIELD SURVEY ARRAY</span>
        <span className="sep">│</span>
        <span>HORIZON: <em className="ok">STABLE</em></span>
        <span className="sep">│</span>
        <span>TIDAL SHEAR: <em className="ok">NOMINAL</em></span>
        <span className="sep">│</span>
        <span>SIGNAL LOCK: <em className="ok">ACQUIRED</em></span>
      </HudFooter>
    </div>
  )
}
