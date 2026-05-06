import { useRef, useEffect } from 'react'

const VIZ_W     = 200
const VIZ_H     = 72
const BAR_COUNT = 28

export default function AudioSpectrograph({ analyser, name, subtitle, onStop }) {
  const canvasRef = useRef(null)
  const rafRef    = useRef(null)

  useEffect(() => {
    if (!analyser) return

    const drawBars = () => {
      const canvas = canvasRef.current
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

      rafRef.current = requestAnimationFrame(drawBars)
    }
    drawBars()

    return () => cancelAnimationFrame(rafRef.current)
  }, [analyser])

  return (
    <div className="anthem-viz-popup">
      <div className="anthem-viz-title">AUDIO SPECTROGRAPH</div>
      {name     && <div className="anthem-viz-name">{name}</div>}
      {subtitle && <div className="anthem-viz-subtitle">{subtitle}</div>}
      <canvas
        ref={canvasRef}
        className="anthem-viz-canvas"
        width={VIZ_W}
        height={VIZ_H}
      />
      <button className="anthem-stop-btn" onClick={onStop}>■ STOP</button>
    </div>
  )
}
