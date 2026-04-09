// ===== Hero: GPGPU flow-field particles + HDR bloom + raymarched SDF bg =====
// Features:
//   - 16k GPGPU particles with curl-noise velocity field
//   - UnrealBloom post-processing for real HDR glow
//   - Raymarched gyroid background (subtle, atmospheric)
//   - Procedural name swarm on intro: particles form "JAMES LEVAC" then disperse
//   - Cursor force (repel/attract) baked into the velocity simulation
//   - GSAP ScrollTrigger ties camera dolly to scroll position
//   - Optional audio-reactive mode: mic FFT drives bloom strength + particle pulse
(function () {
  console.log('[hero] v3 GPGPU+bloom+SDF+logo+scroll+audio');
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
  const DPR = Math.min(window.devicePixelRatio || 1, 1.75);
  renderer.setPixelRatio(DPR);
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setClearColor(0x03050b, 1);
  renderer.autoClear = false;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;

  const gl = renderer.getContext();
  // WebGL2 supports float render targets natively (RGBA32F) without extensions.
  // On WebGL1 we need OES_texture_float.
  const isWebGL2 = renderer.capabilities.isWebGL2;
  const hasFloatTex = isWebGL2
    || !!gl.getExtension('OES_texture_float')
    || !!gl.getExtension('EXT_color_buffer_float');

  // ---------- Scenes / cameras ----------
  const bgScene = new THREE.Scene();
  const bgCam   = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

  const fxScene = new THREE.Scene();
  const fxCam = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 6000);
  const CAM_Z_START = 1800;
  const CAM_Z_HOME  = 560;
  fxCam.position.set(0, 0, CAM_Z_START);

  // ---------- Background: raymarched gyroid + cursor glow ----------
  const bgUniforms = {
    uTime:  { value: 0 },
    uRes:   { value: new THREE.Vector2(window.innerWidth, window.innerHeight) },
    uMouse: { value: new THREE.Vector2(0.5, 0.5) },
    uIntro: { value: 0 },
    uPulse: { value: 0 }, // audio-reactive pulse
  };
  const bgMat = new THREE.ShaderMaterial({
    uniforms: bgUniforms,
    vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=vec4(position.xy,0.0,1.0); }`,
    fragmentShader: /* glsl */ `
      precision highp float;
      varying vec2 vUv;
      uniform float uTime;
      uniform vec2  uRes;
      uniform vec2  uMouse;
      uniform float uIntro;
      uniform float uPulse;

      // Gyroid SDF
      float sdGyroid(vec3 p, float scale, float thick, float bias) {
        p *= scale;
        return abs(dot(sin(p), cos(p.zxy))) / scale - thick + bias;
      }
      float map(vec3 p) {
        float g1 = sdGyroid(p, 0.8,  0.03, 0.0);
        float g2 = sdGyroid(p, 1.7,  0.02, 0.0) * 0.6;
        return min(g1, g2);
      }

      vec3 calcNormal(vec3 p) {
        const vec2 e = vec2(0.001, 0.0);
        return normalize(vec3(
          map(p + e.xyy) - map(p - e.xyy),
          map(p + e.yxy) - map(p - e.yxy),
          map(p + e.yyx) - map(p - e.yyx)));
      }

      void main() {
        vec2 uv = (vUv - 0.5);
        uv.x *= uRes.x / uRes.y;

        vec3 ro = vec3(0.0, 0.0, 3.0);
        vec3 rd = normalize(vec3(uv, -1.4));

        // slow camera sway
        float t = uTime * 0.08;
        ro.xz = mat2(cos(t), -sin(t), sin(t), cos(t)) * ro.xz;
        rd.xz = mat2(cos(t), -sin(t), sin(t), cos(t)) * rd.xz;

        float total = 0.0;
        float d = 0.0;
        vec3  p;
        float glow = 0.0;
        for (int i = 0; i < 36; i++) {
          p = ro + rd * total;
          d = map(p);
          glow += exp(-abs(d) * 8.0) * 0.015;
          if (d < 0.001 || total > 6.0) break;
          total += d * 0.9;
        }

        // deep navy-black base
        vec3 col = vec3(0.015, 0.022, 0.040);

        // gyroid glow: subtle blue-cyan haze
        vec3 gyroidCol = vec3(0.10, 0.22, 0.42);
        col += glow * gyroidCol * (0.9 + uPulse * 0.5);

        // cursor soft halo
        vec2 m = uMouse - 0.5;
        m.x *= uRes.x / uRes.y;
        float md = length(uv - m);
        col += exp(-md * 3.8) * vec3(0.10, 0.25, 0.42) * (0.35 + uPulse * 0.3);

        // vignette
        float vig = smoothstep(1.20, 0.08, length(uv));
        col *= mix(0.32, 1.0, vig);

        // subtle grain
        float grain = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453 + uTime);
        col += (grain - 0.5) * 0.018;

        col *= smoothstep(0.0, 1.0, uIntro);
        gl_FragColor = vec4(col, 1.0);
      }
    `,
    depthTest: false, depthWrite: false,
  });
  bgScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), bgMat));

  // ---------- GPGPU setup ----------
  // Particles live in a TEX x TEX grid. Positions/velocities are updated by
  // shader passes each frame. Curl-noise provides organic flow.
  const SUPPORTS_GPGPU = hasFloatTex && typeof THREE.GPUComputationRenderer !== 'undefined';
  const TEX = SUPPORTS_GPGPU ? (window.innerWidth < 700 ? 96 : 128) : 0;
  const PARTICLES = TEX * TEX;
  console.log('[hero] GPGPU supported:', SUPPORTS_GPGPU, 'particles:', PARTICLES);

  let gpu, posVar, velVar;
  let targetTex; // logo/name target positions as DataTexture (rgba float)
  // fallback state
  let fallbackGeo, fallbackMat;

  // Build the logo target texture by rasterizing text to an offscreen canvas
  // and sampling lit pixels into a TEX*TEX position array.
  function buildLogoTargets() {
    if (!TEX) return null;
    const c = document.createElement('canvas');
    c.width = 1024; c.height = 256;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, c.width, c.height);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 170px "Inter", "Segoe UI", system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('JAMES LEVAC', c.width / 2, c.height / 2);
    const img = ctx.getImageData(0, 0, c.width, c.height).data;

    // collect lit pixel coordinates
    const lit = [];
    for (let y = 0; y < c.height; y += 2) {
      for (let x = 0; x < c.width; x += 2) {
        const i = (y * c.width + x) * 4;
        if (img[i] > 128) lit.push([x, y]);
      }
    }
    if (lit.length === 0) return null;

    // map into a float array of size TEX*TEX*4
    const data = new Float32Array(TEX * TEX * 4);
    const scaleX = 900 / c.width;
    const scaleY = 220 / c.height;
    for (let i = 0; i < TEX * TEX; i++) {
      const pick = lit[i % lit.length];
      const x = (pick[0] - c.width / 2) * scaleX + (Math.random() - 0.5) * 2;
      const y = -(pick[1] - c.height / 2) * scaleY + (Math.random() - 0.5) * 2;
      const z = (Math.random() - 0.5) * 30;
      data[i * 4]     = x;
      data[i * 4 + 1] = y;
      data[i * 4 + 2] = z;
      data[i * 4 + 3] = 1;
    }
    const tex = new THREE.DataTexture(data, TEX, TEX, THREE.RGBAFormat, THREE.FloatType);
    tex.needsUpdate = true;
    return tex;
  }

  function initGPGPU() {
    gpu = new THREE.GPUComputationRenderer(TEX, TEX, renderer);
    if (renderer.capabilities.isWebGL2 === false) gpu.setDataType(THREE.HalfFloatType);

    const posInit = gpu.createTexture();
    const velInit = gpu.createTexture();
    const pArr = posInit.image.data;
    const vArr = velInit.image.data;
    for (let i = 0; i < PARTICLES; i++) {
      const k = i * 4;
      // start scattered in a big volume
      pArr[k]     = (Math.random() - 0.5) * 2200;
      pArr[k + 1] = (Math.random() - 0.5) * 1400;
      pArr[k + 2] = (Math.random() - 0.5) * 1400;
      pArr[k + 3] = 1;
      vArr[k]     = 0;
      vArr[k + 1] = 0;
      vArr[k + 2] = 0;
      vArr[k + 3] = 1;
    }

    targetTex = buildLogoTargets();

    const velShader = /* glsl */ `
      uniform float uTime;
      uniform float uDt;
      uniform vec3  uMouseW;
      uniform float uMouseActive;
      uniform float uLogoLock; // 0 free flow, 1 fully locked to logo target
      uniform sampler2D uTargetTex;

      // 3D hash + noise
      vec3 hash3(vec3 p) {
        p = vec3(dot(p, vec3(127.1, 311.7, 74.7)),
                 dot(p, vec3(269.5, 183.3, 246.1)),
                 dot(p, vec3(113.5, 271.9, 124.6)));
        return -1.0 + 2.0 * fract(sin(p) * 43758.5453);
      }
      float noise(vec3 p) {
        vec3 i = floor(p);
        vec3 f = fract(p);
        vec3 u = f * f * (3.0 - 2.0 * f);
        return mix(
          mix(mix(dot(hash3(i + vec3(0,0,0)), f - vec3(0,0,0)),
                  dot(hash3(i + vec3(1,0,0)), f - vec3(1,0,0)), u.x),
              mix(dot(hash3(i + vec3(0,1,0)), f - vec3(0,1,0)),
                  dot(hash3(i + vec3(1,1,0)), f - vec3(1,1,0)), u.x), u.y),
          mix(mix(dot(hash3(i + vec3(0,0,1)), f - vec3(0,0,1)),
                  dot(hash3(i + vec3(1,0,1)), f - vec3(1,0,1)), u.x),
              mix(dot(hash3(i + vec3(0,1,1)), f - vec3(0,1,1)),
                  dot(hash3(i + vec3(1,1,1)), f - vec3(1,1,1)), u.x), u.y), u.z);
      }
      vec3 curlNoise(vec3 p) {
        const float e = 0.01;
        vec3 dx = vec3(e, 0.0, 0.0);
        vec3 dy = vec3(0.0, e, 0.0);
        vec3 dz = vec3(0.0, 0.0, e);
        vec3 p_x0 = vec3(noise(p - dx), noise(p - dy), noise(p - dz));
        vec3 p_x1 = vec3(noise(p + dx), noise(p + dy), noise(p + dz));
        vec3 d = (p_x1 - p_x0) / (2.0 * e);
        return vec3(d.y - d.z, d.z - d.x, d.x - d.y);
      }

      void main() {
        vec2 uv = gl_FragCoord.xy / resolution.xy;
        vec4 pos = texture2D(texturePosition, uv);
        vec4 vel = texture2D(textureVelocity, uv);

        // curl noise flow field
        vec3 curl = curlNoise(pos.xyz * 0.0020 + uTime * 0.04);
        vec3 force = curl * 45.0;

        // pull toward origin keeps particles bounded
        force -= pos.xyz * 0.00025;

        // cursor force: repel within radius, attract outside subtly
        vec3 toCursor = uMouseW - pos.xyz;
        float dc = length(toCursor) + 1e-4;
        float repel = exp(-dc * dc / (260.0 * 260.0));
        force -= normalize(toCursor) * repel * 280.0 * uMouseActive;

        // logo attractor (strong during intro lock)
        vec4 tgt = texture2D(uTargetTex, uv);
        vec3 toTgt = tgt.xyz - pos.xyz;
        force += toTgt * 0.35 * uLogoLock;
        vel.xyz *= mix(1.0, 0.72, uLogoLock); // extra damping while locking

        vel.xyz += force * uDt;
        vel.xyz *= 0.965; // base damping
        // clamp velocity
        float vm = length(vel.xyz);
        if (vm > 420.0) vel.xyz = vel.xyz / vm * 420.0;

        gl_FragColor = vel;
      }
    `;

    const posShader = /* glsl */ `
      uniform float uDt;
      void main() {
        vec2 uv = gl_FragCoord.xy / resolution.xy;
        vec4 pos = texture2D(texturePosition, uv);
        vec4 vel = texture2D(textureVelocity, uv);
        pos.xyz += vel.xyz * uDt;
        gl_FragColor = pos;
      }
    `;

    posVar = gpu.addVariable('texturePosition', posShader, posInit);
    velVar = gpu.addVariable('textureVelocity', velShader, velInit);
    gpu.setVariableDependencies(posVar, [posVar, velVar]);
    gpu.setVariableDependencies(velVar, [posVar, velVar]);

    velVar.material.uniforms.uTime        = { value: 0 };
    velVar.material.uniforms.uDt          = { value: 1 / 60 };
    velVar.material.uniforms.uMouseW      = { value: new THREE.Vector3(9999, 9999, 0) };
    velVar.material.uniforms.uMouseActive = { value: 0 };
    velVar.material.uniforms.uLogoLock    = { value: 0 };
    velVar.material.uniforms.uTargetTex   = { value: targetTex };

    posVar.material.uniforms.uDt = { value: 1 / 60 };

    const err = gpu.init();
    if (err !== null) console.warn('[hero] GPGPU init error:', err);
  }

  // ---------- Particle render material ----------
  let particles;
  function buildParticles() {
    const geo = new THREE.BufferGeometry();
    const refs = new Float32Array(PARTICLES * 2);
    const rand = new Float32Array(PARTICLES);
    for (let i = 0; i < PARTICLES; i++) {
      refs[i * 2]     = (i % TEX) / TEX;
      refs[i * 2 + 1] = Math.floor(i / TEX) / TEX;
      rand[i] = Math.random();
    }
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(PARTICLES * 3), 3));
    geo.setAttribute('aRef',     new THREE.BufferAttribute(refs, 2));
    geo.setAttribute('aRand',    new THREE.BufferAttribute(rand, 1));

    const mat = new THREE.ShaderMaterial({
      uniforms: {
        uPosTex:  { value: null },
        uVelTex:  { value: null },
        uPR:      { value: DPR },
        uTime:    { value: 0 },
        uOpacity: { value: 0 },
        uPulse:   { value: 0 },
      },
      vertexShader: /* glsl */ `
        uniform sampler2D uPosTex;
        uniform sampler2D uVelTex;
        uniform float uPR;
        uniform float uTime;
        uniform float uPulse;
        attribute vec2  aRef;
        attribute float aRand;
        varying vec3  vColor;
        varying float vSpeed;
        void main() {
          vec3 pos = texture2D(uPosTex, aRef).xyz;
          vec3 vel = texture2D(uVelTex, aRef).xyz;
          float speed = length(vel);
          vSpeed = speed;

          // color ramp by speed: deep blue -> cyan -> white
          vec3 cold = vec3(0.08, 0.22, 0.55);
          vec3 warm = vec3(0.55, 0.90, 1.10);
          vec3 hot  = vec3(1.10, 1.00, 0.90);
          float t1 = smoothstep(0.0, 120.0, speed);
          float t2 = smoothstep(120.0, 300.0, speed);
          vColor = mix(mix(cold, warm, t1), hot, t2);
          // per-particle hue jitter
          vColor *= 0.82 + 0.35 * aRand + uPulse * 0.25;

          vec4 mv = modelViewMatrix * vec4(pos, 1.0);
          float size = (1.2 + aRand * 1.8) * (1.0 + uPulse * 0.6);
          gl_PointSize = size * uPR * (280.0 / -mv.z);
          gl_Position = projectionMatrix * mv;
        }
      `,
      fragmentShader: /* glsl */ `
        varying vec3  vColor;
        varying float vSpeed;
        uniform float uOpacity;
        void main() {
          vec2 c = gl_PointCoord - 0.5;
          float d = length(c);
          float core  = smoothstep(0.5, 0.0, d);
          float halo  = exp(-d * 3.3) * 1.1;
          float outer = exp(-d * 1.4) * 0.38;
          vec3 col = vColor * (core * 1.1 + halo + outer);
          float a = clamp(core + halo * 0.85 + outer * 0.55, 0.0, 1.0);
          gl_FragColor = vec4(col, a * uOpacity);
        }
      `,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    particles = new THREE.Points(geo, mat);
    particles.frustumCulled = false;
    fxScene.add(particles);
  }

  // Fallback (no GPGPU): small CPU particle cloud so the site still looks alive
  function buildFallback() {
    const count = 600;
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = 200 + Math.random() * 300;
      positions[i * 3]     = Math.cos(a) * r;
      positions[i * 3 + 1] = (Math.random() - 0.5) * 400;
      positions[i * 3 + 2] = Math.sin(a) * r;
    }
    fallbackGeo = new THREE.BufferGeometry();
    fallbackGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    fallbackMat = new THREE.PointsMaterial({
      color: 0x6aa6ff, size: 3, transparent: true, opacity: 0.85,
      blending: THREE.AdditiveBlending, depthWrite: false,
    });
    fxScene.add(new THREE.Points(fallbackGeo, fallbackMat));
  }

  if (SUPPORTS_GPGPU) {
    try { initGPGPU(); buildParticles(); }
    catch (e) { console.warn('[hero] GPGPU failed, falling back', e); buildFallback(); }
  } else {
    buildFallback();
  }

  // ---------- Post-processing: bloom + film grain ----------
  let composer, bloomPass, filmPass;
  if (typeof THREE.EffectComposer !== 'undefined' && typeof THREE.UnrealBloomPass !== 'undefined') {
    composer = new THREE.EffectComposer(renderer);
    composer.setPixelRatio(DPR);
    composer.setSize(window.innerWidth, window.innerHeight);

    // We render bg + fx into the composer ourselves via a custom render pass
    const bgPass = new THREE.RenderPass(bgScene, bgCam);
    bgPass.clear = true;
    const fxPass = new THREE.RenderPass(fxScene, fxCam);
    fxPass.clear = false;

    bloomPass = new THREE.UnrealBloomPass(
      new THREE.Vector2(window.innerWidth, window.innerHeight),
      0.9,  // strength
      0.85, // radius
      0.18  // threshold
    );

    composer.addPass(bgPass);
    composer.addPass(fxPass);
    composer.addPass(bloomPass);

    if (typeof THREE.FilmPass !== 'undefined') {
      filmPass = new THREE.FilmPass(0.22, 0.35, 648, false);
      composer.addPass(filmPass);
    }
    console.log('[hero] composer ready');
  } else {
    console.warn('[hero] post-processing unavailable, rendering direct');
  }

  // ---------- Input ----------
  const mouse = {
    x: 0.5, y: 0.5, tx: 0.5, ty: 0.5, present: false,
  };
  function setTargetFromEvent(cx, cy) {
    const nx = cx / window.innerWidth;
    const ny = 1 - cy / window.innerHeight;
    if (!mouse.present) {
      mouse.x = nx; mouse.y = ny;
      mouse.present = true;
    }
    mouse.tx = nx; mouse.ty = ny;
  }
  window.addEventListener('mousemove', (e) => setTargetFromEvent(e.clientX, e.clientY));
  window.addEventListener('touchmove', (e) => {
    const t = e.touches[0]; setTargetFromEvent(t.clientX, t.clientY);
  }, { passive: true });
  function releaseCursor() { mouse.present = false; }
  document.addEventListener('mouseleave', releaseCursor);
  window.addEventListener('blur',          releaseCursor);
  document.addEventListener('touchend',    releaseCursor);

  window.addEventListener('resize', () => {
    const w = window.innerWidth, h = window.innerHeight;
    renderer.setSize(w, h);
    fxCam.aspect = w / h; fxCam.updateProjectionMatrix();
    bgUniforms.uRes.value.set(w, h);
    if (composer) composer.setSize(w, h);
    if (bloomPass) bloomPass.setSize(w, h);
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
        const p = self.progress; // 0..1
        fxCam.position.z = CAM_Z_HOME + p * 900;
        fxCam.position.y = -p * 220;
        renderer.toneMappingExposure = 1.0 - p * 0.35;
        if (bloomPass) bloomPass.strength = 0.9 - p * 0.4;
      },
    });
  }

  // ---------- Audio-reactive toggle ----------
  const audioBtn = document.getElementById('audio-toggle');
  let audioCtx = null, analyser = null, audioData = null, audioActive = false;
  let audioLevel = 0;

  async function enableAudio() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const src = audioCtx.createMediaStreamSource(stream);
      analyser = audioCtx.createAnalyser();
      analyser.fftSize = 512;
      analyser.smoothingTimeConstant = 0.82;
      src.connect(analyser);
      audioData = new Uint8Array(analyser.frequencyBinCount);
      audioActive = true;
      if (audioBtn) audioBtn.setAttribute('aria-pressed', 'true');
      console.log('[hero] audio-reactive enabled');
    } catch (e) {
      console.warn('[hero] mic access denied', e);
      audioActive = false;
      if (audioBtn) audioBtn.setAttribute('aria-pressed', 'false');
    }
  }
  function disableAudio() {
    audioActive = false;
    if (audioCtx) { try { audioCtx.close(); } catch (_) {} audioCtx = null; }
    analyser = null; audioData = null; audioLevel = 0;
    if (audioBtn) audioBtn.setAttribute('aria-pressed', 'false');
  }
  if (audioBtn) {
    audioBtn.addEventListener('click', () => {
      if (audioActive) disableAudio(); else enableAudio();
    });
  }

  // ---------- Animate ----------
  const t0 = performance.now();
  let last = t0;

  function animate() {
    requestAnimationFrame(animate);
    const now = performance.now();
    const dt = Math.min(1 / 30, (now - last) / 1000);
    last = now;
    const elapsed = (now - t0) * 0.001;

    // smooth mouse
    mouse.x += (mouse.tx - mouse.x) * 0.10;
    mouse.y += (mouse.ty - mouse.y) * 0.10;

    // --- audio sample ---
    if (audioActive && analyser && audioData) {
      analyser.getByteFrequencyData(audioData);
      // low-mid energy
      let sum = 0;
      const n = Math.min(48, audioData.length);
      for (let i = 2; i < n; i++) sum += audioData[i];
      const target = sum / (n * 255);
      audioLevel += (target - audioLevel) * 0.18;
    } else {
      audioLevel += (0 - audioLevel) * 0.04;
    }
    const pulse = Math.min(1, audioLevel * 2.2);
    bgUniforms.uPulse.value = pulse;
    if (particles) particles.material.uniforms.uPulse.value = pulse;

    // --- bg uniforms ---
    bgUniforms.uTime.value = elapsed;
    bgUniforms.uMouse.value.set(mouse.x, mouse.y);

    // --- intro: camera dolly + opacity + logo lock schedule ---
    // 0.00-0.35s: fade in
    // 0.35-1.80s: particles swarm to form JAMES LEVAC text
    // 1.80-3.00s: hold the name
    // 3.00-4.00s: release into flow field, camera settles
    const INTRO = 4.0;
    const tNorm = Math.min(elapsed / INTRO, 1);
    const easeInOutCubic = tNorm < 0.5 ? 4 * tNorm * tNorm * tNorm : 1 - Math.pow(-2 * tNorm + 2, 3) / 2;
    fxCam.position.z = CAM_Z_START + (CAM_Z_HOME - CAM_Z_START) * easeInOutCubic;

    const fadeIn = Math.min(elapsed / 0.5, 1);
    bgUniforms.uIntro.value = fadeIn;
    if (particles) particles.material.uniforms.uOpacity.value = fadeIn;
    if (fallbackMat) fallbackMat.opacity = fadeIn * 0.85;

    // logo lock ramp: rises 0.35->1.80, holds until 3.00, fades 3.00->4.00
    let lock;
    if (elapsed < 0.35)         lock = 0;
    else if (elapsed < 1.80)    lock = (elapsed - 0.35) / 1.45;
    else if (elapsed < 3.00)    lock = 1;
    else if (elapsed < 4.00)    lock = 1 - (elapsed - 3.00) / 1.00;
    else                        lock = 0;
    lock = Math.max(0, Math.min(1, lock));

    // --- GPGPU step ---
    if (gpu) {
      velVar.material.uniforms.uTime.value = elapsed;
      velVar.material.uniforms.uDt.value   = dt;
      posVar.material.uniforms.uDt.value   = dt;
      velVar.material.uniforms.uLogoLock.value = lock;

      // project cursor to particle plane in world units
      velVar.material.uniforms.uMouseW.value.set(
        (mouse.x - 0.5) * 900,
        (mouse.y - 0.5) * 560,
        0
      );
      velVar.material.uniforms.uMouseActive.value = mouse.present ? 1.0 : 0.0;

      gpu.compute();

      if (particles) {
        particles.material.uniforms.uPosTex.value = gpu.getCurrentRenderTarget(posVar).texture;
        particles.material.uniforms.uVelTex.value = gpu.getCurrentRenderTarget(velVar).texture;
        particles.material.uniforms.uTime.value   = elapsed;
      }
    } else if (fallbackGeo) {
      // simple rotation for fallback
      fallbackGeo.attributes.position.needsUpdate = false;
    }

    // slow overall rotation of the particle system for depth
    if (particles) {
      particles.rotation.y = Math.sin(elapsed * 0.05) * 0.18;
      particles.rotation.x = Math.cos(elapsed * 0.04) * 0.08;
    }
    fxCam.lookAt(0, 0, 0);

    // --- render ---
    if (composer) {
      // dynamic bloom pulse
      if (bloomPass) bloomPass.strength = 0.75 + pulse * 0.9;
      composer.render();
    } else {
      renderer.clear();
      renderer.render(bgScene, bgCam);
      renderer.render(fxScene, fxCam);
    }
  }

  animate();
})();
