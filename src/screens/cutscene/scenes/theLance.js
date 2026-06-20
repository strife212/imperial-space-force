import * as THREE from 'three'
import { makeBlackHole } from '../../battle/geometry'
import { asteroidField } from '../models'

// The Divine Lance is cast: the Annunciator's package crosses the dark and
// annihilates the Discord's veiled seat.
const LINE1 = 'Against the Hush, the Empress’s Chord is brought.'
const LAUNCH = new THREE.Vector3(-78, 2, 26)
const TARGET = new THREE.Vector3(150, 0, -8)
const FIRE_T = 3.0

export default {
  label: 'CUTSCENE / THE LANCE',
  bloom: 0.85,
  create(ctx) {
    const { scene, camera, fx, comms, end } = ctx
    const bhTick = makeBlackHole(scene, [], TARGET)
    const field = asteroidField(ctx, { count: 22, center: TARGET, inner: 26, outer: 90, scaleMax: 5 })

    // the Annunciator's gun, aimed across the dark
    const dir = new THREE.Vector3().subVectors(TARGET, LAUNCH); const dist = dir.length(); dir.normalize()
    const yAxis = new THREE.Vector3(0, 1, 0)
    const metal = new THREE.MeshStandardMaterial({ color: 0x5a6470, emissive: 0x0a1422, emissiveIntensity: 0.4, metalness: 0.85, roughness: 0.45 })
    const gun = new THREE.Group()
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.2, 22, 16), metal); barrel.quaternion.setFromUnitVectors(yAxis, dir); gun.add(barrel)
    const breech = new THREE.Mesh(new THREE.BoxGeometry(5, 5, 6), metal); breech.position.copy(dir).multiplyScalar(-12); gun.add(breech)
    gun.position.copy(LAUNCH); scene.add(gun)

    const beamMat = new THREE.MeshBasicMaterial({ color: 0xfff2cc, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false })
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(2.4, 2.4, dist, 12), beamMat)
    beam.position.copy(LAUNCH).addScaledVector(dir, dist / 2); beam.quaternion.setFromUnitVectors(yAxis, dir); beam.visible = false; scene.add(beam)

    const slugMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 1, blending: THREE.AdditiveBlending, depthWrite: false })
    const slug = new THREE.Mesh(fx.blastGeo, slugMat); slug.visible = false; scene.add(slug)   // the package in flight
    const flashMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false })
    const flash = new THREE.Mesh(fx.blastGeo, flashMat); flash.position.copy(TARGET); flash.scale.setScalar(1); scene.add(flash)

    const _look = new THREE.Vector3(50, 0, 8)
    let T = 0, fired = false, c1 = false, beamLife = 0, slugT = 0, slugDone = false, impactCd = 0, impacts = 0, shake = 0, flashLife = -1, ended = false
    return (dt) => {
      T += dt
      if (bhTick) bhTick(T)
      field.tick(dt)

      if (!fired && T >= FIRE_T) { fired = true; beam.visible = true; beamMat.opacity = 1; beamLife = 0; slug.visible = true; slug.position.copy(LAUNCH); slug.scale.setScalar(2); fx.blast(LAUNCH, true); shake = 1.0; if (!c1) { c1 = true; comms.show('The Empress', LINE1, { persist: true }) } }

      if (beam.visible) { beamLife += dt; beamMat.opacity = Math.max(0, 1 - beamLife / 0.6); const w = 1 + beamLife * 3; beam.scale.set(w, 1, w); if (beamLife > 0.6) beam.visible = false }
      if (slug.visible) { slugT += dt; const p = Math.min(1, slugT / 0.5); slug.position.copy(LAUNCH).addScaledVector(dir, dist * p); if (p >= 1 && !slugDone) { slugDone = true; slug.visible = false; flashLife = 0; shake = 1.6 } }

      // annihilation: a white flash and a barrage engulfing the seat
      if (flashLife >= 0) {
        flashLife += dt
        flashMat.opacity = Math.max(0, 1 - flashLife / 1.1); flash.scale.setScalar(1 + flashLife * 80)
        if (impacts < 34) { impactCd -= dt; if (impactCd <= 0) { const off = new THREE.Vector3((Math.random() - 0.5) * 22, (Math.random() - 0.5) * 22, (Math.random() - 0.5) * 22); fx.blast(off.add(TARGET), Math.random() < 0.5); impactCd = 0.06; impacts++; shake = Math.min(2, shake + 0.2) } }
      }

      // wide shot of the dark, then a shuddering push toward the kill
      const k = Math.min(1, Math.max(0, (T - FIRE_T) / 4))
      shake = Math.max(0, shake - dt * 1.4)
      camera.position.set(36 - k * 10 + (Math.random() - 0.5) * shake * 4, 44 - k * 20 + (Math.random() - 0.5) * shake * 3, 122 - k * 30)
      _look.lerp(TARGET, k * 0.05); camera.lookAt(_look)

      if (!ended && T >= FIRE_T + 6.5) { ended = true; end() }
    }
  },
}
