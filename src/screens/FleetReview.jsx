import { useRef, useEffect, useState } from 'react'
import * as THREE from 'three'
import HudHeader from '../components/HudHeader'
import { createStage } from './cutscene/stage'
import { buildReviewFleet } from './buildReviewFleet'
import { buildBlueModel } from './battle/geometry'
import { SHIP_COST, getFleet, setFleet as storeSetFleet, getCredits, spendCredits, addCredits, getFlagshipName, getUnsellableFighters, getUpgrades, UPGRADE_INFO } from '../lib/campaign'
import { getFlag } from '../lib/store'
import { playLanceCharge } from '../lib/lanceSfx'
import './fleet-review.css'

const KINDS = [
  { key: 'fighters', label: 'Interceptors' },
  { key: 'bombers',  label: 'Heavy Bombers' },
  { key: 'cruisers', label: 'Missile Cruisers' },
]

// The chosen operator's single elite skill — previewable here (visuals only).
const ELITE_SKILLS = [
  { match: 'ASTRAIA',  key: 'lance', name: 'LANCE STRIKE', hint: 'Spinal lance — fires forward' },
  { match: 'SEVERINE', key: 'ace',   name: 'FIGHTER ACE',  hint: 'Gold fighter warps in & out' },
  { match: 'LUCIA',    key: 'nano',  name: 'NANO REPAIR',  hint: 'Nanite repair swarm' },
]
const eliteForOperator = (name) => {
  if (!name) return null
  const up = name.toUpperCase()
  return ELITE_SKILLS.find(e => up.includes(e.match)) || null
}
// Preview durations (ms) — re-enable the button once the effect finishes.
const SKILL_PREVIEW_MS = { lance: 2700, ace: 6800, nano: 3300 }

