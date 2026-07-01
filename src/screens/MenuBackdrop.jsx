import { useRef, useEffect } from 'react'
import * as THREE from 'three'
import { createStage } from './cutscene/stage'
import { makeBlackHoleLensed, buildBlueModel, buildBlueBomber, buildBlueCruiser } from './battle/geometry'
import { TEAMS } from './battle/constants'

// Looping idle "attract" scene behind the main menu: the lensed black hole hangs
// centre frame while blue fleet formations cruise across the screen every now and
// then — near passes sweep in front of the hole, far ones drift behind it and are
// silhouetted against (and occluded by) the shadow. Runs until unmounted.
export default function MenuBackdrop() {
  const mountRef = useRef(null)

  useEffect(() => {
    const mount = mountRef.current
    if (!mount) return
    const sceneDef = {
      bloom: 0.8,
      create(ctx) {
        const { scene, camera, fx, orient, track } = ctx

        // ── the lensed black hole, centre stage at a gentle 3/4 disk angle ──
        const disp = []
        const bhTick = makeBlackHoleLensed(scene, disp, new THREE.Vector3(0, 2, 0))
        track(...disp)

        // shared ship resources (one hull material + one geometry per class)
        const hullMat = new THREE.MeshStandardMaterial({
          color: TEAMS.blue.color, emissive: TEAMS.blue.color, emissiveIntensity: 0.55, metalness: 0.6, roughness: 0.38,
        })
        const geoF = buildBlueModel(), geoB = buildBlueBomber(), geoC = buildBlueCruiser()
        track(hullMat, geoF, geoB, geoC)

        const formations = []
        const _v = new THREE.Vector3()

        // a V-formation of one ship class, entering off-screen and crossing over
        const spawnFormation = () => {
          const near = Math.random() < 0.55                 // lane: in front of / behind the hole
          const dir = Math.random() < 0.5 ? 1 : -1          // left→right or right→left
          const z = near ? 82 + Math.random() * 38 : -70 - Math.random() * 50
          const y = (Math.random() - 0.5) * (near ? 40 : 70) + (near ? -8 : 8)
          const speed = near ? 30 + Math.random() * 14 : 10 + Math.random() * 6
          const startX = -dir * (near ? 130 : 215)
          const roll = Math.random()
          const kind = roll < 0.62 ? 'fighter' : roll < 0.85 ? 'bomber' : 'cruiser'
          const geo = kind === 'fighter' ? geoF : kind === 'bomber' ? geoB : geoC
          // background flavour reads better a touch oversized
          const scale = (kind === 'fighter' ? 1.0 : kind === 'bomber' ? 1.43 : 1.7) * 1.35
          const rear = kind === 'fighter' ? 0.95 : kind === 'bomber' ? 1.4 : 1.5
          const n = kind === 'fighter' ? 3 + ((Math.random() * 4) | 0) : 2 + ((Math.random() * 2) | 0)
          const gap = kind === 'fighter' ? 5.5 : 9

          const group = new THREE.Group()
          for (let i = 0; i < n; i++) {
            const row = (i + 1) >> 1, side = i === 0 ? 0 : (i % 2 ? 1 : -1)
            const ship = new THREE.Group()
            ship.add(new THREE.Mesh(geo, hullMat))
            const glow = new THREE.Mesh(fx.blastGeo, fx.glowMat.blue)
            glow.scale.setScalar(0.38); glow.position.set(0, 0, -rear)
            ship.add(glow)
            ship.scale.setScalar(scale)
            // wingmen trail the leader in a V, fanning slightly in height and depth
            ship.position.set(-dir * row * gap, side * row * gap * 0.4 + (Math.random() - 0.5) * 1.2, side * row * gap * 0.75)
            group.add(ship)
          }
          group.position.set(startX, y, z)
          orient(group, _v.set(dir, 0, 0))
          scene.add(group)
          formations.push({ group, dir, speed, killX: -startX, bobP: Math.random() * Math.PI * 2 })
        }

        let T = 0, nextSpawn = 1.4   // the first patrol shows up almost immediately
        if (import.meta.env.DEV) window.__menuIdle = formations   // dev probe for the idle scene
        return (dt) => {
          T += dt
          bhTick(T)
          // slow parallax drift keeps the frame alive without stealing attention
          camera.position.set(Math.sin(T * 0.05) * 7, 11 + Math.sin(T * 0.073) * 3.5, 168)
          camera.lookAt(0, 2, 0)

          nextSpawn -= dt
          if (nextSpawn <= 0 && formations.length < 4) {
            spawnFormation()
            nextSpawn = 4 + Math.random() * 6
          }
          for (let i = formations.length - 1; i >= 0; i--) {
            const f = formations[i]
            f.group.position.x += f.dir * f.speed * dt
            f.group.position.y += Math.sin(T * 0.8 + f.bobP) * dt * 0.6   // gentle wander
            if (f.dir > 0 ? f.group.position.x > f.killX : f.group.position.x < f.killX) {
              scene.remove(f.group)   // shared geo/materials are disposed at stage teardown
              formations.splice(i, 1)
            }
          }
        }
      },
    }
    return createStage(mount, sceneDef, {})
  }, [])

  return (
    <div className="menu-backdrop" aria-hidden="true">
      <div className="menu-backdrop-canvas" ref={mountRef} />
      <div className="menu-backdrop-vignette" />
    </div>
  )
}
