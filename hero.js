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

      // -- hash / noise --
      float hash(vec2 p) {
        p = fract(p * vec2(234.34, 435.345));
        p += dot(p, p + 34.23);
        return fract(p.x * p.y);
      }
      float noise(in vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        vec2 u = f * f * (3.0 - 2.0 * f);
        return mix(
          mix(hash(i + vec2(0.0, 0.0)), hash(i + vec2(1.0, 0.0)), u.x),
          mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x),
          u.y);
      }
      float fbm(vec2 p) {
        float v = 0.0;
        float a = 0.5;
        mat2 rot = mat2(0.8, 0.6, -0.6, 0.8);
        for (int i = 0; i < 5; i++) {
          v += a * noise(p);
          p = rot * p * 2.03 + vec2(1.3, 1.7);
          a *= 0.5;
        }
        return v;
      }

      // IQ cosine palette
      vec3 palette(float t) {
        vec3 a = vec3(0.48, 0.50, 0.58);
        vec3 b = vec3(0.50, 0.50, 0.55);
        vec3 c = vec3(1.00, 1.00, 1.10);
        vec3 d = vec3(0.10, 0.35, 0.68); // cyan -> magenta -> violet phase
        return a + b * cos(6.28318 * (c * t + d));
      }

      float sampleField(vec2 p, float t) {
        // domain warp (IQ style)
        vec2 q = vec2(fbm(p + vec2(0.0, 0.0)),
                      fbm(p + vec2(5.2, 1.3)));
        vec2 r = vec2(fbm(p + 4.0 * q + vec2(1.7, 9.2) + 0.15 * t),
                      fbm(p + 4.0 * q + vec2(8.3, 2.8) + 0.126 * t));
        return fbm(p + 4.0 * r);
      }

      void main() {
        vec2 uv = vUv;
        vec2 p  = (uv - 0.5);
        p.x *= uRes.x / uRes.y;

        // mouse-centered warp
        vec2 m = uMouse - 0.5;
        m.x *= uRes.x / uRes.y;
        vec2 toM = p - m;
        float md = length(toM);
        float pull = exp(-md * 2.2) * 0.35;
        p -= normalize(toM + 1e-5) * pull;

        // flow offset by mouse velocity for a "push" feel
        vec2 flow = uMouseVel * 0.6;

        float t = uTime * 0.12;
        vec2 sp = p * 1.6 + flow;

        // chromatic sampling — offset per channel for dispersion
        float disp = 0.012 + md * 0.02;
        float fr = sampleField(sp + vec2( disp, 0.0), t);
        float fg = sampleField(sp,                     t + 0.05);
        float fb = sampleField(sp + vec2(-disp, disp), t + 0.10);

        vec3 col;
        col.r = palette(fr + 0.00).r;
        col.g = palette(fg + 0.05).g;
        col.b = palette(fb + 0.10).b;

        // deep-space base + energy lift at high-density regions
        float density = (fr + fg + fb) / 3.0;
        col *= 0.35 + pow(density, 2.0) * 1.8;

        // filaments: sharpen fine detail
        float fil = smoothstep(0.55, 0.95, density);
        col += fil * vec3(0.35, 0.55, 0.95) * 0.6;

        // cursor halo
        col += exp(-md * 4.5) * vec3(0.25, 0.55, 0.9) * 0.55;

        // vignette
        float vig = smoothstep(1.25, 0.25, length(p));
        col *= mix(0.55, 1.0, vig);

        // subtle scanline + grain for texture
        float grain = hash(gl_FragCoord.xy + uTime) * 0.04 - 0.02;
        col += grain;

        // deep base color mix
        col = mix(vec3(0.015, 0.02, 0.04), col, 0.92);

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

  const COUNT = window.innerWidth < 700 ? 420 : 900;
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

    sizes[i]  = 6 + Math.random() * 10;
    phases[i] = Math.random() * Math.PI * 2;
  }

  const pGeo = new THREE.BufferGeometry();
  pGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  pGeo.setAttribute('aColor',   new THREE.BufferAttribute(colors, 3));
  pGeo.setAttribute('aSize',    new THREE.BufferAttribute(sizes, 1));

  const pMat = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uPR: { value: DPR } },
    vertexShader: /* glsl */ `
      attribute vec3  aColor;
      attribute float aSize;
      varying vec3 vColor;
      uniform float uPR;
      void main() {
        vColor = aColor;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = aSize * uPR * (300.0 / -mv.z);
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */ `
      varying vec3 vColor;
      void main() {
        vec2 c = gl_PointCoord - 0.5;
        float d = length(c);
        float core = smoothstep(0.5, 0.0, d);
        float glow = exp(-d * 6.0) * 0.9;
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
    opacity: 0.35,
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

    // particle motion
    const pos = pGeo.attributes.position.array;
    const introEase = 1 - Math.pow(1 - Math.min(elapsed / 2.0, 1), 4); // easeOutQuart
    const mx = (mouse.x - 0.5) * 600;
    const my = (mouse.y - 0.5) * 400;

    for (let i = 0; i < COUNT; i++) {
      const o = origins[i];
      // slow orbital drift
      o.a += 0.0015;
      o.b += 0.0009;
      const R = o.R, r = o.r;
      const breathe = 1 + Math.sin(elapsed * 0.9 + phases[i]) * 0.06;
      let tx = (R + r * Math.cos(o.b)) * Math.cos(o.a) * breathe;
      let ty = (R + r * Math.cos(o.b)) * Math.sin(o.a) * 0.55 * breathe;
      let tz = r * Math.sin(o.b);

      // cursor gravity
      const dx = mx - tx, dy = my - ty;
      const d2 = dx * dx + dy * dy;
      if (d2 < 90000) {
        const f = (1 - d2 / 90000) * 0.25;
        tx += dx * f;
        ty += dy * f;
      }

      const ix = i * 3;
      // intro: lerp from center to target
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

    // parallax camera
    fxCam.position.x += ((mouse.x - 0.5) * 120 - fxCam.position.x) * 0.03;
    fxCam.position.y += ((mouse.y - 0.5) *  80 - fxCam.position.y) * 0.03;
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
