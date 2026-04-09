// ===== Hero Background: Shader Nebula + Reactive Particle Lattice =====
// Fullscreen domain-warped FBM flow shader with iridescent palette,
// mouse-warped chromatic aberration, overlaid with an additive particle
// constellation that breathes, orbits, and reacts to the cursor.
(function () {
  console.log('[hero] v2 shader-nebula script loaded');
  const canvas = document.getElementById('hero-canvas');
  if (!canvas) { console.warn('[hero] #hero-canvas not found'); return; }
  if (typeof THREE === 'undefined') { console.warn('[hero] THREE is undefined'); return; }
  console.log('[hero] canvas found, THREE present, initializing renderer');

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: false,
      alpha: false,
      powerPreference: 'high-performance',
    });
  } catch (e) {
    console.warn('WebGL unavailable:', e);
    return;
  }

  const DPR = Math.min(window.devicePixelRatio || 1, 1.75);
  renderer.setPixelRatio(DPR);
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setClearColor(0x05060b, 1);
  renderer.autoClear = false;

  // ===== Scene A: fullscreen shader background =====
  const bgScene = new THREE.Scene();
  const bgCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

  const uniforms = {
    uTime:     { value: 0 },
    uRes:      { value: new THREE.Vector2(window.innerWidth, window.innerHeight) },
    uMouse:    { value: new THREE.Vector2(0.5, 0.5) },
    uMouseVel: { value: new THREE.Vector2(0, 0) },
    uIntro:    { value: 0 },
  };

  const bgMat = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = vec4(position.xy, 0.0, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      precision highp float;
      varying vec2 vUv;
      uniform float uTime;
      uniform vec2  uRes;
      uniform vec2  uMouse;
      uniform vec2  uMouseVel;
      uniform float uIntro;

      // Engineered grid: dark base, subtle perspective-grid lines that drift,
      // a slow soft cyan glow following the cursor, and a vignette. No FBM,
      // no palettes — clean and out of the way.

      float grid(vec2 p, float spacing, float width) {
        vec2 g = abs(fract(p / spacing - 0.5) - 0.5) * spacing;
        float d = min(g.x, g.y);
        return 1.0 - smoothstep(0.0, width, d);
      }

      void main() {
        vec2 uv = vUv;
        vec2 p  = (uv - 0.5);
        p.x *= uRes.x / uRes.y;

        // deep navy-black base
        vec3 col = vec3(0.020, 0.028, 0.045);

        // slow horizontal drift
        vec2 gp = p + vec2(uTime * 0.015, 0.0);

        // two grid scales for depth
        float g1 = grid(gp, 0.09, 0.0018) * 0.18;
        float g2 = grid(gp, 0.27, 0.0030) * 0.10;
        vec3 gridCol = vec3(0.35, 0.55, 0.85);
        col += (g1 + g2) * gridCol;

        // cursor glow — soft cyan blob
        vec2 m = uMouse - 0.5;
        m.x *= uRes.x / uRes.y;
        float md = length(p - m);
        col += exp(-md * 3.5) * vec3(0.10, 0.22, 0.38) * 0.45;

        // radial vignette
        float vig = smoothstep(1.15, 0.10, length(p));
        col *= mix(0.40, 1.0, vig);

        // intro reveal
        col *= smoothstep(0.0, 1.0, uIntro);

        gl_FragColor = vec4(col, 1.0);
      }
    `,
    depthTest: false,
    depthWrite: false,
  });

  const bgQuad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), bgMat);
  bgScene.add(bgQuad);

  // ===== Scene B: particle lattice (additive) =====
  const fxScene = new THREE.Scene();
  const fxCam = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 3000);
  fxCam.position.z = 520;

  const COUNT = window.innerWidth < 700 ? 180 : 380;
  const SPREAD = 700;
  const positions = new Float32Array(COUNT * 3);
  const colors    = new Float32Array(COUNT * 3);
  const sizes     = new Float32Array(COUNT);
  const origins   = new Array(COUNT);
  const phases    = new Float32Array(COUNT);

  for (let i = 0; i < COUNT; i++) {
    // distribute on a noisy torus-knot-ish ring for elegance
    const a = Math.random() * Math.PI * 2;
    const b = Math.random() * Math.PI * 2;
    const R = 260 + Math.random() * 140;
    const r = 80 + Math.random() * 60;
    const x = (R + r * Math.cos(b)) * Math.cos(a);
    const y = (R + r * Math.cos(b)) * Math.sin(a) * 0.55;
    const z = r * Math.sin(b) + (Math.random() - 0.5) * 160;

    origins[i] = { x, y, z, a, b, R, r };
    positions[i * 3]     = (Math.random() - 0.5) * 4;
    positions[i * 3 + 1] = (Math.random() - 0.5) * 4;
    positions[i * 3 + 2] = (Math.random() - 0.5) * 4;

    // iridescent color ramp
    const t = i / COUNT;
    colors[i * 3]     = 0.25 + 0.55 * Math.sin(6.28 * t + 0.0);
    colors[i * 3 + 1] = 0.35 + 0.50 * Math.sin(6.28 * t + 1.2);
    colors[i * 3 + 2] = 0.85 + 0.15 * Math.sin(6.28 * t + 2.4);

    sizes[i]  = 3 + Math.random() * 5;
    phases[i] = Math.random() * Math.PI * 2;
  }

  const pGeo = new THREE.BufferGeometry();
  pGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  pGeo.setAttribute('aColor',   new THREE.BufferAttribute(colors, 3));
  pGeo.setAttribute('aSize',    new THREE.BufferAttribute(sizes, 1));

  const pMat = new THREE.ShaderMaterial({
    uniforms: {
      uTime:   { value: 0 },
      uPR:     { value: DPR },
      uMouseW: { value: new THREE.Vector3(9999, 9999, 0) },
    },
    vertexShader: /* glsl */ `
      attribute vec3  aColor;
      attribute float aSize;
      varying vec3  vColor;
      varying float vGlow;
      uniform float uPR;
      uniform vec3  uMouseW;
      void main() {
        // proximity highlight: particles near the projected cursor line get
        // a brightness and size boost, but do not move.
        float d  = distance(position.xy, uMouseW.xy);
        float k  = exp(-d * d / (120.0 * 120.0)); // falloff
        vGlow    = k;
        vec3 tint = mix(vColor, vec3(0.55, 0.85, 1.05), k * 0.7);
        vColor    = tint;

        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = aSize * uPR * (300.0 / -mv.z) * (1.0 + k * 1.8);
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */ `
      varying vec3  vColor;
      varying float vGlow;
      void main() {
        vec2 c = gl_PointCoord - 0.5;
        float d = length(c);
        float core = smoothstep(0.5, 0.0, d);
        float glow = exp(-d * 6.0) * (0.9 + vGlow * 0.8);
        vec3 col = vColor * (core + glow);
        gl_FragColor = vec4(col, core + glow * 0.8);
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const pts = new THREE.Points(pGeo, pMat);
  fxScene.add(pts);

  // dynamic connection lines
  const MAX_LINES = 1600;
  const linePos = new Float32Array(MAX_LINES * 6);
  const lineCol = new Float32Array(MAX_LINES * 6);
  const lineGeo = new THREE.BufferGeometry();
  lineGeo.setAttribute('position', new THREE.BufferAttribute(linePos, 3));
  lineGeo.setAttribute('color',    new THREE.BufferAttribute(lineCol, 3));
  lineGeo.setDrawRange(0, 0);
  const lineMat = new THREE.LineBasicMaterial({
    vertexColors: true,
    transparent: true,
    opacity: 0.12,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const lineSeg = new THREE.LineSegments(lineGeo, lineMat);
  fxScene.add(lineSeg);

  // ===== Input =====
  const mouse = { x: 0.5, y: 0.5, tx: 0.5, ty: 0.5, vx: 0, vy: 0, px: 0.5, py: 0.5 };
  window.addEventListener('mousemove', (e) => {
    mouse.tx = e.clientX / window.innerWidth;
    mouse.ty = 1 - e.clientY / window.innerHeight;
  });
  window.addEventListener('touchmove', (e) => {
    const t = e.touches[0];
    mouse.tx = t.clientX / window.innerWidth;
    mouse.ty = 1 - t.clientY / window.innerHeight;
  }, { passive: true });

  window.addEventListener('resize', () => {
    const w = window.innerWidth, h = window.innerHeight;
    renderer.setSize(w, h);
    uniforms.uRes.value.set(w, h);
    fxCam.aspect = w / h;
    fxCam.updateProjectionMatrix();
  });

  // ===== Animate =====
  const t0 = performance.now();
  const MAX_D = 95;
  let frame = 0;

  function animate() {
    requestAnimationFrame(animate);
    frame++;
    const now = performance.now();
    const elapsed = (now - t0) * 0.001;

    // smooth mouse + velocity
    mouse.x += (mouse.tx - mouse.x) * 0.08;
    mouse.y += (mouse.ty - mouse.y) * 0.08;
    mouse.vx = mouse.vx * 0.9 + (mouse.x - mouse.px) * 4.0;
    mouse.vy = mouse.vy * 0.9 + (mouse.y - mouse.py) * 4.0;
    mouse.px = mouse.x; mouse.py = mouse.y;

    uniforms.uTime.value = elapsed;
    uniforms.uMouse.value.set(mouse.x, mouse.y);
    uniforms.uMouseVel.value.set(mouse.vx, mouse.vy);
    uniforms.uIntro.value = Math.min(elapsed / 1.4, 1);

    pMat.uniforms.uTime.value = elapsed;
    // project cursor to the particle plane (z=0) for proximity highlight
    pMat.uniforms.uMouseW.value.set((mouse.x - 0.5) * 900, (mouse.y - 0.5) * 560, 0);

    // particle motion (orbital only — no cursor gravity)
    const pos = pGeo.attributes.position.array;
    const introEase = 1 - Math.pow(1 - Math.min(elapsed / 2.0, 1), 4); // easeOutQuart

    for (let i = 0; i < COUNT; i++) {
      const o = origins[i];
      o.a += 0.0015;
      o.b += 0.0009;
      const R = o.R, r = o.r;
      const breathe = 1 + Math.sin(elapsed * 0.9 + phases[i]) * 0.06;
      const tx = (R + r * Math.cos(o.b)) * Math.cos(o.a) * breathe;
      const ty = (R + r * Math.cos(o.b)) * Math.sin(o.a) * 0.55 * breathe;
      const tz = r * Math.sin(o.b);

      const ix = i * 3;
      const cx = tx * introEase;
      const cy = ty * introEase;
      const cz = tz * introEase;
      pos[ix]     += (cx - pos[ix])     * 0.12;
      pos[ix + 1] += (cy - pos[ix + 1]) * 0.12;
      pos[ix + 2] += (cz - pos[ix + 2]) * 0.12;
    }
    pGeo.attributes.position.needsUpdate = true;

    // connection lines every 2 frames
    if (elapsed > 0.8 && frame % 2 === 0) {
      let lc = 0;
      const md2 = MAX_D * MAX_D;
      const step = COUNT > 600 ? 2 : 1;
      for (let i = 0; i < COUNT && lc < MAX_LINES; i += step) {
        const ax = pos[i * 3], ay = pos[i * 3 + 1], az = pos[i * 3 + 2];
        const ci = i * 3;
        for (let j = i + step; j < COUNT && lc < MAX_LINES; j += step) {
          const dx = ax - pos[j * 3];
          const dy = ay - pos[j * 3 + 1];
          const dz = az - pos[j * 3 + 2];
          const d2 = dx * dx + dy * dy + dz * dz;
          if (d2 < md2) {
            const base = lc * 6;
            linePos[base]     = ax;
            linePos[base + 1] = ay;
            linePos[base + 2] = az;
            linePos[base + 3] = pos[j * 3];
            linePos[base + 4] = pos[j * 3 + 1];
            linePos[base + 5] = pos[j * 3 + 2];
            // fade with distance
            const k = 1 - d2 / md2;
            lineCol[base]     = colors[ci]     * k;
            lineCol[base + 1] = colors[ci + 1] * k;
            lineCol[base + 2] = colors[ci + 2] * k;
            lineCol[base + 3] = colors[j * 3]     * k;
            lineCol[base + 4] = colors[j * 3 + 1] * k;
            lineCol[base + 5] = colors[j * 3 + 2] * k;
            lc++;
          }
        }
      }
      lineGeo.attributes.position.needsUpdate = true;
      lineGeo.attributes.color.needsUpdate = true;
      lineGeo.setDrawRange(0, lc * 2);
    }

    // autonomous rotation (no mouse parallax)
    pts.rotation.z = Math.sin(elapsed * 0.1) * 0.15;
    pts.rotation.x = Math.cos(elapsed * 0.08) * 0.1;
    lineSeg.rotation.copy(pts.rotation);
    fxCam.lookAt(0, 0, 0);

    // render both passes
    renderer.clear();
    renderer.render(bgScene, bgCam);
    renderer.render(fxScene, fxCam);
  }

  console.log('[hero] starting animation loop, COUNT=', COUNT);
  animate();
})();
