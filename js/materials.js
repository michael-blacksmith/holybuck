import * as THREE from "three";

const MATERIAL_STOPS = [
  {
    at: 0,
    color: new THREE.Color(0xb39a72),
    metalness: 0,
    roughness: 0.82,
    clearcoat: 0.01,
    clearcoatRoughness: 0.88,
    envMapIntensity: 0.56,
    normalScale: 0.24,
    emissive: new THREE.Color(0x000000),
    emissiveIntensity: 0,
  },
  {
    at: 0.13,
    color: new THREE.Color(0xb39a72),
    metalness: 0,
    roughness: 0.82,
    clearcoat: 0.01,
    clearcoatRoughness: 0.88,
    envMapIntensity: 0.56,
    normalScale: 0.24,
    emissive: new THREE.Color(0x000000),
    emissiveIntensity: 0,
  },
  {
    at: 0.22,
    color: new THREE.Color(0x222526),
    metalness: 0.04,
    roughness: 0.67,
    clearcoat: 0.015,
    clearcoatRoughness: 0.78,
    envMapIntensity: 0.5,
    normalScale: 0.065,
    emissive: new THREE.Color(0x090807),
    emissiveIntensity: 0.018,
  },
  {
    at: 0.37,
    color: new THREE.Color(0x222526),
    metalness: 0.04,
    roughness: 0.67,
    clearcoat: 0.015,
    clearcoatRoughness: 0.78,
    envMapIntensity: 0.5,
    normalScale: 0.065,
    emissive: new THREE.Color(0x090807),
    emissiveIntensity: 0.018,
  },
  {
    at: 0.43,
    color: new THREE.Color(0xc7bcaa),
    metalness: 0,
    roughness: 0.68,
    clearcoat: 0.025,
    clearcoatRoughness: 0.82,
    envMapIntensity: 0.56,
    normalScale: 0.08,
    emissive: new THREE.Color(0x090807),
    emissiveIntensity: 0.006,
  },
  {
    at: 0.61,
    color: new THREE.Color(0xc7bcaa),
    metalness: 0,
    roughness: 0.68,
    clearcoat: 0.025,
    clearcoatRoughness: 0.82,
    envMapIntensity: 0.56,
    normalScale: 0.08,
    emissive: new THREE.Color(0x090807),
    emissiveIntensity: 0.006,
  },
  {
    at: 0.69,
    color: new THREE.Color(0x3a2014),
    metalness: 0.68,
    roughness: 0.49,
    clearcoat: 0.03,
    clearcoatRoughness: 0.7,
    envMapIntensity: 0.5,
    normalScale: 0.2,
    emissive: new THREE.Color(0x3a0f03),
    emissiveIntensity: 0.07,
  },
  {
    at: 0.79,
    color: new THREE.Color(0x2b1811),
    metalness: 0.78,
    roughness: 0.48,
    clearcoat: 0.04,
    clearcoatRoughness: 0.62,
    envMapIntensity: 0.5,
    normalScale: 0.27,
    emissive: new THREE.Color(0x150502),
    emissiveIntensity: 0.015,
  },
  {
    at: 0.86,
    color: new THREE.Color(0x3f281c),
    metalness: 0.9,
    roughness: 0.43,
    clearcoat: 0.065,
    clearcoatRoughness: 0.56,
    envMapIntensity: 0.68,
    normalScale: 0.34,
    emissive: new THREE.Color(0x0a0201),
    emissiveIntensity: 0.008,
  },
  {
    at: 1,
    color: new THREE.Color(0x3f281c),
    metalness: 0.9,
    roughness: 0.43,
    clearcoat: 0.065,
    clearcoatRoughness: 0.56,
    envMapIntensity: 0.68,
    normalScale: 0.34,
    emissive: new THREE.Color(0x0a0201),
    emissiveIntensity: 0.008,
  },
];

function smoothstep(value) {
  const clamped = THREE.MathUtils.clamp(value, 0, 1);
  return clamped * clamped * (3 - 2 * clamped);
}

function findMaterialSegment(progress) {
  const clamped = THREE.MathUtils.clamp(progress, 0, 1);

  for (let index = 0; index < MATERIAL_STOPS.length - 1; index += 1) {
    const from = MATERIAL_STOPS[index];
    const to = MATERIAL_STOPS[index + 1];
    if (clamped <= to.at) {
      const range = Math.max(to.at - from.at, 0.0001);
      return { from, to, mix: smoothstep((clamped - from.at) / range) };
    }
  }

  const finalState = MATERIAL_STOPS.at(-1);
  return { from: finalState, to: finalState, mix: 1 };
}

