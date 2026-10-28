import { MeshBuilder, lin } from './mesh.js';
import { rng } from './noise.js';
import {
  WORLD, EW, L, SIGN, inPlaza, distFwy, district, nsExists, FWY, FWY_HALF, FWY_Y,
} from './layout.js';

const LIT = ['#ffcf86', '#ffd9a0', '#ffe6b8', '#fff2dc', '#ffe0a8', '#ffc47a', '#d6e6ff', '#c2dcff'].map(lin);
const DARK = lin('#10141c');
const NEON = ['#ff3d7f', '#38e1ff', '#ff8a2a', '#ff3b30', '#b25cff', '#5dff9a', '#ffd23a'].map(lin);
const STUCCO = ['#d9c8ae', '#cdb79c', '#e4d8c4', '#bfa48a', '#a9b1b6', '#d6b9a0', '#9f8d7f', '#e8dcc6', '#c7a68e', '#b9c2b0'];
const HOUSE = ['#efe4d2', '#e2cfb4', '#d4b996', '#f4ece0', '#c8d0cf', '#e6d2c0', '#d8c0a8', '#bcc6b8'];
const ROOF = ['#a6573c', '#9a4e36', '#b4664a', '#6c6660', '#7a726a'];
const GLASS = ['#6b7a8c', '#8796a3', '#55626f', '#9b958b', '#7b8697', '#b1a998', '#5e6b7a', '#a0a8b0'];
const SODIUM = lin('#ffb060');
const WHITE_LAMP = lin('#ffe6bf');

