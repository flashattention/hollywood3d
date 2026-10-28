import * as THREE from 'three';
import { MeshBuilder } from './mesh.js';
import { rng } from './noise.js';
import { EW, FWY, FWY_Y } from './layout.js';

class Lane {
  constructor(pts, y) {
    this.pts = pts;
    this.y = y;
    this.cum = [0];
    for (let i = 1; i < pts.length; i++)
      this.cum.push(this.cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
    this.len = this.cum[this.cum.length - 1];
  }
  sample(s, out) {
    s = ((s % this.len) + this.len) % this.len;
    let i = 0;
    while (i < this.cum.length - 2 && s > this.cum[i + 1]) i++;
    const a = this.pts[i], b = this.pts[i + 1];
    const seg = this.cum[i + 1] - this.cum[i];
    const f = (s - this.cum[i]) / seg;
    out[0] = a[0] + (b[0] - a[0]) * f;
    out[1] = a[1] + (b[1] - a[1]) * f;
    out[2] = (b[0] - a[0]) / seg;
    out[3] = (b[1] - a[1]) / seg;
  }
}

// Offset a polyline to the right of travel by `off` units.
function offsetLine(pts, off) {
  return pts.map((p, i) => {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
    const dx = b[0] - a[0], dz = b[1] - a[1], l = Math.hypot(dx, dz);
    return [p[0] - (dz / l) * off, p[1] + (dx / l) * off];
  });
}

function carGeometries() {
  const body = new MeshBuilder();
  body.box(-1.25, 0.35, -0.6, 1.25, 1.05, 0.6, '#ffffff');
  body.box(-0.6, 1.05, -0.55, 0.65, 1.65, 0.55, '#3a3e48');
  const head = new MeshBuilder();
  for (const z of [-0.45, 0.25]) head.box(1.24, 0.55, z, 1.34, 0.85, z + 0.2, '#ffffff', { shade: false, ao: 1 });
  const tail = new MeshBuilder();
  for (const z of [-0.5, 0.3]) tail.box(-1.34, 0.6, z, -1.24, 0.85, z + 0.2, '#ffffff', { shade: false, ao: 1 });
  return { body: body.geometry(), head: head.geometry(), tail: tail.geometry() };
}

const CAR_COLORS = ['#f2f0ea', '#f2f0ea', '#c8ccd0', '#9aa0a8', '#26282c', '#26282c', '#a8322a', '#2a4a7a', '#e8c040', '#5a6a4a'];

export class Traffic {
  constructor(bodyMat) {
    const R = rng(777);
    const lanes = [];
    for (const r of EW) {
      if (![20, 90, 160, 230, 300].includes(r.z)) continue;
      const o = r.w > 6 ? 2.6 : 1.6;
      lanes.push({ lane: new Lane([[-330, r.z + o], [410, r.z + o]], 0), v: 7, gap: r.blvd ? 11 : 16 });
      lanes.push({ lane: new Lane([[410, r.z - o], [-330, r.z - o]], 0), v: 7, gap: r.blvd ? 11 : 16 });
    }
    for (const xl of [-280, -200, -120, -40, 40, 120, 200, 280]) {
      lanes.push({ lane: new Lane([[xl - 1.6, 25], [xl - 1.6, 330]], 0), v: 6, gap: 20 });
      lanes.push({ lane: new Lane([[xl + 1.6, 330], [xl + 1.6, 25]], 0), v: 6, gap: 20 });
    }
    const rev = [...FWY].reverse();
    for (const off of [1.8, 5.0]) {
      lanes.push({ lane: new Lane(offsetLine(FWY, off), FWY_Y), v: 13 + off, gap: 7 });
      lanes.push({ lane: new Lane(offsetLine(rev, off), FWY_Y), v: 13 + off, gap: 7 });
    }

    this.cars = [];
    for (const l of lanes) {
      const n = Math.floor(l.lane.len / l.gap);
      for (let i = 0; i < n; i++) {
        if (R() < 0.25) continue;
        this.cars.push({ lane: l.lane, s: (i + R() * 0.5) * l.gap, v: l.v * (0.85 + R() * 0.3) });
      }
    }

    const g = carGeometries();
    const N = this.cars.length;
    this.headMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    this.tailMat = new THREE.MeshBasicMaterial({ color: 0xff2a20 });
    this.body = new THREE.InstancedMesh(g.body, bodyMat, N);
    this.head = new THREE.InstancedMesh(g.head, this.headMat, N);
    this.tail = new THREE.InstancedMesh(g.tail, this.tailMat, N);
    const c = new THREE.Color();
    for (let i = 0; i < N; i++) this.body.setColorAt(i, c.set(CAR_COLORS[Math.floor(R() * CAR_COLORS.length)]));
    for (const m of [this.body, this.head, this.tail]) {
      m.frustumCulled = false;
      m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    }
    this.body.castShadow = true;
    this.group = new THREE.Group();
    this.group.add(this.body, this.head, this.tail);
    this.dummy = new THREE.Object3D();
    this.tmp = [0, 0, 0, 0];
    this.update(0, 0);
  }

  update(dt, night) {
    const d = this.dummy, t = this.tmp;
    for (let i = 0; i < this.cars.length; i++) {
      const car = this.cars[i];
      car.s += car.v * dt;
      car.lane.sample(car.s, t);
      d.position.set(t[0], car.lane.y, t[1]);
      d.rotation.set(0, Math.atan2(-t[3], t[2]), 0);
      d.updateMatrix();
      this.body.setMatrixAt(i, d.matrix);
      this.head.setMatrixAt(i, d.matrix);
      this.tail.setMatrixAt(i, d.matrix);
    }
    this.body.instanceMatrix.needsUpdate = true;
    this.head.instanceMatrix.needsUpdate = true;
    this.tail.instanceMatrix.needsUpdate = true;
    const k = 0.25 + night * 1.6;
    this.headMat.color.setRGB(k, k * 0.92, k * 0.75);
    this.tailMat.color.setRGB(0.3 + night * 1.5, 0.03 + night * 0.08, 0.02 + night * 0.05);
  }
}