// A 3D parade of the player's standing fleet that doubles as a fleet editor:
// add / remove ships at their proper Requisition cost (full refund on removal,
// matching the shipyard) and watch the formation rebuild in real time.
export default function FleetReview({ onExit, backLabel = '◂ RETURN TO MAP' }) {
  const mountRef = useRef(null)
  const [fleet, setFleet] = useState(getFleet)
  const [credits, setCredits] = useState(getCredits)
  const flagshipName = getFlagshipName()
  const fleetName = getFlag('fleetName') || 'Fleet Polyhymnia'
  const elite = eliteForOperator(getFlag('operator'))
  // the parade includes permanent (unsellable) fighters on top of the buyable fleet
  const withPermanent = (f) => ({ ...f, fighters: f.fighters + getUnsellableFighters() })

  // chosen roguelike upgrades, grouped by category for the summary list
  const upgradeGroups = (() => {
    const g = { capital: [], fleet: [] }
    for (const [id, lvl] of Object.entries(getUpgrades())) {
      const info = UPGRADE_INFO[id]
      if (lvl > 0 && info) g[info.category].push({ name: info.name, lvl })
    }
    return g
  })()
  const hasUpgrades = upgradeGroups.capital.length > 0 || upgradeGroups.fleet.length > 0

  const rebuildRef = useRef(null)   // set by the scene; call with a comp to rebuild
  const playSkillRef = useRef(null) // set by the scene; call with a skill key to preview it
  const skillTimerRef = useRef(null)
  const [skillPlaying, setSkillPlaying] = useState(false)

  // Play the operator's elite skill in the parade (visual only)
  const previewSkill = () => {
    if (!elite || skillPlaying) return
    if (playSkillRef.current?.(elite.key)) {
      setSkillPlaying(true)
      clearTimeout(skillTimerRef.current)
      skillTimerRef.current = setTimeout(() => setSkillPlaying(false), SKILL_PREVIEW_MS[elite.key] || 3000)
    }
  }
  useEffect(() => () => clearTimeout(skillTimerRef.current), [])

  useEffect(() => {
    const mount = mountRef.current
    if (!mount) return
    const el = 0.40   // camera elevation (radians)
    const sceneDef = {
      bloom: 0.75,
      create(ctx) {
        const { camera, scene, fx, orient } = ctx
        const Y = new THREE.Vector3(0, 1, 0), FWD = new THREE.Vector3(1, 0, 0)
        const _a = new THREE.Vector3(), _b = new THREE.Vector3()
        let current = null
        const targetCenter = new THREE.Vector3()
        const curCenter = new THREE.Vector3()
        let targetDist = 100, curDist = 100, first = true

        // ── Elite-skill preview effects (visual only — no combat) ─────────────
        const skillFX = { kind: null, t: 0, dur: 0, meshes: [], disp: [], state: null }
        const trackMesh = (m) => { scene.add(m); skillFX.meshes.push(m); return m }
        const trackDisp = (...ds) => { for (const d of ds) skillFX.disp.push(d) }
        const clearSkill = () => {
          if (skillFX.state && skillFX.state.discharge) { skillFX.state.discharge(false); skillFX.state.discharge = null }  // cut charge if it never fired
          for (const m of skillFX.meshes) scene.remove(m)
          for (const d of skillFX.disp) d && d.dispose && d.dispose()
          skillFX.meshes.length = 0; skillFX.disp.length = 0; skillFX.kind = null; skillFX.state = null
        }

        // LANCE: the flagship charges, then looses a beam straight forward (+X)
        const playLance = () => {
          current.group.children[0].getWorldPosition(_a)
          const muzzle = _a.clone().addScaledVector(FWD, 16)
          const orbMat = new THREE.MeshBasicMaterial({ color: 0xeaf6ff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false })
          const orb = new THREE.Mesh(fx.blastGeo, orbMat); orb.scale.setScalar(0.6); orb.position.copy(muzzle)
          trackMesh(orb); trackDisp(orbMat)
          skillFX.kind = 'lance'; skillFX.t = 0; skillFX.dur = 2.6
          skillFX.state = { muzzle, orb, orbMat, fired: false, core: null, glow: null, discharge: playLanceCharge() }
        }
        const fireLance = (st) => {
          const len = 175, mid = st.muzzle.clone().addScaledVector(FWD, len / 2)
          const beam = (color, w, op) => {
            const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: op, blending: THREE.AdditiveBlending, depthWrite: false })
            const m = new THREE.Mesh(fx.trailGeo, mat)
            m.position.copy(mid); m.quaternion.setFromUnitVectors(Y, FWD); m.scale.set(w, len, w)
            trackMesh(m); trackDisp(mat); return m
          }
          st.glow = beam(0x8fc6ff, 3.6, 0.75)
          st.core = beam(0xffffff, 1.3, 1)
          if (st.discharge) { st.discharge(); st.discharge = null }   // cut the charge tone + fire the boom
          fx.blast(st.muzzle, true)
          for (let i = 0; i < 12; i++) fx.ember(st.muzzle.clone().add(_b.set((Math.random() - 0.5) * 5, (Math.random() - 0.5) * 5, (Math.random() - 0.5) * 5)), i % 2 ? 0xbfe2ff : 0x9fd4ff)
        }

        // ACE: a gold fighter warps in, loiters ~5s, then warps out
        const playAce = () => {
          const geo = buildBlueModel()
          const mat = new THREE.MeshStandardMaterial({ color: 0xffc63a, emissive: 0xffae1f, emissiveIntensity: 0.85, metalness: 0.7, roughness: 0.3 })
          const glowMat = new THREE.MeshBasicMaterial({ color: 0xffd56a, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false })
          const mesh = new THREE.Group()
          mesh.add(new THREE.Mesh(geo, mat))
          const glow = new THREE.Mesh(fx.blastGeo, glowMat); glow.scale.setScalar(0.42); glow.position.set(0, 0, -0.95); mesh.add(glow)
          mesh.scale.setScalar(1.3)
          const home = new THREE.Vector3(30, 14, 0)
          const inFrom = home.clone().add(new THREE.Vector3(50, 22, 135))
          const outTo = home.clone().add(new THREE.Vector3(-30, 30, 150))
          mesh.position.copy(inFrom)
          trackMesh(mesh); trackDisp(geo, mat, glowMat)
          skillFX.kind = 'ace'; skillFX.t = 0; skillFX.dur = 6.7
          skillFX.state = { mesh, home, inFrom, outTo, exitFrom: null, trailIn: fx.makeTrail(0xffd56a, 7), trailOut: fx.makeTrail(0xffd56a, 7) }
        }

        // NANO: a green nanite glow + orbiting motes wash over every ship for 3s
        const playNano = () => {
          const items = []
          for (const child of current.group.children) {
            const pos = child.getWorldPosition(new THREE.Vector3())
            const s = child.scale.x || 1
            const auraR = s * 2.4, moteR = s * 4
            const auraMat = new THREE.MeshBasicMaterial({ color: 0x49ff9c, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false })
            const aura = new THREE.Mesh(fx.blastGeo, auraMat); aura.scale.setScalar(auraR); aura.position.copy(pos)
            trackMesh(aura); trackDisp(auraMat)
            const parts = [], nP = s > 2 ? 8 : 4
            for (let i = 0; i < nP; i++) {
              const axis = new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize()
              const u = new THREE.Vector3().crossVectors(axis, Math.abs(axis.y) < 0.9 ? Y : FWD).normalize()
              const v = new THREE.Vector3().crossVectors(axis, u).normalize()
              const mMat = new THREE.MeshBasicMaterial({ color: 0x9dffc8, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false })
              const mm = new THREE.Mesh(fx.blastGeo, mMat); mm.scale.setScalar(s > 2 ? 0.6 : 0.26)
              trackMesh(mm); trackDisp(mMat)
              parts.push({ mesh: mm, u, v, ang: Math.random() * Math.PI * 2, rad: moteR * (0.8 + Math.random() * 0.4), speed: (1.6 + Math.random() * 1.8) * (Math.random() < 0.5 ? 1 : -1) })
            }
            items.push({ pos, aura, auraMat, auraR, parts })
          }
          skillFX.kind = 'nano'; skillFX.t = 0; skillFX.dur = 3.2
          skillFX.state = { items }
        }

        const play = (key) => {
          if (skillFX.kind || !current) return false
          if (key === 'lance') playLance()
          else if (key === 'ace') playAce()
          else if (key === 'nano') playNano()
          else return false
          return true
        }
        playSkillRef.current = play

        const skillTick = (dt) => {
          if (!skillFX.kind) return
          skillFX.t += dt
          const st = skillFX.state
          if (skillFX.kind === 'lance') {
            if (skillFX.t < 1.5) {
              const p = skillFX.t / 1.5
              st.orb.scale.setScalar(0.6 + p * 3.6); st.orbMat.opacity = 0.5 + 0.5 * p
            } else {
              if (!st.fired) { st.fired = true; fireLance(st) }
              const fade = Math.max(0, 1 - (skillFX.t - 1.5) / 1.1), flick = 0.8 + 0.2 * Math.sin(skillFX.t * 60)
              st.orbMat.opacity = fade; st.orb.scale.setScalar(Math.max(0.2, 4 * fade))
              if (st.core) st.core.material.opacity = fade * flick
              if (st.glow) st.glow.material.opacity = 0.75 * fade
            }
          } else if (skillFX.kind === 'ace') {
            const m = st.mesh, t = skillFX.t
            if (t < 0.7) {
              const p = t / 0.7, e = 1 - Math.pow(1 - p, 3)
              m.position.lerpVectors(st.inFrom, st.home, e)
              orient(m, _a.subVectors(st.home, st.inFrom))
              m.scale.set(1.3, 1.3, 1.3 * (1 + Math.pow(1 - p, 3) * 12))
              st.trailIn(m.position)
            } else if (t < 5.7) {
              const a = (t - 0.7) * 1.05, R = 30
              _a.set(Math.cos(a) * R, 14 + Math.sin(a * 1.3) * 3, Math.sin(a) * R)
              orient(m, _b.subVectors(_a, m.position), 0.3)
              m.position.copy(_a); m.scale.set(1.3, 1.3, 1.3)
            } else {
              if (!st.exitFrom) st.exitFrom = m.position.clone()
              const p = Math.min(1, (t - 5.7) / 0.7), e = Math.pow(p, 3)
              m.position.lerpVectors(st.exitFrom, st.outTo, e)
              orient(m, _a.subVectors(st.outTo, st.exitFrom))
              m.scale.set(1.3, 1.3, 1.3 * (1 + e * 14))
              st.trailOut(m.position)
            }
          } else if (skillFX.kind === 'nano') {
            const p = skillFX.t / 3.2, env = Math.max(0, Math.min(1, p * 5, (1 - p) * 5)), pulse = 0.9 + 0.12 * Math.sin(skillFX.t * 9)
            for (const it of st.items) {
              it.aura.scale.setScalar(it.auraR * pulse); it.auraMat.opacity = env * 0.16
              for (const pt of it.parts) { pt.ang += pt.speed * dt; pt.mesh.position.copy(it.pos).addScaledVector(pt.u, pt.rad * Math.cos(pt.ang)).addScaledVector(pt.v, pt.rad * Math.sin(pt.ang)); pt.mesh.material.opacity = env }
            }
          }
          if (skillFX.t >= skillFX.dur) clearSkill()
        }

        const build = (comp) => {
          clearSkill()
          if (current) current.dispose()
          current = buildReviewFleet(ctx, comp)
          targetCenter.copy(current.center)
          const fov = (camera.fov * Math.PI) / 180
          targetDist = (current.radius / Math.sin(fov / 2)) * 0.92
          if (first) { curCenter.copy(targetCenter); curDist = targetDist; first = false }
        }
        build(withPermanent(getFleet()))
        rebuildRef.current = build

        let T = 0
        return (dt) => {
          T += dt
          const k = 1 - Math.exp(-4 * dt)          // ease camera as the fleet reflows
          curCenter.lerp(targetCenter, k)
          curDist += (targetDist - curDist) * k
          const az = 0.7 + T * 0.1                  // slow orbit
          camera.position.set(
            curCenter.x + Math.cos(az) * Math.cos(el) * curDist,
            curCenter.y + Math.sin(el) * curDist + current.radius * 0.04,
            curCenter.z + Math.sin(az) * Math.cos(el) * curDist,
          )
          camera.lookAt(curCenter.x, curCenter.y, curCenter.z)
          skillTick(dt)
        }
      },
    }
    const teardown = createStage(mount, sceneDef, {})
    return () => { rebuildRef.current = null; playSkillRef.current = null; teardown() }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // persist + refresh UI + rebuild the 3D formation
  const apply = (next) => { storeSetFleet(next); setFleet(next); rebuildRef.current?.(withPermanent(next)) }
  const buy = (key) => {
    const cost = SHIP_COST[key]
    if (getCredits() < cost) return
    spendCredits(cost); setCredits(getCredits())
    apply({ ...getFleet(), [key]: getFleet()[key] + 1 })
  }
  const sell = (key) => {
    if (getFleet()[key] <= 0) return
    addCredits(SHIP_COST[key]); setCredits(getCredits())
    apply({ ...getFleet(), [key]: Math.max(0, getFleet()[key] - 1) })
  }

  return (
    <div id="fleet-review">
      <HudHeader onLogout={onExit} right={<span className="label">FLEET REVIEW</span>} />
      <div className="fr-stage">
        <div className="fr-canvas" ref={mountRef} />

        <div className="fr-topleft">
        <div className="fr-panel">
          <div className="fr-name">{fleetName}</div>
          <div className="fr-flagship">⬢ {flagshipName} · FLAGSHIP</div>

          <div className="fr-req">
            <span className="fr-req-val">{credits.toLocaleString()}</span>
            <span className="fr-req-label">REQUISITION</span>
          </div>

          <div className="fr-rows">
            {KINDS.map(({ key, label }) => {
              const cost = SHIP_COST[key]
              const shown = fleet[key] + (key === 'fighters' ? getUnsellableFighters() : 0)
              return (
                <div className="fr-row" key={key}>
                  <div className="fr-row-top">
                    <span className="fr-row-label">{label}</span>
                    <span className="fr-row-count">×{shown}</span>
                  </div>
                  <div className="fr-row-ctrl">
                    <button className="fr-btn" onClick={() => sell(key)} disabled={fleet[key] <= 0} aria-label={`Remove ${label}`}>−</button>
                    <span className="fr-cost">{cost} REQ</span>
                    <button className="fr-btn fr-btn--buy" onClick={() => buy(key)} disabled={credits < cost} aria-label={`Add ${label}`}>+</button>
                  </div>
                </div>
              )
            })}
          </div>

          {elite && (
            <div className="fr-elite">
              <div className="fr-elite-label">ADMIRAL ELITE SKILL</div>
              <button className="fr-elite-btn" onClick={previewSkill} disabled={skillPlaying}>
                <span className="fr-elite-name">{skillPlaying ? 'DEMONSTRATING…' : elite.name}</span>
                <span className="fr-elite-hint">{skillPlaying ? 'Preview running' : elite.hint}</span>
              </button>
            </div>
          )}
        </div>

        {hasUpgrades && (
          <div className="fr-upgrades">
            {upgradeGroups.capital.length > 0 && (
              <div className="fr-upg-group">
                <div className="fr-upg-title">Flagship Upgrades</div>
                {upgradeGroups.capital.map(u => (
                  <div className="fr-upg-row" key={u.name}><span className="fr-upg-name">{u.name}</span><span className="fr-upg-x">×{u.lvl}</span></div>
                ))}
              </div>
            )}
            {upgradeGroups.fleet.length > 0 && (
              <div className="fr-upg-group">
                <div className="fr-upg-title">Fleet Upgrades</div>
                {upgradeGroups.fleet.map(u => (
                  <div className="fr-upg-row" key={u.name}><span className="fr-upg-name">{u.name}</span><span className="fr-upg-x">×{u.lvl}</span></div>
                ))}
              </div>
            )}
          </div>
        )}
        </div>

        <button className="fr-back" onClick={onExit}>{backLabel}</button>
      </div>
    </div>
  )
}
