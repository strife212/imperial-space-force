// ─────────────────────────────────────────────────────────────────────────────
// Headless battle simulator for the space-battle set-piece.
//
//   npm run sim                       # 10 runs, default fleets, default timings
//   npm run sim -- --runs 50          # 50 runs
//   npm run sim -- --blue-bombers 7   # force blue to launch its bombers at t=7s
//   npm run sim -- --red-bombers 7    # force red's launch time too (else random 5–15s)
//   npm run sim -- --blue-fighters 30 --red-fighters 20 --blue-bombers-count 3
//   npm run sim -- --verbose          # per-run table (on by default for ≤20 runs)
//   npm run sim -- --sweep3           # 25 fighter/bomber/cruiser builds × 100 runs (vs default red)
//   npm run sim -- --sweep3 --workers 12   # parallelise the sweep across 12 threads (default 16; 1 = sequential)
//   npm run sim -- --sweep4           # CROSS-MATRIX: 25 blue × 25 red = 625 match-ups × 50 runs
//   npm run sim -- --sweep4 --runs 200 --workers 16   # full-precision matrix (125,000 sims)
//
// All COMBAT VALUES (HP, damage, armour, speeds, ranges, point costs, morale
// thresholds, …) are imported live from src/screens/battle/constants.js, so this
// harness always reflects the game's current tuning — change a number there and
// re-run, no edits here.
//
// The COMBAT LOGIC below is a faithful port of the per-frame simulation loop in
// src/screens/SpaceBattleScreen.jsx (steering, firing, bombs, armour, morale /
// retreat, victory) with all three.js rendering, audio, camera and UI stripped.
// It uses three.js only for vector maths. If you change the simulation rules in
// SpaceBattleScreen.jsx, mirror the change here to keep results representative.
// ─────────────────────────────────────────────────────────────────────────────
import * as THREE from 'three'
import { Worker, isMainThread, parentPort, workerData } from 'node:worker_threads'
import {
  FLEET_SIZE, SHIP_HP, BOMBER_COUNT, CRUISER_COUNT, BOMBER_HP, BOMBER_SPEED, BOMBER_MIN,
  BOMB_DMG, BOMB_RANGE, BOMB_LIFE, PD_RANGE, CAP_HP, CAP_SPEED, CAP_WEAPONS, BOLT_SPEED,
  MISS_CHANCE, BOMB_MISS_CHANCE, MAX_SPEED, MIN_SPEED, SEP_RADIUS, BOUND_R, STANDOFF,
  FIGHTER_RANGE, TURN_RATE, FIELD_FIGHTER_CAP, REINFORCE_INTERVAL, BOMBER_AUTO_DISPATCH,
  ARMOR_FIGHTER, ARMOR_BOMBER, ARMOR_FLAGSHIP, ARMOR_CRUISER, FLARES_BOMBER, FLARES_FLAGSHIP, PTS_FIGHTER, PTS_BOMBER, PTS_CRUISER, PTS_FLAGSHIP,
  PTS_FLAGSHIP_MIN, FLEET_BUDGET, RETREAT_STRENGTH, MORALE_BROKEN_STRENGTH,
  CRUISER_HP, CRUISER_SPEED, CRUISER_MIN, CRUISER_STANDOFF, CRUISER_TURN_RATE,
  MISSILE_DMG, MISSILE_SALVO, MISSILE_SPEED, MISSILE_LIFE, MISSILE_RANGE, MISSILE_MISS_CHANCE,
  MISSILE_TURN, MISSILE_ACCEL, MISSILE_LAUNCH_SPEED, MISSILE_CD_MIN, MISSILE_CD_RND,
} from '../src/screens/battle/constants.js'

// ── CLI args ──────────────────────────────────────────────────────────────────
const argv = process.argv.slice(2)
const argVal = (name, def) => { const i = argv.indexOf(`--${name}`); return i >= 0 && argv[i + 1] ? argv[i + 1] : def }
const hasFlag = (name) => argv.includes(`--${name}`)
const num = (name, def) => { const v = argVal(name, null); return v == null ? def : Number(v) }

const RUNS          = num('runs', 10)
const BLUE_FIGHTERS = num('blue-fighters', FLEET_SIZE)
const RED_FIGHTERS  = num('red-fighters', FLEET_SIZE)
const BLUE_BCOUNT   = num('blue-bombers-count', BOMBER_COUNT)
const RED_BCOUNT    = num('red-bombers-count', BOMBER_COUNT)
const BLUE_CCOUNT   = num('blue-cruisers-count', CRUISER_COUNT)
const RED_CCOUNT    = num('red-cruisers-count', CRUISER_COUNT)
// Bomber launch time. Default mirrors the game: blue auto-dispatches at
// BOMBER_AUTO_DISPATCH, red rolls a random 5–15s. Override with a fixed number.
const BLUE_LAUNCH   = argVal('blue-bombers', null)   // null → BOMBER_AUTO_DISPATCH
const RED_LAUNCH    = argVal('red-bombers', null)    // null → random 5–15s
const VERBOSE       = hasFlag('verbose') || (!hasFlag('quiet') && RUNS <= 20)
const WORKERS       = num('workers', 16)   // parallel worker threads for --sweep3 / --sweep4
const CRUISER_SPEED_OVR = argVal('cruiser-speed', null)   // override cruiser move speed (experiments)
const CRUISER_STEER = argVal('cruiser-steer', 'arc')      // 'arc' (turning circle) | 'force' (old flocking)

const DT = 1 / 60
const MAX_T = 300
const INTRO_TOTAL = 0.6 + 0.5 + 0.85 + 0.1   // hyperspace jump-in: no combat before this

const UP = new THREE.Vector3(0, 1, 0)
const ORIGIN = new THREE.Vector3(0, 0, 0)
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion()
const _dir = new THREE.Vector3(), _tmp = new THREE.Vector3(), _acc = new THREE.Vector3(), _tan = new THREE.Vector3()
const clamp = THREE.MathUtils.clamp

