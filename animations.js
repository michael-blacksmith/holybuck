function smoothstep(value) {
  const clamped = Math.min(Math.max(value, 0), 1);
  return clamped * clamped * (3 - 2 * clamped);
}

export function initHomepageAnimations(sceneApi) {
  const gsap = window.gsap;
  const ScrollTrigger = window.ScrollTrigger;
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const brandHero = document.querySelector("[data-homepage-brand]");
  const showcase = document.querySelector("[data-king-showcase]");
  const sceneShell = document.querySelector("[data-scene-shell]");
  const siteHeader = document.querySelector("[data-site-header]");
  const brandTitle = brandHero?.querySelector("[data-brand-title]");
  const brandReveal = brandHero ? gsap?.utils.toArray("[data-brand-reveal]", brandHero) ?? [] : [];
  const showcaseTitle = showcase?.querySelector("[data-showcase-title]");
  const showcaseReveal = showcase
    ? gsap?.utils.toArray("[data-showcase-reveal]", showcase) ?? []
    : [];
  const animations = [];

  if (!brandHero || !showcase || !sceneShell || !gsap || !ScrollTrigger) {
    return () => {};
  }

  gsap.registerPlugin(ScrollTrigger);

  if (reducedMotion) {
    return () => {};
  }

  gsap.set(brandReveal, { autoAlpha: 0, y: 14 });
  gsap.set(siteHeader, { autoAlpha: 0, y: -10 });
  gsap.set(brandTitle, {
    autoAlpha: 0,
    clipPath: "inset(0 0 100% 0)",
    yPercent: 12,
  });
  gsap.set(showcaseReveal, { autoAlpha: 0, y: 14 });
  gsap.set(showcaseTitle, {
    autoAlpha: 0,
    clipPath: "inset(0 0 100% 0)",
    yPercent: 12,
  });

  const brandEntrance = gsap.timeline({ paused: true, defaults: { ease: "power3.out" } });
  brandEntrance
    .to(siteHeader, { autoAlpha: 1, y: 0, duration: 0.8 }, 0)
    .to(
      brandTitle,
      {
        autoAlpha: 1,
        clipPath: "inset(0 0 0% 0)",
        yPercent: 0,
        duration: 1.15,
      },
      0.16,
    )
    .to(brandReveal, { autoAlpha: 1, y: 0, duration: 0.75 }, 0.62);

  const brandEntranceTrigger = ScrollTrigger.create({
    trigger: brandHero,
    start: "top 78%",
    once: true,
    onEnter: () => brandEntrance.play(),
  });

  const brandSceneGate = ScrollTrigger.create({
    trigger: brandHero,
    start: "top bottom",
    end: "bottom top",
    onEnter: () => {
      sceneShell.dataset.websiteState = "brand";
      gsap.set(sceneShell, { autoAlpha: 0, y: 0, scale: 1 });
      sceneApi.setRenderActive?.(false);
    },
    onEnterBack: () => {
      // The brand and showcase overlap in the viewport on reverse scroll.
      // The showcase reveal owns the shared canvas until it leaves the viewport.
      if (showcase.getBoundingClientRect().top < window.innerHeight) return;
      sceneShell.dataset.websiteState = "brand";
      gsap.set(sceneShell, { autoAlpha: 0, y: 0, scale: 1 });
      sceneApi.setRenderActive?.(false);
    },
    onLeaveBack: () => {
      sceneShell.dataset.websiteState = "intro";
      gsap.set(sceneShell, { autoAlpha: 1, y: 0, scale: 1 });
      sceneApi.setRenderActive?.(true);
    },
  });

  const showcaseEntrance = gsap.timeline({ paused: true, defaults: { ease: "power3.out" } });
  showcaseEntrance
    .to(showcaseReveal[0], { autoAlpha: 1, y: 0, duration: 0.72 }, 0)
    .to(showcaseReveal[1], { autoAlpha: 1, y: 0, duration: 0.72 }, 0.1)
    .to(
      showcaseTitle,
      {
        autoAlpha: 1,
        clipPath: "inset(0 0 0% 0)",
        yPercent: 0,
        duration: 1.05,
      },
      0.18,
    )
    .to(showcaseReveal.slice(2), { autoAlpha: 1, y: 0, duration: 0.72, stagger: 0.08 }, 0.5);

  const showcaseEntranceTrigger = ScrollTrigger.create({
    trigger: showcase,
    start: "top 76%",
    once: true,
    onEnter: () => showcaseEntrance.play(),
  });

  const showcaseSceneReveal = ScrollTrigger.create({
    trigger: showcase,
    start: "top bottom",
    end: "top 24%",
    scrub: true,
    onEnter: () => {
      sceneShell.dataset.websiteState = "showcase";
      sceneApi.setShowcasePresentation();
      sceneApi.setRenderActive?.(true);
    },
    onEnterBack: () => {
      sceneShell.dataset.websiteState = "showcase";
      sceneApi.setShowcasePresentation();
      sceneApi.setRenderActive?.(true);
    },
    onUpdate: (self) => {
      const reveal = smoothstep(self.progress);
      if (reveal > 0.002) sceneApi.setShowcasePresentation();
      sceneShell.dataset.websiteState = reveal > 0.02 ? "showcase" : "brand";
      gsap.set(sceneShell, {
        autoAlpha: reveal,
        y: `${(1 - reveal) * 1.5}vh`,
        scale: 0.992 + reveal * 0.008,
      });
      sceneApi.setScrollProgress(reveal * 0.28);
      sceneApi.setRenderActive?.(reveal > 0.002);
    },
    onLeaveBack: () => {
      sceneShell.dataset.websiteState = "brand";
      gsap.set(sceneShell, { autoAlpha: 0, y: 0, scale: 1 });
      sceneApi.setScrollProgress(0);
      sceneApi.setRenderActive?.(false);
    },
  });

  const showcaseRenderGate = ScrollTrigger.create({
    trigger: showcase,
    start: "top 24%",
    end: "bottom top",
    onEnter: () => {
      sceneApi.setShowcasePresentation();
      sceneApi.setRenderActive?.(true);
    },
    onEnterBack: () => {
      sceneShell.dataset.websiteState = "showcase";
      gsap.set(sceneShell, { autoAlpha: 1, y: 0, scale: 1 });
      sceneApi.setShowcasePresentation();
      sceneApi.setRenderActive?.(true);
    },
    onLeave: () => sceneApi.setRenderActive?.(false),
  });

  const editorialReveals = gsap.utils.toArray(".reveal");
  editorialReveals.forEach((element) => {
    gsap.set(element, { autoAlpha: 0, y: 24 });
    const tween = gsap.to(element, {
      autoAlpha: 1,
      y: 0,
      duration: 0.82,
      ease: "power3.out",
      paused: true,
    });
    const trigger = ScrollTrigger.create({
      trigger: element,
      start: "top 88%",
      once: true,
      onEnter: () => tween.play(),
    });
    animations.push(tween, trigger);
  });

  animations.push(
    brandEntrance,
    brandEntranceTrigger,
    brandSceneGate,
    showcaseEntrance,
    showcaseEntranceTrigger,
    showcaseSceneReveal,
    showcaseRenderGate,
  );

  return () => {
    animations.forEach((animation) => animation.kill());
    sceneShell.style.opacity = "";
    sceneShell.style.visibility = "";
    sceneShell.style.transform = "";
  };
}
