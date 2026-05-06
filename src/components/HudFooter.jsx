import { useState, useRef, useEffect } from 'react'
import AudioSpectrograph from './AudioSpectrograph'

const POEM = [
  "O'er silent Star, beneath broken Sky,",
  'A grim Discord the Lost have wrought.',
  'In the Hearing of Her, Sword-Sworn at her Side,',
  "'Gainst the Hush the Empress's Chord is brought.",
  'From the Cathedra high, to the listening below,',
  'Falls the Lance that the Discord besought.',
  '"Long live the Throne, where she hears alone,',
  'For the Day when the Discord comes to Naught."',
]

export default function HudFooter({ children }) {
  const [open,        setOpen]        = useState(false)
  const [imgZoomed,   setImgZoomed]   = useState(false)
  const [imgClosing,  setImgClosing]  = useState(false)

  const audioCtxRef  = useRef(null)
  const gainRef      = useRef(null)
  const sourceRef    = useRef(null)
  const bufferRef    = useRef(null)
  const analyserRef  = useRef(null)

  // Preload audio buffer on mount
  useEffect(() => {
    const ctx  = new (window.AudioContext || window.webkitAudioContext)()
    const gain = ctx.createGain()
    gain.gain.value = 0.8
    gain.connect(ctx.destination)
    audioCtxRef.current = ctx
    gainRef.current     = gain

    fetch(`${import.meta.env.BASE_URL}auditioultima.mp3`)
      .then(r => r.arrayBuffer())
      .then(buf => ctx.decodeAudioData(buf))
      .then(decoded => { bufferRef.current = decoded })
      .catch(() => {})

    return () => { ctx.close() }
  }, [])

  // Play on open, fade out on close
  useEffect(() => {
    const ctx  = audioCtxRef.current
    const gain = gainRef.current
    if (!ctx || !gain) return

    if (open) {
      if (!bufferRef.current) return
      ctx.resume()
      // Reset gain in case a previous fade left it at 0
      gain.gain.cancelScheduledValues(ctx.currentTime)
      gain.gain.setValueAtTime(0.8, ctx.currentTime)
      // Stop any previous playback
      try { sourceRef.current?.stop() } catch (_) {}

      // Build analyser → gain chain
      const analyser = ctx.createAnalyser()
      analyser.fftSize = 512
      analyserRef.current = analyser
      analyser.connect(gain)

      const source = ctx.createBufferSource()
      source.buffer = bufferRef.current
      source.loop   = false
      source.connect(analyser)
      source.start(0)
      sourceRef.current = source
    } else {
      if (!sourceRef.current) return
      // Fade out over 2 seconds then stop
      const g = gain.gain
      g.setValueAtTime(g.value, ctx.currentTime)
      g.linearRampToValueAtTime(0, ctx.currentTime + 2)
      const src = sourceRef.current
      setTimeout(() => { try { src.stop() } catch (_) {} }, 2100)
      sourceRef.current  = null
      analyserRef.current = null
    }
  }, [open])

  return (
    <>
      <footer className="hud-footer">
        {children}
        <span className="footer-motto" onClick={() => setOpen(true)}>
          ✦ CAELUM CANIT ✦ ILLA AVDIT ✦
        </span>
      </footer>

      {imgZoomed && (
        <div
          className={`empress-zoom-wrap${imgClosing ? ' empress-zoom-wrap--closing' : ''}`}
          onClick={() => {
            setImgClosing(true)
            setTimeout(() => { setImgZoomed(false); setImgClosing(false) }, 320)
          }}
        >
          <img
            className={`empress-zoom-img${imgClosing ? ' empress-zoom-img--closing' : ''}`}
            src={`${import.meta.env.BASE_URL}empress.jpg`}
            alt="The Grand Empress"
            style={{ cursor: 'zoom-out' }}
          />
        </div>
      )}

      {open && (
        <>
          <div className="empress-dim" />
          <div className="empress-modal-wrap">
            <div className="empress-modal-group">
              <div className="empress-modal">
                <div className="empress-motto-group">
                  <div className="empress-motto">✦ CAELUM CANIT ✦ ILLA AVDIT ✦</div>
                  <div className="empress-translation">
                    <em>The heavens sing; she hears.</em>
                  </div>
                </div>
                <div className="empress-img-wrap">
                  <img
                    className="empress-img"
                    src={`${import.meta.env.BASE_URL}empress.jpg`}
                    alt="The Grand Empress"
                    style={{ cursor: 'zoom-in' }}
                    onClick={() => setImgZoomed(true)}
                  />
                </div>
                <div className="empress-caption">
                  HER IMPERIAL MAJESTY EMPRESS Iliantha III
                </div>
                <div className="empress-poem">
                  <div className="empress-caption empress-poem-supertitle">
                    AUDITIO ULTIMA : IMPERIAL ESCHATOLOGICAL PROPHECY
                  </div>
                  {POEM.map((line, i) => (
                    <p key={i}>{line}</p>
                  ))}
                </div>
                <button className="empress-close" onClick={() => setOpen(false)}>
                  CLOSE
                </button>
              </div>

              <div className="empress-viz-side">
                <AudioSpectrograph
                  analyser={analyserRef.current}
                  name="Imperial Prophecy"
                  subtitle="Auditio Ultima"
                  onStop={() => setOpen(false)}
                />
              </div>
            </div>
          </div>
        </>
      )}
    </>
  )
}
