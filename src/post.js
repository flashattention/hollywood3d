// Final pass in sRGB space: vignette + ordered (Bayer) dithering + posterisation.
export const DitherShader = {
  uniforms: {
    tDiffuse: { value: null },
    uLevels: { value: 30 },
    uVig: { value: 0.42 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }`,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float uLevels;
    uniform float uVig;
    varying vec2 vUv;

    float bayer(vec2 p) {
      int x = int(mod(p.x, 4.0));
      int y = int(mod(p.y, 4.0));
      float m[16] = float[16](0.0, 8.0, 2.0, 10.0, 12.0, 4.0, 14.0, 6.0, 3.0, 11.0, 1.0, 9.0, 15.0, 7.0, 13.0, 5.0);
      return m[x + y * 4] / 16.0;
    }

    void main() {
      vec3 c = texture2D(tDiffuse, vUv).rgb;
      vec2 q = vUv - 0.5;
      c *= 1.0 - dot(q, q) * uVig * 2.0;
      // gentle film warmth in the shadows
      c += vec3(0.012, 0.004, 0.016) * (1.0 - c);
      c += (bayer(gl_FragCoord.xy) - 0.47) / uLevels;
      c = floor(c * uLevels + 0.5) / uLevels;
      gl_FragColor = vec4(c, 1.0);
    }`,
};