const orient = (q, dir, smooth) => {
  if (dir.lengthSq() < 1e-6) return
  _m.lookAt(dir, ORIGIN, UP); _q.setFromRotationMatrix(_m)
  if (smooth == null) q.copy(_q); else q.slerp(_q, smooth)
}

function runBattle(cfg) {
  const ships = []
  const TEAMS = ['blue', 'red']

  const spawnFleet = (team, count, sx, vdir) => {
    for (let i = 0; i < count; i++) {
      const reserve = i >= FIELD_FIGHTER_CAP
      const row = i % 5, col = Math.floor(i / 5)
      const pos = new THREE.Vector3(
        sx + (Math.random() - 0.5) * 5,
        (row - 2) * 2.6 + (Math.random() - 0.5) * 2,
        (col - 2) * 2.8 + (Math.random() - 0.5) * 2,
      )
      const vel = new THREE.Vector3(vdir * (2 + Math.random() * 2), (Math.random() - 0.5), (Math.random() - 0.5))
      ships.push({
        team, hp: SHIP_HP, alive: !reserve, reserve, lost: false, pos, vel, quat: new THREE.Quaternion(),
        fireCd: 0.5 + Math.random() * 2.5, isCapital: false, isBomber: false, kills: 0,
        weapons: 1, armor: ARMOR_FIGHTER, maxSpeed: MAX_SPEED, minSpeed: MIN_SPEED, radius: 0,
        turn: TURN_RATE, standoff: STANDOFF, bound: BOUND_R,
      })
    }
    return Math.max(0, count - FIELD_FIGHTER_CAP)
  }
  const reserveLeft = { blue: spawnFleet('blue', cfg.blueFighters, -31, 1), red: spawnFleet('red', cfg.redFighters, 31, -1) }

  const orbitR = 38 + Math.random() * 5
  const orbit = { R: orbitR, y: (Math.random() - 0.5) * 6, omega: (CAP_SPEED / orbitR) * (Math.random() < 0.5 ? 1 : -1) }
  const spawnCapital = (team, startAngle) => {
    const route = { R: orbit.R, y: orbit.y, omega: orbit.omega, angle: startAngle }
    const pos = new THREE.Vector3(Math.cos(startAngle) * route.R, route.y, Math.sin(startAngle) * route.R)
    const sgn = route.omega >= 0 ? 1 : -1
    const vel = new THREE.Vector3(-Math.sin(startAngle) * sgn, 0, Math.cos(startAngle) * sgn)
    const q = new THREE.Quaternion(); orient(q, vel)
    ships.push({
      team, hp: CAP_HP, alive: true, lost: false, pos, vel, quat: q,
      fireCd: 0.5 + Math.random(), isCapital: true, isBomber: false, kills: 0,
      weapons: CAP_WEAPONS, armor: ARMOR_FLAGSHIP, radius: 16, route, flares: FLARES_FLAGSHIP,
    })
  }
  spawnCapital('blue', Math.PI)
  spawnCapital('red', 0)
  const blueCap = ships.find(s => s.isCapital && s.team === 'blue')
  const redCap = ships.find(s => s.isCapital && s.team === 'red')

  const spawnBombers = (team, count) => {
    const sx = team === 'blue' ? -28 : 28
    for (let i = 0; i < count; i++) {
      const home = new THREE.Vector3(sx + (Math.random() - 0.5) * 8, (Math.random() - 0.5) * 8, -16 + i * 8)
      ships.push({
        team, hp: BOMBER_HP, alive: false, lost: false, pos: home.clone(), vel: new THREE.Vector3(), quat: new THREE.Quaternion(),
        fireCd: 1 + Math.random() * 1.5, pdCd: 0.5 + Math.random() * 1.5, isCapital: false, isBomber: true, kills: 0,
        weapons: 1, armor: ARMOR_BOMBER, maxSpeed: BOMBER_SPEED, minSpeed: BOMBER_MIN, radius: 1.2,
        turn: TURN_RATE * 0.7, standoff: STANDOFF, bound: BOUND_R, flares: FLARES_BOMBER, home,
      })
    }
  }
  spawnBombers('blue', cfg.blueBombers)
  spawnBombers('red', cfg.redBombers)

  // missile cruisers — ranged support, deploy on-field with the fleet
  const spawnCruisers = (team, count, sx, vdir) => {
    for (let i = 0; i < count; i++) {
      const pos = new THREE.Vector3(sx + (Math.random() - 0.5) * 6, (Math.random() - 0.5) * 6, (Math.random() - 0.5) * 12)
      const vel = new THREE.Vector3(vdir * (2 + Math.random() * 2), (Math.random() - 0.5), (Math.random() - 0.5))
      const q = new THREE.Quaternion(); orient(q, vel)
      ships.push({
        team, hp: CRUISER_HP, alive: true, lost: false, pos, vel, quat: q,
        fireCd: 1 + Math.random() * 2, isCapital: false, isBomber: false, isCruiser: true, kills: 0,
        weapons: 1, armor: ARMOR_CRUISER, maxSpeed: cfg.cruiserSpeed ?? CRUISER_SPEED, minSpeed: CRUISER_MIN, radius: 1.4,
        turn: TURN_RATE * 0.8, standoff: CRUISER_STANDOFF, bound: BOUND_R,
      })
    }
  }
  spawnCruisers('blue', cfg.blueCruisers || 0, -27, 1)
  spawnCruisers('red', cfg.redCruisers || 0, 27, -1)

  let blueBombersLaunched = cfg.blueBombers === 0, redBombersLaunched = cfg.redBombers === 0
  const blueEntry = cfg.blueLaunch == null ? BOMBER_AUTO_DISPATCH : cfg.blueLaunch
  const redEntry  = cfg.redLaunch  == null ? 5 + Math.random() * 10 : cfg.redLaunch

  const bolts = []
  const fireBolt = (shooter, target, big = false, bomb = !!shooter.isBomber) => {
    const willHit = Math.random() > (bomb ? BOMB_MISS_CHANCE : MISS_CHANCE)
    _tmp.set(0, 0, 1).applyQuaternion(shooter.quat)
    const start = shooter.pos.clone().addScaledVector(_tmp, big ? 2.6 : 1.0)
    const dir = target.pos.clone().sub(start).normalize()
    bolts.push({ pos: start, dir, target, willHit, life: 0, shooter, dmg: bomb ? BOMB_DMG : 1, bomb, maxLife: bomb ? BOMB_LIFE : 2.2 })
  }
  // guided missile: drops from the belly facing forward, then ignites and steers
  // toward its target at a capped turn rate, accelerating from a low launch speed
  const fireMissile = (shooter, target) => {
    const willHit = Math.random() > MISSILE_MISS_CHANCE
    const fwd = new THREE.Vector3(0, 0, 1).applyQuaternion(shooter.quat).normalize()
    const down = new THREE.Vector3(0, -1, 0).applyQuaternion(shooter.quat).normalize()
    const start = shooter.pos.clone().addScaledVector(down, 0.5).addScaledVector(fwd, 0.3)
    bolts.push({
      pos: start, dir: fwd.clone(), target, willHit, life: 0, shooter,
      dmg: MISSILE_DMG, bomb: false, missile: true, speed: MISSILE_SPEED, maxLife: MISSILE_LIFE,
      phase: 'drop', dropT: 0, dropDur: 0.32, dropDist: 1.7, dropDir: down, dropStart: start.clone(), fwd,
    })
  }
  const damage = (ship, killer, amount = 1, bomb = false) => {
    if (!bomb && !killer?.isCapital && Math.random() * 100 < ship.armor) return
    ship.hp -= amount
    if (ship.hp <= 0 && ship.alive) { ship.alive = false; ship.lost = true; if (killer) killer.kills = (killer.kills || 0) + 1 }
  }

  let gameOver = false, retreatTeam = null, retreatTime = 0, retreatWarped = false
  let reinforceAt = REINFORCE_INTERVAL
  let t = 0, winner = null
  const counts = () => ({ blue: ships.filter(s => s.team === 'blue' && s.alive).length, red: ships.filter(s => s.team === 'red' && s.alive).length })
  const launch = (team) => { for (const b of ships) if (b.isBomber && b.team === team) { b.alive = true; b.pos.copy(b.home) } }

  while (t < MAX_T && !gameOver) {
    t += DT
    const intro = t < INTRO_TOTAL
    if (!blueBombersLaunched && t >= blueEntry) { blueBombersLaunched = true; launch('blue') }
    if (!redBombersLaunched && t >= redEntry) { redBombersLaunched = true; launch('red') }

    for (const s of ships) {
      if (!s.alive) continue
      if (s.warpOut) { s.warpT += DT; if (s.warpT >= 0.8) { s.alive = false; s.lost = true } continue }
      if (intro) continue

      let nearest = null, nd = Infinity, nearestFighter = null, nfd = Infinity, nearestBomber = null, nbd = Infinity
      for (const e of ships) {
        if (!e.alive || e.team === s.team) continue
        const d = s.pos.distanceToSquared(e.pos)
        if (d < nd) { nd = d; nearest = e }
        if (e.isBomber) { if (d < nbd) { nbd = d; nearestBomber = e } }
        else if (!e.isCapital && d < nfd) { nfd = d; nearestFighter = e }
      }
      let target = nearest
      if (!s.isCapital && !s.isBomber && !s.isCruiser) target = (nearestBomber && nbd < 22 * 22) ? nearestBomber : nearest

      if (s.route) {
        const rt = s.route; rt.angle += rt.omega * DT
        const tx = Math.cos(rt.angle) * rt.R, ty = rt.y, tz = Math.sin(rt.angle) * rt.R
        const dx = tx - s.pos.x, dy = ty - s.pos.y, dz = tz - s.pos.z
        const dist = Math.hypot(dx, dy, dz), step = CAP_SPEED * DT
        if (dist > 1e-4) { const f = Math.min(step, dist) / dist; s.pos.x += dx * f; s.pos.y += dy * f; s.pos.z += dz * f; orient(s.quat, _dir.set(dx, dy, dz), 1 - Math.exp(-1.5 * DT)) }
      } else if (s.isCruiser && cfg.cruiserArc !== false) {
        // ponderous turning-circle movement (mirrors SpaceBattleScreen)
        _dir.copy(s.vel); if (_dir.lengthSq() < 1e-6) _dir.set(s.team === 'blue' ? 1 : -1, 0, 0)
        _dir.normalize()
        if (nearest) {
          _tmp.subVectors(nearest.pos, s.pos); const dist = _tmp.length() || 1; _tmp.divideScalar(dist)
          _tan.crossVectors(UP, _tmp).normalize()
          const radial = clamp((dist - s.standoff) / s.standoff, -1, 1)
          _acc.copy(_tan).addScaledVector(_tmp, radial * 0.9)
        } else _acc.copy(_dir)
        const rr = s.pos.length()
        if (rr > s.bound) _acc.addScaledVector(_tmp.copy(s.pos).normalize(), -1.4)
        if (_acc.lengthSq() < 1e-6) _acc.copy(_dir)
        _acc.normalize()
        s.wanderCd = (s.wanderCd ?? 0) - DT
        if (s.wanderCd <= 0) { s.wanderRate = (Math.random() - 0.5) * 0.5; s.wanderCd = 2.5 + Math.random() * 2.5 }
        if (s.wanderRate) _acc.applyAxisAngle(UP, s.wanderRate * DT)
        const ang = _dir.angleTo(_acc), st = CRUISER_TURN_RATE * DT
        if (ang > 1e-4) {
          if (ang <= st) _dir.copy(_acc)
          else { _tmp.crossVectors(_dir, _acc); if (_tmp.lengthSq() < 1e-6) _tmp.copy(UP); _tmp.normalize(); _dir.applyAxisAngle(_tmp, st).normalize() }
        }
        s.vel.copy(_dir).multiplyScalar(s.maxSpeed)
        s.pos.addScaledVector(s.vel, DT)
        orient(s.quat, _dir, 1 - Math.exp(-6 * DT))
      } else {
        _acc.set(0, 0, 0)
        const enemyCap = s.team === 'blue' ? redCap : blueCap
        if (s.isBomber && enemyCap && enemyCap.alive) {
          _tmp.subVectors(s.pos, enemyCap.pos); const dist = _tmp.length() || 1; _tmp.divideScalar(dist)
          _acc.addScaledVector(_tmp, clamp((enemyCap.radius + 6 - dist) * 0.7, -6, 6))
          _tan.crossVectors(UP, _tmp).normalize(); _acc.addScaledVector(_tan, 5)
        } else if (target) {
          _tmp.subVectors(target.pos, s.pos); const dist = _tmp.length() || 1; _tmp.divideScalar(dist)
          _acc.addScaledVector(_tmp, clamp((dist - s.standoff) * 0.8, -5, 9))
        }
        for (const o of ships) {
          if (o === s || !o.alive) continue
          const d = s.pos.distanceTo(o.pos), sepR = SEP_RADIUS + s.radius + o.radius
          if (d > 0 && d < sepR) { const w = (o.isCapital && !s.isCapital) ? 65 : 16; _tmp.subVectors(s.pos, o.pos).multiplyScalar((sepR - d) / (d * sepR)); _acc.addScaledVector(_tmp, w) }
        }
        const wj = s.isBomber ? 1.5 : 5
        _acc.x += (Math.random() - 0.5) * wj
        _acc.y += (Math.random() - 0.5) * (s.isBomber ? 1.2 : 4)
        _acc.z += (Math.random() - 0.5) * wj
        const r = s.pos.length(); if (r > s.bound) _acc.addScaledVector(_tmp.copy(s.pos).normalize(), -(r - s.bound) * 2.2)
        s.vel.addScaledVector(_acc, DT)
        let sp = s.vel.length()
        if (sp > s.maxSpeed) s.vel.multiplyScalar(s.maxSpeed / sp)
        else if (sp < s.minSpeed && sp > 0) s.vel.multiplyScalar(s.minSpeed / sp)
        s.pos.addScaledVector(s.vel, DT)
        orient(s.quat, _dir.copy(s.vel), 1 - Math.exp(-s.turn * DT))
      }

      if (s.team !== retreatTeam) {
        if (s.isBomber) {
          s.pdCd -= DT
          if (s.pdCd <= 0) {
            const pdSq = PD_RANGE * PD_RANGE
            const pdTarget = (nearestFighter && nfd < pdSq) ? nearestFighter : (nearestBomber && nbd < pdSq) ? nearestBomber : null
            if (pdTarget) { fireBolt(s, pdTarget, false, false); s.pdCd = 1.2 + Math.random() * 2.8 }
          }
        }
        s.fireCd -= DT
        if (s.fireCd <= 0) {
          if (s.isBomber) {
            const enemyCap = s.team === 'blue' ? redCap : blueCap
            if (enemyCap && enemyCap.alive && s.pos.distanceTo(enemyCap.pos) < BOMB_RANGE) { fireBolt(s, enemyCap); s.fireCd = 1.6 + Math.random() * 1.4 }
          } else if (s.weapons > 1) {
            const enemies = ships.filter(e => e.alive && e.team !== s.team)
            if (enemies.length) for (let k = 0; k < s.weapons; k++) fireBolt(s, enemies[(Math.random() * enemies.length) | 0], true)
            s.fireCd = 0.7 + Math.random() * 0.9
          } else if (s.isCruiser) {
            if (nearest && s.pos.distanceToSquared(nearest.pos) < MISSILE_RANGE * MISSILE_RANGE) {
              const rngSq = MISSILE_RANGE * MISSILE_RANGE
              const inRange = ships.filter(e => e.alive && e.team !== s.team && s.pos.distanceToSquared(e.pos) < rngSq)
                .sort((a, b) => s.pos.distanceToSquared(a.pos) - s.pos.distanceToSquared(b.pos))
              for (let k = 0; k < MISSILE_SALVO; k++) fireMissile(s, inRange[Math.min(k, inRange.length - 1)])
              s.fireCd = MISSILE_CD_MIN + Math.random() * MISSILE_CD_RND
            }
          } else if (target && s.pos.distanceToSquared(target.pos) < FIGHTER_RANGE * FIGHTER_RANGE) {
            fireBolt(s, target); s.fireCd = 1.2 + Math.random() * 2.8
          }
        }
      }
    }

    for (let i = bolts.length - 1; i >= 0; i--) {
      const b = bolts[i]; b.life += DT
      // missile launch: drop clear of the launcher facing forward, then ignite
      if (b.missile && b.phase === 'drop') {
        b.dropT += DT
        const p = Math.min(1, b.dropT / b.dropDur)
        const e = 1 - Math.pow(1 - p, 2)
        b.pos.copy(b.dropStart).addScaledVector(b.dropDir, b.dropDist * e)
        if (p >= 1) { b.dir.copy(b.fwd); b.phase = 'fly'; b.life = 0; b.curSpeed = MISSILE_LAUNCH_SPEED }
        continue
      }
      let done = false
      if (b.willHit && b.target.alive) {
        _tmp.subVectors(b.target.pos, b.pos); const d = _tmp.length()
        if (d < 1.3) {
          if (b.missile && b.target.flares > 0) b.target.flares--   // flare decoys the missile
          else damage(b.target, b.shooter, b.dmg, b.bomb)
          done = true
        }
        else {
          _tmp.normalize()
          if (b.missile) {
            const ang = b.dir.angleTo(_tmp), step = MISSILE_TURN * DT
            if (ang <= step || ang < 1e-4) b.dir.copy(_tmp)
            else { _tan.crossVectors(b.dir, _tmp).normalize(); if (_tan.lengthSq() > 1e-6) b.dir.applyAxisAngle(_tan, step).normalize() }
          } else b.dir.lerp(_tmp, 0.12).normalize()
        }
      }
      if (!done) {
        let spd = b.speed ?? BOLT_SPEED
        if (b.missile) { b.curSpeed = Math.min(b.speed, (b.curSpeed ?? MISSILE_LAUNCH_SPEED) + MISSILE_ACCEL * DT); spd = b.curSpeed }
        b.pos.addScaledVector(b.dir, spd * DT)
        if (b.life > b.maxLife) done = true
      }
      if (done) bolts.splice(i, 1)
    }

    const c = counts()
    const strength = { blue: 0, red: 0 }
    for (const s of ships) if (!s.lost) strength[s.team] += s.isCapital ? Math.max(PTS_FLAGSHIP_MIN, PTS_FLAGSHIP * Math.max(0, s.hp) / CAP_HP) : s.isBomber ? PTS_BOMBER : s.isCruiser ? PTS_CRUISER : PTS_FIGHTER
    const flagshipDead = { blue: !ships.some(s => s.isCapital && s.team === 'blue' && s.alive), red: !ships.some(s => s.isCapital && s.team === 'red' && s.alive) }

    // reinforcements: top each team's on-field fighters back to the cap from reserve
    if (t >= reinforceAt) {
      reinforceAt += REINFORCE_INTERVAL
      for (const tm of TEAMS) {
        if (reserveLeft[tm] <= 0) continue
        let onField = 0
        for (const s of ships) if (s.team === tm && s.alive && !s.isCapital && !s.isBomber && !s.isCruiser) onField++
        let need = Math.min(FIELD_FIGHTER_CAP - onField, reserveLeft[tm])
        for (const s of ships) { if (need <= 0) break; if (s.team !== tm || !s.reserve) continue; s.reserve = false; s.alive = true; reserveLeft[tm]--; need-- }
      }
    }

    if (!retreatTeam) {
      for (const tm of TEAMS) {
        const threshold = flagshipDead[tm] ? MORALE_BROKEN_STRENGTH : RETREAT_STRENGTH
        if (strength[tm] > 0 && strength[tm] < threshold) { retreatTeam = tm; retreatTime = t; break }
      }
    }
    if (retreatTeam && !retreatWarped && t - retreatTime >= 3) {
      retreatWarped = true
      for (const b of ships) if (b.team === retreatTeam && b.alive) { b.warpOut = true; b.warpT = 0 }
    }

    if (c.blue === 0 || c.red === 0) { gameOver = true; winner = c.blue > 0 ? 'BLUE' : c.red > 0 ? 'RED' : 'DRAW' }
  }

  if (!winner) { const c = counts(); winner = c.blue > c.red ? 'BLUE' : c.red > c.blue ? 'RED' : 'DRAW' }
  const aliveOf = (team, pred) => ships.filter(s => s.team === team && s.alive && pred(s)).length
  const capAlive = (team) => ships.some(s => s.isCapital && s.team === team && s.alive)
  const kills = (team) => ships.filter(s => s.team === team).reduce((a, s) => a + (s.kills || 0), 0)
  const isFighter = s => !s.isCapital && !s.isBomber && !s.isCruiser
  return {
    winner, t: Math.round(t * 10) / 10,
    blue: { fighters: aliveOf('blue', isFighter), bombers: aliveOf('blue', s => s.isBomber), cruisers: aliveOf('blue', s => s.isCruiser), cap: capAlive('blue'), kills: kills('blue') },
    red: { fighters: aliveOf('red', isFighter), bombers: aliveOf('red', s => s.isBomber), cruisers: aliveOf('red', s => s.isCruiser), cap: capAlive('red'), kills: kills('red') },
  }
}

