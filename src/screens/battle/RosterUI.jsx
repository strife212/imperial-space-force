import { useState, useRef, useEffect } from 'react'
import * as THREE from 'three'
import {
  TEAMS, CAP_HP, CAP_WEAPONS, CAP_SPEED, ARMOR_FLAGSHIP, BOMBER_HP, BOMB_DMG, BOMBER_SPEED,
  ARMOR_BOMBER, SHIP_HP, MAX_SPEED, ARMOR_FIGHTER, splitCapName, compStrength, FLEET_BUDGET,
  COMMS_PORTRAIT, PTS_BOMBER, PTS_FIGHTER, RED_CAP_NAME,
} from './constants'
import { buildBlueModel, buildRedModel, buildBlueCapital, buildRedCapital, buildBlueBomber, buildRedBomber } from './geometry'

// Render the revealed slice of segmented body text, honouring \n line breaks
// and per-segment colour classes (used for the typewriter effect).
function renderCommsBody(segments, revealed) {
  const out = []
  let remaining = revealed, key = 0
  for (const seg of segments) {
    if (remaining <= 0) break
    const shown = seg.text.slice(0, remaining)
    remaining -= shown.length
    shown.split('\n').forEach((line, i) => {
      if (i > 0) out.push(<br key={key++} />)
      if (line) out.push(<span key={key++} className={seg.cls || undefined}>{line}</span>)
    })
  }
  return out
}

// ── 2D ship sprites (top-down silhouettes) for the pre-battle order of battle —
// They echo the 3D hulls: blue = sleek delta interceptor / dagger flagship,
// red = forked marauder / blocky battlecruiser.
const SPRITE_PATHS = {
  blueFighter: 'M12 2 L15 13 L21 20 L12 17 L3 20 L9 13 Z',
  redFighter:  'M6 3 L12 11 L18 3 L16 9 L21 21 L12 17 L3 21 L8 9 Z',
  blueBomber:  'M12 2 L16 11 L21 20 L13 17 L13 21 L11 21 L11 17 L3 20 L8 11 Z',
  redBomber:   'M5 3 L12 10 L19 3 L17 10 L22 21 L15 18 L12 21 L9 18 L2 21 L7 10 Z',
  blueCapital: 'M12 2 L16 24 L15 52 L18 61 L12 57 L6 61 L9 52 L8 24 Z',
  redCapital:  'M14 3 L20 12 L20 20 L25 26 L25 34 L20 38 L20 56 L16 61 L12 61 L8 56 L8 38 L3 34 L3 26 L8 20 L8 12 Z',
}
const SPRITE_SUFFIX = { capital: 'Capital', bomber: 'Bomber', fighter: 'Fighter' }
function ShipSprite({ team, kind }) {
  const cap = kind === 'capital'
  const vb = cap ? (team === 'blue' ? '0 0 24 64' : '0 0 28 64') : '0 0 24 24'
  return (
    <svg className={`sb-sprite sb-sprite--${team}${cap ? ' sb-sprite--cap' : ''}${kind === 'bomber' ? ' sb-sprite--bomber' : ''}`} viewBox={vb} aria-hidden="true">
      <path d={SPRITE_PATHS[team + SPRITE_SUFFIX[kind]]} />
    </svg>
  )
}
function CountAdjust({ count, cost, free, onAdjust }) {
  return (
    <span className="sb-brief-adj">
      <button className="sb-brief-adj-btn" onClick={() => onAdjust(-1)} disabled={count <= 0} aria-label="Remove">−</button>
      <button className="sb-brief-adj-btn" onClick={() => onAdjust(1)} disabled={free < cost} aria-label="Add">+</button>
    </span>
  )
}

