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

// Keep Three.js and every dependent WebGL/model module out of iOS Safari for
// Diagnostic V3. Other browsers begin fetching the existing scene immediately.
const kingSceneModulePromise = IS_IOS_SAFARI
  ? null
  : import("./king-scene.js?v=20260923-fire-wave5");

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
let destroyHomepageAnimations = () => {};

const diagnosticSceneApi = Object.freeze({
  setRenderActive() {},
  setScrollProgress() {},
  setSequenceProgress() {},
  setShowcasePresentation() {},
});

async function startIOSSafariDiagnostic() {
  document.documentElement.classList.add("is-ready", "no-webgl", "ios-safari-diagnostic-v3");
  sceneContainer?.setAttribute("hidden", "");
  sceneContainer?.setAttribute("aria-hidden", "true");

  window.__HOLY_BUCK__ = Object.freeze({
    diagnostics: () => ({
      iosSafariDiagnostic: true,
      webglInitialized: false,
      modelStatus: "bypassed",
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
    sceneApi?.destroy();
  },
  { once: true },
);
