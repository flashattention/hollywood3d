import { HERO, SIGN, L, CAPITOL_CAM } from './layout.js';

export const CHAPTERS = ['Griffith', 'The Sign', 'Sunset Blvd', 'Hollywood Blvd', 'Capitol', 'Downtown', 'City of Stars'];

// Camera keyframes. tod: 0 = golden hour (reference photo) → 1 = night.
export function makeKeyframes(T, sign) {
  const g = (x, z) => T.groundY(x, z);
  const sy = sign.y;
  return [
    { p: [HERO.x, Math.max(HERO.y, g(HERO.x, HERO.z) + 10), HERO.z], t: [9, 51, -41], fov: 30, tod: 0.0, lift: 40 },
    { p: [SIGN.cam.x, sy + SIGN.cam.dy, SIGN.cam.z], t: [sign.x, sy + 7, sign.z], fov: 30, tod: 0.1, lift: 30 },
    { p: [-78, 4.2, 91.5], t: [-260, 16, 100], fov: 42, tod: 0.24, lift: 28 },
    { p: [-140, 22, 64], t: [-182, 14, -4], fov: 42, tod: 0.45, lift: 26 },
    { p: [CAPITOL_CAM.x, CAPITOL_CAM.y, CAPITOL_CAM.z], t: [L.capitol.x, 40, -20], fov: 44, tod: 0.62, lift: 70 },
    { p: [96, 44, 430], t: [250, 58, 214], fov: 36, tod: 0.82, lift: 60 },
    { p: [70, 310, 480], t: [10, 0, 40], fov: 44, tod: 1.0, lift: 0 },
  ];
}

// "HOLLYWOOD" in Morse, as blinked by the Capitol Records spire.
const MORSE = { H: '....', O: '---', L: '.-..', Y: '-.--', W: '.--', D: '-..' };
export const MORSE_TIMELINE = (() => {
  const seq = [];
  for (const ch of 'HOLLYWOOD') {
    for (const s of MORSE[ch]) seq.push([true, s === '.' ? 1 : 3], [false, 1]);
    seq.push([false, 2]);
  }
  seq.push([false, 5]);
  return seq;
})();