// Spend a blue wing budget on B bombers, then pour every leftover point into
// fighters (F = floor(remaining / fighter-cost)). Used by --sweep.
const wingFor = (bombers) => {
  const remaining = FLEET_BUDGET - PTS_FLAGSHIP - PTS_BOMBER * bombers
  return { bombers, fighters: Math.max(0, Math.floor(remaining / PTS_FIGHTER)) }
}
// Spend the wing budget on C cruisers + B bombers, leftover → fighters. Used by --sweep3.
const wingFor3 = (c, b) => ({ cruisers: c, bombers: b, fighters: Math.max(0, Math.floor((FLEET_BUDGET - PTS_FLAGSHIP - PTS_CRUISER * c - PTS_BOMBER * b) / PTS_FIGHTER)) })

// The 25 curated blue builds for the three-type sweep. [cruisers, bombers]
const SWEEP3_BUILDS = [
  [0, 0], [0, 3], [0, 6], [0, 9], [0, 11],
  [1, 0], [1, 4], [1, 8],
  [2, 0], [2, 3], [2, 6],
  [3, 0], [3, 3], [3, 6],
  [4, 0], [4, 3], [4, 5],
  [5, 0], [5, 2], [5, 4],
  [6, 0], [6, 3],
  [7, 0], [8, 0], [9, 0],
]

