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

// The Cathedra — the palace-spire of the Universal Order on the Throneworld.
// Same envelope as the original simple build (base at y=0, crown orb at y≈34)
// so scene placements are unchanged, redressed as a monumental palace: stepped
// octagonal plinth with corner obelisks, a gate tier with lit processional
// arches, flying buttresses onto a colonnaded great-hall tier, pilastered upper
// tiers with lancet windows, a ribbed drum and spire, and a haloed crown orb.
// Fully symmetric and deterministic — the architecture of Order.
export function buildCathedra() {
  const g = new THREE.Group()
  const stone = new THREE.MeshStandardMaterial({ color: 0xc2ae7e, emissive: 0x3a2c10, emissiveIntensity: 0.42, metalness: 0.45, roughness: 0.62 })
  const trim  = new THREE.MeshStandardMaterial({ color: 0x8a744a, emissive: 0x241a08, emissiveIntensity: 0.4, metalness: 0.62, roughness: 0.52 })
  const lit   = new THREE.MeshBasicMaterial({ color: 0xfff0c4 })
  const halo  = new THREE.MeshBasicMaterial({ color: 0xffe9b0, transparent: true, opacity: 0.75, blending: THREE.AdditiveBlending, depthWrite: false })

  const FACE = Math.PI / 4                    // octagon facet pitch (vertices at k·45°)
  const APO = Math.cos(Math.PI / 8)           // facet-centre (apothem) ratio
  const oct = (rBot, h, rTop = rBot) => new THREE.CylinderGeometry(rTop, rBot, h, 8)
  const add = (mesh, x, y, z) => { mesh.position.set(x, y, z); g.add(mesh); return mesh }
  const face = (mesh, a) => { mesh.rotation.y = Math.PI / 2 - a; return mesh }   // local +Z outward

  // lit lancet windows spaced around a tier's facets
  const lancets = (r, y, h, every = 1) => {
    for (let k = 0; k < 8; k += every) {
      const a = (k + 0.5) * FACE
      face(add(new THREE.Mesh(new THREE.BoxGeometry(0.16, h, 0.06), lit), Math.cos(a) * (r * APO + 0.05), y, Math.sin(a) * (r * APO + 0.05)), a)
    }
  }
  const cornice = (r, y) => add(new THREE.Mesh(oct(r, 0.5), trim), 0, y, 0)

  // ── stepped plinth, obelisks on the cardinal corners ──
  add(new THREE.Mesh(oct(6.0, 0.8), stone), 0, 0.4, 0)
  add(new THREE.Mesh(oct(5.3, 0.8), stone), 0, 1.2, 0)
  add(new THREE.Mesh(oct(4.7, 0.8), stone), 0, 2.0, 0)
  for (let k = 0; k < 8; k += 2) {
    const a = k * FACE
    add(new THREE.Mesh(new THREE.BoxGeometry(0.5, 1.9, 0.5), trim), Math.cos(a) * 5.15, 2.55, Math.sin(a) * 5.15)
    add(new THREE.Mesh(new THREE.ConeGeometry(0.34, 1.0, 4), trim), Math.cos(a) * 5.15, 4.0, Math.sin(a) * 5.15)
  }

  // ── gate tier: lit processional arches on four facets ──
  add(new THREE.Mesh(oct(4.3, 4.8, 4.05), stone), 0, 4.8, 0)
  for (let k = 0; k < 8; k += 2) {
    const a = (k + 0.5) * FACE
    face(add(new THREE.Mesh(new THREE.BoxGeometry(0.8, 2.0, 0.06), lit), Math.cos(a) * (4.3 * APO + 0.03), 3.6, Math.sin(a) * (4.3 * APO + 0.03)), a)
    face(add(new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.32, 0.3), trim), Math.cos(a) * (4.3 * APO), 4.85, Math.sin(a) * (4.3 * APO)), a)
  }
  cornice(4.55, 7.35)

  // ── flying buttresses rising from plinth piers onto the great hall ──
  const pierGeo = new THREE.BoxGeometry(0.55, 2.6, 0.55)
  const butGeo  = new THREE.BoxGeometry(0.32, 5.7, 0.7)
  for (let k = 1; k < 8; k += 2) {
    const a = k * FACE
    add(new THREE.Mesh(pierGeo, stone), Math.cos(a) * 5.0, 2.9, Math.sin(a) * 5.0)
    const b = add(new THREE.Mesh(butGeo, trim), Math.cos(a) * 4.2, 6.9, Math.sin(a) * 4.2)
    b.quaternion.setFromAxisAngle(new THREE.Vector3(-Math.sin(a), 0, Math.cos(a)), 0.29)
  }

  // ── great-hall tier wrapped in a peristyle colonnade ──
  add(new THREE.Mesh(oct(3.55, 4.45), stone), 0, 9.8, 0)
  lancets(3.55, 9.7, 2.6)
  const colGeo = new THREE.CylinderGeometry(0.13, 0.13, 4.2, 6)
  for (let k = 0; k < 16; k++) {
    const a = (k + 0.5) * (Math.PI / 8)
    add(new THREE.Mesh(colGeo, stone), Math.cos(a) * 4.1, 9.8, Math.sin(a) * 4.1)
  }
  cornice(4.35, 12.15)

  // ── upper palace tiers: pilasters, lancets, corner finials ──
  add(new THREE.Mesh(oct(2.85, 3.8), stone), 0, 14.3, 0)
  for (let k = 0; k < 8; k++) {
    const a = k * FACE
    add(new THREE.Mesh(new THREE.BoxGeometry(0.24, 3.3, 0.24), trim), Math.cos(a) * 2.8, 14.3, Math.sin(a) * 2.8)
  }
  lancets(2.85, 14.2, 2.0)
  cornice(3.1, 16.45)
  for (let k = 1; k < 8; k += 2) {
    const a = k * FACE
    add(new THREE.Mesh(new THREE.ConeGeometry(0.26, 1.2, 4), trim), Math.cos(a) * 2.9, 17.3, Math.sin(a) * 2.9)
  }
  add(new THREE.Mesh(oct(2.2, 3.4), stone), 0, 18.4, 0)
  lancets(2.2, 18.3, 1.6, 2)
  cornice(2.4, 20.35)

  // ── ribbed drum, spire and the radiant crown ──
  add(new THREE.Mesh(oct(1.55, 2.9), stone), 0, 22.05, 0)
  for (let k = 0; k < 8; k++) {
    const a = k * FACE
    add(new THREE.Mesh(new THREE.BoxGeometry(0.15, 2.9, 0.15), trim), Math.cos(a) * 1.55, 22.05, Math.sin(a) * 1.55)
  }
  for (let k = 0; k < 8; k += 2) {
    const a = (k + 0.5) * FACE
    add(new THREE.Mesh(new THREE.SphereGeometry(0.12, 6, 6), lit), Math.cos(a) * (1.55 * APO + 0.06), 22.2, Math.sin(a) * (1.55 * APO + 0.06))
  }
  add(new THREE.Mesh(new THREE.ConeGeometry(1.5, 7, 8), stone), 0, 27.0, 0)
  for (let k = 0; k < 8; k++) {
    const a = k * FACE
    const rib = add(new THREE.Mesh(new THREE.BoxGeometry(0.12, 7.0, 0.12), trim), Math.cos(a) * 0.78, 27.0, Math.sin(a) * 0.78)
    rib.quaternion.setFromAxisAngle(new THREE.Vector3(-Math.sin(a), 0, Math.cos(a)), 0.21)
  }
  add(new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.24, 3.4, 6), trim), 0, 32.2, 0)
  add(new THREE.Mesh(new THREE.SphereGeometry(1.5, 16, 16), lit), 0, 34.2, 0)
  const ring = add(new THREE.Mesh(new THREE.TorusGeometry(2.4, 0.07, 8, 48), halo), 0, 34.2, 0)
  ring.rotation.x = Math.PI / 2
  return g
}

