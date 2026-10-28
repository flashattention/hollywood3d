# Hollywood — Golden Hour

A scroll-driven 3D voxel tour of Hollywood → Downtown LA, from golden hour to city lights.
Three.js renders it at low resolution with nearest-neighbour upscaling, bloom, and Bayer dithering.

## Run

ES modules need a local server:

```sh
python3 -m http.server 8000
# open http://localhost:8000
```

Add `#p=2.5` to the URL to jump to a point in the story (0–6).

## Structure

- `src/layout.js` – stylised map: landmark positions, streets, US-101
- `src/terrain.js` – Hollywood Hills heightmap and voxel terrain mesher
- `src/city.js` – procedural blocks, windows, lamps, palms, freeway
- `src/landmarks.js` – Griffith Observatory, the Sign, TCL Chinese, Capitol Records, DTLA towers
- `src/sky.js` – time-of-day palettes and the sky shader
- `src/story.js` – camera keyframes per chapter
- `src/main.js` – renderer, post-processing, scroll and UI