// Run `runs` battles of each build and return per-build summed aggregates (mergeable
// across worker threads). Pure — used by both the main thread and the workers.
const runBuildsBatch = (builds, runs, params) => builds.map(([c, b]) => {
  const wing = wingFor3(c, b)
  const cfg = {
    blueFighters: wing.fighters, redFighters: params.redFighters,
    blueBombers: wing.bombers, redBombers: params.redBombers,
    blueCruisers: wing.cruisers, redCruisers: params.redCruisers,
    blueLaunch: params.blueLaunch, redLaunch: params.redLaunch,
  }
  cfg.cruiserSpeed = params.cruiserSpeed
  cfg.cruiserArc = params.cruiserArc
  const a = { wing, blueW: 0, redW: 0, draw: 0, sumT: 0, blueSurv: 0, redSurv: 0, blueCap: 0, n: runs }
  for (let i = 0; i < runs; i++) {
    const r = runBattle(cfg)
    if (r.winner === 'BLUE') a.blueW++; else if (r.winner === 'RED') a.redW++; else a.draw++
    a.sumT += r.t
    a.blueSurv += r.blue.fighters + r.blue.bombers + r.blue.cruisers
    a.redSurv += r.red.fighters + r.red.bombers + r.red.cruisers
    if (r.blue.cap) a.blueCap++
  }
  return a
})

