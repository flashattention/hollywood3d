import * as THREE from 'three';
import { VoxelModel, MeshBuilder } from './mesh.js';
import { rng, fbm, hash2 } from './noise.js';
import { WORLD, L, SIGN, HERO, distFwy } from './layout.js';

function oak(seed, r = 2.4, trunk = 2, greens = ['#3d5a2c', '#4a6a33', '#557a3a', '#36502a']) {
  const R = rng(seed);
  const m = new VoxelModel();
  m.box(0, 0, 0, 0, trunk, 0, '#4a3828');
  const cy = trunk + 2, n = Math.ceil(r);
  for (let x = -n; x <= n; x++)
    for (let y = -2; y <= 2; y++)
      for (let z = -n; z <= n; z++) {
        const d = (x * x + z * z) / (r * r) + (y * y) / (1.8 * 1.8);
        if (d < 1 && R() > 0.08) m.set(x, cy + y, z, greens[Math.floor(R() * greens.length)]);
      }
  const b = new MeshBuilder();
  m.build(b, b, { ox: -0.5, oz: -0.5, jitter: 0.12, seed });
  return b.geometry();
}

function cypress(seed) {
  const R = rng(seed);
  const m = new VoxelModel();
  for (let y = 0; y < 11; y++) {
    const full = y > 0 && y < 8;
    for (let x = -1; x <= 1; x++)
      for (let z = -1; z <= 1; z++) {
        if (!full && (x || z)) continue;
        if (full && x && z) continue;
        m.set(x, y, z, R() < 0.5 ? '#2f4428' : '#36502c');
      }
  }
  const b = new MeshBuilder();
  m.build(b, b, { ox: -0.5, oz: -0.5, jitter: 0.1, seed });
  return b.geometry();
}

function palm(H, lean, seed) {
  const R = rng(seed);
  const b = new MeshBuilder();
  const off = (y) => Math.round(lean * Math.pow(y / H, 2) * 3);
  for (let y = 0; y < H; y += 2) {
    const o = off(y);
    b.box(o - 0.4, y, -0.4, o + 0.4, Math.min(H, y + 2), 0.4, (y / 2) % 2 ? '#7c6852' : '#6c5a46');
  }
  const m = new VoxelModel();
  const G = ['#4f6b35', '#5d7a3c', '#46602f', '#6a8442'];
  for (let x = -2; x <= 2; x++)
    for (let y = -1; y <= 1; y++)
      for (let z = -2; z <= 2; z++) {
        const d = x * x + z * z + (y * 1.6) ** 2;
        if (d <= 5.2 && R() > 0.15) m.set(x, y, z, G[Math.floor(R() * G.length)]);
      }
  for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1]]) {
    const L = dx && dz ? 2 : 3;
    for (let i = 2; i <= L + 1; i++) m.set(dx * i, -Math.floor((i - 1) / 1.5), dz * i, G[Math.floor(R() * G.length)]);
  }
  for (let x = -1; x <= 1; x++)
    for (let z = -1; z <= 1; z++) {
      m.set(x, -2, z, '#8a7352');
      if (!x || !z) m.set(x, -3, z, '#7a6446');
    }
  m.build(b, b, { ox: off(H) - 0.5, oy: H, oz: -0.5, jitter: 0.12, seed });
  return b.geometry();
}

export function treeGeometries() {
  return {
    oak: oak(11, 2.4, 2),
    ficus: oak(12, 2.9, 2, ['#3f6a34', '#4a7a3a', '#557f40', '#3a5e2e']),
    shrub: oak(13, 1.8, 1, ['#3a4a2a', '#45532f', '#4f5a34', '#334128']),
    cypress: cypress(14),
    palm: [palm(18, 0.5, 21), palm(24, 1, 22), palm(30, -1, 23)],
  };
}

const dummy = new THREE.Object3D();
const tint = new THREE.Color();

export function instanced(geo, list, mat, seed, { rot90 = true, smin = 0.85, smax = 1.2 } = {}) {
  if (!list.length) return null;
  const R = rng(seed);
  const im = new THREE.InstancedMesh(geo, mat, list.length);
  list.forEach((t, i) => {
    dummy.position.set(t.x, t.y, t.z);
    dummy.rotation.set(0, rot90 ? Math.floor(R() * 4) * (Math.PI / 2) : R() * Math.PI * 2, 0);
    dummy.scale.setScalar(t.s ?? smin + R() * (smax - smin));
    dummy.updateMatrix();
    im.setMatrixAt(i, dummy.matrix);
    const v = 0.82 + R() * 0.3;
    tint.setRGB(v * (0.95 + R() * 0.1), v, v * (0.9 + R() * 0.1));
    im.setColorAt(i, tint);
  });
  im.castShadow = true;
  im.receiveShadow = true;
  im.frustumCulled = false;
  return im;
}

// Chaparral + oaks across the hills
export function hillTrees(T, letters) {
  const R = rng(4242);
  const out = { oak: [], shrub: [], cypress: [] };
  for (let a = 0; a < 26000; a++) {
    const x = WORLD.x0 + R() * (WORLD.x1 - WORLD.x0);
    const z = WORLD.z0 + R() * (40 - WORLD.z0);
    const h = T.hAt(x, z);
    if (h < 1) continue;
    const dens = fbm(x * 0.022, z * 0.022, 3, 3);
    if (dens < 0.5 && R() > 0.12) continue;
    if (Math.hypot(x - L.obs.x, z - L.obs.z) < 46) continue;
    if (distFwy(x, z) < 11) continue;
    if (Math.hypot(x - HERO.x, z - HERO.z) < 34 || Math.hypot(x - SIGN.cam.x, z - SIGN.cam.z) < 34) continue;
    if (letters.some((p) => Math.hypot(x - p[0], z - p[1]) < 9)) continue;
    if (T.obst && T.obst[Math.floor((z - T.z0) / T.S) * T.NX + Math.floor((x - T.x0) / T.S)] > 0) continue;
    const y = h * T.S;
    const r = R();
    if (r < 0.04 && Math.hypot(x - L.obs.x, z - L.obs.z) < 110) out.cypress.push({ x, y, z });
    else if (r < 0.55) out.shrub.push({ x, y, z });
    else out.oak.push({ x, y, z });
  }
  return out;
}
