import { useState } from 'react'

export default function LoginScreen({ onComplete }) {
  const [exiting, setExiting] = useState(false)

  const handleLogin = () => {
    setExiting(true)
    setTimeout(onComplete, 700)
  }

  return (
    <div id="login-screen" className={exiting ? 'fade-out' : ''}>
      <div className="login-inner">
        <div className="boot-header">
          <img className="boot-emblem" src="/logo.png" alt="Imperial Space Force Emblem" />
          <div className="boot-title">IMPERIAL SPACE FORCE</div>
          <div className="boot-subtitle">
            TACTICAL COMMAND INTERFACE // HMSS &quot;HER ANNUNCIATOR&quot; // FIRE CONTROL SYSTEM v6.2.41
          </div>
          <div className="boot-divider" />
        </div>

        <div className="login-form">
          <div className="login-field-row">
            <label className="login-label">OPERATOR ID</label>
            <input
              className="login-input"
              type="text"
              defaultValue="HIH V. ASTRAIA // CLR-Ω"
              readOnly
              tabIndex={-1}
            />
          </div>
          <div className="login-field-row">
            <label className="login-label">ACCESS CODE</label>
            <input
              className="login-input"
              type="password"
              defaultValue="████████████"
              readOnly
              tabIndex={-1}
            />
          </div>
          <button className="login-btn" onClick={handleLogin}>
            AUTHENTICATE &amp; ENTER
          </button>
        </div>

        <div className="login-anthem">
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
          <p>
            And should a world forget its part<br />
            Or lose the chord that holds the art<br />
            Thy hand shall send the lance of light<br />
            A single tone to set it right.
          </p>
        </div>
      </div>
    </div>
  )
}
