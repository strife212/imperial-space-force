import * as THREE from 'three'
import { TEAMS } from '../../battle/constants'
import { buildBlueModel, buildAleph, makeGasGiant, buildBlueCapital } from '../../battle/geometry'
import { createFlagship, createBomberWing } from '../actors'
import { asteroidField } from '../models'

// The science vessel Cassiopeia warps in, pulls up alongside a mysterious gold
// artifact (the Aleph) and scans it with a scout fighter — then is ambushed and
// destroyed by red bombers → urgent transmission.
const WARP_FROM_X = -210, WARP_TO_X = -95, WARP_DUR = 1.0, CRUISE_SPEED = 17
const SHIP_LANE_Z = 22, STOP_X = 0, REVEAL_X = -78
const ALEPH_SCALE = 2.0, ALEPH_HALF_H = 7
const SCAN_POS = new THREE.Vector3(0, 4, 13), SCAN_DUR = 4.5, FLY_DUR = 2.2
const N_BOMBERS = 8

const SHIP_NAME = 'Imperial Science Vessel Cassiopeia'
const DLG1 = 'Leaving relativistic speed, entering newtonian flight model. Approaching source of unknown radio signal.'
const DLG2 = 'Radiation levels are off the charts. Spectrogram readings are indeterminate. This is it, no doubt.'
const DLG3 = 'Ambush by unknown attackers! Abandon ship! Call for reinforcements!'

const easeOut3 = (p) => 1 - Math.pow(1 - p, 3)
const easeInOut = (p) => (p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2)

