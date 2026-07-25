import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { createStage } from './cutscene/stage'
import { buildRedModel, buildRedBomber, buildRedCruiser } from './battle/geometry'
import { TEAMS } from './battle/constants'
import { getChallengeBest } from '../lib/campaign'
import './campaign-map.css'

// Endless-challenge gate: a live war-sky — ember nebula, enemy formations that
// never stop coming — under a glass plate stating the terms of the gauntlet.
export function ChallengeIntro({ onStart, onBack }) {
  const mountRef = useRef(null)
  const best = getChallengeBest()

  useEffect(() => {
    const mount = mountRef.current
    if (!mount) return
    const sceneDef = {
      bloom: 0.75,
      create(ctx) {
        const { scene, camera, fx, backdrop, lights, orient, track } = ctx
        // ember war-sky: tint the shared nebula/stars toward the Hush's colours
        backdrop.nebMat.uniforms.uColA.value.setRGB(0.055, 0.020, 0.030)
        backdrop.nebMat.uniforms.uColB.value.setRGB(0.120, 0.030, 0.048)
        backdrop.nebMat.uniforms.uColWarm.value.setRGB(0.235, 0.075, 0.030)
        backdrop.starMat.color.setHex(0xd8b49f)
        lights.key.color.setHex(0xffd9b0)
        lights.rim.color.setHex(0xa04030)

        const hullMat = new THREE.MeshStandardMaterial({
          color: TEAMS.red.color, emissive: TEAMS.red.color, emissiveIntensity: 0.55, metalness: 0.6, roughness: 0.38,
        })
        const geoF = buildRedModel(), geoB = buildRedBomber(), geoC = buildRedCruiser()
        track(hullMat, geoF, geoB, geoC)

        // enemy patrols crossing the sky without end — the pitch, made visible
        const formations = []
        const _v = new THREE.Vector3()
        const spawnFormation = () => {
          const near = Math.random() < 0.55
          const dir = Math.random() < 0.5 ? 1 : -1
          const z = near ? 70 + Math.random() * 40 : -70 - Math.random() * 50
          const y = (Math.random() - 0.5) * (near ? 44 : 70)
          const speed = near ? 26 + Math.random() * 12 : 10 + Math.random() * 6
          const startX = -dir * (near ? 135 : 215)
          const roll = Math.random()
          const kind = roll < 0.6 ? 'fighter' : roll < 0.85 ? 'bomber' : 'cruiser'
          const geo = kind === 'fighter' ? geoF : kind === 'bomber' ? geoB : geoC
          const scale = (kind === 'fighter' ? 1.0 : kind === 'bomber' ? 1.43 : 1.7) * 1.35
          const rear = kind === 'fighter' ? 0.95 : kind === 'bomber' ? 1.4 : 1.5
          const n = kind === 'fighter' ? 3 + ((Math.random() * 4) | 0) : 2 + ((Math.random() * 2) | 0)
          const gap = kind === 'fighter' ? 5.5 : 9
          const group = new THREE.Group()
          for (let i = 0; i < n; i++) {
            const row = (i + 1) >> 1, side = i === 0 ? 0 : (i % 2 ? 1 : -1)
            const ship = new THREE.Group()
            ship.add(new THREE.Mesh(geo, hullMat))
            const glow = new THREE.Mesh(fx.blastGeo, fx.glowMat.red)
            glow.scale.setScalar(0.38); glow.position.set(0, 0, -rear)
            ship.add(glow)
            ship.scale.setScalar(scale)
            ship.position.set(-dir * row * gap, side * row * gap * 0.4 + (Math.random() - 0.5) * 1.2, side * row * gap * 0.75)
            group.add(ship)
          }
          group.position.set(startX, y, z)
          orient(group, _v.set(dir, 0, 0))
          group.traverse(o => { if (o !== group) { o.matrixAutoUpdate = false; o.updateMatrix() } })
          scene.add(group)
          formations.push({ group, dir, speed, killX: -startX, bobP: Math.random() * Math.PI * 2 })
        }

        let T = 0, nextSpawn = 0.8
        return (dt) => {
          T += dt
          camera.position.set(Math.sin(T * 0.05) * 7, 8 + Math.sin(T * 0.073) * 3.5, 166)
          camera.lookAt(0, 0, 0)
          nextSpawn -= dt
          if (nextSpawn <= 0 && formations.length < 5) {
            spawnFormation()
            nextSpawn = 2.5 + Math.random() * 4
          }
          for (let i = formations.length - 1; i >= 0; i--) {
            const f = formations[i]
            f.group.position.x += f.dir * f.speed * dt
            f.group.position.y += Math.sin(T * 0.8 + f.bobP) * dt * 0.6
            if (f.dir > 0 ? f.group.position.x > f.killX : f.group.position.x < f.killX) {
              scene.remove(f.group)
              formations.splice(i, 1)
            }
          }
        }
      },
    }
    return createStage(mount, sceneDef, {})
  }, [])

  return (
    <div id="challenge-intro">
      <div className="chin-canvas" ref={mountRef} />
      <div className="chin-vignette" />
      <div className="chin-box">
        <div className="chov-sub chin-rise" style={{ '--d': '0.10s' }}>✦ Post-Campaign ✦</div>
        <div className="chin-title">ENDLESS CHALLENGE MODE</div>
        <div className="chin-rule chin-rise" style={{ '--d': '0.30s' }} />
        <div className="chin-lines chin-rise" style={{ '--d': '0.38s' }}>
          <div className="chin-line"><span className="chin-line-key">THE FOE</span><span>An enemy fleet of escalating strength — the final blockade, returned.</span></div>
          <div className="chin-line"><span className="chin-line-key">THE SPIRAL</span><span>Every round the enemy keeps everything it had, and gains one more buff card.</span></div>
          <div className="chin-line"><span className="chin-line-key">THE STAKES</span><span>The run ends when your fleet falls. Nothing is banked, nothing is lost.</span></div>
        </div>
        <div className="chin-record chin-rise" style={{ '--d': '0.46s' }}>
          <span className="chin-record-key">STANDING RECORD</span>
          {best > 0
            ? <span className="chin-record-val"><b>{best}</b> ROUND{best === 1 ? '' : 'S'} CLEARED</span>
            : <span className="chin-record-val chin-record-none">NO RUN ON RECORD</span>}
        </div>
        <button className="chin-start chin-rise" style={{ '--d': '0.52s' }} onClick={onStart}>▶ START</button>
        <button className="chov-btn chov-btn--ghost chin-rise" style={{ '--d': '0.62s' }} onClick={onBack}>◂ RETURN TO THE CAMPAIGN MAP</button>
      </div>
    </div>
  )
}

