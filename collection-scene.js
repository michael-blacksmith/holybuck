import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

const container = document.querySelector("[data-collection-scene]");

if (container) {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(31, 1, 0.1, 30);
  camera.position.set(0, 0.04, 4.6);

  const renderer = new THREE.WebGLRenderer({
    alpha: true,
    antialias: true,
    powerPreference: "high-performance",
  });
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.02;
  container.appendChild(renderer.domElement);

  const rig = new THREE.Group();
  scene.add(rig);

  const hemisphere = new THREE.HemisphereLight(0xd8d0c4, 0x090706, 0.74);
  const key = new THREE.SpotLight(0xffdfbd, 142, 15, Math.PI / 4.5, 0.58, 1.4);
  const rim = new THREE.SpotLight(0xb76e3b, 92, 14, Math.PI / 4, 0.62, 1.5);
  key.position.set(3.2, 3.6, 4.5);
  rim.position.set(-3.4, 1.4, -2.8);
  scene.add(hemisphere, key, key.target, rim, rim.target);

  let model = null;
  let fadeMaterials = [];
  let revealStartedAt = 0;
  let frame = 0;
  let lastTime = 0;
  let active = true;
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const resize = () => {
    const width = Math.max(container.clientWidth, 1);
    const height = Math.max(container.clientHeight, 1);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, width <= 640 ? 1.1 : 1.3));
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    if (model) {
      const largeDesktop = width >= 1000;
      const responsiveScale = width <= 640 ? 1.58 : largeDesktop ? 2.36 : 2.2;
      model.scale.setScalar(responsiveScale);
      model.position.set(
        width <= 640 ? -0.02 : largeDesktop ? -0.85 : 0.16,
        width <= 640 ? 0.16 : -0.15,
        0,
      );
    }
  };

  const render = (time) => {
    frame = 0;
    if (!active || document.hidden) return;
    const delta = lastTime ? Math.min((time - lastTime) / 1000, 0.05) : 0;
    lastTime = time;

    if (model && !reducedMotion) {
      model.rotation.y = Math.sin(time * 0.00016) * 0.022;
      model.rotation.x = Math.sin(time * 0.00011) * 0.006;
    }
    if (revealStartedAt) {
      const progress = THREE.MathUtils.clamp((time - revealStartedAt) / 720, 0, 1);
      const eased = progress * progress * (3 - 2 * progress);
      fadeMaterials.forEach(({ material, opacity }) => {
        material.opacity = opacity * eased;
      });
      if (progress === 1) revealStartedAt = 0;
    }

    renderer.render(scene, camera);
    frame = requestAnimationFrame(render);
  };

  const start = () => {
    if (!frame && active && !document.hidden) frame = requestAnimationFrame(render);
  };

  resize();
  new ResizeObserver(resize).observe(container);

  const visibilityObserver = new IntersectionObserver((entries) => {
    active = entries[0]?.isIntersecting ?? false;
    if (active) {
      lastTime = 0;
      start();
    } else if (frame) {
      cancelAnimationFrame(frame);
      frame = 0;
    }
  });
  visibilityObserver.observe(container);

  new GLTFLoader().load(
    "./models/king-web.glb",
    (gltf) => {
      try {
        const upright = new THREE.Group();
        upright.rotation.x = Math.PI;
        upright.add(gltf.scene);
        const facing = new THREE.Group();
        facing.rotation.set(0.035, Math.PI + 0.22, -0.025);
        facing.add(upright);
        facing.updateMatrixWorld(true);

        const bounds = new THREE.Box3().setFromObject(facing, true);
        const size = bounds.getSize(new THREE.Vector3());
        const center = bounds.getCenter(new THREE.Vector3());
        facing.position.sub(center);
        const normalized = new THREE.Group();
        normalized.scale.setScalar(1 / Math.max(size.x, size.y, size.z, 0.001));
        normalized.add(facing);

        fadeMaterials = [];
        facing.traverse((child) => {
          if (!child.isMesh) return;
          const sourceMaterials = Array.isArray(child.material) ? child.material : [child.material];
          const materials = sourceMaterials.map((source) => {
            const material = new THREE.MeshPhysicalMaterial({
              color: 0x493025,
              metalness: 0.88,
              roughness: 0.43,
              clearcoat: 0.045,
              clearcoatRoughness: 0.58,
              normalMap: source?.normalMap ?? null,
              envMapIntensity: 0.78,
              side: THREE.DoubleSide,
              transparent: true,
              opacity: 0,
            });
            fadeMaterials.push({ material, opacity: 1 });
            source?.dispose();
            return material;
          });
          child.material = Array.isArray(child.material) ? materials : materials[0];
        });

        model = new THREE.Group();
        model.add(normalized);
        rig.add(model);
        resize();
        renderer.compile(scene, camera);
        revealStartedAt = performance.now();
        container.classList.add("is-ready");
        start();
      } catch (error) {
        console.error("[Holy Buck] The Royal Collection sculpture could not be prepared.", error);
      }
    },
    undefined,
    (error) => {
      console.error("[Holy Buck] The Royal Collection sculpture GLB failed to load.", error);
    },
  );

  start();
}
