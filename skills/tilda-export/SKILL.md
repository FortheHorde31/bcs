---
name: tilda-export
description: Пересборка готового лендинга (единый HTML) в самодостаточные блоки для конструктора Tilda — статик-блоки T123/Zero и Popup-блок. Применяй, когда нужно «перенести лендинг в Tilda», «сделать блоки для Tilda», «собрать попап в Tilda», сверстать секцию под вставку в HTML-блок Tilda, или когда готовый прототип уезжает в продакшн на Tilda. Скилл про верстку и упаковку под платформу, стиль лендинга задаётся отдельным скиллом стиля (например premium-01).
---

# Tilda — пересборка лендинга в блоки

Берём собранный лендинг (единый HTML-файл) и разбираем его на **самодостаточные блоки, которые копипастятся в конструктор Tilda**. Это финальный шаг продакшн-пути, а не опция.

Скилл отвечает только за упаковку под платформу. Визуальный язык (цвета, шрифты, компоненты) приходит из скилла стиля — например `premium-01`.

Эталон формата — `bcs_mi/10. Landing pages/bcs_x2_v.2_tilda/tilda-static-blocks/` (9 блоков) и `.../tilda-popup/`.

## Два целевых формата

1. **Tilda Static Block** — классический HTML-блок в Tilda (Zero / T123 «HTML»). Один файл = одна секция страницы (хедер, тикер, hero, оффер, шаги, FAQ, футер…). Вставляется в тело страницы по порядку.
2. **Tilda Popup** — тот же классический HTML-блок, но живёт **внутри Popup-блока Tilda**. Оверлей, крестик и открытие рисует сам Tilda; наш HTML — только карточка контента.

Раскладывай экспорт в две папки рядом с лендингом: `tilda-static-blocks/` и `tilda-popup/`. Нумеруй статик-блоки по порядку вставки (`01-header.html`, `02-…`).

## Золотые правила конвертации

1. **Каждый блок самодостаточен.** Нельзя полагаться на общий `<head>` — у каждого файла свой `<style>` со своим `@import` шрифтов. Пример для стиля premium-01: `@import url("https://fonts.googleapis.com/css2?family=Golos+Text:wght@400;500;600&family=Prata&display=swap");` (в попапе добавь `;700` к Golos, если нужен bold).
2. **Скоуп по корневому классу.** Выбери короткий неймспейс проекта (`bcs`, `mi`, …) и оборачивай блок в один класс `.<ns>-<name>` (`.bcs-header`, `.bcs-hero-static`, `.bcs-modal`). CSS начинай с `.<ns>-<name>, .<ns>-<name> * { box-sizing: border-box }`. Все селекторы — только из-под корня. Это защищает от глобального CSS Tilda и наоборот.
3. **Инлайны → классы (прагматично).** Крупные/повторяющиеся узлы выноси в BEM-классы (`.bcs-header__wrap`, `__nav`, `__button`). Разовые узлы можно оставить инлайновыми под скоуп-классом. Не гонись за чистотой ради чистоты; гонись за копипастящимся блоком.
4. **JS-хуки — через `data-*`,** не через `id` (id может дублироваться при повторной вставке). Пример таймера: `data-bcs-first-draw-timer data-target="2026-07-19T23:59:59+03:00"`, поля — `data-timer-days/hours/minutes/seconds/label`.

## Что ВЫРЕЗАТЬ

- Google Tag Manager и любую аналитику (Tilda подключает своё).
- React / DC-runtime, `<x-dc>`, `<helmet>`, `<script type="text/x-dc">`, все `{{ }}`-переменные, `sc-if` / `sc-for`.
- Cookie-плашку, логику состояний, JS наклона hero-карточки от курсора (`pointermove`-tilt).
- Сам попап, оверлей и iframe-виджет из тела страницы — попап уезжает в отдельный `tilda-popup/`.

## Что ЗАМЕНИТЬ на статику

- Динамические значения → жёстко заданные: текущая неделя/шаг, `% акции позади`, активная строка таймлайна, подсветка следующей строки — прописать руками.
- FAQ-аккордеон на JS → нативный `<details>/<summary>` (без скрипта).
- Тикер → только CSS-анимация (`@keyframes`, контент продублирован дважды, `translateX(-50%)`).
- CTA, открывающий попап → `href="#popup:embedcode"`. Если в Tilda переименуют ссылку попапа — заменить `embedcode` во всех кнопках.
- Навигация хедера → якоря секций (`#prizes`, `#schedule`, `#how`, `#faq` — свой набор под лендинг).

