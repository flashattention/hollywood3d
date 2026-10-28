import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';

import { buildTerrain, terrainMesh } from './terrain.js';
import { buildCity } from './city.js';
import { buildLandmarks } from './landmarks.js';
import { treeGeometries, instanced, hillTrees } from './vegetation.js';
import { Traffic } from './traffic.js';
import { Sky, samplePalette } from './sky.js';
import { DitherShader } from './post.js';
import { CHAPTERS, makeKeyframes, MORSE_TIMELINE } from './story.js';
import { WORLD } from './layout.js';
import { clamp, lerp, smoothstep, rng } from './noise.js';

const $ = (s) => document.querySelector(s);
const tick = () => new Promise((r) => requestAnimationFrame(() => setTimeout(r, 0)));
const progressBar = $('#loader .bar span');
const progressMsg = $('#loader .loader-msg');
const setProgress = async (f, msg) => {
  progressBar.style.width = `${Math.round(f * 100)}%`;
  progressMsg.textContent = msg;
  await tick();
};

// ---------- renderer ----------
const canvas = $('#scene');
let renderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
} catch (e) {
  progressMsg.textContent = 'WebGL을 사용할 수 없는 환경입니다.';
  throw e;
}
renderer.setPixelRatio(1);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.NoToneMapping;

const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x74627e, 0.003);
const camera = new THREE.PerspectiveCamera(30, innerWidth / innerHeight, 0.5, 4000);

const hemi = new THREE.HemisphereLight(0xffffff, 0x222222, 1);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xffffff, 2);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -230, right: 230, top: 230, bottom: -230, near: 10, far: 1400 });
sun.shadow.bias = -0.0006;
sun.shadow.normalBias = 0.6;
scene.add(sun, sun.target);

const sky = new Sky();
scene.add(sky.mesh);

// ---------- materials ----------
const U = {
  uNight: { value: 0 },
  uDay: { value: new THREE.Color() },
  uBoost: { value: 1.6 },
  uFlood: { value: 0 },
};
const solidMat = new THREE.MeshLambertMaterial({ vertexColors: true });
const glowMat = new THREE.MeshBasicMaterial({ vertexColors: true });
glowMat.onBeforeCompile = (sh) => {
  Object.assign(sh.uniforms, { uNight: U.uNight, uDay: U.uDay, uBoost: U.uBoost });
  sh.fragmentShader = 'uniform float uNight;\nuniform vec3 uDay;\nuniform float uBoost;\n' +
    sh.fragmentShader.replace('#include <color_fragment>',
      '#include <color_fragment>\n diffuseColor.rgb = mix(uDay * (0.7 + 0.6 * vColor.g), vColor * uBoost, uNight);');
};
const floodMat = new THREE.MeshLambertMaterial({ vertexColors: true });
floodMat.onBeforeCompile = (sh) => {
  sh.uniforms.uFlood = U.uFlood;
  sh.fragmentShader = 'uniform float uFlood;\n' +
    sh.fragmentShader.replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n totalEmissiveRadiance += vColor * uFlood;');
};
const signMat = new THREE.MeshLambertMaterial({ vertexColors: true });
signMat.onBeforeCompile = (sh) => {
  sh.uniforms.uFlood = U.uFlood;
  sh.fragmentShader = 'uniform float uFlood;\n' +
    sh.fragmentShader.replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n totalEmissiveRadiance += vColor * (0.16 + uFlood * 1.2);');
};
const mats = { solid: solidMat, glow: glowMat, flood: floodMat, sign: signMat };

// ---------- post ----------
const composer = new EffectComposer(renderer);
composer.setPixelRatio(1);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.5, 0.5, 0.78);
composer.addPass(bloom);
composer.addPass(new OutputPass());
const dither = new ShaderPass(DitherShader);
composer.addPass(dither);

