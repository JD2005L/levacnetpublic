// ===== Three.js Neural Network Particle System =====
(function() {
  const canvas = document.getElementById('hero-canvas');
  if (!canvas) return;

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  } catch(e) {
    console.warn('WebGL not available:', e);
    return;
  }

  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setClearColor(0x0a0a0f, 1);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 2000);
  camera.position.z = 500;

  // === PARTICLES ===
  const COUNT = window.innerWidth < 600 ? 500 : 1200;
  const SPREAD = 700;
  const MAX_DIST = 120;
  const MAX_LINES = 2000;

  const positions = new Float32Array(COUNT * 3);
  const velocities = [];
  const origins = [];

  for (let i = 0; i < COUNT; i++) {
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    const r = SPREAD * 0.3 + Math.random() * SPREAD * 0.7;

    const tx = r * Math.sin(phi) * Math.cos(theta);
    const ty = r * Math.sin(phi) * Math.sin(theta);
    const tz = (Math.random() - 0.5) * 250;

    // Start at center for explosion effect
    positions[i * 3] = (Math.random() - 0.5) * 10;
    positions[i * 3 + 1] = (Math.random() - 0.5) * 10;
    positions[i * 3 + 2] = (Math.random() - 0.5) * 10;

    origins.push({ x: tx, y: ty, z: tz });
    velocities.push({
      x: (Math.random() - 0.5) * 0.3,
      y: (Math.random() - 0.5) * 0.3,
      z: (Math.random() - 0.5) * 0.1,
    });
  }

  const particleGeo = new THREE.BufferGeometry();
  particleGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));

  const particleMat = new THREE.PointsMaterial({
    color: 0x00d4ff,
    size: 2.5,
    sizeAttenuation: true,
    transparent: true,
    opacity: 0.75,
  });

  const particles = new THREE.Points(particleGeo, particleMat);
  scene.add(particles);

  // === LINES (spatial grid for performance) ===
  const linePositions = new Float32Array(MAX_LINES * 6);
  const lineGeo = new THREE.BufferGeometry();
  lineGeo.setAttribute('position', new THREE.BufferAttribute(linePositions, 3));
  lineGeo.setDrawRange(0, 0);

  const lineMaterial = new THREE.LineBasicMaterial({
    color: 0x00d4ff,
    transparent: true,
    opacity: 0.15,
  });

  const lines = new THREE.LineSegments(lineGeo, lineMaterial);
  scene.add(lines);

  // === MOUSE ===
  const mouse = { x: 0, y: 0, nx: 0, ny: 0 };
  document.addEventListener('mousemove', (e) => {
    mouse.nx = (e.clientX / window.innerWidth - 0.5) * 2;
    mouse.ny = -(e.clientY / window.innerHeight - 0.5) * 2;
  });
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
  const startTime = Date.now();
  const EXPLOSION_DUR = 2200;

  function easeOutExpo(x) {
    return x === 1 ? 1 : 1 - Math.pow(2, -10 * x);
  }

  // === ANIMATE ===
  let frameCount = 0;

  function animate() {
    requestAnimationFrame(animate);
    frameCount++;

    const elapsed = Date.now() - startTime;
    const t = Math.min(elapsed / EXPLOSION_DUR, 1);

    // Smooth mouse
    mouse.x += (mouse.nx - mouse.x) * 0.06;
    mouse.y += (mouse.ny - mouse.y) * 0.06;

    const pos = particleGeo.attributes.position.array;
    const ease = easeOutExpo(t);

    for (let i = 0; i < COUNT; i++) {
      const ix = i * 3;
      const o = origins[i];
      const v = velocities[i];

      if (t < 1) {
        // Explosion phase
        pos[ix]     = o.x * ease;
        pos[ix + 1] = o.y * ease;
        pos[ix + 2] = o.z * ease;
      } else {
        // Post-explosion: drift + mouse gravity
        o.x += v.x * 0.02;
        o.y += v.y * 0.02;

        if (Math.abs(o.x) > SPREAD * 0.6) v.x *= -1;
        if (Math.abs(o.y) > SPREAD * 0.6) v.y *= -1;

        const mx = mouse.x * 300;
        const my = mouse.y * 300;
        const dx = mx - o.x;
        const dy = my - o.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < 200 && dist > 1) {
          const strength = (1 - dist / 200) * 0.5;
          o.x += (dx / dist) * strength;
          o.y += (dy / dist) * strength;
        }

        pos[ix]     = o.x;
        pos[ix + 1] = o.y;
        pos[ix + 2] = o.z;
      }
    }

    particleGeo.attributes.position.needsUpdate = true;

    // Build lines every 3rd frame for performance
    if (t > 0.5 && frameCount % 3 === 0) {
      const lp = lineGeo.attributes.position.array;
      let lineCount = 0;
      const maxDist2 = MAX_DIST * MAX_DIST;

      // Sample subset for line connections (skip every Nth particle)
      const step = COUNT > 800 ? 2 : 1;

      for (let i = 0; i < COUNT && lineCount < MAX_LINES; i += step) {
        const ax = pos[i * 3], ay = pos[i * 3 + 1], az = pos[i * 3 + 2];

        for (let j = i + 1; j < COUNT && lineCount < MAX_LINES; j += step) {
          const dx = ax - pos[j * 3];
          const dy = ay - pos[j * 3 + 1];
          const dz = az - pos[j * 3 + 2];
          const d2 = dx * dx + dy * dy + dz * dz;

          if (d2 < maxDist2) {
            const base = lineCount * 6;
            lp[base]     = ax;
            lp[base + 1] = ay;
            lp[base + 2] = az;
            lp[base + 3] = pos[j * 3];
            lp[base + 4] = pos[j * 3 + 1];
            lp[base + 5] = pos[j * 3 + 2];
            lineCount++;
          }
        }
      }

      lineGeo.attributes.position.needsUpdate = true;
      lineGeo.setDrawRange(0, lineCount * 2);

      const lineOpacity = Math.min((t - 0.5) / 0.3, 1) * 0.2;
      lineMaterial.opacity = lineOpacity;
    }

    // Camera follow mouse
    camera.position.x += (mouse.x * 25 - camera.position.x) * 0.02;
    camera.position.y += (mouse.y * 15 - camera.position.y) * 0.02;
    camera.lookAt(scene.position);

    renderer.render(scene, camera);
  }

  animate();
})();
