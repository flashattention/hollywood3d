import * as THREE from 'three';
import { fbm, ridged, vnoise, clamp, lerp, smoothstep, hash2 } from './noise.js';
import { WORLD, L, SIGN, HERO, CAPITOL_CAM, distFwy, inPlaza, groundColor } from './layout.js';
import { MeshBuilder, lin } from './mesh.js';

const S = 2; // cell size == step height
const gauss = (x, z, cx, cz, s) => Math.exp(-((x - cx) ** 2 + (z - cz) ** 2) / (2 * s * s));

export function rawHeight(x, z) {
  const foot = -30 + 14 * Math.sin(x * 0.011 + 0.6) + 16 * (fbm(x * 0.007, 3.7, 3, 11) - 0.5);
  const t = clamp((foot - z) / 110, 0, 1);
  const st = t * t * (3 - 2 * t);
  let h = st * 58 + st * 40 * ridged(x * 0.011, z * 0.011, 4, 5) + st * 12 * (fbm(x * 0.035, z * 0.035, 3, 9) - 0.5);
  h += 48 * gauss(x, z, L.lee.x, L.lee.z, 40);
  h += 40 * gauss(x, z, -116, -192, 32);
  h += 26 * gauss(x, z, 112, -150, 40);
  h += 30 * gauss(x, z, L.obs.x, L.obs.z - 10, 28) * clamp(t * 4, 0, 1);
  return h * (1 - 0.5 * smoothstep(150, 300, x));
}

// Sightlines that must stay clear (hero shots look over the hills)
const SIGHTS = [];
export const SIGN_BASE = { y: 0 };
function initSights() {
  const signY = Math.round(rawHeight(SIGN.x, SIGN.z) / S) * S;
  SIGN_BASE.y = signY;
  SIGHTS.push({ ax: HERO.x, az: HERO.z, ay: HERO.y, bx: L.obs.x, bz: L.obs.z, by: L.obs.y + 8, tMax: 0.66 });
  SIGHTS.push({ ax: HERO.x, az: HERO.z, ay: HERO.y, bx: SIGN.x, bz: SIGN.z, by: signY + 6, tMax: 0.9 });
  SIGHTS.push({ ax: SIGN.cam.x, az: SIGN.cam.z, ay: signY + SIGN.cam.dy - 2, bx: SIGN.x, bz: SIGN.z, by: signY + 4, tMax: 0.8 });
  SIGHTS.push({ ax: CAPITOL_CAM.x, az: CAPITOL_CAM.z, ay: CAPITOL_CAM.y, bx: SIGN.x, bz: SIGN.z, by: signY + 8, tMax: 0.9 });
}

function sightCap(s, x, z) {
  const dx = s.bx - s.ax, dz = s.bz - s.az;
  const l2 = dx * dx + dz * dz;
  const t = ((x - s.ax) * dx + (z - s.az) * dz) / l2;
  if (t < -0.05 || t > s.tMax) return 1e9;
  const tc = clamp(t, 0, 1);
  const d = Math.hypot(s.ax + dx * tc - x, s.az + dz * tc - z);
  return lerp(s.ay, s.by, tc) - 5 + Math.max(0, d - 8) * 1.0;
}

export function heightAt(x, z) {
  let h = rawHeight(x, z);
  const df = distFwy(x, z);
  if (df < 40) h = Math.min(h, Math.max(0, df - 10) * 1.1);
  for (const s of SIGHTS) h = Math.min(h, sightCap(s, x, z));
  const dh = Math.hypot(x - HERO.x, z - HERO.z);
  if (dh < 340) h = Math.min(h, HERO.y - 44 + Math.max(0, dh - 60) * 0.22);
  const dob = Math.hypot(x - L.obs.x, z - L.obs.z);
  if (dob < 54) h = lerp(h, L.obs.y, smoothstep(54, 38, dob));
  // level ledge for the Sign along the hillside
  const rx = x - SIGN.x, rz = z - SIGN.z;
  const a = rx * SIGN.along[0] + rz * SIGN.along[1];
  const n = rx * SIGN.n[0] + rz * SIGN.n[1];
  if (Math.abs(a) < 52 && n > -18 && n < 16) {
    const m = smoothstep(52, 40, Math.abs(a)) * (n < 0 ? smoothstep(-18, -6, n) : smoothstep(16, 5, n));
    h = lerp(h, SIGN_BASE.y, m);
  }
  if (inPlaza(x, z, 8)) h = 0;
  return Math.max(0, h);
}

