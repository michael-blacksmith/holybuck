import * as THREE from "three";

const SAFARI_KING_MODEL_URL = "./models/king-web.glb";

function createWildMaterial() {
  const material = new THREE.MeshLambertMaterial({ color: 0xffffff });
  material.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace(
        "#include <common>",
        `#include <common>
varying vec3 vHbWildPosition;`,
      )
      .replace(
        "#include <begin_vertex>",
        `#include <begin_vertex>
vHbWildPosition = (modelMatrix * vec4(transformed, 1.0)).xyz;`,
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        `#include <common>
varying vec3 vHbWildPosition;`,
      )
      .replace(
        "#include <color_fragment>",
        `#include <color_fragment>
float hbBurrBrown = smoothstep(0.08, 0.82, vHbWildPosition.x);
float hbUnderside = 1.0 - smoothstep(-0.48, 0.08, vHbWildPosition.y);
float hbBrownMix = clamp(max(hbBurrBrown, hbUnderside * 0.62), 0.0, 1.0);
float hbGrain = sin(vHbWildPosition.x * 31.0 + vHbWildPosition.y * 17.0) * 0.5 + 0.5;
vec3 hbIvory = vec3(0.66, 0.53, 0.39);
vec3 hbUmber = vec3(0.22, 0.105, 0.045);
vec3 hbNatural = mix(hbIvory, hbUmber, hbBrownMix);
hbNatural *= mix(0.91, 1.06, hbGrain);
diffuseColor.rgb *= hbNatural;`,
      );
  };
  material.customProgramCacheKey = () => "holy-buck-ios-safari-wild-v1";
  return material;
}

function disposeMaterial(material, disposedTextures) {
  if (!material) return;
  Object.values(material).forEach((value) => {
    if (!value?.isTexture || disposedTextures.has(value)) return;
    disposedTextures.add(value);
    value.dispose();
  });
  material.dispose();
}

