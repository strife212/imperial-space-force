import * as THREE from 'three'
import { TEAMS, BOMBER_SCALE } from '../battle/constants'
import {
  buildBlueCapital2, buildRedCapital, buildBlueModel, buildRedModel,
  buildBlueBomber, buildRedBomber, buildBlueCruiser, buildRedCruiser,
} from '../battle/geometry'

export const CAP_GLOWS = [[-0.45, -3.1], [0.45, -3.1]]            // original capital's twin engine-glow [x, z] offsets
const CAP2_GLOWS = [[-0.45, -3.8], [0, -3.8], [0.45, -3.8]]       // Capital Ship II's three aft nozzles

const yAxis = new THREE.Vector3(0, 1, 0)
const WRECK_DEATH_DUR = 1.8

// A blue capital ship that can be shot apart: engine glows, escalating hull
// fires, a drawn-out death (rippling blasts → final detonation → charred,
// ember-shedding hulk). The scene owns its position while it lives (set
// `ship.pos`, then call `tick(dt)`); once destroyed, `tick` drifts the wreck.
// Bombs call `damage(amount)`; `onDestroyed` fires at the final blast.
export function createFlagship(ctx, { scale = 3.2, hp = 60, deathDrift = 0, onDestroyed, model = buildBlueCapital2, glowPos = CAP2_GLOWS } = {}) {
  const { scene, fx } = ctx
  const shipMat = new THREE.MeshStandardMaterial({ color: TEAMS.blue.color, emissive: TEAMS.blue.color, emissiveIntensity: 0.55, metalness: 0.65, roughness: 0.35 })
  const group = new THREE.Group()
  group.add(new THREE.Mesh(model(), shipMat))
  const glows = []
  for (const [gx, gz] of glowPos) {
    // flame-shaped, stretched along the thrust axis — reads as an engine plume
    // instead of one blown-out orb swallowing the stern
    const g = new THREE.Mesh(fx.blastGeo, fx.glowMat.blue); g.scale.set(0.34, 0.34, 0.62); g.position.set(gx, 0, gz); group.add(g); glows.push(g)
  }
  const fires = []
  for (let i = 0; i < 6; i++) {
    const fMat = new THREE.MeshBasicMaterial({ color: 0xff7a30, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false })
    const fm = new THREE.Mesh(fx.blastGeo, fMat); fm.scale.setScalar(0.16)
    fm.position.set((Math.random() - 0.5) * 1.4, (Math.random() - 0.5) * 0.9, (Math.random() - 0.5) * 5); fm.visible = false
    group.add(fm); fires.push({ mesh: fm, mat: fMat })
  }
  group.scale.setScalar(scale)
  scene.add(group)

  const ship = { pos: new THREE.Vector3(), hp, alive: true, dying: false, driftVel: null }
  let wreck = null, T = 0
  const _e = new THREE.Vector3()
  const hullPoint = () => _e.set((Math.random() - 0.5) * 7, (Math.random() - 0.5) * 5, (Math.random() - 0.5) * 18).applyQuaternion(group.quaternion).add(ship.pos)
  const revealFires = () => {
    const frac = 1 - Math.max(0, ship.hp) / hp
    const n = Math.min(fires.length, Math.floor(frac * fires.length) + 1)
    for (let k = 0; k < fires.length; k++) { fires[k].mesh.visible = k < n; if (k < n) fires[k].mat.opacity = Math.max(fires[k].mat.opacity, 0.5) }
  }
  const damage = (amount) => {
    if (!ship.alive) return
    ship.hp -= amount; revealFires()
    if (ship.hp <= 0 && !ship.dying) {
      ship.dying = true; ship.alive = false
      ship.driftVel = new THREE.Vector3(deathDrift + (Math.random() - 0.5) * 0.6, (Math.random() - 0.5) * 0.4, (Math.random() - 0.5) * 0.6)
      wreck = { t: 0, blastCd: 0, final: false }
    }
  }
  const tick = (dt) => {
    T += dt
    if (!ship.dying) { group.position.copy(ship.pos); return }
    wreck.t += dt
    ship.pos.addScaledVector(ship.driftVel, dt); group.position.copy(ship.pos)
    group.rotateZ(0.06 * dt); group.rotateX(0.025 * dt)
    if (wreck.t < WRECK_DEATH_DUR) {
      wreck.blastCd -= dt
      if (wreck.blastCd <= 0) { fx.blast(hullPoint(), false); wreck.blastCd = 0.1 + Math.random() * 0.2 }
      shipMat.emissiveIntensity = 0.6 + Math.random() * 1.2
      for (const f of fires) if (f.mesh.visible) f.mat.opacity = 0.5 + 0.5 * Math.random()
    } else if (!wreck.final) {
      wreck.final = true
      fx.blast(ship.pos.clone(), true)
      shipMat.color.setHex(0x2b2e34); shipMat.emissive.setHex(0x160b06)
      shipMat.emissiveIntensity = 0.25; shipMat.metalness = 0.3; shipMat.roughness = 0.95
      glows.forEach(g => (g.visible = false))
      fires.forEach((f, i) => { f.mesh.visible = i < 2 })
      onDestroyed?.()
    } else {
      for (const f of fires) if (f.mesh.visible) f.mat.opacity = 0.2 + 0.2 * Math.abs(Math.sin(T * 4 + ship.pos.x))
      if (Math.random() < 0.04) fx.ember(hullPoint(), 0xff6a30)
    }
  }
  return { group, ship, damage, tick }
}

