import { initHomepageAnimations } from "./animations.js?v=20260923-regression-fix";
import { initIntroTimeline } from "./intro-timeline.js?v=20260923-regression-fix";
import { initLoadingLayer } from "./loading.js?v=20260923-regression-fix";

const userAgent = navigator.userAgent;
const isIOSOrIPadOS =
  /iPad|iPhone|iPod/i.test(userAgent) ||
  (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
const isAlternateIOSBrowser =
  /CriOS|FxiOS|EdgiOS|OPiOS|GSA|DuckDuckGo|Brave|YaBrowser|Coast|FocusiOS/i.test(
    userAgent,
  );
const IS_IOS_SAFARI =
  isIOSOrIPadOS &&
  /AppleWebKit/i.test(userAgent) &&
  /Safari/i.test(userAgent) &&
  !isAlternateIOSBrowser;

// iOS Safari diagnostic ladder. Change only this value between device tests.
// 0 = V3 stable website; 1 = empty renderer; 2 = optimized King GLB;
// 3 = lightweight WILD presentation and movement on that same geometry.
const IOS_SAFARI_3D_STAGE = 3;

// Keep the complete desktop King pipeline out of iOS Safari. Other browsers
// begin fetching the existing production scene immediately and remain unchanged.
const kingSceneModulePromise = IS_IOS_SAFARI
  ? null
  : import("./king-scene.js?v=20260923-fire-wave5");
const iosSafariSceneModulePromise =
  IS_IOS_SAFARI && IOS_SAFARI_3D_STAGE >= 1
    ? import("./ios-safari-diagnostic-scene.js?v=20260923-stage3")
    : null;

function resetScrollPosition() {
  const root = document.documentElement;
  const previousBehavior = root.style.scrollBehavior;
  root.style.scrollBehavior = "auto";
  window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  root.style.scrollBehavior = previousBehavior;
}

function restoreInitialAnchor() {
  const id = decodeURIComponent(window.location.hash.slice(1));
  const target = id ? document.getElementById(id) : null;
  if (!target) return;

  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      target.scrollIntoView({ behavior: "auto", block: "start" });
    });
  });
}

if ("scrollRestoration" in history) history.scrollRestoration = "manual";
if (!window.location.hash) resetScrollPosition();
window.addEventListener(
  "pageshow",
  () => {
    if (!window.location.hash) resetScrollPosition();
  },
  { once: true },
);

const sceneContainer = document.querySelector("[data-king-scene]");
const loading = initLoadingLayer(document.querySelector("[data-loading-layer]"));

let sceneApi;
let introTimeline;
let iosSafariDiagnosticScene;
let destroyIOSSafariDiagnosticUi = () => {};
let destroyHomepageAnimations = () => {};

const diagnosticSceneApi = Object.freeze({
  setRenderActive(active) {
    iosSafariDiagnosticScene?.setRenderActive?.(active);
  },
  setScrollProgress() {},
  setSequenceProgress(progress) {
    iosSafariDiagnosticScene?.setSequenceProgress?.(progress);
  },
  setShowcasePresentation() {},
});

