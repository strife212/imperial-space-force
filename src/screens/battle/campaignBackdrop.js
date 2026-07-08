import * as THREE from 'three'
import { buildAleph, makeGasGiant, makeRingedPlanet, makeEarthlike, makeMachinePlanet, makeBlackHoleLensed } from './geometry'
import { buildStation, buildCathedra, buildWorldEngine, buildAnnunciator } from '../cutscene/models'

// ── Campaign battle backdrops ────────────────────────────────────────────────
// Each node's engagement features the signature object from its cutscene in the
// background (the Aleph, the World Engine, a planet, a black hole, …) so the
// battle reads as taking place at that location. Falls back to nothing special
// for nodes without a distinctive body (the random skirmish backdrop is used
// instead — see SpaceBattleScreen).
//
// `hero` = the iconic structure/body, placed prominently; `body` = an optional
// celestial body behind it for depth, matching the cutscene's second object.
const NODE_BACKDROP = [
  { hero: 'aleph'                    },  // 1 First Contact  — the Aleph artifact, alone
  { hero: 'station',  body: 'ringed' },  // 2 The Muster     — the muster drydock
  { hero: 'blackhole'                },  // 3 The Warfront   — a black hole
  { hero: 'aleph'                    },  // 4 The Hush       — the silent Aleph, alone
  { hero: 'litany'                   },  // 5 The Great Litany — the machine planet + Throneworld beyond
  { hero: 'ringed'                   },  // 6 The Fall       — a ringed planet
  { hero: 'throneworld'              },  // 7 The Final Hearing — the Throneworld, Cathedra at its pole
  { hero: 'rkv'                      },  // 8 The Annunciator — the RKV platform itself
  { hero: 'blackhole'                },  // 9 The Lance      — a black hole
  { hero: 'ringed'                   },  // 10 Order Restored — a ringed planet
]

// centre a built group and scale it so its bounding radius ≈ r
function fit(group, r) {
  const box = new THREE.Box3().setFromObject(group)
  const c = box.getCenter(new THREE.Vector3())
  group.children.forEach(ch => ch.position.sub(c))
  const rad = box.getSize(new THREE.Vector3()).length() / 2 || 1
  group.scale.setScalar(r / rad)
  return group
}

const collect = (obj, disposables) => obj.traverse(n => {
  if (n.geometry) disposables.push(n.geometry)
  if (n.material) (Array.isArray(n.material) ? n.material : [n.material]).forEach(m => disposables.push(m))
})