// Build a fleet formation as one group: a flagship at the centre, fighters in an
// escort ring, bombers in a block behind, cruisers on the flanks — all facing +X
// with engine glows. Returns { group, ships } (ships = flat list of child groups,
// so a scene can drift them or fire from random ones). One geometry/material per
// type, shared across that fleet's ships.
export function buildFleet(ctx, { team = 'blue', fighters = 18, bombers = 0, cruisers = 0, capital = true, ringR = 20 } = {}) {
  const { scene, fx, orient } = ctx
  const blue = team === 'blue'
  const geoCap = blue ? buildBlueCapital2() : buildRedCapital()
  const geoFighter = blue ? buildBlueModel() : buildRedModel()
  const geoBomber = blue ? buildBlueBomber() : buildRedBomber()
  const geoCruiser = blue ? buildBlueCruiser() : buildRedCruiser()
  const hullMat = new THREE.MeshStandardMaterial({ color: TEAMS[team].color, emissive: TEAMS[team].color, emissiveIntensity: 0.5, metalness: 0.6, roughness: 0.38 })
  const group = new THREE.Group(); scene.add(group)
  const ships = []
  const FWD = new THREE.Vector3(1, 0, 0)
  const add = (geo, scale, rear, x, y, z) => {
    const g = new THREE.Group(); g.add(new THREE.Mesh(geo, hullMat))
    const glow = new THREE.Mesh(fx.blastGeo, fx.glowMat[team]); glow.scale.set(0.3, 0.3, 0.5); glow.position.set(0, 0, -rear); g.add(glow)   // plume, not orb
    g.scale.setScalar(scale); g.position.set(x, y, z); orient(g, FWD); group.add(g); ships.push(g)
  }
  if (capital) add(geoCap, 3.2, blue ? 3.8 : 3.1, 0, 0, 0)
  for (let i = 0; i < fighters; i++) {
    const a = (i / Math.max(1, fighters)) * Math.PI * 2, r = ringR + (Math.random() - 0.5) * 6
    add(geoFighter, 1.0, 0.95, Math.cos(a) * r, (Math.random() - 0.5) * 8, Math.sin(a) * r)
  }
  for (let i = 0; i < bombers; i++) add(geoBomber, 1.43, 1.4, -34 - Math.floor(i / 5) * 7, (Math.random() - 0.5) * 6, ((i % 5) - 2) * 9)
  for (let i = 0; i < cruisers; i++) { const side = i % 2 ? 1 : -1, k = Math.floor(i / 2); add(geoCruiser, 1.7, 1.5, (k - 1.5) * 9, 0, side * (30 + (Math.random() - 0.5) * 4)) }
  return { group, ships, hullMat }
}