async function startIOSSafariDiagnostic() {
  let activeStage = 0;

  if (IOS_SAFARI_3D_STAGE >= 1) {
    try {
      const { initIOSSafariDiagnosticScene } = await iosSafariSceneModulePromise;
      iosSafariDiagnosticScene = await initIOSSafariDiagnosticScene(sceneContainer, {
        stage: IOS_SAFARI_3D_STAGE,
      });
      activeStage = iosSafariDiagnosticScene.stage;
    } catch (error) {
      iosSafariDiagnosticScene?.destroy();
      iosSafariDiagnosticScene = undefined;
      console.error(
        `[Holy Buck] iOS Safari Diagnostic V4 Stage ${IOS_SAFARI_3D_STAGE} failed; using Stage 0.`,
        error,
      );
    }
  }

  document.documentElement.classList.add("is-ready", "ios-safari-diagnostic-v4");
  document.documentElement.setAttribute("data-ios-safari-3d-stage", String(activeStage));

  if (activeStage >= 2) {
    document.documentElement.classList.remove("no-webgl");
    sceneContainer?.removeAttribute("hidden");
    sceneContainer?.setAttribute("aria-hidden", "true");
    iosSafariDiagnosticScene?.refresh?.();

    const skipButton = document.querySelector("[data-skip-intro]");
    const skip = () => document.querySelector("#home")?.scrollIntoView({ behavior: "smooth" });
    skipButton?.addEventListener("click", skip);
    destroyIOSSafariDiagnosticUi = () => skipButton?.removeEventListener("click", skip);
  } else {
    document.documentElement.classList.add("no-webgl");
    sceneContainer?.setAttribute("hidden", "");
    sceneContainer?.setAttribute("aria-hidden", "true");
  }

  window.__HOLY_BUCK__ = Object.freeze({
    diagnostics: () => ({
      iosSafariDiagnostic: true,
      configuredStage: IOS_SAFARI_3D_STAGE,
      activeStage,
      webglInitialized: activeStage >= 1,
      modelStatus: activeStage >= 2 ? "loaded" : activeStage === 1 ? "empty-scene" : "bypassed",
      modelUrl: activeStage >= 2 ? "./models/king-web.glb" : null,
    }),
  });

  destroyHomepageAnimations = initHomepageAnimations(diagnosticSceneApi);
  loading.setProgress(1);
  await loading.hide();
  window.ScrollTrigger?.refresh?.();

  if (window.location.hash) restoreInitialAnchor();
  else resetScrollPosition();
}

async function startExperience() {
  try {
    if (IS_IOS_SAFARI) {
      await startIOSSafariDiagnostic();
      return;
    }

    const { initKingScene } = await kingSceneModulePromise;
    sceneApi = initKingScene(sceneContainer, {
      onLoadProgress: (progress) => loading.setProgress(progress),
      naturalModelUrls: ["./models/king-right-natural.glb"],
      modelUrls: ["./models/king-web.glb", "./models/king.glb"],
      castingPatternUrls: [
        "./models/plakingforwebsite-web.glb",
        "./models/plakingforwebsite.glb",
      ],
    });

    window.__HOLY_BUCK__ = Object.freeze({
      diagnostics: () => sceneApi.getDiagnostics(),
    });

    const model = await sceneApi.ready;
    const diagnostics = sceneApi.getDiagnostics();
    sceneContainer.dataset.activeModel = diagnostics.modelUrl ?? "fallback";
    sceneContainer.dataset.modelStatus = diagnostics.modelStatus;
    loading.setProgress(1);

    document.documentElement.classList.add("is-ready");
    if (!window.location.hash) {
      resetScrollPosition();
    }
    introTimeline = initIntroTimeline(sceneApi);
    destroyHomepageAnimations = initHomepageAnimations(sceneApi);
    introTimeline.refresh();
    if (window.location.hash) {
      restoreInitialAnchor();
    } else {
      const settleAtIntroStart = () => {
        resetScrollPosition();
        sceneApi.setSequenceProgress(0);
      };
      requestAnimationFrame(() => requestAnimationFrame(settleAtIntroStart));
    }

    const revealPromise = sceneApi.reveal(720).catch((error) => {
      console.error("[Holy Buck] The King reveal could not complete.", error);
    });
    await loading.hide();
    if (!window.location.hash) {
      resetScrollPosition();
      sceneApi.setSequenceProgress(0);
      introTimeline.refresh();
    } else {
      restoreInitialAnchor();
    }
    void revealPromise;

  } catch (error) {
    console.error("[Holy Buck] The cinematic experience could not initialize.", error);
    await loading.hide();
    document.documentElement.classList.add("is-ready", "no-webgl");
  }
}

startExperience();

const inquiryForm = document.querySelector("[data-inquiry-form]");
inquiryForm?.addEventListener("submit", (event) => {
  const destination = inquiryForm.dataset.liveDestination;
  if (!destination) return;
  event.preventDefault();
  if (inquiryForm.reportValidity()) window.location.assign(destination);
});

window.addEventListener(
  "pagehide",
  () => {
    introTimeline?.destroy();
    destroyHomepageAnimations();
    destroyIOSSafariDiagnosticUi();
    iosSafariDiagnosticScene?.destroy();
    sceneApi?.destroy();
  },
  { once: true },
);