function addCanonicalCoordinates(model) {
  model.updateMatrixWorld(true);
  const rootInverse = model.matrixWorld.clone().invert();
  const localToRoot = new THREE.Matrix4();
  const point = new THREE.Vector3();

  model.traverse((child) => {
    if (!child.isMesh || child.geometry.getAttribute("hbCanonical")) return;
    const position = child.geometry.getAttribute("position");
    if (!position) return;

    localToRoot.multiplyMatrices(rootInverse, child.matrixWorld);
    const coordinates = new Float32Array(position.count * 3);
    for (let index = 0; index < position.count; index += 1) {
      point.fromBufferAttribute(position, index).applyMatrix4(localToRoot);
      point.toArray(coordinates, index * 3);
    }
    child.geometry.setAttribute(
      "hbCanonical",
      new THREE.BufferAttribute(coordinates, 3),
    );
  });
}

function installPlaAssemblyShader(material, bounds) {
  const uniforms = {
    assemblyProgress: { value: 0 },
    burnoutProgress: { value: 0 },
    fireTime: { value: 0 },
    boundsMin: { value: bounds.min.clone() },
    boundsSize: { value: bounds.getSize(new THREE.Vector3()) },
  };

  material.userData.plaUniforms = uniforms;
  material.onBeforeCompile = (shader) => {
    shader.uniforms.hbAssemblyProgress = uniforms.assemblyProgress;
    shader.uniforms.hbBurnoutProgress = uniforms.burnoutProgress;
    shader.uniforms.hbPlaFireTime = uniforms.fireTime;
    shader.uniforms.hbPlaBoundsMin = uniforms.boundsMin;
    shader.uniforms.hbPlaBoundsSize = uniforms.boundsSize;
    shader.vertexShader = shader.vertexShader
      .replace(
        "#include <common>",
        `#include <common>
attribute vec3 hbCanonical;
varying vec3 vHbPlaCanonical;`,
      )
      .replace(
        "#include <begin_vertex>",
        `#include <begin_vertex>
vHbPlaCanonical = hbCanonical;`,
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        `#include <common>
uniform float hbAssemblyProgress;
uniform float hbBurnoutProgress;
uniform float hbPlaFireTime;
uniform vec3 hbPlaBoundsMin;
uniform vec3 hbPlaBoundsSize;
varying vec3 vHbPlaCanonical;`,
      )
      .replace(
        "#include <map_fragment>",
        `#include <map_fragment>
vec3 hbPlaUv = clamp(
  (vHbPlaCanonical - hbPlaBoundsMin) / max(hbPlaBoundsSize, vec3(0.0001)),
  0.0,
  1.0
);
float hbAssemblyOrder = clamp(
  hbPlaUv.y * 0.62 + abs(hbPlaUv.x - 0.5) * 0.5,
  0.0,
  1.0
);
float hbAssemblyNoise = fract(sin(dot(vHbPlaCanonical.xy, vec2(127.1, 311.7))) * 43758.5453);
if (hbAssemblyOrder > hbAssemblyProgress + hbAssemblyNoise * 0.055) discard;
float hbBurnFront = hbBurnoutProgress * 1.24 - 0.12;
float hbBurnNoise = (
  sin(hbPlaUv.x * 31.0 + hbPlaUv.z * 23.0 + hbPlaFireTime * 1.7) +
  sin(hbPlaUv.x * 17.0 - hbPlaUv.z * 29.0 - hbPlaFireTime * 1.3) * 0.55 +
  sin(hbPlaUv.x * 71.0 + hbPlaUv.z * 43.0 + hbPlaFireTime * 2.4) * 0.22
) * 0.034;
if (hbPlaUv.y < hbBurnFront + hbBurnNoise) discard;
float hbHeatEdge = 1.0 - smoothstep(0.0, 0.1, abs(hbPlaUv.y - hbBurnFront));
float hbHeatBand = 1.0 - smoothstep(0.04, 0.26, hbPlaUv.y - hbBurnFront);
float hbHotRegionA = 1.0 - smoothstep(0.06, 0.19, abs(hbPlaUv.x - 0.24));
float hbHotRegionB = 1.0 - smoothstep(0.05, 0.17, abs(hbPlaUv.x - 0.57));
float hbHotRegionC = 1.0 - smoothstep(0.045, 0.14, abs(hbPlaUv.x - 0.84));
float hbHeatFlicker = 0.58 + 0.42 * sin(
  hbPlaFireTime * 5.2 +
  vHbPlaCanonical.x * 31.0 +
  vHbPlaCanonical.z * 23.0
);
float hbHeatMask = clamp(
  hbBurnoutProgress * hbHeatBand *
  (hbHeatEdge * 0.48 + max(hbHotRegionA, max(hbHotRegionB, hbHotRegionC)) * 0.52) *
  (0.78 + hbHeatFlicker * 0.22),
  0.0,
  1.0
);
diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.42, 0.13, 0.028), hbHeatMask * 0.62);`,
      )
      .replace(
        "#include <emissivemap_fragment>",
        `#include <emissivemap_fragment>
totalEmissiveRadiance += vec3(0.34, 0.075, 0.012) * hbHeatMask * 0.28;`,
      );
  };
  material.customProgramCacheKey = () => "holy-buck-pla-assembly-v3-localized-heat";
  return uniforms;
}

