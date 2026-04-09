// ===== MAIN APP JS =====

// === NAV SCROLL STATE ===
const nav = document.querySelector('nav');
window.addEventListener('scroll', () => {
  nav.classList.toggle('scrolled', window.scrollY > 50);
}, { passive: true });

// === HYPERSPACE REVEAL for hero content ===
// Eyebrow, name (per-letter), tagline, and CTA buttons all drop out of
// "lightspeed": they arrive huge and blurred from (slightly) in front of
// the camera, decelerate hard into their rest positions, and unblur.
// Each element (and each letter of the name) has its own stagger so the
// group arrives in formation but not in lockstep.
function splitIntoChars(el, text) {
  el.innerHTML = '';
  const spans = [];
  for (const ch of text) {
    const s = document.createElement('span');
    s.className = 'name-char';
    s.textContent = ch === ' ' ? '\u00A0' : ch;
    el.appendChild(s);
    spans.push(s);
  }
  return spans;
}

function hyperspaceReveal() {
  const eyebrow   = document.querySelector('.hero-eyebrow');
  const nameEl    = document.getElementById('hero-name');
  const tagline   = document.querySelector('.hero-tagline');
  const ctaGroup  = document.querySelector('.hero-cta-group');
  const ctas      = ctaGroup ? Array.from(ctaGroup.querySelectorAll('a, button')) : [];
  const scrollInd = document.querySelector('.scroll-indicator');

  const nameChars = splitIntoChars(nameEl, 'James Levac');
  nameEl.style.visibility = 'visible';

  const tl = gsap.timeline();

  // eyebrow leads
  if (eyebrow) {
    tl.fromTo(eyebrow,
      { opacity: 0, scale: 5.5, y: -30 },
      { opacity: 1, scale: 1, y: 0, duration: 1.0, ease: 'expo.out' },
      0);
  }

  // name: each letter is its own projectile with random jitter
  // (No filter: blur — filter animations cause GPU-process pressure
  // similar to WebGL and were stalling video decode in other tabs.)
  tl.fromTo(nameChars,
    {
      opacity: 0,
      scale: () => 8 + Math.random() * 5,
      y: () => -50 + Math.random() * 40,
      x: () => (Math.random() - 0.5) * 60,
      rotation: () => (Math.random() - 0.5) * 20,
    },
    {
      opacity: 1,
      scale: 1,
      y: 0,
      x: 0,
      rotation: 0,
      duration: 1.35,
      ease: 'expo.out',
      stagger: { each: 0.055, from: 'random' },
    },
    0.08);

  // tagline arrives slightly after the name is mostly home
  if (tagline) {
    tl.fromTo(tagline,
      { opacity: 0, scale: 4.5, y: 40 },
      { opacity: 1, scale: 1, y: 0, duration: 1.1, ease: 'expo.out' },
      0.55);
  }

  // CTA buttons each on their own stagger (parent must be visible, the
  // children carry the actual reveal animation)
  if (ctaGroup) gsap.set(ctaGroup, { opacity: 1 });
  if (ctas.length) {
    tl.fromTo(ctas,
      {
        opacity: 0,
        scale: () => 5 + Math.random() * 3,
        y: () => 50 + Math.random() * 30,
        x: () => (Math.random() - 0.5) * 40,
      },
      {
        opacity: 1,
        scale: 1,
        y: 0,
        x: 0,
        duration: 1.15,
        ease: 'expo.out',
        stagger: { each: 0.12, from: 'random' },
      },
      0.7);
  }

  if (scrollInd) {
    tl.fromTo(scrollInd,
      { opacity: 0, y: 20 },
      { opacity: 1, y: 0, duration: 0.7, ease: 'power2.out' },
      1.55);
  }

  return tl;
}

// === HERO ENTRANCE SEQUENCE ===
function heroEntrance() {
  // Hyperspace exit fires as the constellation settles into its orbit.
  gsap.delayedCall(1.4, hyperspaceReveal);
}

// === SCROLL REVEALS via IntersectionObserver ===
// ScrollTrigger was causing tab-wide freezes on page load (many trigger
// instances forcing synchronous layout measurements during init).
// Replaced with a single lightweight IntersectionObserver that tags
// elements with .in-view when they cross the viewport, and CSS handles
// the actual transition. No layout thrash, no scroll-handler overhead.
function initScrollAnimations() {
  const targets = document.querySelectorAll(
    '.section-label, .section-title, .section-subtitle, ' +
    '.about-text, .about-terminal, ' +
    '.project-card, .client-card, .stack-pill, ' +
    '.contact-item, .contact-note'
  );
  targets.forEach((el) => el.classList.add('reveal'));

  if (!('IntersectionObserver' in window)) {
    targets.forEach((el) => el.classList.add('in-view'));
    return;
  }

  const io = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (entry.isIntersecting) {
        entry.target.classList.add('in-view');
        io.unobserve(entry.target);
      }
    }
  }, { rootMargin: '0px 0px -10% 0px', threshold: 0.01 });

  targets.forEach((el) => io.observe(el));
}

// === INIT ===
document.addEventListener('DOMContentLoaded', () => {
  heroEntrance();
  initScrollAnimations();
});
