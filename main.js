/* ═══════════════════════════════════════════════
   HOLY BUCK — main.js
   "Cast to Last"
═══════════════════════════════════════════════ */

// ─── STICKY NAV ───────────────────────────────
const nav = document.getElementById('nav');

window.addEventListener('scroll', () => {
  nav.classList.toggle('scrolled', window.scrollY > 60);
});

// ─── SCROLL REVEAL ────────────────────────────
const reveals = document.querySelectorAll('.reveal');

const revealObserver = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (!entry.isIntersecting) return;

    // Stagger siblings that haven't revealed yet
    const siblings = [
      ...entry.target.parentElement.querySelectorAll('.reveal:not(.visible)')
    ];
    const delay = siblings.indexOf(entry.target) * 80;

    setTimeout(() => {
      entry.target.classList.add('visible');
    }, delay);

    revealObserver.unobserve(entry.target);
  });
}, { threshold: 0.12 });

reveals.forEach(el => revealObserver.observe(el));
