export default function HudHeader({ onLogout, center, right }) {
  return (
    <header className="hud-header">
      <div className="header-left">
        <span className="brand brand-link" onClick={onLogout} title="Return to login">
          ⬢ IMPERIAL SPACE FORCE // HMSS &quot;HER ANNUNCIATOR&quot;
        </span>
      </div>
      <div className="header-center">{center}</div>
      <div className="header-right">{right}</div>
    </header>
  )
}
