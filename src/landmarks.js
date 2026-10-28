import * as THREE from 'three';
import { VoxelModel } from './mesh.js';
import { hash3, rng } from './noise.js';
import { L, SIGN } from './layout.js';
import { SIGN_BASE } from './terrain.js';

const WARM = ['#ffcf86', '#ffd9a0', '#ffe6b8', '#fff2dc'];
const DARKW = '#10141c';

function group(model, mats, solidMat, opts) {
  const { solid, glow } = model.geometries(opts);
  const g = new THREE.Group();
  if (solid) {
    const m = new THREE.Mesh(solid, solidMat ?? mats.solid);
    m.castShadow = m.receiveShadow = true;
    g.add(m);
  }
  if (glow) g.add(new THREE.Mesh(glow, mats.glow));
  return g;
}

// ---------------- Griffith Observatory ----------------
function observatory() {
  const m = new VoxelModel();
  const W = '#efe9de', W2 = '#d9d1c3', DK = '#2a2830', DOME = '#3b3236', GREEN = '#6a9a88', PLAT = '#c4bcae', LAWN = '#56703e';
  m.box(-38, -14, -36, 38, -1, 24, '#b5ad9f');
  m.box(-38, 0, -36, 38, 0, 24, PLAT);
  for (let x = -38; x <= 38; x++) { m.set(x, 1, 24, W2); m.set(x, 1, -36, W2); }
  for (let z = -36; z <= 24; z++) { m.set(-38, 1, z, W2); m.set(38, 1, z, W2); }
  m.box(-20, 0, 11, 20, 0, 21, LAWN);
  // main hall
  m.box(-22, 1, -6, 22, 9, 6, W);
  m.box(-23, 10, -7, 23, 10, 7, W2);
  for (let x = -20; x <= 20; x += 3) {
    if (Math.abs(x) < 8) continue;
    for (let y = 3; y <= 7; y++) { m.set(x, y, 6, DK); m.set(x, y, -6, DK); }
  }
  for (const s of [-1, 1]) {
    m.box(s > 0 ? 23 : -31, 1, -5, s > 0 ? 31 : -23, 8, 5, W);
    m.cyl(s * 27, 0, 1, 14, 5, W);
    m.cyl(s * 27, 0, 15, 15, 6, W2);
    m.dome(s * 27, 16, 0, 5, DOME);
    for (let y = 4; y <= 11; y += 1) m.set(s * 27, y, 5, y % 4 === 0 ? W : DK);
  }
  // rotunda + green dome
  m.cyl(0, 3, 1, 13, 7, W);
  m.cyl(0, 3, 14, 14, 8, W2);
  m.dome(0, 15, 3, 6, GREEN);
  m.box(-2, 1, 10, 2, 7, 10, DK);
  // planetarium
  m.cyl(0, -16, 1, 12, 11, W);
  m.cyl(0, -16, 13, 13, 12, W2);
  m.dome(0, 14, -16, 11, DOME);
  // Astronomers Monument
  m.box(-1, 1, 16, 1, 3, 18, W2);
  m.box(0, 4, 17, 0, 15, 17, W);
  // terrace lights
  for (let x = -36; x <= 36; x += 6) m.set(x, 2, 24, '#ffe0a0', true);
  for (let z = -34; z <= 22; z += 7) { m.set(-38, 2, z, '#ffe0a0', true); m.set(38, 2, z, '#ffe0a0', true); }
  m.set(0, 1, 11, '#ffd890', true); m.set(-1, 1, 11, '#ffd890', true); m.set(1, 1, 11, '#ffd890', true);
  return m;
}

// ---------------- Hollywood Sign ----------------
const FONT = {
  H: ['X...X', 'X...X', 'X...X', 'XXXXX', 'X...X', 'X...X', 'X...X'],
  O: ['.XXX.', 'X...X', 'X...X', 'X...X', 'X...X', 'X...X', '.XXX.'],
  L: ['X....', 'X....', 'X....', 'X....', 'X....', 'X....', 'XXXXX'],
  Y: ['X...X', 'X...X', '.X.X.', '..X..', '..X..', '..X..', '..X..'],
  W: ['X...X', 'X...X', 'X...X', 'X.X.X', 'X.X.X', 'XX.XX', 'X...X'],
  D: ['XXXX.', 'X...X', 'X...X', 'X...X', 'X...X', 'X...X', 'XXXX.'],
};

