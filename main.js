// ===== MAIN APP JS =====

// === NAV SCROLL STATE ===
const nav = document.querySelector('nav');
window.addEventListener('scroll', () => {
  nav.classList.toggle('scrolled', window.scrollY > 50);
}, { passive: true });

// === NAV SCROLL-SPY (active link tracking) ===
// A single IntersectionObserver watches the five main sections and
// marks the nav link whose section is currently closest to the
// viewport centre as .active. Nothing runs on scroll — observer
// callbacks only fire on threshold crossings.
function initNavSpy() {
  const sections = ['about', 'projects', 'clients', 'stack', 'contact']
    .map((id) => document.getElementById(id))
    .filter(Boolean);
  const links = new Map();
  document.querySelectorAll('.nav-links a').forEach((a) => {
    const href = a.getAttribute('href') || '';
    if (href.startsWith('#') && href.length > 1) links.set(href.slice(1), a);
  });
  if (!sections.length || !links.size) return;

  const visible = new Map(); // id -> intersection ratio
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (e.isIntersecting) visible.set(e.target.id, e.intersectionRatio);
      else visible.delete(e.target.id);
    }
    // pick the section with the highest visibility
    let bestId = null;
    let bestRatio = 0;
    for (const [id, r] of visible) {
      if (r > bestRatio) { bestRatio = r; bestId = id; }
    }
    links.forEach((a, id) => a.classList.toggle('active', id === bestId));
  }, {
    // an "active zone" that favours the section crossing the middle
    rootMargin: '-40% 0px -50% 0px',
    threshold: [0, 0.01, 0.25, 0.5, 0.75, 1],
  });
  sections.forEach((s) => io.observe(s));
}

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
  // Add the warping glow class now so the scaled-up letters start their
  // trip with a thick halo that reads as motion blur. It stays on for
  // most of the animation, then fades back to crisp text.
  nameEl.classList.add('warping');

  const tl = gsap.timeline({
    onComplete: () => nameEl.classList.remove('warping'),
  });

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

// === TERMINAL TYPEWRITER ===
// Groups the green output lines by the preceding .terminal-line
// (each $ command and its outputs is a "section") and runs one
// independent typer per section, all in parallel, each with its
// own blinking cursor. Within a section the lines still stream
// sequentially so "cat specialties.txt" types its four rows in
// order. Across sections everything happens at once so the whole
// terminal is done in roughly the time the longest section takes.
function runTerminalTyper() {
  const term = document.querySelector('.about-terminal');
  if (!term) return;
  term.classList.add('reveal');

  // Walk the direct children of .about-terminal. Every time we hit a
  // .terminal-line we open a new section bucket. Every .t-out /
  // .t-out-dim seen after that is added to the current section.
  const sections = [];
  let current = null;
  Array.from(term.children).forEach((child) => {
    if (child.classList && child.classList.contains('terminal-line')) {
      current = [];
      sections.push(current);
    } else if (current && child.classList &&
      (child.classList.contains('t-out') || child.classList.contains('t-out-dim'))) {
      current.push(child);
    }
  });
  // Drop any empty buckets (e.g. a terminal-line with no outputs)
  const buckets = sections.filter((s) => s.length > 0);
  if (!buckets.length) return;

  // Snapshot each line's text and blank it out.
  buckets.forEach((bucket) => {
    bucket.forEach((el) => {
      el.dataset.text = el.textContent;
      el.textContent = '';
    });
  });

  function runBucket(bucket, isFinal) {
    const cursor = document.createElement('span');
    cursor.className = 'typing-cursor';

    function typeLine(i) {
      if (i >= bucket.length) {
        // Section done. Non-final sections release their cursor so
        // only the last section in the terminal keeps a persistent
        // blinking cursor at the bottom.
        if (!isFinal && cursor.parentNode) cursor.parentNode.removeChild(cursor);
        return;
      }
      const el = bucket[i];
      const text = el.dataset.text || '';
      el.appendChild(cursor);
      let pos = 0;
      function step() {
        if (pos >= text.length) {
          // short pause, then advance to next line in this section
          setTimeout(() => typeLine(i + 1), 140 + Math.random() * 200);
          return;
        }
        const ch = text.charAt(pos);
        cursor.insertAdjacentText('beforebegin', ch);
        pos++;
        // realistic human cadence
        let d = 30 + Math.random() * 55;
        if (ch === ' ') d += 30 + Math.random() * 60;
        else if (ch === '.' || ch === ',' || ch === '/' || ch === '-') d += 45 + Math.random() * 85;
        if (Math.random() < 0.04) d += 90 + Math.random() * 140;
        setTimeout(step, d);
      }
      step();
    }
    typeLine(0);
  }

  function start() {
    // Slight random offset so the four cursors don't strike in lockstep
    const finalIndex = buckets.length - 1;
    buckets.forEach((bucket, idx) => {
      setTimeout(() => runBucket(bucket, idx === finalIndex), Math.random() * 120);
    });
  }

  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (e.isIntersecting) {
          io.unobserve(term);
          start();
          return;
        }
      }
    }, { rootMargin: '0px 0px -20% 0px', threshold: 0.25 });
    io.observe(term);
  } else {
    start();
  }
}

// === SCROLL REVEALS via IntersectionObserver ===
// ScrollTrigger was causing tab-wide freezes on page load (many trigger
// instances forcing synchronous layout measurements during init).
// Replaced with a single lightweight IntersectionObserver that tags
// elements with .in-view when they cross the viewport, and CSS handles
// the actual transition. No layout thrash, no scroll-handler overhead.
function initScrollAnimations() {
  // Terminal typewriter: iterate every green output line in document
  // order and stream characters one at a time with variable delays to
  // emulate a real typing rhythm. A single blinking cursor element
  // moves from line to line so each section appears to be actively
  // typed. Triggers when the terminal is actually visible.
  runTerminalTyper();

  const targets = document.querySelectorAll(
    '.section-label, .section-title, .section-subtitle, ' +
    '.about-text, ' +
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
  initNavSpy();
});
