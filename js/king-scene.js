import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import {
  applyFireFrontState,
  applyPlaAssemblyState,
  applySequenceMaterialState,
  applyMaterialOpacity,
  createVertexPointOverlay,
  createWireframeOverlay,
  installNaturalCaptureMaterials,
  installPlaMaterials,
  installSequenceMaterials,
  smoothRange,
  updateNaturalCaptureState,
  updatePlaFireTime,
  updateVertexPointOverlay,
  updateWireframeOverlay,
} from "./materials.js?v=20260923-fire-wave";

const INK_COLOR = 0x080705;
const FRAME_PADDING = 0.09;
const DEFAULT_NATURAL_MODEL_URLS = ["./models/king-right-natural.glb"];
const DEFAULT_MODEL_URLS = ["./models/king-web.glb", "./models/king.glb"];
const DEFAULT_PATTERN_URLS = [
  "./models/plakingforwebsite-web.glb",
  "./models/plakingforwebsite.glb",
];
const PATTERN_UPRIGHT_ROTATION_Y = Math.PI;
const CLEAN_KING_UPRIGHT_ROTATION_X = Math.PI;
const LEFT_FACING_ROTATION_Y = Math.PI;
const NATURAL_HERO_ROTATION = new THREE.Euler(
  THREE.MathUtils.degToRad(26),
  THREE.MathUtils.degToRad(13),
  0,
);

function createFallbackMaterial() {
  return new THREE.MeshPhysicalMaterial({
    color: 0x63331e,
    metalness: 0.94,
    roughness: 0.31,
    clearcoat: 0.1,
    clearcoatRoughness: 0.42,
    envMapIntensity: 0.78,
  });
}

