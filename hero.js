// ===== Hero: lightweight constellation + drifting grid =====
// Completely stripped-down version that prioritizes performance over
// maximum spectacle. No post-processing, no GPGPU, no raymarching, no
// audio analyser. The animation loop pauses via IntersectionObserver
// when the hero scrolls out of view so it doesn't tax the GPU on the
// rest of the page.
(function () {
  console.log('[hero] v4 lightweight constellation');
  const canvas = document.getElementById('hero-canvas');
  if (!canvas) { console.warn('[hero] #hero-canvas not found'); return; }
  if (typeof THREE === 'undefined') { console.warn('[hero] THREE undefined'); return; }

  // ---------- Renderer ----------
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: false,
      alpha: false,
      powerPreference: 'high-performance',
    });
  } catch (e) {
    console.warn('[hero] WebGL unavailable', e);
    return;
  }
  const DPR = Math.min(window.devicePixelRatio || 1, 1.25);
  renderer.setPixelRatio(DPR);
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setClearColor(0x04060c, 1);
  renderer.autoClear = false;

  // ---------- Scenes ----------
  const bgScene = new THREE.Scene();
  const bgCam   = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

  const fxScene = new THREE.Scene();
  const fxCam = new THREE.PerspectiveCamera(58, window.innerWidth / window.innerHeight, 0.1, 3000);
  const CAM_Z_START = 1400;
  const CAM_Z_HOME  = 560;
  fxCam.position.set(0, 0, CAM_Z_START);

  // ---------- Background: cheap drifting grid shader + cursor halo ----------
  const bgUniforms = {
    uTime:  { value: 0 },
    uRes:   { value: new THREE.Vector2(window.innerWidth, window.innerHeight) },
    uMouse: { value: new THREE.Vector2(0.5, 0.5) },
    uIntro: { value: 0 },
  };
  const bgMat = new THREE.ShaderMaterial({
    uniforms: bgUniforms,
    vertexShader: 'varying vec2 vUv; void main(){ vUv=uv; gl_Position=vec4(position.xy,0.0,1.0); }',
    fragmentShader: /* glsl */ `
      precision mediump float;
      varying vec2 vUv;
      uniform float uTime;
      uniform vec2  uRes;
      uniform vec2  uMouse;
      uniform float uIntro;

      float grid(vec2 p, float spacing, float width) {
        vec2 g = abs(fract(p / spacing - 0.5) - 0.5) * spacing;
        return 1.0 - smoothstep(0.0, width, min(g.x, g.y));
      }

      void main() {
        vec2 uv = vUv - 0.5;
        uv.x *= uRes.x / uRes.y;

        // deep navy base
        vec3 col = vec3(0.022, 0.030, 0.050);

        // two drifting grid layers for depth
        vec2 gp = uv + vec2(uTime * 0.012, 0.0);
        float g1 = grid(gp, 0.10, 0.0022) * 0.20;
        float g2 = grid(gp, 0.32, 0.0035) * 0.10;
        col += (g1 + g2) * vec3(0.30, 0.55, 0.90);

        // cursor soft halo
        vec2 m = uMouse - 0.5;
        m.x *= uRes.x / uRes.y;
        float md = length(uv - m);
        col += exp(-md * 3.8) * vec3(0.10, 0.25, 0.42) * 0.45;

        // vignette
        float vig = smoothstep(1.15, 0.10, length(uv));
        col *= mix(0.40, 1.0, vig);

        col *= smoothstep(0.0, 1.0, uIntro);
        gl_FragColor = vec4(col, 1.0);
      }
    `,
    depthTest: false, depthWrite: false,
  });
  bgScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), bgMat));

  // ---------- Constellation: CPU-updated points + connection lines ----------
  const COUNT = window.innerWidth < 700 ? 260 : 460;
  const SPREAD = 700;
  const positions = new Float32Array(COUNT * 3);
  const colors    = new Float32Array(COUNT * 3);
  const sizes     = new Float32Array(COUNT);
  const origins   = new Array(COUNT);
  const phases    = new Float32Array(COUNT);

  for (let i = 0; i < COUNT; i++) {
    const a = Math.random() * Math.PI * 2;
    const b = Math.random() * Math.PI * 2;
    const R = 240 + Math.random() * 160;
    const r = 70 + Math.random() * 60;
    const x = (R + r * Math.cos(b)) * Math.cos(a);
    const y = (R + r * Math.cos(b)) * Math.sin(a) * 0.55;
    const z = r * Math.sin(b) + (Math.random() - 0.5) * 140;
    origins[i] = { x, y, z, a, b, R, r };
    positions[i * 3]     = (Math.random() - 0.5) * 4;
    positions[i * 3 + 1] = (Math.random() - 0.5) * 4;
    positions[i * 3 + 2] = (Math.random() - 0.5) * 4;

    const t = i / COUNT;
    colors[i * 3]     = 0.28 + 0.58 * Math.sin(6.28 * t + 0.0);
    colors[i * 3 + 1] = 0.42 + 0.50 * Math.sin(6.28 * t + 1.2);
    colors[i * 3 + 2] = 0.85 + 0.15 * Math.sin(6.28 * t + 2.4);

    sizes[i]  = 5 + Math.random() * 7;
    phases[i] = Math.random() * Math.PI * 2;
  }

  const pGeo = new THREE.BufferGeometry();
  pGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  pGeo.setAttribute('aColor',   new THREE.BufferAttribute(colors, 3));
  pGeo.setAttribute('aSize',    new THREE.BufferAttribute(sizes, 1));

  const pMat = new THREE.ShaderMaterial({
    uniforms: {
      uPR:       { value: DPR },
      uMouseW:   { value: new THREE.Vector3(9999, 9999, 0) },
      uHover:    { value: 0 },
      uOpacity:  { value: 0 },
    },
    vertexShader: /* glsl */ `
      attribute vec3  aColor;
      attribute float aSize;
      varying vec3  vColor;
      varying float vGlow;
      uniform float uPR;
      uniform vec3  uMouseW;
      uniform float uHover;
      void main() {
        float d = distance(position.xy, uMouseW.xy);
        float k = exp(-d * d / (130.0 * 130.0)) * uHover;
        vGlow = k;
        vColor = mix(aColor, vec3(0.60, 0.90, 1.05), k * 0.35);
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = aSize * uPR * (300.0 / -mv.z) * (1.0 + k * 0.6);
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */ `
      varying vec3  vColor;
      varying float vGlow;
      uniform float uOpacity;
      void main() {
        vec2 c = gl_PointCoord - 0.5;
        float d = length(c);
        float core  = smoothstep(0.5, 0.0, d);
        float halo  = exp(-d * 3.4) * (0.85 + vGlow * 0.35);
        float outer = exp(-d * 1.5) * 0.28;
        vec3 col = vColor * (core * 0.9 + halo + outer);
        float a = clamp(core + halo * 0.9 + outer * 0.6, 0.0, 1.0);
        gl_FragColor = vec4(col, a * uOpacity);
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const pts = new THREE.Points(pGeo, pMat);
  pts.position.y = -140;
  fxScene.add(pts);

  // Dynamic connection lines
  const MAX_LINES = 900;
  const linePos = new Float32Array(MAX_LINES * 6);
  const lineCol = new Float32Array(MAX_LINES * 6);
  const lineGeo = new THREE.BufferGeometry();
  lineGeo.setAttribute('position', new THREE.BufferAttribute(linePos, 3));
  lineGeo.setAttribute('color',    new THREE.BufferAttribute(lineCol, 3));
  lineGeo.setDrawRange(0, 0);
  const lineMat = new THREE.LineBasicMaterial({
    vertexColors: true,
    transparent: true,
    opacity: 0.28,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const lineSeg = new THREE.LineSegments(lineGeo, lineMat);
  lineSeg.position.y = -140;
  fxScene.add(lineSeg);

  // ---------- Input ----------
  const mouse = { x: 0.5, y: 0.5, tx: 0.5, ty: 0.5, present: false };
  function setTargetFromEvent(cx, cy) {
    const nx = cx / window.innerWidth;
    const ny = 1 - cy / window.innerHeight;
    if (!mouse.present) { mouse.x = nx; mouse.y = ny; mouse.present = true; }
    mouse.tx = nx; mouse.ty = ny;
  }
  window.addEventListener('mousemove', (e) => setTargetFromEvent(e.clientX, e.clientY));
  window.addEventListener('touchmove', (e) => {
    const t = e.touches[0]; setTargetFromEvent(t.clientX, t.clientY);
  }, { passive: true });
  const releaseCursor = () => { mouse.present = false; };
  document.addEventListener('mouseleave', releaseCursor);
  window.addEventListener('blur',          releaseCursor);
  document.addEventListener('touchend',    releaseCursor);

  window.addEventListener('resize', () => {
    const w = window.innerWidth, h = window.innerHeight;
    renderer.setSize(w, h);
    fxCam.aspect = w / h; fxCam.updateProjectionMatrix();
    bgUniforms.uRes.value.set(w, h);
  });

  // ---------- GSAP Scroll: camera dolly ----------
  if (typeof gsap !== 'undefined' && typeof ScrollTrigger !== 'undefined') {
    gsap.registerPlugin(ScrollTrigger);
    ScrollTrigger.create({
      trigger: '#hero',
      start: 'top top',
      end: 'bottom top',
      scrub: 0.6,
      onUpdate: (self) => {
        const p = self.progress;
        fxCam.position.z = CAM_Z_HOME + p * 600;
      },
    });
  }

  // ---------- Pause when off-screen ----------
  let visible = true;
  const hero = document.getElementById('hero');
  if (hero && 'IntersectionObserver' in window) {
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) visible = e.isIntersecting;
    }, { rootMargin: '0px' });
    io.observe(hero);
  }
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) visible = false;
    else if (hero) visible = hero.getBoundingClientRect().bottom > 0 && hero.getBoundingClientRect().top < window.innerHeight;
  });

  // ---------- Animate ----------
  const t0 = performance.now();
  let frame = 0;
  const MAX_D = 95;

  function animate() {
    requestAnimationFrame(animate);
    if (!visible) return;

    frame++;
    const now = performance.now();
    const elapsed = (now - t0) * 0.001;

    mouse.x += (mouse.tx - mouse.x) * 0.10;
    mouse.y += (mouse.ty - mouse.y) * 0.10;

    bgUniforms.uTime.value = elapsed;
    bgUniforms.uMouse.value.set(mouse.x, mouse.y);

    // Intro: 2.8s camera dolly + fade
    const INTRO = 2.8;
    const tNorm = Math.min(elapsed / INTRO, 1);
    const easeInOutCubic = tNorm < 0.5 ? 4 * tNorm * tNorm * tNorm : 1 - Math.pow(-2 * tNorm + 2, 3) / 2;
    fxCam.position.z = CAM_Z_START + (CAM_Z_HOME - CAM_Z_START) * easeInOutCubic;

    const fadeIn = Math.min(elapsed / 0.9, 1);
    bgUniforms.uIntro.value = fadeIn;
    pMat.uniforms.uOpacity.value = fadeIn;

    // Hover fade
    pMat.uniforms.uHover.value += ((mouse.present ? 1 : 0) - pMat.uniforms.uHover.value) * 0.06;
    pMat.uniforms.uMouseW.value.set((mouse.x - 0.5) * 900, (mouse.y - 0.5) * 560 - pts.position.y, 0);

    // Particle orbital motion
    const pos = pGeo.attributes.position.array;
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
      const cx = tx * easeInOutCubic;
      const cy = ty * easeInOutCubic;
      const cz = tz * easeInOutCubic;
      const lerp = 0.08 + easeInOutCubic * 0.06;
      pos[ix]     += (cx - pos[ix])     * lerp;
      pos[ix + 1] += (cy - pos[ix + 1]) * lerp;
      pos[ix + 2] += (cz - pos[ix + 2]) * lerp;
    }
    pGeo.attributes.position.needsUpdate = true;

    // Connection lines every 2 frames
    if (elapsed > 0.8 && frame % 2 === 0) {
      let lc = 0;
      const md2 = MAX_D * MAX_D;
      const step = COUNT > 300 ? 2 : 1;
      const mxW = pMat.uniforms.uMouseW.value.x;
      const myW = pMat.uniforms.uMouseW.value.y;
      const HOVER_R2 = 220 * 220;
      const hoverAmt = pMat.uniforms.uHover.value;
      for (let i = 0; i < COUNT && lc < MAX_LINES; i += step) {
        const ax = pos[i * 3], ay = pos[i * 3 + 1], az = pos[i * 3 + 2];
        const ci = i * 3;
        const adx = ax - mxW, ady = ay - myW;
        const aHover = Math.max(0, 1 - (adx * adx + ady * ady) / HOVER_R2);
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
            const k = 1 - d2 / md2;
            const bdx = pos[j * 3] - mxW, bdy = pos[j * 3 + 1] - myW;
            const bHover = Math.max(0, 1 - (bdx * bdx + bdy * bdy) / HOVER_R2);
            const aBoost = 1 + aHover * 3.2 * hoverAmt;
            const bBoost = 1 + bHover * 3.2 * hoverAmt;
            lineCol[base]     = colors[ci]     * k * aBoost;
            lineCol[base + 1] = colors[ci + 1] * k * aBoost;
            lineCol[base + 2] = colors[ci + 2] * k * aBoost;
            lineCol[base + 3] = colors[j * 3]     * k * bBoost;
            lineCol[base + 4] = colors[j * 3 + 1] * k * bBoost;
            lineCol[base + 5] = colors[j * 3 + 2] * k * bBoost;
            lc++;
          }
        }
      }
      lineGeo.attributes.position.needsUpdate = true;
      lineGeo.attributes.color.needsUpdate = true;
      lineGeo.setDrawRange(0, lc * 2);
    }

    // Slow autonomous rotation
    pts.rotation.z = Math.sin(elapsed * 0.1) * 0.15;
    pts.rotation.x = Math.cos(elapsed * 0.08) * 0.1;
    lineSeg.rotation.copy(pts.rotation);
    fxCam.lookAt(0, 0, 0);

    renderer.clear();
    renderer.render(bgScene, bgCam);
    renderer.render(fxScene, fxCam);
  }

  animate();
})();
