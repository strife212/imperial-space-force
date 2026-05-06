import { useEffect, useRef, useState } from 'react'

// ── Constants ─────────────────────────────────────────────────────────────────
const LINK_TEXT    = 'ESTABLISHING SECURE QUANTUM LINK'
const RESULT_LINE0 = 'ENTANGLEMENT DETECTED'
const RESULT_LINE1 = 'QUANTUM STATE COHERENT'
const RESULT_LINE2 = 'QUANTUM LINK ESTABLISHED.'
const STAGE2_TEXT  = 'EXCHANGING KEYS'
const KEY_BLOCK    = `-----BEGIN PRIVATE KEY BLOCK-----

mQINBFRUAGoBEACuk6ze2V2pZtScf1Ul25N2CX19AeL7sVYwnyrTYuWdG2FmJx4x
DLTLVUazp2AEm/JhskulL/7VCZPyg7ynf+o20Tu9/6zUD7p0rnQA2k3Dz+7dKHHh
eEsIl5EZyFy1XodhUnEIjel2nGe6f1OO7Dr3UIEQw5JnkZyqMcbLCu9sM2twFyfa
a8JNghfjltLJs3/UjJ8ZnGGByMmWxrWQUItMpQjGr99nZf4L+IPxy2i8O8WQewB5
fvfidBGruUYC+mTw7CusaCOQbBuZBiYduFgH8hRW97KLmHn0xzB1FV++KI7syo8q
XGo8Un24WP40IT78XjKO
=nUop
-----END PRIVATE KEY BLOCK-----`
const KEY_BLOCK_2  = `-----BEGIN REMOTE KEY BLOCK-----

wsBzBAABCAAnBQJkqTX1CRCVdGkL3Q6EthYhBFiC3Q7eP92+ELDgFJV0aQvdi
DoS2AAAMbgf9GxQ7u8N3s5Yh2mKpLvR1e4OqWzXfTnJcBdM0Ks8Vu2P9iHxAr
3FmNwY4VqK8tErCjF5sXlH7bPo2RuIhKQ9wM1yJnTe6LcAf0vBsXdZp8NgWkjP
hR3mYuO1KiPq8CxVlT4eJbFz7NwS5gH6DaM0rU9vIoXtQsKyB2EcP3LhAnWdsJ
sJ7nKpVmRxT2cFqAbLgY4BdHiO6wZu9NvP1DtMsXbQ8rUjEk0yCfGlIoWhF5eQ
Tp8fNwS5gH6DaM0rU9vELDgFJV0nKpVmRxT2cFqAbLgY4BdHiO6IXtQsKyAnWd
=m4Qr
-----END REMOTE KEY BLOCK-----`
const FINAL_LINE0  = 'KEY EXCHANGE COMPLETE'
const FINAL_LINE1  = 'VERIFYING IDENTITY'
const FINAL_LINE2  = 'IDENTITY VERIFIED.'
const CHAR_DELAY   = 40   // ms per character
const BASE_RY      = 0.5  // shared qubit orientation
const QUBIT_R      = 45   // sphere radius (px)