let pxSize = 3, pxBias = 0;
function resize() {
  const w = innerWidth, h = innerHeight;
  pxSize = Math.max(2, Math.round(h / 330)) + pxBias;
  const rw = Math.ceil(w / pxSize), rh = Math.ceil(h / pxSize);
  renderer.setSize(rw, rh, false);
  composer.setSize(rw, rh);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  $('#track').style.height = `${(CHAPTERS.length - 1) * 150 + 100}vh`;
}
addEventListener('resize', resize);
resize();

// ---------- world ----------
let T, K, posCurve, tgtCurve, traffic, lm;
const blinkMats = [];
let morseMat, searchBeams = [], farLights, planes;

async function build() {
  await setProgress(0.05, '언덕을 쌓는 중…');
  T = buildTerrain();
  await setProgress(0.2, '거리를 그리는 중…');
  const city = buildCity(T);
  await setProgress(0.4, '지형을 다듬는 중…');
  scene.add(terrainMesh(T, solidMat));

  const ground = new THREE.Mesh(new THREE.PlaneGeometry(9000, 9000).rotateX(-Math.PI / 2), new THREE.MeshLambertMaterial({ color: 0x58564f }));
  ground.position.y = -0.06;
  ground.receiveShadow = true;
  scene.add(ground);

  const cs = new THREE.Mesh(city.solid, solidMat);
  cs.castShadow = cs.receiveShadow = true;
  scene.add(cs, new THREE.Mesh(city.glow, glowMat));

  await setProgress(0.55, '랜드마크를 세우는 중…');
  lm = buildLandmarks(T, mats);
  scene.add(lm.root);

  await setProgress(0.68, '야자수를 심는 중…');
  const tg = treeGeometries();
  const ht = hillTrees(T, lm.letters);
  const add = (m) => m && scene.add(m);
  add(instanced(tg.oak, [...city.trees.oak, ...ht.oak], solidMat, 1));
  add(instanced(tg.ficus, city.trees.ficus, solidMat, 2));
  add(instanced(tg.shrub, ht.shrub, solidMat, 3, { smin: 0.8, smax: 1.4 }));
  add(instanced(tg.cypress, [...city.trees.cypress, ...ht.cypress], solidMat, 4));
  city.trees.palm.forEach((list, i) => add(instanced(tg.palm[i], list, solidMat, 5 + i, { rot90: true, smin: 0.95, smax: 1.08 })));

  await setProgress(0.8, '자동차에 시동을 거는 중…');
  traffic = new Traffic(solidMat);
  scene.add(traffic.group);

  // aviation blinkers
  const blinkGeo = new THREE.BoxGeometry(1, 1, 1);
  const allBlink = [...city.aviation.map((p) => ({ pos: p })), ...lm.blinkers];
  const bm = new THREE.MeshBasicMaterial({ color: 0xff2010 });
  blinkMats.push(bm);
  const bi = new THREE.InstancedMesh(blinkGeo, bm, allBlink.length);
  const d = new THREE.Object3D();
  allBlink.forEach((b, i) => { d.position.set(...b.pos); d.updateMatrix(); bi.setMatrixAt(i, d.matrix); });
  bi.frustumCulled = false;
  scene.add(bi);

  morseMat = new THREE.MeshBasicMaterial({ color: 0xff2010 });
  const morse = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.4, 1.4), morseMat);
  morse.position.set(...lm.capTop);
  scene.add(morse);

  // premiere searchlights
  const beamGeo = new THREE.CylinderGeometry(7, 0.5, 260, 20, 1, true).translate(0, 130, 0);
  const beamMat = new THREE.ShaderMaterial({
    uniforms: { uI: { value: 0 }, uCol: { value: new THREE.Color('#fff1d6') } },
    vertexShader: `varying float vY; varying vec3 vN; varying vec3 vV;
      void main(){ vY = uv.y; vec4 mv = modelViewMatrix * vec4(position,1.0); vN = normalize(normalMatrix*normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix*mv; }`,
    fragmentShader: `uniform float uI; uniform vec3 uCol; varying float vY; varying vec3 vN; varying vec3 vV;
      void main(){ float f = abs(dot(normalize(vN), normalize(vV))); float a = uI * pow(f, 2.5) * pow(1.0 - vY, 1.7); gl_FragColor = vec4(uCol * a, a); }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
  });
  for (const [i, p] of lm.searchlights.entries()) {
    const beam = new THREE.Mesh(beamGeo, beamMat);
    beam.position.set(...p);
    beam.userData.phase = i * 2.1;
    beam.frustumCulled = false;
    scene.add(beam);
    searchBeams.push(beam);
    const base = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.2, 1.6), solidMat.clone());
    base.material.vertexColors = false;
    base.material.color.set('#3a3a40');
    base.position.set(p[0], 0.6, p[2]);
    scene.add(base);
  }
  searchBeams.mat = beamMat;

  // the rest of the basin glittering beyond the modelled world
  const R = rng(99);
  const N = 26000, pos = new Float32Array(N * 3), col = new Float32Array(N * 3);
  const palette = ['#ffb070', '#ffb070', '#ffc890', '#fff0d8', '#ffe0b0', '#ff7050', '#b0e0ff'].map((h) => new THREE.Color(h));
  for (let i = 0; i < N; i++) {
    let x, z;
    do {
      x = -1800 + R() * 3800;
      z = R() < 0.18 ? -1400 + R() * 900 : -40 + R() * 1800;
    } while (x > WORLD.x0 - 10 && x < WORLD.x1 + 10 && z > WORLD.z0 - 10 && z < WORLD.z1 + 10);
    if (R() < 0.5) x = Math.round(x / 22) * 22; else z = Math.round(z / 22) * 22;
    pos.set([x, 0.6, z], i * 3);
    const c = palette[Math.floor(R() * palette.length)];
    const k = 0.7 + R() * 1.2;
    col.set([c.r * k, c.g * k, c.b * k], i * 3);
  }
  const fg = new THREE.BufferGeometry();
  fg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  fg.setAttribute('color', new THREE.BufferAttribute(col, 3));
  farLights = new THREE.Points(fg, new THREE.PointsMaterial({ size: 1, sizeAttenuation: false, vertexColors: true, transparent: true, opacity: 0, depthWrite: false, fog: false }));
  farLights.frustumCulled = false;
  scene.add(farLights);

  // planes on approach to LAX
  const pg = new THREE.BufferGeometry();
  pg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(5 * 3), 3));
  planes = new THREE.Points(pg, new THREE.PointsMaterial({ size: 2, sizeAttenuation: false, color: 0xfff4e0, transparent: true, fog: false }));
  planes.frustumCulled = false;
  scene.add(planes);

  await setProgress(0.92, '조명을 맞추는 중…');
  K = makeKeyframes(T, lm.sign);
  posCurve = new THREE.CatmullRomCurve3(K.map((k) => new THREE.Vector3(...k.p)), false, 'centripetal');
  tgtCurve = new THREE.CatmullRomCurve3(K.map((k) => new THREE.Vector3(...k.t)), false, 'centripetal');
  buildUI();
  await setProgress(1, '');
}

// ---------- UI ----------
const cards = [...document.querySelectorAll('.card')];
function buildUI() {
  const nav = $('#chapters');
  CHAPTERS.forEach((name, i) => {
    const b = document.createElement('button');
    b.innerHTML = `<span class="num">${String(i + 1).padStart(2, '0')}</span><span class="lbl">${name}</span>`;
    b.addEventListener('click', () => scrollTo({ top: i * innerHeight * 1.5, behavior: 'smooth' }));
    nav.appendChild(b);
  });
}

function scrollProgress() {
  return clamp(scrollY / (innerHeight * 1.5), 0, CHAPTERS.length - 1);
}

const mouse = { x: 0, y: 0, sx: 0, sy: 0 };
addEventListener('pointermove', (e) => {
  mouse.x = (e.clientX / innerWidth) * 2 - 1;
  mouse.y = (e.clientY / innerHeight) * 2 - 1;
});

const override = (() => {
  const v = parseFloat(new URLSearchParams(location.hash.slice(1)).get('p'));
  return Number.isFinite(v) ? v : null;
})();

// coarser pixels if the GPU struggles
let adaptT = 0, adaptN = 0;
function adapt(dt) {
  adaptT += dt; adaptN++;
  if (adaptT < 3) return;
  const avg = adaptT / adaptN;
  adaptT = 0; adaptN = 0;
  if (avg > 1 / 38 && pxBias < 3) { pxBias++; resize(); }
}

// ---------- frame ----------
const clock = new THREE.Clock();
let time = 0, P = override ?? 0, liftS = 0;
const sunDir = new THREE.Vector3(), lightDir = new THREE.Vector3(), focus = new THREE.Vector3(), tmpV = new THREE.Vector3();
const DEG = Math.PI / 180, SUN_BEARING = 250 * DEG;
const dayGlass = new THREE.Color('#2b3444');
const clockEl = $('#clock'), ampmEl = $('#ampm');
let lastActive = -1;

function applyTime(tod) {
  const pal = samplePalette(tod);
  const night = smoothstep(0.2, 0.7, tod);
  const e = pal.elev * DEG;
  sunDir.set(Math.sin(SUN_BEARING) * Math.cos(e), Math.sin(e), -Math.cos(SUN_BEARING) * Math.cos(e));
  const le = Math.max(e, 3 * DEG);
  lightDir.set(Math.sin(SUN_BEARING) * Math.cos(le), Math.sin(le), -Math.cos(SUN_BEARING) * Math.cos(le));

  sky.update(pal, sunDir, night, time, camera.position);
  sun.color.copy(pal.sunC);
  sun.intensity = pal.sunI * Math.PI;
  sun.target.position.copy(focus);
  sun.position.copy(focus).addScaledVector(lightDir, 600);
  sun.target.updateMatrixWorld();
  renderer.shadowMap.autoUpdate = pal.sunI > 0.03;

  hemi.color.copy(pal.hemiS);
  hemi.groundColor.copy(pal.hemiG);
  hemi.intensity = pal.hemiI * Math.PI;
  scene.fog.color.copy(pal.fog);
  scene.fog.density = lerp(0.0022, 0.0013, night);

  U.uNight.value = night;
  U.uFlood.value = smoothstep(0.3, 0.85, tod) * 0.55;
  U.uDay.value.copy(dayGlass).lerp(pal.hor, 0.35).multiplyScalar(1 - night * 0.5);

  bloom.strength = lerp(0.3, 0.6, night);
  bloom.threshold = lerp(0.85, 0.72, night);
  bloom.radius = 0.3;

  const blink = (Math.sin(time * 2.6) > 0.55 ? 1 : 0.08);
  blinkMats.forEach((m) => m.color.setRGB(blink * (0.6 + night * 1.6), 0.05 * blink, 0.02));

  let tm = time % MORSE_TIMELINE.reduce((a, b) => a + b[1] * 0.22, 0);
  let on = false;
  for (const [st, dur] of MORSE_TIMELINE) { if (tm < dur * 0.22) { on = st; break; } tm -= dur * 0.22; }
  morseMat.color.setRGB(on ? 0.8 + night * 2.2 : 0.12, on ? 0.06 : 0.01, 0.02);

  searchBeams.mat.uniforms.uI.value = smoothstep(0.32, 0.6, tod) * 0.28;
  searchBeams.forEach((b) => {
    const ph = b.userData.phase;
    b.rotation.set(Math.sin(time * 0.31 + ph) * 0.32 - 0.1, 0, Math.sin(time * 0.43 + ph * 1.7) * 0.5);
  });

  farLights.material.opacity = smoothstep(0.35, 0.8, tod);
  const pp = planes.geometry.attributes.position;
  for (let i = 0; i < 5; i++) {
    const s = ((time * 0.012 + i * 0.2) % 1);
    pp.setXYZ(i, lerp(1400, -1200, s), lerp(260, 60, s), lerp(500, 820, s) + i * 6);
  }
  pp.needsUpdate = true;
  planes.material.opacity = night * (Math.sin(time * 6) > 0 ? 1 : 0.35);

  traffic.update(0, night);

  // story clock: 5:52 PM → ~8:30 PM
  const mins = 17 * 60 + 52 + tod * 158;
  const hh = Math.floor(mins / 60), mm = Math.floor(mins % 60);
  clockEl.textContent = `${((hh + 11) % 12) + 1}:${String(mm).padStart(2, '0')}`;
  ampmEl.textContent = hh >= 12 ? 'PM PDT' : 'AM PDT';
  document.documentElement.style.setProperty('--night', night.toFixed(3));
}

function frame() {
  const dt = Math.min(clock.getDelta(), 0.05);
  time += dt;
  const target = override ?? scrollProgress();
  P += (target - P) * (1 - Math.exp(-dt * 3.2));
  if (override != null) P = override;

  const N = K.length;
  const seg = Math.min(Math.floor(P), N - 2);
  const f = clamp(P - seg, 0, 1);
  const e = smoothstep(0.12, 0.88, f);
  const u = (seg + e) / (N - 1);
  const a = K[seg], b = K[seg + 1];

  const pos = posCurve.getPoint(u);
  const tgt = tgtCurve.getPoint(u);
  const arc = Math.sin(Math.PI * e);
  pos.y += arc * a.lift;
  tgt.y += arc * a.lift * 0.3;

  const need = Math.max(0, T.obstacleY(pos.x, pos.z) + 3 - pos.y);
  liftS += (need - liftS) * (need > liftS ? 0.35 : 0.06);
  pos.y += liftS;
  pos.x += Math.sin(time * 0.21) * 0.5;
  pos.y += Math.sin(time * 0.17) * 0.35;

  camera.position.copy(pos);
  camera.lookAt(tgt);
  mouse.sx += (mouse.x - mouse.sx) * 0.04;
  mouse.sy += (mouse.y - mouse.sy) * 0.04;
  camera.rotateY(-mouse.sx * 0.025);
  camera.rotateX(-mouse.sy * 0.015);
  // keep roughly the same horizontal framing on portrait screens
  const fv = lerp(a.fov, b.fov, e);
  const ref = 1.6;
  camera.fov = camera.aspect >= ref ? fv
    : Math.min(80, lerp(fv, (2 * Math.atan(Math.tan((fv * DEG) / 2) * ref / camera.aspect)) / DEG, 0.7));
  camera.updateProjectionMatrix();

  tmpV.subVectors(tgt, pos);
  focus.copy(pos).addScaledVector(tmpV.normalize(), Math.min(140, pos.distanceTo(tgt)));
  focus.y = 0;

  traffic.update(dt, 0);
  applyTime(lerp(a.tod, b.tod, e));

  // cards
  cards.forEach((c, i) => {
    const d = Math.abs(P - i);
    const o = 1 - smoothstep(0.08, 0.3, d);
    c.style.opacity = o.toFixed(3);
    c.style.transform = `translate3d(0, ${((P - i) * -60).toFixed(1)}px, 0)`;
    c.style.visibility = o > 0.001 ? 'visible' : 'hidden';
  });
  const active = Math.round(P);
  if (active !== lastActive) {
    document.querySelectorAll('#chapters button').forEach((btn, i) => btn.classList.toggle('active', i === active));
    lastActive = active;
  }
  $('.scroll-hint').style.opacity = String(1 - smoothstep(0.02, 0.15, P));

  composer.render();
  adapt(dt);
  requestAnimationFrame(frame);
}

build().then(() => {
  frame();
  setTimeout(() => document.body.classList.add('ready'), 250);
}).catch((err) => {
  console.error(err);
  progressMsg.textContent = '로딩 중 오류가 발생했습니다: ' + err.message;
});
