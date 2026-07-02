import * as THREE from 'three'

// ── Extra cutscene props ─────────────────────────────────────────────────────
// Self-contained THREE.Group builders (each owns its materials) plus an asteroid
// field helper. The stage's teardown disposes everything attached to the scene.

// An orbital station / drydock: a spine with habitation rings, docking arms and
// beacon lights. Oriented along +Y; scenes rotate/scale as needed. Same envelope
// and silhouette as the original simple build (height ~±18.9, radius ~9.1), but
// dressed with bulkhead collars, hull greebles, ring habitation pods, trussed
// spokes, lit windows, a comms dish and landing-pad rings for close-up fidelity.
export function buildStation() {
  const g = new THREE.Group()
  const hull  = new THREE.MeshStandardMaterial({ color: 0x6b7686, emissive: 0x0a1626, emissiveIntensity: 0.35, metalness: 0.82, roughness: 0.5 })
  const panel = new THREE.MeshStandardMaterial({ color: 0x424d5e, emissive: 0x070f1c, emissiveIntensity: 0.3, metalness: 0.75, roughness: 0.62 })
  const lit   = new THREE.MeshBasicMaterial({ color: 0xffd28a })   // window / beacon lights (bloom)
  const nav   = new THREE.MeshBasicMaterial({ color: 0xff6a52 })   // hazard / nav markers

  // shared low-poly pieces, reused across the greebles
  const podGeo    = new THREE.BoxGeometry(1.3, 1.5, 2.0)   // x = radial depth, z = tangential
  const strutGeo  = new THREE.BoxGeometry(16, 0.3, 0.3)
  const windowGeo = new THREE.SphereGeometry(0.13, 6, 6)

  // ── central spine, segmented by bulkhead collars, hugged by utility modules ──
  g.add(new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.2, 30, 14), hull))
  for (const y of [-12.2, -4.4, 4.4, 12.2]) {
    const collar = new THREE.Mesh(new THREE.CylinderGeometry(2.7, 2.7, 1.1, 14), panel)
    collar.position.y = y; g.add(collar)
  }
  const modY = [-11, -6.2, -3.4, 3.4, 6.2, 11]
  for (let i = 0; i < 12; i++) {
    const a = i * 2.4                       // golden-angle spread — even but unaligned
    const m = new THREE.Mesh(podGeo, i % 3 ? panel : hull)
    m.scale.setScalar(0.34 + (i % 3) * 0.09)
    m.position.set(Math.cos(a) * 2.35, modY[i % 6] + ((i % 4) - 1.5) * 0.35, Math.sin(a) * 2.35)
    m.rotation.y = -a
    g.add(m)
  }
  for (let i = 0; i < 8; i++) {             // lit portholes between the rings
    const a = i * 2.4 + 1.2, y = modY[(i + 3) % 6] + 1.3
    const w = new THREE.Mesh(windowGeo, lit)
    w.position.set(Math.cos(a) * 2.28, y, Math.sin(a) * 2.28)
    g.add(w)
  }

  // ── command hub: faceted core, equatorial collar, comms dish ──
  g.add(new THREE.Mesh(new THREE.IcosahedronGeometry(4.2, 0), hull))
  const hubBand = new THREE.Mesh(new THREE.CylinderGeometry(4.5, 4.5, 0.9, 18), panel)
  g.add(hubBand)
  const dish = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 0.16, 0.55, 14), panel)
  dish.position.set(4.6, 2.1, 0); dish.rotation.z = -0.85; g.add(dish)
  const dishTip = new THREE.Mesh(windowGeo, nav)
  dishTip.position.set(5.2, 2.75, 0); g.add(dishTip)

  // ── habitation rings: smoother tori, trussed spokes, pods and window bands ──
  for (const y of [-8, 0, 8]) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(8, 1.0, 10, 48), hull)
    ring.position.y = y; ring.rotation.x = Math.PI / 2; g.add(ring)
    for (let k = 0; k < 4; k++) {                          // paired thin struts (truss look)
      for (const dy of [-0.4, 0.4]) {
        const s = new THREE.Mesh(strutGeo, panel)
        s.position.y = y + dy; s.rotation.y = k * Math.PI / 2
        g.add(s)
      }
    }
    for (let k = 0; k < 8; k++) {                          // habitation pods studding the ring
      const a = (k / 8) * Math.PI * 2 + (y === 0 ? Math.PI / 8 : 0)
      const pod = new THREE.Mesh(podGeo, k % 2 ? hull : panel)
      pod.position.set(Math.cos(a) * 8, y, Math.sin(a) * 8)
      pod.rotation.y = -a
      g.add(pod)
    }
    for (let k = 0; k < 10; k++) {                         // window lights on the outer face
      const a = (k / 10) * Math.PI * 2 + 0.31 * (y + 9)
      const w = new THREE.Mesh(windowGeo, lit)
      w.position.set(Math.cos(a) * 9.0, y + ((k % 3) - 1) * 0.3, Math.sin(a) * 9.0)
      g.add(w)
    }
  }

  // ── docking arms: railed trusses, pads with lit landing rings + nav markers ──
  for (const y of [-15, 15]) {
    const sgn = y > 0 ? 1 : -1
    const arm = new THREE.Mesh(new THREE.BoxGeometry(1.1, 6, 1.1), hull); arm.position.y = y; g.add(arm)
    for (const [ox, oz] of [[0.8, 0], [-0.8, 0], [0, 0.8], [0, -0.8]]) {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(0.26, 5.4, 0.26), panel)
      rail.position.set(ox, y, oz); g.add(rail)
    }
    const padY = y + sgn * 3.5
    const pad = new THREE.Mesh(new THREE.CylinderGeometry(3.4, 3.4, 0.7, 18), hull); pad.position.y = padY; g.add(pad)
    const rim = new THREE.Mesh(new THREE.TorusGeometry(2.9, 0.09, 6, 36), lit)     // landing ring on the deck
    rim.position.y = padY + sgn * 0.36; rim.rotation.x = Math.PI / 2; g.add(rim)
    const tower = new THREE.Mesh(new THREE.BoxGeometry(0.8, 1.0, 0.8), panel)      // control room under the deck lip
    tower.position.set(2.5, padY - sgn * 0.8, 0); g.add(tower)
    for (const a of [Math.PI / 3, Math.PI]) {                                      // hazard markers on the deck edge
      const n = new THREE.Mesh(windowGeo, nav)
      n.position.set(Math.cos(a) * 3.1, padY + sgn * 0.38, Math.sin(a) * 3.1)
      g.add(n)
    }
  }

  // ── original beacon set (kept — part of the recognisable silhouette) ──
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
