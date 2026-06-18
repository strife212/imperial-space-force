// ── Unused / archived panels ──────────────────────────────────────────────────
// These panels have been removed from the main layout but kept here for reference.

// ── Physics Package Loadout (was PNL-003, replaced by X-Band Radio) ───────────
export function LoadoutPanel({ litClass, lowPower, grbBarRef }) {
  return (
    <section className={`panel${litClass}${lowPower ? ' panel--low-power' : ''}`} id="panel-loadout">
      <header className="panel-header">
        <span className="bullet" /><h2>PHYSICS PACKAGE LOADOUT</h2>
        <span className="panel-id">PNL-003 / ORDNANCE</span>
      </header>
      <div className="panel-body">
        <div className="weapon" data-weapon="kn">
          <div className="weapon-row"><span className="weapon-name">KERR–NEWMAN WARHEAD ×4</span><span className="weapon-state ready">READY</span></div>
          <div className="weapon-meta">a = 0.998 M ⋅ Q = 0.043 M</div>
          <div className="bar"><div className="bar-fill" style={{ width: '96%' }} /></div>
        </div>
        <div className="weapon" data-weapon="exotic">
          <div className="weapon-row"><span className="weapon-name">EXOTIC-MATTER LANCE (ρ &lt; 0)</span><span className="weapon-state ready">READY</span></div>
          <div className="weapon-meta">CASIMIR FLUX 4.7 × 10⁻⁹ N·m⁻²</div>
          <div className="bar"><div className="bar-fill" style={{ width: '78%' }} /></div>
        </div>
        <div className="weapon" data-weapon="grb">
          <div className="weapon-row"><span className="weapon-name">COLLIMATED GRB EMITTER</span><span className="weapon-state charging">CHARGING</span></div>
          <div className="weapon-meta">E<sub>iso</sub> ≈ 10⁵² erg ⋅ θ<sub>j</sub> = 0.04 rad</div>
          <div className="bar"><div className="bar-fill charging-bar" ref={grbBarRef} style={{ width: '34%' }} /></div>
        </div>
        <div className="weapon" data-weapon="rkv">
          <div className="weapon-row"><span className="weapon-name">RELATIVISTIC KINETIC SLUG ×12</span><span className="weapon-state ready">READY</span></div>
          <div className="weapon-meta">γ = 4.2 ⋅ M<sub>0</sub> = 1.4 t</div>
          <div className="bar"><div className="bar-fill" style={{ width: '100%' }} /></div>
        </div>
      </div>
      {lowPower && <div className="low-power-overlay" />}
    </section>
  )
}
