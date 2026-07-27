# BCS Landing — рецепты компонентов

Готовые паттерны из лендинга-фаворита. Бери разметку, меняй контент. Значения даны как в оригинале (инлайн); при желании подставляй переменные из `tokens.css`. Классы/переменные — иллюстративны, адаптируй под свой стек.

---

## Eyebrow секции (с нумерацией)
Открывает каждую секцию. Номер + название через `·`.

```html
<span style="font:600 12px 'Golos Text',sans-serif;letter-spacing:.16em;text-transform:uppercase;color:#5A6B83">01 · Призы</span>
<h2 style="margin:0;font:400 clamp(36px,4.2vw,52px)/1.1 'Prata',Georgia,serif;letter-spacing:-.01em;color:#001A3D">Заголовок секции</h2>
```

## Кнопка-пилюля (primary + outline)
Действия — синяя заливка. Второстепенное — outline.

```html
<!-- primary -->
<button style="display:inline-flex;align-items:center;gap:12px;background:#006DFF;color:#FFFFFF;border:none;border-radius:999px;padding:17px 32px;font:500 16px 'Golos Text',sans-serif;cursor:pointer;transition:background .2s ease" onmouseover="this.style.background='#0354D7'" onmouseout="this.style.background='#006DFF'">Участвовать <span aria-hidden="true">→</span></button>

<!-- outline на светлом -->
<a style="display:inline-flex;border:1px solid rgba(0,26,61,.25);color:#001A3D;border-radius:999px;padding:11px 22px;font:500 14px 'Golos Text',sans-serif;text-decoration:none">App Store</a>

<!-- outline на тёмном -->
<a style="display:inline-flex;border:1px solid rgba(247,250,255,.32);color:#F7FAFF;border-radius:999px;padding:11px 22px;font:500 14px 'Golos Text',sans-serif;text-decoration:none">Google Play</a>
```

## Живой статус-чип (с пульсирующей точкой)

```html
<span style="display:inline-flex;align-items:center;gap:7px;background:#D6F5E5;border-radius:999px;padding:6px 13px;font:500 12px 'Golos Text',sans-serif;color:#0F8A4C">
  <span style="width:6px;height:6px;border-radius:50%;background:#00DC6E;animation:wfPulse 2.2s ease infinite"></span>Акция активна
</span>
```

## Пастельная плитка категории
Мятная / персиковая / лавандовая. Цветной uppercase-лейбл + призрачное serif-число в углу.

```html
<div style="position:relative;overflow:hidden;background:#D6F5E5;border-radius:26px;padding:28px;min-height:150px;display:flex;flex-direction:column;justify-content:space-between;gap:20px;transition:transform .25s ease" onmouseover="this.style.transform='translateY(-5px)'" onmouseout="this.style.transform='none'">
  <span aria-hidden="true" style="position:absolute;right:-14px;bottom:-34px;font:400 120px/1 'Prata',Georgia,serif;color:rgba(0,26,61,.06);pointer-events:none">×3</span>
  <span style="font:600 12px 'Golos Text',sans-serif;letter-spacing:.15em;text-transform:uppercase;color:#0F8A4C">3 приза по</span>
  <div>
    <div style="font:400 clamp(32px,2.4vw,42px)/1.05 'Prata',Georgia,serif;color:#001A3D">500 000 ₽</div>
    <div style="margin-top:10px;font:400 14px 'Golos Text',sans-serif;color:rgba(0,26,61,.55)">Подпись</div>
  </div>
</div>
```
Варианты фон/лейбл: мята `#D6F5E5`/`#0F8A4C` · персик `#FAE5D1`/`#CC6600` · лаванда `#EAD4F7`/`#5B1782`.

## Тёмный премиум-баннер (якорь страницы)
Фон `#001A3D`, золотой eyebrow, гигантское призрачное золотое число, круг с `×2`.

```html
<div style="position:relative;overflow:hidden;background:#001A3D;border-radius:28px;padding:52px 56px;display:flex;align-items:center;justify-content:space-between;gap:48px;flex-wrap:wrap">
  <span aria-hidden="true" style="position:absolute;right:190px;top:-70px;font:400 320px/1 'Prata',Georgia,serif;color:rgba(224,186,130,.07);pointer-events:none">×2</span>
  <div style="max-width:640px;position:relative">
    <span style="font:600 12px 'Golos Text',sans-serif;letter-spacing:.16em;text-transform:uppercase;color:#E0BA82">Гранд-финал · 14 — 20 сентября</span>
    <div style="margin-top:18px;font:400 clamp(30px,3vw,42px)/1.15 'Prata',Georgia,serif;color:#F7FAFF">Заголовок баннера</div>
    <p style="margin:16px 0 0;font:400 15px/1.6 'Golos Text',sans-serif;color:rgba(247,250,255,.65)">Описание.</p>
  </div>
  <div style="width:168px;height:168px;border-radius:50%;border:1px solid rgba(224,186,130,.55);display:flex;align-items:center;justify-content:center;flex:none">
    <span style="font:400 58px 'Prata',Georgia,serif;color:#E0BA82">×2</span>
  </div>
</div>
```

## Hero: dotted-фон + золотое подчёркивание H1

```html
<section style="overflow:hidden;background-image:radial-gradient(rgba(0,26,61,.055) 1px,transparent 1px);background-size:26px 26px">
  <div style="margin:0 auto;max-width:1240px;padding:84px 48px 0">
    <h1 style="margin:30px 0 0;font:400 clamp(56px,6.6vw,90px)/1.03 'Prata',Georgia,serif;letter-spacing:-.015em;color:#001A3D">Заголовок</h1>
    <span aria-hidden="true" style="display:block;width:88px;height:3px;background:#E0BA82;margin-top:28px"></span>
    <p style="margin:24px 0 0;max-width:500px;font:400 19px/1.6 'Golos Text',sans-serif;color:#33465F">Подзаголовок.</p>
  </div>
</section>
```

