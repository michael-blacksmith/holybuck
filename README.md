# Holy Buck V3 — Cinematic Website

A scroll-controlled product film for **The King** followed by the Holy Buck
gallery/store experience, built with HTML, CSS, vanilla JavaScript, Three.js,
GSAP, and ScrollTrigger.

The experience follows the sculpture from natural antler through digitization,
the formed PLA casting assembly, fire, and silicon bronze before a clean
blackout releases into the actual Holy Buck website.

The visible intro language is intentionally limited to WILD, DIGITIZED, FORMED,
and CAST. Fire and blackout remain unlabeled visual transitions. After the
pinned intro ends, normal document scrolling begins with the Holy Buck brand
hero, the calmer King showcase, casting and origin content, the Royal, Hearth,
and Foundry collections, and the inquiry experience.

## Run locally

The project uses browser JavaScript modules and must be opened through a local
web server. Three.js and the typefaces load from CDNs, so keep an internet
connection active. GSAP and ScrollTrigger are pinned locally in `vendor/`.

### Python

1. Open a terminal in this project folder.
2. Run:

   ```bash
   python -m http.server 8080
   ```

   On systems where Python uses the `python3` command, run:

   ```bash
   python3 -m http.server 8080
   ```

3. Open [http://localhost:8080](http://localhost:8080) in a modern browser.
4. Stop the server with `Ctrl+C`.

### Node.js

1. Open a terminal in this project folder.
2. Run:

   ```bash
   npx serve .
   ```

3. Open the local URL printed in the terminal.
4. Stop the server with `Ctrl+C`.

## 3D assets

- `models/king-right-natural.glb` is the untouched, authoritative textured
  photogrammetry scan used by WILD and DIGITIZED. Its embedded diffuse texture,
  UVs, geometry normals, and source material are preserved.
- `models/king.glb` is the untouched source scan.
- `models/king-web.glb` is the optimized browser asset used for the bronze CAST
  state and the Royal Collection hero.
- If the optimized file is unavailable, the site automatically tries the
  original source GLB before using its procedural fallback.
- `models/plakingforwebsite.glb` is the untouched source PLA casting-pattern
  model, including its funnel, feeds, vents, and support architecture.
- `models/plakingforwebsite-web.glb` is the optimized browser copy used first
  by FORMED. It is lazy-loaded after the opening King is stable; if it is
  unavailable, the site tries the source PLA GLB and logs a clear error if both
  fail.
- The FORMED model is rotated 180 degrees around scene-local Y in Three.js,
  then measured from its post-rotation bounds, centered, and scaled against the
  visible bounds of the clean King. The source GLB is not altered.
- The natural scan is normalized from its measured post-transform bounds and
  receives a restrained three-quarter hero adjustment in Three.js. The bronze
  and PLA models are independently normalized, registered to that framing, and
  kept hidden until their states are active. No source GLB is modified.
- Responsive fitting combines the measured King bounds, safe edge margins, and
  explicit maximum visual-width and height caps so no breakpoint can enlarge
  the sculpture beyond its intended gallery framing.

## Intro architecture and performance

- The textured natural King and optimized bronze King load together. Their
  materials, transforms, centering, scale, registration, and shaders are
  prepared while hidden, followed by the existing 720 ms material fade-in.
- WILD uses the photographic surface embedded in `king-right-natural.glb`.
- DIGITIZED converts that same textured mesh behind the moving scanner using a
  lightweight graphite sampling shader, clipped topology, and point detail. FORMED uses
  a shader-driven geometric reveal so the approved PLA casting architecture
  assembles around the white King instead of appearing in a single swap.
- FIRE uses instanced procedural flame and haze fields, GPU-animated embers,
  localized flickering gallery light, and a bottom-up PLA burnout mask. The
  bronze King returns through active fire before the flames recede.
- The much larger casting-pattern asset is requested during idle time after the
  opening King has arrived. FORMED crossfades to that real model only when it
  is ready.
- Rendering follows the display through one `requestAnimationFrame` loop, uses
  delta-time-aware pointer damping, caps pixel ratio at 1.5 (1.25 on small
  screens), uses responsive shadow sizes, pauses in background tabs, and stops
  once the WebGL scene is below the King showcase.
- The website is an in-document handoff at `#home`; no redirect or reload is
  performed. Everything after the intro uses normal document scrolling.

## Website links and inquiry limitation

The homepage collection and King actions stay inside the local V3 experience:

- `royal.html`
- `hearth.html`
- `foundry.html`

All inquiry forms preserve the existing Formspree POST endpoint. Submitting a
form therefore requires an internet connection and sends the entered inquiry
to the configured Holy Buck form service.

## Rebuild the optimized model

The optimizer preserves the original file and writes a separate
`models/king-web.glb`. It retains the complete topology, removes the unused
diffuse texture, reduces the normal map to 4096 px, and applies decoder-free
glTF mesh quantization.

Install Pillow once if it is not already available:

```bash
python -m pip install Pillow
```

Then run:

```bash
python tools/optimize-king-glb.py
```

## Rebuild the optimized PLA pattern

The PLA source is intentionally preserved. The production copy removes the
unused 8K source textures, reduces the mesh from 2,575,836 to 309,098 triangles,
rebuilds smooth normals, and uses decoder-free 16-bit mesh attributes.

Run these commands from the project folder:

```bash
npx @gltf-transform/cli unlit models/plakingforwebsite.glb models/plakingforwebsite-unlit.glb
npx @gltf-transform/cli prune models/plakingforwebsite-unlit.glb models/plakingforwebsite-geometry.glb
npx @gltf-transform/cli optimize models/plakingforwebsite-geometry.glb models/plakingforwebsite-reduced.glb --compress quantize --simplify true --simplify-ratio 0.12 --simplify-error 0.0025 --texture-compress false --palette false
python tools/finalize-pattern-glb.py
```

The first three files are temporary build intermediates and can be deleted
after `models/plakingforwebsite-web.glb` has been created.

## Project structure

```text
index.html
royal.html
hearth.html
foundry.html
css/
  styles.css
  site-pages.css
js/
  main.js
  king-scene.js
  materials.js
  intro-timeline.js
  loading.js
  animations.js
  site-pages.js
  collection-scene.js
models/
  king-right-natural.glb
  king.glb
  king-web.glb
  plakingforwebsite.glb
  plakingforwebsite-web.glb
images/
video/
tools/
  optimize-king-glb.py
  finalize-pattern-glb.py
vendor/
  gsap.min.js
  ScrollTrigger.min.js
```
