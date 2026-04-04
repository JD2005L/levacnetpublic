// ===== MAIN APP JS =====

// === NAV SCROLL STATE ===
const nav = document.querySelector('nav');
window.addEventListener('scroll', () => {
  nav.classList.toggle('scrolled', window.scrollY > 50);
}, { passive: true });

// === TYPEWRITER for hero name ===
function typeWriter(element, text, speed = 85, onDone) {
  element.innerHTML = '';
  const cursor = document.createElement('span');
  cursor.className = 'cursor';
  element.appendChild(cursor);

  let i = 0;
  function type() {
    if (i < text.length) {
      cursor.insertAdjacentText('beforebegin', text.charAt(i));
      i++;
      setTimeout(type, speed + Math.random() * 40);
    } else {
      if (onDone) onDone();
      // Remove cursor after a short delay
      setTimeout(() => {
        cursor.style.animation = 'none';
        cursor.style.opacity = '0';
      }, 3500);
    }
  }
  setTimeout(type, 100);
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

  // Typewriter after delay
  setTimeout(() => {
    typeWriter(nameEl, 'James Levac', 80, () => {
      // After name types in, reveal tagline + CTA
      gsap.to(tagline, { opacity: 1, y: 0, duration: 0.7, delay: 0.2, ease: 'power2.out' });
      gsap.to(ctaGroup, { opacity: 1, y: 0, duration: 0.7, delay: 0.5, ease: 'power2.out' });
      gsap.to(scrollInd, { opacity: 1, duration: 0.8, delay: 1.2, ease: 'power2.out' });
    });
  }, 900);
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

  // Experience timeline entries stagger
  gsap.utils.toArray('.timeline-entry').forEach((entry, i) => {
    gsap.from(entry, {
      scrollTrigger: {
        trigger: entry,
        start: 'top 85%',
        toggleActions: 'play none none none',
      },
      opacity: 0,
      x: -30,
      duration: 0.6,
      delay: i * 0.1,
      ease: 'power2.out',
    });
  });

  // Education card
  gsap.from('.education-card', {
    scrollTrigger: {
      trigger: '.education-card',
      start: 'top 88%',
    },
    opacity: 0,
    y: 20,
    duration: 0.6,
    ease: 'power2.out',
  });

  // Signature project cards stagger
  gsap.from('.sig-card', {
    scrollTrigger: {
      trigger: '.sig-projects-grid',
      start: 'top 80%',
    },
    opacity: 0,
    y: 40,
    duration: 0.6,
    stagger: 0.12,
    ease: 'power2.out',
  });

  // Project cards stagger
  gsap.from('.project-card', {
    scrollTrigger: {
      trigger: '.projects-grid',
      start: 'top 80%',
    },
    opacity: 0,
    y: 40,
    duration: 0.6,
    stagger: 0.1,
    ease: 'power2.out',
  });

  // Client cards
  gsap.from('.client-card', {
    scrollTrigger: {
      trigger: '.clients-grid',
      start: 'top 82%',
    },
    opacity: 0,
    y: 25,
    duration: 0.5,
    stagger: 0.08,
    ease: 'power2.out',
  });

  // Stack pills
  gsap.from('.stack-pill', {
    scrollTrigger: {
      trigger: '.stack-categories',
      start: 'top 82%',
    },
    opacity: 0,
    scale: 0.85,
    duration: 0.4,
    stagger: 0.03,
    ease: 'back.out(1.5)',
  });

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