// A deep-space sensor relay / buoy — what the Cassiopeia was sent to investigate.
// Same envelope as the simple build (core at the origin, tilted dish above, a
// tripod below, ~7 units tall) dressed for close-ups: hex core with collars,
// greebles and portholes, a rimmed dish with a strutted feed boom, a secondary
// side dish, solar wings, whip antennae and trussed splayed legs with foot pods.
export function buildRelay() {
  const g = new THREE.Group()
  const metal = new THREE.MeshStandardMaterial({ color: 0x7a869a, emissive: 0x101a2a, emissiveIntensity: 0.3, metalness: 0.8, roughness: 0.5 })
  const panel = new THREE.MeshStandardMaterial({ color: 0x4a5566, emissive: 0x0a1220, emissiveIntensity: 0.3, metalness: 0.72, roughness: 0.6 })
  const cell  = new THREE.MeshStandardMaterial({ color: 0x1c3a5e, emissive: 0x0e2440, emissiveIntensity: 0.55, metalness: 0.6, roughness: 0.35 })
  const lit = new THREE.MeshBasicMaterial({ color: 0x9fe0ff })
  const nav = new THREE.MeshBasicMaterial({ color: 0xff6a52 })
  const add = (parent, mesh, x, y, z) => { mesh.position.set(x, y, z); parent.add(mesh); return mesh }

  // ── hexagonal core: bulkhead collars, equipment boxes, lit portholes ──
  add(g, new THREE.Mesh(new THREE.CylinderGeometry(0.95, 0.95, 2.4, 6), metal), 0, 0, 0)
  add(g, new THREE.Mesh(new THREE.CylinderGeometry(1.12, 1.12, 0.34, 6), panel), 0, 1.05, 0)
  add(g, new THREE.Mesh(new THREE.CylinderGeometry(1.12, 1.12, 0.34, 6), panel), 0, -1.05, 0)
  for (let k = 0; k < 6; k++) {
    const a = (k + 0.5) * Math.PI / 3
    if (k % 2 === 0) {
      const m = add(g, new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.72, 0.3), k === 2 ? panel : metal), Math.cos(a) * 0.9, ((k / 2) % 3 - 1) * 0.45, Math.sin(a) * 0.9)
      m.rotation.y = Math.PI / 2 - a
    } else {
      add(g, new THREE.Mesh(new THREE.SphereGeometry(0.09, 6, 6), lit), Math.cos(a) * 0.88, 0.35 - (k % 3) * 0.35, Math.sin(a) * 0.88)
    }
  }

  // ── main dish assembly, tilted as before; rim, feed boom and strut tripod ──
  const dishG = new THREE.Group(); dishG.position.set(0, 2.1, 0); dishG.rotation.x = 0.5; g.add(dishG)
  add(dishG, new THREE.Mesh(new THREE.CylinderGeometry(2.55, 0.35, 0.45, 24), metal), 0, 0, 0)
  const rim = add(dishG, new THREE.Mesh(new THREE.TorusGeometry(2.55, 0.09, 8, 36), panel), 0, 0.22, 0)
  rim.rotation.x = Math.PI / 2
  add(dishG, new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.6, 0.92), panel), 0, -0.5, 0)          // transceiver pack behind the dish
  add(dishG, new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.6, 6), metal), 0, 0.85, 0)  // feed boom
  const horn = add(dishG, new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.36, 8), metal), 0, 1.55, 0)
  horn.rotation.x = Math.PI
  add(dishG, new THREE.Mesh(new THREE.SphereGeometry(0.11, 8, 8), lit), 0, 1.72, 0)              // radiant feed tip
  const strutGeo = new THREE.BoxGeometry(0.045, 2.5, 0.045)
  for (let k = 0; k < 3; k++) {
    const a = k * (Math.PI * 2 / 3) + 0.5
    const s = add(dishG, new THREE.Mesh(strutGeo, panel), Math.cos(a) * 1.1, 0.85, Math.sin(a) * 1.1)
    s.quaternion.setFromAxisAngle(new THREE.Vector3(-Math.sin(a), 0, Math.cos(a)), 1.05)
  }

  // ── secondary dish on a side arm, listening the other way ──
  add(g, new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.13, 0.13), metal), 1.25, -0.5, 0)
  const sd = add(g, new THREE.Mesh(new THREE.CylinderGeometry(0.68, 0.1, 0.24, 14), panel), 1.85, -0.5, 0)
  sd.rotation.z = 0.35 - Math.PI / 2
  add(g, new THREE.Mesh(new THREE.SphereGeometry(0.07, 6, 6), lit), 2.02, -0.44, 0)

  // ── solar wings on rail arms, clear of the dish tilt plane ──
  for (const s of [1, -1]) {
    add(g, new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.1, 0.1), metal), s * 1.35, 0.35, 0)
    add(g, new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.04, 0.85), cell), s * 2.6, 0.35, 0)
    for (const dz of [0.46, -0.46]) add(g, new THREE.Mesh(new THREE.BoxGeometry(1.94, 0.07, 0.07), panel), s * 2.6, 0.35, dz)
    add(g, new THREE.Mesh(new THREE.SphereGeometry(0.07, 6, 6), nav), s * 3.5, 0.35, 0)
  }

  // ── whip antennae off the upper collar ──
  for (const s of [1, -1]) {
    const w = add(g, new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.035, 1.5, 5), metal), s * 0.85, 1.9, -0.45)
    w.rotation.z = s * -0.3
    add(g, new THREE.Mesh(new THREE.SphereGeometry(0.06, 6, 6), s > 0 ? nav : lit), s * 1.07, 2.6, -0.45)
  }

  // ── trussed tripod: splayed rail pairs, cross-rungs, foot pods ──
  const railGeo = new THREE.BoxGeometry(0.09, 3.3, 0.09)
  const rungGeo = new THREE.BoxGeometry(0.07, 0.07, 0.34)
  for (let k = 0; k < 3; k++) {
    const a = k * (Math.PI * 2 / 3)
    const dir = new THREE.Vector3(Math.cos(a), 0, Math.sin(a))
    const t = new THREE.Vector3(-Math.sin(a), 0, Math.cos(a))
    for (const ds of [0.14, -0.14]) {
      const r = new THREE.Mesh(railGeo, metal)
      r.position.set(dir.x * 1.15 + t.x * ds, -2.25, dir.z * 1.15 + t.z * ds)
      r.quaternion.setFromAxisAngle(t, 0.185)              // splay: feet wider than shoulders
      g.add(r)
    }
    for (const ry of [-1.3, -2.2, -3.1]) {
      const rung = new THREE.Mesh(rungGeo, panel)
      const spread = 1.15 + (-(ry + 0.55)) * 0.19          // follow the splay outward
      rung.position.set(dir.x * spread, ry, dir.z * spread)
      rung.rotation.y = -a + Math.PI / 2
      g.add(rung)
    }
    add(g, new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.3, 0.34, 8), panel), dir.x * 1.48, -3.95, dir.z * 1.48)
    if (k === 0) add(g, new THREE.Mesh(new THREE.SphereGeometry(0.07, 6, 6), nav), dir.x * 1.48, -4.18, dir.z * 1.48)
  }
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

