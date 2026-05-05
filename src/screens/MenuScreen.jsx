import { useRef, useEffect, useCallback, useState } from 'react'

export default function MenuScreen({ onManage, onLogout }) {
  const clickSfx   = useRef(null)
  const [infoHover, setInfoHover] = useState(false)
  const [visible,   setVisible]   = useState(false)

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
      <div className="login-inner">
        <div className="boot-header">
          <img className="boot-emblem" src={`${import.meta.env.BASE_URL}logo.png`} alt="Imperial Space Force Emblem" />
          <div className="boot-title">IMPERIAL SPACE FORCE</div>
          <div className="boot-subtitle">
            TACTICAL COMMAND INTERFACE // HMSS &quot;HER ANNUNCIATOR&quot; // FIRE CONTROL SYSTEM v6.2.41
          </div>
          <div className="boot-divider" />
        </div>

        <div className={`menu-content${visible ? ' menu-content--visible' : ''}`}>
          <div
            className="menu-ship-wrap"
            onMouseEnter={() => setInfoHover(true)}
            onMouseLeave={() => setInfoHover(false)}
          >
            <img
              className="menu-ship-img"
              src={`${import.meta.env.BASE_URL}shipclear.png`}
              alt="HMSS Her Annunciator"
            />
            <div className="menu-ship-label">
              HMSS &quot;HER ANNUNCIATOR&quot; // IMPERIAL ORBITAL WEAPONS PLATFORM // CLASS: ANNUNCIATOR-I
            </div>
            <div className={`menu-info-panel${infoHover ? ' visible' : ''}`}>
              <div className="lip-heading">PLATFORM DOSSIER</div>
              <div className="lip-divider" />
              <div className="lip-row"><span className="lip-label">CLASS</span><span className="lip-value">ANNUNCIATOR CLASS</span></div>
              <div className="lip-row"><span className="lip-label">NAME</span><span className="lip-value">HER ANNUNCIATOR</span></div>
              <div className="lip-row"><span className="lip-label">TYPE</span><span className="lip-value">IMPERIAL ORBITAL WEAPONS PLATFORM</span></div>
              <div className="lip-row"><span className="lip-label">PURPOSE</span><span className="lip-value">STRATEGIC DETERRENCE</span></div>
              <div className="lip-divider" />
              <div className="lip-body">Mass driving railgun capable of delivering multiple physics packages to any planetary surface.</div>
            </div>
          </div>

          <div className="menu-buttons">
            <button className="menu-btn menu-btn--primary" onClick={playClick(onManage)}>
              MANAGE ORBITAL WEAPONS PLATFORM
            </button>
            <button className="menu-btn menu-btn--secondary" onClick={playClick(onLogout)}>
              LOG OUT
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