function installSequenceShader(material, bounds) {
  const uniforms = {
    foundAmount: { value: 1 },
    scanAmount: { value: 0 },
    scanPosition: { value: -0.56 },
    stageColor: { value: MATERIAL_STOPS[0].color.clone() },
    boneIvory: { value: new THREE.Color(0xa99c84) },
    boneTan: { value: new THREE.Color(0x766650) },
    burrBrown: { value: new THREE.Color(0x443a30) },
    fireFront: { value: 0 },
    fireTime: { value: 0 },
    boundsMin: { value: bounds.min.clone() },
    boundsSize: { value: bounds.getSize(new THREE.Vector3()) },
  };

  material.userData.sequenceUniforms = uniforms;
  material.onBeforeCompile = (shader) => {
    shader.uniforms.hbFoundAmount = uniforms.foundAmount;
    shader.uniforms.hbScanAmount = uniforms.scanAmount;
    shader.uniforms.hbScanPosition = uniforms.scanPosition;
    shader.uniforms.hbStageColor = uniforms.stageColor;
    shader.uniforms.hbBoneIvory = uniforms.boneIvory;
    shader.uniforms.hbBoneTan = uniforms.boneTan;
    shader.uniforms.hbBurrBrown = uniforms.burrBrown;
    shader.uniforms.hbFireFront = uniforms.fireFront;
    shader.uniforms.hbFireTime = uniforms.fireTime;
    shader.uniforms.hbSequenceBoundsMin = uniforms.boundsMin;
    shader.uniforms.hbSequenceBoundsSize = uniforms.boundsSize;
    shader.vertexShader = shader.vertexShader
      .replace(
        "#include <common>",
        `#include <common>
attribute vec3 hbCanonical;
varying vec3 vHbCanonical;`,
      )
      .replace(
        "#include <begin_vertex>",
        `#include <begin_vertex>
vHbCanonical = hbCanonical;`,
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        `#include <common>
uniform float hbFoundAmount;
uniform float hbScanAmount;
uniform float hbScanPosition;
uniform vec3 hbStageColor;
uniform vec3 hbBoneIvory;
uniform vec3 hbBoneTan;
uniform vec3 hbBurrBrown;
uniform float hbFireFront;
uniform float hbFireTime;
uniform vec3 hbSequenceBoundsMin;
uniform vec3 hbSequenceBoundsSize;
varying vec3 vHbCanonical;`,
      )
      .replace(
        "#include <map_fragment>",
        `#include <map_fragment>
float hbGrain = 0.5 + 0.5 * sin(
  vHbCanonical.x * 37.0 +
  sin(vHbCanonical.y * 71.0) * 1.8 +
  vHbCanonical.z * 43.0
);
float hbStriation = 0.5 + 0.5 * sin(vHbCanonical.y * 126.0 + vHbCanonical.z * 31.0);
float hbVariation = clamp(hbGrain * 0.72 + hbStriation * 0.28, 0.0, 1.0);
float hbBurrMask = smoothstep(0.1, 0.34, vHbCanonical.x);
float hbBeamMask = 1.0 - smoothstep(-0.12, 0.12, vHbCanonical.y);
float hbTipMask = max(
  smoothstep(0.2, 0.5, vHbCanonical.y),
  1.0 - smoothstep(-0.5, -0.28, vHbCanonical.x)
);
float hbRecess = pow(1.0 - hbVariation, 3.0);
vec3 hbProceduralNatural = mix(hbBoneTan, hbBoneIvory, 0.33 + hbVariation * 0.52);
hbProceduralNatural = mix(hbProceduralNatural, hbBoneTan, hbBeamMask * 0.3);
hbProceduralNatural = mix(
  hbProceduralNatural,
  hbBurrBrown,
  hbBurrMask * (0.45 + hbGrain * 0.18)
);
hbProceduralNatural *= 1.0 - hbRecess * 0.075;
hbProceduralNatural = mix(hbProceduralNatural, hbBoneIvory, hbTipMask * 0.17);
vec3 hbNatural = hbProceduralNatural;
float hbScanned = 1.0 - smoothstep(
  hbScanPosition - 0.022,
  hbScanPosition + 0.022,
  vHbCanonical.x
);
vec3 hbScanComposite = mix(hbNatural, hbStageColor, hbScanned);
diffuseColor.rgb = hbStageColor;
diffuseColor.rgb = mix(diffuseColor.rgb, hbNatural, hbFoundAmount);
diffuseColor.rgb = mix(diffuseColor.rgb, hbScanComposite, hbScanAmount);
vec3 hbFireUv = clamp(
  (vHbCanonical - hbSequenceBoundsMin) / max(hbSequenceBoundsSize, vec3(0.0001)),
  0.0,
  1.0
);
float hbFireEdge = hbFireFront * 1.24 - 0.12;
float hbFireNoise = (
  sin(hbFireUv.x * 31.0 + hbFireUv.z * 23.0 + hbFireTime * 1.7) +
  sin(hbFireUv.x * 17.0 - hbFireUv.z * 29.0 - hbFireTime * 1.3) * 0.55 +
  sin(hbFireUv.x * 71.0 + hbFireUv.z * 43.0 + hbFireTime * 2.4) * 0.22
) * 0.034;
if (hbFireUv.y > hbFireEdge + hbFireNoise + 0.018) discard;
`,
      );
  };
  material.customProgramCacheKey = () => "holy-buck-sequence-material-v5-fire-front";
  return uniforms;
}

