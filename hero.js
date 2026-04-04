// ===== Three.js Neural Network Particle System =====
(function() {
  const canvas = document.getElementById('hero-canvas');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setClearColor(0x000000, 0);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 2000);
  camera.position.z = 500;

  // === PARTICLES ===
  const COUNT = window.innerWidth < 600 ? 800 : 1800;
  const SPREAD = 800;
  const MAX_DIST = 130;
  const MAX_LINES = 3500;

  const positions = new Float32Array(COUNT * 3);
  const velocities = [];
  const origins = [];

  // Explosion init: start at center, explode outward
  for (let i = 0; i < COUNT; i++) {
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    const r = SPREAD * 0.5 + Math.random() * SPREAD * 0.5;

    const tx = r * Math.sin(phi) * Math.cos(theta);
    const ty = r * Math.sin(phi) * Math.sin(theta);
    const tz = (Math.random() - 0.5) * 300;

    positions[i * 3] = (Math.random() - 0.5) * 10;
    positions[i * 3 + 1] = (Math.random() - 0.5) * 10;
    positions[i * 3 + 2] = (Math.random() - 0.5) * 10;

    origins.push({ x: tx, y: ty, z: tz });
    velocities.push({
      x: (Math.random() - 0.5) * 0.4,
      y: (Math.random() - 0.5) * 0.4,
      z: (Math.random() - 0.5) * 0.15,
    });
  }

  const particleGeo = new THREE.BufferGeometry();
  particleGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));

  const particleMat = new THREE.PointsMaterial({
    color: 0x00d4ff,
    size: 2.2,
    sizeAttenuation: true,
    transparent: true,
    opacity: 0.7,
  });

  const particles = new THREE.Points(particleGeo, particleMat);
  scene.add(particles);

  // === LINES ===
  const linePositions = new Float32Array(MAX_LINES * 6);
  const lineGeo = new THREE.BufferGeometry();
  lineGeo.setAttribute('position', new THREE.BufferAttribute(linePositions, 3));
  lineGeo.setDrawRange(0, 0);

  const lineMat = new THREE.LineSegmentsGeometry
    ? null
    : new THREE.LineBasicMaterial({
        color: 0x00d4ff,
        transparent: true,
        opacity: 0.18,
        vertexColors: false,
      });

  // Use simple LineSegments approach
  const lineMaterial = new THREE.LineBasicMaterial({
    color: 0x00d4ff,
    transparent: true,
    opacity: 0.18,
  });

  const lines = new THREE.LineSegments(lineGeo, lineMaterial);
  scene.add(lines);

  // === MOUSE ===
  const mouse = { x: 0, y: 0, nx: 0, ny: 0 };
  document.addEventListener('mousemove', (e) => {
    mouse.nx = (e.clientX / window.innerWidth - 0.5) * 2;
    mouse.ny = -(e.clientY / window.innerHeight - 0.5) * 2;
  });

  // === TOUCH SUPPORT ===
  document.addEventListener('touchmove', (e) => {
    const t = e.touches[0];
    mouse.nx = (t.clientX / window.innerWidth - 0.5) * 2;
    mouse.ny = -(t.clientY / window.innerHeight - 0.5) * 2;
  }, { passive: true });

  // === RESIZE ===
  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  // === STATE ===
  let startTime = Date.now();
  let explosionDone = false;
  const EXPLOSION_DUR = 2200; // ms

  // Easing
  function easeOutExpo(x) {
    return x === 1 ? 1 : 1 - Math.pow(2, -10 * x);
  }

  function easeInOutCubic(x) {
    return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
  }

  // ===== ANIMATE =====
  function animate() {
    requestAnimationFrame(animate);

    const now = Date.now();
    const elapsed = now - startTime;
    const t = Math.min(elapsed / EXPLOSION_DUR, 1);

    // Smooth mouse
    mouse.x += (mouse.nx - mouse.x) * 0.06;
    mouse.y += (mouse.ny - mouse.y) * 0.06;

    const pos = particleGeo.attributes.position.array;

    // Explosion phase → settle
    const ease = easeOutExpo(t);

    let lineCount = 0;

    for (let i = 0; i < COUNT; i++) {
      const ix = i * 3;
      const o = origins[i];
      const v = velocities[i];

      // Explosion: interpolate from center to target
      pos[ix]     = o.x * ease;
      pos[ix + 1] = o.y * ease;
      pos[ix + 2] = o.z * ease;

      // After explosion, add drift + mouse gravitation
      if (t > 0.6) {
        const driftFactor = (t - 0.6) / 0.4;

        // Drift
        o.x += v.x * 0.015 * driftFactor;
        o.y += v.y * 0.015 * driftFactor;

        // Boundary bounce
        if (Math.abs(o.x) > SPREAD * 0.6) v.x *= -1;
        if (Math.abs(o.y) > SPREAD * 0.6) v.y *= -1;

        // Mouse gravity
        const mx = mouse.x * 350;
        const my = mouse.y * 350;
        const dx = mx - o.x;
        const dy = my - o.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < 200 && dist > 0) {
          const strength = (1 - dist / 200) * 0.4 * driftFactor;
          o.x += (dx / dist) * strength;
          o.y += (dy / dist) * strength;
        }

        pos[ix]     = o.x;
        pos[ix + 1] = o.y;
        pos[ix + 2] = o.z;
      }
    }

    // Build connection lines
    if (t > 0.4 && lineCount < MAX_LINES) {
      const lp = lineGeo.attributes.position.array;
      lineCount = 0;

      for (let i = 0; i < COUNT && lineCount < MAX_LINES; i++) {
        for (let j = i + 1; j < COUNT && lineCount < MAX_LINES; j++) {
          const ax = pos[i * 3], ay = pos[i * 3 + 1], az = pos[i * 3 + 2];
          const bx = pos[j * 3], by = pos[j * 3 + 1], bz = pos[j * 3 + 2];

          const dx = ax - bx, dy = ay - by, dz = az - bz;
          const d2 = dx * dx + dy * dy + dz * dz;

          if (d2 < MAX_DIST * MAX_DIST) {
            const base = lineCount * 6;
            lp[base]     = ax; lp[base + 1] = ay; lp[base + 2] = az;
            lp[base + 3] = bx; lp[base + 4] = by; lp[base + 5] = bz;
            lineCount++;
          }
        }
      }

      lineGeo.attributes.position.needsUpdate = true;
      lineGeo.setDrawRange(0, lineCount * 2);

      // Fade in lines during settle
      const lineOpacity = Math.min((t - 0.4) / 0.4, 1) * 0.22;
      lineMaterial.opacity = lineOpacity;
    }

    particleGeo.attributes.position.needsUpdate = true;

    // Gentle camera float
    camera.position.x += (mouse.x * 30 - camera.position.x) * 0.02;
    camera.position.y += (mouse.y * 20 - camera.position.y) * 0.02;
    camera.lookAt(scene.position);

    renderer.render(scene, camera);
  }

  animate();
})();