function createTube(points, radius, material) {
  const curve = new THREE.CatmullRomCurve3(
    points.map(([x, y, z]) => new THREE.Vector3(x, y, z)),
    false,
    "centripetal",
  );
  const mesh = new THREE.Mesh(
    new THREE.TubeGeometry(curve, 48, radius, 9, false),
    material,
  );
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function createAntlerFallback() {
  const antler = new THREE.Group();
  const material = createFallbackMaterial();
  const beam = [
    [-2.42, -0.86, 0.06],
    [-1.82, -0.59, 0.16],
    [-1.08, -0.28, 0.2],
    [-0.2, 0.04, 0.12],
    [0.72, 0.38, -0.02],
    [1.58, 0.74, -0.14],
    [2.28, 1.18, -0.2],
  ];
  const tines = [
    [[-1.84, -0.59, 0.14], [-1.92, 0.08, 0.12], [-2.05, 0.85, 0.04], [-2.2, 1.5, -0.04]],
    [[-1.06, -0.27, 0.19], [-0.96, 0.45, 0.24], [-0.97, 1.27, 0.18], [-1.1, 2.05, 0.06]],
    [[-0.21, 0.04, 0.12], [0, 0.78, 0.18], [0.12, 1.5, 0.1], [0.06, 2.27, -0.04]],
    [[0.72, 0.38, -0.02], [1.05, 1.05, 0], [1.3, 1.62, -0.08], [1.38, 2.2, -0.18]],
    [[1.57, 0.74, -0.14], [1.94, 1.23, -0.18], [2.25, 1.57, -0.24], [2.41, 1.98, -0.3]],
    [[-2.18, -0.73, 0.07], [-2.32, -1.08, 0.14], [-2.35, -1.48, 0.08]],
  ];

  antler.add(createTube(beam, 0.13, material));
  tines.forEach((points, index) => {
    antler.add(createTube(points, 0.1 - index * 0.005, material));
  });
  antler.rotation.set(-0.08, -0.34, -0.12);
  antler.userData.isFallback = true;
  return antler;
}

function createDustField() {
  const count = 58;
  const positions = new Float32Array(count * 3);

  for (let index = 0; index < count; index += 1) {
    positions[index * 3] = (Math.random() - 0.5) * 10;
    positions[index * 3 + 1] = (Math.random() - 0.5) * 7;
    positions[index * 3 + 2] = (Math.random() - 0.5) * 5 - 1;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  return new THREE.Points(
    geometry,
    new THREE.PointsMaterial({
      color: 0xd18a47,
      size: 0.013,
      transparent: true,
      opacity: 0.2,
      depthWrite: false,
    }),
  );
}

function createEmberField() {
  const count = 18;
  const positions = new Float32Array(count * 3);
  const phases = new Float32Array(count);
  const speeds = new Float32Array(count);
  const brightness = new Float32Array(count);

  for (let index = 0; index < count; index += 1) {
    const seed = Math.sin((index + 1) * 91.733) * 43758.5453;
    const random = seed - Math.floor(seed);
    positions[index * 3] = (random - 0.5) * 1.04;
    positions[index * 3 + 1] = -0.48 + ((index * 0.173) % 0.18);
    positions[index * 3 + 2] = -0.34 + ((index * 0.137) % 0.78);
    phases[index] = (index * 0.271 + random) % 1;
    speeds[index] = 0.7 + ((index * 0.193) % 0.7);
    brightness[index] = index % 11 === 0 ? 1 : 0.42 + ((index * 0.157) % 0.4);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("hbPhase", new THREE.BufferAttribute(phases, 1));
  geometry.setAttribute("hbSpeed", new THREE.BufferAttribute(speeds, 1));
  geometry.setAttribute("hbBrightness", new THREE.BufferAttribute(brightness, 1));
  const material = new THREE.ShaderMaterial({
    uniforms: {
      time: { value: 0 },
      intensity: { value: 0 },
    },
    vertexShader: `
      attribute float hbPhase;
      attribute float hbSpeed;
      attribute float hbBrightness;
      uniform float time;
      uniform float intensity;
      varying float vHbLife;
      varying float vHbBrightness;
      void main() {
        float life = fract(hbPhase + time * (0.12 + hbSpeed * 0.055));
        vec3 animated = position;
        animated.y += life * (0.72 + hbSpeed * 0.16);
        animated.x += sin(time * 1.6 + hbPhase * 19.0) * 0.025 * life;
        animated.z += cos(time * 1.1 + hbPhase * 13.0) * 0.018 * life;
        vec4 mvPosition = modelViewMatrix * vec4(animated, 1.0);
        gl_PointSize = (1.1 + hbSpeed * 0.85 + hbBrightness * 1.25) * intensity * (7.5 / max(-mvPosition.z, 0.1));
        gl_Position = projectionMatrix * mvPosition;
        vHbLife = life;
        vHbBrightness = hbBrightness;
      }
    `,
    fragmentShader: `
      uniform float intensity;
      varying float vHbLife;
      varying float vHbBrightness;
      void main() {
        float spark = 1.0 - smoothstep(0.08, 0.5, length(gl_PointCoord - 0.5));
        float lifeFade = smoothstep(0.0, 0.12, vHbLife) * (1.0 - smoothstep(0.52, 1.0, vHbLife));
        vec3 color = mix(vec3(0.95, 0.22, 0.025), vec3(1.0, 0.82, 0.38), vHbBrightness * (1.0 - vHbLife));
        gl_FragColor = vec4(color, spark * lifeFade * intensity * (0.5 + vHbBrightness * 0.42));
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const points = new THREE.Points(geometry, material);
  points.name = "Holy Buck — Foundry Embers";
  points.visible = false;
  points.renderOrder = 5;
  return { points, material };
}

function createFireWave() {
  const geometry = new THREE.PlaneGeometry(2.15, 0.74, 1, 1);
  const material = new THREE.ShaderMaterial({
    uniforms: {
      time: { value: 0 },
      intensity: { value: 0 },
    },
    vertexShader: `
      varying vec2 vHbUv;
      void main() {
        vHbUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform float time;
      uniform float intensity;
      varying vec2 vHbUv;

      float hbHash(vec2 p) {
        return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
      }
      float hbNoise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        return mix(
          mix(hbHash(i), hbHash(i + vec2(1.0, 0.0)), f.x),
          mix(hbHash(i + vec2(0.0, 1.0)), hbHash(i + vec2(1.0, 1.0)), f.x),
          f.y
        );
      }
      float hbFbm(vec2 p) {
        float value = hbNoise(p) * 0.55;
        value += hbNoise(p * 2.07 + 9.3) * 0.29;
        value += hbNoise(p * 4.13 + 17.1) * 0.16;
        return value;
      }

      void main() {
        float x = vHbUv.x;
        float y = vHbUv.y;
        float broad = hbFbm(vec2(x * 4.2 + time * 0.16, time * -0.82));
        float detail = hbFbm(vec2(x * 10.5 - time * 0.24, y * 5.4 - time * 1.48));
        float tongues = 0.34 + broad * 0.34 + pow(detail, 2.4) * 0.25;
        float lowerFade = smoothstep(0.08, 0.25 + (detail - 0.5) * 0.07, y);
        float body = (1.0 - smoothstep(tongues - 0.1, tongues + 0.055, y)) * lowerFade;
        float waveY = y - 0.3 + (broad - 0.5) * 0.22 + (detail - 0.5) * 0.07;
        float hotBand = 1.0 - smoothstep(0.025, 0.11 + detail * 0.07, abs(waveY));
        float hotPatch = smoothstep(0.46, 0.78, broad * 0.54 + detail * 0.46);
        float tornEdge = smoothstep(0.23, 0.67, broad + detail * 0.3);
        float flame = max(body * tornEdge, hotBand * (0.3 + hotPatch * 0.7));
        float horizontalFade = smoothstep(0.0, 0.08, x) * (1.0 - smoothstep(0.92, 1.0, x));
        float verticalFade = smoothstep(0.0, 0.08, y) * (1.0 - smoothstep(0.88, 1.0, y));
        flame *= horizontalFade * verticalFade * intensity;
        if (flame < 0.012) discard;

        float hotCore = hotBand * hotPatch;
        float heat = clamp(hotCore * 0.94 + flame * 0.68, 0.0, 1.0);
        vec3 deepRed = vec3(0.3, 0.008, 0.001);
        vec3 orange = vec3(1.0, 0.16, 0.006);
        vec3 amber = vec3(1.0, 0.52, 0.07);
        vec3 whiteHot = vec3(1.0, 0.9, 0.58);
        vec3 color = mix(deepRed, orange, smoothstep(0.08, 0.42, heat));
        color = mix(color, amber, smoothstep(0.4, 0.74, heat));
        color = mix(color, whiteHot, smoothstep(0.82, 1.0, heat) * hotPatch);
        float alpha = flame * mix(0.3, 0.84, heat);
        gl_FragColor = vec4(color, alpha);
      }
    `,
    transparent: true,
    depthWrite: false,
    depthTest: false,
    blending: THREE.AdditiveBlending,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = "Holy Buck — Rising Fire Front";
  mesh.position.z = 0.58;
  mesh.visible = false;
  mesh.renderOrder = 8;
  mesh.frustumCulled = false;
  return { mesh, material };
}


function createSmokeField() {
  const count = 4;
  const geometry = new THREE.SphereGeometry(0.24, 10, 7);
  const phases = new Float32Array(count);
  const drift = new Float32Array(count);
  const material = new THREE.ShaderMaterial({
    uniforms: {
      time: { value: 0 },
      intensity: { value: 0 },
    },
    vertexShader: `
      attribute float hbPhase;
      attribute float hbDrift;
      uniform float time;
      varying float vHbPhase;
      varying float vHbLife;
      varying vec3 vHbLocal;
      varying vec3 vHbViewNormal;
      varying vec3 vHbViewDirection;
      void main() {
        vHbPhase = hbPhase;
        float life = fract(hbPhase + time * (0.026 + hbDrift * 0.012));
        vHbLife = life;
        vHbLocal = position;
        vec3 animated = position;
        animated.x += sin(time * 0.42 + hbPhase * 11.0) * 0.08 * life;
        animated.z += cos(time * 0.33 + hbPhase * 7.0) * 0.055 * life;
        animated.y += life * (0.5 + hbDrift * 0.16);
        animated *= 0.78 + life * 0.52;
        #ifdef USE_INSTANCING
          animated = (instanceMatrix * vec4(animated, 1.0)).xyz;
        #endif
        vec4 mvPosition = modelViewMatrix * vec4(animated, 1.0);
        vec3 instanceNormal = normal;
        #ifdef USE_INSTANCING
          instanceNormal = mat3(instanceMatrix) * instanceNormal;
        #endif
        vHbViewNormal = normalize(normalMatrix * instanceNormal);
        vHbViewDirection = normalize(-mvPosition.xyz);
        gl_Position = projectionMatrix * mvPosition;
      }
    `,
    fragmentShader: `
      uniform float time;
      uniform float intensity;
      varying float vHbPhase;
      varying float vHbLife;
      varying vec3 vHbLocal;
      varying vec3 vHbViewNormal;
      varying vec3 vHbViewDirection;
      float hbSmokeHash(vec3 p) {
        return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453);
      }
      float hbSmokeNoise(vec3 p) {
        vec3 i = floor(p);
        vec3 f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        return mix(
          mix(mix(hbSmokeHash(i), hbSmokeHash(i + vec3(1,0,0)), f.x), mix(hbSmokeHash(i + vec3(0,1,0)), hbSmokeHash(i + vec3(1,1,0)), f.x), f.y),
          mix(mix(hbSmokeHash(i + vec3(0,0,1)), hbSmokeHash(i + vec3(1,0,1)), f.x), mix(hbSmokeHash(i + vec3(0,1,1)), hbSmokeHash(i + vec3(1,1,1)), f.x), f.y),
          f.z
        );
      }
      void main() {
        float noise = hbSmokeNoise(vHbLocal * 10.0 + vec3(vHbPhase * 9.0, -time * 0.22, time * 0.1));
        float facing = max(dot(normalize(vHbViewNormal), normalize(vHbViewDirection)), 0.0);
        float edgeFade = smoothstep(0.02, 0.72, facing);
        float lifeFade = smoothstep(0.0, 0.13, vHbLife) * (1.0 - smoothstep(0.64, 1.0, vHbLife));
        float density = smoothstep(0.28, 0.76, noise) * edgeFade * lifeFade;
        vec3 sourceWarmth = vec3(0.23, 0.064, 0.012);
        vec3 upperSmoke = vec3(0.034, 0.028, 0.024);
        vec3 smoke = mix(sourceWarmth, upperSmoke, smoothstep(0.05, 0.72, vHbLife));
        gl_FragColor = vec4(smoke, density * intensity * 0.68);
      }
    `,
    transparent: true,
    depthWrite: false,
    depthTest: false,
    side: THREE.FrontSide,
  });
  geometry.setAttribute("hbPhase", new THREE.InstancedBufferAttribute(phases, 1));
  geometry.setAttribute("hbDrift", new THREE.InstancedBufferAttribute(drift, 1));
  const mesh = new THREE.InstancedMesh(geometry, material, count);
  const matrix = new THREE.Matrix4();
  const position = new THREE.Vector3();
  const rotation = new THREE.Quaternion();
  const scale = new THREE.Vector3();
  for (let index = 0; index < count; index += 1) {
    const seedA = Math.sin((index + 3) * 45.233) * 27341.177;
    const seedB = Math.sin((index + 9) * 83.119) * 19341.731;
    const randomA = seedA - Math.floor(seedA);
    const randomB = seedB - Math.floor(seedB);
    phases[index] = (index * 0.239 + randomA * 0.21) % 1;
    drift[index] = 0.45 + randomB * 0.55;
    position.set(-0.53 + (index / (count - 1)) * 1.06, -0.35 + randomA * 0.09, -0.42 + randomB * 0.82);
    rotation.setFromEuler(new THREE.Euler(randomA * 0.4, randomB * Math.PI, randomB * 0.3));
    scale.set(0.86 + randomA * 0.58, 1.12 + randomB * 0.75, 0.8 + randomB * 0.52);
    matrix.compose(position, rotation, scale);
    mesh.setMatrixAt(index, matrix);
  }
  geometry.getAttribute("hbPhase").needsUpdate = true;
  geometry.getAttribute("hbDrift").needsUpdate = true;
  mesh.name = "Holy Buck — Burnout Haze";
  mesh.visible = false;
  mesh.renderOrder = 6;
  mesh.frustumCulled = false;
  return { mesh, material };
}

function createScanAssembly() {
  const group = new THREE.Group();
  const planeMaterial = new THREE.MeshBasicMaterial({
    color: 0xc7ad85,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const lineMaterial = new THREE.MeshBasicMaterial({
    color: 0xf2d5a8,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const plane = new THREE.Mesh(new THREE.PlaneGeometry(0.08, 0.78), planeMaterial);
  const line = new THREE.Mesh(new THREE.PlaneGeometry(0.006, 0.82), lineMaterial);

  group.add(plane, line);
  group.position.x = -0.72;
  group.position.z = 0.62;
  group.visible = false;
  plane.renderOrder = 3;
  line.renderOrder = 4;
  return { group, planeMaterial, lineMaterial };
}

function normalizeObject(object, precise = false) {
  object.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(object, precise);
  if (bounds.isEmpty()) throw new Error("The GLB contains no visible geometry.");

  const size = bounds.getSize(new THREE.Vector3());
  const center = bounds.getCenter(new THREE.Vector3());
  const largestDimension = Math.max(size.x, size.y, size.z);
  const normalizedRoot = new THREE.Group();

  object.position.sub(center);
  normalizedRoot.scale.setScalar(1 / Math.max(largestDimension, 0.001));
  normalizedRoot.add(object);
  normalizedRoot.updateMatrixWorld(true);

  return {
    root: normalizedRoot,
    size: size.multiplyScalar(1 / Math.max(largestDimension, 0.001)),
  };
}

function getProjectedScreenBounds(object, camera) {
  object.updateWorldMatrix(true, true);
  camera.updateMatrixWorld(true);

  const bounds = new THREE.Box3().setFromObject(object, true);
  if (bounds.isEmpty()) return null;

  const { min, max } = bounds;
  const corners = [
    [min.x, min.y, min.z],
    [min.x, min.y, max.z],
    [min.x, max.y, min.z],
    [min.x, max.y, max.z],
    [max.x, min.y, min.z],
    [max.x, min.y, max.z],
    [max.x, max.y, min.z],
    [max.x, max.y, max.z],
  ];
  const projected = new THREE.Vector3();
  const screen = { left: Infinity, right: -Infinity, top: Infinity, bottom: -Infinity };

  corners.forEach(([x, y, z]) => {
    projected.set(x, y, z).project(camera);
    const screenX = (projected.x + 1) * 0.5;
    const screenY = (1 - projected.y) * 0.5;
    screen.left = Math.min(screen.left, screenX);
    screen.right = Math.max(screen.right, screenX);
    screen.top = Math.min(screen.top, screenY);
    screen.bottom = Math.max(screen.bottom, screenY);
  });

  screen.width = screen.right - screen.left;
  screen.height = screen.bottom - screen.top;
  return screen;
}

function getSafeScreenBounds(isMobile, isTablet) {
  if (isMobile) return { left: 0.06, right: 0.94, top: 0.25, bottom: 0.75 };
  if (isTablet) return { left: 0.12, right: 0.88, top: 0.16, bottom: 0.84 };
  return { left: 0.2, right: 0.8, top: 0.15, bottom: 0.85 };
}

function serializeScreenBounds(bounds) {
  if (!bounds) return "unavailable";
  return [bounds.left, bounds.right, bounds.top, bounds.bottom]
    .map((value) => value.toFixed(4))
    .join(",");
}

function prepareMaterialFade(object) {
  const seen = new Set();
  const states = [];
  object.traverse((child) => {
    const materials = Array.isArray(child.material) ? child.material : [child.material];
    materials.filter(Boolean).forEach((material) => {
      if (seen.has(material)) return;
      seen.add(material);
      states.push({
        material,
        targetOpacity: material.opacity,
        transparent: material.transparent,
        depthWrite: material.depthWrite,
      });
      material.transparent = true;
      material.depthWrite = false;
      material.opacity = 0;
      material.needsUpdate = true;
    });
  });
  return states;
}

function finishMaterialFade(states) {
  states.forEach(({ material, targetOpacity, transparent, depthWrite }) => {
    material.opacity = targetOpacity;
    material.transparent = transparent;
    material.depthWrite = depthWrite;
    material.needsUpdate = true;
  });
}

function disposeObject(object) {
  const geometries = new Set();
  const materials = new Set();
  const textures = new Set();

  object.traverse((child) => {
    if (child.geometry) geometries.add(child.geometry);
    const childMaterials = Array.isArray(child.material) ? child.material : [child.material];
    childMaterials.filter(Boolean).forEach((material) => materials.add(material));
  });

  materials.forEach((material) => {
    Object.values(material).forEach((value) => {
      if (value?.isTexture) textures.add(value);
    });
    material.dispose();
  });
  textures.forEach((texture) => texture.dispose());
  geometries.forEach((geometry) => geometry.dispose());
}

function loadGLTF(loader, url, onProgress) {
  return new Promise((resolve, reject) => {
    loader.load(url, resolve, onProgress, reject);
  });
}

export function initKingScene(container, options = {}) {
  if (!container) throw new Error("The King scene requires a container element.");

  const {
    naturalModelUrls = DEFAULT_NATURAL_MODEL_URLS,
    modelUrls = DEFAULT_MODEL_URLS,
    onModelState = () => {},
    onLoadProgress = () => {},
  } = options;
  const castingPatternUrls = options.castingPatternUrls ??
    (options.castingPatternUrl ? [options.castingPatternUrl] : DEFAULT_PATTERN_URLS);
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const initializationStartedAt = performance.now();

  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(INK_COLOR, 0.055);
  const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 100);
  camera.position.set(0, 0.1, 8.8);

  const renderer = new THREE.WebGLRenderer({
    alpha: true,
    antialias: true,
    powerPreference: "high-performance",
  });
  renderer.setClearColor(INK_COLOR, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.08;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.shadowMap.autoUpdate = false;
  container.appendChild(renderer.domElement);

  const roomEnvironment = new RoomEnvironment();
  const pmremGenerator = new THREE.PMREMGenerator(renderer);
  const environmentTarget = pmremGenerator.fromScene(roomEnvironment, 0.04);
  scene.environment = environmentTarget.texture;
  scene.environmentIntensity = 0.52;
  roomEnvironment.dispose();
  pmremGenerator.dispose();

  const stage = new THREE.Group();
  const sequenceRig = new THREE.Group();
  const product = new THREE.Group();
  const fallbackFacing = new THREE.Group();
  fallbackFacing.rotation.y = LEFT_FACING_ROTATION_Y;
  fallbackFacing.add(createAntlerFallback());
  const fallback = normalizeObject(fallbackFacing, true);
  const fallbackFadeStates = prepareMaterialFade(fallback.root);
  let kingRoot = fallback.root;
  let naturalRoot = fallback.root;
  let bronzeRoot = null;
  let kingSize = fallback.size;
  let kingVisualSize = new THREE.Box3()
    .setFromObject(fallback.root, true)
    .getSize(new THREE.Vector3());
  let kingVisualCenter = new THREE.Box3()
    .setFromObject(fallback.root, true)
    .getCenter(new THREE.Vector3());
  let naturalMaterialHandles = [];
  let bronzeMaterialHandles = [];
  let wireframeMaterial = null;
  let vertexPointMaterial = null;
  let patternRoot = null;
  let patternMaterialHandles = [];
  let patternAvailability = 0;
  let patternRevealStartedAt = 0;
  let patternLoadedModelUrl = null;
  let patternResult = "idle";
  let patternFrameScale = 1;
  let loadedModelUrl = null;
  let bronzeLoadedModelUrl = null;
  let modelResult = "fallback";

  fallback.root.visible = false;
  product.add(fallback.root);
  sequenceRig.add(product);
  stage.add(sequenceRig);
  scene.add(stage);

  const scan = createScanAssembly();
  product.add(scan.group);

  const shadowCatcher = new THREE.Mesh(
    new THREE.PlaneGeometry(4, 4),
    new THREE.ShadowMaterial({ color: 0x000000, opacity: 0.42 }),
  );
  shadowCatcher.rotation.x = -Math.PI / 2;
  shadowCatcher.position.y = -0.62;
  shadowCatcher.receiveShadow = true;
  sequenceRig.add(shadowCatcher);
  const shadowFadeStates = prepareMaterialFade(shadowCatcher);

  const dust = createDustField();
  scene.add(dust);
  const embers = createEmberField();
  product.add(embers.points);
  const fireWave = createFireWave();
  const smoke = createSmokeField();
  product.add(smoke.mesh, fireWave.mesh);

  const ambient = new THREE.AmbientLight(0x211d19, 0.48);
  const hemisphere = new THREE.HemisphereLight(0xd8d0c3, 0x030303, 0.58);
  const key = new THREE.SpotLight(0xffeed8, 165, 24, Math.PI / 5.5, 0.48, 1.35);
  const rim = new THREE.SpotLight(0x74584d, 32, 22, Math.PI / 4, 0.65, 1.5);
  const fill = new THREE.RectAreaLight(0xfff0df, 1.35, 3.5, 4.5);
  const castGlow = new THREE.PointLight(0xd96418, 0, 5, 1.5);
  const fireFill = new THREE.PointLight(0xff9a35, 0, 4.2, 1.75);

  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.camera.near = 0.5;
  key.shadow.camera.far = 24;
  key.shadow.bias = -0.00035;
  key.shadow.normalBias = 0.025;
  scene.add(ambient, hemisphere, key, key.target, rim, rim.target, fill);
  sequenceRig.add(castGlow, fireFill);

  const pointerTarget = new THREE.Vector2();
  const pointerCurrent = new THREE.Vector2();
  const boneKeyColor = new THREE.Color(0xffead0);
  const captureKeyColor = new THREE.Color(0xc9c5bb);
  const bronzeKeyColor = new THREE.Color(0xe6a369);
  const boneRimColor = new THREE.Color(0x78665b);
  const captureRimColor = new THREE.Color(0x69655f);
  const bronzeRimColor = new THREE.Color(0xb66f3d);
  const workingKeyColor = new THREE.Color();
  const workingRimColor = new THREE.Color();
  let sequenceProgress = 0;
  let sequenceTarget = 0;
  let presentation = "intro";
  let scrollProgress = 0;
  let forgeStrength = 0;
  let emberStrength = 0;
  let smokeStrength = 0;
  let fireTime = 0;
  let fireFrontY = -0.62;
  let fireFrontProgress = 0;
  let fireWaveStrength = 0;
  let keyTargetIntensity = key.intensity;
  let rimTargetIntensity = rim.intensity;
  let fillTargetIntensity = fill.intensity;
  let animationFrame = 0;
  let activeFade = null;
  let resizePending = true;
  let lastWidth = 0;
  let lastHeight = 0;
  let lastRenderTime = 0;
  let lastShadowTime = 0;
  let isMobile = false;
  let destroyed = false;
  let renderEnabled = true;
  let optionalLoadScheduled = false;
  let optionalIdleId = 0;
  let performanceWindowStartedAt = performance.now();
  let performanceFrameCount = 0;
  let performanceMaxFrameMs = 0;

  const compileScene = () => {
    const effectObjects = [fireWave.mesh, smoke.mesh, embers.points];
    const visibility = effectObjects.map((object) => object.visible);
    effectObjects.forEach((object) => { object.visible = true; });
    renderer.compile(scene, camera);
    effectObjects.forEach((object, index) => { object.visible = visibility[index]; });
  };

  const applyResponsiveLayout = () => {
    const width = Math.max(container.clientWidth, 1);
    const height = Math.max(container.clientHeight, 1);
    if (width === lastWidth && height === lastHeight) return;

    lastWidth = width;
    lastHeight = height;
    isMobile = width <= 640;
    const isTablet = width <= 900;
    const pixelRatioCap = isMobile ? 1.25 : 1.5;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, pixelRatioCap));
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height, false);
    container.dataset.pixelRatio = renderer.getPixelRatio().toFixed(2);
    container.dataset.viewportMode = isMobile ? "mobile" : isTablet ? "tablet" : "desktop";

    const shadowSize = isMobile ? 512 : 1024;
    if (key.shadow.mapSize.x !== shadowSize) {
      key.shadow.map?.dispose();
      key.shadow.map = null;
      key.shadow.mapSize.set(shadowSize, shadowSize);
    }
    container.dataset.shadowMapSize = String(shadowSize);

    const verticalFov = THREE.MathUtils.degToRad(camera.fov);
    const visibleHeight = 2 * Math.tan(verticalFov / 2) * camera.position.z;
    const visibleWidth = visibleHeight * camera.aspect;
    const safeBounds = presentation === "showcase"
      ? (isMobile
        ? { left: 0.06, right: 0.94, top: 0.12, bottom: 0.48 }
        : { left: 0.37, right: 0.97, top: 0.16, bottom: 0.84 })
      : getSafeScreenBounds(isMobile, isTablet);
    const framingRoot = presentation === "showcase" ? bronzeRoot : kingRoot;
    const safeWidth = safeBounds.right - safeBounds.left;
    const safeHeight = safeBounds.bottom - safeBounds.top;
    const framedWidth = safeWidth * (1 - FRAME_PADDING);
    const framedHeight = safeHeight * (1 - FRAME_PADDING);
    const targetCenterX = (safeBounds.left + safeBounds.right) * 0.5;
    const targetCenterY = (safeBounds.top + safeBounds.bottom) * 0.5;
    const fittedScale = Math.min(
      (visibleWidth * framedWidth) / Math.max(kingSize.x, 0.001),
      (visibleHeight * framedHeight) / Math.max(kingSize.y, 0.001),
    );

    const productPosition = product.position.clone();
    const productRotation = product.rotation.clone();
    const rigPosition = sequenceRig.position.clone();
    const rigRotation = sequenceRig.rotation.clone();
    const rigScale = sequenceRig.scale.clone();
    product.position.set(0, 0, 0);
    product.rotation.set(0, 0, 0);
    sequenceRig.position.set(0, 0, 0);
    sequenceRig.rotation.set(0, 0, 0);
    sequenceRig.scale.setScalar(1);
    stage.position.set(
      (targetCenterX - 0.5) * visibleWidth,
      (0.5 - targetCenterY) * visibleHeight,
      0,
    );
    stage.scale.setScalar(fittedScale);

    for (let pass = 0; pass < 3; pass += 1) {
      stage.updateWorldMatrix(true, true);
      const projectedBounds = getProjectedScreenBounds(framingRoot, camera);
      if (!projectedBounds) break;

      const fitCorrection = Math.min(
        framedWidth / Math.max(projectedBounds.width, 0.0001),
        framedHeight / Math.max(projectedBounds.height, 0.0001),
        1,
      );
      stage.scale.multiplyScalar(fitCorrection * (fitCorrection < 1 ? 0.995 : 1));
      const currentCenterX = (projectedBounds.left + projectedBounds.right) * 0.5;
      const currentCenterY = (projectedBounds.top + projectedBounds.bottom) * 0.5;
      stage.position.x += (targetCenterX - currentCenterX) * visibleWidth;
      stage.position.y -= (targetCenterY - currentCenterY) * visibleHeight;
    }

    stage.updateWorldMatrix(true, true);
    const framedBounds = getProjectedScreenBounds(framingRoot, camera);
    product.position.copy(productPosition);
    product.rotation.copy(productRotation);
    sequenceRig.position.copy(rigPosition);
    sequenceRig.rotation.copy(rigRotation);
    sequenceRig.scale.copy(rigScale);
    stage.updateWorldMatrix(true, true);

    container.dataset.safeScreenBounds = serializeScreenBounds(safeBounds);
    container.dataset.kingScreenBounds = serializeScreenBounds(framedBounds);
    container.dataset.kingWithinSafeBounds = String(
      Boolean(
        framedBounds &&
          framedBounds.left >= safeBounds.left &&
          framedBounds.right <= safeBounds.right &&
          framedBounds.top >= safeBounds.top &&
          framedBounds.bottom <= safeBounds.bottom,
      ),
    );
    container.dataset.framingMargin = `${Math.round(FRAME_PADDING * 100)}%`;
    key.position.set(stage.position.x + 3.8, stage.position.y + 4.6, 5.8);
    key.target.position.copy(stage.position);
    rim.position.set(stage.position.x - 3.7, stage.position.y + 1.1, -4.6);
    rim.target.position.copy(stage.position);
    fill.position.set(stage.position.x - 2.5, stage.position.y + 1.8, 4.2);
    fill.lookAt(stage.position);
    dust.visible = !isMobile;
    if (patternRoot) updatePatternFrameScale();
    renderer.shadowMap.needsUpdate = true;
  };

  const updatePatternFrameScale = () => {
    if (!patternRoot) {
      patternFrameScale = 1;
      return;
    }

    const isTablet = lastWidth <= 900;
    const safeBounds = getSafeScreenBounds(isMobile, isTablet);
    const previousRigScale = sequenceRig.scale.clone();
    sequenceRig.scale.setScalar(1);
    stage.updateWorldMatrix(true, true);
    const projectedBounds = getProjectedScreenBounds(patternRoot, camera);
    sequenceRig.scale.copy(previousRigScale);
    stage.updateWorldMatrix(true, true);

    if (!projectedBounds) {
      patternFrameScale = 1;
      return;
    }

    patternFrameScale = Math.min(
      1,
      ((safeBounds.right - safeBounds.left) * (1 - FRAME_PADDING)) /
        Math.max(projectedBounds.width, 0.0001),
      ((safeBounds.bottom - safeBounds.top) * (1 - FRAME_PADDING)) /
        Math.max(projectedBounds.height, 0.0001),
    );
    container.dataset.patternFrameScale = patternFrameScale.toFixed(4);
    container.dataset.patternScreenBounds = serializeScreenBounds(projectedBounds);
    container.dataset.patternWithinSafeBounds = String(
      projectedBounds.left >= safeBounds.left &&
        projectedBounds.right <= safeBounds.right &&
        projectedBounds.top >= safeBounds.top &&
        projectedBounds.bottom <= safeBounds.bottom,
    );
  };

  const updateSequence = (progress) => {
    sequenceProgress = THREE.MathUtils.clamp(progress, 0, 1);
    container.dataset.sequenceProgress = sequenceProgress.toFixed(3);
    if (naturalMaterialHandles.length) {
      updateNaturalCaptureState(naturalMaterialHandles, sequenceProgress);
    }
    fireFrontProgress = smoothRange(sequenceProgress, 0.53, 0.79);
    if (bronzeMaterialHandles.length) {
      const bronzeMaterialProgress =
        sequenceProgress >= 0.52 && sequenceProgress < 0.86 ? 0.86 : sequenceProgress;
      applySequenceMaterialState(bronzeMaterialHandles, bronzeMaterialProgress);
      applyFireFrontState(bronzeMaterialHandles, fireFrontProgress, fireTime);
    }

    const scanPhase = smoothRange(sequenceProgress, 0.15, 0.34);
    const scanStrength =
      smoothRange(sequenceProgress, 0.14, 0.18) *
      (1 - smoothRange(sequenceProgress, 0.37, 0.415));
    scan.group.visible = scanStrength > 0.002;
    scan.group.position.x = THREE.MathUtils.lerp(-0.56, 0.56, scanPhase);
    scan.planeMaterial.opacity = scanStrength * 0.022;
    scan.lineMaterial.opacity = scanStrength * 0.42;
    updateWireframeOverlay(wireframeMaterial, sequenceProgress);
    updateVertexPointOverlay(vertexPointMaterial, sequenceProgress);

    const captureStrength =
      smoothRange(sequenceProgress, 0.14, 0.24) *
      (1 - smoothRange(sequenceProgress, 0.39, 0.48));
    const fireRise = smoothRange(sequenceProgress, 0.52, 0.625);
    const fireRecession = smoothRange(sequenceProgress, 0.775, 0.87);
    const fireStrength = fireRise * (1 - fireRecession);
    fireWaveStrength =
      smoothRange(sequenceProgress, 0.525, 0.555) *
      (1 - smoothRange(sequenceProgress, 0.785, 0.825));
    fireFrontY = THREE.MathUtils.lerp(-0.62, 0.62, fireFrontProgress);
    fireWave.mesh.position.y = fireFrontY + 0.01;
    fireWave.material.uniforms.intensity.value = fireWaveStrength;
    fireWave.mesh.visible = fireWaveStrength > 0.002;
    smoke.mesh.position.y = fireFrontY + 0.34;
    embers.points.position.y = fireFrontY + 0.43;
    const bronzeEdge = smoothRange(sequenceProgress, 0.61, 0.72);
    const bronzeSurface = smoothRange(sequenceProgress, 0.66, 0.82);
    const finalDarkness = smoothRange(sequenceProgress, 0.957, 0.985);
    const darkness = THREE.MathUtils.clamp(
      finalDarkness * 0.98,
      0,
      0.96,
    );

    ambient.intensity =
      THREE.MathUtils.lerp(0.34, 0.09, captureStrength) * (1 - darkness) +
      bronzeSurface * 0.08;
    hemisphere.intensity =
      THREE.MathUtils.lerp(0.38, 0.12, captureStrength) * (1 - darkness) +
      bronzeSurface * 0.07;
    keyTargetIntensity =
      THREE.MathUtils.lerp(125, 45, captureStrength) * (1 - darkness) +
      bronzeSurface * 178 + fireStrength * 38;
    key.intensity = keyTargetIntensity;
    rimTargetIntensity =
      THREE.MathUtils.lerp(24, 62, captureStrength) * (1 - darkness) + bronzeEdge * 158;
    rim.intensity = rimTargetIntensity;
    fillTargetIntensity =
      THREE.MathUtils.lerp(0.85, 0.22, captureStrength) * (1 - darkness) +
      bronzeSurface * 1.1;
    fill.intensity = fillTargetIntensity;
    workingKeyColor.lerpColors(boneKeyColor, captureKeyColor, captureStrength);
    workingKeyColor.lerp(bronzeKeyColor, bronzeSurface);
    key.color.copy(workingKeyColor);
    workingRimColor.lerpColors(boneRimColor, captureRimColor, captureStrength);
    workingRimColor.lerp(bronzeRimColor, bronzeEdge);
    rim.color.copy(workingRimColor);
    scene.environmentIntensity =
      THREE.MathUtils.lerp(0.5, 0.4, darkness) + bronzeSurface * 0.05;
    renderer.toneMappingExposure = 0.91 - finalDarkness * 0.14 + bronzeSurface * 0.1;

    forgeStrength = fireStrength * (1 - finalDarkness) * 0.72;
    emberStrength =
      smoothRange(sequenceProgress, 0.54, 0.63) *
      (1 - smoothRange(sequenceProgress, 0.84, 0.92));
    smokeStrength =
      smoothRange(sequenceProgress, 0.535, 0.66) *
      (1 - smoothRange(sequenceProgress, 0.84, 0.915));
    castGlow.intensity = forgeStrength * 11.5;
    fireFill.intensity = forgeStrength * 6.8;
    smoke.material.uniforms.intensity.value = smokeStrength * fireWaveStrength * (isMobile ? 0.42 : 0.58);
    embers.material.uniforms.intensity.value = emberStrength * fireWaveStrength * (isMobile ? 0.46 : 0.62);
    smoke.mesh.visible = smokeStrength > 0.015;
    embers.points.visible = emberStrength > 0.002;
    dust.material.opacity = 0.16 * (1 - finalDarkness * 0.96);

    const travel = sequenceProgress * Math.PI;
    sequenceRig.rotation.y = Math.sin(travel * 1.18) * 0.014 - sequenceProgress * 0.006;
    sequenceRig.rotation.x = Math.sin(travel * 0.72) * 0.006;
    sequenceRig.rotation.z = Math.sin(travel * 1.55) * 0.004;
    sequenceRig.position.x = Math.sin(travel * 0.82) * 0.012;
    sequenceRig.position.y = Math.sin(travel * 0.64) * 0.008;
    sequenceRig.position.z = Math.sin(travel * 1.1) * 0.012;
    const formedFrameStrength =
      smoothRange(sequenceProgress, 0.36, 0.5) *
      (1 - smoothRange(sequenceProgress, 0.78, 0.87));
    sequenceRig.scale.setScalar(
      THREE.MathUtils.lerp(1, patternFrameScale, formedFrameStrength),
    );

    const naturalOpacity = 1 - smoothRange(sequenceProgress, 0.385, 0.445);
    if (naturalMaterialHandles.length) applyMaterialOpacity(naturalMaterialHandles, naturalOpacity);
    naturalRoot.visible = naturalOpacity > 0.002;

    const bronzeReturn = smoothRange(sequenceProgress, 0.52, 0.55) *
      (1 - smoothRange(sequenceProgress, 0.957, 0.985));
    if (bronzeRoot) {
      applyMaterialOpacity(bronzeMaterialHandles, bronzeReturn);
      bronzeRoot.visible = bronzeReturn > 0.002;
    }

    if (patternRoot) {
      const assemblyProgress = smoothRange(sequenceProgress, 0.38, 0.56);
      const burnoutProgress = fireFrontProgress;
      const targetPatternOpacity =
        smoothRange(sequenceProgress, 0.375, 0.43) *
        (1 - smoothRange(sequenceProgress, 0.785, 0.805));
      const patternOpacity = targetPatternOpacity * patternAvailability;
      applyMaterialOpacity(patternMaterialHandles, patternOpacity);
      applyPlaAssemblyState(patternMaterialHandles, assemblyProgress, burnoutProgress);
      patternRoot.visible = patternOpacity > 0.002;
    }

  };

  const updateFade = (now) => {
    if (!activeFade) return;
    const progress = THREE.MathUtils.clamp(
      (now - activeFade.startTime) / activeFade.duration,
      0,
      1,
    );
    const eased = progress * progress * (3 - 2 * progress);
    activeFade.states.forEach(({ material, targetOpacity }) => {
      material.opacity = targetOpacity * eased;
    });
    if (progress < 1) return;

    finishMaterialFade(activeFade.states);
    const resolve = activeFade.resolve;
    activeFade = null;
    resolve();
  };

  const render = (now) => {
    animationFrame = 0;
    if (destroyed || document.hidden || !renderEnabled) return;

    const delta = lastRenderTime
      ? Math.min(Math.max((now - lastRenderTime) / 1000, 0), 0.05)
      : 0;
    lastRenderTime = now;

    if (resizePending) {
      resizePending = false;
      applyResponsiveLayout();
    }

    updateFade(now);
    if (presentation === "intro" && sequenceProgress !== sequenceTarget) {
      // Short, time-based interpolation only in the capture range; never wheel inertia.
      const next = sequenceProgress + (sequenceTarget - sequenceProgress) * (1 - Math.exp(-45 * delta));
      updateSequence(Math.abs(next - sequenceTarget) < 0.00005 ? sequenceTarget : next);
    }
    if (patternRoot && patternAvailability < 1 && patternRevealStartedAt) {
      const progress = THREE.MathUtils.clamp((now - patternRevealStartedAt) / 680, 0, 1);
      patternAvailability = progress * progress * (3 - 2 * progress);
      updateSequence(sequenceProgress);
    }
    const elapsed = now / 1000;
    if (!reducedMotion) fireTime += delta;
    const stillness = THREE.MathUtils.lerp(1, 0.25, smoothRange(sequenceProgress, 0.76, 0.9));
    if (!reducedMotion) {
      const pointerDamping = 1 - Math.exp(-7.5 * delta);
      pointerCurrent.lerp(pointerTarget, pointerDamping);
      product.rotation.y =
        (pointerCurrent.x * 0.018 + Math.sin(elapsed * 0.19) * 0.011) * stillness;
      product.rotation.x =
        (pointerCurrent.y * 0.009 + Math.sin(elapsed * 0.14) * 0.004) * stillness;
      product.rotation.z = Math.sin(elapsed * 0.16) * 0.0025 * stillness;
      product.position.x = pointerCurrent.x * 0.01 * stillness;
      product.position.y =
        Math.sin(elapsed * 0.38) * 0.026 * stillness - scrollProgress * 0.06;
      dust.rotation.y = elapsed * 0.012;

    }

    fireWave.material.uniforms.time.value = fireTime;
    smoke.material.uniforms.time.value = fireTime;
    embers.material.uniforms.time.value = fireTime;
    if (bronzeRoot?.visible) {
      applyFireFrontState(bronzeMaterialHandles, fireFrontProgress, fireTime);
    }
    if (patternRoot?.visible) updatePlaFireTime(patternMaterialHandles, fireTime);
    const fireFlicker = 0.92 + Math.sin(fireTime * 9.3) * 0.045 + Math.sin(fireTime * 16.7) * 0.025;
    castGlow.intensity = forgeStrength * 11.5 * fireFlicker;
    fireFill.intensity = forgeStrength * 6.8 * (1.02 - (fireFlicker - 0.92));
    castGlow.position.x = -0.28 + Math.sin(fireTime * 1.35) * 0.11;
    castGlow.position.y = fireFrontY - 0.12 + Math.sin(fireTime * 2.1) * 0.025;
    castGlow.position.z = 0.34;
    fireFill.position.x = 0.3 + Math.sin(fireTime * 1.08 + 1.7) * 0.1;
    fireFill.position.y = fireFrontY - 0.16 + Math.sin(fireTime * 1.82 + 0.8) * 0.02;
    fireFill.position.z = -0.08;
    key.intensity = keyTargetIntensity * (1 + forgeStrength * (fireFlicker - 0.92) * 0.22);
    rim.intensity = rimTargetIntensity * (1 + forgeStrength * Math.sin(fireTime * 5.1 + 0.7) * 0.018);
    fill.intensity = fillTargetIntensity * (1 + forgeStrength * Math.sin(fireTime * 4.4 + 2.1) * 0.035);

    const shadowInterval = isMobile ? 420 : 240;
    if (now - lastShadowTime >= shadowInterval) {
      renderer.shadowMap.needsUpdate = true;
      lastShadowTime = now;
    }
    renderer.render(scene, camera);
    if (delta > 0) {
      performanceFrameCount += 1;
      performanceMaxFrameMs = Math.max(performanceMaxFrameMs, delta * 1000);
    }
    const performanceWindowMs = now - performanceWindowStartedAt;
    if (performanceWindowMs >= 1000) {
      container.dataset.averageFps = (
        (performanceFrameCount * 1000) / Math.max(performanceWindowMs, 1)
      ).toFixed(1);
      container.dataset.maxFrameMs = performanceMaxFrameMs.toFixed(1);
      container.dataset.drawCalls = String(renderer.info.render.calls);
      container.dataset.triangles = String(renderer.info.render.triangles);
      performanceWindowStartedAt = now;
      performanceFrameCount = 0;
      performanceMaxFrameMs = 0;
    }
    animationFrame = requestAnimationFrame(render);
  };

  const ensureRenderLoop = () => {
    if (!animationFrame && !destroyed && !document.hidden && renderEnabled) {
      animationFrame = requestAnimationFrame(render);
    }
  };

  const revealMaterials = (states, duration = 700) => {
    if (reducedMotion) {
      finishMaterialFade(states);
      return Promise.resolve();
    }
    return new Promise((resolve) => {
      activeFade = { states, duration, startTime: performance.now(), resolve };
      ensureRenderLoop();
    });
  };

  const onPointerMove = (event) => {
    if (event.pointerType === "touch") return;
    const bounds = container.getBoundingClientRect();
    pointerTarget.x = ((event.clientX - bounds.left) / bounds.width - 0.5) * 2;
    pointerTarget.y = ((event.clientY - bounds.top) / bounds.height - 0.5) * 2;
  };
  const onPointerLeave = () => pointerTarget.set(0, 0);
  const onVisibilityChange = () => {
    if (document.hidden) {
      if (activeFade) activeFade.pausedAt = performance.now();
      cancelAnimationFrame(animationFrame);
      animationFrame = 0;
    } else if (renderEnabled) {
      if (activeFade?.pausedAt) {
        activeFade.startTime += performance.now() - activeFade.pausedAt;
        activeFade.pausedAt = 0;
      }
      ensureRenderLoop();
    }
  };

  const resizeObserver = new ResizeObserver(() => {
    resizePending = true;
    ensureRenderLoop();
  });
  resizeObserver.observe(container);
  container.addEventListener("pointermove", onPointerMove, { passive: true });
  container.addEventListener("pointerleave", onPointerLeave);
  document.addEventListener("visibilitychange", onVisibilityChange);
  applyResponsiveLayout();
  updateSequence(0);
  ensureRenderLoop();

  const loader = new GLTFLoader();
  let productionFadeStates = [];
  const loadingFractions = new Map([["Natural King", 0], ["Bronze King", 0]]);
  const reportAssetProgress = (label, fraction) => {
    loadingFractions.set(label, fraction);
    onLoadProgress([...loadingFractions.values()].reduce((sum, value) => sum + value, 0) / loadingFractions.size);
  };
  const loadFirstAvailableModel = async (urls, label) => {
    const errors = [];
    for (const url of urls) {
      try {
        const gltf = await loadGLTF(loader, url, (event) => {
          if (event.lengthComputable && event.total > 0) {
            reportAssetProgress(label, event.loaded / event.total);
          }
        });
        reportAssetProgress(label, 1);
        if (!gltf?.scene) throw new Error("The GLB did not contain a scene.");
        return { gltf, url, errors };
      } catch (error) {
        errors.push({ url, error });
        console.warn(`[Holy Buck] ${label} GLB load failed for "${url}"; trying the next source.`, error);
      }
    }
    return { gltf: null, url: null, errors };
  };

  const ready = (async () => {
    onModelState("loading");
    const [naturalResult, bronzeResult] = await Promise.all([
      loadFirstAvailableModel(naturalModelUrls, "Natural King"),
      loadFirstAvailableModel(modelUrls, "Bronze King"),
    ]);
    loadedModelUrl = naturalResult.url;
    bronzeLoadedModelUrl = bronzeResult.url;

    if (!naturalResult.gltf?.scene) {
      console.error(
        "[Holy Buck] The authoritative natural King could not be loaded. " +
          "The procedural fallback is ready instead.",
        naturalResult.errors,
      );
      fallback.root.visible = false;
      compileScene();
      container.dataset.modelPreparedMs = String(
        Math.round(performance.now() - initializationStartedAt),
      );
      onModelState("fallback-ready");
      return { status: "fallback", url: null };
    }

    try {
      const naturalHero = new THREE.Group();
      naturalHero.name = "Holy Buck — Textured Natural King Right";
      naturalHero.rotation.copy(NATURAL_HERO_ROTATION);
      naturalHero.add(naturalResult.gltf.scene);
      naturalHero.updateMatrixWorld(true);

      const naturalProduction = normalizeObject(naturalHero, true);
      naturalMaterialHandles = installNaturalCaptureMaterials(
        naturalProduction.root,
        renderer.capabilities.getMaxAnisotropy(),
      );
      const productionVisualBounds = new THREE.Box3().setFromObject(naturalProduction.root, true);
      wireframeMaterial = createWireframeOverlay(naturalProduction.root);
      vertexPointMaterial = createVertexPointOverlay(naturalProduction.root);
      productionFadeStates = prepareMaterialFade(naturalProduction.root);
      product.remove(fallback.root);
      naturalRoot = naturalProduction.root;
      kingRoot = naturalRoot;
      kingSize = naturalProduction.size;
      kingVisualSize = productionVisualBounds.getSize(new THREE.Vector3());
      kingVisualCenter = productionVisualBounds.getCenter(new THREE.Vector3());
      naturalRoot.visible = false;
      product.add(naturalRoot);

      if (bronzeResult.gltf?.scene) {
        try {
          const orientedKing = new THREE.Group();
          orientedKing.name = "Holy Buck — Upright Bronze King Source";
          orientedKing.rotation.x = CLEAN_KING_UPRIGHT_ROTATION_X;
          orientedKing.add(bronzeResult.gltf.scene);
          orientedKing.updateMatrixWorld(true);

          const facingKing = new THREE.Group();
          facingKing.rotation.y = LEFT_FACING_ROTATION_Y;
          facingKing.add(orientedKing);
          facingKing.updateMatrixWorld(true);

          const registeredKing = new THREE.Group();
          registeredKing.rotation.copy(NATURAL_HERO_ROTATION);
          registeredKing.add(facingKing);
          registeredKing.updateMatrixWorld(true);

          const bronzeProduction = normalizeObject(registeredKing, true);
          bronzeMaterialHandles = installSequenceMaterials(
            bronzeProduction.root,
            renderer.capabilities.getMaxAnisotropy(),
          );
          const bronzeBounds = new THREE.Box3().setFromObject(bronzeProduction.root, true);
          const bronzeSize = bronzeBounds.getSize(new THREE.Vector3());
          const widthRatio = kingVisualSize.x / Math.max(bronzeSize.x, 0.001);
          const heightRatio = kingVisualSize.y / Math.max(bronzeSize.y, 0.001);
          const bronzeAlignmentScale = Math.sqrt(widthRatio * heightRatio);
          bronzeProduction.root.scale.multiplyScalar(bronzeAlignmentScale);
          bronzeProduction.root.position.copy(kingVisualCenter);
          bronzeRoot = bronzeProduction.root;
          bronzeRoot.name = "Holy Buck — Registered Bronze King";
          bronzeRoot.visible = false;
          applyMaterialOpacity(bronzeMaterialHandles, 0);
          product.add(bronzeRoot);
          container.dataset.bronzeModelUrl = bronzeLoadedModelUrl;
          container.dataset.bronzeAlignmentScale = bronzeAlignmentScale.toFixed(4);
        } catch (error) {
          console.error(
            "[Holy Buck] The bronze King loaded but could not be registered to the natural scan.",
            error,
          );
          bronzeRoot = null;
          bronzeMaterialHandles = [];
        }
      } else {
        console.error(
          "[Holy Buck] The bronze King could not be loaded; WILD and DIGITIZED remain available.",
          bronzeResult.errors,
        );
      }

      updateSequence(0);
      lastWidth = 0;
      lastHeight = 0;
      resizePending = true;
      applyResponsiveLayout();
      naturalRoot.visible = true;
      compileScene();
      naturalRoot.visible = false;
      productionFadeStates.forEach(({ material }) => {
        material.opacity = 0;
        material.transparent = true;
        material.depthWrite = false;
      });
      renderer.shadowMap.needsUpdate = true;
      modelResult = "loaded";
      container.dataset.modelUrl = loadedModelUrl;
      container.dataset.naturalHeroRotation = [
        NATURAL_HERO_ROTATION.x,
        NATURAL_HERO_ROTATION.y,
        NATURAL_HERO_ROTATION.z,
      ].map((value) => THREE.MathUtils.radToDeg(value).toFixed(2)).join(",");
      container.dataset.naturalSurfaceSource = "embedded-photogrammetry-texture";
      container.dataset.modelPreparedMs = String(
        Math.round(performance.now() - initializationStartedAt),
      );
      onModelState("ready");
      return { status: "loaded", url: loadedModelUrl };
    } catch (error) {
      console.error(
        "[Holy Buck] The King GLB loaded but could not be prepared. " +
          "The procedural fallback is ready instead.",
        error,
      );
      if (kingRoot !== fallback.root) {
        product.remove(kingRoot);
        disposeObject(kingRoot);
      }
      naturalMaterialHandles = [];
      bronzeMaterialHandles = [];
      wireframeMaterial = null;
      vertexPointMaterial = null;
      kingRoot = fallback.root;
      naturalRoot = fallback.root;
      bronzeRoot = null;
      kingSize = fallback.size;
      fallback.root.visible = false;
      if (!fallback.root.parent) product.add(fallback.root);
      lastWidth = 0;
      lastHeight = 0;
      applyResponsiveLayout();
      compileScene();
      container.dataset.modelPreparedMs = String(
        Math.round(performance.now() - initializationStartedAt),
      );
      onModelState("fallback-ready");
      return { status: "fallback", url: null };
    }
  })();

  const loadCastingPattern = async () => {
    if (destroyed || patternRoot) return;
    patternResult = "loading";
    container.dataset.patternStatus = patternResult;
    const patternLoadStartedAt = performance.now();
    const loadErrors = [];
    let gltf = null;

    try {
      for (const url of castingPatternUrls) {
        try {
          const response = await fetch(url, { method: "HEAD", cache: "no-store" });
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
          gltf = await loadGLTF(loader, url);
          if (!gltf?.scene) throw new Error("The GLB did not contain a scene.");
          patternLoadedModelUrl = url;
          break;
        } catch (error) {
          loadErrors.push({ url, error });
          console.warn(
            `[Holy Buck] PLA casting-pattern load failed for "${url}"; trying the next source.`,
            error,
          );
        }
      }

      if (!gltf?.scene || destroyed) {
        if (!destroyed) {
          patternResult = "unavailable";
          container.dataset.patternStatus = patternResult;
          console.error(
            "[Holy Buck] The PLA casting-pattern model could not be loaded from any configured URL.",
            loadErrors,
          );
        }
        return;
      }

      const orientedPattern = new THREE.Group();
      orientedPattern.name = "Holy Buck — Upright PLA Casting Pattern";
      orientedPattern.rotation.y = PATTERN_UPRIGHT_ROTATION_Y;
      orientedPattern.add(gltf.scene);
      orientedPattern.updateMatrixWorld(true);

      const facingPattern = new THREE.Group();
      facingPattern.rotation.y = LEFT_FACING_ROTATION_Y;
      facingPattern.add(orientedPattern);
      facingPattern.updateMatrixWorld(true);

      const registeredPattern = new THREE.Group();
      registeredPattern.rotation.copy(NATURAL_HERO_ROTATION);
      registeredPattern.add(facingPattern);
      registeredPattern.updateMatrixWorld(true);

      patternMaterialHandles = installPlaMaterials(registeredPattern);
      const normalizedPattern = normalizeObject(registeredPattern, true);
      const heightRatio = kingVisualSize.y / Math.max(normalizedPattern.size.y, 0.001);
      const preciseWidthRatio = kingVisualSize.x / Math.max(normalizedPattern.size.x, 0.001);
      const alignmentScale = Math.sqrt(preciseWidthRatio * heightRatio);
      normalizedPattern.root.scale.multiplyScalar(alignmentScale);
      normalizedPattern.root.position.copy(kingVisualCenter);
      normalizedPattern.root.updateMatrixWorld(true);

      patternRoot = normalizedPattern.root;
      patternRoot.name = "Holy Buck — Formed PLA Assembly";
      patternRoot.traverse((child) => {
        if (child.isMesh) child.renderOrder = 2;
      });
      applyMaterialOpacity(patternMaterialHandles, 0);
      patternRoot.visible = true;
      product.add(patternRoot);
      updatePatternFrameScale();
      compileScene();
      patternRoot.visible = false;

      patternAvailability = reducedMotion ? 1 : 0;
      patternRevealStartedAt = performance.now();
      patternResult = "ready";
      container.dataset.patternStatus = patternResult;
      container.dataset.patternUrl = patternLoadedModelUrl;
      container.dataset.patternPreparedMs = String(
        Math.round(performance.now() - patternLoadStartedAt),
      );
      container.dataset.patternUprightRotationY = "180deg";
      container.dataset.patternFacingY = "180deg";
      container.dataset.patternAlignmentScale = alignmentScale.toFixed(4);
      container.dataset.patternBounds = [
        normalizedPattern.size.x,
        normalizedPattern.size.y,
        normalizedPattern.size.z,
      ].map((value) => value.toFixed(4)).join(",");
      updateSequence(sequenceProgress);
      ensureRenderLoop();
    } catch (error) {
      patternResult = "unavailable";
      container.dataset.patternStatus = patternResult;
      console.error(
        `[Holy Buck] The PLA casting-pattern model at "${patternLoadedModelUrl ?? "unknown"}" ` +
          "loaded but could not be transformed and prepared.",
        error,
      );
    }
  };

  const scheduleCastingPatternLoad = () => {
    if (optionalLoadScheduled) return;
    optionalLoadScheduled = true;
    if ("requestIdleCallback" in window) {
      optionalIdleId = window.requestIdleCallback(loadCastingPattern, { timeout: 2400 });
    } else {
      optionalIdleId = window.setTimeout(loadCastingPattern, 1200);
    }
  };

  return {
    stage,
    product,
    ready,
    async reveal(duration = 700) {
      const result = await ready;
      if (destroyed) return result;
      kingRoot.visible = true;
      onModelState("revealing");
      scheduleCastingPatternLoad();
      const modelFadeStates =
        result.status === "loaded" ? productionFadeStates : fallbackFadeStates;
      await revealMaterials([...modelFadeStates, ...shadowFadeStates], duration);
      if (destroyed) return result;
      if (result.status === "loaded") disposeObject(fallback.root);
      onModelState(result.status);
      return result;
    },
    setSequenceProgress(value) {
      if (presentation !== "intro") {
        presentation = "intro";
        lastWidth = 0;
        resizePending = true;
      }
      sequenceTarget = THREE.MathUtils.clamp(value, 0, 1);
      if (sequenceTarget > 0.45 || sequenceProgress > 0.45 || reducedMotion) updateSequence(sequenceTarget);
    },
    setShowcasePresentation() {
      if (presentation === "showcase") return;
      presentation = "showcase";
      // Reuse the finished bronze, not the cinematic blackout endpoint.
      updateSequence(0.9);
      lastWidth = 0;
      resizePending = true;
    },
    setRenderActive(value) {
      if (renderEnabled === Boolean(value)) return;
      renderEnabled = Boolean(value);
      container.dataset.renderState = renderEnabled ? "active" : "paused";
      if (renderEnabled) {
        lastRenderTime = 0;
        performanceWindowStartedAt = performance.now();
        performanceFrameCount = 0;
        performanceMaxFrameMs = 0;
        ensureRenderLoop();
      } else if (animationFrame) {
        cancelAnimationFrame(animationFrame);
        animationFrame = 0;
      }
    },
    setScrollProgress(value) {
      scrollProgress = THREE.MathUtils.clamp(value, 0, 1);
    },
    getDiagnostics() {
      return {
        modelUrl: loadedModelUrl,
        bronzeModelUrl: bronzeLoadedModelUrl,
        modelStatus: modelResult,
        naturalSurfaceSource:
          modelResult === "loaded" ? "embedded-photogrammetry-texture" : "procedural-fallback",
        pixelRatio: renderer.getPixelRatio(),
        shadowMapSize: key.shadow.mapSize.x,
        mobile: isMobile,
        sequenceProgress,
        presentation,
        bronzeVisible: Boolean(bronzeRoot?.visible),
        patternUrl: patternLoadedModelUrl,
        patternStatus: patternResult,
        patternAvailability,
        patternFrameScale,
        safeScreenBounds: container.dataset.safeScreenBounds,
        kingScreenBounds: container.dataset.kingScreenBounds,
        kingWithinSafeBounds: container.dataset.kingWithinSafeBounds,
        patternScreenBounds: container.dataset.patternScreenBounds,
        patternWithinSafeBounds: container.dataset.patternWithinSafeBounds,
        renderActive: renderEnabled,
        drawCalls: renderer.info.render.calls,
        triangles: renderer.info.render.triangles,
        geometries: renderer.info.memory.geometries,
        textures: renderer.info.memory.textures,
      };
    },
    destroy() {
      destroyed = true;
      cancelAnimationFrame(animationFrame);
      if (optionalIdleId) {
        if ("cancelIdleCallback" in window) window.cancelIdleCallback(optionalIdleId);
        else window.clearTimeout(optionalIdleId);
      }
      activeFade?.resolve();
      activeFade = null;
      resizeObserver.disconnect();
      container.removeEventListener("pointermove", onPointerMove);
      container.removeEventListener("pointerleave", onPointerLeave);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      disposeObject(scene);
      environmentTarget.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
}
