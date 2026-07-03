/* ============================================================
   БКС · НАВИГАТОР — Three.js мир
   Один источник правды: объект `state` твинится GSAP-ом,
   рендер только читает его в tick().
   ============================================================ */

import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';

export const state = {
  morph: 0,       // хаос -> структура (частицы)
  trajReveal: 0,  // прорисовка траекторий-вариантов
  trajFade: 1,    // приглушение траекторий, когда появляется маршрут
  routeDraw: 0,   // прорисовка светового маршрута БКС
  markers: 0,     // маяки таймлайна (0..1 -> 7 штук)
  rings: 0,       // орбиты системы экспертизы
  collapse: 0,    // финальное схлопывание в точку
};

const ROUTE_END = new THREE.Vector3(0, 0.4, -58);

/* ---------- вспомогательное ---------- */

function glowTexture(size = 128) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.35, 'rgba(255,255,255,0.45)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

const rand = (a, b) => a + Math.random() * (b - a);

/* ---------- шейдеры ---------- */

const PARTICLES_VERT = /* glsl */ `
  attribute vec3 aChaos;
  attribute vec3 aFlow;
  attribute float aSeed;
  uniform float uTime;
  uniform float uMorph;
  uniform float uCollapse;
  uniform float uSize;
  uniform float uPixelRatio;
  uniform float uDrift;
  uniform vec3 uTarget;
  varying float vMix;
  varying float vNear;
  void main() {
    // волновой морф: каждая частица перестраивается со своим запаздыванием
    float pm = smoothstep(0.0, 1.0, clamp(uMorph * 1.45 - aSeed * 0.45, 0.0, 1.0));
    vec3 pos = mix(aChaos, aFlow, pm);

    float drift = uDrift * (1.0 - pm * 0.75) * (0.5 + aSeed * 0.6);
    pos.x += sin(uTime * 0.35 + aSeed * 43.0) * drift;
    pos.y += cos(uTime * 0.28 + aSeed * 71.0) * drift * 0.8;
    pos.z += sin(uTime * 0.22 + aSeed * 29.0) * drift * 0.8;

    // финальное схлопывание в точку входа
    float c = smoothstep(0.0, 1.0, clamp(uCollapse * 1.5 - aSeed * 0.5, 0.0, 1.0));
    pos = mix(pos, uTarget + (pos - uTarget) * 0.02, c);

    vec4 mv = modelViewMatrix * vec4(pos, 1.0);
    float dist = -mv.z;
    float ps = uSize * uPixelRatio * (0.6 + aSeed * 0.8) * (1.0 + pm * 0.4)
             * (30.0 / max(2.0, dist));
    gl_PointSize = min(ps, 7.0 * uPixelRatio); // без гигантских блобов у камеры
    vMix = pm;
    vNear = smoothstep(2.5, 7.0, dist);        // частицы у объектива растворяются
    gl_Position = projectionMatrix * mv;
  }
`;

const PARTICLES_FRAG = /* glsl */ `
  uniform float uCollapse;
  varying float vMix;
  varying float vNear;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    float a = smoothstep(0.5, 0.05, d);
    if (a < 0.01) discard;
    vec3 dim   = vec3(0.30, 0.38, 0.58);
    vec3 blue  = vec3(0.36, 0.53, 1.00);
    vec3 light = vec3(0.94, 0.97, 1.00);
    vec3 col = mix(dim, blue, vMix);
    col = mix(col, light, uCollapse * 0.85);
    float alpha = a * (0.10 + vMix * 0.16) * vNear * (1.0 - uCollapse * 0.45);
    gl_FragColor = vec4(col, alpha);
  }
`;

const ROUTE_VERT = /* glsl */ `
  varying vec2 vUv;
  varying float vNear;
  void main() {
    vUv = uv;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vNear = smoothstep(2.0, 7.5, -mv.z); // сегменты у объектива растворяются
    gl_Position = projectionMatrix * mv;
  }
`;