// One asteroid geometry: an icosahedron sculpted by coherent low-frequency
// waves (lumpy potato silhouette), dented with smooth craters and stretched
// along a random axis. Recessed areas are darkened via vertex colours (fake
// ambient occlusion); the non-indexed polyhedron keeps facet normals, so the
// rocks read as chunky shattered stone instead of crumpled blobs.
function buildAsteroid() {
  const geo = new THREE.IcosahedronGeometry(1, 2)
  const waves = Array.from({ length: 5 }, (_, i) => ({
    k: new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize()
      .multiplyScalar(1.4 + i * 1.05 + Math.random() * 0.6),
    a: 0.30 / (1 + i * 0.75),
    ph: Math.random() * Math.PI * 2,
  }))
  const craters = Array.from({ length: 3 + ((Math.random() * 3) | 0) }, () => ({
    dir: new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize(),
    r: 0.35 + Math.random() * 0.45,        // angular radius
    depth: 0.10 + Math.random() * 0.18,
  }))
  const stretch = new THREE.Vector3(0.72 + Math.random() * 0.6, 0.72 + Math.random() * 0.6, 0.72 + Math.random() * 0.6)
  const p = geo.attributes.position
  const v = new THREE.Vector3()
  const rs = new Float32Array(p.count)
  let rMin = Infinity, rMax = -Infinity
  for (let i = 0; i < p.count; i++) {
    v.set(p.getX(i), p.getY(i), p.getZ(i)).normalize()
    let r = 1
    for (const w of waves) r += w.a * Math.sin(v.dot(w.k) * Math.PI + w.ph)
    for (const c of craters) {
      const d = v.angleTo(c.dir)
      if (d < c.r) { const t = 1 - d / c.r; r -= c.depth * t * t * (3 - 2 * t) }   // smoothstep dent
    }
    rs[i] = r
    if (r < rMin) rMin = r
    if (r > rMax) rMax = r
    p.setXYZ(i, v.x * r * stretch.x, v.y * r * stretch.y, v.z * r * stretch.z)
  }
  const col = new Float32Array(p.count * 3)
  for (let i = 0; i < p.count; i++) {
    const shade = 0.52 + 0.48 * ((rs[i] - rMin) / Math.max(1e-5, rMax - rMin))   // crevices darker
    col[i * 3] = shade; col[i * 3 + 1] = shade; col[i * 3 + 2] = shade
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3))
  geo.computeVertexNormals()
  return geo
}

