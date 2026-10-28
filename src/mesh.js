import * as THREE from 'three';
import { hash3 } from './noise.js';

const cache = new Map();
const tmp = new THREE.Color();

// hex (sRGB) -> linear [r,g,b], cached
export function lin(hex) {
  if (Array.isArray(hex)) return hex;
  let c = cache.get(hex);
  if (!c) {
    tmp.set(hex);
    c = [tmp.r, tmp.g, tmp.b];
    cache.set(hex, c);
  }
  return c;
}

// Corner order keeps verts 0,3 at the bottom of side faces (for vertical AO gradients).
export const FACES = [
  { n: [1, 0, 0], c: [[1, 0, 0], [1, 1, 0], [1, 1, 1], [1, 0, 1]], s: 0.86 },
  { n: [-1, 0, 0], c: [[0, 0, 1], [0, 1, 1], [0, 1, 0], [0, 0, 0]], s: 0.86 },
  { n: [0, 1, 0], c: [[0, 1, 1], [1, 1, 1], [1, 1, 0], [0, 1, 0]], s: 1.0 },
  { n: [0, -1, 0], c: [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]], s: 0.6 },
  { n: [0, 0, 1], c: [[1, 0, 1], [1, 1, 1], [0, 1, 1], [0, 0, 1]], s: 0.93 },
  { n: [0, 0, -1], c: [[0, 0, 0], [0, 1, 0], [1, 1, 0], [1, 0, 0]], s: 0.93 },
];
for (const f of FACES) {
  const [a, b, c] = f.c;
  const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
  const v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
  const cr = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
  if (cr[0] * f.n[0] + cr[1] * f.n[1] + cr[2] * f.n[2] < 0) f.c.reverse();
}

export class MeshBuilder {
  constructor() {
    this.p = []; this.n = []; this.c = []; this.i = []; this.v = 0;
  }

  quad(q, n, c0, c1 = c0) {
    const p = this.p;
    for (let k = 0; k < 12; k++) p.push(q[k]);
    const [nx, ny, nz] = n;
    this.n.push(nx, ny, nz, nx, ny, nz, nx, ny, nz, nx, ny, nz);
    this.c.push(c0[0], c0[1], c0[2], c1[0], c1[1], c1[2], c1[0], c1[1], c1[2], c0[0], c0[1], c0[2]);
    const v = this.v;
    this.i.push(v, v + 1, v + 2, v, v + 2, v + 3);
    this.v += 4;
  }

  // Arbitrary quad; flips winding to match the desired normal.
  quadAuto(P, n, c) {
    const ux = P[1][0] - P[0][0], uy = P[1][1] - P[0][1], uz = P[1][2] - P[0][2];
    const vx = P[2][0] - P[0][0], vy = P[2][1] - P[0][1], vz = P[2][2] - P[0][2];
    const cx = uy * vz - uz * vy, cy = uz * vx - ux * vz, cz = ux * vy - uy * vx;
    if (cx * n[0] + cy * n[1] + cz * n[2] < 0) P = [P[0], P[3], P[2], P[1]];
    this.quad([...P[0], ...P[1], ...P[2], ...P[3]], n, lin(c), lin(c));
  }

  face(fi, x0, y0, z0, x1, y1, z1, c0, c1 = c0) {
    const f = FACES[fi], q = new Array(12);
    for (let k = 0; k < 4; k++) {
      const cc = f.c[k];
      q[k * 3] = cc[0] ? x1 : x0;
      q[k * 3 + 1] = cc[1] ? y1 : y0;
      q[k * 3 + 2] = cc[2] ? z1 : z0;
    }
    this.quad(q, f.n, lin(c0), lin(c1));
  }

