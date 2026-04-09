// ===== MAIN APP JS =====

// === NAV SCROLL STATE ===
const nav = document.querySelector('nav');
window.addEventListener('scroll', () => {
  nav.classList.toggle('scrolled', window.scrollY > 50);
}, { passive: true });

// === DECRYPT/SCRAMBLE REVEAL for hero name ===
// Each character rapidly cycles through random glyphs then resolves to the
// final letter in a staggered wave — feels like a decryption feed rather
// than a typewriter.
function decryptReveal(element, text, { duration = 1600, glyphSpeed = 40 } = {}) {
  const GLYPHS = '!<>-_\\/[]{}—=+*^?#________ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  element.innerHTML = '';
  // Build a span per character
  const spans = Array.from(text).map((ch) => {
    const s = document.createElement('span');
    s.className = 'name-char';
    s.textContent = ch === ' ' ? '\u00A0' : ch;
    s.dataset.final = ch;
    element.appendChild(s);
    return s;
  });

  const start = performance.now();
  const perChar = duration / text.length;
  const settleDur = 380;

  return new Promise((resolve) => {
    function tick() {
      const now = performance.now();
      const t = now - start;
      let allDone = true;
      spans.forEach((s, i) => {
        const final = s.dataset.final;
        if (final === ' ' || s.dataset.done === '1') return;
        const localStart = i * perChar * 0.55;
        const local = t - localStart;
        if (local < 0) {
          s.textContent = ' ';
          allDone = false;
          return;
        }
        if (local >= settleDur) {
          s.textContent = final === ' ' ? '\u00A0' : final;
          s.classList.add('name-char-resolved');
          s.dataset.done = '1';
          return;
        }
        // random glyph at glyph-speed intervals
        const step = Math.floor(local / glyphSpeed);
        const rnd = GLYPHS.charAt((step * 37 + i * 13) % GLYPHS.length);
        s.textContent = rnd;
        s.classList.add('name-char-scrambling');
        allDone = false;
      });
      if (!allDone) requestAnimationFrame(tick);
      else {
        spans.forEach((s) => s.classList.remove('name-char-scrambling'));
        resolve();
      }
    }
    requestAnimationFrame(tick);
  });
}

// === HERO ENTRANCE SEQUENCE ===
function heroEntrance() {
  const eyebrow = document.querySelector('.hero-eyebrow');
  const nameEl = document.getElementById('hero-name');
  const tagline = document.querySelector('.hero-tagline');
  const ctaGroup = document.querySelector('.hero-cta-group');
  const scrollInd = document.querySelector('.scroll-indicator');

  // Fade in eyebrow
  gsap.to(eyebrow, { opacity: 1, y: 0, duration: 0.8, delay: 0.3, ease: 'power2.out' });

  // Decrypt reveal kicks in as the particle swarm releases (~2.8s) so the
  // DOM name hands off from the particle reveal rather than competing.
  setTimeout(() => {
    decryptReveal(nameEl, 'James Levac', { duration: 1400, glyphSpeed: 38 }).then(() => {
      gsap.to(tagline, { opacity: 1, y: 0, duration: 0.6, delay: 0.1, ease: 'power2.out' });
      gsap.to(ctaGroup, { opacity: 1, y: 0, duration: 0.6, delay: 0.3, ease: 'power2.out' });
      gsap.to(scrollInd, { opacity: 1, duration: 0.7, delay: 0.8, ease: 'power2.out' });
    });
  }, 2800);
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