## Полоса метрик (числа-герои на Prata)
Разделены сильной верхней линией. Одно число можно подсветить золотом.

```html
<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:40px">
  <div style="border-top:1px solid rgba(0,26,61,.4);padding-top:20px">
    <div style="font:400 38px 'Prata',Georgia,serif;color:#001A3D">10</div>
    <div style="margin-top:8px;font:400 14px/1.5 'Golos Text',sans-serif;color:#5A6B83">описание метрики</div>
  </div>
  <!-- акцентная: color:#E0BA82 на числе -->
</div>
```

## Строка таймлайна (со статус-точкой)
Точки: завершено `#001A3D` · активно синяя пульсирующая в кольце `#CCE2FF` · ожидание — контур.

```html
<div style="display:grid;grid-template-columns:36px 56px 1.02fr 1fr 160px;align-items:center;gap:20px;padding:26px 14px 26px 0;border-bottom:1px solid rgba(0,26,61,.13)">
  <div style="position:relative;align-self:stretch">
    <span style="position:absolute;left:17px;top:0;bottom:0;width:1px;background:rgba(0,26,61,.15)"></span>
    <!-- active --> <span style="position:absolute;left:10px;top:50%;margin-top:-7.5px;width:15px;height:15px;border-radius:50%;background:#006DFF;border:3px solid #CCE2FF;animation:wfPulse 2.2s ease infinite"></span>
  </div>
  <span style="font:400 15px 'Prata',Georgia,serif;color:rgba(0,26,61,.4)">03</span>
  <span style="font:400 22px 'Prata',Georgia,serif;color:#001A3D">27 июля — 2 августа</span>
  <div style="display:flex;gap:10px;flex-wrap:wrap"><span style="background:#CCE2FF;color:#001A3D;border-radius:999px;padding:8px 16px;font:500 14px 'Golos Text',sans-serif">500 000 ₽</span></div>
  <div style="display:flex;justify-content:flex-end"><span style="display:inline-flex;align-items:center;gap:8px;background:#006DFF;color:#F7FAFF;border-radius:999px;padding:8px 16px;font:500 13px 'Golos Text',sans-serif"><span style="width:6px;height:6px;border-radius:50%;background:#FFFFFF;animation:wfPulse 2.2s ease infinite"></span>Идёт сейчас</span></div>
</div>
```

## Аккордеон (круглый +/−)
Вопрос на Prata, номер-caption, круглая кнопка-переключатель.

```html
<div style="border-bottom:1px solid rgba(0,26,61,.13)">
  <button style="width:100%;display:flex;align-items:center;justify-content:space-between;gap:28px;background:none;border:none;padding:25px 2px;cursor:pointer;text-align:left">
    <span style="display:flex;align-items:baseline;gap:18px">
      <span style="font:400 13px 'Prata',Georgia,serif;color:rgba(0,26,61,.35)">01</span>
      <span style="font:400 19px/1.4 'Prata',Georgia,serif;color:#001A3D">Вопрос?</span>
    </span>
    <span style="width:30px;height:30px;border-radius:50%;border:1px solid rgba(0,26,61,.3);display:inline-flex;align-items:center;justify-content:center;color:#001A3D"><span style="font-size:16px;line-height:1">+</span></span>
  </button>
  <div style="padding:0 56px 28px 44px;font:400 15.5px/1.65 'Golos Text',sans-serif;color:#33465F">Ответ.</div>
</div>
```

## Тикер (бегущая строка)
Uppercase-факты через золотые/синие ромбы `◆`. Дублируй содержимое дважды для бесшовного цикла (`translateX(-50%)`).

```html
<div style="overflow:hidden;background:#FFFFFF;border-bottom:1px solid rgba(0,26,61,.1)">
  <div style="display:flex;width:max-content;animation:wfTicker 32s linear infinite">
    <div style="display:flex;gap:44px;align-items:center;padding:13px 22px;white-space:nowrap">
      <span style="font:600 11px 'Golos Text',sans-serif;letter-spacing:.16em;text-transform:uppercase;color:#001A3D">3 × 500 000 ₽</span><span style="color:#006DFF;font-size:9px">◆</span>
      <!-- повтори пункты; затем весь блок ещё раз для цикла -->
    </div>
  </div>
</div>
```

## Sticky-хедер (полупрозрачный + blur)

```html
<header style="position:sticky;top:0;z-index:60;background:rgba(247,250,255,.9);backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px);border-bottom:1px solid rgba(0,26,61,.1)">
  <div style="margin:0 auto;max-width:1240px;padding:0 48px;height:76px;display:flex;align-items:center;justify-content:space-between;gap:32px">
    <!-- лого · nav (Golos 500 15px, hover→#006DFF) · кнопка-пилюля -->
  </div>
</header>
```

## Hero-карточка с 3D-tilt (опционально)
Карточка наклоняется за курсором; вокруг парят float-элементы. Реализация — CSS-переменные `--tilt-x/--tilt-y/--card-y`, обновляемые на `pointermove`, и сброс на `pointerout` (см. `<script>` в оригинале `source/template.html`, строки ~1030–1073). На мобильных float-элементы скрываются, tilt отключается. Приём необязателен — стиль держится и без него.

---

## Адаптивность (брейкпоинты оригинала)
- `≤920px`: контейнер-паддинг 24px; nav и float-элементы скрыты; двухколоночные гриды → одна колонка; модалка на весь экран.
- `≤480px`: H1 ≈ 44px.
