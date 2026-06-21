import * as THREE from 'three'
import { TEAMS } from './battle/constants'
import { buildBlueCapital2, buildBlueModel, buildBlueBomber, buildBlueCruiser } from './battle/geometry'

// ── Fleet builder ────────────────────────────────────────────────────────────
// Arrange an arbitrary blue fleet into a parade ("review") formation and add it
// to the stage's scene. Scales to any composition:
//   • the flagship sits at the heart of the formation,
//   • interceptors fan out in concentric rings around it,
//   • cruisers hold both flanks,
//   • bombers trail behind in ranks.
// Geometries are built once and shared across every ship of a class. Returns the
// group plus a bounding sphere so the camera can frame whatever was built.
//
// `ctx` is a cutscene-stage context ({ scene, fx, orient }).
export function buildReviewFleet(ctx, { fighters = 0, bombers = 0, cruisers = 0 } = {}) {
  const { scene, fx, orient } = ctx
  const hullMat = new THREE.MeshStandardMaterial({
    color: TEAMS.blue.color, emissive: TEAMS.blue.color, emissiveIntensity: 0.5, metalness: 0.6, roughness: 0.38,
  })
  const group = new THREE.Group()
  scene.add(group)
  const FWD = new THREE.Vector3(1, 0, 0)   // the whole fleet faces +X

  // shared geometry per ship class
  const geoFighter = buildBlueModel()
  const geoBomber = buildBlueBomber()
  const geoCruiser = buildBlueCruiser()

  // place one ship: hull + an aft engine glow, scaled and oriented to FWD
  const add = (geo, scale, rear, x, y, z) => {
    const g = new THREE.Group()
    g.add(new THREE.Mesh(geo, hullMat))
    const glow = new THREE.Mesh(fx.blastGeo, fx.glowMat.blue)
    glow.scale.setScalar(0.42); glow.position.set(0, 0, -rear); g.add(glow)
    g.scale.setScalar(scale); g.position.set(x, y, z); orient(g, FWD); group.add(g)
    return g
  }

  // ── Flagship: centre, with its three aft nozzles lit ──
  const geoFlag = buildBlueCapital2()
  const flag = new THREE.Group()
  flag.add(new THREE.Mesh(geoFlag, hullMat))
  for (const gx of [-0.45, 0, 0.45]) {
    const glow = new THREE.Mesh(fx.blastGeo, fx.glowMat.blue)
    glow.scale.setScalar(0.5); glow.position.set(gx, 0, -3.8); flag.add(glow)
  }
  flag.scale.setScalar(3.2); orient(flag, FWD); group.add(flag)

  // ── Interceptors: concentric rings, denser rings further out ──
  let placed = 0, ring = 0
  while (placed < fighters) {
    const r = 15 + ring * 6.5
    const cap = Math.max(10, Math.round((2 * Math.PI * r) / 5.5))   // ~one per 5.5u of circumference
    const n = Math.min(cap, fighters - placed)
    const phase = ring * 0.4                                        // stagger rings so they don't line up
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + phase
      add(geoFighter, 1.0, 0.95, Math.cos(a) * r, Math.sin(a * 2 + ring) * 1.7, Math.sin(a) * r)
    }
    placed += n; ring++
  }

  // ── Cruisers: alternating flanks, spread fore-and-aft ──
  const pairs = Math.max(1, Math.ceil(cruisers / 2))
  for (let i = 0; i < cruisers; i++) {
    const side = i % 2 ? 1 : -1, k = Math.floor(i / 2)
    add(geoCruiser, 1.7, 1.5, (k - (pairs - 1) / 2) * 11, 0, side * 34)
  }

  // ── Bombers: trailing ranks behind the formation ──
  const perRow = 6
  for (let i = 0; i < bombers; i++) {
    const row = Math.floor(i / perRow), col = i % perRow
    const n = Math.min(perRow, bombers - row * perRow)
    add(geoBomber, 1.43, 1.4, -44 - row * 9, 0, (col - (n - 1) / 2) * 9)
  }

  const sphere = new THREE.Box3().setFromObject(group).getBoundingSphere(new THREE.Sphere())

  // Tear down everything this fleet owns (so it can be rebuilt live as the
  // player edits the roster). Shared FX (glow geo/material) are owned by the
  // stage, not disposed here.
  const dispose = () => {
    scene.remove(group)
    hullMat.dispose()
    geoFighter.dispose(); geoBomber.dispose(); geoCruiser.dispose(); geoFlag.dispose()
  }

  return { group, center: sphere.center, radius: sphere.radius, dispose }
}