  box(x0, y0, z0, x1, y1, z1, hex, { ao = 0.72, bottom = false, shade = true } = {}) {
    const col = lin(hex);
    for (let fi = 0; fi < 6; fi++) {
      if (fi === 3 && !bottom) continue;
      const s = shade ? FACES[fi].s : 1;
      const top = [col[0] * s, col[1] * s, col[2] * s];
      if (fi === 2 || fi === 3) this.face(fi, x0, y0, z0, x1, y1, z1, top);
      else this.face(fi, x0, y0, z0, x1, y1, z1, [top[0] * ao, top[1] * ao, top[2] * ao], top);
    }
  }

  geometry() {
    if (!this.v) return null;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.n, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.c, 3));
    g.setIndex(this.v > 65535 ? new THREE.Uint32BufferAttribute(this.i, 1) : new THREE.Uint16BufferAttribute(this.i, 1));
    g.computeBoundingSphere();
    return g;
  }
}

const K = (x, y, z) => ((x + 1024) * 2048 + (y + 1024)) * 2048 + (z + 1024);

export class VoxelModel {
  constructor() { this.m = new Map(); }

  set(x, y, z, c, g = false) { this.m.set(K(x, y, z), [x, y, z, c, g]); }
  has(x, y, z) { return this.m.has(K(x, y, z)); }
  del(x, y, z) { this.m.delete(K(x, y, z)); }

  box(x0, y0, z0, x1, y1, z1, c, g = false) {
    for (let x = x0; x <= x1; x++)
      for (let y = y0; y <= y1; y++)
        for (let z = z0; z <= z1; z++)
          this.set(x, y, z, typeof c === 'function' ? c(x, y, z) : c, g);
  }

  cyl(cx, cz, y0, y1, r, c, g = false) {
    const R2 = (r + 0.5) ** 2, n = Math.ceil(r);
    for (let y = y0; y <= y1; y++)
      for (let x = -n; x <= n; x++)
        for (let z = -n; z <= n; z++)
          if (x * x + z * z <= R2) this.set(cx + x, y, cz + z, typeof c === 'function' ? c(x, y, z) : c, g);
  }

  ring(cx, cz, y, r, c, g = false) {
    const n = Math.ceil(r) + 1;
    for (let x = -n; x <= n; x++)
      for (let z = -n; z <= n; z++) {
        const d = Math.sqrt(x * x + z * z);
        if (Math.abs(d - r) < 0.62) this.set(cx + x, y, cz + z, typeof c === 'function' ? c(x, y, z) : c, typeof g === 'function' ? g(x, y, z) : g);
      }
  }

  dome(cx, y0, cz, r, c, g = false) {
    const R2 = (r + 0.35) ** 2, n = Math.ceil(r);
    for (let y = 0; y <= n; y++)
      for (let x = -n; x <= n; x++)
        for (let z = -n; z <= n; z++)
          if (x * x + y * y + z * z <= R2) this.set(cx + x, y0 + y, cz + z, typeof c === 'function' ? c(x, y, z) : c, g);
  }

  build(solid, glow, { scale = 1, ox = 0, oy = 0, oz = 0, jitter = 0.07, seed = 1 } = {}) {
    for (const v of this.m.values()) {
      const [x, y, z, c, g] = v;
      const b = g ? glow : solid;
      const base = lin(c);
      const j = 1 + (hash3(x, y, z, seed) - 0.5) * jitter * 2;
      const X0 = (x + ox) * scale, Y0 = (y + oy) * scale, Z0 = (z + oz) * scale;
      for (let fi = 0; fi < 6; fi++) {
        const n = FACES[fi].n;
        if (this.m.has(K(x + n[0], y + n[1], z + n[2]))) continue;
        const s = g ? 1 : FACES[fi].s * j;
        b.face(fi, X0, Y0, Z0, X0 + scale, Y0 + scale, Z0 + scale, [base[0] * s, base[1] * s, base[2] * s]);
      }
    }
  }

  geometries(opts) {
    const s = new MeshBuilder(), g = new MeshBuilder();
    this.build(s, g, opts);
    return { solid: s.geometry(), glow: g.geometry() };
  }
}