function letter(ch) {
  const m = new VoxelModel();
  const rows = FONT[ch];
  for (let r = 0; r < 7; r++)
    for (let c = 0; c < 5; c++)
      if (rows[r][c] === 'X') m.set(c, 6 - r + 3, 0, r % 3 === 1 ? '#f2eee6' : '#fbf8f2');
  for (const c of [1, 3]) m.box(c, 0, -1, c, 9, -1, '#7d7a74');
  m.box(0, 5, -1, 4, 5, -1, '#6f6c66');
  return m;
}

// ---------------- Mt Lee antenna ----------------
function antenna() {
  const m = new VoxelModel();
  const G = '#8e8e90', Rd = '#b8483c';
  for (let y = 0; y < 36; y++) {
    const w = y < 12 ? 2 : y < 24 ? 1 : 0;
    const c = y > 26 && (y >> 1) % 2 ? Rd : G;
    if (w === 0) { m.set(0, y, 0, c); continue; }
    for (const [a, b] of [[-w, -w], [w, -w], [-w, w], [w, w]]) m.set(a, y, b, c);
    if (y % 4 === 0)
      for (let k = -w; k <= w; k++) { m.set(k, y, -w, c); m.set(k, y, w, c); m.set(-w, y, k, c); m.set(w, y, k, c); }
  }
  m.box(4, 0, -3, 9, 3, 2, '#d8d4cc');
  m.box(-9, 0, 1, -5, 2, 4, '#cfcac0');
  return m;
}

// ---------------- TCL Chinese Theatre ----------------
function chinese() {
  const m = new VoxelModel();
  const RED = '#a8342c', CU = '#3f7d66', CU2 = '#2f6453', BR = '#8a6a3a', BODY = '#cdb89c', DK = '#2a1c1c', CREAM = '#e6d8c0';
  m.box(-17, 0, -48, 17, 12, -18, BODY);
  m.box(-6, 0, -18, 6, 9, -18, DK);
  m.box(-8, 10, -18, 8, 12, -17, '#7a1c1c');
  for (const s of [-1, 1]) {
    m.box(s * 8 - 1, 0, -15, s * 8 + 1, 20, -13, RED);
    m.box(s * 8 - 1, 21, -15, s * 8 + 1, 21, -13, BR);
    m.box(s * 17 - 1, 0, -17, s * 17 + 1, 10, -12, RED);
    m.box(s * 17 - 1, 11, -17, s * 17 + 1, 12, -12, CU);
    m.box(s * 19, 0, -12, s * 19, 1, -1, CREAM);
  }
  const tier = (x, z0, z1, y, h) => {
    m.box(-x - 1, y, z0 - 1, x + 1, y, z1 + 1, CU2);
    m.box(-x + 1, y + 1, z0 + 1, x - 1, y + h, z1 - 1, CU);
    for (const [a, b] of [[-x - 1, z0 - 1], [x + 1, z0 - 1], [-x - 1, z1 + 1], [x + 1, z1 + 1]]) m.set(a, y + 1, b, CU);
  };
  tier(17, -40, -10, 13, 2);
  tier(12, -36, -14, 16, 2);
  tier(8, -32, -19, 19, 2);
  m.box(-3, 22, -28, 3, 23, -23, CU);
  m.box(-1, 24, -27, 1, 25, -24, BR);
  m.box(0, 26, -26, 0, 31, -26, BR);
  for (let x = -16; x <= 16; x += 2) m.set(x, 12, -10, '#ffd890', true);
  for (let x = -5; x <= 5; x++) m.set(x, 9, -17, '#ff5a4a', true);
  return m;
}

// ---------------- Capitol Records ----------------
function capitol() {
  const m = new VoxelModel();
  const W = '#e9e7e0', W2 = '#cfcbc2';
  m.box(-13, 0, -9, 13, 4, 9, W2);
  for (let x = -12; x <= 12; x += 2) {
    m.set(x, 2, 9, hash3(x, 2, 9) < 0.7 ? WARM[0] : DARKW, true);
    m.set(x, 2, -9, hash3(x, 2, -9) < 0.6 ? WARM[1] : DARKW, true);
  }
  m.cyl(0, 0, 5, 42, 5, W);
  for (let f = 0; f < 12; f++) {
    const y0 = 5 + f * 3;
    const glass = (x, y, z) => {
      const sec = Math.floor(((Math.atan2(z, x) + Math.PI) / (Math.PI * 2)) * 10);
      return hash3(f, sec, 3) < 0.62 ? WARM[(f + sec) % 4] : DARKW;
    };
    m.ring(0, 0, y0, 6, glass, true);
    m.ring(0, 0, y0 + 1, 6, glass, true);
    m.ring(0, 0, y0 + 2, 7, W);
    m.ring(0, 0, y0 + 2, 8, W);
    m.ring(0, 0, y0 + 2, 6, W);
  }
  m.cyl(0, 0, 41, 44, 4, W);
  m.cyl(0, 0, 45, 47, 2, W2);
  m.box(0, 48, 0, 0, 62, 0, '#d8d8d8');
  return m;
}

