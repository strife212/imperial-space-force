import * as THREE from 'three'
import { TEAMS } from '../battle/constants'

const yAxis = new THREE.Vector3(0, 1, 0)

// Shared particle / effect system for cutscenes: explosion blasts, smoke puffs,
// drifting embers and warp-trail streaks. Owns its geometry + materials and the
// transient pools. Call update(dt, camera) each frame and dispose() at teardown.
// Scenes also borrow `blastGeo`, `glowMat`, `bombGeo`, `bombMat` to build their
// own persistent meshes (engine glows, bombs, …). When a cutscene sfx engine is
// supplied, blasts boom and bolts sing on their own (both are rate-limited in
// the engine, so volleys don't stack into noise); pass { silent: true } on an
// individual blast/bolt to keep it visual-only.
export function createFX(scene, sfx = null) {
  const blastGeo = new THREE.SphereGeometry(1, 12, 12)
  const ringGeo = new THREE.RingGeometry(0.62, 1.0, 24)
  const bombGeo = new THREE.BoxGeometry(0.6, 1.5, 0.2)
  const trailGeo = new THREE.CylinderGeometry(1, 1, 1, 6)
  const boltGeo = new THREE.CylinderGeometry(0.08, 0.08, 1.6, 6)
  const glowMat = {
    blue: new THREE.MeshBasicMaterial({ color: TEAMS.blue.bolt, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false }),
    red:  new THREE.MeshBasicMaterial({ color: TEAMS.red.bolt,  transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false }),
  }
  const bombMat = new THREE.MeshBasicMaterial({ color: 0xffb030, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false })
  const smokeProto = new THREE.MeshBasicMaterial({ color: 0x8c8c8c, transparent: true, opacity: 0.5, depthWrite: false })

  const blasts = [], puffs = [], embers = [], trails = [], bolts = []
  const _d = new THREE.Vector3(), _n = new THREE.Vector3()

  // expanding fireball + shockwave ring
  const blast = (pos, big = false, { silent = false } = {}) => {
    if (sfx && !silent) sfx.explosion(big)
    const s = big ? 1.7 : 1.0
    const fmat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 1, blending: THREE.AdditiveBlending, depthWrite: false })
    const fire = new THREE.Mesh(blastGeo, fmat); fire.position.copy(pos); fire.scale.setScalar(0.3 * s); scene.add(fire)
    const rmat = new THREE.MeshBasicMaterial({ color: 0xffd9a0, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })
    const ring = new THREE.Mesh(ringGeo, rmat); ring.position.copy(pos); ring.scale.setScalar(0.5 * s); scene.add(ring)
    blasts.push({ fire, fmat, ring, rmat, life: 0, max: 0.6, s })
  }
  const smoke = (p) => {
    const mat = smokeProto.clone(); const m = new THREE.Mesh(blastGeo, mat)
    m.position.copy(p); m.scale.setScalar(0.22 + Math.random() * 0.16); scene.add(m)
    puffs.push({ mesh: m, mat, life: 0, max: 0.5 + Math.random() * 0.3 })
  }
  const ember = (pos, color) => {
    const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false })
    const m = new THREE.Mesh(blastGeo, mat); m.position.copy(pos); m.scale.setScalar(0.3 + Math.random() * 0.4); scene.add(m)
    embers.push({ mesh: m, mat, vel: new THREE.Vector3((Math.random() - 0.5) * 2.5, (Math.random() - 0.5) * 2.5 + 0.4, (Math.random() - 0.5) * 2.5), life: 0, max: 0.6 + Math.random() * 0.5 })
  }
  // a single stretched streak segment between two points
  const trailSeg = (from, to, color) => {
    _d.subVectors(to, from); const len = _d.length(); if (len < 1e-3) return
    const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false })
    const m = new THREE.Mesh(trailGeo, mat)
    m.position.copy(from).addScaledVector(_d, 0.5)
    m.quaternion.setFromUnitVectors(yAxis, _n.copy(_d).multiplyScalar(1 / len))
    m.scale.set(0.6, len, 0.6); scene.add(m)
    trails.push({ mesh: m, mat, life: 0, max: 0.5 })
  }
  // a travelling laser bolt that streaks from → to, then pops a small blast.
  // Team (for the laser voice) is read off the bolt colour: red-dominant → red.
  const bolt = (from, to, color, { speed = 80, blastOnHit = true, silent = false, big = false, size = 1 } = {}) => {
    _d.subVectors(to, from); const dist = _d.length(); if (dist < 1e-3) return
    if (sfx && !silent) sfx.laser(((color >> 16) & 0xff) > (color & 0xff) ? 'red' : 'blue', big)
    _n.copy(_d).multiplyScalar(1 / dist)
    const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false })
    const m = new THREE.Mesh(boltGeo, mat); m.position.copy(from); m.quaternion.setFromUnitVectors(yAxis, _n)
    m.scale.set(size, 2.4 * Math.max(1, size * 0.7), size); scene.add(m)   // size > 1 → a capital-grade lance
    bolts.push({ mesh: m, mat, dir: _n.clone(), to: to.clone(), dist, travelled: 0, speed, blastOnHit })
  }
  // a gap-throttled trail emitter (e.g. for a warp-in streak): returns emit(pos)
  const makeTrail = (color, gap = 6) => {
    let prev = null
    return (pos) => {
      if (!prev) { prev = pos.clone(); return }
      if (pos.distanceTo(prev) < gap) return
      trailSeg(prev, pos, color)
      prev.copy(pos)
    }
  }

  const update = (dt, camera) => {
    for (let i = blasts.length - 1; i >= 0; i--) {
      const x = blasts[i]; x.life += dt; const k = x.life / x.max
      x.fire.scale.setScalar((0.3 + k * 3.4) * x.s); x.fmat.color.setRGB(1, 0.85 - k * 0.55, 0.5 - k * 0.45); x.fmat.opacity = Math.max(0, 1 - k)
      const rk = Math.min(1, k * 1.4); x.ring.scale.setScalar((0.5 + rk * 6) * x.s); x.ring.lookAt(camera.position); x.rmat.opacity = Math.max(0, 0.85 * (1 - rk))
      if (x.life >= x.max) { scene.remove(x.fire); scene.remove(x.ring); x.fmat.dispose(); x.rmat.dispose(); blasts.splice(i, 1) }
    }
    for (let i = puffs.length - 1; i >= 0; i--) {
      const p = puffs[i]; p.life += dt; p.mesh.scale.multiplyScalar(1 + dt * 1.6); p.mat.opacity = Math.max(0, 0.5 * (1 - p.life / p.max))
      if (p.life >= p.max) { scene.remove(p.mesh); p.mat.dispose(); puffs.splice(i, 1) }
    }
    for (let i = embers.length - 1; i >= 0; i--) {
      const em = embers[i]; em.life += dt; em.mesh.position.addScaledVector(em.vel, dt); em.mesh.scale.multiplyScalar(0.986); em.mat.opacity = Math.max(0, 0.9 * (1 - em.life / em.max))
      if (em.life >= em.max) { scene.remove(em.mesh); em.mat.dispose(); embers.splice(i, 1) }
    }
    for (let i = trails.length - 1; i >= 0; i--) {
      const tr = trails[i]; tr.life += dt; tr.mat.opacity = Math.max(0, 0.55 * (1 - tr.life / tr.max))
      if (tr.life >= tr.max) { scene.remove(tr.mesh); tr.mat.dispose(); trails.splice(i, 1) }
    }
    for (let i = bolts.length - 1; i >= 0; i--) {
      const b = bolts[i]; const step = b.speed * dt; b.travelled += step
      b.mesh.position.addScaledVector(b.dir, step)
      if (b.travelled >= b.dist) { if (b.blastOnHit) blast(b.to, false, { silent: true }); scene.remove(b.mesh); b.mat.dispose(); bolts.splice(i, 1) }   // impact puffs stay visual-only (deaths boom on their own)
    }
  }

  const dispose = () => {
    blasts.forEach(x => { scene.remove(x.fire); scene.remove(x.ring); x.fmat.dispose(); x.rmat.dispose() })
    puffs.forEach(p => { scene.remove(p.mesh); p.mat.dispose() })
    embers.forEach(e => { scene.remove(e.mesh); e.mat.dispose() })
    trails.forEach(t => { scene.remove(t.mesh); t.mat.dispose() })
    bolts.forEach(b => { scene.remove(b.mesh); b.mat.dispose() })
    blasts.length = puffs.length = embers.length = trails.length = bolts.length = 0
    blastGeo.dispose(); ringGeo.dispose(); bombGeo.dispose(); trailGeo.dispose(); boltGeo.dispose()
    glowMat.blue.dispose(); glowMat.red.dispose(); bombMat.dispose(); smokeProto.dispose()
  }

  return { blastGeo, ringGeo, bombGeo, trailGeo, boltGeo, glowMat, bombMat, blast, smoke, ember, trailSeg, makeTrail, bolt, update, dispose }
}
