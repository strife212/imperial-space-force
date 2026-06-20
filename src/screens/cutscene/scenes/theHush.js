import * as THREE from 'three'
import { buildAleph, makeGasGiant } from '../../battle/geometry'
import { asteroidField } from '../models'

// The Discord's purpose revealed: the Aleph silences the Song of the Stars. The
// Hush descends — silence rippling out, the light and the stars going dark.
const LINE1 = 'The Aleph is answering something. Listen — the stars. They are going out.'
const LINE2 = 'Caelum tacet.'   // "The heavens fall silent" — the Discord's answer to Caelum canit
const LINE3 = 'Throne preserve us. I can no longer hear the Song.'

export default {
  label: 'CUTSCENE / THE HUSH',
  bloom: 0.55,
  create(ctx) {
    const { scene, camera, comms, end, lights, backdrop } = ctx

    const alephInner = buildAleph()
    const abox = new THREE.Box3().setFromObject(alephInner)
    alephInner.position.sub(abox.getCenter(new THREE.Vector3()))
    const aleph = new THREE.Group(); aleph.add(alephInner); aleph.scale.setScalar(2.2)
    scene.add(aleph)

    makeGasGiant(scene, [], new THREE.Vector3(120, 30, -200), new THREE.Vector3(0.5, 0.4, 0.6).normalize())
    const field = asteroidField(ctx, { count: 24, center: new THREE.Vector3(0, 0, 0), inner: 50, outer: 180, scaleMax: 4.5 })

    // a shroud that swallows the heavens as the Song is drunk away
    const shroud = new THREE.Mesh(new THREE.SphereGeometry(340, 24, 24), new THREE.MeshBasicMaterial({ color: 0x000008, transparent: true, opacity: 0, side: THREE.BackSide, depthWrite: false }))
    shroud.renderOrder = -5; scene.add(shroud)

    // expanding rings of silence pulsing out of the artifact
    const ringGeo = new THREE.RingGeometry(0.9, 1.0, 48)
    const rings = []
    let ringCd = 0
    const spawnRing = () => {
      const mat = new THREE.MeshBasicMaterial({ color: 0x6a4cff, transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })
      const m = new THREE.Mesh(ringGeo, mat); scene.add(m); rings.push({ m, mat, life: 0 })
    }

    const a0 = lights.ambient.intensity, k0 = lights.key.intensity, r0 = lights.rim.intensity
    let T = 0, c1 = false, c2 = false, c3 = false, ended = false
    return (dt) => {
      T += dt
      field.tick(dt)
      aleph.rotation.y += 0.22 * dt; aleph.rotation.x += 0.1 * dt
      aleph.scale.setScalar(2.2 * (1 + 0.05 * Math.sin(T * 2.2)))

      // silence ripples
      ringCd -= dt; if (ringCd <= 0) { spawnRing(); ringCd = 1.4 }
      for (let i = rings.length - 1; i >= 0; i--) {
        const r = rings[i]; r.life += dt; const s = 2 + r.life * 26
        r.m.scale.setScalar(s); r.m.lookAt(camera.position); r.mat.opacity = Math.max(0, 0.6 * (1 - r.life / 3.2))
        if (r.life > 3.2) { scene.remove(r.m); r.mat.dispose(); rings.splice(i, 1) }
      }

      // dread push-in + slow orbit
      const az = 0.4 + 0.08 * T, d = 78 - Math.min(40, T * 2.2)
      camera.position.set(Math.cos(az) * d, 8 + Math.sin(T * 0.3) * 3, Math.sin(az) * d); camera.lookAt(0, 0, 0)

      // the Hush: light, stars and the very sky go out
      const dim = Math.max(0.08, 1 - T / 11)
      lights.ambient.intensity = a0 * dim; lights.key.intensity = k0 * dim; lights.rim.intensity = r0 * dim
      backdrop.starMat.opacity = 0.85 * Math.max(0, 1 - T / 7)
      shroud.material.opacity = Math.min(0.9, Math.max(0, (T - 2) / 9))

      if (!c1 && T >= 1.5) { c1 = true; comms.show('Princess Astraia', LINE1) }
      if (!c2 && T >= 6.0) { c2 = true; comms.show('The Discord', LINE2, { team: 'red', persist: true }) }
      if (!c3 && T >= 10.5) { c3 = true; comms.show('Princess Astraia', LINE3) }
      if (!ended && T >= 15) { ended = true; end() }
    }
  },
}