// A wing of red bombers that warps in around a point and bombards a flagship
// with gently-homing bombs. `spawn(center)` warps them in; `tick(dt, flagship)`
// flies/fires them and drives the bombs (smoke trail, detonate → flagship.damage).
export function createBomberWing(ctx, { count = 8, dmg = 3, bombSpeed = 36 } = {}) {
  const { scene, fx, sfx, orient } = ctx
  const bombers = [], bombs = []
  const _dir = new THREE.Vector3(), _tmp = new THREE.Vector3(), _v = new THREE.Vector3()
  let spawned = false

  const makeBomber = () => {
    const mat = new THREE.MeshStandardMaterial({ color: TEAMS.red.color, emissive: TEAMS.red.color, emissiveIntensity: 0.5, metalness: 0.6, roughness: 0.4 })
    const group = new THREE.Group(); group.add(new THREE.Mesh(buildRedBomber(), mat))
    const glow = new THREE.Mesh(fx.blastGeo, fx.glowMat.red); glow.scale.setScalar(0.4); glow.position.set(0, 0, -1.4); group.add(glow)
    group.scale.setScalar(BOMBER_SCALE); group.visible = false; scene.add(group)
    return { group, mat, pos: new THREE.Vector3(), fireCd: 0.3 + Math.random() * 0.6 }
  }
  const spawn = (center) => {
    spawned = true
    sfx?.jump()   // one hyperspace howl for the whole wing arriving
    for (let i = 0; i < count; i++) {
      const ang = (i / count) * Math.PI * 2 + Math.random() * 0.6
      const b = makeBomber()
      b.pos.copy(center).add(new THREE.Vector3(18 + Math.random() * 16, (Math.random() - 0.5) * 18, Math.cos(ang) * (22 + Math.random() * 16)))
      b.pos.z += Math.sin(ang) * 6
      b.group.position.copy(b.pos); b.group.visible = true
      orient(b.group, _dir.subVectors(center, b.pos))
      fx.blast(b.pos.clone(), false, { silent: true })   // pop-in flash, not a detonation
      bombers.push(b)
    }
  }
  const fireBomb = (b, targetPos) => {
    const start = b.pos.clone()
    const dir = _v.subVectors(targetPos, start).normalize().clone()
    const mesh = new THREE.Mesh(fx.bombGeo, fx.bombMat); mesh.position.copy(start); mesh.quaternion.setFromUnitVectors(yAxis, dir); scene.add(mesh)
    bombs.push({ mesh, dir, life: 0, max: 3.0, smokeCd: 0 })
  }
  const tick = (dt, flagship) => {
    const target = flagship.ship.pos
    if (spawned && flagship.ship.alive) {
      for (const b of bombers) {
        orient(b.group, _dir.subVectors(target, b.pos), 1 - Math.exp(-4 * dt))
        b.fireCd -= dt
        if (b.fireCd <= 0) { fireBomb(b, target); b.fireCd = 0.35 + Math.random() * 0.4 }
      }
    }
    for (let i = bombs.length - 1; i >= 0; i--) {
      const bo = bombs[i]; bo.life += dt
      _tmp.subVectors(target, bo.mesh.position); const d = _tmp.length(); _tmp.normalize()
      bo.dir.lerp(_tmp, 0.05).normalize()
      bo.mesh.quaternion.setFromUnitVectors(yAxis, bo.dir)
      bo.mesh.position.addScaledVector(bo.dir, bombSpeed * dt)
      bo.smokeCd -= dt; if (bo.smokeCd <= 0) { fx.smoke(bo.mesh.position); bo.smokeCd = 0.03 }
      let done = false
      if (d < 6 && flagship.ship.alive) { fx.blast(bo.mesh.position.clone(), false); flagship.damage(dmg); done = true }
      else if (bo.life > bo.max) done = true
      if (done) { scene.remove(bo.mesh); bombs.splice(i, 1) }
    }
  }
  return { spawn, tick, bombers }
}
