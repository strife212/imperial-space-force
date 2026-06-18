import { useRef, useEffect, useCallback, useState } from 'react'
import { useScreenScale } from '../hooks/useScreenScale'

export default function StartScreen({ onSkirmish, onDebug }) {
  const clickSfx = useRef(null)
  const innerRef = useScreenScale()
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const audio = new Audio(`${import.meta.env.BASE_URL}click.wav`)
    audio.preload = 'auto'
    clickSfx.current = audio
  }, [])

  useEffect(() => {
    const id = setTimeout(() => setVisible(true), 80)
    return () => clearTimeout(id)
  }, [])

  const playClick = useCallback((fn) => () => {
    if (clickSfx.current) {
      clickSfx.current.currentTime = 0
      clickSfx.current.play().catch(() => {})
    }
    fn?.()
  }, [])

  return (
    <div id="menu-screen">
      <div className="login-inner" ref={innerRef}>
        <div className="boot-header">
          <img className="boot-emblem" src={`${import.meta.env.BASE_URL}logo.png`} alt="Imperial Space Force Emblem" />
          <div className="boot-title">IMPERIAL SPACE FORCE</div>
          <div className="boot-divider" />
        </div>

        <div className={`menu-content${visible ? ' menu-content--visible' : ''}`}>
          <div className="menu-buttons">
            <button className="menu-btn menu-btn--primary menu-btn--disabled" disabled>
              CAMPAIGN
            </button>
            <button className="menu-btn menu-btn--primary" onClick={playClick(onSkirmish)}>
              SKIRMISH BATTLE
            </button>
          </div>
        </div>
      </div>
      <footer className="login-footer">
        <button className="login-debug-link" onClick={onDebug}>debug</button>
      </footer>
    </div>
  )
}
