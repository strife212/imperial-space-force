import * as THREE from 'three'
import { TEAMS } from '../../battle/constants'
import { createFlagship, createBomberWing } from '../actors'

// A lone supply ship warps in, cruises forward, and is ambushed and destroyed
// by a wing of red bombers → urgent transmission to the Admiralty.
const WARP_FROM_X = -210, WARP_DUR = 1.0, CRUISE_SPEED = 7
const COMMS1_T = 3.6, BOMBERS_T = 8.0
const LINE_1 = 'Arrived in system. All looks clear.'
const LINE_2 = 'Abandon ship! Contact high command, we need reinforcements immediately!'

export default {
  label: 'CUTSCENE / SUPPLY RUN',
  bloom: 0.9,
  create(ctx) {
    const { camera, fx, comms, end, orient } = ctx
    const flagship = createFlagship(ctx, {
      deathDrift: CRUISE_SPEED * 0.25,
      onDestroyed: () => {
        comms.show('Supply Ship', LINE_2, { persist: true })
        end({ holdMs: 4200, overlay: { sender: 'Admiralty Command', body: 'One of our ships has just been ambushed by unknown attackers. Activating the fleet now. Get ready to command, Admiral.', dismissLabel: 'TO BATTLE' } })
      },
    })
    flagship.ship.pos.set(WARP_FROM_X, 0, 0)
    orient(flagship.group, new THREE.Vector3(1, 0, 0))
    flagship.group.position.copy(flagship.ship.pos)

    const wing = createBomberWing(ctx, { count: 6 })
    const emitTrail = fx.makeTrail(TEAMS.blue.bolt)

    const CAM_OFF = new THREE.Vector3(-34, 14, 30)
    camera.position.copy(flagship.ship.pos).add(CAM_OFF)
    camera.lookAt(flagship.ship.pos.x + 8, flagship.ship.pos.y, flagship.ship.pos.z)

    let T = 0, firedComms1 = false, bombersSpawned = false
    const _v = new THREE.Vector3()
    return (dt) => {
      T += dt
      const ship = flagship.ship
      // warp in, then cruise forward (the actor takes over once it's a wreck)
      if (!ship.dying) {
        if (T < WARP_DUR) {
          const p = Math.min(1, T / WARP_DUR), e = 1 - Math.pow(1 - p, 3)
          ship.pos.x = THREE.MathUtils.lerp(WARP_FROM_X, 0, e)
          emitTrail(ship.pos)
        } else {
          ship.pos.x += CRUISE_SPEED * dt
        }
      }
      flagship.tick(dt)

      if (!firedComms1 && T >= COMMS1_T) { firedComms1 = true; comms.show('Supply Ship', LINE_1) }
      if (!bombersSpawned && T >= BOMBERS_T) { bombersSpawned = true; wing.spawn(ship.pos) }
      wing.tick(dt, flagship)

      _v.copy(ship.pos).add(CAM_OFF)
      camera.position.lerp(_v, 1 - Math.exp(-3 * dt))
      camera.lookAt(ship.pos.x + 8, ship.pos.y, ship.pos.z)
    }
  },
}
