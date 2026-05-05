export const BOOT_LINES = [
  { text: 'Authenticating operator HIH V. ASTRAIA // CLR-Ω',         tag: 'OK',   ms: 300 },
  { text: 'Initializing WGS-84 geodetic reference frame',             tag: 'OK',   ms: 270 },
  { text: 'Loading Kerr–Newman metric solver (a=0.998, Q=0.043)',     tag: 'OK',   ms: 315 },
  { text: 'Calibrating Lense–Thirring frame-drag compensators',       tag: 'OK',   ms: 240 },
  { text: 'Verifying physics package safety interlocks',              tag: 'OK',   ms: 360 },
  { text: 'Running Kretschmann invariant self-test',                  tag: 'OK',   ms: 285 },
  { text: 'Establishing 256-qubit QKD uplink to ground station',      tag: 'OK',   ms: 465 },
  { text: 'Loading geodesic fire-control integrator (6th-order RK)',  tag: 'OK',   ms: 265 },
  { text: 'Initializing Minkowski threat-detection array',            tag: 'OK',   ms: 330 },
  { text: 'Chronology protection diagnostic — CTC scan',              tag: 'OK',   ms: 390 },
  { text: 'Tachyonic flux monitor: 2.4σ above background',            tag: 'WARN', ms: 450 },
  { text: 'All systems nominal — entering operational mode',          tag: 'OK',   ms: 600 },
]

export const LOG_MESSAGES = [
  ['INFO', 'Geodesic integrator step δλ refined to 1.0e-9'],
  ['INFO', 'Schwarzschild correction applied to fire-control loop'],
  ['INFO', 'Lense–Thirring precession nominal; ω_LT bounded'],
  ['INFO', 'QKD key rotation complete — uplink resealed'],
  ['INFO', 'Capacitor bank topped from D-³He primary'],
  ['INFO', 'ADM mass reconciliation Δ < 1 ppm'],
  ['INFO', 'Stress-energy T_μν: dominant energy condition holds'],
  ['INFO', 'Sweep complete — sector Δ light-cone clear'],
  ['INFO', 'Frame-drag compensator engaged // gyroscope drift cancelled'],
  ['INFO', 'Vacuum metastability inspection scheduled at T+19:00'],
  ['INFO', 'Targeting handoff: ASSET-X9 reacquired on geodesic'],
  ['WARN', 'Tachyonic flux 2.4σ above background — monitoring'],
  ['WARN', 'Radiator ΔT trending warm; passive bleed engaged'],
  ['WARN', 'GRB collimator alignment drift +0.0007 rad'],
  ['WARN', 'Local Ricci scalar departed nominal envelope (Δ < 3σ)'],
  ['WARN', 'Coriolis residual in inertial frame — recalibrating'],
  ['CRIT', 'CHRONOLOGY MONITOR: candidate CTC dismissed (false +)'],
  ['CRIT', 'False-vacuum seed Ψ-7 LOCKOUT confirmed by 2-of-3 vote'],
  ['CRIT', 'KERR–NEWMAN warhead arming key inserted // double-bolt'],
]

export const PKG_NAMES = {
  kn:     'KERR–NEWMAN WARHEAD',
  exotic: 'EXOTIC-MATTER LANCE',
  grb:    'COLLIMATED GRB EMITTER',
  rkv:    'RELATIVISTIC KINETIC SLUG',
  vac:    'FALSE-VACUUM SEED Ψ-7',
}

export const SECTION_INFO = {
  rail: {
    name: 'PRIMARY RAIL ASSEMBLY',
    labelPos: { left: '38%', top: '14%' },
    stats: 'Length: 4,200 m  ·  Rail separation: 0.80 m  ·  Material: μ-crystal tungsten composite  ·  Max current: 8.4 MA  ·  Muzzle velocity: 12.4 km/s',
    highlight: [0.18, 0.38, 0.64, 0.26],
  },
  coils: {
    name: 'EM ACCELERATOR COILS ×24',
    labelPos: { left: '22%', top: '55%' },
    stats: 'Coil pitch: 175 m  ·  Peak B-field: 42 T  ·  Conductor: REBCO HTS tape  ·  Quench protection: active cryogenic shunt  ·  Stored energy: 14.2 GJ',
    highlight: [0.18, 0.44, 0.64, 0.14],
  },
  sensor: {
    name: 'TARGETING SENSOR ARRAY',
    labelPos: { left: '63%', top: '22%' },
    stats: 'Aperture: 3.2 m  ·  Bands: X/Ka/optical  ·  Angular resolution: 0.04 µrad  ·  Geodetic pointing: Schwarzschild-corrected  ·  Lock range: 8,000 km',
    highlight: [0.78, 0.22, 0.16, 0.18],
  },
  caps: {
    name: 'CAPACITOR BANK CLUSTER',
    labelPos: { left: '60%', top: '65%' },
    stats: 'Capacity: 14.2 GJ  ·  Charge time: 48 s  ·  Discharge: 2.1 ms  ·  Peak power: 6.76 TW  ·  Dielectric: nano-laminate aerogel  ·  Redundancy: 3-of-4',
    highlight: [0.60, 0.52, 0.22, 0.22],
  },
  tanks: {
    name: 'REACTION MASS TANKS',
    labelPos: { left: '6%', top: '72%' },
    stats: 'Propellant: liquid Xe  ·  Mass: 4,200 kg  ·  ΔV budget: 680 m/s  ·  Thruster Isp: 3,100 s  ·  MMOD shield: 20 cm Al-Whipple',
    highlight: [0.04, 0.54, 0.14, 0.20],
  },
  command: {
    name: 'FIRE CONTROL MODULE',
    labelPos: { left: '5%', top: '20%' },
    stats: 'CPU: 3× fault-tolerant RISC-V cluster  ·  GR solver: 6th-order Runge-Kutta  ·  Targeting latency: 1.2 ms  ·  Auth: 2-of-3 bio-key  ·  Shielding: 8 cm polyethylene + B₄C',
    highlight: [0.04, 0.22, 0.14, 0.22],
  },
}