function installNaturalCaptureShader(material) {
  const uniforms = {
    scanAmount: { value: 0 },
    scanPosition: { value: -0.56 },
  };

  material.userData.naturalCaptureUniforms = uniforms;
  material.onBeforeCompile = (shader) => {
    shader.uniforms.hbNaturalScanAmount = uniforms.scanAmount;
    shader.uniforms.hbNaturalScanPosition = uniforms.scanPosition;
    shader.vertexShader = shader.vertexShader
      .replace(
        "#include <common>",
        `#include <common>
attribute vec3 hbCanonical;
varying vec3 vHbNaturalCanonical;`,
      )
      .replace(
        "#include <begin_vertex>",
        `#include <begin_vertex>
vHbNaturalCanonical = hbCanonical;`,
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        `#include <common>
uniform float hbNaturalScanAmount;
uniform float hbNaturalScanPosition;
varying vec3 vHbNaturalCanonical;`,
      )
      .replace(
        "#include <map_fragment>",
        `#include <map_fragment>
vec3 hbPhotographicSurface = diffuseColor.rgb;
// Restrict color repair to the warm damaged strip on the lower beam.
// Keep photographic luminance/texture; feather both spatial and color masks.
float hbLowerBeam = (1.0 - smoothstep(-0.035, 0.045, vHbNaturalCanonical.y)) *
  smoothstep(-0.5, -0.34, vHbNaturalCanonical.x) *
  (1.0 - smoothstep(0.25, 0.4, vHbNaturalCanonical.x));
float hbWarmDamage = smoothstep(0.045, 0.16, hbPhotographicSurface.r - hbPhotographicSurface.b) *
  smoothstep(0.12, 0.34, hbPhotographicSurface.r) *
  (1.0 - smoothstep(0.62, 0.82, hbPhotographicSurface.r));
float hbRepair = hbLowerBeam * hbWarmDamage * 0.78;
float hbPhotoLuma = dot(hbPhotographicSurface, vec3(0.2126, 0.7152, 0.0722));
vec3 hbRepairColor = vec3(0.058, 0.039, 0.025) * mix(0.72, 1.32, clamp(hbPhotoLuma * 2.0, 0.0, 1.0));
#ifdef USE_MAP
// Borrow nearby photographic color only inside the damaged color/spatial mask.
// The original sample still contributes fine detail, avoiding a painted stripe.
vec3 hbNeighborA = texture2D(map, vMapUv + vec2(0.003, 0.0)).rgb;
vec3 hbNeighborB = texture2D(map, vMapUv - vec2(0.003, 0.0)).rgb;
vec3 hbNeighborC = texture2D(map, vMapUv + vec2(0.0, 0.003)).rgb;
vec3 hbNeighborD = texture2D(map, vMapUv - vec2(0.0, 0.003)).rgb;
vec3 hbNeighbor = (hbNeighborA + hbNeighborB + hbNeighborC + hbNeighborD) * 0.25;
// Preserve photographed local variation, but not the pale/orange repair's hue.
float hbNeighborLuma = dot(hbNeighbor, vec3(0.2126, 0.7152, 0.0722));
hbRepairColor *= clamp(0.78 + hbNeighborLuma * 1.1, 0.78, 1.3);
#endif
hbPhotographicSurface = mix(hbPhotographicSurface, hbRepairColor, hbRepair);
float hbCaptured = (
  1.0 - smoothstep(
    hbNaturalScanPosition - 0.018,
    hbNaturalScanPosition + 0.018,
    vHbNaturalCanonical.x
  )
) * hbNaturalScanAmount;
float hbHeight = smoothstep(-0.48, 0.5, vHbNaturalCanonical.y);
float hbDepth = smoothstep(-0.42, 0.42, vHbNaturalCanonical.z);
vec3 hbGraphite = mix(
  vec3(0.038, 0.041, 0.041),
  vec3(0.095, 0.098, 0.095),
  0.28 + hbHeight * 0.34 + hbDepth * 0.12
);
diffuseColor.rgb = mix(hbPhotographicSurface, hbGraphite, hbCaptured);`,
      );
  };
  material.customProgramCacheKey = () => "holy-buck-natural-capture-v1";
  return uniforms;
}