// Endless-challenge epitaph: a fullscreen record of how far the run got before
// the fleet broke. Nothing is saved anywhere — this screen IS the result.
export default function ChallengeOver({ round, best = 0, record = false, onReturn }) {
  const cleared = round - 1
  return (
    <div id="challenge-over">
      <div className="chov-box">
        <div className="chov-sub">✦ ENDLESS CHALLENGE ✦</div>
        <div className="chov-title">THE LINE BREAKS</div>
        <div className="chov-rounds">
          <span className="chov-rounds-num">{cleared}</span>
          <span className="chov-rounds-label">ROUND{cleared === 1 ? '' : 'S'} CLEARED</span>
        </div>
        {record
          ? <div className="chov-record chov-record--new">★ NEW RECORD ★</div>
          : best > 0 && <div className="chov-record">STANDING RECORD · {best} ROUND{best === 1 ? '' : 'S'}</div>}
        <div className="chov-text">
          {cleared === 0
            ? 'The Hush closed over the fleet in the first engagement.'
            : `The fleet threw back ${cleared} escalating assault${cleared === 1 ? '' : 's'} before the Hush closed over it in round ${round}.`}
          {' '}The Song remembers those who answered.
        </div>
        <button className="chov-btn" onClick={onReturn}>◂ RETURN TO THE CAMPAIGN MAP</button>
      </div>
    </div>
  )
}