// Scatter a drifting asteroid field in a shell around `center`. Returns
// { group, tick(dt) } — tick tumbles the rocks slowly (small rocks faster).
export function asteroidField(ctx, { count = 40, center = new THREE.Vector3(), inner = 30, outer = 130, scaleMin = 0.8, scaleMax = 5 } = {}) {
  // a few rock tints — grey, umber, cold slate — with the AO baked per vertex
  const mats = [0x5a544a, 0x52453a, 0x474b54].map(c => new THREE.MeshStandardMaterial({
    color: c, vertexColors: true, emissive: 0x0a0806, emissiveIntensity: 0.3, metalness: 0.15, roughness: 0.95,
  }))
  const geos = Array.from({ length: 6 }, buildAsteroid)
  const group = new THREE.Group(); ctx.scene.add(group)
  const rocks = []
  for (let i = 0; i < count; i++) {
    const m = new THREE.Mesh(geos[i % geos.length], mats[i % mats.length])
    const dir = new THREE.Vector3(Math.random() - 0.5, (Math.random() - 0.5) * 0.6, Math.random() - 0.5).normalize()
    m.position.copy(center).addScaledVector(dir, inner + Math.random() * (outer - inner))
    const s = scaleMin + (scaleMax - scaleMin) * Math.pow(Math.random(), 1.8)   // power-law: many small, few large
    m.scale.setScalar(s)
    m.rotation.set(Math.random() * 6, Math.random() * 6, Math.random() * 6)
    group.add(m)
    const spin = 0.45 / (0.6 + s)                                              // small rocks tumble faster
    rocks.push({ m, sx: (Math.random() - 0.5) * spin * 2, sy: (Math.random() - 0.5) * spin * 2, sz: (Math.random() - 0.5) * spin })
  }
  return { group, tick: (dt) => { for (const r of rocks) { r.m.rotation.x += r.sx * dt; r.m.rotation.y += r.sy * dt; r.m.rotation.z += r.sz * dt } } }
}
