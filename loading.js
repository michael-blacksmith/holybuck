export function initLoadingLayer(element) {
  const gsap = window.gsap;
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const bar = element?.querySelector("[data-loading-progress]");

  return {
    setProgress(value) {
      if (!bar) return;
      const progress = Math.min(1, Math.max(0, value));
      bar.style.transform = `scaleX(${progress})`;
      bar.parentElement.setAttribute("aria-valuenow", String(Math.round(progress * 100)));
    },
    hide() {
      if (!element) {
        document.body.classList.remove("is-loading");
        return Promise.resolve();
      }

      if (!gsap || reducedMotion) {
        element.hidden = true;
        element.setAttribute("aria-hidden", "true");
        document.body.classList.remove("is-loading");
        return Promise.resolve();
      }


      return new Promise((resolve) => {
        gsap
          .timeline({
            onComplete() {
              element.hidden = true;
              element.setAttribute("aria-hidden", "true");
              document.body.classList.remove("is-loading");
              resolve();
            },
          })
          .to(bar.parentElement, { autoAlpha: 0, duration: 0.3, ease: "power2.inOut" }, 0.12)
          .to(element, { autoAlpha: 0, duration: 0.65, ease: "power2.inOut" }, 0.2);
      });
    },
  };
}