// ---------------- Downtown ----------------
function usbank() {
  const m = new VoxelModel();
  const S = '#9a948a', S2 = '#857f76';
  const H = 96;
  for (let y = 0; y < H; y++) {
    const r = y < 74 ? 10 : y < 88 ? 8.5 : 7;
    const R2 = (r + 0.5) ** 2, Ri = (r - 0.9) ** 2;
    for (let x = -11; x <= 11; x++)
      for (let z = -11; z <= 11; z++) {
        const d = x * x + z * z;
        if (d > R2) continue;
        if (d < Ri) { m.set(x, y, z, S2); continue; }
        const sec = Math.floor(((Math.atan2(z, x) + Math.PI) / (Math.PI * 2)) * 28);
        if (y % 3 === 0 || sec % 4 === 0) m.set(x, y, z, S);
        else m.set(x, y, z, hash3(Math.floor(y / 3), sec, 5) < 0.3 ? WARM[sec % 4] : DARKW, true);
      }
  }
  m.ring(0, 0, H, 7, '#dff0ff', true);
  for (let y = H; y < H + 7; y++) m.ring(0, 0, y, 6.5, '#e8f4ff', true);
  m.cyl(0, 0, H, H + 6, 5.5, S2);
  m.cyl(0, 0, H + 7, H + 7, 6, '#5a5a5e');
  return m;
}

function wilshire() {
  const m = new VoxelModel();
  const G = '#7e93a8', F = '#5d6c7c';
  for (let y = 0; y < 100; y++) {
    const zmax = y < 86 ? 7 : Math.max(1, Math.round(7 - (y - 86) * 0.5));
    const xmax = y < 86 ? 10 : 10 - Math.floor((y - 86) / 5);
    for (let x = -xmax; x <= xmax; x++)
      for (let z = -7; z <= zmax; z++) {
        const edge = Math.abs(x) === xmax || z === -7 || z === zmax;
        if (!edge) { m.set(x, y, z, F); continue; }
        if (y % 3 === 0 || (x + z) % 3 === 0) m.set(x, y, z, G);
        else m.set(x, y, z, hash3(Math.floor(y / 3), x * 7 + z, 9) < 0.32 ? WARM[(x + 8) % 4] : '#16202c', true);
      }
  }
  for (let x = -10; x <= 10; x++) { m.set(x, 85, 8, '#8fd8ff', true); m.set(x, 85, -8, '#8fd8ff', true); }
  m.box(0, 100, 0, 0, 120, 0, '#c8c8cc');
  return m;
}

function cityhall() {
  const m = new VoxelModel();
  const W = '#ece4d0', W2 = '#d8cfb8';
  m.box(-14, 0, -9, 14, 14, 9, W);
  m.box(-6, 15, -6, 6, 52, 6, W);
  for (let y = 17; y < 52; y += 2)
    for (let k = -4; k <= 4; k += 2) {
      const lit = (v) => (hash3(y, k, v) < 0.45 ? WARM[(y + k) & 3] : DARKW);
      m.set(k, y, 7, lit(1), true); m.set(k, y, -7, lit(2), true);
      m.set(7, y, k, lit(3), true); m.set(-7, y, k, lit(4), true);
    }
  m.box(-5, 53, -5, 5, 58, 5, W2);
  m.box(-4, 59, -4, 4, 62, 4, W);
  for (let k = 0; k <= 4; k++) m.box(-4 + k, 63 + k, -4 + k, 4 - k, 63 + k, 4 - k, '#d8cfb8');
  m.box(0, 68, 0, 0, 73, 0, '#c8c0a8');
  for (let x = -12; x <= 12; x += 3) for (let y = 3; y <= 11; y += 4) { m.set(x, y, 10, hash3(x, y, 1) < 0.5 ? WARM[1] : DARKW, true); }
  return m;
}