## Что ОСТАВИТЬ

- Обычные HTML + CSS и минимум ванильного JS только там, где он даёт ценность (обратный отсчёт). Таймер — самостоятельный IIFE, дата/массив периодов захардкожены, ближайшее незавершённое событие вычисляется само.
- Ассеты (лого, QR, иконки) встраивай как `data:image` прямо в HTML — чтобы в Tilda ничего не грузить отдельно.
- Визуальный язык скилла стиля целиком: токены, типографику, компоненты, ритм.

## Специфика Tilda Popup

Внутри попапа Tilda оборачивает наш блок в свои контейнеры с шириной, фоном и паддингами. Их нужно нейтрализовать через `:has()`, иначе фон карточки растянется на весь экран:

```css
.t-popup__container:has(.bcs-modal),
.t-popup__container-animated:has(.bcs-modal),
.t-popup__container-static:has(.bcs-modal) {
  width: min(560px, calc(100vw - 32px)) !important;
  max-width: 560px !important;
  padding: 0 !important;
  border-radius: 28px !important;
  background: transparent !important;
  box-shadow: none !important;
}
.t-popup__container:has(.bcs-modal) .t-rec,
.t-popup__container:has(.bcs-modal) .t-col,
.t-popup__container:has(.bcs-modal) .t-container,
.t-popup__container:has(.bcs-modal) .t-width
/* + повторить для -animated и -static */ {
  width: 100% !important; max-width: none !important;
  margin: 0 !important; padding: 0 !important; background: transparent !important;
}
```

Фон и скругление рисует только карточка `.bcs-modal`. На `≤920px` попап раскрывается на весь экран: QR (`.bcs-modal__qr`) скрывается, вместо него показываются кнопки сторов (`.bcs-modal__stores`, по умолчанию `display:none` → `display:flex`). Формы открытия счёта — оригинальный iframe партнёр-виджета. Чтобы кнопки лендинга открывали этот попап, в Popup-блоке Tilda поле «Ссылка на pop-up» = `#popup:embedcode`.

## Каркас статик-блока (шаблон)

```html
<style>
  @import url("https://fonts.googleapis.com/css2?family=Golos+Text:wght@400;500;600&family=Prata&display=swap");

  .bcs-SECTION, .bcs-SECTION * { box-sizing: border-box; }
  .bcs-SECTION {
    background: #f7faff;                 /* или тёмный якорь стиля */
    color: #001a3d;
    font-family: "Golos Text", system-ui, -apple-system, "Segoe UI", sans-serif;
  }
  .bcs-SECTION__wrap { max-width: 1240px; margin: 0 auto; padding: 104px 48px; }
  /* ...остальные классы секции из-под .bcs-SECTION... */

  @media (max-width: 920px) {
    .bcs-SECTION__wrap { padding: 64px 24px; }
    /* гриды → одна колонка и т.п. */
  }
</style>

<section class="bcs-SECTION" data-screen-label="Название">
  <div class="bcs-SECTION__wrap">
    <!-- контент секции в визуальном языке скилла стиля -->
  </div>
</section>
```

Цвета/размеры в шаблоне — из стиля `premium-01`. Для другого стиля подставь его токены, каркас остаётся тем же.

## Чек-лист перед сдачей блоков

- [ ] Каждый файл открывается сам по себе (свой `<style>`, свой `@import` шрифтов).
- [ ] Все селекторы под корневым `.<ns>-*`, есть `box-sizing` reset.
- [ ] Нет GTM, DC-runtime, `{{ }}`, `sc-*`, cookie, tilt-JS.
- [ ] Динамика заменена статикой; FAQ на `<details>`; тикер на CSS.
- [ ] Лого/QR/иконки как `data:image` — Tilda ничего не грузит.
- [ ] CTA ведут на `#popup:embedcode`; nav — на якоря секций.
- [ ] Попап нейтрализует контейнеры Tilda через `:has()`; ≤920px — фуллскрин с переключением QR↔сторы.
- [ ] JS-хуки на `data-*`, не на `id`.
- [ ] Порядок статик-блоков пронумерован; попап — отдельным файлом в `tilda-popup/`.