export async function initIOSSafariDiagnosticScene(container, { stage = 0 } = {}) {
  if (stage === 0) return null;
  if (stage !== 1 && stage !== 2 && stage !== 3 && stage !== 4 && stage !== 5) {
    throw new RangeError(`[Holy Buck] iOS Safari diagnostic stage ${stage} is not implemented.`);
  }
  if (!container) {
    throw new Error("[Holy Buck] iOS Safari diagnostic scene container is missing.");
  }

  let renderer;
  let modelRoot;
  let diagnosticMaterial;
  const modelGeometries = new Set();
  let animationFrameId = 0;
  let removeStage3Listeners = () => {};
  let refreshStage3Layout = () => {};
  let updateSequenceProgress = () => {};
  let updateRenderActive = () => {};
  let modelLoaded = false;
  let destroyed = false;

  const destroy = () => {
    if (destroyed) return;
    destroyed = true;
    modelRoot?.removeFromParent();
    modelGeometries.forEach((geometry) => geometry.dispose());
    diagnosticMaterial?.dispose();
    removeStage3Listeners();
    cancelAnimationFrame(animationFrameId);
    renderer?.domElement.remove();
    renderer?.dispose();
    renderer?.forceContextLoss();
  };

  try {
    renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: false,
      powerPreference: "low-power",
      preserveDrawingBuffer: false,
    });
    renderer.setPixelRatio(1);
    renderer.shadowMap.enabled = false;
    renderer.setClearColor(0x000000, 0);

    const width = Math.max(1, window.innerWidth);
    const height = Math.max(1, window.innerHeight);
    renderer.setSize(width, height, false);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 10);
    camera.position.z = 3;

    renderer.domElement.dataset.iosSafariDiagnosticStage = String(stage);
    container.append(renderer.domElement);
    renderer.render(scene, camera);

    if (stage >= 2) {
      const { GLTFLoader } = await import("three/addons/loaders/GLTFLoader.js");
      const gltf = await new GLTFLoader().loadAsync(SAFARI_KING_MODEL_URL);
      if (!gltf?.scene) throw new Error(`[Holy Buck] Stage ${stage} King GLB contained no scene.`);

      modelRoot = new THREE.Group();
      const upright = new THREE.Group();
      const facing = new THREE.Group();
      upright.rotation.x = Math.PI;
      facing.rotation.y = Math.PI;
      upright.add(gltf.scene);
      facing.add(upright);
      modelRoot.rotation.set(
        THREE.MathUtils.degToRad(26),
        THREE.MathUtils.degToRad(13),
        0,
      );
      modelRoot.add(facing);

      diagnosticMaterial = stage >= 3
        ? createWildMaterial()
        : new THREE.MeshLambertMaterial({ color: 0x765139 });
      const originalMaterials = new Set();
      modelRoot.traverse((object) => {
        if (!object.isMesh) return;
        modelGeometries.add(object.geometry);
        const materials = Array.isArray(object.material) ? object.material : [object.material];
        materials.forEach((material) => originalMaterials.add(material));
        object.material = diagnosticMaterial;
        object.visible = true;
        object.castShadow = false;
        object.receiveShadow = false;
      });
      if (modelGeometries.size === 0) {
        throw new Error(`[Holy Buck] Stage ${stage} King GLB contained no mesh geometry.`);
      }

      const disposedTextures = new Set();
      originalMaterials.forEach((material) => disposeMaterial(material, disposedTextures));

      modelRoot.updateMatrixWorld(true);
      const bounds = new THREE.Box3().setFromObject(modelRoot, true);
      if (bounds.isEmpty()) throw new Error(`[Holy Buck] Stage ${stage} King bounds were empty.`);
      const size = bounds.getSize(new THREE.Vector3());
      const center = bounds.getCenter(new THREE.Vector3());
      const largestDimension = Math.max(size.x, size.y, size.z, 0.001);
      const normalizedScale = 2 / largestDimension;
      modelRoot.scale.setScalar(normalizedScale);
      modelRoot.position.copy(center).multiplyScalar(-normalizedScale);
      modelRoot.updateMatrixWorld(true);

      const fittedSize = new THREE.Box3()
        .setFromObject(modelRoot, true)
        .getSize(new THREE.Vector3());
      let fittedCameraZ = camera.position.z;
      const fitCamera = () => {
        const containerBounds = container.getBoundingClientRect();
        const viewportWidth = Math.max(1, Math.round(containerBounds.width || window.innerWidth));
        const viewportHeight = Math.max(1, Math.round(containerBounds.height || window.innerHeight));
        renderer.setSize(viewportWidth, viewportHeight, false);
        camera.aspect = viewportWidth / viewportHeight;
        const verticalFov = THREE.MathUtils.degToRad(camera.fov);
        const horizontalFov = 2 * Math.atan(Math.tan(verticalFov / 2) * camera.aspect);
        const fitDistance = Math.max(
          fittedSize.y / (2 * Math.tan(verticalFov / 2)),
          fittedSize.x / (2 * Math.tan(horizontalFov / 2)),
        );
        fittedCameraZ = fitDistance * (stage >= 4 ? 1.08 : 1.18) + fittedSize.z * 0.5;
        camera.position.z = fittedCameraZ;
        camera.far = fittedCameraZ + 10;
        camera.updateProjectionMatrix();
      };
      fitCamera();

      scene.add(new THREE.HemisphereLight(0xffe1b8, 0x080705, stage >= 3 ? 1.45 : 2.2));
      if (stage >= 3) {
        const keyLight = new THREE.DirectionalLight(0xffc98f, 2.15);
        keyLight.position.set(2.4, 3.1, 4.2);
        keyLight.castShadow = false;
        scene.add(keyLight);
      }
      scene.add(modelRoot);
      modelRoot.visible = true;
      modelLoaded = true;
      renderer.render(scene, camera);

      if (stage >= 3) {
        const intro = document.querySelector("[data-intro]");
        const baseRotation = modelRoot.rotation.clone();
        const basePosition = modelRoot.position.clone();
        let introTop = 0;
        let scrollRange = 1;
        let targetProgress = 0;
        let currentProgress = 0;
        let renderActive = true;
        let pageVisible = document.visibilityState === "visible";
        let lastTime = performance.now();

        const updateScrollMetrics = () => {
          introTop = intro?.offsetTop ?? 0;
          scrollRange = Math.max(
            1,
            (intro?.offsetHeight ?? window.innerHeight) - window.innerHeight,
          );
        };
        const readScrollProgress = () => {
          targetProgress = THREE.MathUtils.clamp(
            (window.scrollY - introTop) / scrollRange,
            0,
            1,
          );
        };
        const scheduleFrame = () => {
          if (animationFrameId || destroyed || !renderActive || !pageVisible) return;
          animationFrameId = requestAnimationFrame(renderFrame);
        };
        const renderFrame = (time) => {
          animationFrameId = 0;
          if (destroyed || !renderActive) {
            return;
          }
          const delta = Math.min((time - lastTime) / 1000, 0.05);
          lastTime = time;
          const damping = 1 - Math.exp(-9 * delta);
          currentProgress += (targetProgress - currentProgress) * damping;
          const seconds = time * 0.001;

          const idleRotationX = stage >= 4 ? Math.sin(seconds * 0.42) * 0.042 : Math.sin(seconds * 0.31) * 0.012;
          const idleRotationY = stage >= 4 ? Math.sin(seconds * 0.3) * 0.13 : Math.sin(seconds * 0.23) * 0.018;
          const idleFloat = stage >= 4 ? Math.sin(seconds * 0.58) * 0.038 : 0;
          modelRoot.rotation.x = baseRotation.x + idleRotationX - currentProgress * 0.045;
          modelRoot.rotation.y = baseRotation.y + idleRotationY + currentProgress * 0.14;
          modelRoot.rotation.z =
            baseRotation.z + (stage >= 4 ? Math.sin(seconds * 0.26) * 0.018 : 0) - currentProgress * 0.018;
          modelRoot.position.x = basePosition.x - currentProgress * 0.045;
          modelRoot.position.y = basePosition.y + idleFloat + currentProgress * 0.055;
          camera.position.x = currentProgress * 0.035;
          camera.position.z = fittedCameraZ + currentProgress * 0.06;
          renderer.render(scene, camera);
          scheduleFrame();
        };
        const startRendering = () => {
          lastTime = performance.now();
          scheduleFrame();
        };
        const onScroll = () => readScrollProgress();
        const onResize = () => {
          updateScrollMetrics();
          readScrollProgress();
          fitCamera();
          renderer.render(scene, camera);
        };
        const onVisibilityChange = () => {
          pageVisible = document.visibilityState === "visible";
          if (pageVisible) startRendering();
          else {
            cancelAnimationFrame(animationFrameId);
            animationFrameId = 0;
          }
        };
        refreshStage3Layout = onResize;

        updateSequenceProgress = (progress) => {
          targetProgress = THREE.MathUtils.clamp(progress, 0, 1);
        };
        updateRenderActive = (active) => {
          renderActive = Boolean(active);
          if (renderActive) startRendering();
          else {
            cancelAnimationFrame(animationFrameId);
            animationFrameId = 0;
          }
        };

        updateScrollMetrics();
        readScrollProgress();
        window.addEventListener("scroll", onScroll, { passive: true });
        window.addEventListener("resize", onResize, { passive: true });
        if (stage >= 4) document.addEventListener("visibilitychange", onVisibilityChange);
        removeStage3Listeners = () => {
          window.removeEventListener("scroll", onScroll);
          window.removeEventListener("resize", onResize);
          document.removeEventListener("visibilitychange", onVisibilityChange);
        };
        startRendering();
      }
    }

    return {
      stage,
      refresh: refreshStage3Layout,
      setRenderActive: updateRenderActive,
      setSequenceProgress: updateSequenceProgress,
      getDiagnostics: () => ({
        stage,
        canvasConnected: Boolean(renderer?.domElement.isConnected),
        canvasVisible: renderer?.domElement.getClientRects().length > 0,
        canvasDisplay: renderer ? getComputedStyle(renderer.domElement).display : null,
        canvasOpacity: renderer ? getComputedStyle(renderer.domElement).opacity : null,
        canvasVisibility: renderer ? getComputedStyle(renderer.domElement).visibility : null,
        canvasWidth: renderer?.domElement.getBoundingClientRect().width ?? 0,
        canvasHeight: renderer?.domElement.getBoundingClientRect().height ?? 0,
        parentVisible: container.getClientRects().length > 0,
        modelLoaded,
        modelVisible: Boolean(modelRoot?.visible),
        animationFrameActive: stage >= 3 ? animationFrameId !== 0 : false,
      }),
      destroy,
    };
  } catch (error) {
    destroy();
    throw error;
  }
}
