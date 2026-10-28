import * as THREE from 'three';
import { lerp } from './noise.js';

// Time-of-day keys. t=0 matches the reference photo (sun just above the haze).
const KEYS = [
  { t: 0.0, top: '#c38a74', mid: '#ad7a88', hor: '#93708e', glow: '#ff9a66', fog: '#74627e', sun: '#ff6a48', sunC: '#ffae84', sunI: 1.5, hemiS: '#b896ae', hemiG: '#3a2a36', hemiI: 1.0, elev: 3.0 },
  { t: 0.12, top: '#a47a86', mid: '#b8788a', hor: '#c27e86', glow: '#ff8a58', fog: '#6e5878', sun: '#ff5236', sunC: '#ff9070', sunI: 1.15, hemiS: '#a68cb0', hemiG: '#33263a', hemiI: 0.9, elev: 1.6 },
  { t: 0.24, top: '#6e6490', mid: '#a6708e', hor: '#ec9878', glow: '#ff7448', fog: '#5e4a6e', sun: '#ff4028', sunC: '#ff7a5a', sunI: 0.7, hemiS: '#8a7cb0', hemiG: '#2a2034', hemiI: 0.8, elev: 0.3 },
  { t: 0.45, top: '#323a74', mid: '#5c5088', hor: '#c2707a', glow: '#e86450', fog: '#3e3658', sun: '#ff3020', sunC: '#ff6a60', sunI: 0.15, hemiS: '#5e62a8', hemiG: '#1c1830', hemiI: 0.62, elev: -4 },
  { t: 0.62, top: '#18204e', mid: '#2e346c', hor: '#7a4c74', glow: '#a84a56', fog: '#28264a', sun: '#ff3020', sunC: '#704060', sunI: 0.0, hemiS: '#40489a', hemiG: '#121228', hemiI: 0.5, elev: -8 },
  { t: 0.82, top: '#0a1030', mid: '#151d46', hor: '#47335e', glow: '#6a3450', fog: '#1c1a38', sun: '#ff3020', sunC: '#302040', sunI: 0.0, hemiS: '#2c3678', hemiG: '#0c0c1c', hemiI: 0.42, elev: -12 },
  { t: 1.0, top: '#060a1e', mid: '#0e1638', hor: '#3a2a50', glow: '#552a44', fog: '#16152e', sun: '#ff3020', sunC: '#302040', sunI: 0.0, hemiS: '#222c66', hemiG: '#0a0a16', hemiI: 0.38, elev: -16 },
];
const COLOR_KEYS = ['top', 'mid', 'hor', 'glow', 'fog', 'sun', 'sunC', 'hemiS', 'hemiG'];
const PAL = KEYS.map((k) => {
  const o = { ...k };
  for (const c of COLOR_KEYS) o[c] = new THREE.Color(k[c]);
  return o;
});

const out = {};
for (const c of COLOR_KEYS) out[c] = new THREE.Color();

export function samplePalette(t) {
  let i = 0;
  while (i < PAL.length - 2 && t > PAL[i + 1].t) i++;
  const a = PAL[i], b = PAL[i + 1];
  const f = Math.min(1, Math.max(0, (t - a.t) / (b.t - a.t)));
  for (const c of COLOR_KEYS) out[c].copy(a[c]).lerp(b[c], f);
  out.sunI = lerp(a.sunI, b.sunI, f);
  out.hemiI = lerp(a.hemiI, b.hemiI, f);
  out.elev = lerp(a.elev, b.elev, f);
  return out;
}

const vert = /* glsl */ `
varying vec3 vDir;
void main() {
  vDir = position;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

const frag = /* glsl */ `
uniform vec3 uTop, uMid, uHor, uGlow, uSun, uFog;
uniform vec3 uSunDir, uMoonDir;
uniform float uNight, uTime;
varying vec3 vDir;

float h31(vec3 p) {
  p = fract(p * 0.3183099 + 0.1);
  p *= 17.0;
  return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}