export function makeCampaignBackdrop(scene, disposables, lightDir, camera, nodeIndex) {
  const spec = NODE_BACKDROP[nodeIndex]
  if (!spec) return null

  // place along a view ray (so the object sits on-screen in the opening shot),
  // pushed far enough out to clear the arena — and, for big structures, beyond
  // the camera's orbit so it can never fly into them.
  const placePos = (ndcX, ndcY, bodyR, baseDist, minCenter = 0) => {
    const ray = new THREE.Vector3(ndcX, ndcY, 0.5).unproject(camera).sub(camera.position).normalize()
    let dist = baseDist
    const pos = camera.position.clone().addScaledVector(ray, dist)
    while ((pos.length() - bodyR < 55 || pos.length() < minCenter) && dist < 700) {
      dist += 14
      pos.copy(camera.position).addScaledVector(ray, dist)
    }
    return pos
  }

  const ticks = []

  // a celestial body (uses the existing skirmish backdrop builders)
  const addBody = (kind, ndcX, ndcY, baseDist = 150 + Math.random() * 30) => {
    const bodyR = kind === 'gas' ? 40 : kind === 'ringed' ? 26 : kind === 'earth' ? 22 : 16   // black hole: shadow r ≈ 2.6 rs
    const pos = placePos(ndcX, ndcY, bodyR, baseDist)
    if (kind === 'gas')    return makeGasGiant(scene, disposables, pos, lightDir)
    if (kind === 'ringed') return makeRingedPlanet(scene, disposables, pos, lightDir)
    if (kind === 'earth')  return makeEarthlike(scene, disposables, pos, lightDir)
    return makeBlackHoleLensed(scene, disposables, pos)
  }

  // a structure hero (Aleph / station / cathedra / world engine), scaled up to
  // megastructure size and parked well beyond the camera's reach
  const addStructure = (build, r, ndcX, ndcY, spin, faceCamera) => {
    const group = fit(build(), r)
    // keep the whole structure beyond the camera's max orbit (110) so it never clips
    const pos = placePos(ndcX, ndcY, r, 210, 125 + r)
    group.position.copy(pos)
    if (faceCamera) {
      // orient the bright front (+Z) toward the opening camera shot; the camera's
      // slow auto-orbit then sweeps across it from there. (Object3D.lookAt points
      // local +Z at the target.)
      group.lookAt(camera.position)
    } else {
      group.rotation.y = Math.random() * Math.PI * 2
      if (spin) { const base = group.rotation.y; ticks.push((t) => { group.rotation.y = base + t * spin }) }
    }
    collect(group, disposables)
    scene.add(group)
  }

  // hero
  switch (spec.hero) {
    case 'aleph':     addStructure(buildAleph,       48, -0.32, 0.42, 0, true); break
    case 'station':   addStructure(buildStation,     52,  0.40, 0.34, 0);    break
    case 'throneworld': {
      // the Final Hearing below the battle: the earthlike Throneworld with the
      // Cathedra rooted at its near pole (as in the cutscene), the whole world
      // tipped so the spire leans into the opening shot instead of floating free
      const group = new THREE.Group()
      const tk = makeEarthlike(group, disposables, new THREE.Vector3(0, 0, 0), lightDir)   // R = 22
      if (tk) ticks.push(tk)
      const cath = buildCathedra()
      cath.scale.setScalar(0.5)                       // spire ≈ 17 over a 22-radius world — monumental, not silly
      cath.position.set(0, 21.5, 0)                   // plinth bedded into the polar crust
      group.add(cath)
      collect(cath, disposables)
      group.scale.setScalar(1.8)                      // planet reads at machine-planet scale (~R 40)
      const pos = placePos(-0.34, 0.30, 40, 230, 200) // beyond the camera orbit + spire reach
      group.position.copy(pos)
      // lean the pole (and its spire) partway toward the camera — enough to read
      // the silhouette against the sky without staring straight down the crown
      const tilt = camera.position.clone().sub(pos).normalize().multiplyScalar(0.8)
      tilt.y += 0.62
      group.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), tilt.normalize())
      scene.add(group)
      break
    }
    case 'cathedra':  addStructure(buildCathedra,    54, -0.34, 0.30, 0);    break
    case 'rkv':       addStructure(buildAnnunciator, 112, 0.38, 0.34, 0, true); break   // broadside profile
    case 'engine':    addStructure(buildWorldEngine, 58, -0.30, 0.36, 0.05); break
    case 'litany': {
      // the machine planet girdled by its diadem, the Throneworld far beyond
      const pos = placePos(-0.30, 0.36, 40, 190)
      const tk = makeMachinePlanet(scene, disposables, pos, lightDir)
      if (tk) ticks.push(tk)
      const diademMat = new THREE.MeshBasicMaterial({ color: 0x6f86ff, transparent: true, opacity: 0.4, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })
      disposables.push(diademMat)
      for (const [rad, tube, rx] of [[58, 0.8, -1.1], [66, 0.4, -1.0]]) {
        const ring = new THREE.Mesh(new THREE.TorusGeometry(rad, tube, 8, 120), diademMat)
        ring.position.copy(pos); ring.rotation.set(rx, 0.4, 0)
        scene.add(ring); disposables.push(ring.geometry)
      }
      // the Throneworld it serves: far beyond, peeking out from behind the disc
      const dirM = pos.clone().sub(camera.position).normalize()
      const right = new THREE.Vector3().crossVectors(dirM, camera.up).normalize()
      const up = new THREE.Vector3().crossVectors(right, dirM).normalize()
      const posE = camera.position.clone().addScaledVector(dirM, 430)
        .addScaledVector(right, 88).addScaledVector(up, 55)
      const tk2 = makeEarthlike(scene, disposables, posE, lightDir)
      if (tk2) ticks.push(tk2)
      break
    }
    case 'gas':       { const tk = addBody('gas',    0.0, 0.4); if (tk) ticks.push(tk); break }
    case 'ringed':    { const tk = addBody('ringed', 0.25, 0.35); if (tk) ticks.push(tk); break }
    case 'blackhole': { const tk = addBody('blackhole', -0.05, 0.34); if (tk) ticks.push(tk); break }
  }

  // optional secondary body, off to the other side for depth
  if (spec.body) {
    const tk = addBody(spec.body, 0.55, 0.1)
    if (tk) ticks.push(tk)
  }

  return ticks.length ? (t) => ticks.forEach(fn => fn(t)) : null
}