// ── Bloch sphere wireframe ────────────────────────────────────────────────────
function drawBlochSphere(ctx, cx, cy, r, ry, alpha) {
  if (alpha <= 0) return
  const c1 = `rgba(60,140,255,${alpha.toFixed(3)})`
  const c2 = `rgba(30,80,200,${(alpha * 0.45).toFixed(3)})`
  const cv = `rgba(200,230,255,${alpha.toFixed(3)})`
  const vr = r * 0.72  // vertical radius — shorter to look more circular on screen

  // Equatorial ellipse
  ctx.strokeStyle = c1; ctx.lineWidth = 1
  ctx.beginPath()
  ctx.ellipse(cx, cy, r, vr * 0.28, 0, 0, Math.PI * 2)
  ctx.stroke()

  // Meridian 1 (ry-dependent width)
  ctx.strokeStyle = c1
  ctx.beginPath()
  ctx.ellipse(cx, cy, Math.max(0.5, Math.abs(Math.cos(ry)) * r), vr, 0, 0, Math.PI * 2)
  ctx.stroke()

  // Meridian 2 (90° offset)
  ctx.strokeStyle = c2
  ctx.beginPath()
  ctx.ellipse(cx, cy, Math.max(0.5, Math.abs(Math.sin(ry)) * r), vr, 0, 0, Math.PI * 2)
  ctx.stroke()

  // Z-axis (dashed)
  ctx.strokeStyle = c2; ctx.lineWidth = 0.7; ctx.setLineDash([2, 3])
  ctx.beginPath(); ctx.moveTo(cx, cy - vr - 6); ctx.lineTo(cx, cy + vr + 6); ctx.stroke()
  ctx.setLineDash([])

  // State vector
  const svTheta = Math.PI * 0.32
  const svX = cx + r * Math.sin(svTheta) * Math.cos(ry + 0.3)
  const svY = cy - vr * Math.cos(svTheta)
  const dx = svX - cx, dy = svY - cy
  const l  = Math.sqrt(dx * dx + dy * dy)
  const ux = dx / l, uy = dy / l

  ctx.strokeStyle = cv; ctx.lineWidth = 1.5
  ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(svX, svY); ctx.stroke()

  ctx.fillStyle = cv
  ctx.beginPath()
  ctx.moveTo(svX, svY)
  ctx.lineTo(svX - ux * 5 - uy * 3, svY - uy * 5 + ux * 3)
  ctx.lineTo(svX - ux * 5 + uy * 3, svY - uy * 5 - ux * 3)
  ctx.closePath(); ctx.fill()

  // Poles
  ctx.fillStyle = c1
  ctx.beginPath(); ctx.arc(cx, cy - vr, 2.5, 0, Math.PI * 2); ctx.fill()
  ctx.beginPath(); ctx.arc(cx, cy + vr, 2.5, 0, Math.PI * 2); ctx.fill()
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function CryptographyModule({ onComplete }) {
  const moduleRef    = useRef(null)
  const canvasRef    = useRef(null)
  const humRef       = useRef(null)
  const humGainRef   = useRef(null)
  const humCtxRef    = useRef(null)
  const beepRef      = useRef(null)

  // ── Computer hum audio (seamless Web Audio loop) ────────────────────────
  useEffect(() => {
    const ctx  = new (window.AudioContext || window.webkitAudioContext)()
    const gain = ctx.createGain()
    gain.gain.value = 0.5
    gain.connect(ctx.destination)
    humGainRef.current = gain
    humCtxRef.current  = ctx

    let source = null
    fetch(`${import.meta.env.BASE_URL}computerhum.mp3`)
      .then(r => r.arrayBuffer())
      .then(buf => ctx.decodeAudioData(buf))
      .then(decoded => {
        if (ctx.state === 'closed') return
        source = ctx.createBufferSource()
        source.buffer    = decoded
        source.loop      = true
        source.loopStart = 0
        source.loopEnd   = decoded.duration
        source.connect(gain)
        source.start(0)
        humRef.current = source
      })
      .catch(() => {})

    return () => {
      try { source?.stop() } catch (_) {}
      ctx.close()
    }
  }, [])

  // ── Beep audio (preload) ─────────────────────────────────────────────────
  useEffect(() => {
    const beep = new Audio(`${import.meta.env.BASE_URL}beep.mp3`)
    beep.preload = 'auto'
    beepRef.current = beep
  }, [])

  // Mutable animation state shared between RAF loop and timeline
  const anim = useRef({ qubitsAlpha: 0, rightRy: BASE_RY + Math.PI, mergeT: 0 })

  const [linkText,      setLinkText]      = useState('')
  const [showCanvas,    setShowCanvas]    = useState(false)
  const [resultLine0,   setResultLine0]   = useState('')
  const [resultLine1,   setResultLine1]   = useState('')
  const [resultLine2,   setResultLine2]   = useState('')
  const [blinkFinal,    setBlinkFinal]    = useState(false)
  const [contentFading, setContentFading] = useState(false)
  const [contentGone,   setContentGone]   = useState(false)
  const [labelsFading,  setLabelsFading]  = useState(false)
  const [stage2Text,    setStage2Text]    = useState('')
  const [showKey,       setShowKey]       = useState(false)
  const [keyFading,     setKeyFading]     = useState(false)
  const [key1Gone,      setKey1Gone]      = useState(false)
  const [showKey2,      setShowKey2]      = useState(false)
  const [finalLine0,    setFinalLine0]    = useState('')
  const [finalLine1,    setFinalLine1]    = useState('')
  const [finalLine2,    setFinalLine2]    = useState('')
  const [blinkIdentity, setBlinkIdentity] = useState(false)

  // ── Persistent canvas RAF loop ────────────────────────────────────────────
  useEffect(() => {
    const cv = canvasRef.current; if (!cv) return
    const ctx = cv.getContext('2d')
    const w = cv.width, h = cv.height, cy = h / 2, cx = w / 2
    let id

    const draw = () => {
      ctx.clearRect(0, 0, w, h)
      const a  = anim.current
      const lx = w * 0.25 + (cx - w * 0.25) * a.mergeT
      const rx = w * 0.75 + (cx - w * 0.75) * a.mergeT
      drawBlochSphere(ctx, lx, cy, QUBIT_R, BASE_RY,   a.qubitsAlpha)
      drawBlochSphere(ctx, rx, cy, QUBIT_R, a.rightRy, a.qubitsAlpha)
      id = requestAnimationFrame(draw)
    }
    draw()
    return () => cancelAnimationFrame(id)
  }, [])

  // ── Animation timeline ────────────────────────────────────────────────────
  useEffect(() => {
    const el  = moduleRef.current
    const a   = anim.current
    const ts  = []
    const ease = t => t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t
    const at   = (delay, fn) => ts.push(setTimeout(fn, delay))
    const beep = () => { if (beepRef.current) beepRef.current.cloneNode().play().catch(() => {}) }

    // Box expansion
    at(420, () => {
      const naturalH = el.getBoundingClientRect().height
      el.style.transition = 'none'
      el.style.height = naturalH + 'px'
      el.getBoundingClientRect() // force reflow
      el.style.transition = 'height 0.7s cubic-bezier(0.4, 0, 0.2, 1)'
      el.style.height = '400px'
    })

    // Type "ESTABLISHING SECURE QUANTUM LINK"
    const T_LINK = 1200
    LINK_TEXT.split('').forEach((_, i) =>
      at(T_LINK + i * CHAR_DELAY, () => setLinkText(LINK_TEXT.slice(0, i + 1)))
    )
    const T_AFTER_LINK = T_LINK + LINK_TEXT.length * CHAR_DELAY

    // Fade in qubits
    const T_QUBITS = T_AFTER_LINK + 400
    at(T_QUBITS, () => {
      setShowCanvas(true)
      const start = performance.now()
      const fade = () => {
        a.qubitsAlpha = Math.min(1, (performance.now() - start) / 400)
        if (a.qubitsAlpha < 1) requestAnimationFrame(fade)
      }
      requestAnimationFrame(fade)
    })

    // Rotate right qubit to match left
    const T_ROTATE = T_QUBITS + 700
    const ROTATE_DUR = 800
    at(T_ROTATE, () => {
      const start   = performance.now()
      const startRy = BASE_RY + Math.PI
      const rotate  = () => {
        const p  = Math.min(1, (performance.now() - start) / ROTATE_DUR)
        a.rightRy = startRy + (BASE_RY - startRy) * ease(p)
        if (p < 1) requestAnimationFrame(rotate)
      }
      requestAnimationFrame(rotate)
    })

    // Merge qubits to centre
    const T_MERGE = T_ROTATE + ROTATE_DUR + 550
    const MERGE_DUR = 600
    at(T_MERGE, () => setLabelsFading(true))
    at(T_MERGE, () => {
      const start = performance.now()
      const merge = () => {
        const p = Math.min(1, (performance.now() - start) / MERGE_DUR)
        a.mergeT = ease(p)
        if (p < 1) requestAnimationFrame(merge)
      }
      requestAnimationFrame(merge)
    })

    // Type result lines
    const T_RESULT = T_MERGE + MERGE_DUR + 400
    RESULT_LINE0.split('').forEach((_, i) =>
      at(T_RESULT + i * CHAR_DELAY, () => setResultLine0(RESULT_LINE0.slice(0, i + 1)))
    )
    const T_LINE1 = T_RESULT + RESULT_LINE0.length * CHAR_DELAY + 150
    RESULT_LINE1.split('').forEach((_, i) =>
      at(T_LINE1 + i * CHAR_DELAY, () => setResultLine1(RESULT_LINE1.slice(0, i + 1)))
    )
    const T_LINE2 = T_LINE1 + RESULT_LINE1.length * CHAR_DELAY + 150
    RESULT_LINE2.split('').forEach((_, i) =>
      at(T_LINE2 + i * CHAR_DELAY, () => setResultLine2(RESULT_LINE2.slice(0, i + 1)))
    )

    // Blink final line 3 times, then fade out all content
    const BLINK_DUR    = 750   // ms per blink cycle
    const CONTENT_FADE = 800   // ms for content fade-out transition
    const T_BLINK      = T_LINE2 + RESULT_LINE2.length * CHAR_DELAY + 400
    at(T_BLINK,                              () => { setBlinkFinal(true); beep() })
    at(T_BLINK + BLINK_DUR,                  beep)
    at(T_BLINK + BLINK_DUR * 2,              beep)
    at(T_BLINK + BLINK_DUR * 3 + 200,        () => setContentFading(true))
    at(T_BLINK + BLINK_DUR * 3 + 200 + CONTENT_FADE, () => setContentGone(true))

    // Stage 2 — key exchange
    const KEY_FADE_DUR = 600   // matches .crypto-key-block transition
    const T_STAGE2 = T_BLINK + BLINK_DUR * 3 + 200 + CONTENT_FADE + 300
    STAGE2_TEXT.split('').forEach((_, i) =>
      at(T_STAGE2 + i * CHAR_DELAY, () => setStage2Text(STAGE2_TEXT.slice(0, i + 1)))
    )

    // Key block 1 (private)
    const T_SHOW_KEY  = T_STAGE2 + STAGE2_TEXT.length * CHAR_DELAY + 300
    at(T_SHOW_KEY,                          () => setShowKey(true))
    at(T_SHOW_KEY + 1500,                   () => setKeyFading(true))
    at(T_SHOW_KEY + 1500 + KEY_FADE_DUR,    () => setKey1Gone(true))

    // Key block 2 (remote) — stays visible
    const T_SHOW_KEY2 = T_SHOW_KEY + 1500 + KEY_FADE_DUR + 150
    at(T_SHOW_KEY2, () => setShowKey2(true))

    // Final lines start while key 2 is still showing
    const T_FINAL = T_SHOW_KEY2 + 1500
    FINAL_LINE0.split('').forEach((_, i) =>
      at(T_FINAL + i * CHAR_DELAY, () => setFinalLine0(FINAL_LINE0.slice(0, i + 1)))
    )
    const T_FINAL1 = T_FINAL + FINAL_LINE0.length * CHAR_DELAY + 200
    FINAL_LINE1.split('').forEach((_, i) =>
      at(T_FINAL1 + i * CHAR_DELAY, () => setFinalLine1(FINAL_LINE1.slice(0, i + 1)))
    )
    const T_FINAL2 = T_FINAL1 + FINAL_LINE1.length * CHAR_DELAY + 200
    FINAL_LINE2.split('').forEach((_, i) =>
      at(T_FINAL2 + i * CHAR_DELAY, () => setFinalLine2(FINAL_LINE2.slice(0, i + 1)))
    )

    // Blink "IDENTITY VERIFIED." then call onComplete
    const T_BLINK2 = T_FINAL2 + FINAL_LINE2.length * CHAR_DELAY + 400
    at(T_BLINK2,                          () => {
      setBlinkIdentity(true)
      beep()
      if (humGainRef.current && humCtxRef.current) {
        const g = humGainRef.current.gain
        g.setValueAtTime(g.value, humCtxRef.current.currentTime)
        g.linearRampToValueAtTime(0, humCtxRef.current.currentTime + 2)
      }
    })
    at(T_BLINK2 + BLINK_DUR,             beep)
    at(T_BLINK2 + BLINK_DUR * 2,         beep)
    at(T_BLINK2 + BLINK_DUR * 3 + 1000,  () => { if (onComplete) onComplete() })

    return () => ts.forEach(clearTimeout)
  }, [])

  return (
    <div className="crypto-module" ref={moduleRef}>
      <div className="crypto-module-title">CRYPTOGRAPHY MODULE</div>
      {!contentGone && (
        <div className={`crypto-content${contentFading ? ' crypto-content--fading' : ''}`}>
          {linkText    && <div className="crypto-link-text">{linkText}</div>}
          <div className="crypto-canvas-wrap">
            <canvas
              ref={canvasRef}
              className={`crypto-canvas${showCanvas ? ' crypto-canvas--visible' : ''}`}
              width={280}
              height={120}
            />
            {showCanvas && (
              <div className={`crypto-qubit-labels${labelsFading ? ' crypto-qubit-labels--fading' : ''}`}>
                <span className="crypto-qubit-label" style={{ left: '25%' }}>LOCAL QBIT</span>
                <span className="crypto-qubit-label" style={{ left: '75%' }}>REMOTE QBIT</span>
              </div>
            )}
          </div>
          <div className="crypto-result-slot">
            {resultLine0 && <div className="crypto-result-line">{resultLine0}</div>}
            {resultLine1 && <div className="crypto-result-line">{resultLine1}</div>}
            {resultLine2 && (
              <div className={`crypto-result-line crypto-result-line--final${blinkFinal ? ' crypto-result-line--blinking' : ''}`}>
                {resultLine2}
              </div>
            )}
          </div>
        </div>
      )}
      {contentGone && (
        <div className="crypto-content">
          {stage2Text && <div className="crypto-link-text">{stage2Text}</div>}
          <div className="crypto-key-slot">
            {showKey && !key1Gone && (
              <pre className={`crypto-key-block${keyFading ? ' crypto-key-block--fading' : ''}`}>
                {KEY_BLOCK}
              </pre>
            )}
            {showKey2 && (
              <pre className="crypto-key-block">
                {KEY_BLOCK_2}
              </pre>
            )}
          </div>
          <div className="crypto-final-slot">
            {finalLine0 && <div className="crypto-final-line">{finalLine0}</div>}
            {finalLine1 && <div className="crypto-final-line">{finalLine1}</div>}
            {finalLine2 && (
              <div className={`crypto-final-line crypto-final-line--identity${blinkIdentity ? ' crypto-final-line--blinking' : ''}`}>
                {finalLine2}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
