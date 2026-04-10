// Hero wave animation: updates SVG path data each frame so the waves
// genuinely undulate (peaks/troughs travel along the line) instead of
// just sliding a static shape left/right via CSS translateX.
(function () {
  const svg = document.querySelector('.hero-waves');
  if (!svg) return;

  const waves = [
    // Cyan
    { el: null, y: 530, amp: 16, wl: 480,  speed:  0.4, sw: 1.5, op: 0.55, grad: 'wc' },
    { el: null, y: 600, amp: 13, wl: 360,  speed: -0.3, sw: 1.2, op: 0.45, grad: 'wc' },
    { el: null, y: 680, amp: 18, wl: 540,  speed:  0.25, sw: 0.9, op: 0.35, grad: 'wc' },
    // Violet
    { el: null, y: 555, amp: 20, wl: 720,  speed: -0.2, sw: 1.4, op: 0.52, grad: 'wv' },
    { el: null, y: 635, amp: 15, wl: 640,  speed:  0.35, sw: 1.0, op: 0.40, grad: 'wv' },
    { el: null, y: 500, amp: 12, wl: 800,  speed: -0.15, sw: 0.8, op: 0.30, grad: 'wv' },
    { el: null, y: 720, amp: 16, wl: 680,  speed:  0.28, sw: 0.7, op: 0.28, grad: 'wv' },
  ];

  // Remove any existing static wave paths and CSS classes
  svg.querySelectorAll('.wave').forEach((p) => p.remove());

  // Create path elements
  waves.forEach((w) => {
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('stroke', 'url(#' + w.grad + ')');
    path.setAttribute('stroke-width', w.sw);
    path.setAttribute('fill', 'none');
    path.setAttribute('opacity', w.op);
    svg.appendChild(path);
    w.el = path;
  });

  // Pause when hero is not visible
  let visible = true;
  const hero = document.getElementById('hero');
  if (hero && 'IntersectionObserver' in window) {
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) visible = e.isIntersecting;
    });
    io.observe(hero);
  }
  // Also pause when tab is hidden
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && hero) {
      const r = hero.getBoundingClientRect();
      visible = r.bottom > 0 && r.top < window.innerHeight;
    } else {
      visible = false;
    }
  });

  const TWO_PI = Math.PI * 2;
  const step = 14; // px between points (perf vs smoothness)
  const xStart = 0;
  const xEnd = 1600;

  function buildPath(w, time) {
    const phase = time * w.speed;
    let d = '';
    for (let x = xStart; x <= xEnd; x += step) {
      const y = w.y + w.amp * Math.sin(TWO_PI * (x / w.wl) + phase);
      d += (x === xStart ? 'M' : 'L') + x + ' ' + y.toFixed(1);
    }
    return d;
  }

  let t0 = null;
  function animate(ts) {
    requestAnimationFrame(animate);
    if (!visible) return;
    if (t0 === null) t0 = ts;
    const time = (ts - t0) * 0.001;

    for (const w of waves) {
      w.el.setAttribute('d', buildPath(w, time));
    }
  }

  requestAnimationFrame(animate);
})();