// Cross-matrix: run every (blue build × red build) cell `runs` times and return
// per-cell win tallies (mergeable across workers). Pure — used by main + workers.
const runMatrixBatch = (cells, runs, params) => cells.map(cell => {
  const cfg = {
    blueFighters: cell.blue.fighters, redFighters: cell.red.fighters,
    blueBombers: cell.blue.bombers, redBombers: cell.red.bombers,
    blueCruisers: cell.blue.cruisers, redCruisers: cell.red.cruisers,
    blueLaunch: params.blueLaunch, redLaunch: params.redLaunch,
    cruiserSpeed: params.cruiserSpeed, cruiserArc: params.cruiserArc,
  }
  let blueW = 0, redW = 0, draw = 0
  for (let i = 0; i < runs; i++) {
    const r = runBattle(cfg)
    if (r.winner === 'BLUE') blueW++; else if (r.winner === 'RED') redW++; else draw++
  }
  return { bi: cell.bi, ri: cell.ri, blueW, redW, draw, n: runs }
})

if (!isMainThread) {
  // Worker thread: run an assigned slice of battles and post the aggregates back.
  if (workerData.kind === 'matrix') parentPort.postMessage(runMatrixBatch(workerData.cells, workerData.runs, workerData.params))
  else parentPort.postMessage(runBuildsBatch(workerData.builds, workerData.runs, workerData.params))
} else if (hasFlag('sweep4')) {
  // ── Cross-matrix sweep ──────────────────────────────────────────────────────
  // The 25 curated builds played by BOTH sides: 25 blue × 25 red = 625 match-ups,
  // each run `runs` times. Reveals how each blue build holds up across the whole
  // spread of enemy fleets (not just the one default red), and which red builds are
  // hardest. Runs are split across WORKERS threads (each worker runs every cell).
  const runsEach = hasFlag('runs') ? RUNS : 50
  const blueLaunch = BLUE_LAUNCH == null ? 10 : Number(BLUE_LAUNCH)
  const wings = SWEEP3_BUILDS.map(([c, b]) => wingFor3(c, b))
  const cells = []
  SWEEP3_BUILDS.forEach((_, bi) => SWEEP3_BUILDS.forEach((__, ri) => cells.push({ bi, ri, blue: wings[bi], red: wings[ri] })))
  const params = { blueLaunch, redLaunch: RED_LAUNCH == null ? null : Number(RED_LAUNCH), cruiserSpeed: CRUISER_SPEED_OVR == null ? CRUISER_SPEED : Number(CRUISER_SPEED_OVR), cruiserArc: CRUISER_STEER !== 'force' }
  const nWorkers = Math.max(1, Math.min(WORKERS, runsEach))
  const total = cells.length * runsEach

  console.log(`\nCross-matrix sweep — ${wings.length} blue × ${wings.length} red = ${cells.length} match-ups × ${runsEach} runs (${total} sims) on ${nWorkers} worker${nWorkers > 1 ? 's' : ''}`)
  console.log(`Blue bombers launch ${blueLaunch}s, red random.  Cruiser speed: ${params.cruiserSpeed}, steer: ${params.cruiserArc ? 'arc' : 'force'}.`)

  const t0 = Date.now()
  const base = Math.floor(runsEach / nWorkers), rem = runsEach % nWorkers
  const split = Array.from({ length: nWorkers }, (_, w) => base + (w < rem ? 1 : 0)).filter(n => n > 0)

  let cellsAgg
  if (nWorkers > 1) {
    const parts = await Promise.all(split.map(runs => new Promise((resolve, reject) => {
      const wk = new Worker(new URL(import.meta.url), { workerData: { kind: 'matrix', cells, runs, params } })
      wk.on('message', m => { resolve(m); wk.terminate() })
      wk.on('error', reject)
    })))
    cellsAgg = cells.map((_, ci) => {
      const a = { bi: parts[0][ci].bi, ri: parts[0][ci].ri, blueW: 0, redW: 0, draw: 0, n: 0 }
      for (const p of parts) { const x = p[ci]; a.blueW += x.blueW; a.redW += x.redW; a.draw += x.draw; a.n += x.n }
      return a
    })
  } else {
    cellsAgg = runMatrixBatch(cells, runsEach, params)
  }
  const secs = ((Date.now() - t0) / 1000).toFixed(1)

  // index into a [blue][red] grid of blue win %
  const N = wings.length
  const grid = Array.from({ length: N }, () => Array(N).fill(0))
  for (const a of cellsAgg) grid[a.bi][a.ri] = Math.round((a.blueW / a.n) * 100)
  const label = (w) => `${w.fighters}F${w.bombers}B${w.cruisers}C`

  // legend
  console.log('\nBuild legend (index: fighters/bombers/cruisers):')
  let line = ''
  wings.forEach((w, i) => { line += `${String(i).padStart(2)}:${label(w).padEnd(9)} `; if ((i + 1) % 5 === 0) { console.log('  ' + line.trimEnd()); line = '' } })
  if (line) console.log('  ' + line.trimEnd())

  // matrix: rows = blue build, cols = red build, value = blue win %
  console.log(`\nBlue win % — rows = blue build, cols = red build (each cell = ${runsEach} runs):`)
  console.log('     red→ ' + wings.map((_, i) => String(i).padStart(3)).join(' '))
  console.log('  blue↓   ' + wings.map(() => '---').join(' '))
  for (let bi = 0; bi < N; bi++) {
    console.log(`  ${String(bi).padStart(2)} ${label(wings[bi]).padStart(8)} ` + grid[bi].map(v => String(v).padStart(3)).join(' '))
  }

  // per-build summaries
  const blueMean = wings.map((w, bi) => ({ w, bi, mean: grid[bi].reduce((s, v) => s + v, 0) / N }))
  const redMean  = wings.map((w, ri) => ({ w, ri, mean: cellsAgg.filter(a => a.ri === ri).reduce((s, a) => s + (a.blueW / a.n) * 100, 0) / N }))
  console.log('\nMost robust BLUE builds (mean blue win % across all 25 red builds):')
  for (const r of [...blueMean].sort((a, b) => b.mean - a.mean).slice(0, 6)) console.log(`  ${label(r.w).padEnd(9)} — ${r.mean.toFixed(1)}%`)
  console.log('\nToughest RED builds (lowest mean blue win % they concede, across all 25 blue builds):')
  for (const r of [...redMean].sort((a, b) => a.mean - b.mean).slice(0, 6)) console.log(`  ${label(r.w).padEnd(9)} — blue wins ${r.mean.toFixed(1)}%`)
  console.log(`\nDone in ${secs}s.`)
} else if (hasFlag('sweep3')) {
  // ── Three-type sweep ──────────────────────────────────────────────────────────
  // 25 curated blue builds spanning fighters / bombers / cruisers, each spending the
  // full 1000-pt budget (fighters fill the leftover after C cruisers + B bombers).
  // Red stays default. Sims are split across WORKERS threads for speed.
  const runsEach = hasFlag('runs') ? RUNS : 100
  const blueLaunch = BLUE_LAUNCH == null ? 10 : Number(BLUE_LAUNCH)
  const builds = SWEEP3_BUILDS
  const params = { redFighters: RED_FIGHTERS, redBombers: RED_BCOUNT, redCruisers: RED_CCOUNT, blueLaunch, redLaunch: RED_LAUNCH == null ? null : Number(RED_LAUNCH), cruiserSpeed: CRUISER_SPEED_OVR == null ? CRUISER_SPEED : Number(CRUISER_SPEED_OVR), cruiserArc: CRUISER_STEER !== 'force' }
  const nWorkers = Math.max(1, Math.min(WORKERS, runsEach))

  console.log(`\nThree-type build sweep — ${builds.length} builds × ${runsEach} runs (${builds.length * runsEach} sims) on ${nWorkers} worker${nWorkers > 1 ? 's' : ''}`)
  console.log(`Red: default ${RED_FIGHTERS}F/${RED_BCOUNT}B/${RED_CCOUNT}C (random launch).  Blue bombers launch ${blueLaunch}s.  Cruiser speed: ${params.cruiserSpeed}, steer: ${params.cruiserArc ? 'arc' : 'force'}.`)

  // distribute the per-build runs across the workers (each worker runs every build)
  const base = Math.floor(runsEach / nWorkers), rem = runsEach % nWorkers
  const split = Array.from({ length: nWorkers }, (_, w) => base + (w < rem ? 1 : 0)).filter(n => n > 0)

  let agg
  if (nWorkers > 1) {
    const parts = await Promise.all(split.map(runs => new Promise((resolve, reject) => {
      const wk = new Worker(new URL(import.meta.url), { workerData: { builds, runs, params } })
      wk.on('message', m => { resolve(m); wk.terminate() })
      wk.on('error', reject)
    })))
    agg = builds.map((_, bi) => {
      const a = { wing: parts[0][bi].wing, blueW: 0, redW: 0, draw: 0, sumT: 0, blueSurv: 0, redSurv: 0, blueCap: 0, n: 0 }
      for (const p of parts) { const x = p[bi]; a.blueW += x.blueW; a.redW += x.redW; a.draw += x.draw; a.sumT += x.sumT; a.blueSurv += x.blueSurv; a.redSurv += x.redSurv; a.blueCap += x.blueCap; a.n += x.n }
      return a
    })
  } else {
    agg = runBuildsBatch(builds, runsEach, params)
  }

  console.log('\n  Blue build (F/B/C) | Blue W | Red W | Avg t | Blue surv | Red surv | Blue cap')
  console.log('  -------------------+--------+-------+-------+-----------+----------+---------')
  const rows = agg.map(a => ({ wing: a.wing, blueW: a.blueW, redW: a.redW, avgT: a.sumT / a.n, blueSurv: a.blueSurv / a.n, redSurv: a.redSurv / a.n, blueCap: a.blueCap, n: a.n }))
  for (const r of rows) {
    const label = `${String(r.wing.fighters).padStart(2)}F ${String(r.wing.bombers).padStart(2)}B ${String(r.wing.cruisers).padStart(2)}C`
    console.log(`  ${label.padEnd(18)} | ${String(r.blueW).padStart(3)}/${r.n} | ${String(r.redW).padStart(3)}/${r.n} | ${r.avgT.toFixed(1).padStart(5)} | ${r.blueSurv.toFixed(1).padStart(6)}    | ${r.redSurv.toFixed(1).padStart(5)}    | ${String(r.blueCap).padStart(3)}/${r.n}`)
  }
  const sorted = [...rows].sort((a, b) => b.blueW - a.blueW)
  console.log('\nTop blue builds by win-rate:')
  for (const r of sorted.slice(0, 5)) console.log(`  ${r.wing.fighters}F / ${r.wing.bombers}B / ${r.wing.cruisers}C — ${r.blueW}/${r.n}`)
} else if (hasFlag('sweep')) {
  // ── Sweep mode ──────────────────────────────────────────────────────────────
  // Walk an even ladder of bomber counts from 0 → max-affordable, filling the rest
  // of blue's budget with fighters. Red stays default; blue bombers launch at the
  // given time (default 10s for the sweep). 10 builds × RUNS runs each.
  const runsEach = hasFlag('runs') ? RUNS : 10
  const maxB = Math.floor((FLEET_BUDGET - PTS_FLAGSHIP) / PTS_BOMBER)
  const STEPS = 10
  const bomberCounts = [...new Set(Array.from({ length: STEPS }, (_, i) => Math.round(i * maxB / (STEPS - 1))))]
  const blueLaunch = BLUE_LAUNCH == null ? 10 : Number(BLUE_LAUNCH)

  console.log(`\nBuild sweep — ${bomberCounts.length} builds × ${runsEach} runs (${bomberCounts.length * runsEach} sims)`)
  console.log(`Red: default ${RED_FIGHTERS}F/${RED_BCOUNT}B/${RED_CCOUNT}C (random launch).  Blue bombers launch ${blueLaunch}s, leftover points → fighters.`)
  console.log('\n  Blue build   | Blue W | Red W | Draw | Avg t | Blue surv | Red surv | Blue cap')
  console.log('  -------------+--------+-------+------+-------+-----------+----------+---------')

  const rows = []
  for (const B of bomberCounts) {
    const wing = wingFor(B)
    const cfg = {
      blueFighters: wing.fighters, redFighters: RED_FIGHTERS,
      blueBombers: wing.bombers, redBombers: RED_BCOUNT,
      blueCruisers: 0, redCruisers: RED_CCOUNT,
      blueLaunch, redLaunch: RED_LAUNCH == null ? null : Number(RED_LAUNCH),
    }
    const res = []
    for (let i = 0; i < runsEach; i++) res.push(runBattle(cfg))
    const w = (t) => res.filter(r => r.winner === t).length
    const avg = (f) => res.reduce((a, r) => a + f(r), 0) / runsEach
    const label = `${String(wing.fighters).padStart(2)}F /${String(wing.bombers).padStart(2)}B`
    rows.push({ B, wing, blueW: w('BLUE'), redW: w('RED'), draw: w('DRAW'), avgT: avg(r => r.t), blueSurv: avg(r => r.blue.fighters + r.blue.bombers), redSurv: avg(r => r.red.fighters + r.red.bombers), blueCap: res.filter(r => r.blue.cap).length })
    const r = rows[rows.length - 1]
    console.log(`  ${label.padEnd(12)} | ${String(r.blueW).padStart(2)}/${runsEach} | ${String(r.redW).padStart(2)}/${runsEach} | ${String(r.draw).padStart(2)}/${runsEach} | ${r.avgT.toFixed(1).padStart(5)} | ${r.blueSurv.toFixed(1).padStart(6)}    | ${r.redSurv.toFixed(1).padStart(5)}    | ${String(r.blueCap).padStart(2)}/${runsEach}`)
  }
  const best = rows.reduce((a, b) => b.blueW > a.blueW ? b : a)
  console.log(`\nBest blue build: ${best.wing.fighters}F / ${best.wing.bombers}B — ${best.blueW}/${runsEach} wins`)
} else {
  // ── Single-config mode ────────────────────────────────────────────────────────
  const cfg = {
    blueFighters: BLUE_FIGHTERS, redFighters: RED_FIGHTERS,
    blueBombers: BLUE_BCOUNT, redBombers: RED_BCOUNT,
    blueCruisers: BLUE_CCOUNT, redCruisers: RED_CCOUNT,
    blueLaunch: BLUE_LAUNCH == null ? null : Number(BLUE_LAUNCH),
    redLaunch:  RED_LAUNCH  == null ? null : Number(RED_LAUNCH),
  }
  console.log(`\nBattle sim — ${RUNS} run(s)`)
  console.log(`Blue: ${cfg.blueFighters} fighters, ${cfg.blueBombers} bombers, ${cfg.blueCruisers} cruisers, launch ${cfg.blueLaunch == null ? `auto(${BOMBER_AUTO_DISPATCH}s)` : cfg.blueLaunch + 's'}`)
  console.log(`Red:  ${cfg.redFighters} fighters, ${cfg.redBombers} bombers, ${cfg.redCruisers} cruisers, launch ${cfg.redLaunch == null ? 'random(5–15s)' : cfg.redLaunch + 's'}`)

  const results = []
  for (let i = 0; i < RUNS; i++) results.push(runBattle(cfg))

  if (VERBOSE) {
    console.log('\nRun | Winner | Time  | Blue surv (F/B/Cap) | Red surv (F/B/Cap)  | Kills B/R')
    console.log('----+--------+-------+---------------------+---------------------+----------')
    results.forEach((r, i) => {
      const bs = `${r.blue.fighters}F ${r.blue.bombers}B ${r.blue.cap ? 'Cap✓' : 'Cap✗'}`
      const rs = `${r.red.fighters}F ${r.red.bombers}B ${r.red.cap ? 'Cap✓' : 'Cap✗'}`
      console.log(`${String(i + 1).padStart(3)} | ${r.winner.padEnd(6)} | ${String(r.t).padStart(5)} | ${bs.padEnd(19)} | ${rs.padEnd(19)} | ${r.blue.kills}/${r.red.kills}`)
    })
  }

  const tally = results.reduce((a, r) => (a[r.winner] = (a[r.winner] || 0) + 1, a), {})
  const avg = (f) => (results.reduce((a, r) => a + f(r), 0) / RUNS).toFixed(1)
  console.log('\n── Summary ──')
  console.log(`Blue wins: ${tally.BLUE || 0}/${RUNS}   Red wins: ${tally.RED || 0}/${RUNS}   Draws: ${tally.DRAW || 0}/${RUNS}`)
  console.log(`Avg duration: ${avg(r => r.t)}s`)
  console.log(`Avg survivors — Blue: ${avg(r => r.blue.fighters + r.blue.bombers + r.blue.cruisers)} craft (cap survived ${results.filter(r => r.blue.cap).length}/${RUNS})`)
  console.log(`Avg survivors — Red:  ${avg(r => r.red.fighters + r.red.bombers + r.red.cruisers)} craft (cap survived ${results.filter(r => r.red.cap).length}/${RUNS})`)
}