export function installNaturalCaptureMaterials(model, maxAnisotropy) {
  const materialHandles = [];
  const materialCache = new Map();

  addCanonicalCoordinates(model);

  model.traverse((child) => {
    if (!child.isMesh) return;

    const sourceMaterials = Array.isArray(child.material)
      ? child.material
      : [child.material];
    const preparedMaterials = sourceMaterials.map((material) => {
      if (!material || materialCache.has(material)) {
        return material ? materialCache.get(material) : material;
      }

      [material.map, material.normalMap].filter(Boolean).forEach((texture) => {
        texture.anisotropy = Math.min(maxAnisotropy, 8);
        texture.needsUpdate = true;
      });
      if (material.map) material.map.colorSpace = THREE.SRGBColorSpace;
      if ("metalness" in material) material.metalness = 0;
      if ("roughness" in material) material.roughness = Math.max(material.roughness, 0.74);
      if ("envMapIntensity" in material) material.envMapIntensity = 0.48;
      material.side = THREE.DoubleSide;

      const uniforms = installNaturalCaptureShader(material);
      materialHandles.push({ material, uniforms });
      materialCache.set(material, material);
      material.needsUpdate = true;
      return material;
    });

    child.material = Array.isArray(child.material) ? preparedMaterials : preparedMaterials[0];
    child.castShadow = true;
    child.receiveShadow = true;
  });

  return materialHandles;
}

export function updateNaturalCaptureState(materialHandles, progress) {
  const scanAmount =
    smoothstep((progress - 0.14) / 0.035) *
    (1 - smoothstep((progress - 0.405) / 0.045));
  const scanPosition = THREE.MathUtils.lerp(
    -0.56,
    0.56,
    smoothstep((progress - 0.15) / 0.19),
  );

  materialHandles.forEach(({ uniforms }) => {
    uniforms.scanAmount.value = scanAmount;
    uniforms.scanPosition.value = scanPosition;
  });
}

