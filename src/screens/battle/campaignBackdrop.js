import * as THREE from 'three'
import { buildAleph, makeGasGiant, makeRingedPlanet, makeBlackHole } from './geometry'
import { buildStation, buildCathedra } from '../cutscene/models'

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
  { hero: 'aleph',    body: 'gas'    },  // 1 First Contact  — the Aleph artifact
  { hero: 'station',  body: 'ringed' },  // 2 The Muster     — the muster drydock
  { hero: 'blackhole'                },  // 3 The Warfront   — a black hole
  { hero: 'aleph',    body: 'gas'    },  // 4 The Hush       — the silent Aleph
  { hero: 'engine',   body: 'gas'    },  // 5 The Great Litany — the World Engine
  { hero: 'ringed'                   },  // 6 The Fall       — a ringed planet
  { hero: 'cathedra', body: 'gas'    },  // 7 The Final Hearing — the Cathedra
  { hero: 'station',  body: 'ringed' },  // 8 The Annunciator — the staging station
  { hero: 'blackhole'                },  // 9 The Lance      — a black hole
  { hero: 'ringed'                   },  // 10 Order Restored — a ringed planet
]

// A World Engine: a deep-blue sphere girdled by glowing rings (matches the
// cutscene / campaign-map motif).
function buildWorldEngine() {
  const g = new THREE.Group()
  g.add(new THREE.Mesh(
    new THREE.SphereGeometry(3, 48, 32),
    new THREE.MeshStandardMaterial({ color: 0x3a4a8a, emissive: 0x141f44, emissiveIntensity: 0.6, metalness: 0.5, roughness: 0.6 }),
  ))
  for (const [rad, tilt] of [[4.6, -1.1], [5.4, 0.55]]) {
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(rad, 0.16, 8, 72),
      new THREE.MeshBasicMaterial({ color: 0x6f86ff, transparent: true, opacity: 0.7, blending: THREE.AdditiveBlending, depthWrite: false }),
    )
    ring.rotation.set(tilt, 0.4, 0)
    g.add(ring)
  }
  return g
}

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
  const addBody = (kind, ndcX, ndcY) => {
    const bodyR = kind === 'gas' ? 40 : kind === 'ringed' ? 26 : 12
    const pos = placePos(ndcX, ndcY, bodyR, 150 + Math.random() * 30)
    if (kind === 'gas')    return makeGasGiant(scene, disposables, pos, lightDir)
    if (kind === 'ringed') return makeRingedPlanet(scene, disposables, pos, lightDir)
    return makeBlackHole(scene, disposables, pos)
  }

  // a structure hero (Aleph / station / cathedra / world engine), scaled up to
  // megastructure size and parked well beyond the camera's reach
  const addStructure = (build, r, ndcX, ndcY, spin) => {
    const group = fit(build(), r)
    // keep the whole structure beyond the camera's max orbit (110) so it never clips
    group.position.copy(placePos(ndcX, ndcY, r, 210, 125 + r))
    group.rotation.y = Math.random() * Math.PI * 2
    collect(group, disposables)
    scene.add(group)
    if (spin) { const base = group.rotation.y; ticks.push((t) => { group.rotation.y = base + t * spin }) }
  }

  // hero
  switch (spec.hero) {
    case 'aleph':     addStructure(buildAleph,       48, -0.32, 0.42, 0.04); break
    case 'station':   addStructure(buildStation,     52,  0.40, 0.34, 0);    break
    case 'cathedra':  addStructure(buildCathedra,    54, -0.34, 0.30, 0);    break
    case 'engine':    addStructure(buildWorldEngine, 58, -0.30, 0.36, 0.05); break
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