// ── Pre-battle ship info tooltips ────────────────────────────────────────────
const SHIP_INFO = {
  capital: { hp: CAP_HP,    dmg: `${CAP_WEAPONS} × 1`, speed: CAP_SPEED,    armor: ARMOR_FLAGSHIP, notes: [] },
  bomber:  { hp: BOMBER_HP, dmg: BOMB_DMG,             speed: BOMBER_SPEED, armor: ARMOR_BOMBER,   notes: ['Can only target capital ships'] },
  fighter: { hp: SHIP_HP,   dmg: 1,                    speed: MAX_SPEED,    armor: ARMOR_FIGHTER,  notes: [] },
}
const shipClass = (kind, team) =>
  kind === 'capital' ? 'Capital Ship'
  : kind === 'bomber' ? 'Heavy Bomber'
  : team === 'blue' ? 'Interceptor' : 'Marauder'
const buildShipGeo = (kind, team) =>
  kind === 'capital' ? (team === 'blue' ? buildBlueCapital() : buildRedCapital())
  : kind === 'bomber' ? (team === 'blue' ? buildBlueBomber() : buildRedBomber())
  : (team === 'blue' ? buildBlueModel() : buildRedModel())

// A small WebGL viewport that slowly spins a ship model (mounted only while a tip is open)
function ShipModel3D({ kind, team }) {
  const ref = useRef(null)
  useEffect(() => {
    const mount = ref.current
    const w = mount.clientWidth || 186, h = mount.clientHeight || 116
    const scene = new THREE.Scene()
    const cam = new THREE.PerspectiveCamera(42, w / h, 0.1, 100)
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio))
    renderer.setSize(w, h)
    mount.appendChild(renderer.domElement)
    scene.add(new THREE.AmbientLight(0x90a8d0, 0.7))
    const key = new THREE.DirectionalLight(0xffffff, 1.2); key.position.set(3, 5, 4); scene.add(key)
    const rim = new THREE.DirectionalLight(TEAMS[team].color, 0.8); rim.position.set(-4, -1, -3); scene.add(rim)
    const geo = buildShipGeo(kind, team); geo.center(); geo.computeBoundingSphere()
    const mat = new THREE.MeshStandardMaterial({ color: TEAMS[team].color, emissive: TEAMS[team].color, emissiveIntensity: 0.32, metalness: 0.6, roughness: 0.4 })
    const mesh = new THREE.Mesh(geo, mat); scene.add(mesh)
    const r = geo.boundingSphere.radius
    cam.position.set(0, r * 0.65, r * 2.5); cam.lookAt(0, 0, 0)
    let raf, last = performance.now()
    const loop = () => {
      const now = performance.now(); const dt = (now - last) / 1000; last = now
      mesh.rotation.y += dt * 0.6   // slow turntable spin
      renderer.render(scene, cam)
      raf = requestAnimationFrame(loop)
    }
    loop()
    return () => { cancelAnimationFrame(raf); renderer.domElement.remove(); geo.dispose(); mat.dispose(); renderer.dispose() }
  }, [kind, team])
  return <div className="sb-info-model" ref={ref} />
}