export function installSequenceMaterials(model, maxAnisotropy) {
  const materialHandles = [];
  const materialCache = new Map();

  addCanonicalCoordinates(model);
  const bounds = new THREE.Box3().setFromObject(model, true);

  model.traverse((child) => {
    if (!child.isMesh) return;

    const sourceMaterials = Array.isArray(child.material)
      ? child.material
      : [child.material];
    const sequenceMaterials = sourceMaterials.map((sourceMaterial) => {
      if (materialCache.has(sourceMaterial)) {
        return materialCache.get(sourceMaterial);
      }

      const normalMap = sourceMaterial?.normalMap ?? null;
      [normalMap].filter(Boolean).forEach((texture) => {
        texture.anisotropy = maxAnisotropy;
        texture.needsUpdate = true;
      });

      const material = new THREE.MeshPhysicalMaterial({
        name: "Holy Buck — Sequence Material",
        color: 0xffffff,
        metalness: MATERIAL_STOPS[0].metalness,
        roughness: MATERIAL_STOPS[0].roughness,
        clearcoat: MATERIAL_STOPS[0].clearcoat,
        clearcoatRoughness: MATERIAL_STOPS[0].clearcoatRoughness,
        envMapIntensity: MATERIAL_STOPS[0].envMapIntensity,
        normalMap,
        normalScale: normalMap
          ? new THREE.Vector2(MATERIAL_STOPS[0].normalScale, MATERIAL_STOPS[0].normalScale)
          : undefined,
        emissive: MATERIAL_STOPS[0].emissive,
        emissiveIntensity: MATERIAL_STOPS[0].emissiveIntensity,
        ior: 1.46,
        specularIntensity: 0.34,
        specularColor: 0xe4ddd2,
        side: THREE.DoubleSide,
      });

      const uniforms = installSequenceShader(material, bounds);

      materialHandles.push({
        material,
        hasNormalMap: Boolean(normalMap),
        uniforms,
      });
      materialCache.set(sourceMaterial, material);
      sourceMaterial?.dispose();
      return material;
    });

    child.material = Array.isArray(child.material)
      ? sequenceMaterials
      : sequenceMaterials[0];
    child.castShadow = true;
    child.receiveShadow = true;
  });

  return materialHandles;
}

export function installPlaMaterials(model) {
  const materialHandles = [];
  const materialCache = new Map();
  const unusedTextures = new Set();

  addCanonicalCoordinates(model);
  const bounds = new THREE.Box3().setFromObject(model, true);

  model.traverse((child) => {
    if (!child.isMesh) return;

    if (!child.geometry.getAttribute("normal")) {
      child.geometry.computeVertexNormals();
    }

    const sourceMaterials = Array.isArray(child.material)
      ? child.material
      : [child.material];
    const plaMaterials = sourceMaterials.map((sourceMaterial) => {
      if (materialCache.has(sourceMaterial)) {
        return materialCache.get(sourceMaterial);
      }

      if (sourceMaterial) {
        Object.values(sourceMaterial).forEach((value) => {
          if (value?.isTexture) unusedTextures.add(value);
        });
      }

      const material = new THREE.MeshPhysicalMaterial({
        name: "Holy Buck — Warm Ivory PLA",
        color: 0xbeb39f,
        metalness: 0,
        roughness: 0.67,
        clearcoat: 0.03,
        clearcoatRoughness: 0.82,
        envMapIntensity: 0.55,
        ior: 1.46,
        specularIntensity: 0.38,
        specularColor: 0xeee4d2,
        side: THREE.DoubleSide,
      });

      const uniforms = installPlaAssemblyShader(material, bounds);

      materialHandles.push({ material, hasNormalMap: false, uniforms });
      materialCache.set(sourceMaterial, material);
      sourceMaterial?.dispose();
      return material;
    });

    child.material = Array.isArray(child.material) ? plaMaterials : plaMaterials[0];
    child.castShadow = true;
    child.receiveShadow = true;
  });

  unusedTextures.forEach((texture) => {
    texture.dispose();
    texture.image?.close?.();
  });

  return materialHandles;
}

