/* ============================================================
   БКС · НАВИГАТОР — режиссура
   Lenis (инерционный скролл) + GSAP ScrollTrigger (скраб)
   двигают камеру и state; Three.js только рендерит.
   ============================================================ */

import { Experience, state } from './experience.js';

gsap.registerPlugin(ScrollTrigger);

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ---------- WebGL-мир (с фолбэком) ---------- */

let experience = null;
try {
  experience = new Experience(document.getElementById('scene'));
} catch (e) {
  console.warn('WebGL недоступен, включаю статичный фолбэк', e);
  document.body.classList.add('no-webgl');
}

/* ---------- плавный скролл ---------- */

let lenis = null;
if (!reducedMotion) {
  lenis = new Lenis({ lerp: 0.09, smoothWheel: true });
  lenis.on('scroll', ScrollTrigger.update);
}

gsap.ticker.add((time) => {
  lenis?.raf(time * 1000);
  experience?.tick(time);
});
gsap.ticker.lagSmoothing(0);

/* ---------- прелоадер ---------- */

const hideLoader = () => document.getElementById('loader').classList.add('is-done');
if (document.readyState === 'complete') hideLoader();
else window.addEventListener('load', hideLoader);
setTimeout(hideLoader, 3000); // страховка

/* ---------- якорные переходы ---------- */

document.querySelectorAll('[data-scroll-to]').forEach((el) => {
  el.addEventListener('click', (e) => {
    e.preventDefault();
    const target = document.querySelector(el.dataset.scrollTo);
    if (!target) return;
    if (lenis) lenis.scrollTo(target, { duration: 2 });
    else target.scrollIntoView({ behavior: 'smooth' });
  });
});

/* ---------- появление текстов ---------- */

gsap.utils.toArray('.reveal').forEach((el) => {
  ScrollTrigger.create({
    trigger: el,
    start: 'top 82%',
    end: 'bottom 12%',
    toggleClass: { targets: el, className: 'is-in' },
  });
});

/* ---------- шапка после hero ---------- */

ScrollTrigger.create({
  trigger: '.scene--shadow',
  start: 'top 65%',
  onEnter: () => document.querySelector('.site-header').classList.add('is-visible'),
  onLeaveBack: () => document.querySelector('.site-header').classList.remove('is-visible'),
});

/* ---------- прогресс маршрута ---------- */

const progressFill = document.querySelector('.route-progress span');
const progressDot = document.querySelector('.route-progress i');
ScrollTrigger.create({
  trigger: '#journey',
  start: 'top top',
  end: 'bottom bottom',
  onUpdate: (self) => {
    progressFill.style.transform = `scaleY(${self.progress})`;
    progressDot.style.top = `${self.progress * 100}%`;
  },
});

/* ============================================================
   МАСТЕР-ТАЙМЛАЙН: один непрерывный полёт камеры.
   Длительности пропорциональны высотам секций (в vh):
   hero 130 / shadow 150 / space 200 / navigator 180 /
   timeline 350 / system 180 / simple 140 / cta 110  = 1440
   ============================================================ */

if (experience) {
  const rig = experience.rig.position;
  const tgt = experience.camTarget;

  const tl = gsap.timeline({
    defaults: { ease: 'none' },
    scrollTrigger: {
      trigger: '#journey',
      start: 'top top',
      end: 'bottom bottom',
      scrub: 1.2,
    },
  });

  // 1. ШУМ — лёгкое приближение
  tl.to(rig, { z: 13.6, duration: 130 }, 0)
    .to(state, { morph: 0.1, duration: 130 }, 0);

  // 2. ТЕНЬ — входим внутрь облака, хаос начинает строиться
  tl.to(rig, { x: 0, y: 0.5, z: 8, duration: 150 }, 130)
    .to(tgt, { z: -8, duration: 150 }, 130)
    .to(state, { morph: 0.5, duration: 150 }, 130);

  // 3. ПРОСТРАНСТВО ВАРИАНТОВ — полёт сквозь траектории
  tl.to(rig, { x: -2.1, y: 1.1, z: -16, duration: 200 }, 280)
    .to(tgt, { x: 1.2, y: 0.5, z: -30, duration: 200 }, 280)
    .to(state, { trajReveal: 1, morph: 0.85, duration: 200 }, 280);

  // 4. НАВИГАТОР — световой маршрут, остальное гаснет
  tl.to(rig, { x: 2.6, y: 1.8, z: -24, duration: 180 }, 480)
    .to(tgt, { x: -0.5, y: 0.6, z: -40, duration: 180 }, 480)
    .to(state, { routeDraw: 1, duration: 180 }, 480)
    .to(state, { trajFade: 0.22, duration: 140 }, 510);

  // 5. ТАЙМЛАЙН — отлёт вбок, маршрут целиком, маяки
  tl.to(rig, { x: 15.5, y: 5.5, z: -30, duration: 160 }, 660)
    .to(tgt, { x: 0, y: 0.5, z: -30, duration: 160 }, 660)
    .to(state, { markers: 1, duration: 290 }, 700);

  // 6. СИСТЕМА — подлетаем к концу маршрута, орбиты
  tl.to(rig, { x: 4, y: 2.4, z: -46, duration: 180 }, 1010)
    .to(tgt, { x: 0, y: 0.4, z: -57.5, duration: 180 }, 1010)
    .to(state, { rings: 1, duration: 160 }, 1030)
    .to(state, { trajFade: 0.06, duration: 180 }, 1010);

  // 7. ПРОСТОТА — начинается схлопывание
  tl.to(rig, { x: 0, y: 1.3, z: -48.5, duration: 140 }, 1190)
    .to(state, { collapse: 0.55, duration: 140 }, 1190);

  // 8. CTA — всё пространство стало одной точкой за кнопкой
  tl.to(rig, { x: 0, y: 0.8, z: -50.2, duration: 110 }, 1330)
    .to(tgt, { x: 0, y: 0.4, z: -58, duration: 110 }, 1330)
    .to(state, { collapse: 1, duration: 110 }, 1330);
}

/* ---------- карточки таймлайна (pin + кроссфейд) ---------- */

const cards = gsap.utils.toArray('.tcard');
const dots = gsap.utils.toArray('.timeline-dots i');

const cardsTl = gsap.timeline({
  defaults: { ease: 'none' },
  scrollTrigger: {
    trigger: '.scene--timeline',
    start: 'top top',
    end: 'bottom bottom',
    scrub: 0.6,
    onUpdate: (self) => {
      const active = Math.min(cards.length - 1, Math.floor(self.progress * cards.length));
      dots.forEach((d, i) => d.classList.toggle('is-active', i === active));
    },
  },
});

cards.forEach((card, i) => {
  // быстрый вход/выход, долгое «плато» — карточка почти всегда непрозрачна
  cardsTl.fromTo(card,
    { autoAlpha: 0, y: 28 },
    { autoAlpha: 1, y: 0, duration: 0.16, immediateRender: false },
    i
  );
  if (i < cards.length - 1) {
    cardsTl.to(card, { autoAlpha: 0, y: -22, duration: 0.16 }, i + 0.84);
  }
});

/* ---------- CTA: мягкая пульсация кнопки ---------- */

if (!reducedMotion) {
  gsap.to('#cta-main', {
    boxShadow: '0 0 72px rgba(206, 224, 255, 0.55)',
    repeat: -1,
    yoyo: true,
    duration: 1.8,
    ease: 'sine.inOut',
    scrollTrigger: { trigger: '.scene--cta', start: 'top 70%', toggleActions: 'play pause resume pause' },
  });
}