export function buildCity(T) {
  const R = rng(1977);
  const pick = (a) => a[Math.floor(R() * a.length)];
  const solid = new MeshBuilder();
  const glow = new MeshBuilder();
  const trees = { oak: [], ficus: [], cypress: [], shrub: [], palm: [[], [], []] };
  const aviation = [];
  const obst = new Float32Array(T.NX * T.NZ);

  function mark(x0, z0, x1, z1, h) {
    const i0 = Math.max(0, Math.floor((x0 - T.x0) / T.S)), i1 = Math.min(T.NX - 1, Math.floor((x1 - T.x0) / T.S));
    const k0 = Math.max(0, Math.floor((z0 - T.z0) / T.S)), k1 = Math.min(T.NZ - 1, Math.floor((z1 - T.z0) / T.S));
    for (let k = k0; k <= k1; k++)
      for (let i = i0; i <= i1; i++) obst[k * T.NX + i] = Math.max(obst[k * T.NX + i], h);
  }

  const flat = (x0, z0, x1, z1) =>
    T.hAt(x0, z0) === 0 && T.hAt(x1, z0) === 0 && T.hAt(x0, z1) === 0 && T.hAt(x1, z1) === 0 &&
    T.hAt((x0 + x1) / 2, (z0 + z1) / 2) === 0;

  const clear = (x0, z0, x1, z1) => {
    const pts = [[x0, z0], [x1, z0], [x0, z1], [x1, z1], [(x0 + x1) / 2, (z0 + z1) / 2],
      [(x0 + x1) / 2, z0], [(x0 + x1) / 2, z1], [x0, (z0 + z1) / 2], [x1, (z0 + z1) / 2]];
    for (const [x, z] of pts) if (distFwy(x, z) < FWY_HALF + 3 || inPlaza(x, z, 1.5)) return false;
    return true;
  };

  function windows(x0, z0, x1, z1, y0, y1, o = {}) {
    const fl = o.floor ?? 3, sp = o.sp ?? 2.6, ww = o.ww ?? 1.2, wh = o.wh ?? 1.5, p = o.lit ?? 0.5;
    const warm = R() < 0.75;
    for (let y = y0 + 1; y + wh <= y1 - 0.4; y += fl) {
      const floorLit = R() < 0.18 ? (R() < 0.5 ? 0 : 1) : -1;
      for (const fi of [0, 1, 4, 5]) {
        const a0 = fi < 2 ? z0 : x0, a1 = fi < 2 ? z1 : x1, ln = a1 - a0;
        const n = Math.floor((ln - 0.6) / sp);
        if (n < 1) continue;
        const st = a0 + (ln - n * sp) / 2 + (sp - ww) / 2;
        for (let k = 0; k < n; k++) {
          const lit = floorLit >= 0 ? floorLit === 1 && R() < 0.85 : R() < p;
          const c = lit ? (warm ? LIT[Math.floor(R() * 6)] : pick(LIT)) : DARK;
          const a = st + k * sp, b = a + ww;
          if (fi === 0) glow.face(0, x1, y, a, x1 + 0.06, y + wh, b, c);
          else if (fi === 1) glow.face(1, x0 - 0.06, y, a, x0, y + wh, b, c);
          else if (fi === 4) glow.face(4, a, y, z1, b, y + wh, z1 + 0.06, c);
          else glow.face(5, a, y, z0 - 0.06, b, y + wh, z0, c);
        }
      }
    }
  }

  function commercial(x0, z0, x1, z1, h, o = {}) {
    const col = o.col ?? pick(STUCCO);
    solid.box(x0, 0, z0, x1, h, z1, col);
    windows(x0, z0, x1, z1, 0, h, { lit: o.lit ?? 0.5 });
    solid.box(x0 + 0.35, h, z0 + 0.35, x1 - 0.35, h + 0.25, z1 - 0.35, '#55524f');
    let top = h + 0.25;
    const w = x1 - x0, d = z1 - z0;
    if (h > 12 && R() < 0.3 && w > 8 && d > 8) {
      const t = 3 + Math.floor(R() * 3) * 2;
      solid.box(x0 + 2, h, z0 + 2, x1 - 2, h + t, z1 - 2, col);
      windows(x0 + 2, z0 + 2, x1 - 2, z1 - 2, h, h + t, { lit: 0.5 });
      top = h + t;
    } else if (w > 4 && d > 4 && R() < 0.55) {
      const ax = x0 + 1 + R() * (w - 3), az = z0 + 1 + R() * (d - 3);
      solid.box(ax, h, az, ax + 1.6, h + 1.1, az + 1.2, '#9a9690');
    }
    if (o.tank && w > 5 && d > 5 && R() < 0.2) {
      const tx = x0 + 1.5 + R() * (w - 4), tz = z0 + 1.5 + R() * (d - 4);
      solid.box(tx + 0.2, h, tz + 0.2, tx + 0.5, h + 1.5, tz + 0.5, '#3a3230');
      solid.box(tx + 1.5, h, tz + 1.5, tx + 1.8, h + 1.5, tz + 1.8, '#3a3230');
      solid.box(tx, h + 1.5, tz, tx + 2, h + 4, tz + 2, '#7b5a3e');
      solid.box(tx + 0.3, h + 4, tz + 0.3, tx + 1.7, h + 4.6, tz + 1.7, '#5d4430');
      top = Math.max(top, h + 4.6);
    }
    if (o.billboard && w > 7 && R() < 0.12) {
      const bx = x0 + 1, bz = (z0 + z1) / 2;
      solid.box(bx + 1, h, bz, bx + 1.3, h + 2, bz + 0.3, '#2c2a2a');
      solid.box(bx + 5, h, bz, bx + 5.3, h + 2, bz + 0.3, '#2c2a2a');
      const cols = [pick(['#e8d24a', '#e86a4a', '#3a8ad8', '#f0e8d8', '#d84a7a']), pick(['#20202a', '#f4efe6', '#c83a2a'])];
      solid.box(bx, h + 2, bz + 0.3, bx + 6.3, h + 3.4, bz + 0.6, cols[0], { shade: false });
      solid.box(bx, h + 3.4, bz + 0.3, bx + 6.3, h + 4.6, bz + 0.6, cols[1], { shade: false });
      for (let k = 0; k < 3; k++) glow.box(bx + 0.8 + k * 2.2, h + 4.6, bz + 0.7, bx + 1.3 + k * 2.2, h + 4.9, bz + 1.1, WHITE_LAMP, { shade: false, ao: 1 });
      top = Math.max(top, h + 4.6);
    }
    mark(x0, z0, x1, z1, top);
    return top;
  }

  function neon(x, z, h, dirZ) {
    const c = pick(NEON);
    const y0 = Math.max(3.5, h * 0.3), y1 = Math.min(h - 0.5, y0 + 8);
    if (y1 - y0 < 3) return;
    const za = dirZ > 0 ? z : z - 1.8, zb = dirZ > 0 ? z + 1.8 : z;
    glow.box(x - 0.3, y0, za, x + 0.3, y1, zb, c, { shade: false, ao: 1, bottom: true });
  }

  function storefront(x0, z0, x1, z1, fi) {
    const c = pick(LIT);
    const aw = pick(['#7a2a2a', '#2a4a3a', '#3a3a5a', '#8a5a2a']);
    if (fi === 4) {
      glow.face(4, x0 + 0.6, 0.4, z1, x1 - 0.6, 2.5, z1 + 0.07, c);
      solid.box(x0 + 0.4, 2.7, z1, x1 - 0.4, 3.0, z1 + 1.2, aw);
    } else {
      glow.face(5, x0 + 0.6, 0.4, z0 - 0.07, x1 - 0.6, 2.5, z0, c);
      solid.box(x0 + 0.4, 2.7, z0 - 1.2, x1 - 0.4, 3.0, z0, aw);
    }
  }

  function house(x0, z0, x1, z1) {
    const fl = R() < 0.6 ? 1 : 2;
    const h = fl * 3.2;
    solid.box(x0, 0, z0, x1, h, z1, pick(HOUSE));
    windows(x0, z0, x1, z1, 0, h, { floor: 3.2, sp: 3.4, ww: 1.3, wh: 1.3, lit: 0.55 });
    if (R() < 0.65) {
      const rc = pick(ROOF);
      const alongX = x1 - x0 >= z1 - z0;
      solid.box(x0 - 0.4, h, z0 - 0.4, x1 + 0.4, h + 0.6, z1 + 0.4, rc);
      const w = alongX ? z1 - z0 : x1 - x0;
      const steps = Math.max(1, Math.floor(w / 3));
      for (let s = 1; s <= steps; s++) {
        const ins = (s * (w / 2)) / (steps + 1);
        if (alongX) solid.box(x0 - 0.2, h + 0.6 * s, z0 + ins, x1 + 0.2, h + 0.6 * (s + 1), z1 - ins, rc);
        else solid.box(x0 + ins, h + 0.6 * s, z0 - 0.2, x1 - ins, h + 0.6 * (s + 1), z1 + 0.2, rc);
      }
      mark(x0, z0, x1, z1, h + 0.6 * (steps + 1));
    } else {
      solid.box(x0 + 0.2, h, z0 + 0.2, x1 - 0.2, h + 0.3, z1 - 0.2, '#8c867c');
      mark(x0, z0, x1, z1, h + 0.3);
    }
  }

  function addTree(x, z, kind) {
    const t = { x, y: 0, z };
    if (kind === 'palm') trees.palm[Math.floor(R() * 3)].push(t);
    else trees[kind].push(t);
  }

  function resLot(x0, z0, x1, z1) {
    const w = x1 - x0, d = z1 - z0;
    if (R() < 0.18 && w > 9 && d > 9) {
      commercial(x0 + 1, z0 + 1, x1 - 1, z1 - 1, 6 + Math.floor(R() * 2) * 3, { col: pick(HOUSE), lit: 0.55 });
      if (R() < 0.5) addTree(x0 + 0.8, z1 - 0.5, R() < 0.4 ? 'palm' : 'ficus');
      return;
    }
    const hw = Math.min(w - 3, 6 + R() * 4), hd = Math.min(d - 3, 6 + R() * 3);
    if (hw < 4 || hd < 4) { addTree((x0 + x1) / 2, (z0 + z1) / 2, 'oak'); return; }
    const hx = x0 + 1 + R() * (w - hw - 2), hz = z0 + 1 + R() * (d - hd - 2);
    house(hx, hz, hx + hw, hz + hd);
    const inHouse = (x, z, pad) => x > hx - pad && x < hx + hw + pad && z > hz - pad && z < hz + hd + pad;
    if (R() < 0.38) {
      const pw = 3 + R() * 2, pd = 2 + R() * 1.5;
      for (let k = 0; k < 8; k++) {
        const px = x0 + 0.6 + R() * (w - pw - 1.2), pz = z0 + 0.6 + R() * (d - pd - 1.2);
        if (inHouse(px, pz, 0.6) || inHouse(px + pw, pz + pd, 0.6) || inHouse(px + pw, pz, 0.6) || inHouse(px, pz + pd, 0.6)) continue;
        solid.face(2, px - 0.4, 0.05, pz - 0.4, px + pw + 0.4, 0.05, pz + pd + 0.4, '#d6cfc0');
        solid.face(2, px, 0.08, pz, px + pw, 0.08, pz + pd, '#38c0d4');
        break;
      }
    }
    const nt = 1 + Math.floor(R() * 2.5);
    for (let k = 0; k < nt * 3 && k < 9; k++) {
      const tx = x0 + 0.8 + R() * (w - 1.6), tz = z0 + 0.8 + R() * (d - 1.6);
      if (inHouse(tx, tz, 1.5)) continue;
      const r = R();
      addTree(tx, tz, r < 0.16 ? 'palm' : r < 0.22 ? 'cypress' : r < 0.6 ? 'ficus' : 'oak');
      if (k >= nt) break;
    }
  }

  function tower(x0, z0, x1, z1, h, o = {}) {
    const col = o.col ?? pick(GLASS);
    const tiers = h > 55 ? 3 : h > 30 ? 2 : 1;
    let cx0 = x0, cz0 = z0, cx1 = x1, cz1 = z1, y = 0;
    for (let t = 0; t < tiers; t++) {
      const top = t === tiers - 1 ? h : Math.round(y + (h - y) * (t === 0 ? 0.62 : 0.6));
      solid.box(cx0, y, cz0, cx1, top, cz1, col);
      windows(cx0, cz0, cx1, cz1, y, top, { floor: 3, sp: 2.2, ww: 1.5, wh: 1.9, lit: o.lit ?? 0.45 });
      y = top;
      if (t < tiers - 1) {
        const ins = Math.min(2.5, (cx1 - cx0) / 6, (cz1 - cz0) / 6);
        cx0 += ins; cz0 += ins; cx1 -= ins; cz1 -= ins;
      }
    }
    solid.box(cx0 + 0.4, h, cz0 + 0.4, cx1 - 0.4, h + 0.4, cz1 - 0.4, '#4e4e52');
    if (h > 45 && R() < 0.6) solid.face(2, cx0 + 1.5, h + 0.45, cz0 + 1.5, cx1 - 1.5, h + 0.45, cz1 - 1.5, '#a8443a');
    if (h > 40 && R() < 0.5) {
      const c = lin(pick(['#ffffff', '#9fd8ff', '#ffd29a', '#c9a0ff', '#ffffff']));
      glow.box(cx0 - 0.05, h - 1.4, cz0 - 0.05, cx1 + 0.05, h - 0.6, cz1 + 0.05, c, { shade: false, ao: 1 });
    }
    if (h > 50) aviation.push([(cx0 + cx1) / 2, h + 0.9, (cz0 + cz1) / 2]);
    mark(x0, z0, x1, z1, h + 0.5);
  }

  // ---------- blocks ----------
  const zLines = [-50, ...EW.map((r) => r.z), 330];
  const halfW = (z) => (EW.find((r) => r.z === z)?.w ?? 0) / 2;

  function lot(x0, z0, x1, z1, d) {
    if (x1 - x0 < 3.5 || z1 - z0 < 3.5) return;
    if (!flat(x0, z0, x1, z1) || !clear(x0, z0, x1, z1)) return;
    const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
    if (d === 'res') return resLot(x0, z0, x1, z1);
    if (d === 'hwd') {
      const north = z1 > 8 && z1 <= 12.5, south = z0 >= 27.5 && z0 < 32;
      const onBlvd = north || south;
      let h = 5 + Math.floor(R() * 4) * 3 + (onBlvd ? Math.floor(R() * 4) * 3 : 0);
      if (R() < 0.12) h += 12;
      const i = 0.3;
      commercial(x0 + i, z0 + i, x1 - i, z1 - i, h, { tank: true, billboard: true, lit: 0.55 });
      if (north) {
        storefront(x0 + i, z0 + i, x1 - i, z1 - i, 4);
        if (h > 8 && R() < 0.65) neon(x0 + 1.5 + R() * (x1 - x0 - 3), z1 - i, h, 1);
      } else if (south) {
        storefront(x0 + i, z0 + i, x1 - i, z1 - i, 5);
        if (h > 8 && R() < 0.65) neon(x0 + 1.5 + R() * (x1 - x0 - 3), z0 + i, h, -1);
      }
      if (R() < 0.2) addTree(cx, onBlvd ? cz : z0 + 0.5, R() < 0.5 ? 'palm' : 'ficus');
      return;
    }
    if (d === 'dtla' || d === 'cc') {
      const center = d === 'dtla' ? L.dtla : L.century;
      const dd = Math.hypot(cx - center.x, cz - center.z);
      const f = Math.exp(-((dd / (d === 'dtla' ? 62 : 30)) ** 2));
      const h = Math.round((12 + f * (24 + R() * (d === 'dtla' ? 80 : 50))) / 3) * 3;
      if (h < 22 && R() < 0.4) return commercial(x0 + 0.5, z0 + 0.5, x1 - 0.5, z1 - 0.5, h, { col: pick(STUCCO) });
      return tower(x0 + 0.5, z0 + 0.5, x1 - 0.5, z1 - 0.5, h);
    }
    // mid
    if (R() < 0.55) commercial(x0 + 0.5, z0 + 0.5, x1 - 0.5, z1 - 0.5, 4 + Math.floor(R() * 4) * 3, { tank: true, billboard: true });
    else resLot(x0, z0, x1, z1);
  }

  for (let xl = -320; xl < 400; xl += 40) {
    for (let k = 0; k < zLines.length - 1; k++) {
      const za = zLines[k], zb = zLines[k + 1];
      const zm = (za + zb) / 2;
      const bx0 = xl + (nsExists(xl, zm) ? 6 : 1.5);
      const bx1 = xl + 40 - (nsExists(xl + 40, zm) ? 6 : 1.5);
      const bz0 = za + halfW(za) + 3, bz1 = zb - halfW(zb) - 3;
      const d = district((bx0 + bx1) / 2, zm);
      const bw = bx1 - bx0, bd = bz1 - bz0;
      if (d === 'dtla' && R() < 0.3 && flat(bx0, bz0, bx1, bz1) && clear(bx0, bz0, bx1, bz1)) {
        const dd = Math.hypot((bx0 + bx1) / 2 - L.dtla.x, zm - L.dtla.z);
        const h = Math.round((30 + Math.exp(-((dd / 60) ** 2)) * (40 + R() * 50)) / 3) * 3;
        tower(bx0 + 2, bz0 + 2, bx1 - 2, bz1 - 2, h);
        continue;
      }
      const target = d === 'res' ? 13 : d === 'dtla' || d === 'cc' ? 14 : 10;
      const nx = Math.max(1, Math.round(bw / target)), nz = Math.max(1, Math.round(bd / target));
      const gap = d === 'res' ? 0.8 : 1.2;
      const lw = (bw - (nx - 1) * gap) / nx, ld = (bd - (nz - 1) * gap) / nz;
      for (let i = 0; i < nx; i++)
        for (let j = 0; j < nz; j++) {
          const lx = bx0 + i * (lw + gap), lz = bz0 + j * (ld + gap);
          lot(lx, lz, lx + lw, lz + ld, district(lx + lw / 2, lz + ld / 2));
        }
    }
  }

  // Aon Center (generic box tower in its reserved block)
  tower(251, 240, 269, 255, 102, { col: '#6f7682', lit: 0.5 });

  // ---------- street furniture ----------
  function lamp(x, z, warm) {
    solid.box(x - 0.18, 0, z - 0.18, x + 0.18, 5.6, z + 0.18, '#2c2c32');
    glow.box(x - 0.45, 5.6, z - 0.45, x + 0.45, 6.3, z + 0.45, warm ? SODIUM : WHITE_LAMP, { shade: false, ao: 1, bottom: true });
  }
  const nearNS = (x, z, m) => {
    const xl = Math.round(x / 40) * 40;
    return nsExists(xl, z) && Math.abs(x - xl) < m;
  };
  const nearEW = (z, m) => EW.some((r) => Math.abs(z - r.z) < r.w / 2 + m);
  const okGround = (x, z) => T.hAt(x, z) === 0 && !inPlaza(x, z, 1) && distFwy(x, z) > FWY_HALF + 2;

  for (const r of EW)
    for (let x = -316; x < 398; x += 16)
      for (const s of [-1, 1]) {
        const z = r.z + s * (r.w / 2 + 1.6);
        if (!okGround(x, z) || nearNS(x, z, 7)) continue;
        lamp(x, z, !r.blvd);
      }
  for (let xl = -320; xl <= 400; xl += 40)
    for (let z = -26; z < 318; z += 16)
      for (const s of [-1, 1]) {
        const x = xl + s * 4.6;
        if (!nsExists(xl, z) || !okGround(x, z) || nearEW(z, 4)) continue;
        lamp(x, z, true);
      }

  // Palms: Sunset Blvd, Hollywood Blvd, palm avenues
  for (let x = -312; x < -60; x += 10)
    for (const s of [-1, 1]) {
      const z = 90 + s * 6.6;
      if (!okGround(x, z) || nearNS(x, z, 6)) continue;
      trees.palm[R() < 0.7 ? 2 : 1].push({ x: x + (R() - 0.5), y: 0, z });
    }
  for (let x = -310; x < 40; x += 22)
    for (const s of [-1, 1]) {
      const z = 20 + s * 6.5;
      if (!okGround(x, z) || nearNS(x, z, 6)) continue;
      trees.palm[1].push({ x, y: 0, z });
    }
  for (const xl of [-280, -200, 120, 160])
    for (let z = 30; z < 318; z += 11)
      for (const s of [-1, 1]) {
        const x = xl + s * 4.5;
        if (!okGround(x, z) || nearEW(z, 4) || district(x, z) === 'dtla') continue;
        trees.palm[2].push({ x, y: 0, z });
      }
  // Street trees on residential streets
  for (const r of EW) {
    if (r.blvd) continue;
    for (let x = -314; x < 398; x += 12)
      for (const s of [-1, 1]) {
        const z = r.z + s * (r.w / 2 + 1.5);
        if (!okGround(x, z) || nearNS(x, z, 7) || district(x, z) !== 'res') continue;
        if (R() < 0.25) continue;
        trees[R() < 0.5 ? 'ficus' : 'oak'].push({ x: x + 6, y: 0, z });
      }
  }

  // Walk of Fame stars + blvd centre lines
  for (const zc of [13.5, 26.5])
    for (let x = -318; x < 40; x += 3.4) {
      if (!okGround(x, zc) || nearNS(x, zc, 4)) continue;
      solid.face(2, x - 0.7, 0.03, zc - 0.7, x + 0.7, 0.03, zc + 0.7, '#d07884');
      solid.face(2, x - 0.25, 0.05, zc - 0.25, x + 0.25, 0.05, zc + 0.25, '#e8c058');
    }
  for (const zc of [20, 90]) {
    solid.face(2, -320, 0.02, zc - 0.45, 400, 0.02, zc - 0.2, '#c8a040');
    solid.face(2, -320, 0.02, zc + 0.2, 400, 0.02, zc + 0.45, '#c8a040');
  }
  // Red carpet
  solid.face(2, -183, 0.04, -6, -177, 0.04, 14, '#a01c26');

  // ---------- US-101 elevated freeway ----------
  const DECK = '#5c5b60', BAR = '#9a958e', UNDER = '#3a3a3e';
  for (let i = 0; i < FWY.length - 1; i++) {
    const [ax, az] = FWY[i], [bx, bz] = FWY[i + 1];
    const len = Math.hypot(bx - ax, bz - az);
    const dx = (bx - ax) / len, dz = (bz - az) / len;
    const rx = -dz, rz = dx;
    const e0 = i === 0 ? 0 : 3, e1 = i === FWY.length - 2 ? 0 : 3;
    const A = [ax - dx * e0, az - dz * e0], B = [bx + dx * e1, bz + dz * e1];
    const P = (p, off, y) => [p[0] + rx * off, y, p[1] + rz * off];
    const h = FWY_HALF, y = FWY_Y, yb = FWY_Y - 1.2, yt = FWY_Y + 0.9;
    solid.quadAuto([P(A, -h, y), P(B, -h, y), P(B, h, y), P(A, h, y)], [0, 1, 0], DECK);
    solid.quadAuto([P(A, -h, yb), P(B, -h, yb), P(B, h, yb), P(A, h, yb)], [0, -1, 0], UNDER);
    solid.quadAuto([P(A, h, yb), P(B, h, yb), P(B, h, yt), P(A, h, yt)], [rx, 0, rz], BAR);
    solid.quadAuto([P(A, -h, yb), P(B, -h, yb), P(B, -h, yt), P(A, -h, yt)], [-rx, 0, -rz], BAR);
    for (const s of [-1, 1]) {
      const o = s * (h - 0.4);
      solid.quadAuto([P(A, o, y), P(B, o, y), P(B, o, yt), P(A, o, yt)], [-s * rx, 0, -s * rz], BAR);
      solid.quadAuto([P(A, o, yt), P(B, o, yt), P(B, s * h, yt), P(A, s * h, yt)], [0, 1, 0], BAR);
    }
    // lane dashes
    for (let s = 2; s < len; s += 6)
      for (const off of [-3.5, 3.5]) {
        const p = [ax + dx * s, az + dz * s], q = [ax + dx * (s + 2.5), az + dz * (s + 2.5)];
        solid.quadAuto([P(p, off - 0.12, y + 0.03), P(q, off - 0.12, y + 0.03), P(q, off + 0.12, y + 0.03), P(p, off + 0.12, y + 0.03)], [0, 1, 0], '#d8d4c8');
      }
    for (let s = 8; s < len; s += 16) {
      const px = ax + dx * s, pz = az + dz * s;
      const gy = T.groundY(px, pz);
      if (gy < yb - 1) solid.box(px - 0.9, gy, pz - 0.9, px + 0.9, yb, pz + 0.9, '#8a8680');
    }
    for (let s = 12; s < len; s += 24) {
      const px = ax + dx * s, pz = az + dz * s;
      solid.box(px - 0.15, y, pz - 0.15, px + 0.15, y + 6, pz + 0.15, '#3a3a40');
      glow.box(px - 0.5, y + 6, pz - 0.5, px + 0.5, y + 6.6, pz + 0.5, SODIUM, { shade: false, ao: 1, bottom: true });
    }
  }

  // ---------- hillside homes ----------
  let placed = 0;
  for (let a = 0; a < 6000 && placed < 300; a++) {
    const x = WORLD.x0 + 10 + R() * (WORLD.x1 - WORLD.x0 - 20);
    const z = WORLD.z0 + 10 + R() * (60 - WORLD.z0);
    const hh = T.hAt(x, z);
    if (hh < 2 || hh > 30) continue;
    if (Math.hypot(x - L.obs.x, z - L.obs.z) < 70) continue;
    if (Math.hypot(x - SIGN.x, z - SIGN.z) < 60) continue;
    if (distFwy(x, z) < 16) continue;
    if (R() > 1.25 - hh / 22) continue;
    const w = 4 + R() * 4, d = 3.5 + R() * 3;
    const x0 = x - w / 2, z0 = z - d / 2, x1 = x + w / 2, z1 = z + d / 2;
    const hs = [T.hAt(x0, z0), T.hAt(x1, z0), T.hAt(x0, z1), T.hAt(x1, z1)];
    const lo = Math.min(...hs) * 2, hi = Math.max(...hs) * 2;
    if (hi - lo > 4) continue;
    const top = hi + 3 + R() * 3;
    solid.box(x0, lo - 1, z0, x1, top, z1, pick(HOUSE));
    solid.box(x0 - 0.3, top, z0 - 0.3, x1 + 0.3, top + 0.35, z1 + 0.3, '#7d766c');
    glow.face(4, x0 + 0.5, hi + 0.6, z1, x1 - 0.5, top - 0.6, z1 + 0.06, R() < 0.75 ? pick(LIT) : DARK);
    if (R() < 0.5) glow.face(0, x1, hi + 0.8, z0 + 0.6, x1 + 0.06, top - 0.8, z1 - 0.6, R() < 0.6 ? pick(LIT) : DARK);
    if (R() < 0.25) {
      solid.face(2, x0, hi + 0.1, z1 + 0.4, x0 + 3, hi + 0.1, z1 + 2.2, '#d6cfc0');
      solid.face(2, x0 + 0.3, hi + 0.15, z1 + 0.7, x0 + 2.7, hi + 0.15, z1 + 1.9, '#38c0d4');
    }
    mark(x0, z0, x1, z1, top);
    placed++;
  }

  T.obst = obst;
  return { solid: solid.geometry(), glow: glow.geometry(), trees, aviation };
}
