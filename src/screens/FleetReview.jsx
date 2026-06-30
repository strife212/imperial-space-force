import { useRef, useEffect, useState } from 'react'
import * as THREE from 'three'
import HudHeader from '../components/HudHeader'
import { createStage } from './cutscene/stage'
import { buildReviewFleet } from './buildReviewFleet'
import { buildBlueModel } from './battle/geometry'
import { TEAMS } from './battle/constants'
import { SHIP_COST, getFleet, setFleet as storeSetFleet, getCredits, spendCredits, addCredits, getFlagshipName, getUnsellableFighters, getUpgrades, UPGRADE_INFO } from '../lib/campaign'
import { getFlag } from '../lib/store'
import { playLanceCharge, preloadLanceSfx, playExplosion } from '../lib/lanceSfx'
import { UPGRADE_CARDS, RARITY_LABEL } from './UpgradeScreen'
import './fleet-review.css'

// Rarity → swatch colour for the owned-upgrades list (mirrors the card tones).
const RARITY_COLOR = { legendary: '#ffb454', epic: '#c39bff', rare: '#5fb0ff', uncommon: '#6ef0a6', basic: '#d6e2fa' }
// Sort order for the owned-upgrades list: rarest first.
const RARITY_RANK = { legendary: 0, epic: 1, rare: 2, uncommon: 3, basic: 4 }

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
const SKILL_PREVIEW_MS = { lance: 2700, ace: 6800, nano: 3300, macro: 4400 }

// The /fleetbuilder sandbox loads with this fleet + Requisition and offers all
// four admiral skills (rather than a single operator's) for preview.
const TEST_FLEET = { fighters: 5, bombers: 0, cruisers: 2 }
const TEST_CREDITS = 15000
const TEST_SKILLS = [
  { key: 'lance', name: 'LANCE STRIKE',          hint: 'Spinal lance — fires forward' },
  { key: 'ace',   name: 'FIGHTER ACE',           hint: 'Gold fighter warps in & out' },
  { key: 'nano',  name: 'NANO REPAIR',           hint: 'Nanite repair swarm' },
  { key: 'macro', name: 'MACRO-MISSILE BARRAGE', hint: 'Missile salvo fans out' },
]

