import * as THREE from 'three'
import { TEAMS } from '../../battle/constants'
import { makeGasGiant, makeRingedPlanet, buildBlueModel } from '../../battle/geometry'
import { buildRelay } from '../models'

// The Ecumenologion — the World Engine, Litania Magna — computes the silence and
// names the one instrument the Order has never used. The Empress's craft steals
// in to commune.
const LINE1 = 'I have modelled the silence. It propagates. The Song fails in ninety days.'
const LINE2 = 'There is one instrument the Order has never used. The prophecy names it. So do I.'

export default {
  label: 'CUTSCENE / THE GREAT LITANY',
  bloom: 0.7,
  create(ctx) {
    const { scene, camera, fx, comms, end, orient } = ctx
    makeGasGiant(scene, [], new THREE.Vector3(0, 0, 0), new THREE.Vector3(0.5, 0.6, 0.4).normalize())   // the World Engine (R≈40)
    makeRingedPlanet(scene, [], new THREE.Vector3(150, 40, -180), new THREE.Vector3(0.4, 0.5, 0.6).normalize())   // the Throneworld it orbits

    // the diadem — orbital rings of solar collectors girdling the Engine
    const ringMat = new THREE.MeshBasicMaterial({ color: 0x6f86ff, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })
    const ring = new THREE.Mesh(new THREE.TorusGeometry(58, 0.8, 8, 120), ringMat); ring.rotation.set(-1.1, 0.4, 0); scene.add(ring)
    const ring2 = new THREE.Mesh(new THREE.TorusGeometry(66, 0.4, 8, 120), ringMat); ring2.rotation.set(-1.0, 0.4, 0); scene.add(ring2)

    // collector platforms riding the diadem
    const satMat = new THREE.MeshStandardMaterial({ color: 0x9fb0d8, emissive: 0x223a66, emissiveIntensity: 0.5, metalness: 0.7, roughness: 0.5 })
    const sats = new THREE.Group(); sats.rotation.set(-1.1, 0.4, 0); scene.add(sats)
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * Math.PI * 2
      const s = new THREE.Mesh(new THREE.BoxGeometry(3, 0.5, 5), satMat)
      s.position.set(Math.cos(a) * 58, Math.sin(a) * 58, 0); s.rotation.z = a; sats.add(s)
    }

    // monitoring relays stationed around the Engine
    const relays = []
    for (const [x, y, z] of [[64, 18, 30], [-58, -24, 40], [30, 50, -34], [-40, 36, -44], [70, -16, -20]]) {
      const r = buildRelay(); r.position.set(x, y, z); r.scale.setScalar(2.2); r.rotation.set(Math.random() * 6, Math.random() * 6, Math.random() * 6); scene.add(r); relays.push(r)
    }

    // the Empress's small craft, stealing in to commune
    const craftMat = new THREE.MeshStandardMaterial({ color: TEAMS.blue.color, emissive: TEAMS.blue.color, emissiveIntensity: 0.6, metalness: 0.6, roughness: 0.4 })
    const craft = new THREE.Group(); craft.add(new THREE.Mesh(buildBlueModel(), craftMat))
    const cglow = new THREE.Mesh(fx.blastGeo, fx.glowMat.blue); cglow.scale.setScalar(0.3); cglow.position.set(0, 0, -0.95); craft.add(cglow)
    craft.scale.setScalar(1.4); scene.add(craft)
    const cFrom = new THREE.Vector3(-150, 70, 150), cTo = new THREE.Vector3(0, 34, 48)
    craft.position.copy(cFrom)
    const trail = fx.makeTrail(TEAMS.blue.bolt, 5)
    const _d = new THREE.Vector3()

    let T = 0, c1 = false, c2 = false, ended = false
    return (dt) => {
      T += dt
      ring.rotation.z += 0.05 * dt; ring2.rotation.z -= 0.03 * dt; sats.rotation.z += 0.05 * dt
      for (const r of relays) r.rotation.y += 0.2 * dt

      // the craft eases in over the first few seconds, trailing light
      const cp = Math.min(1, T / 6), ce = 1 - Math.pow(1 - cp, 3)
      craft.position.lerpVectors(cFrom, cTo, ce)
      orient(craft, _d.subVectors(cTo, cFrom))
      if (cp < 0.96) trail(craft.position)
      craft.position.y += Math.sin(T * 1.2) * 0.02   // gentle settle

      const az = 0.5 + 0.12 * T, d = 165 - Math.min(55, T * 2.6)
      camera.position.set(Math.cos(az) * d, 34, Math.sin(az) * d); camera.lookAt(0, 6, 0)
      if (!c1 && T >= 2.0) { c1 = true; comms.show('Litania Magna', LINE1) }
      if (!c2 && T >= 8.0) { c2 = true; comms.show('Litania Magna', LINE2, { persist: true }) }
      if (!ended && T >= 15) { ended = true; end() }
    }
  },
}