// Info icon that reveals a stat panel with a spinning 3D model on hover
function ShipInfoTip({ kind, team }) {
  const [open, setOpen] = useState(false)
  const info = SHIP_INFO[kind]
  return (
    <span className="sb-info" onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}>
      <span className="sb-info-icon" aria-label={`${shipClass(kind, team)} info`}>
        <svg viewBox="0 0 12 12" aria-hidden="true"><circle cx="6" cy="3" r="1.3" /><rect x="4.85" y="4.9" width="2.3" height="5" rx="1.15" /></svg>
      </span>
      {open && (
        <div className={`sb-info-panel sb-info-panel--${team}`}>
          <div className="sb-info-title">{shipClass(kind, team)}</div>
          <ShipModel3D kind={kind} team={team} />
          <div className="sb-info-stats">
            <div className="sb-info-stat"><span>Health</span><b>{info.hp}</b></div>
            <div className="sb-info-stat"><span>Damage</span><b>{info.dmg}</b></div>
            <div className="sb-info-stat"><span>Speed</span><b>{info.speed}</b></div>
            <div className="sb-info-stat"><span>Armor</span><b>{info.armor}%</b></div>
          </div>
          {info.notes.length > 0 && (
            <div className="sb-info-notes">{info.notes.map((n, i) => <div key={i}>▸ {n}</div>)}</div>
          )}
        </div>
      )}
    </span>
  )
}
function TeamRoster({ team, capName, onCycleName, comp, onAdjust }) {
  const { prefix, name } = splitCapName(capName)
  const strength = compStrength(comp)
  const free = FLEET_BUDGET - strength
  return (
    <div className={`sb-brief-team sb-brief-team--${team}`}>
      <div className="sb-brief-team-title">{team === 'blue' ? 'BLUE FLEET' : 'RED FLEET'}</div>
      <div className="sb-brief-cap">
        <img className="sb-brief-portrait" src={COMMS_PORTRAIT[team]} alt="" />
        <ShipSprite team={team} kind="capital" />
        <div className="sb-brief-cap-info">
          {prefix && <div className="sb-cap-prefix">{prefix}</div>}
          <div className="sb-brief-cap-name">{name}</div>
          <div className="sb-brief-cap-class">CAPITAL SHIP <ShipInfoTip kind="capital" team={team} /></div>
        </div>
        {onCycleName && (
          <button className="sb-cap-cycle" onClick={onCycleName} title="Randomise name" aria-label="Randomise name">↻</button>
        )}
      </div>
      <div className="sb-brief-fighters-label">
        <span>BOMBERS <ShipInfoTip kind="bomber" team={team} /> <span className="sb-brief-fighters-count">×{comp.bombers}</span></span>
        <CountAdjust count={comp.bombers} cost={PTS_BOMBER} free={free} onAdjust={(d) => onAdjust('bombers', d)} />
      </div>
      <div className="sb-brief-fighters sb-brief-bombers">
        {Array.from({ length: comp.bombers }, (_, i) => <ShipSprite key={i} team={team} kind="bomber" />)}
      </div>
      <div className="sb-brief-fighters-label">
        <span>FIGHTERS <ShipInfoTip kind="fighter" team={team} /> <span className="sb-brief-fighters-count">×{comp.fighters}</span></span>
        <CountAdjust count={comp.fighters} cost={PTS_FIGHTER} free={free} onAdjust={(d) => onAdjust('fighters', d)} />
      </div>
      <div className="sb-brief-fighters">
        {Array.from({ length: comp.fighters }, (_, i) => <ShipSprite key={i} team={team} kind="fighter" />)}
      </div>
      <div className="sb-brief-strength">
        <span className="sb-brief-strength-label">FLEET STRENGTH</span>
        <span className="sb-brief-strength-val">{strength}<span className="sb-brief-strength-max">/{FLEET_BUDGET}</span></span>
      </div>
    </div>
  )
}

// The pre-battle order-of-battle screen: a START control over both fleet rosters.
// State (composition, names) lives in the parent and is passed in as props.
function Briefing({ comp, blueCapName, onCycleBlueName, onAdjust, onStart }) {
  return (
    <div className="sb-briefing">
      <div className="sb-brief-head">
        <div className="sb-brief-sub">FLEET ENGAGEMENT // ORDER OF BATTLE</div>
        <button className="sb-brief-start" onClick={onStart}>▶ START BATTLE</button>
      </div>
      <div className="sb-brief-teams">
        <TeamRoster team="blue" capName={blueCapName} onCycleName={onCycleBlueName} comp={comp.blue} onAdjust={(kind, d) => onAdjust('blue', kind, d)} />
        <TeamRoster team="red" capName={RED_CAP_NAME} comp={comp.red} onAdjust={(kind, d) => onAdjust('red', kind, d)} />
      </div>
    </div>
  )
}

export { Briefing, TeamRoster, ShipSprite, renderCommsBody }