export function buildTerrain() {
  initSights();
  const NX = (WORLD.x1 - WORLD.x0) / S, NZ = (WORLD.z1 - WORLD.z0) / S;
  const H = new Int16Array(NX * NZ);
  for (let iz = 0; iz < NZ; iz++)
    for (let ix = 0; ix < NX; ix++) {
      const x = WORLD.x0 + ix * S + 1, z = WORLD.z0 + iz * S + 1;
      H[iz * NX + ix] = Math.max(0, Math.round(heightAt(x, z) / S));
    }
  const T = {
    NX, NZ, S, H, x0: WORLD.x0, z0: WORLD.z0,
    obst: null,
    hAt(x, z) {
      const ix = Math.floor((x - WORLD.x0) / S), iz = Math.floor((z - WORLD.z0) / S);
      if (ix < 0 || iz < 0 || ix >= NX || iz >= NZ) return 0;
      return H[iz * NX + ix];
    },
    groundY(x, z) { return this.hAt(x, z) * S; },
    // max of terrain / buildings over a 3x3 cell neighbourhood (camera collision)
    obstacleY(x, z) {
      const ix = Math.floor((x - WORLD.x0) / S), iz = Math.floor((z - WORLD.z0) / S);
      let m = 0;
      for (let k = -1; k <= 1; k++)
        for (let i = -1; i <= 1; i++) {
          const a = ix + i, b = iz + k;
          if (a < 0 || b < 0 || a >= NX || b >= NZ) continue;
          const idx = b * NX + a;
          m = Math.max(m, H[idx] * S, this.obst ? this.obst[idx] : 0);
        }
      return m;
    },
  };
  return T;
}

const HILL = {
  green: '#3d4a2c', chap: '#56573a', olive: '#4a4e33', dry: '#8c7b56', tan: '#a08a62',
  trail: '#b39c78', rock: '#6f5d4b', side: '#5b4b3b', sideDark: '#43372d',
};

function hillColor(x, z, h, slope, j) {
  if (Math.abs(vnoise(x * 0.018, z * 0.018, 77) - 0.5) < 0.012 && slope < 2) return HILL.trail;
  if (slope >= 3) return j < 0.5 ? HILL.rock : HILL.side;
  const n = fbm(x * 0.045, z * 0.045, 3, 5);
  const dry = smoothstep(30, 80, h * S) * 0.25;
  if (n + dry > 0.66) return HILL.tan;
  if (n + dry > 0.57) return HILL.dry;
  if (n < 0.4) return HILL.green;
  return n < 0.48 ? HILL.olive : HILL.chap;
}

export function terrainMesh(T, mat) {
  const b = new MeshBuilder();
  const { NX, NZ, H } = T;
  const get = (ix, iz) => (ix < 0 || iz < 0 || ix >= NX || iz >= NZ ? 0 : H[iz * NX + ix]);
  const dirs = [[1, 0, 0], [-1, 0, 1], [0, 1, 4], [0, -1, 5]];
  for (let iz = 0; iz < NZ; iz++)
    for (let ix = 0; ix < NX; ix++) {
      const h = H[iz * NX + ix];
      const x0 = T.x0 + ix * S, z0 = T.z0 + iz * S, y = h * S;
      const cx = x0 + 1, cz = z0 + 1;
      const j = hash2(ix, iz, 21);
      const k = 0.93 + j * 0.14;
      let slope = 0;
      for (const [dx, dz] of dirs) slope = Math.max(slope, Math.abs(get(ix + dx, iz + dz) - h));
      const hex = h === 0 ? groundColor(cx, cz) : hillColor(cx, cz, h, slope, j);
      const c = lin(hex);
      b.face(2, x0, y, z0, x0 + S, y, z0 + S, [c[0] * k, c[1] * k, c[2] * k]);
      for (const [dx, dz, fi] of dirs) {
        const nh = get(ix + dx, iz + dz);
        if (nh >= h) continue;
        const sc = lin(h - nh > 2 ? HILL.sideDark : HILL.side);
        const s = 0.9 + j * 0.15;
        const top = [sc[0] * s, sc[1] * s, sc[2] * s];
        const bot = [top[0] * 0.6, top[1] * 0.6, top[2] * 0.6];
        b.face(fi, x0, nh * S, z0, x0 + S, y, z0 + S, bot, top);
      }
    }
  const mesh = new THREE.Mesh(b.geometry(), mat);
  mesh.receiveShadow = true;
  mesh.castShadow = true;
  return mesh;
}