// A 3D parade of the player's standing fleet that doubles as a fleet editor:
// add / remove ships at their proper Requisition cost (full refund on removal,
// matching the shipyard) and watch the formation rebuild in real time.
export default function FleetReview({ onExit, backLabel = '◂ RETURN TO MAP', testMode = false }) {
  const mountRef = useRef(null)
  // Test "fleet builder" mode (surfaced at /fleetbuilder): a throwaway sandbox —
  // it never reads or writes the real campaign save. Starts loaded with
  // Requisition and a sample fleet, and exposes every admiral skill for preview.
  const [fleet, setFleet] = useState(() => (testMode ? { ...TEST_FLEET } : getFleet()))
  const [credits, setCredits] = useState(() => (testMode ? TEST_CREDITS : getCredits()))
  const flagshipName = testMode ? 'HMSS Drydock' : getFlagshipName()
  const fleetName = testMode ? 'Fleet Builder' : (getFlag('fleetName') || 'Fleet Polyhymnia')
  const elite = eliteForOperator(getFlag('operator'))
  // the parade includes permanent (unsellable) fighters on top of the buyable
  // fleet (test mode flies exactly what's shown — no roster carry-over)
  const withPermanent = (f) => (testMode ? f : { ...f, fighters: f.fighters + getUnsellableFighters() })

  // chosen roguelike upgrades, grouped by category for the summary list
  const upgradeGroups = (() => {
    const g = { capital: [], fleet: [] }
    for (const [id, lvl] of Object.entries(getUpgrades())) {
      const info = UPGRADE_INFO[id]
      if (lvl > 0 && info) g[info.category].push({ id, name: info.name, lvl, rarity: UPGRADE_CARDS[id]?.rarity || 'basic' })
    }
    const byRarity = (a, b) => (RARITY_RANK[a.rarity] - RARITY_RANK[b.rarity]) || a.name.localeCompare(b.name)
    g.capital.sort(byRarity); g.fleet.sort(byRarity)
    return g
  })()
  const hasUpgrades = !testMode && (upgradeGroups.capital.length > 0 || upgradeGroups.fleet.length > 0)

  const rebuildRef = useRef(null)   // set by the scene; call with a comp to rebuild
  const playSkillRef = useRef(null) // set by the scene; call with a skill key to preview it
  const skillTimerRef = useRef(null)
  const [skillPlaying, setSkillPlaying] = useState(false)
  const [playingKey, setPlayingKey] = useState(null)

  // Play an elite skill in the parade (visual only). One preview at a time.
  const previewKey = (key) => {
    if (!key || skillPlaying) return
    if (playSkillRef.current?.(key)) {
      setSkillPlaying(true); setPlayingKey(key)
      clearTimeout(skillTimerRef.current)
      skillTimerRef.current = setTimeout(() => { setSkillPlaying(false); setPlayingKey(null) }, SKILL_PREVIEW_MS[key] || 3000)
    }
  }
  useEffect(() => () => clearTimeout(skillTimerRef.current), [])
  // Warm up the lance sound on entry (the lance preview is always available in
  // test mode; in campaign only when the operator wields it) so it fires without
  // a load delay.
  useEffect(() => { if (testMode || elite?.key === 'lance') preloadLanceSfx() }, [])  // eslint-disable-line react-hooks/exhaustive-deps

  // Macro-missile barrage preview borrows the battle's looping trail sound + the
  // target-lock blip, and projects DOM crosshairs onto a layer over the canvas.
  const missileTrailRef = useRef(null)
  const codeTickRef = useRef(null)
  const lockLayerRef = useRef(null)
  useEffect(() => {
    if (!testMode) return undefined
    const a = new Audio(`${import.meta.env.BASE_URL}sfx/missiletrail.mp3`)
    a.preload = 'auto'; a.loop = true; a.volume = 0.2
    missileTrailRef.current = a
    const tick = new Audio(`${import.meta.env.BASE_URL}codetick.wav`)
    tick.preload = 'auto'
    codeTickRef.current = tick
    return () => { a.pause(); missileTrailRef.current = null; codeTickRef.current = null }
  }, [testMode])

  useEffect(() => {
    const mount = mountRef.current
    if (!mount) return
    const el = 0.40   // camera elevation (radians)
    const sceneDef = {
      bloom: 0.75,
      create(ctx) {
        const { camera, scene, fx, orient } = ctx
        const Y = new THREE.Vector3(0, 1, 0), FWD = new THREE.Vector3(1, 0, 0)
        const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _c = new THREE.Vector3()
        let current = null
        const targetCenter = new THREE.Vector3()
        const curCenter = new THREE.Vector3()
        let targetDist = 100, curDist = 100, first = true
        let framingSaved = null   // macro preview pulls the camera back; restored on clear

        // ── Elite-skill preview effects (visual only — no combat) ─────────────
        const skillFX = { kind: null, t: 0, dur: 0, meshes: [], disp: [], state: null }
        const trackMesh = (m) => { scene.add(m); skillFX.meshes.push(m); return m }
        const trackDisp = (...ds) => { for (const d of ds) skillFX.disp.push(d) }
        const stopTrail = () => { const t = missileTrailRef.current; if (t) { t.pause(); t.currentTime = 0 } }
        const clearSkill = () => {
          if (skillFX.state && skillFX.state.discharge) { skillFX.state.discharge(false); skillFX.state.discharge = null }  // cut charge if it never fired
          if (framingSaved) { targetCenter.copy(framingSaved.center); targetDist = framingSaved.dist; framingSaved = null }
          if (lockLayerRef.current) lockLayerRef.current.replaceChildren()   // drop any barrage crosshairs
          stopTrail()
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

        // MACRO (fleet-review only): 10 red fighters warp into a row ahead of the
        // fleet; a crosshair locks onto each in turn; then a missile salvo arcs
        // out and annihilates them — a target dummy the real battle never spawns.
        const MACRO_WARP = 0.7   // warp-in settles by here
        const MACRO_LOCK = 1.5   // crosshairs reveal across this window, then fire
        // a plain DOM "+" crosshair (outside the bloom canvas → no glow)
        const makeLockCrosshair = () => {
          const el = document.createElement('div')
          el.className = 'fr-lock'
          el.innerHTML = '<svg viewBox="0 0 28 28"><path d="M14 3 V25 M3 14 H25" stroke="#8fd0ff" stroke-width="2" fill="none" /></svg>'
          if (lockLayerRef.current) lockLayerRef.current.appendChild(el)
          return el
        }
        const playMacro = () => {
          const N = 10
          current.group.children[0].getWorldPosition(_a)
          const muzzle = _a.clone().addScaledVector(FWD, 16)
          const tGeo = buildBlueModel()   // same fighter hull, painted red
          const tMat = new THREE.MeshStandardMaterial({ color: TEAMS.red.color, emissive: TEAMS.red.color, emissiveIntensity: 0.55, metalness: 0.6, roughness: 0.38 })
          trackDisp(tGeo, tMat)
          const c = current.center
          const fwd = current.radius * 0.9 + 24, rowW = Math.max(64, current.radius * 1.3)
          const BACK = FWD.clone().multiplyScalar(-1)   // the line faces the blue fleet
          const targets = []
          for (let i = 0; i < N; i++) {
            const f = N === 1 ? 0.5 : i / (N - 1)
            const home = new THREE.Vector3(c.x + fwd, c.y + (Math.random() - 0.5) * 6, c.z + (f - 0.5) * rowW)
            const mesh = new THREE.Group()
            mesh.add(new THREE.Mesh(tGeo, tMat))
            const glow = new THREE.Mesh(fx.blastGeo, fx.glowMat.red); glow.scale.setScalar(0.42); glow.position.set(0, 0, -0.95); mesh.add(glow)
            mesh.position.copy(home); orient(mesh, BACK); mesh.scale.setScalar(0.0001)
            trackMesh(mesh)
            const flashMat = new THREE.MeshBasicMaterial({ color: 0xff6a52, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false })
            const flash = new THREE.Mesh(fx.blastGeo, flashMat); flash.position.copy(home); flash.scale.setScalar(0.0001)
            trackMesh(flash); trackDisp(flashMat)
            targets.push({ mesh, flash, flashMat, home, baseScale: 1.4, warpDelay: i * 0.05, lockAt: MACRO_WARP + (i / N) * MACRO_LOCK, cross: null, alive: true })
          }
          // pull the camera back and bias it forward so the whole engagement frames up
          framingSaved = { center: targetCenter.clone(), dist: targetDist }
          targetCenter.set(c.x + fwd * 0.5, c.y, c.z)
          targetDist = targetDist * 1.2 + 18
          skillFX.kind = 'macro'; skillFX.t = 0; skillFX.dur = MACRO_WARP + MACRO_LOCK + 2.0
          skillFX.state = { targets, muzzle, launched: false, missiles: [], trailStopped: false }
        }

        // The salvo: one missile per surviving target, all loosed at once.
        const fireMacroMissiles = (st) => {
          const muzzle = st.muzzle
          const mGeo = new THREE.CylinderGeometry(0.16, 0.5, 3.2, 6)
          const mMat = new THREE.MeshBasicMaterial({ color: 0xffe6a0, transparent: true, opacity: 1, blending: THREE.AdditiveBlending, depthWrite: false })
          trackDisp(mGeo, mMat)
          for (const tg of st.targets) {
            if (!tg.alive) continue
            const end = tg.home.clone()
            const dir = _a.copy(end).sub(muzzle); const len = dir.length() || 1; dir.multiplyScalar(1 / len)
            const perp = _b.crossVectors(dir, Y); if (perp.lengthSq() < 1e-4) perp.set(0, 1, 0)
            perp.normalize().applyAxisAngle(dir, Math.random() * Math.PI * 2)   // bow the arc in a random plane
            const arcMag = len * (0.18 + Math.random() * 0.16) + 6
            const ctrl = muzzle.clone().lerp(end, 0.5).addScaledVector(perp, arcMag)
            const m = new THREE.Mesh(mGeo, mMat); m.position.copy(muzzle); m.scale.setScalar(1.3)
            trackMesh(m)
            st.missiles.push({ mesh: m, start: muzzle.clone(), ctrl, end, target: tg, t: 0, dur: 1.2 + Math.random() * 0.5, smokeCd: 0, done: false })
          }
          fx.blast(muzzle, true)
          const trail = missileTrailRef.current
          if (trail && !getFlag('soundMuted')) { try { trail.currentTime = 0; trail.play() } catch (e) { /* autoplay */ } }
        }

        const play = (key) => {
          if (skillFX.kind || !current) return false
          if (key === 'lance') playLance()
          else if (key === 'ace') playAce()
          else if (key === 'nano') playNano()
          else if (key === 'macro') playMacro()
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
          } else if (skillFX.kind === 'macro') {
            const cw = mount.clientWidth || 1, ch = mount.clientHeight || 1
            const muted = getFlag('soundMuted')
            // warp-in: each target pops to full size (with a flash) on a short stagger
            for (const tg of st.targets) {
              if (!tg.alive) continue
              const lt = skillFX.t - tg.warpDelay
              if (lt <= 0) { tg.mesh.scale.setScalar(0.0001); continue }
              const wp = Math.min(1, lt / 0.4)
              const e = wp < 0.75 ? wp / 0.75 : 1 + Math.sin((wp - 0.75) / 0.25 * Math.PI) * 0.16   // pop with overshoot
              tg.mesh.scale.setScalar(tg.baseScale * Math.max(0.0001, e))
              const fp = Math.min(1, lt / 0.5)
              tg.flash.scale.setScalar(tg.baseScale * (1 + fp * 4)); tg.flashMat.opacity = Math.max(0, 1 - fp) * 0.85
            }
            // lock-on: a crosshair appears on each target in turn (blip per lock),
            // then tracks its target's projected screen position every frame
            for (const tg of st.targets) {
              if (!tg.alive) continue
              if (!tg.cross && skillFX.t >= tg.lockAt) {
                tg.cross = makeLockCrosshair()
                if (!muted && codeTickRef.current) { const s = codeTickRef.current.cloneNode(); s.volume = 0.3; s.play().catch(() => {}) }
              }
              if (tg.cross) {
                _a.copy(tg.home).project(camera)
                if (_a.z > 1) tg.cross.style.display = 'none'
                else { tg.cross.style.display = ''; tg.cross.style.transform = `translate(-50%, -50%) translate(${(_a.x * 0.5 + 0.5) * cw}px, ${(-_a.y * 0.5 + 0.5) * ch}px)` }
              }
            }
            // once every target is marked, loose the salvo
            if (!st.launched && skillFX.t >= MACRO_WARP + MACRO_LOCK) { st.launched = true; fireMacroMissiles(st) }
            if (st.launched) {
              let anyAlive = false
              for (const mo of st.missiles) {
                if (mo.done) continue
                mo.t += dt
                const p = Math.min(1, mo.t / mo.dur), u = 1 - p
                _a.copy(mo.start).multiplyScalar(u * u).addScaledVector(mo.ctrl, 2 * u * p).addScaledVector(mo.end, p * p)
                mo.mesh.position.copy(_a)
                _b.copy(mo.ctrl).sub(mo.start).multiplyScalar(2 * u).addScaledVector(_c.copy(mo.end).sub(mo.ctrl), 2 * p)
                if (_b.lengthSq() > 1e-6) mo.mesh.quaternion.setFromUnitVectors(Y, _b.normalize())
                mo.smokeCd -= dt
                if (mo.smokeCd <= 0) { fx.smoke(_a); mo.smokeCd = 0.035 }
                if (p >= 1) {
                  mo.done = true; fx.blast(mo.end, true); playExplosion({ muted })
                  for (let k = 0; k < 7; k++) fx.ember(mo.end.clone().add(_c.set((Math.random() - 0.5) * 5, (Math.random() - 0.5) * 5, (Math.random() - 0.5) * 5)), k % 2 ? 0xff8a4a : 0xffb060)
                  const tg = mo.target
                  if (tg && tg.alive) { tg.alive = false; tg.mesh.visible = false; tg.flash.visible = false }
                  if (tg && tg.cross) { tg.cross.remove(); tg.cross = null }
                } else anyAlive = true
              }
              if (!anyAlive && !st.trailStopped) { st.trailStopped = true; stopTrail() }
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
        build(withPermanent(testMode ? TEST_FLEET : getFleet()))
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

  // persist (skipped in the sandbox) + refresh UI + rebuild the 3D formation
  const apply = (next) => { if (!testMode) storeSetFleet(next); setFleet(next); rebuildRef.current?.(withPermanent(next)) }
  const buy = (key) => {
    const cost = SHIP_COST[key]
    const base = testMode ? fleet : getFleet()
    if ((testMode ? credits : getCredits()) < cost) return
    if (testMode) setCredits(credits - cost); else { spendCredits(cost); setCredits(getCredits()) }
    apply({ ...base, [key]: base[key] + 1 })
  }
  const sell = (key) => {
    const cost = SHIP_COST[key]
    const base = testMode ? fleet : getFleet()
    if (base[key] <= 0) return
    if (testMode) setCredits(credits + cost); else { addCredits(cost); setCredits(getCredits()) }
    apply({ ...base, [key]: Math.max(0, base[key] - 1) })
  }

  return (
    <div id="fleet-review">
      <HudHeader onLogout={onExit} right={<span className="label">FLEET REVIEW</span>} />
      <div className="fr-stage">
        <div className="fr-canvas" ref={mountRef} />
        {testMode && <div className="fr-lock-layer" ref={lockLayerRef} />}

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
              const shown = fleet[key] + (!testMode && key === 'fighters' ? getUnsellableFighters() : 0)
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

          {elite && !testMode && (
            <div className="fr-elite">
              <div className="fr-elite-label">ADMIRAL ELITE SKILL</div>
              <button className="fr-elite-btn" onClick={() => previewKey(elite.key)} disabled={skillPlaying}>
                <span className="fr-elite-name">{skillPlaying ? 'DEMONSTRATING…' : elite.name}</span>
                <span className="fr-elite-hint">{skillPlaying ? 'Preview running' : elite.hint}</span>
              </button>
            </div>
          )}
        </div>
        </div>

        {hasUpgrades && (
          <div className="fr-upgrades">
            {upgradeGroups.capital.length > 0 && (
              <div className="fr-upg-group">
                <div className="fr-upg-title">Flagship Upgrades</div>
                {upgradeGroups.capital.map(u => (
                  <div className="fr-upg-row" key={u.id}>
                    <span className="fr-upg-dot" data-rarity={RARITY_LABEL[u.rarity]} style={{ background: RARITY_COLOR[u.rarity] }} />
                    <span className="fr-upg-name">{u.name}</span>
                    <span className="fr-upg-x">×{u.lvl}</span>
                  </div>
                ))}
              </div>
            )}
            {upgradeGroups.fleet.length > 0 && (
              <div className="fr-upg-group">
                <div className="fr-upg-title">Fleet Upgrades</div>
                {upgradeGroups.fleet.map(u => (
                  <div className="fr-upg-row" key={u.id}>
                    <span className="fr-upg-dot" data-rarity={RARITY_LABEL[u.rarity]} style={{ background: RARITY_COLOR[u.rarity] }} />
                    <span className="fr-upg-name">{u.name}</span>
                    <span className="fr-upg-x">×{u.lvl}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {testMode && (
          <div className="fr-skills">
            <div className="fr-skills-title">ADMIRAL ELITE SKILLS</div>
            <div className="fr-skills-sub">TEST · ALL UNLOCKED</div>
            {TEST_SKILLS.map(s => (
              <button key={s.key} className="fr-elite-btn fr-skill-btn" onClick={() => previewKey(s.key)} disabled={skillPlaying}>
                <span className="fr-elite-name">{playingKey === s.key ? 'DEMONSTRATING…' : s.name}</span>
                <span className="fr-elite-hint">{playingKey === s.key ? 'Preview running' : s.hint}</span>
              </button>
            ))}
          </div>
        )}

        {!testMode && <button className="fr-back" onClick={onExit}>{backLabel}</button>}
      </div>
    </div>
  )
}
