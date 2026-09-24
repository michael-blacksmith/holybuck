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
// 3 = lightweight WILD; 4 = visible WILD motion; 5 = restored desktop intro flow;
// 6 = Safari-owned WILD -> DIGITIZED -> FORMED cinematic overlay.
const IOS_SAFARI_3D_STAGE = 6;

// Keep the complete desktop King pipeline out of iOS Safari. Other browsers
// begin fetching the existing production scene immediately and remain unchanged.
const kingSceneModulePromise = IS_IOS_SAFARI
  ? null
  : import("./king-scene.js?v=20260923-fire-wave5");
const iosSafariSceneModulePromise =
  IS_IOS_SAFARI && IOS_SAFARI_3D_STAGE >= 1
    ? import("./ios-safari-diagnostic-scene.js?v=20260923-stage6")
    : null;

const USE_IOS_SAFARI_CINEMATIC = IS_IOS_SAFARI && IOS_SAFARI_3D_STAGE >= 2;

if (USE_IOS_SAFARI_CINEMATIC && window.location.hash) {
  history.replaceState(history.state, "", `${window.location.pathname}${window.location.search}`);
}

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
let iosSafariCinematicOverlay;
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

function createIOSSafariCinematicOverlay() {
  if (!sceneContainer) throw new Error("[Holy Buck] Safari cinematic scene container is missing.");

  const element = document.createElement("section");
  element.className = "ios-safari-cinematic";
  element.setAttribute("data-ios-safari-cinematic", "");
  element.setAttribute("aria-label", "The King transformation");
  element.innerHTML = `
    <div class="ios-safari-cinematic__scene" data-ios-safari-scene></div>
    <header class="ios-safari-cinematic__header">
      <span class="ios-safari-cinematic__brand">HOLY BUCK</span>
      <button class="ios-safari-cinematic__skip" type="button" data-ios-safari-skip>SKIP INTRO</button>
    </header>
    <h2 class="ios-safari-cinematic__stage" data-ios-safari-stage>WILD</h2>
    <span class="ios-safari-cinematic__cue">CAST TO LAST</span>
  `;

  const sceneMount = element.querySelector("[data-ios-safari-scene]");
  const stageLabel = element.querySelector("[data-ios-safari-stage]");
  const skipButton = element.querySelector("[data-ios-safari-skip]");
  let resolveSkip;
  const skipped = new Promise((resolve) => {
    resolveSkip = resolve;
  });
  const skip = () => resolveSkip({ completed: false, skipped: true });
  skipButton.addEventListener("click", skip, { once: true });

  sceneMount.append(sceneContainer);
  document.body.append(element);
  document.documentElement.classList.add("ios-safari-cinematic-active");

  return {
    element,
    skipped,
    setStage(stageName) {
      const normalized = String(stageName).toLowerCase();
      element.dataset.stage = normalized;
      stageLabel.textContent = String(stageName).toUpperCase();
    },
    async fadeOut() {
      document.documentElement.classList.add("ios-safari-cinematic-releasing");
      element.classList.add("is-complete");
      await new Promise((resolve) => setTimeout(resolve, 680));
    },
    destroy() {
      skipButton.removeEventListener("click", skip);
      element.remove();
      document.documentElement.classList.remove(
        "ios-safari-cinematic-active",
        "ios-safari-cinematic-releasing",
      );
    },
  };
}

async function revealWebsiteAfterSafariCinematic({ hideLoading = false } = {}) {
  document.documentElement.classList.remove("ios-safari-cinematic-active");
  document.documentElement.classList.remove("ios-safari-cinematic-releasing");
  document.documentElement.classList.add("is-ready", "no-webgl", "ios-safari-diagnostic-v4");
  resetScrollPosition();
  destroyHomepageAnimations = initHomepageAnimations(diagnosticSceneApi);
  if (hideLoading) await loading.hide();
  window.ScrollTrigger?.refresh?.();
  requestAnimationFrame(() => requestAnimationFrame(resetScrollPosition));
}

async function startIOSSafariStage6() {
  let activeStage = 0;
  let sequenceComplete = false;

  try {
    iosSafariCinematicOverlay = createIOSSafariCinematicOverlay();
    const { initIOSSafariDiagnosticScene } = await iosSafariSceneModulePromise;
    iosSafariDiagnosticScene = await initIOSSafariDiagnosticScene(sceneContainer, {
      stage: IOS_SAFARI_3D_STAGE,
    });
    activeStage = iosSafariDiagnosticScene.stage;
    document.documentElement.classList.add("is-ready", "ios-safari-diagnostic-v4");
    document.documentElement.classList.remove("no-webgl");
    document.documentElement.setAttribute("data-ios-safari-3d-stage", String(activeStage));
    sceneContainer.removeAttribute("hidden");
    sceneContainer.setAttribute("aria-hidden", "true");
    iosSafariDiagnosticScene.refresh?.();

    window.__HOLY_BUCK__ = Object.freeze({
      diagnostics: () => ({
        iosSafariDiagnostic: true,
        configuredStage: IOS_SAFARI_3D_STAGE,
        activeStage,
        sequenceComplete,
        modelUrl: "./models/king-web.glb",
        scene: iosSafariDiagnosticScene?.getDiagnostics?.() ?? null,
      }),
    });

    loading.setProgress(1);
    await loading.hide();
    iosSafariDiagnosticScene.refresh?.();
    iosSafariDiagnosticScene.setRenderActive?.(true);

    const sequence = iosSafariDiagnosticScene.startSequence({
      onStageChange: (stageName) => iosSafariCinematicOverlay?.setStage(stageName),
    });
    const result = await Promise.race([sequence, iosSafariCinematicOverlay.skipped]);
    sequenceComplete = Boolean(result?.completed);
    await iosSafariCinematicOverlay.fadeOut();

    iosSafariDiagnosticScene.destroy();
    iosSafariDiagnosticScene = undefined;
    iosSafariCinematicOverlay.destroy();
    iosSafariCinematicOverlay = undefined;
    await revealWebsiteAfterSafariCinematic();
  } catch (error) {
    console.error("[Holy Buck] Safari Stage 6 failed; revealing the stable website.", error);
    iosSafariDiagnosticScene?.destroy();
    iosSafariDiagnosticScene = undefined;
    iosSafariCinematicOverlay?.destroy();
    iosSafariCinematicOverlay = undefined;
    activeStage = 0;
    document.documentElement.setAttribute("data-ios-safari-3d-stage", "0");
    await revealWebsiteAfterSafariCinematic({ hideLoading: true });
  }
}