function disney() {
  const m = new VoxelModel();
  const R = rng(1003);
  const sails = [];
  for (let k = 0; k < 7; k++)
    sails.push({ cx: -8 + R() * 16, cz: -6 + R() * 12, rx: 5 + R() * 5, rz: 3.5 + R() * 3, h: 10 + R() * 12, lx: (R() - 0.5) * 0.7, lz: (R() - 0.5) * 0.5 });
  for (let y = 0; y < 24; y++)
    for (let x = -14; x <= 14; x++)
      for (let z = -11; z <= 11; z++) {
        for (const s of sails) {
          if (y > s.h) continue;
          const f = 1 - (y / s.h) ** 2 * 0.65;
          const dx = (x - s.cx - s.lx * y) / (s.rx * f), dz = (z - s.cz - s.lz * y) / (s.rz * f);
          if (dx * dx + dz * dz <= 1) {
            m.set(x, y, z, (y + Math.floor(x / 3)) % 3 === 0 ? '#b8bcc4' : '#d2d6dc');
            break;
          }
        }
      }
  for (let x = -10; x <= 10; x += 2) m.set(x, 1, 12, '#ffe0b0', true);
  return m;
}

export function buildLandmarks(T, mats) {
  const root = new THREE.Group();
  const blinkers = [];

  const obs = group(observatory(), mats, mats.flood, { scale: 0.65 });
  obs.position.set(L.obs.x, L.obs.y, L.obs.z);
  obs.rotation.y = Math.PI / 3;
  root.add(obs);

  // Hollywood Sign
  const geos = {};
  const letters = [];
  const word = 'HOLLYWOOD';
  const sc = 1.4, spacing = 8.4;
  let signY = 0;
  for (let i = 0; i < word.length; i++) {
    const ch = word[i];
    if (!geos[ch]) geos[ch] = letter(ch).geometries({ scale: sc, ox: -2.5, jitter: 0.03 }).solid;
    const a = (i - 4) * spacing;
    const x = SIGN.x + SIGN.along[0] * a, z = SIGN.z + SIGN.along[1] * a;
    const y = SIGN_BASE.y - 1.4 + (hash3(i, 3, 1) - 0.5) * 0.8;
    signY += y / word.length;
    const mesh = new THREE.Mesh(geos[ch], mats.sign);
    mesh.position.set(x, y + (i === 1 ? 0.6 : 0), z);
    mesh.rotation.set(0, SIGN.yaw + (hash3(i, 1, 1) - 0.5) * 0.08, (hash3(i, 2, 1) - 0.5) * 0.06);
    mesh.castShadow = true;
    root.add(mesh);
    letters.push([x, z]);
  }

  const ant = group(antenna(), mats);
  const ay = T.groundY(L.lee.x, L.lee.z);
  ant.position.set(L.lee.x, ay, L.lee.z);
  root.add(ant);
  blinkers.push({ pos: [L.lee.x + 0.5, ay + 36.5, L.lee.z + 0.5], kind: 'red' });

  const ch = group(chinese(), mats, mats.flood);
  ch.position.set(L.chinese.x, 0, L.chinese.z);
  root.add(ch);

  const cap = group(capitol(), mats, mats.flood);
  cap.position.set(L.capitol.x, 0, L.capitol.z);
  root.add(cap);
  const capTop = [L.capitol.x + 0.5, 63.5, L.capitol.z + 0.5];

  const usb = group(usbank(), mats);
  usb.position.set(L.usbank.x, 0, L.usbank.z);
  root.add(usb);
  blinkers.push({ pos: [L.usbank.x + 0.5, 104.5, L.usbank.z + 0.5], kind: 'red' });

  const wg = group(wilshire(), mats);
  wg.position.set(L.wilshire.x, 0, L.wilshire.z);
  root.add(wg);
  blinkers.push({ pos: [L.wilshire.x + 0.5, 121, L.wilshire.z + 0.5], kind: 'red' });

  const chall = group(cityhall(), mats, mats.flood);
  chall.position.set(L.cityhall.x, 0, L.cityhall.z);
  root.add(chall);

  const dh = group(disney(), mats, mats.flood);
  dh.position.set(L.disney.x, 0, L.disney.z);
  dh.rotation.y = 0.3;
  root.add(dh);

  return {
    root, blinkers, capTop, letters,
    sign: { x: SIGN.x, y: signY, z: SIGN.z },
    searchlights: [[-188, 0.6, 4], [-172, 0.6, 4], [-180, 0.6, 1]],
  };
}
