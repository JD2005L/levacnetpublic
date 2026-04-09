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
      { opacity: 0, scale: 5.5, filter: 'blur(14px)', y: -30 },
      { opacity: 1, scale: 1, filter: 'blur(0px)', y: 0, duration: 1.0, ease: 'expo.out' },
      0);
  }

  // name: each letter is its own projectile with random jitter
  tl.fromTo(nameChars,
    {
      opacity: 0,
      scale: () => 8 + Math.random() * 5,
      filter: 'blur(22px)',
      y: () => -50 + Math.random() * 40,
      x: () => (Math.random() - 0.5) * 60,
      rotation: () => (Math.random() - 0.5) * 20,
    },
    {
      opacity: 1,
      scale: 1,
      filter: 'blur(0px)',
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
      { opacity: 0, scale: 4.5, filter: 'blur(14px)', y: 40 },
      { opacity: 1, scale: 1, filter: 'blur(0px)', y: 0, duration: 1.1, ease: 'expo.out' },
      0.55);
  }

  // CTA buttons each on their own stagger
  if (ctas.length) {
    tl.fromTo(ctas,
      {
        opacity: 0,
        scale: () => 5 + Math.random() * 3,
        filter: 'blur(16px)',
        y: () => 50 + Math.random() * 30,
        x: () => (Math.random() - 0.5) * 40,
      },
      {
        opacity: 1,
        scale: 1,
        filter: 'blur(0px)',
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
      { opacity: 0, y: 20, filter: 'blur(6px)' },
      { opacity: 1, y: 0, filter: 'blur(0px)', duration: 0.7, ease: 'power2.out' },
      1.55);
  }

  return tl;
}

// === HERO ENTRANCE SEQUENCE ===
function heroEntrance() {
  // Hyperspace exit fires as the particle swarm releases (~2.8s) so the
  // DOM content decelerates in as the particles disperse into the field.
  gsap.delayedCall(2.8, hyperspaceReveal);
}

// === GSAP SCROLL TRIGGER REVEALS ===
function initScrollAnimations() {
  // Register ScrollTrigger
  gsap.registerPlugin(ScrollTrigger);

  // Section labels + titles
  gsap.utils.toArray('.section-label, .section-title, .section-subtitle').forEach(el => {
    gsap.from(el, {
      scrollTrigger: {
        trigger: el,
        start: 'top 88%',
        toggleActions: 'play none none none',
      },
      opacity: 0,
      y: 25,
      duration: 0.7,
      ease: 'power2.out',
    });
  });

  // About grid
  gsap.from('.about-text', {
    scrollTrigger: { trigger: '.about-grid', start: 'top 80%' },
    opacity: 0, x: -30, duration: 0.8, ease: 'power2.out',
  });

  gsap.from('.about-terminal', {
    scrollTrigger: { trigger: '.about-grid', start: 'top 80%' },
    opacity: 0, x: 30, duration: 0.8, delay: 0.2, ease: 'power2.out',
  });

  // Project cards stagger
  ScrollTrigger.batch('.project-card', {
    start: 'top 90%',
    onEnter: batch => gsap.to(batch, { opacity: 1, y: 0, duration: 0.6, stagger: 0.1, ease: 'power2.out' }),
  });
  gsap.set('.project-card', { opacity: 0, y: 40 });

  // Client cards
  ScrollTrigger.batch('.client-card', {
    start: 'top 90%',
    onEnter: batch => gsap.to(batch, { opacity: 1, y: 0, duration: 0.5, stagger: 0.08, ease: 'power2.out' }),
  });
  gsap.set('.client-card', { opacity: 0, y: 25 });

  // Stack pills
  ScrollTrigger.batch('.stack-pill', {
    start: 'top 90%',
    onEnter: batch => gsap.to(batch, { opacity: 1, scale: 1, duration: 0.4, stagger: 0.03, ease: 'back.out(1.5)' }),
  });
  gsap.set('.stack-pill', { opacity: 0, scale: 0.85 });

  // Contact items
  gsap.from('.contact-item', {
    scrollTrigger: {
      trigger: '.contact-items',
      start: 'top 85%',
    },
    opacity: 0,
    x: -20,
    duration: 0.5,
    stagger: 0.1,
    ease: 'power2.out',
  });

  gsap.from('.contact-note', {
    scrollTrigger: {
      trigger: '.contact-grid',
      start: 'top 82%',
    },
    opacity: 0,
    x: 20,
    duration: 0.7,
    delay: 0.3,
    ease: 'power2.out',
  });
}

// === INIT ===
document.addEventListener('DOMContentLoaded', () => {
  heroEntrance();
  initScrollAnimations();
});