function initIOSSafariWildIntroFlow() {
  const intro = document.querySelector("[data-intro]");
  const pin = document.querySelector("[data-intro-pin]");
  const sceneShell = document.querySelector("[data-scene-shell]");
  const skipButton = document.querySelector("[data-skip-intro]");
  const wild = document.querySelector('[data-stage="wild"]');
  const laterStages = document.querySelectorAll('[data-stage]:not([data-stage="wild"])');

  if (!intro || !pin || !sceneShell || !wild) {
    throw new Error("[Holy Buck] Safari WILD intro structure is incomplete.");
  }

  intro.hidden = false;
  intro.removeAttribute("aria-hidden");
  intro.dataset.safariIntroActive = "true";
  pin.hidden = false;
  sceneShell.dataset.websiteState = "intro";
  sceneShell.style.opacity = "1";
  sceneShell.style.visibility = "visible";
  sceneShell.style.transform = "none";
  wild.style.opacity = "1";
  wild.style.visibility = "visible";
  wild.style.transform = "translateY(-50%)";
  laterStages.forEach((stageElement) => {
    stageElement.style.opacity = "0";
    stageElement.style.visibility = "hidden";
  });

  const skip = () => document.querySelector("#home")?.scrollIntoView({ behavior: "smooth" });
  skipButton?.addEventListener("click", skip);
  diagnosticSceneApi.setSequenceProgress(0);
  diagnosticSceneApi.setRenderActive(true);

  return {
    refresh() {
      intro.hidden = false;
      sceneShell.dataset.websiteState = "intro";
      sceneShell.style.opacity = "1";
      sceneShell.style.visibility = "visible";
      diagnosticSceneApi.setRenderActive(true);
      iosSafariDiagnosticScene?.refresh?.();
    },
    destroy() {
      skipButton?.removeEventListener("click", skip);
    },
  };
}

async function startIOSSafariDiagnostic() {
  if (IOS_SAFARI_3D_STAGE >= 6) {
    await startIOSSafariStage6();
    return;
  }

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

  if (activeStage >= 4) {
    const sceneShell = document.querySelector("[data-scene-shell]");
    const introViewport = document.querySelector("[data-intro-pin]");
    if (sceneShell && introViewport) {
      introViewport.prepend(sceneShell);
    } else {
      console.error(
        "[Holy Buck] Safari Stage 4 intro compositing targets are missing; using Stage 0.",
      );
      iosSafariDiagnosticScene?.destroy();
      iosSafariDiagnosticScene = undefined;
      activeStage = 0;
    }
  }

  document.documentElement.classList.add("is-ready", "ios-safari-diagnostic-v4");
  document.documentElement.setAttribute("data-ios-safari-3d-stage", String(activeStage));

  if (activeStage >= 2) {
    try {
      document.documentElement.classList.remove("no-webgl");
      sceneContainer?.removeAttribute("hidden");
      sceneContainer?.setAttribute("aria-hidden", "true");
      resetScrollPosition();
      introTimeline = initIOSSafariWildIntroFlow();
    } catch (error) {
      console.error("[Holy Buck] Safari intro initialization failed; using Stage 0.", error);
      introTimeline?.destroy();
      introTimeline = undefined;
      iosSafariDiagnosticScene?.destroy();
      iosSafariDiagnosticScene = undefined;
      activeStage = 0;
      document.documentElement.setAttribute("data-ios-safari-3d-stage", "0");
    }
  }

  if (activeStage < 2) {
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
      scene: iosSafariDiagnosticScene?.getDiagnostics?.() ?? null,
    }),
  });

  if (activeStage >= 2) resetScrollPosition();
  destroyHomepageAnimations = initHomepageAnimations(diagnosticSceneApi);
  introTimeline?.refresh();
  loading.setProgress(1);
  await loading.hide();
  window.ScrollTrigger?.refresh?.();

  if (activeStage >= 2) {
    resetScrollPosition();
    introTimeline?.refresh();
    window.ScrollTrigger?.refresh?.();
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        resetScrollPosition();
        introTimeline?.refresh();
      });
    });
  } else if (window.location.hash) restoreInitialAnchor();
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
    iosSafariCinematicOverlay?.destroy();
    iosSafariDiagnosticScene?.destroy();
    sceneApi?.destroy();
  },
  { once: true },
);