const ROUTE_FRAG = /* glsl */ `
  uniform float uDraw;
  uniform float uTime;
  uniform float uAlpha;
  varying vec2 vUv;
  varying float vNear;
  void main() {
    // прорисовка по длине тубуса (uv.x бежит вдоль маршрута)
    float edge = 1.0 - smoothstep(uDraw - 0.015, uDraw, vUv.x);
    if (edge <= 0.001 || vUv.x > uDraw) discard;
    float head = smoothstep(uDraw - 0.08, uDraw, vUv.x);   // светящаяся голова
    float pulse = 0.5 + 0.5 * sin(vUv.x * 80.0 - uTime * 2.4); // бегущий импульс
    vec3 light = vec3(0.93, 0.96, 1.0);
    vec3 col = light * (0.8 + head * 1.9 + pulse * 0.18);
    gl_FragColor = vec4(col, uAlpha * edge * vNear);
  }
`;

/* ============================================================ */

export class Experience {
  constructor(canvas) {
    this.canvas = canvas;
    this.isMobile = window.matchMedia('(max-width: 768px), (pointer: coarse)').matches;
    this.reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: false,
      powerPreference: 'high-performance',
    });
    this.renderer.setClearColor(0x030814, 1);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, this.isMobile ? 1.5 : 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);

    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.FogExp2(0x030814, 0.016);

    this.camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 220);
    this.rig = new THREE.Group();           // GSAP двигает rig, камера живёт внутри
    this.rig.position.set(0, 0.6, 15.5);
    this.rig.add(this.camera);
    this.scene.add(this.rig);
    this.camTarget = new THREE.Vector3(0, 0, 0);

    this.pointer = new THREE.Vector2(0, 0); // параллакс-покачивание
    this.pointerLerp = new THREE.Vector2(0, 0);

    this.glow = glowTexture();

    this._buildTrajectories();
    this._buildRoute();
    this._buildParticles();
    this._buildMarkers();
    this._buildRings();
    this._buildPost();
    this._bindEvents();
  }

  /* ---------- траектории-варианты ---------- */

  _buildTrajectories() {
    this.trajGroup = new THREE.Group();
    this.trajLines = [];
    this.flowPoints = []; // сюда сложим точки для aFlow частиц

    const COUNT = 56;
    for (let i = 0; i < COUNT; i++) {
      const dead = i > 6 && i % 3 === 0; // треть — «тупики»
      const start = new THREE.Vector3(rand(-2.4, 2.4), rand(-1.6, 1.6), rand(1, 3));
      const zEnd = dead ? -rand(22, 35) : -rand(52, 62);
      const steps = 6;
      const pts = [start];
      for (let s = 1; s <= steps; s++) {
        const t = s / steps;
        pts.push(new THREE.Vector3(
          start.x + rand(-4.5, 4.5) * t,
          start.y + rand(-3, 3) * t,
          start.z + (zEnd - start.z) * t + rand(-1.5, 1.5)
        ));
      }
      const curve = new THREE.CatmullRomCurve3(pts);
      const sampled = curve.getPoints(140);
      const geo = new THREE.BufferGeometry().setFromPoints(sampled);
      geo.setDrawRange(0, 0);

      const mat = new THREE.LineBasicMaterial({
        color: dead ? 0x55627f : 0x4d7dff,
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      const line = new THREE.Line(geo, mat);
      line.userData = {
        offset: Math.random() * 0.4,
        dead,
        seed: Math.random() * 10,
        baseOpacity: dead ? 0.26 : rand(0.22, 0.46),
        total: sampled.length,
      };
      this.trajGroup.add(line);
      this.trajLines.push(line);
      if (!dead) this.flowPoints.push(...sampled);
    }
    this.scene.add(this.trajGroup);
  }

  /* ---------- маршрут БКС — луч белого света ---------- */

  _buildRoute() {
    this.routeCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0, 2),
      new THREE.Vector3(1.5, 0.8, -8),
      new THREE.Vector3(-1.2, 1.6, -18),
      new THREE.Vector3(1.8, -0.6, -28),
      new THREE.Vector3(-0.8, 0.5, -40),
      new THREE.Vector3(0.6, 1.2, -50),
      ROUTE_END.clone(),
    ]);

    const makeMat = (alpha) => new THREE.ShaderMaterial({
      uniforms: {
        uDraw: { value: 0 },
        uTime: { value: 0 },
        uAlpha: { value: alpha },
      },
      vertexShader: ROUTE_VERT,
      fragmentShader: ROUTE_FRAG,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    this.routeCoreMat = makeMat(0.95);
    this.routeHaloMat = makeMat(0.13);

    const core = new THREE.Mesh(new THREE.TubeGeometry(this.routeCurve, 300, 0.06, 8, false), this.routeCoreMat);
    const halo = new THREE.Mesh(new THREE.TubeGeometry(this.routeCurve, 300, 0.22, 8, false), this.routeHaloMat);
    this.scene.add(core, halo);
  }

  /* ---------- частицы ---------- */

  _buildParticles() {
    const COUNT = this.isMobile ? 7000 : 14000;
    const chaos = new Float32Array(COUNT * 3);
    const flow = new Float32Array(COUNT * 3);
    const seed = new Float32Array(COUNT);

    for (let i = 0; i < COUNT; i++) {
      // хаос: рыхлый эллипсоид вокруг старта
      chaos[i * 3 + 0] = rand(-1, 1) * 9 * Math.cbrt(Math.random());
      chaos[i * 3 + 1] = rand(-1, 1) * 6 * Math.cbrt(Math.random());
      chaos[i * 3 + 2] = -2 + rand(-1, 1) * 9 * Math.cbrt(Math.random());

      // структура: точка на одной из живых траекторий + джиттер
      const p = this.flowPoints[(Math.random() * this.flowPoints.length) | 0];
      flow[i * 3 + 0] = p.x + rand(-0.5, 0.5);
      flow[i * 3 + 1] = p.y + rand(-0.5, 0.5);
      flow[i * 3 + 2] = p.z + rand(-0.5, 0.5);

      seed[i] = Math.random();
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(chaos.slice(), 3)); // для frustum
    geo.setAttribute('aChaos', new THREE.BufferAttribute(chaos, 3));
    geo.setAttribute('aFlow', new THREE.BufferAttribute(flow, 3));
    geo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));

    this.particlesMat = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uMorph: { value: 0 },
        uCollapse: { value: 0 },
        uSize: { value: this.isMobile ? 2.4 : 2.9 },
        uPixelRatio: { value: this.renderer.getPixelRatio() },
        uDrift: { value: this.reducedMotion ? 0.04 : 0.32 },
        uTarget: { value: ROUTE_END.clone() },
      },
      vertexShader: PARTICLES_VERT,
      fragmentShader: PARTICLES_FRAG,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    const points = new THREE.Points(geo, this.particlesMat);
    points.frustumCulled = false;
    this.scene.add(points);
  }

  /* ---------- маяки таймлайна ---------- */

  _buildMarkers() {
    this.markers = [];
    const T = [0.06, 0.2, 0.34, 0.48, 0.62, 0.78, 0.95];
    for (let i = 0; i < T.length; i++) {
      const mat = new THREE.SpriteMaterial({
        map: this.glow,
        color: 0xdce8ff,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      });
      const s = new THREE.Sprite(mat);
      s.position.copy(this.routeCurve.getPointAt(T[i]));
      s.scale.setScalar(0.001);
      s.userData.index = i;
      this.scene.add(s);
      this.markers.push(s);
    }

    // финальная точка входа
    const endMat = new THREE.SpriteMaterial({
      map: this.glow,
      color: 0xf4f8ff,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    this.endGlow = new THREE.Sprite(endMat);
    this.endGlow.position.copy(ROUTE_END);
    this.scene.add(this.endGlow);
  }

  /* ---------- орбиты системы ---------- */

  _buildRings() {
    this.ringsGroup = new THREE.Group();
    this.ringsGroup.position.copy(ROUTE_END);
    const radii = [1.5, 2.1, 2.8, 3.6];
    radii.forEach((r, i) => {
      const pts = [];
      for (let a = 0; a <= 128; a++) {
        const t = (a / 128) * Math.PI * 2;
        pts.push(new THREE.Vector3(Math.cos(t) * r, Math.sin(t) * r, 0));
      }
      const geo = new THREE.BufferGeometry().setFromPoints(pts);
      const mat = new THREE.LineBasicMaterial({
        color: i === 3 ? 0xf4f8ff : 0x4d7dff,
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      const ring = new THREE.Line(geo, mat);
      ring.rotation.set(rand(0, Math.PI), rand(0, Math.PI), rand(0, Math.PI));
      ring.userData = { speed: rand(0.05, 0.16) * (i % 2 ? 1 : -1), base: i === 3 ? 0.5 : 0.35 };
      this.ringsGroup.add(ring);
    });
    this.scene.add(this.ringsGroup);
  }

  /* ---------- постобработка ---------- */

  _buildPost() {
    this.usePost = !this.isMobile;
    if (!this.usePost) return;
    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.bloom = new UnrealBloomPass(
      new THREE.Vector2(window.innerWidth, window.innerHeight),
      0.35,  // strength
      0.5,   // radius
      0.85   // threshold
    );
    this.composer.addPass(this.bloom);
  }

  /* ---------- события ---------- */

  _bindEvents() {
    window.addEventListener('resize', () => {
      const w = window.innerWidth, h = window.innerHeight;
      this.camera.aspect = w / h;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(w, h);
      this.composer?.setSize(w, h);
    });

    if (!this.reducedMotion) {
      window.addEventListener('pointermove', (e) => {
        this.pointer.set(
          (e.clientX / window.innerWidth) * 2 - 1,
          (e.clientY / window.innerHeight) * 2 - 1
        );
      });
    }
  }

  /* ---------- кадр ---------- */

  tick(time) {
    const t = time;

    // частицы
    const pu = this.particlesMat.uniforms;
    pu.uTime.value = t;
    pu.uMorph.value = state.morph;
    pu.uCollapse.value = state.collapse;

    // траектории: прогрессивная отрисовка + мерцание тупиков
    const fade = state.trajFade * (1 - state.collapse);
    for (const line of this.trajLines) {
      const { offset, dead, seed, baseOpacity, total } = line.userData;
      const reveal = THREE.MathUtils.clamp((state.trajReveal - offset) / (1 - offset || 1), 0, 1);
      line.geometry.setDrawRange(0, Math.floor(reveal * total));
      let o = baseOpacity * fade * reveal;
      if (dead) o *= 0.65 + 0.35 * Math.sin(t * 3 + seed); // тупики тревожно мерцают
      line.material.opacity = Math.max(0, o);
    }

    // маршрут
    const routeFade = 1 - state.collapse * 0.85;
    this.routeCoreMat.uniforms.uDraw.value = state.routeDraw;
    this.routeHaloMat.uniforms.uDraw.value = state.routeDraw;
    this.routeCoreMat.uniforms.uTime.value = t;
    this.routeHaloMat.uniforms.uTime.value = t;
    this.routeCoreMat.uniforms.uAlpha.value = 0.95 * routeFade;
    this.routeHaloMat.uniforms.uAlpha.value = 0.13 * routeFade;

    // маяки
    for (const m of this.markers) {
      const i = m.userData.index;
      const on = THREE.MathUtils.smoothstep(state.markers * 7 - i, 0, 1) * (1 - state.collapse);
      m.material.opacity = on * 0.95;
      m.scale.setScalar(0.001 + on * (0.6 + 0.08 * Math.sin(t * 2.2 + i * 1.7)));
    }

    // точка входа: растёт на схлопывании (сдержанно — не засвечивать текст CTA)
    const eg = Math.max(state.rings * 0.35, state.collapse * 0.45);
    this.endGlow.material.opacity = eg;
    this.endGlow.scale.setScalar(0.3 + state.rings * 0.7 + state.collapse * 0.9 + 0.06 * Math.sin(t * 1.6));

    // орбиты
    for (const ring of this.ringsGroup.children) {
      ring.rotation.z += ring.userData.speed * 0.016;
      ring.rotation.x += ring.userData.speed * 0.007;
      ring.material.opacity = state.rings * ring.userData.base * (1 - state.collapse * 0.9);
    }
    this.ringsGroup.rotation.y = t * 0.05;

    // камера: rig двигает GSAP, внутри — мягкий параллакс
    this.pointerLerp.lerp(this.pointer, 0.04);
    this.camera.position.x = this.pointerLerp.x * 0.5;
    this.camera.position.y = -this.pointerLerp.y * 0.3;
    this.camera.lookAt(this.camTarget);

    if (this.usePost) this.composer.render();
    else this.renderer.render(this.scene, this.camera);
  }
}