export function applySequenceMaterialState(materialHandles, progress) {
  const { from, to, mix } = findMaterialSegment(progress);
  const foundAmount = 1 - smoothstep((progress - 0.13) / 0.065);
  const scanAmount =
    smoothstep((progress - 0.14) / 0.035) *
    (1 - smoothstep((progress - 0.365) / 0.045));
  const scanPosition = THREE.MathUtils.lerp(
    -0.56,
    0.56,
    smoothstep((progress - 0.15) / 0.19),
  );

  materialHandles.forEach(({ material, hasNormalMap, uniforms }) => {
    material.metalness = THREE.MathUtils.lerp(from.metalness, to.metalness, mix);
    material.roughness = THREE.MathUtils.lerp(from.roughness, to.roughness, mix);
    material.clearcoat = THREE.MathUtils.lerp(from.clearcoat, to.clearcoat, mix);
    material.clearcoatRoughness = THREE.MathUtils.lerp(
      from.clearcoatRoughness,
      to.clearcoatRoughness,
      mix,
    );
    material.envMapIntensity = THREE.MathUtils.lerp(
      from.envMapIntensity,
      to.envMapIntensity,
      mix,
    );
    material.emissive.lerpColors(from.emissive, to.emissive, mix);
    material.emissiveIntensity = THREE.MathUtils.lerp(
      from.emissiveIntensity,
      to.emissiveIntensity,
      mix,
    );

    if (hasNormalMap) {
      const normalStrength = THREE.MathUtils.lerp(from.normalScale, to.normalScale, mix);
      material.normalScale.setScalar(normalStrength);
    }

    if (uniforms) {
      uniforms.stageColor.value.lerpColors(from.color, to.color, mix);
      uniforms.foundAmount.value = foundAmount;
      uniforms.scanAmount.value = scanAmount;
      uniforms.scanPosition.value = scanPosition;
    }
  });
}

export function applyFireFrontState(materialHandles, progress, time) {
  const front = THREE.MathUtils.clamp(progress, 0, 1);
  materialHandles.forEach(({ uniforms }) => {
    if (!uniforms?.fireFront) return;
    uniforms.fireFront.value = front;
    uniforms.fireTime.value = time;
  });
}

export function createVertexPointOverlay(model, maxPoints = 180) {
  const sources = [];
  let sourcePointCount = 0;
  model.traverse((child) => {
    const coordinates = child.geometry?.getAttribute?.("hbCanonical");
    if (!child.isMesh || child.userData.isTopologyOverlay || !coordinates) return;
    sources.push(coordinates);
    sourcePointCount += coordinates.count;
  });

  if (!sourcePointCount) return null;
  const stride = Math.max(1, Math.ceil(sourcePointCount / maxPoints));
  const sampled = [];
  let sourceIndex = 0;
  sources.forEach((coordinates) => {
    for (let index = 0; index < coordinates.count; index += 1) {
      if (sourceIndex % stride === 0) {
        sampled.push(coordinates.getX(index), coordinates.getY(index), coordinates.getZ(index));
      }
      sourceIndex += 1;
    }
  });

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(sampled, 3));
  const material = new THREE.ShaderMaterial({
    uniforms: {
      opacity: { value: 0 },
      scanPosition: { value: -0.56 },
      pointSize: { value: 1.55 },
    },
    vertexShader: `
      uniform float pointSize;
      varying float vHbPointX;
      void main() {
        vHbPointX = position.x;
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = pointSize * (7.5 / max(-mvPosition.z, 0.1));
        gl_Position = projectionMatrix * mvPosition;
      }
    `,
    fragmentShader: `
      uniform float opacity;
      uniform float scanPosition;
      varying float vHbPointX;
      void main() {
        if (vHbPointX > scanPosition) discard;
        vec2 point = gl_PointCoord - 0.5;
        float circle = 1.0 - smoothstep(0.22, 0.5, length(point));
        gl_FragColor = vec4(vec3(0.74, 0.72, 0.68), circle * opacity);
      }
    `,
    transparent: true,
    depthTest: true,
    depthWrite: false,
    blending: THREE.NormalBlending,
  });
  const points = new THREE.Points(geometry, material);
  points.name = "Holy Buck — Scan Vertices";
  points.frustumCulled = false;
  points.renderOrder = 4;
  model.add(points);
  return material;
}

export function updateVertexPointOverlay(material, progress) {
  if (!material) return;
  const fadeIn = smoothstep((progress - 0.145) / 0.045);
  const fadeOut = 1 - smoothstep((progress - 0.37) / 0.05);
  const opacity = 0.035 * fadeIn * fadeOut;
  material.uniforms.opacity.value = opacity;
  material.uniforms.scanPosition.value = THREE.MathUtils.lerp(
    -0.56,
    0.6,
    smoothstep((progress - 0.15) / 0.19),
  );
  material.visible = opacity > 0.001;
}


