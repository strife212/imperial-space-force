import { useState, useEffect, useRef, useCallback } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js'
import HudHeader from '../../components/HudHeader'
import HudFooter from '../../components/HudFooter'
import { PLASMA_VERT, PLASMA_FRAG } from '../../lib/shaders'

// ── Tokamak geometry (world units) ─────────────────────────────────────────────
const R_MAJ    = 1.0    // major radius (centre of tube)
const R_TUBE   = 0.34   // plasma tube radius
const COIL_MAJ = 0.46   // TF-coil ring radius (encircles the tube)
const NUM_COILS = 16

// ── Circuit breaker data ──────────────────────────────────────────────────────
const BREAKERS = [
  { id: 'main',   label: 'MAIN CIRCUIT',  delay: 0   },
  { id: 'sec',    label: 'SECONDARY',     delay: 120  },
  { id: 'aux',    label: 'AUX POWER',     delay: 240  },
  { id: 'coil-a', label: 'FIELD COIL A', delay: 360  },
  { id: 'coil-b', label: 'FIELD COIL B', delay: 480  },
]

// ── Component ─────────────────────────────────────────────────────────────────
export default function ReactorScreen({ onReturn, onLogout, initialPlasma = 0, unreadCount = 0, onMailOpen }) {
  const canvasRef         = useRef(null)
  const plasmaRef         = useRef(initialPlasma)
  const redlineTimerRef   = useRef(null)
  const resetIntervalRef  = useRef(null)
  const overloadActiveRef = useRef(false)
  const cbPanelRef        = useRef(null)
  const diagramWrapRef    = useRef(null)

  const [plasmaDensity,  setPlasmaDensity]  = useState(initialPlasma)
  const [redlineActive,  setRedlineActive]  = useState(false)
  const [overloadWarning,setOverloadWarning]= useState(false)

  const audioCtxRef  = useRef(null)
  const gainNodeRef  = useRef(null)
  const sourceNodeRef = useRef(null)

  const fluxValRef = useRef(null)
  const fluxBarRef = useRef(null)
  const capValRef  = useRef(null)
  const capBarRef  = useRef(null)
  const radValRef  = useRef(null)
  const radBarRef  = useRef(null)

  // ── Clear timers ──────────────────────────────────────────────────────────
  const clearTimers = useCallback(() => {
    if (redlineTimerRef.current)  { clearTimeout (redlineTimerRef.current);  redlineTimerRef.current  = null }
    if (resetIntervalRef.current) { clearInterval(resetIntervalRef.current); resetIntervalRef.current = null }
  }, [])

  // ── Overload trigger ──────────────────────────────────────────────────────
  const triggerOverload = useCallback(() => {
    redlineTimerRef.current = null
    overloadActiveRef.current = true
    setOverloadWarning(true)
    // Animate slider back to 75%
    resetIntervalRef.current = setInterval(() => {
      plasmaRef.current = Math.max(75, plasmaRef.current - 1)
      setPlasmaDensity(plasmaRef.current)
      if (plasmaRef.current <= 75) {
        clearInterval(resetIntervalRef.current)
        resetIntervalRef.current = null
        setRedlineActive(false)
      }
    }, 20)
  }, [])

  // ── Slider change ─────────────────────────────────────────────────────────
  const handleSliderChange = useCallback((e) => {
    if (overloadActiveRef.current) return   // locked during reset
    const val = Number(e.target.value)
    plasmaRef.current = val
    setPlasmaDensity(val)

    // Resume AudioContext on first user gesture (browser autoplay policy)
    if (audioCtxRef.current?.state === 'suspended') {
      audioCtxRef.current.resume()
    }

    if (val >= 80) {
      setRedlineActive(true)
      if (!redlineTimerRef.current) {
        redlineTimerRef.current = setTimeout(triggerOverload, 5000)
      }
    } else {
      setRedlineActive(false)
      if (redlineTimerRef.current) { clearTimeout(redlineTimerRef.current); redlineTimerRef.current = null }
    }
  }, [triggerOverload])

  // ── Acknowledge overload ──────────────────────────────────────────────────
  const playClick = useCallback(() => {
    const sfx = new Audio(`${import.meta.env.BASE_URL}click.wav`)
    sfx.volume = 1.0
    sfx.play().catch(() => {})
  }, [])

  const handleAcknowledge = useCallback(() => {
    clearTimers()
    overloadActiveRef.current = false
    setOverloadWarning(false)
    setRedlineActive(false)
  }, [clearTimers])

  // ── three.js scene + telemetry RAF ─────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    let renderer, composer, raf
    const disposables = []

    try {
      const w = canvas.clientWidth || 1, h = canvas.clientHeight || 1

      const scene = new THREE.Scene()
      const camera = new THREE.PerspectiveCamera(42, w / h, 0.1, 100)
      camera.position.set(2.47, 1.39, 2.61)   // 3/4 view (dist 3.85, az ~43.5°, elev ~21°)

      renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true })
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
      renderer.setSize(w, h, false)
      renderer.setClearColor(0x000000, 0)

      // Drag to rotate the view. Zoom/pan disabled so the torus stays centred and
      // the slider / circuit-breaker overlays stay aligned to it.
      const controls = new OrbitControls(camera, renderer.domElement)
      controls.enableDamping = true
      controls.dampingFactor = 0.08
      controls.enablePan = false
      controls.enableZoom = false
      controls.rotateSpeed = 0.7
      controls.target.set(0, 0, 0)

      // Tilt the whole assembly; spinGroup rotates the torus about its own axis.
      const tilt = new THREE.Group()
      tilt.rotation.x = -1.0
      scene.add(tilt)
      const spin = new THREE.Group()
      tilt.add(spin)

      // ── Lighting ─────────────────────────────────────────────────────────────
      scene.add(new THREE.AmbientLight(0x33507f, 0.7))
      const keyLight = new THREE.DirectionalLight(0xbcd4ff, 0.9)
      keyLight.position.set(2, 3, 4)
      scene.add(keyLight)
      const coreLight = new THREE.PointLight(0xff5bb0, 0.0, 8, 2)  // plasma lights the coils
      scene.add(coreLight)

      // ── TF coils (metallic rings encircling the tube) ───────────────────────
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

      // ── Faint outer containment shell ────────────────────────────────────────
      const shellGeo = new THREE.TorusGeometry(R_MAJ, R_TUBE * 1.7, 12, 80)
      const shellMat = new THREE.MeshBasicMaterial({ color: 0x12356f, wireframe: true, transparent: true, opacity: 0.12 })
      spin.add(new THREE.Mesh(shellGeo, shellMat))
      disposables.push(shellGeo, shellMat)

      // ── Plasma (glowing shell + hot inner core) ──────────────────────────────
      const plasmaGeo = new THREE.TorusGeometry(R_MAJ, R_TUBE, 28, 200)
      const plasmaMat = new THREE.ShaderMaterial({
        vertexShader: PLASMA_VERT, fragmentShader: PLASMA_FRAG,
        uniforms: { uTime: { value: 0 }, uPlasma: { value: plasmaRef.current / 100 } },
        transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
      })
      spin.add(new THREE.Mesh(plasmaGeo, plasmaMat))
      disposables.push(plasmaGeo, plasmaMat)

      const coreGeo = new THREE.TorusGeometry(R_MAJ, R_TUBE * 0.42, 16, 160)
      const coreMat = new THREE.MeshBasicMaterial({ color: 0xffc8e8, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false })
      const coreMesh = new THREE.Mesh(coreGeo, coreMat)
      spin.add(coreMesh)
      disposables.push(coreGeo, coreMat)

      // ── Central solenoid (vertical coil stack through the donut hole) ─────────
      const solGroup = new THREE.Group()
      const solMat = new THREE.MeshStandardMaterial({ color: 0x6aa6ff, metalness: 0.7, roughness: 0.4, emissive: 0x0a2150 })
      disposables.push(solMat)
      const solRingGeo = new THREE.TorusGeometry(0.12, 0.022, 8, 28)
      disposables.push(solRingGeo)
      for (let i = 0; i < 9; i++) {
        const ring = new THREE.Mesh(solRingGeo, solMat)
        ring.position.z = -0.32 + (i / 8) * 0.64
        solGroup.add(ring)
      }
      spin.add(solGroup)

      // ── Bloom ────────────────────────────────────────────────────────────────
      composer = new EffectComposer(renderer)
      composer.addPass(new RenderPass(scene, camera))
      composer.addPass(new UnrealBloomPass(new THREE.Vector2(w, h), 0.7, 0.5, 0.2))

      const clock = new THREE.Clock()
      const frame = () => {
        const p = plasmaRef.current / 100
        spin.rotation.z += 0.006
        controls.update()
        plasmaMat.uniforms.uTime.value = clock.getElapsedTime()
        plasmaMat.uniforms.uPlasma.value = p
        coreMat.opacity = p * 0.22
        coreLight.intensity = p * 2.4
        composer.render()

        // ── Telemetry DOM (unchanged) ──────────────────────────────────────────
        const d  = plasmaRef.current / 100
        const nr = (v, noise) => v + (Math.random() - 0.5) * noise
        const flux = Math.max(0, nr(0.35 + d * 3.85, 0.04))
        const cap  = Math.min(100, Math.max(0, nr(14 + d * 80, 1.0)))
        const rad  = Math.max(0, nr(580 + d * 2950, 25))
        if (fluxValRef.current) fluxValRef.current.textContent = `${flux.toFixed(3)} GW`
        if (fluxBarRef.current) fluxBarRef.current.style.width = `${Math.min(100, flux / 4.2 * 100).toFixed(1)}%`
        if (capValRef.current)  capValRef.current.textContent  = `${cap.toFixed(1)}%`
        if (capBarRef.current)  capBarRef.current.style.width  = `${cap.toFixed(1)}%`
        if (radValRef.current)  radValRef.current.textContent  = `+${rad.toFixed(0)} K`
        const radPct = Math.min(100, (rad - 580) / 2950 * 100)
        if (radBarRef.current)  radBarRef.current.style.width  = `${Math.max(0, radPct).toFixed(1)}%`

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
        controls.dispose()
        disposables.forEach(o => o.dispose && o.dispose())
        composer.dispose && composer.dispose()
        renderer.dispose()
      }
    } catch (err) {
      console.error('Reactor visualiser failed to initialise:', err)
      if (renderer) { try { renderer.dispose() } catch (_) {} }
    }
  }, [])

  useEffect(() => clearTimers, [clearTimers])

  // ── Scale circuit breakers to fit available height ────────────────────────
  useEffect(() => {
    const panel = cbPanelRef.current
    const wrap  = diagramWrapRef.current
    if (!panel || !wrap) return
    const update = () => {
      panel.style.transform = 'translateY(-50%)'
      requestAnimationFrame(() => {
        const availH = wrap.clientHeight * 0.72
        const scale  = Math.min(1, availH / panel.scrollHeight)
        panel.style.transform = `translateY(-50%) scale(${scale})`
        panel.style.transformOrigin = 'center center'
      })
    }
    const obs = new ResizeObserver(update)
    obs.observe(wrap)
    update()
    return () => obs.disconnect()
  }, [])

  // ── Power audio: seamless loop via Web Audio API ──────────────────────────
  useEffect(() => {
    const ctx  = new (window.AudioContext || window.webkitAudioContext)()
    const gain = ctx.createGain()
    gain.gain.value = 0          // start silent; slider gesture will resume ctx
    gain.connect(ctx.destination)
    audioCtxRef.current = ctx
    gainNodeRef.current = gain

    fetch(`${import.meta.env.BASE_URL}power.flac`)
      .then(r => r.arrayBuffer())
      .then(buf => ctx.decodeAudioData(buf))
      .then(decoded => {
        const src = ctx.createBufferSource()
        src.buffer   = decoded
        src.loop     = true
        src.loopStart = 0
        src.loopEnd   = decoded.duration
        src.connect(gain)
        src.start(0)
        sourceNodeRef.current = src
      })
      .catch(() => {})

    return () => {
      sourceNodeRef.current?.stop()
      ctx.close()
    }
  }, [])

  // Drive volume via gain — no gaps, no restarts
  useEffect(() => {
    const gain = gainNodeRef.current
    if (!gain) return
    gain.gain.setTargetAtTime(
      plasmaDensity >= 25 ? 0.5 : 0,
      gainNodeRef.current.context.currentTime,
      0.1   // 100ms ramp to avoid clicks
    )
  }, [plasmaDensity])

  return (
    <div id="reactor-screen">

      <HudHeader
        onLogout={() => onReturn(plasmaRef.current)}
        center={
          <span className={`status-pill mail-pill${unreadCount > 0 ? ' mail-pill--unread' : ''}`} onClick={onMailOpen}>
            {unreadCount > 0 && <span className="mail-unread-dot" />}
            ✉ IMPERIAL MESSAGING SERVICE // UNREAD: {unreadCount}
          </span>
        }
        right={<span className="label">PNL-007-EXT / PLASMA INTERFACE</span>}
      />

      <main className="reactor-main">

        {/* ── Diagram + slider ────────────────────────────────────────────── */}
        <div className="reactor-diagram-col">
          <div className="reactor-torus-label">D-³He FUSOR REACTOR TORUS</div>
          <div className="reactor-diagram-wrap" ref={diagramWrapRef}>
            <canvas className="reactor-canvas" ref={canvasRef} />

            {/* Circuit breakers overlaid on the left of the torus */}
            <div className="cb-panel" ref={cbPanelRef}>
              <div className="cb-panel-title">CIRCUIT<br/>BREAKERS</div>
              {BREAKERS.map(b => (
                <div
                  key={b.id}
                  className={`cb-item${plasmaDensity >= 25 ? ' cb-closed' : ''}`}
                  style={{ '--cb-delay': `${b.delay}ms` }}
                >
                  <div className="cb-label">{b.label}</div>
                  <div className="cb-body">
                    <div className="cb-top" />
                    <div className="cb-bot" />
                  </div>
                </div>
              ))}
            </div>

            {/* Slider overlaid directly beside the torus */}
            <div className="plasma-slider-wrap">
              <div className="plasma-slider-header">PLASMA DENSITY</div>
              <div className="plasma-pct-display">
                {plasmaDensity}<span className="plasma-pct-unit">%</span>
              </div>

              <div className="plasma-track-outer">
                {/* Redline zone — top 20% (80–100%) */}
                <div className={`plasma-redline-zone${redlineActive ? ' rl-active' : ''}`}>
                  <span className="plasma-redline-label">⚠ REDLINE</span>
                </div>
                <div className="plasma-80-line" />

                {/* Safe zone — middle 70% (10–80%) */}
                <div className="plasma-safe-zone" />

                {/* Low-power threshold line at 10% */}
                <div className="plasma-10-line" />

                {/* Low-power zone — bottom 10% (0–10%) */}
                <div className="plasma-lowpower-zone">
                  <span className="plasma-lowpower-label">LOW</span>
                </div>

                {/* Zone labels to the left of the track */}
                <div className="plasma-zone-label plasma-zone-label--danger" style={{ top: '10%' }}>
                  DANGER ZONE
                </div>
                <div className="plasma-zone-label plasma-zone-label--ideal" style={{ top: '30%' }}>
                  IDEAL POWER
                </div>
                <div className="plasma-zone-label plasma-zone-label--low" style={{ top: '70%' }}>
                  LOW POWER
                </div>

                <input
                  type="range"
                  className={`plasma-slider${redlineActive ? ' plasma-slider--redline' : ''}`}
                  orient="vertical"
                  min="0"
                  max="100"
                  value={plasmaDensity}
                  onChange={handleSliderChange}
                  disabled={overloadActiveRef.current}
                />

                {/* Scale labels pinned to the track height */}
                <div className="plasma-scale">
                  <span>100</span>
                  <span>80</span>
                  <span>60</span>
                  <span>40</span>
                  <span>20</span>
                  <span>0</span>
                </div>
              </div>
              <div className={`plasma-adjust-label${plasmaDensity >= 60 && plasmaDensity < 80 ? ' plasma-adjust-label--ideal' : ''}`}>
                ADJUST
              </div>
            </div>
          </div>
          <div className={`reactor-status-label${redlineActive ? ' rsl--overload' : plasmaDensity < 60 ? ' rsl--low' : ' rsl--nominal'}`}>
            {redlineActive ? 'OVERLOAD' : plasmaDensity < 60 ? 'LOW POWER — INCREASE PLASMA' : 'STATUS NOMINAL'}
          </div>
          <button
            className={`monitor-return-btn${plasmaDensity >= 60 && plasmaDensity < 80 ? ' monitor-return-btn--ready' : ''}`}
            onClick={() => { playClick(); onReturn(plasmaRef.current) }}
            disabled={redlineActive}
          >
            RETURN TO INSTALLATION VIEW
          </button>
        </div>

        {/* ── Status metrics ───────────────────────────────────────────────── */}
        <div className="reactor-status-row">
          <div className="power-cell">
            <div className="pc-label">CORE FLUX</div>
            <div className="pc-value mono" ref={fluxValRef}>—</div>
            <div className="bar"><div className="bar-fill" ref={fluxBarRef} style={{ width: '0%' }} /></div>
          </div>
          <div className="power-cell">
            <div className="pc-label">CAPACITOR BANK</div>
            <div className="pc-value mono" ref={capValRef}>—</div>
            <div className="bar"><div className="bar-fill" ref={capBarRef} style={{ width: '0%' }} /></div>
          </div>
          <div className="power-cell">
            <div className="pc-label">RADIATOR ΔT</div>
            <div className="pc-value mono" ref={radValRef}>—</div>
            <div className="bar"><div className="bar-fill warn" ref={radBarRef} style={{ width: '0%' }} /></div>
          </div>
        </div>
      </main>

      {/* ── Overload warning dialog ──────────────────────────────────────── */}
      {overloadWarning && (
        <>
          <div className="reactor-overload-dim" />
          <div className="reactor-overload-dialog">
            <div className="rod-icon">⚠</div>
            <div className="rod-title">PLASMA OVERLOAD</div>
            <div className="rod-sub">DENSITY EXCEEDS OPERATIONAL THRESHOLD</div>
            <div className="rod-divider" />
            <div className="rod-body">
              Sustained plasma density above 80% for more than 5 seconds has triggered
              emergency containment protocols. Initiating controlled density reduction.
            </div>
            <div className="rod-reset">RESETTING TO 75% NOMINAL DENSITY</div>
            <button className="rod-btn" onClick={handleAcknowledge}>ACKNOWLEDGE</button>
          </div>
        </>
      )}

      <HudFooter>
        <span>HMSS / FCS v6.2.41 / REACTOR CONTROL SUBSYSTEM</span>
        <span className="sep">│</span>
        <span>FUSOR: <em className="ok">NOMINAL</em></span>
        <span className="sep">│</span>
        <span>CONTAINMENT: <em className="ok">STABLE</em></span>
        <span className="sep">│</span>
        <span>PLASMA: <em className={redlineActive ? 'warn' : 'ok'}>{redlineActive ? 'CRITICAL' : 'NOMINAL'}</em></span>
      </HudFooter>

    </div>
  )
}