export default {
  label: 'CUTSCENE / FIRST CONTACT',
  establishing: { name: 'UNCHARTED SPACE', sub: 'Source of the Unknown Signal', stamp: 'ISV CASSIOPEIA · SENSORIUM FEED · CLR-3' },
  feed: [
    { t: 1.0,  level: 'ok',   text: '[OK] Relativistic translation complete · newtonian flight model' },
    { t: 3.6,  level: 'info', text: 'X-band acq · carrier 10.3 GHz · bearing locked' },
    { t: 6.4,  level: 'warn', text: 'Radiation flux exceeds instrument ceiling' },
    { t: 9.2,  level: 'info', text: 'Spectrogram indeterminate · pattern non-repeating' },
    { t: 13.5, level: 'info', text: 'Scout away · geodetic survey pass α' },
    { t: 17.0, level: 'ok',   text: '[OK] Survey telemetry relayed to Admiralty' },
    { t: 19.6, level: 'crit', text: 'PROXIMITY ALERT · multiple uncatalogued contacts' },
    { t: 21.4, level: 'crit', text: 'DEFCON-2 · point defence unresponsive' },
  ],
  readout: {
    id: 'ISV Cassiopeia · PNL-012-EXT',
    rows: [
      { label: 'Range',    value: (t) => `${Math.max(0.08, 4.2 - t * 0.45).toFixed(2)} km` },
      { label: 'Rad flux', value: (t) => `${(2.4 + Math.min(9, t * 0.6)).toFixed(1)} σ` },
      { label: 'Carrier',  value: (t) => (t < 3.6 ? 'SEARCHING' : '10.3 GHz · LOCK') },
    ],
  },
  bloom: 0.6,
  create(ctx) {
    const { scene, camera, fx, comms, end, orient } = ctx

    // The Aleph — built off-centre, so wrap it in a pivot at the model's centre.
    const alephInner = buildAleph()
    const abox = new THREE.Box3().setFromObject(alephInner)
    alephInner.position.sub(abox.getCenter(new THREE.Vector3()))
    const aleph = new THREE.Group(); aleph.add(alephInner)
    aleph.scale.setScalar(0.001); aleph.visible = false   // grows in when revealed
    scene.add(aleph)

    // a dim gas giant far off, and a debris field strewn around the find
    makeGasGiant(scene, [], new THREE.Vector3(-150, 50, -240), new THREE.Vector3(0.5, 0.4, 0.7).normalize())
    const field = asteroidField(ctx, { count: 46, center: new THREE.Vector3(0, 0, 0), inner: 46, outer: 190, scaleMin: 0.6, scaleMax: 5.5 })

    const flagship = createFlagship(ctx, {
      deathDrift: 0,
      model: buildBlueCapital,
      glowPos: [[-0.45, -3.1], [0.45, -3.1]],   // Cassiopeia keeps the original capital hull
      onDestroyed: () => {
        comms.show(SHIP_NAME, DLG3, { persist: true })
        end({ holdMs: 4200, overlay: { sender: 'Admiralty Command', body: "We've had an urgent distress call from the Science Vessel Cassiopeia, on a classified mission. They've called for immediate assistance. Get ready to deploy the fleet.", dismissLabel: 'TO BATTLE' } })
      },
    })
    flagship.ship.pos.set(WARP_FROM_X, 0, SHIP_LANE_Z)
    orient(flagship.group, new THREE.Vector3(1, 0, 0))
    flagship.group.position.copy(flagship.ship.pos)

    const wing = createBomberWing(ctx, { count: N_BOMBERS })

    // camera rides behind-and-above the vessel, biased toward the artifact
    const CAM_OFF = new THREE.Vector3(-34, 14, 30)
    const camTarget = new THREE.Vector3()
    const _e = new THREE.Vector3(), _tmp = new THREE.Vector3(), _dir = new THREE.Vector3(), _v = new THREE.Vector3()
    const yAxis = new THREE.Vector3(0, 1, 0), ORIGIN = new THREE.Vector3()
    const lookGoal = () => _e.copy(flagship.ship.pos).add(_tmp.set(8, 1, -8))
    camera.position.copy(flagship.ship.pos).add(CAM_OFF)
    camTarget.copy(lookGoal()); camera.lookAt(camTarget)

    // scout fighter + scan FX
    let fighter = null, scanBeam = null, scanBand = null
    const spawnFighter = () => {
      const mat = new THREE.MeshStandardMaterial({ color: TEAMS.blue.color, emissive: TEAMS.blue.color, emissiveIntensity: 0.6, metalness: 0.6, roughness: 0.4 })
      const group = new THREE.Group(); group.add(new THREE.Mesh(buildBlueModel(), mat))
      const glow = new THREE.Mesh(fx.blastGeo, fx.glowMat.blue); glow.scale.setScalar(0.28); glow.position.set(0, 0, -0.95); group.add(glow)
      group.scale.setScalar(1.0); scene.add(group)
      fighter = { group, mat, phase: 'fly', t: 0, from: flagship.ship.pos.clone(), pos: flagship.ship.pos.clone(), warpDir: new THREE.Vector3(0.4, 0.5, 0.9).normalize() }
      group.position.copy(fighter.pos)
    }
    const startScanFX = () => {
      const beamMat = new THREE.MeshBasicMaterial({ color: 0x8fe6ff, transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending, depthWrite: false })
      scanBeam = { mesh: new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1, 8), beamMat), mat: beamMat }
      scene.add(scanBeam.mesh)
      const bandMat = new THREE.MeshBasicMaterial({ color: 0x7fd4ff, transparent: true, opacity: 0.4, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })
      scanBand = { mesh: new THREE.Mesh(new THREE.BoxGeometry(10, 0.3, 5), bandMat), mat: bandMat }
      scene.add(scanBand.mesh)
    }
    const endScanFX = () => {
      if (scanBeam) { scene.remove(scanBeam.mesh); scanBeam.mesh.geometry.dispose(); scanBeam.mat.dispose(); scanBeam = null }
      if (scanBand) { scene.remove(scanBand.mesh); scanBand.mesh.geometry.dispose(); scanBand.mat.dispose(); scanBand = null }
    }

    let T = 0, firedDlg1 = false, firedDlg2 = false, revealing = false, revealT = 0
    let stationaryT = 0, scanStarted = false, scanT = 0, scanDone = false, postScanT = 0, bombersSpawned = false, fighterWarped = false

    return (dt) => {
      T += dt
      const ship = flagship.ship
      field.tick(dt)

      // artifact: slow tumble, grow in on reveal
      aleph.rotation.y += 0.28 * dt
      aleph.rotation.x += 0.13 * dt
      if (revealing && revealT < 1) { revealT = Math.min(1, revealT + dt / 1.3); aleph.scale.setScalar(ALEPH_SCALE * easeOut3(revealT)) }

      // vessel: warp in, cruise to the artifact, pull up alongside (actor owns the wreck)
      if (!ship.dying) {
        if (T < WARP_DUR) {
          const p = Math.min(1, T / WARP_DUR), e = 1 - Math.pow(1 - p, 3)
          ship.pos.x = THREE.MathUtils.lerp(WARP_FROM_X, WARP_TO_X, e)
        } else if (!ship.stationary) {
          const remaining = STOP_X - ship.pos.x
          if (remaining > 0.06) {
            const speed = Math.min(CRUISE_SPEED, Math.max(2.2, remaining * 1.3))   // ease in to the stop
            ship.pos.x += Math.min(speed * dt, remaining)
          } else { ship.stationary = true }
        }
        if (!revealing && ship.pos.x >= REVEAL_X) { revealing = true; aleph.visible = true }
      }
      flagship.tick(dt)

      // scripted beats
      if (!firedDlg1 && T >= 2.4) { firedDlg1 = true; comms.show(SHIP_NAME, DLG1) }
      if (ship.stationary && !ship.dying) {
        stationaryT += dt
        if (!firedDlg2 && stationaryT >= 1.2) { firedDlg2 = true; comms.show(SHIP_NAME, DLG2) }
        if (!scanStarted && stationaryT >= 4.8) { scanStarted = true; spawnFighter() }
      }

      // scout fighter: fly out, scan, then hold
      if (fighter && fighter.phase !== 'warp') {
        if (fighter.phase === 'fly') {
          fighter.t += dt
          const p = Math.min(1, fighter.t / FLY_DUR)
          fighter.pos.lerpVectors(fighter.from, SCAN_POS, easeInOut(p))
          orient(fighter.group, _dir.subVectors(SCAN_POS, fighter.from), 1 - Math.exp(-5 * dt))
          if (p >= 1) { fighter.phase = 'scan'; scanT = 0; startScanFX() }
        } else if (fighter.phase === 'scan' || fighter.phase === 'idle') {
          fighter.pos.copy(SCAN_POS); fighter.pos.y += Math.sin(T * 1.6) * 0.5
          orient(fighter.group, _dir.subVectors(ORIGIN, fighter.pos), 1 - Math.exp(-4 * dt))
        }
        fighter.group.position.copy(fighter.pos)
      }
      if (fighter && fighter.phase === 'scan') {
        scanT += dt
        if (scanBeam) {
          _v.subVectors(ORIGIN, fighter.pos); const len = _v.length()
          scanBeam.mesh.position.copy(fighter.pos).addScaledVector(_v, 0.5 / len)
          scanBeam.mesh.quaternion.setFromUnitVectors(yAxis, _tmp.copy(_v).multiplyScalar(1 / len))
          scanBeam.mesh.scale.set(1, len, 1)
          scanBeam.mat.opacity = 0.4 + 0.3 * Math.abs(Math.sin(T * 9))
        }
        if (scanBand) {
          const sweep = ((scanT * 6) % (ALEPH_HALF_H * 2)) - ALEPH_HALF_H   // bottom → top, looping
          scanBand.mesh.position.set(0, sweep, 0)
          scanBand.mat.opacity = 0.5 * (0.6 + 0.4 * Math.sin(T * 8))
        }
        if (scanT >= SCAN_DUR) { fighter.phase = 'idle'; scanDone = true; endScanFX() }
      }

      // ambush: red bombers warp in once the scan is done
      if (scanDone && !bombersSpawned) {
        postScanT += dt
        if (postScanT >= 1.4) { bombersSpawned = true; wing.spawn(ship.pos) }
      }
      wing.tick(dt, flagship)

      // scout fighter warps out the moment the vessel is lost
      if (fighter && ship.dying && !fighterWarped) { fighterWarped = true; fighter.phase = 'warp'; fighter.t = 0; endScanFX() }
      if (fighter && fighter.phase === 'warp') {
        fighter.t += dt
        const accel = 30 + fighter.t * 220
        fighter.pos.addScaledVector(fighter.warpDir, accel * dt)
        fighter.group.position.copy(fighter.pos)
        orient(fighter.group, fighter.warpDir, 1 - Math.exp(-8 * dt))
        fighter.group.scale.set(1, 1, 1 + fighter.t * 16)
        if (fighter.t > 0.5) { scene.remove(fighter.group); fighter = null }
      }

      // camera
      _v.copy(ship.pos).add(CAM_OFF)
      camera.position.lerp(_v, 1 - Math.exp(-3 * dt))
      camTarget.lerp(lookGoal(), 1 - Math.exp(-3 * dt)); camera.lookAt(camTarget)
    }
  },
}
