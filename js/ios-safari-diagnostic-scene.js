import * as THREE from "three";

export function initIOSSafariDiagnosticScene(container, { stage = 0 } = {}) {
  if (stage === 0) return null;
  if (stage !== 1) {
    throw new RangeError(`[Holy Buck] iOS Safari diagnostic stage ${stage} is not implemented.`);
  }
  if (!container) {
    throw new Error("[Holy Buck] iOS Safari diagnostic scene container is missing.");
  }

  let renderer;

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

    renderer.domElement.dataset.iosSafariDiagnosticStage = "1";
    container.append(renderer.domElement);
    renderer.render(scene, camera);

    let destroyed = false;
    return {
      stage: 1,
      destroy() {
        if (destroyed) return;
        destroyed = true;
        renderer.domElement.remove();
        renderer.dispose();
        renderer.forceContextLoss();
      },
    };
  } catch (error) {
    renderer?.domElement.remove();
    renderer?.dispose();
    renderer?.forceContextLoss();
    throw error;
  }
}
