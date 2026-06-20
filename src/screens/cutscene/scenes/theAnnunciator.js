import * as THREE from 'three'
import { TEAMS } from '../../battle/constants'
import { makeRingedPlanet, buildBlueModel } from '../../battle/geometry'
import { buildStation } from '../models'

// The last resort of the Empire, never yet fired in anger: the Annunciator-class
// battlestation spins up its mass driver and loads a black-hole package.
const LINE1 = 'Annunciator armed. Black-hole package loaded. Driver spinning to ninety percent of light.'
const LINE2 = 'Caelum canit, illa audit. Let it be cast.'
const MUZZLE = new THREE.Vector3(31, 0, 0)

export default {
  label: 'CUTSCENE / THE ANNUNCIATOR',
  bloom: 0.75,
  create(ctx) {
    const { scene, camera, fx, comms, end, orient } = ctx
    const metal = new THREE.MeshStandardMaterial({ color: 0x5a6470, emissive: 0x0a1422, emissiveIntensity: 0.4, metalness: 0.85, roughness: 0.45 })
    const station = new THREE.Group(); scene.add(station)

    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.6, 60, 20), metal); barrel.rotation.z = Math.PI / 2; station.add(barrel)
    for (const x of [-20, -6, 8, 22]) { const ring = new THREE.Mesh(new THREE.TorusGeometry(2.4, 0.4, 8, 24), metal); ring.rotation.y = Math.PI / 2; ring.position.x = x; station.add(ring) }
    for (const [w, h, d, x, y] of [[7, 7, 9, -34, 0], [3, 3, 5, -34, 6], [3, 3, 5, -34, -6]]) { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), metal); b.position.set(x, y, 0); station.add(b) }

    // a support station and a quiet world behind the great gun
    const support = buildStation(); support.position.set(-46, -2, -22); support.scale.setScalar(1.3); support.rotation.z = Math.PI / 2; scene.add(support)
    makeRingedPlanet(scene, [], new THREE.Vector3(40, -40, -170), new THREE.Vector3(0.4, 0.5, 0.6).normalize())

    // escorts holding station alongside
    const escMat = new THREE.MeshStandardMaterial({ color: TEAMS.blue.color, emissive: TEAMS.blue.color, emissiveIntensity: 0.5, metalness: 0.6, roughness: 0.4 })
    const escorts = []
    for (const [x, y, z] of [[-10, 12, 12], [4, -11, 14], [-24, -8, -12]]) {
      const g = new THREE.Group(); g.add(new THREE.Mesh(buildBlueModel(), escMat))
      const glow = new THREE.Mesh(fx.blastGeo, fx.glowMat.blue); glow.scale.setScalar(0.3); glow.position.set(0, 0, -0.95); g.add(glow)
      g.scale.setScalar(1.2); g.position.set(x, y, z); orient(g, new THREE.Vector3(1, 0, 0)); scene.add(g); escorts.push({ g, b: y })
    }

    // the round being charged, and energy streaming inward to feed it
    const chargeMat = new THREE.MeshBasicMaterial({ color: 0xfff0c4, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false })
    const charge = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 20), chargeMat); charge.position.copy(MUZZLE); charge.scale.setScalar(0.3); station.add(charge)
    const haloMat = new THREE.MeshBasicMaterial({ color: 0xffc870, transparent: true, opacity: 0.4, blending: THREE.AdditiveBlending, depthWrite: false })
    const halo = new THREE.Mesh(new THREE.SphereGeometry(1.8, 20, 20), haloMat); halo.position.copy(MUZZLE); station.add(halo)
    const streamMat = new THREE.MeshBasicMaterial({ color: 0xffd9a0, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false })
    const streams = []
    const spawnStream = () => {
      const m = new THREE.Mesh(fx.blastGeo, streamMat)
      const dir = new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize()
      m.position.copy(MUZZLE).addScaledVector(dir, 16 + Math.random() * 10); m.scale.setScalar(0.5 + Math.random() * 0.4); scene.add(m)
      streams.push({ m })
    }

    const _from = new THREE.Vector3(-56, 22, 52), _to = new THREE.Vector3(12, 7, 34), _p = new THREE.Vector3(), _d = new THREE.Vector3()
    let T = 0, c1 = false, c2 = false, ended = false, streamCd = 0
    return (dt) => {
      T += dt
      const charged = Math.min(1, T / 9)
      charge.scale.setScalar(0.3 + charged * 2.8); halo.scale.setScalar(1 + charged * 2.4)
      chargeMat.opacity = 0.7 + 0.3 * Math.sin(T * 6) * charged
      for (const e of escorts) e.g.position.y = e.b + Math.sin(T * 1.1 + e.b) * 0.8

      streamCd -= dt; if (streamCd <= 0) { spawnStream(); streamCd = 0.04 + (1 - charged) * 0.1 }
      for (let i = streams.length - 1; i >= 0; i--) {
        const s = streams[i]; _d.subVectors(MUZZLE, s.m.position); const d = _d.length(); _d.normalize()
        s.m.position.addScaledVector(_d, (28 + (16 - Math.min(16, d)) * 4) * dt); s.m.scale.multiplyScalar(0.97)
        if (d < 1.5) { scene.remove(s.m); streams.splice(i, 1) }
      }

      _p.lerpVectors(_from, _to, Math.min(1, T / 12)); camera.position.copy(_p); camera.lookAt(10, 0, 0)
      if (!c1 && T >= 1.6) { c1 = true; comms.show('Admiralty Command', LINE1) }
      if (!c2 && T >= 8.0) { c2 = true; comms.show('The Empress', LINE2, { persist: true }) }
      if (!ended && T >= 15) { ended = true; end() }
    }
  },
}
