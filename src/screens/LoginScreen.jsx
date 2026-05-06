import { useState, useRef, useEffect, useCallback } from 'react'
import CryptographyModule from '../components/CryptographyModule'

const OPERATOR_ID = 'HIH V. ASTRAIA // CLR-Ω'
const PASSWORD    = 'IMPERIAL-CLEARANCE-OMEGA'
const ID_SPEED    = 38   // ms per character
const PW_SPEED    = 60   // ms per character

const VIZ_W = 200
const VIZ_H = 72
const BAR_COUNT = 28

export default function LoginScreen({ onComplete, onDebug }) {
  const [exiting,        setExiting]        = useState(false)
  const [phase,          setPhase]          = useState('idle')  // idle | typing | ready | crypto
  const [operatorText,   setOperatorText]   = useState('')
  const [passwordText,   setPasswordText]   = useState('')
  const [portraitHover,  setPortraitHover]  = useState(false)
  const [anthemPlaying,  setAnthemPlaying]  = useState(false)

  const timers   = useRef([])
  const clickSfx = useRef(null)

  // Anthem audio refs
  const anthemCtxRef      = useRef(null)
  const anthemBufRef      = useRef(null)
  const anthemGainRef     = useRef(null)
  const anthemAnalyserRef = useRef(null)
  const anthemSourceRef   = useRef(null)
  const anthemRafRef      = useRef(null)
  const anthemCanvasRef   = useRef(null)

  useEffect(() => {
    const audio = new Audio(`${import.meta.env.BASE_URL}click.wav`)
    audio.preload = 'auto'
    clickSfx.current = audio
    return () => timers.current.forEach(clearTimeout)
  }, [])

  // Preload anthem audio buffer
  useEffect(() => {
    const ctx = new (window.AudioContext || window.webkitAudioContext)()
    anthemCtxRef.current = ctx
    fetch(`${import.meta.env.BASE_URL}oempress.mp3`)
      .then(r => r.arrayBuffer())
      .then(buf => ctx.decodeAudioData(buf))
      .then(decoded => { anthemBufRef.current = decoded })
      .catch(() => {})
    return () => {
      cancelAnimationFrame(anthemRafRef.current)
      try { anthemSourceRef.current?.stop() } catch (_) {}
      ctx.close().catch(() => {})
    }
  }, [])

  const fadeStopAnthem = useCallback((immediate = false) => {
    cancelAnimationFrame(anthemRafRef.current)
    setAnthemPlaying(false)
    const ctx    = anthemCtxRef.current
    const gain   = anthemGainRef.current
    const source = anthemSourceRef.current
    anthemSourceRef.current = null
    if (!source) return
    if (immediate) {
      try { source.stop() } catch (_) {}
    } else {
      if (ctx && gain) {
        gain.gain.cancelScheduledValues(ctx.currentTime)
        gain.gain.setValueAtTime(gain.gain.value, ctx.currentTime)
        gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 1)
      }
      setTimeout(() => { try { source.stop() } catch (_) {} }, 1100)
    }
  }, [])

  const playAnthem = () => {
    if (!anthemBufRef.current || anthemPlaying) return
    const ctx = anthemCtxRef.current
    ctx.resume()

    const analyser = ctx.createAnalyser()
    analyser.fftSize = 512
    anthemAnalyserRef.current = analyser

    const gain = ctx.createGain()
    gain.gain.setValueAtTime(0.85, ctx.currentTime)
    anthemGainRef.current = gain

    const source = ctx.createBufferSource()
    source.buffer = anthemBufRef.current
    source.loop = false
    source.connect(analyser)
    analyser.connect(gain)
    gain.connect(ctx.destination)
    source.start(0)
    anthemSourceRef.current = source
    setAnthemPlaying(true)

    // Stop cleanly when track ends naturally
    source.onended = () => {
      if (anthemSourceRef.current === source) {
        cancelAnimationFrame(anthemRafRef.current)
        anthemSourceRef.current = null
        setAnthemPlaying(false)
      }
    }
  }

  // Start visualizer RAF loop once the canvas is in the DOM
  useEffect(() => {
    if (!anthemPlaying) return
    const analyser = anthemAnalyserRef.current
    if (!analyser) return

    const drawBars = () => {
      const canvas = anthemCanvasRef.current
      if (!canvas) return
      const ctx2d = canvas.getContext('2d')
      const data  = new Uint8Array(analyser.frequencyBinCount)
      analyser.getByteFrequencyData(data)

      ctx2d.clearRect(0, 0, VIZ_W, VIZ_H)

      const step = Math.floor(data.length / BAR_COUNT)
      const barW = Math.floor(VIZ_W / BAR_COUNT) - 2

      for (let i = 0; i < BAR_COUNT; i++) {
        const val   = data[i * step] / 255
        const barH  = Math.max(2, val * VIZ_H)
        const x     = i * (barW + 2)
        const y     = VIZ_H - barH
        const alpha = 0.3 + val * 0.7
        ctx2d.fillStyle = `rgba(140, 210, 255, ${alpha})`
        ctx2d.fillRect(x, y, barW, barH)
      }

      anthemRafRef.current = requestAnimationFrame(drawBars)
    }
    drawBars()

    return () => cancelAnimationFrame(anthemRafRef.current)
  }, [anthemPlaying])

  // Fade out when crypto starts
  useEffect(() => {
    if (phase === 'crypto') fadeStopAnthem(false)
  }, [phase, fadeStopAnthem])

  const startFill = () => {
    if (phase !== 'idle') return
    setPhase('typing')

    // Type operator ID
    OPERATOR_ID.split('').forEach((_, i) => {
      timers.current.push(setTimeout(() => {
        setOperatorText(OPERATOR_ID.slice(0, i + 1))
      }, i * ID_SPEED))
    })

    // Type password after operator ID finishes
    const pwStart = OPERATOR_ID.length * ID_SPEED + 120
    PASSWORD.split('').forEach((_, i) => {
      timers.current.push(setTimeout(() => {
        setPasswordText(PASSWORD.slice(0, i + 1))
      }, pwStart + i * PW_SPEED))
    })

    // Mark ready after both done
    timers.current.push(setTimeout(() => {
      setPhase('ready')
    }, pwStart + PASSWORD.length * PW_SPEED + 100))
  }

  const handleLogin = () => {
    if (clickSfx.current) { clickSfx.current.currentTime = 0; clickSfx.current.play().catch(() => {}) }
    if (phase === 'idle') { startFill(); return }
    if (phase !== 'ready') return
    setPhase('crypto')
  }

  const portraitVisible = operatorText.length >= OPERATOR_ID.length
  const btnDim          = phase !== 'ready' || exiting

  return (
    <div id="login-screen" className={exiting ? 'fade-out' : ''}>
      <div className="login-inner">
        <div className="boot-header">
          <img className="boot-emblem" src={`${import.meta.env.BASE_URL}logo.png`} alt="Imperial Space Force Emblem" />
          <div className="boot-title">IMPERIAL SPACE FORCE</div>
          <div className="boot-subtitle">
            TACTICAL COMMAND INTERFACE // HMSS &quot;HER ANNUNCIATOR&quot; // FIRE CONTROL SYSTEM v6.2.41
          </div>
          <div className="boot-divider" />
        </div>

        <div className="login-form">
          <div
            className={`login-portrait-wrap${phase === 'idle' ? ' clickable' : ''}`}
            onClick={startFill}
            onMouseEnter={() => portraitVisible && setPortraitHover(true)}
            onMouseLeave={() => setPortraitHover(false)}
          >
            <img
              className={`login-portrait${portraitVisible ? ' visible' : ''}`}
              src={`${import.meta.env.BASE_URL}portrait.png`}
              alt="Operator Portrait"
            />
            {!portraitVisible && <span className="login-portrait-empty">[NO USER]</span>}
          </div>
          <div className="login-fields" aria-hidden={portraitHover}>
            <div className="login-field-row">
              <label className="login-label">OPERATOR ID</label>
              <div className="login-input-wrap">
                <input
                  className="login-input"
                  type="text"
                  value={operatorText}
                  onFocus={startFill}
                  onChange={() => {}}
                  readOnly
                />
                {(phase === 'idle' || (phase === 'typing' && operatorText.length < OPERATOR_ID.length)) && (
                  <span
                    className="login-cursor"
                    style={{ left: `calc(12px + ${operatorText.length} * 1ch + ${operatorText.length * 0.08}em)` }}
                    aria-hidden
                  >▌</span>
                )}
              </div>
            </div>
            <div className="login-field-row">
              <label className="login-label">ACCESS CODE</label>
              <div className="login-input-wrap">
                <input
                  className="login-input"
                  type="password"
                  value={passwordText}
                  onFocus={startFill}
                  onChange={() => {}}
                  readOnly
                />
                {phase === 'typing' && operatorText.length >= OPERATOR_ID.length && passwordText.length < PASSWORD.length && (
                  <span
                    className="login-cursor"
                    style={{ left: `calc(12px + ${passwordText.length} * 1ch + ${passwordText.length * 0.08}em)` }}
                    aria-hidden
                  >▌</span>
                )}
              </div>
            </div>
            <button className={`login-btn${btnDim ? ' dim' : ''}`} onClick={handleLogin}>
              AUTHENTICATE &amp; ENTER
            </button>
          </div>

          {portraitVisible && (
            <div className={`login-info-panel${portraitHover ? ' visible' : ''}`}>
              <div className="lip-heading">OPERATOR DOSSIER</div>
              <div className="lip-divider" />
              <div className="lip-row"><span className="lip-label">DESIGNATION</span><span className="lip-value">HER IMPERIAL HIGHNESS VALERIA ASTRAIA</span></div>
              <div className="lip-row"><span className="lip-label">RANK</span><span className="lip-value">O-10: ADMIRAL</span></div>
              <div className="lip-row"><span className="lip-label">CLEARANCE</span><span className="lip-value">CLR-Ω // IMPERIAL</span></div>
              <div className="lip-row"><span className="lip-label">POSTING</span><span className="lip-value">HMSS HER ANNUNCIATOR</span></div>
              <div className="lip-row"><span className="lip-label">STATUS</span><span className="lip-value lip-value--ok">ACTIVE // VERIFIED</span></div>
              <div className="lip-divider" />
              <div className="lip-body">
                Imperial Princess — 11th in line to the Royal and Imperial Throne.
              </div>
            </div>
          )}
        </div>

        <div className="login-anthem-slot">
          <div className="login-anthem-row">
            <div className={`login-anthem${phase === 'crypto' ? ' login-anthem--hidden' : ''}`}>
              <p>
                From the high and sacrèd morning star<br />
                To the silent deeps where no suns are<br />
                O Empress, thou alone dost hear<br />
                The turning of each celestial sphere
              </p>
              <p>
                We are the chord beneath thy hand<br />
                We are the chord,<br />
                O Star-Hearer, we are the chord beneath thy hand.
              </p>
              <p>
                Ten thousand daughters bear thy name<br />
                Each princess thy belovèd flame<br />
                A note set down upon thy stave<br />
                A song that none beside thee gave
              </p>
              <p>
                We are the chord beneath thy hand,<br />
                We are the chord,<br />
                O Star-Hearèr, we are the chord beneath thy hand.
              </p>
              {!anthemPlaying && phase !== 'crypto' && (
                <button className="anthem-play-btn" onClick={playAnthem}>▶ PLAY</button>
              )}

              {anthemPlaying && (
                <div className="anthem-viz-popup">
                  <div className="anthem-viz-title">AUDIO SPECTROGRAPH</div>
                  <div className="anthem-viz-name">IMPERIAL ANTHEM</div>
                  <div className="anthem-viz-subtitle">&ldquo;O EMPRESS, THOU ALONE DOST HEAR&rdquo;</div>
                  <canvas
                    ref={anthemCanvasRef}
                    className="anthem-viz-canvas"
                    width={VIZ_W}
                    height={VIZ_H}
                  />
                  <button className="anthem-stop-btn" onClick={() => fadeStopAnthem(false)}>■ STOP</button>
                </div>
              )}
            </div>
          </div>

          {phase === 'crypto' && <CryptographyModule onComplete={onComplete} />}
        </div>
      </div>
      <footer className="login-footer">
        <button className="login-debug-link" onClick={onDebug}>debug</button>
      </footer>
    </div>
  )
}
