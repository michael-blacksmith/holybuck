import * as THREE from "three";

const STAGE_2_MODEL_URL = "./models/king-web.glb";

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
  if (stage !== 1 && stage !== 2) {
    throw new RangeError(`[Holy Buck] iOS Safari diagnostic stage ${stage} is not implemented.`);
  }
  if (!container) {
    throw new Error("[Holy Buck] iOS Safari diagnostic scene container is missing.");
  }

  let renderer;
  let modelRoot;
  let diagnosticMaterial;
  const modelGeometries = new Set();
  let destroyed = false;

  const destroy = () => {
    if (destroyed) return;
    destroyed = true;
    modelRoot?.removeFromParent();
    modelGeometries.forEach((geometry) => geometry.dispose());
    diagnosticMaterial?.dispose();
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

    if (stage === 2) {
      const { GLTFLoader } = await import("three/addons/loaders/GLTFLoader.js");
      const gltf = await new GLTFLoader().loadAsync(STAGE_2_MODEL_URL);
      if (!gltf?.scene) throw new Error("[Holy Buck] Stage 2 King GLB contained no scene.");

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

      diagnosticMaterial = new THREE.MeshLambertMaterial({
        color: 0x765139,
      });
      const originalMaterials = new Set();
      modelRoot.traverse((object) => {
        if (!object.isMesh) return;
        modelGeometries.add(object.geometry);
        const materials = Array.isArray(object.material) ? object.material : [object.material];
        materials.forEach((material) => originalMaterials.add(material));
        object.material = diagnosticMaterial;
        object.castShadow = false;
        object.receiveShadow = false;
      });
      if (modelGeometries.size === 0) {
        throw new Error("[Holy Buck] Stage 2 King GLB contained no mesh geometry.");
      }

      const disposedTextures = new Set();
      originalMaterials.forEach((material) => disposeMaterial(material, disposedTextures));

      modelRoot.updateMatrixWorld(true);
      const bounds = new THREE.Box3().setFromObject(modelRoot, true);
      if (bounds.isEmpty()) throw new Error("[Holy Buck] Stage 2 King bounds were empty.");
      const size = bounds.getSize(new THREE.Vector3());
      const center = bounds.getCenter(new THREE.Vector3());
      const largestDimension = Math.max(size.x, size.y, size.z, 0.001);
      const normalizedScale = 2 / largestDimension;
      modelRoot.scale.setScalar(normalizedScale);
      modelRoot.position.copy(center).multiplyScalar(-normalizedScale);
      modelRoot.updateMatrixWorld(true);

      const fittedBounds = new THREE.Box3().setFromObject(modelRoot, true);
      const fittedSize = fittedBounds.getSize(new THREE.Vector3());
      const verticalFov = THREE.MathUtils.degToRad(camera.fov);
      const horizontalFov = 2 * Math.atan(Math.tan(verticalFov / 2) * camera.aspect);
      const fitDistance = Math.max(
        fittedSize.y / (2 * Math.tan(verticalFov / 2)),
        fittedSize.x / (2 * Math.tan(horizontalFov / 2)),
      );
      camera.position.z = fitDistance * 1.18 + fittedSize.z * 0.5;
      camera.far = camera.position.z + 10;
      camera.updateProjectionMatrix();

      scene.add(
        new THREE.HemisphereLight(0xffe1b8, 0x080705, 2.2),
        modelRoot,
      );
      renderer.render(scene, camera);
    }

    return {
      stage,
      destroy,
    };
  } catch (error) {
    destroy();
    throw error;
  }
}
