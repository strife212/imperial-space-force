import * as THREE from 'three'
import { TEAMS } from '../../battle/constants'
import { buildBlueCapital, buildBlueModel, buildBlueBomber, buildBlueCruiser } from '../../battle/geometry'

// A fleet hero shot: the flagship in a ring of fighters with bombers behind and
// cruisers on the flanks, gliding forward as one while the camera orbits to show
// it off, then fades to black and auto-advances.
const FLEET_SPEED = 6, RING_R = 22, N_FIGHTERS = 35, N_BOMBERS = 20
const ORBIT_R = 96, ORBIT_ELEV = 34, ORBIT_SPEED = 0.42, AZ0 = 0.7
const COMMS_T = 1.0, FADE_T = 12.5

const CAP_NAME = 'HMSS The Empress Remembers Saint Polyhymnia'
const LINE = 'Fleet Polyhymnia, assembled.'

export default {
  label: 'CUTSCENE / FLEET REVIEW',
  bloom: 0.55,
  create(ctx) {
    const { scene, camera, fx, comms, end, orient } = ctx
    const fleet = new THREE.Group(); scene.add(fleet)
    const geoFlag = buildBlueCapital(), geoFighter = buildBlueModel(), geoBomber = buildBlueBomber(), geoCruiser = buildBlueCruiser()
    const hullMat = new THREE.MeshStandardMaterial({ color: TEAMS.blue.color, emissive: TEAMS.blue.color, emissiveIntensity: 0.5, metalness: 0.62, roughness: 0.36 })
    const FORWARD = new THREE.Vector3(1, 0, 0)
    // one geometry + material per type, reused across every ship in the formation
    const addShip = (geo, scale, rear, x, y, z) => {
      const g = new THREE.Group(); g.add(new THREE.Mesh(geo, hullMat))
      const glow = new THREE.Mesh(fx.blastGeo, fx.glowMat.blue); glow.scale.setScalar(0.42); glow.position.set(0, 0, -rear); g.add(glow)
      g.scale.setScalar(scale); g.position.set(x, y, z); orient(g, FORWARD); fleet.add(g)
    }
    addShip(geoFlag, 3.2, 3.1, 0, 0, 0)                                          // flagship
    for (let i = 0; i < N_FIGHTERS; i++) {                                        // escort ring
      const a = (i / N_FIGHTERS) * Math.PI * 2
      addShip(geoFighter, 1.0, 0.95, RING_R * Math.cos(a), 0, RING_R * Math.sin(a))
    }
    const bz = [-18, -9, 0, 9, 18], by = [-9, -3, 3, 9]; let bi = 0              // bombers behind
    for (const y of by) for (const z of bz) { if (bi++ >= N_BOMBERS) break; addShip(geoBomber, 1.43, 1.4, -36, y, z) }
    for (const side of [-1, 1]) for (const x of [-15, -5, 5, 15]) addShip(geoCruiser, 1.7, 1.5, x, 0, 30 * side)   // cruisers on the flanks

    // camera orbits a point a little behind the flagship (≈ fleet centroid)
    const CENTER_OFF = new THREE.Vector3(-12, 0, 0), center = new THREE.Vector3()
    const placeCamera = (az) => {
      center.copy(fleet.position).add(CENTER_OFF)
      camera.position.set(center.x + ORBIT_R * Math.cos(az), center.y + ORBIT_ELEV, center.z + ORBIT_R * Math.sin(az))
      camera.lookAt(center)
    }
    placeCamera(AZ0)

    let T = 0, firedComms = false, ended = false
    return (dt) => {
      T += dt
      fleet.position.x += FLEET_SPEED * dt
      placeCamera(AZ0 + ORBIT_SPEED * T)
      if (!firedComms && T >= COMMS_T) { firedComms = true; comms.show(CAP_NAME, LINE, { persist: true }) }
      if (!ended && T >= FADE_T) { ended = true; end() }
    }
  },
}
