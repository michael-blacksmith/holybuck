const STAGES = [
  { id: "wild", start: 0, end: 0.185 },
  { id: "digitized", start: 0.12, end: 0.405 },
  { id: "formed", start: 0.34, end: 0.625 },
  { id: "cast", start: 0.775, end: 0.957 },
];

function clamp(value, minimum = 0, maximum = 1) {
  return Math.min(Math.max(value, minimum), maximum);
}

function smoothstep(value) {
  const clamped = clamp(value);
  return clamped * clamped * (3 - 2 * clamped);
}

function stageVisibility(progress, stage, index) {
  if (progress < stage.start || progress > stage.end) return 0;
  const local = (progress - stage.start) / (stage.end - stage.start);
  const fadeIn = index === 0 ? 1 : smoothstep(local / 0.18);
  const fadeOut = 1 - smoothstep((local - 0.7) / 0.3);
  return fadeIn * fadeOut;
}

function getIntroPhase(progress) {
  if (progress < 0.14) return "wild";
  if (progress < 0.38) return "digitized";
  if (progress < 0.57) return "formed";
  if (progress < 0.79) return "transformation";
  if (progress < 0.95) return "cast";
  return "blackout";
}

export function initIntroTimeline(sceneApi) {
  const gsap = window.gsap;
  const ScrollTrigger = window.ScrollTrigger;
  const intro = document.querySelector("[data-intro]");
  const pin = document.querySelector("[data-intro-pin]");
  const skipButton = document.querySelector("[data-skip-intro]");
  const introScrollCue = document.querySelector("[data-intro-scroll-cue]");
  const titleStack = document.querySelector("[data-intro-titles]");
  const atmosphere = document.querySelector(".intro-atmosphere");
  const sceneGlow = document.querySelector(".scene-shell__glow");
  const castGlow = document.querySelector(".scene-shell__cast-glow");
  const heatVeil = document.querySelector("[data-heat-veil]");
  const blackoutVeil = document.querySelector("[data-blackout-veil]");
  const introHeader = pin?.querySelector(".intro-header");
  const stageElements = new Map(
    [...document.querySelectorAll("[data-stage]")].map((element) => [
      element.dataset.stage,
      element,
    ]),
  );
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  if (!intro || !pin || !gsap || !ScrollTrigger) {
    return { destroy() {}, refresh() {} };
  }

  gsap.registerPlugin(ScrollTrigger);

  const skip = () => document.querySelector("#home")?.scrollIntoView({ behavior: "smooth" });

  if (reducedMotion) {
    intro.classList.add("is-reduced-motion");
    sceneApi.setSequenceProgress(0);
    sceneApi.setRenderActive?.(true);
    skipButton?.addEventListener("click", skip);
    return {
      refresh() {},
      destroy() {
        skipButton?.removeEventListener("click", skip);
      },
    };
  }

  const wild = stageElements.get("wild");
  const digitized = stageElements.get("digitized");
  const formed = stageElements.get("formed");
  const cast = stageElements.get("cast");
  gsap.set([...stageElements.values()], { autoAlpha: 0 });

  const update = (progress) => {
    const phase = getIntroPhase(progress);
    intro.dataset.introPhase = phase;
    sceneApi.setRenderActive?.(true);
    sceneApi.setSequenceProgress(progress);

    if (introScrollCue) {
      const cueVisibility = 1 - smoothstep(progress / 0.075);
      introScrollCue.style.opacity = String(cueVisibility);
      introScrollCue.style.transform = `translateY(${(1 - cueVisibility) * 8}px)`;
    }

    const wildStage = STAGES[0];
    const wildLocal = clamp((progress - wildStage.start) / (wildStage.end - wildStage.start));
    gsap.set(wild, {
      autoAlpha: stageVisibility(progress, wildStage, 0),
      clipPath: `inset(${(1 - smoothstep(wildLocal / 0.44)) * 58}% 0 0 0)`,
      filter: `brightness(${0.48 + smoothstep(wildLocal / 0.5) * 0.52})`,
      scale: 0.975 + wildLocal * 0.045,
      yPercent: -50 + wildLocal * 1.1,
    });

    const digitizedStage = STAGES[1];
    const digitizedLocal = clamp(
      (progress - digitizedStage.start) / (digitizedStage.end - digitizedStage.start),
    );
    const scanProgress = smoothstep((progress - 0.15) / 0.19);
    const mobile = window.innerWidth <= 640;
    const scanStart = mobile ? 25 : 52;
    const scanEnd = mobile ? 76 : 82;
    titleStack?.style.setProperty(
      "--scan-x",
      `${scanStart + (scanEnd - scanStart) * scanProgress}%`,
    );
    gsap.set(digitized, {
      autoAlpha: stageVisibility(progress, digitizedStage, 1),
      clipPath: `inset(0 ${(1 - scanProgress) * 100}% 0 0)`,
      yPercent: -50,
      xPercent: -50,
      x: 0,
      scale: 0.985 + digitizedLocal * 0.015,
    });

    const formedStage = STAGES[2];
    const formedLocal = clamp(
      (progress - formedStage.start) / (formedStage.end - formedStage.start),
    );
    const assemblyProgress = smoothstep((progress - 0.38) / 0.18);
    gsap.set(formed, {
      autoAlpha: stageVisibility(progress, formedStage, 2),
      clipPath: `inset(${(1 - assemblyProgress) * 100}% 0 0 0)`,
      filter: `brightness(${0.58 + assemblyProgress * 0.42})`,
      y: 14 - formedLocal * 14,
      scale: 0.975 + formedLocal * 0.035,
    });

    const castStage = STAGES[3];
    const castLocal = clamp((progress - castStage.start) / (castStage.end - castStage.start));
    const castReveal = smoothstep((progress - 0.785) / 0.055);
    gsap.set(cast, {
      autoAlpha: smoothstep((progress - castStage.start) / 0.035) *
        (1 - smoothstep((progress - 0.933) / 0.024)),
      clipPath: `inset(0 ${(1 - castReveal) * 100}% 0 0)`,
      filter: `brightness(${0.5 + castReveal * 0.5})`,
      scale: 0.95 + castLocal * 0.05,
      yPercent: -50,
    });

    const fireStrength =
      smoothstep((progress - 0.52) / 0.105) *
      (1 - smoothstep((progress - 0.775) / 0.095));
    const bronzeReveal = smoothstep((progress - 0.65) / 0.19);
    const finalBlackout = smoothstep((progress - 0.965) / 0.02);
    const interfaceFade = smoothstep((progress - 0.9) / 0.05);

    if (atmosphere) atmosphere.style.opacity = String(fireStrength * 0.24);
    if (heatVeil) heatVeil.style.opacity = String(fireStrength * 0.3);
    if (blackoutVeil) blackoutVeil.style.opacity = String(finalBlackout);
    if (titleStack) titleStack.style.opacity = String(1 - finalBlackout);
    if (introHeader) introHeader.style.opacity = String(1 - interfaceFade);
    if (castGlow) {
      const glowStrength = fireStrength * 0.22 + bronzeReveal * 0.3;
      castGlow.style.opacity = String(glowStrength * (1 - finalBlackout));
      castGlow.style.transform = `translate(-50%, -50%) scale(${0.84 + glowStrength * 0.3})`;
    }
    if (sceneGlow) {
      sceneGlow.style.opacity = String(
        (0.58 + bronzeReveal * 0.4) * (1 - finalBlackout),
      );
    }
  };

  const trigger = ScrollTrigger.create({
    trigger: intro,
    pin,
    start: 0,
    end: () => `+=${window.innerHeight * (window.innerWidth <= 640 ? 3.8 : 4.05)}`,
    scrub: true,
    anticipatePin: 1,
    invalidateOnRefresh: true,
    onUpdate: (self) => update(self.progress),
    onRefresh: (self) => {
      intro.dataset.timelineStart = self.start.toFixed(2);
      intro.dataset.timelineEnd = self.end.toFixed(2);
      update(self.progress);
    },
    onEnter: () => sceneApi.setRenderActive?.(true),
    onEnterBack: (self) => {
      sceneApi.setRenderActive?.(true);
      update(self.progress);
    },
    onLeave: () => {
      update(1);
      sceneApi.setRenderActive?.(false);
    },
    onLeaveBack: () => update(0),
  });

  skipButton?.addEventListener("click", skip);
  update(trigger.progress);

  return {
    refresh() {
      ScrollTrigger.refresh();
    },
    destroy() {
      skipButton?.removeEventListener("click", skip);
      trigger.kill();
    },
  };
}