export function createWireframeOverlay(model) {
  const material = new THREE.MeshBasicMaterial({
    color: 0xd8cbb7,
    transparent: true,
    opacity: 0,
    depthTest: true,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  });
  const sourceMeshes = [];

  const uniforms = { scanPosition: { value: -0.56 } };
  material.userData.sequenceUniforms = uniforms;
  material.onBeforeCompile = (shader) => {
    shader.uniforms.hbWireScanPosition = uniforms.scanPosition;
    shader.vertexShader = shader.vertexShader
      .replace(
        "#include <common>",
        `#include <common>
attribute vec3 hbCanonical;
attribute vec3 hbBarycentric;
varying vec3 vHbBarycentric;
varying vec3 vHbCanonical;`,
      )
      .replace(
        "#include <begin_vertex>",
        `#include <begin_vertex>
vHbCanonical = hbCanonical;
vHbBarycentric = hbBarycentric;`,
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        `#include <common>
uniform float hbWireScanPosition;
varying vec3 vHbBarycentric;
varying vec3 vHbCanonical;`,
      )
      .replace(
        "#include <color_fragment>",
        `#include <color_fragment>
if (vHbCanonical.x > hbWireScanPosition) discard;
vec3 edgeWidth = max(fwidth(vHbBarycentric), vec3(0.000001));
vec3 edgeCoverage = smoothstep(edgeWidth * 0.05, edgeWidth * 0.42, vHbBarycentric);
float edgeAlpha = 1.0 - min(min(edgeCoverage.x, edgeCoverage.y), edgeCoverage.z);
diffuseColor.a *= edgeAlpha;
if (diffuseColor.a < 0.006) discard;`,
      );
  };
  material.customProgramCacheKey = () => "holy-buck-real-triangles-barycentric-v1";

  model.traverse((child) => {
    if (child.isMesh) sourceMeshes.push(child);
  });

  sourceMeshes.forEach((sourceMesh) => {
    // Expand/cache once: every displayed edge belongs to an actual source triangle.
    const topologyGeometry = sourceMesh.geometry.index
      ? sourceMesh.geometry.toNonIndexed() : sourceMesh.geometry.clone();
    const barycentric = new Float32Array(topologyGeometry.attributes.position.count * 3);
    for (let i = 0; i < barycentric.length; i += 9) {
      barycentric[i] = barycentric[i + 4] = barycentric[i + 8] = 1;
    }
    topologyGeometry.setAttribute("hbBarycentric", new THREE.BufferAttribute(barycentric, 3));
    const overlay = new THREE.Mesh(topologyGeometry, material);
    overlay.userData.isTopologyOverlay = true;
    overlay.name = "Holy Buck — Digital Topology";
    overlay.frustumCulled = false;
    overlay.renderOrder = 3;
    sourceMesh.add(overlay);
  });

  return material;
}

export function updateWireframeOverlay(material, progress, objectOpacity = 1) {
  if (!material) return;
  const fadeIn = smoothstep((progress - 0.145) / 0.045);
  const fadeOut = 1 - smoothstep((progress - 0.37) / 0.055);
  material.opacity = 0.32 * fadeIn * fadeOut * objectOpacity;
  material.visible = material.opacity > 0.001;
  if (material.userData.sequenceUniforms) {
    material.userData.sequenceUniforms.scanPosition.value = THREE.MathUtils.lerp(
      -0.56,
      0.56,
      smoothstep((progress - 0.15) / 0.19),
    );
  }
}

export function applyMaterialOpacity(materialHandles, opacity) {
  const clamped = THREE.MathUtils.clamp(opacity, 0, 1);

  materialHandles.forEach(({ material }) => {
    material.opacity = clamped;
    material.transparent = clamped < 0.999;
    material.depthWrite = clamped >= 0.5;
  });
}

export function applyPlaAssemblyState(materialHandles, assemblyProgress, burnoutProgress) {
  const assembly = THREE.MathUtils.clamp(assemblyProgress, 0, 1);
  const burnout = THREE.MathUtils.clamp(burnoutProgress, 0, 1);

  materialHandles.forEach(({ uniforms }) => {
    if (!uniforms) return;
    uniforms.assemblyProgress.value = assembly;
    uniforms.burnoutProgress.value = burnout;
  });
}

export function updatePlaFireTime(materialHandles, time) {
  materialHandles.forEach(({ uniforms }) => {
    if (uniforms?.fireTime) uniforms.fireTime.value = time;
  });
}

export function smoothRange(progress, start, end) {
  return smoothstep((progress - start) / Math.max(end - start, 0.0001));
}
