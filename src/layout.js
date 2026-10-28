// Stylised, compressed map of Hollywood → Downtown LA.
// +x = east, -z = north. 1 unit ≈ 3m vertically; distances are squeezed.
import { hash2 } from './noise.js';

export const WORLD = { x0: -320, x1: 400, z0: -280, z1: 320 };

export const L = {
  obs: { x: 60, z: -40, y: 44 },
  lee: { x: -74, z: -188 },
  chinese: { x: -180, z: 12 },
  capitol: { x: -80, z: -4 },
  dtla: { x: 258, z: 222 },
  usbank: { x: 220, z: 212 },
  wilshire: { x: 220, z: 248 },
  cityhall: { x: 300, z: 212 },
  disney: { x: 260, z: 178 },
  century: { x: -272, z: 150 },
};

export const HERO = { x: 306, z: -83, y: 96 };

const SIGN_BEARING = (160 * Math.PI) / 180;
export const SIGN = {
  x: -62,
  z: -150,
  n: [Math.sin(SIGN_BEARING), -Math.cos(SIGN_BEARING)],
  yaw: Math.atan2(Math.sin(SIGN_BEARING), -Math.cos(SIGN_BEARING)),
};
SIGN.along = [Math.cos(SIGN.yaw), -Math.sin(SIGN.yaw)];
SIGN.cam = { x: SIGN.x + SIGN.n[0] * 96 - SIGN.along[0] * 8, z: SIGN.z + SIGN.n[1] * 96 - SIGN.along[1] * 8, dy: 20 };
export const CAPITOL_CAM = { x: -54, z: 72, y: 22 };

// East–west streets (Hollywood Blvd at z=20, Sunset Blvd at z=90)
export const EW = [
  { z: -15, w: 6 },
  { z: 20, w: 10, blvd: true },
  { z: 55, w: 6 },
  { z: 90, w: 10, blvd: true },
  { z: 125, w: 6 },
  { z: 160, w: 6 },
  { z: 195, w: 6 },
  { z: 230, w: 6 },
  { z: 265, w: 6 },
  { z: 300, w: 6 },
];

const NORTH_NS = new Set([-240, -120, -40, 0, 40, 80, 120, 160, 200, 240, 280, 320, 360, 400]);
export function nsExists(xl, z) {
  return z >= 15 || NORTH_NS.has(xl);
}

// US-101, Cahuenga Pass → Downtown
export const FWY = [[-150, -300], [-122, -150], [-106, -50], [-104, 0], [-70, 70], [40, 118], [160, 140], [360, 142]];
export const FWY_HALF = 7;
export const FWY_Y = 7;

export function distSeg(px, pz, ax, az, bx, bz) {
  const dx = bx - ax, dz = bz - az;
  const l2 = dx * dx + dz * dz;
  let t = l2 ? ((px - ax) * dx + (pz - az) * dz) / l2 : 0;
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  const ex = ax + dx * t - px, ez = az + dz * t - pz;
  return Math.sqrt(ex * ex + ez * ez);
}

export function distFwy(x, z) {
  let m = 1e9;
  for (let i = 0; i < FWY.length - 1; i++) {
    const d = distSeg(x, z, FWY[i][0], FWY[i][1], FWY[i + 1][0], FWY[i + 1][1]);
    if (d < m) m = d;
  }
  return m;
}

// Reserved footprints for landmarks
export const PLAZAS = [
  { x0: -200, z0: -40, x1: -160, z1: 12 }, // TCL Chinese Theatre
  { x0: -94, z0: -18, x1: -66, z1: 12 }, // Capitol Records
  { x0: 206, z0: 201, x1: 234, z1: 224 }, // US Bank Tower
  { x0: 206, z0: 236, x1: 234, z1: 259 }, // Wilshire Grand
  { x0: 286, z0: 201, x1: 314, z1: 224 }, // City Hall
  { x0: 246, z0: 166, x1: 274, z1: 189 }, // Walt Disney Concert Hall
  { x0: 246, z0: 236, x1: 274, z1: 259 }, // Aon Center
];

export function inPlaza(x, z, pad = 0) {
  for (const p of PLAZAS) if (x > p.x0 - pad && x < p.x1 + pad && z > p.z0 - pad && z < p.z1 + pad) return true;
  return false;
}

export function roadAt(x, z) {
  if (distFwy(x, z) < FWY_HALF + 1) return 'fwy';
  let best = null;
  for (const r of EW) {
    const d = Math.abs(z - r.z);
    if (d < r.w / 2) return r.blvd ? 'blvd' : 'st';
    if (d < r.w / 2 + 3) best = r.blvd ? 'bwalk' : 'walk';
  }
  const xl = Math.round(x / 40) * 40;
  const dx = Math.abs(x - xl);
  if (nsExists(xl, z)) {
    if (dx < 3) return 'st';
    if (dx < 6 && !best) best = 'walk';
  }
  return best;
}

export function district(x, z) {
  const dd = Math.hypot(x - L.dtla.x, z - L.dtla.z);
  if (dd < 100) return 'dtla';
  if (Math.hypot(x - L.century.x, z - L.century.z) < 38) return 'cc';
  if (z < 62 && x < 30 && x > -262) return 'hwd';
  if (distFwy(x, z) < 40 || dd < 150) return 'mid';
  return 'res';
}

export function groundColor(x, z) {
  const j = hash2(Math.floor(x * 0.5), Math.floor(z * 0.5), 3);
  if (inPlaza(x, z)) return j < 0.5 ? '#b4a998' : '#aca190';
  const r = roadAt(x, z);
  if (r === 'fwy') return '#57565a';
  if (r === 'blvd') return '#36363d';
  if (r === 'st') return '#3c3c42';
  if (r === 'bwalk') return '#a38c88';
  if (r === 'walk') return '#8e8983';
  const d = district(x, z);
  if (d === 'res') {
    const k = hash2(Math.floor(x / 7), Math.floor(z / 7), 5);
    return k < 0.55 ? '#62803f' : k < 0.8 ? '#748a4a' : '#8d8a5c';
  }
  if (d === 'dtla' || d === 'cc') return j < 0.5 ? '#6e6b68' : '#77736e';
  if (d === 'hwd') return j < 0.6 ? '#5c5a5c' : '#6a6560';
  return j < 0.5 ? '#6d6e5a' : '#5d6650';
}
