import * as THREE from 'three'
import { TEAMS } from '../../battle/constants'
import { makeRingedPlanet, makeGasGiant, buildBlueModel } from '../../battle/geometry'
import { buildCathedra } from '../models'

// At the Novarayan Throneworld: the Empress has heard the Discord, as the Final
// Hearing foretold, and resolves to cast the Lance.
const LINE1 = 'I have heard it. The Discord, as it was foretold.'
const LINE2 = 'From the Cathedra high, to the listening below — falls the Lance that the Discord besought.'

export default {
  label: 'CUTSCENE / THE FINAL HEARING',
  bloom: 0.7,
  create(ctx) {
    const { scene, camera, fx, comms, end, orient } = ctx
    makeRingedPlanet(scene, [], new THREE.Vector3(0, -52, 0), new THREE.Vector3(0.3, 0.7, 0.5).normalize())   // the Throneworld below
    makeGasGiant(scene, [], new THREE.Vector3(150, 70, -210), new THREE.Vector3(0.5, 0.4, 0.6).normalize())   // the World Engine moon in the sky

    // the Cathedra rising from the near pole
    const cathedra = buildCathedra(); cathedra.position.set(0, -24, 0); cathedra.scale.setScalar(1.05); scene.add(cathedra)

    // an honour guard holding station above the spire
    const guardMat = new THREE.MeshStandardMaterial({ color: TEAMS.blue.color, emissive: TEAMS.blue.color, emissiveIntensity: 0.55, metalness: 0.6, roughness: 0.4 })
    const guard = []
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2
      const g = new THREE.Group(); g.add(new THREE.Mesh(buildBlueModel(), guardMat))
      const glow = new THREE.Mesh(fx.blastGeo, fx.glowMat.blue); glow.scale.setScalar(0.3); glow.position.set(0, 0, -0.95); g.add(glow)
      g.scale.setScalar(1.3); g.position.set(Math.cos(a) * 22, 18 + (i % 2) * 4, Math.sin(a) * 22)
      orient(g, new THREE.Vector3(-Math.cos(a), 0, -Math.sin(a)))   // face inward, toward the spire
      scene.add(g); guard.push({ g, a, base: g.position.y })
    }

    const camFrom = new THREE.Vector3(0, 70, 96), camTo = new THREE.Vector3(-18, 16, 60), _p = new THREE.Vector3()
    let T = 0, c1 = false, c2 = false, ended = false
    return (dt) => {
      T += dt
      for (const u of guard) { u.a += 0.12 * dt; u.g.position.set(Math.cos(u.a) * 22, u.base + Math.sin(T * 1.2 + u.a) * 1.5, Math.sin(u.a) * 22); orient(u.g, new THREE.Vector3(-Math.sin(u.a), 0, Math.cos(u.a))) }
      _p.lerpVectors(camFrom, camTo, Math.min(1, T / 12)); camera.position.copy(_p); camera.lookAt(0, 4, 0)
      if (!c1 && T >= 2.0) { c1 = true; comms.show('The Empress', LINE1) }
      if (!c2 && T >= 7.5) { c2 = true; comms.show('The Empress', LINE2, { persist: true }) }
      if (!ended && T >= 15) { ended = true; end() }
    }
  },
}