void main() {
  vec3 d = normalize(vDir);
  float h = d.y;
  vec3 col = mix(uHor, uMid, smoothstep(0.0, 0.22, h));
  col = mix(col, uTop, smoothstep(0.22, 0.85, h));

  vec2 fd = normalize(d.xz + 1e-5);
  vec2 fs = normalize(uSunDir.xz + 1e-5);
  float az = max(dot(fd, fs), 0.0);
  float band = exp(-max(h, 0.0) * 7.0);
  col += uGlow * (pow(az, 5.0) * band * 0.85 + pow(max(dot(d, uSunDir), 0.0), 40.0) * 0.5);
  float anti = pow(max(-dot(fd, fs), 0.0), 2.0) * exp(-abs(h - 0.08) * 14.0);
  col += uGlow * 0.16 * anti * (1.0 - uNight);

  col = mix(col, uFog, smoothstep(0.035, -0.02, h));

  // pixel sun, cut by haze stripes near the horizon
  float ang = acos(clamp(dot(d, uSunDir), -1.0, 1.0));
  float disk = 1.0 - smoothstep(0.0135, 0.0145, ang);
  float stripes = 1.0 - 0.3 * step(0.5, fract(h * 170.0)) * smoothstep(0.05, 0.0, h);
  float vis = smoothstep(-0.006, 0.02, h);
  col = mix(col, uSun * stripes, disk * vis);
  col += uSun * pow(max(dot(d, uSunDir), 0.0), 900.0) * 0.6 * vis;

  if (uNight > 0.01 && h > 0.03) {
    vec3 cell = floor(d * 240.0);
    float r = h31(cell);
    float tw = 0.55 + 0.45 * sin(uTime * (1.5 + r * 3.0) + r * 40.0);
    float star = step(0.9968, r) * tw * smoothstep(0.03, 0.3, h);
    col += vec3(0.95, 0.9, 1.0) * star * uNight * 0.9;
  }

  float ma = acos(clamp(dot(d, uMoonDir), -1.0, 1.0));
  float moon = 1.0 - smoothstep(0.016, 0.018, ma);
  vec3 off = normalize(uMoonDir + vec3(0.011, 0.006, 0.0));
  float cut = 1.0 - smoothstep(0.016, 0.018, acos(clamp(dot(d, off), -1.0, 1.0)));
  col = mix(col, vec3(1.0, 0.94, 0.82), clamp(moon - cut, 0.0, 1.0) * smoothstep(0.2, 0.7, uNight));
  col += vec3(0.5, 0.55, 0.8) * pow(max(dot(d, uMoonDir), 0.0), 200.0) * 0.12 * uNight;

  gl_FragColor = vec4(col, 1.0);
}`;

export class Sky {
  constructor() {
    this.uniforms = {
      uTop: { value: new THREE.Color() }, uMid: { value: new THREE.Color() }, uHor: { value: new THREE.Color() },
      uGlow: { value: new THREE.Color() }, uSun: { value: new THREE.Color() }, uFog: { value: new THREE.Color() },
      uSunDir: { value: new THREE.Vector3(-1, 0.05, 0.3).normalize() },
      uMoonDir: { value: new THREE.Vector3(0.55, 0.42, -0.72).normalize() },
      uNight: { value: 0 }, uTime: { value: 0 },
    };
    const mat = new THREE.ShaderMaterial({
      uniforms: this.uniforms, vertexShader: vert, fragmentShader: frag,
      side: THREE.BackSide, depthWrite: false, fog: false,
    });
    this.mesh = new THREE.Mesh(new THREE.SphereGeometry(2400, 48, 24), mat);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = -1;
  }

  update(pal, sunDir, night, time, camPos) {
    const u = this.uniforms;
    u.uTop.value.copy(pal.top); u.uMid.value.copy(pal.mid); u.uHor.value.copy(pal.hor);
    u.uGlow.value.copy(pal.glow); u.uSun.value.copy(pal.sun).multiplyScalar(1.6); u.uFog.value.copy(pal.fog);
    u.uSunDir.value.copy(sunDir);
    u.uNight.value = night;
    u.uTime.value = time;
    this.mesh.position.copy(camPos);
  }
}
