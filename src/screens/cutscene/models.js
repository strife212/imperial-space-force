import * as THREE from 'three'

// ── Extra cutscene props ─────────────────────────────────────────────────────
// Self-contained THREE.Group builders (each owns its materials) plus an asteroid
// field helper. The stage's teardown disposes everything attached to the scene.

// An orbital station / drydock: a spine with habitation rings, docking arms and
// beacon lights. Oriented along +Y; scenes rotate/scale as needed.
export function buildStation() {
  const g = new THREE.Group()
  const hull = new THREE.MeshStandardMaterial({ color: 0x6b7686, emissive: 0x0a1626, emissiveIntensity: 0.35, metalness: 0.82, roughness: 0.5 })
  const lit = new THREE.MeshBasicMaterial({ color: 0xffd28a })   // window / beacon lights (bloom)
  g.add(new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.2, 30, 14), hull))   // central spine
  g.add(new THREE.Mesh(new THREE.IcosahedronGeometry(4.2, 0), hull))          // command hub
  for (const y of [-8, 0, 8]) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(8, 1.1, 8, 32), hull); ring.position.y = y; ring.rotation.x = Math.PI / 2; g.add(ring)
    for (let k = 0; k < 4; k++) { const s = new THREE.Mesh(new THREE.BoxGeometry(16, 0.6, 0.6), hull); s.position.y = y; s.rotation.y = k * Math.PI / 2; g.add(s) }
  }
  for (const y of [-15, 15]) {
    const arm = new THREE.Mesh(new THREE.BoxGeometry(1.4, 6, 1.4), hull); arm.position.y = y; g.add(arm)
    const pad = new THREE.Mesh(new THREE.CylinderGeometry(3.4, 3.4, 0.7, 12), hull); pad.position.y = y + (y > 0 ? 3.5 : -3.5); g.add(pad)
  }
  for (const [x, y, z] of [[0, 17, 0], [0, -17, 0], [9, 0, 0], [-9, 0, 0], [0, 0, 9], [0, 0, -9]]) {
    const b = new THREE.Mesh(new THREE.SphereGeometry(0.5, 8, 8), lit); b.position.set(x, y, z); g.add(b)
  }
  return g
}

// The Cathedra — a tiered stone spire crowned with light, for the Throneworld.
export function buildCathedra() {
  const g = new THREE.Group()
  const stone = new THREE.MeshStandardMaterial({ color: 0xb9a36a, emissive: 0x3a2c10, emissiveIntensity: 0.4, metalness: 0.5, roughness: 0.6 })
  const lit = new THREE.MeshBasicMaterial({ color: 0xfff0c4 })
  let y = 0
  for (let i = 0; i < 6; i++) { const w = 8 - i * 1.15, h = 4; const t = new THREE.Mesh(new THREE.BoxGeometry(w, h, w), stone); t.position.y = y + h / 2; g.add(t); y += h }
  const apex = new THREE.Mesh(new THREE.ConeGeometry(1.3, 9, 6), stone); apex.position.y = y + 4.5; g.add(apex)
  const crown = new THREE.Mesh(new THREE.SphereGeometry(1.5, 16, 16), lit); crown.position.y = y + 10; g.add(crown)
  for (let i = 0; i < 5; i++) { const dot = new THREE.Mesh(new THREE.SphereGeometry(0.3, 6, 6), lit); dot.position.set((Math.random() - 0.5) * 7, i * 4 + 2, 3.6); g.add(dot) }   // window glow
  return g
}

// A deep-space sensor relay / buoy — what the Cassiopeia was sent to investigate.
export function buildRelay() {
  const g = new THREE.Group()
  const metal = new THREE.MeshStandardMaterial({ color: 0x7a869a, emissive: 0x101a2a, emissiveIntensity: 0.3, metalness: 0.8, roughness: 0.5 })
  const lit = new THREE.MeshBasicMaterial({ color: 0x9fe0ff })
  g.add(new THREE.Mesh(new THREE.BoxGeometry(1.6, 2.6, 1.6), metal))
  const dish = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 0.3, 0.5, 16), metal); dish.position.y = 2.1; dish.rotation.x = 0.5; g.add(dish)
  for (const a of [0, (Math.PI * 2) / 3, (Math.PI * 4) / 3]) { const s = new THREE.Mesh(new THREE.BoxGeometry(0.18, 3.4, 0.18), metal); s.position.set(Math.cos(a) * 1.1, -2.2, Math.sin(a) * 1.1); g.add(s) }
  g.add(new THREE.Mesh(new THREE.SphereGeometry(0.32, 8, 8), lit))
  return g
}

// The World Engine — a deep-blue core girdled by glowing rings (the Great Litany).
export function buildWorldEngine() {
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

// One lumpy asteroid geometry (jittered icosahedron). Reused across a field.
function buildAsteroid() {
  const geo = new THREE.IcosahedronGeometry(1, 1)
  const p = geo.attributes.position
  for (let i = 0; i < p.count; i++) {
    const f = 0.72 + Math.random() * 0.5
    p.setXYZ(i, p.getX(i) * f, p.getY(i) * f, p.getZ(i) * f)
  }
  geo.computeVertexNormals()
  return geo
}

// Scatter a drifting asteroid field in a shell around `center`. Returns
// { group, tick(dt) } — tick tumbles the rocks slowly.
export function asteroidField(ctx, { count = 40, center = new THREE.Vector3(), inner = 30, outer = 130, scaleMin = 0.8, scaleMax = 5 } = {}) {
  const mat = new THREE.MeshStandardMaterial({ color: 0x4a4640, emissive: 0x0a0806, emissiveIntensity: 0.25, metalness: 0.2, roughness: 0.95 })
  const geos = [buildAsteroid(), buildAsteroid(), buildAsteroid(), buildAsteroid()]
  const group = new THREE.Group(); ctx.scene.add(group)
  const rocks = []
  for (let i = 0; i < count; i++) {
    const m = new THREE.Mesh(geos[i % geos.length], mat)
    const dir = new THREE.Vector3(Math.random() - 0.5, (Math.random() - 0.5) * 0.6, Math.random() - 0.5).normalize()
    m.position.copy(center).addScaledVector(dir, inner + Math.random() * (outer - inner))
    m.scale.setScalar(scaleMin + Math.random() * (scaleMax - scaleMin))
    m.rotation.set(Math.random() * 6, Math.random() * 6, Math.random() * 6)
    group.add(m)
    rocks.push({ m, sx: (Math.random() - 0.5) * 0.3, sy: (Math.random() - 0.5) * 0.3 })
  }
  return { group, tick: (dt) => { for (const r of rocks) { r.m.rotation.x += r.sx * dt; r.m.rotation.y += r.sy * dt } } }
}
