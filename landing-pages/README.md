# Landing pages

Лендинги БКС, собранные из отдельных репозиториев в одно место. Каждая папка — самостоятельная статическая страница со своей историей коммитов (перенесена целиком через `git subtree`).

## Что здесь

| Папка | Лендинг | Стек | Живая версия |
|---|---|---|---|
| [`bcs-chess-landing`](bcs-chess-landing/) | «Шах и мат рынку» — партия против рынка с гроссмейстером БКС, мат за 7 ходов | 3D scroll-driven, Three.js; один `index.html` | [forthehorde31.github.io/bcs-chess-landing](https://forthehorde31.github.io/bcs-chess-landing/) |
| [`bcs-navigator`](bcs-navigator/) | «Навигатор по рынку» — 30 лет опыта, 6 пройденных кризисов, навигатор в пространстве вариантов | Three.js + GSAP ScrollTrigger + Lenis, 8 сцен, без сборки (ES-модули и CDN) | [forthehorde31.github.io/bcs-navigator](https://forthehorde31.github.io/bcs-navigator/) |
| [`bcs-17-5`](bcs-17-5/) | «БКС 17,5%» — бандл НСЖ «Кешбэк Промо» + ИСП «Гарант Доход Ультра 2.0» | Один `index.html`, без зависимостей | [forthehorde31.github.io/bcs-17-5](https://forthehorde31.github.io/bcs-17-5/) |
| [`bcs-double-investment`](bcs-double-investment/) | «Умножаем инвестиции» — акция double_investment | Собранный React-бандл + шрифты и ассеты локально; `scripts/build-standalone.mjs` собирает автономную версию | [forthehorde31.github.io/bcs-double-investment](https://forthehorde31.github.io/bcs-double-investment/) |

Подробности по конкретному лендингу — в его собственном README, если он есть (`bcs-navigator`, `bcs-double-investment`).

## Важно: живые ссылки обслуживаются исходными репозиториями

Столбец «Живая версия» указывает на GitHub Pages **старых отдельных репозиториев** — `FortheHorde31/bcs-chess-landing` и остальных. Этот монорепозиторий хранит код, но не отдаёт эти страницы.

Пока исходные репозитории существуют, ссылки живут. **Если удалить их — ссылки умрут.** Прежде чем удалять, нужно либо включить Pages здесь и разослать новые адреса, либо оставить оригиналы как хостинг.

Все страницы используют относительные пути к ассетам — под вложенным путём вида `/bcs/landing-pages/<имя>/` они отработают корректно, если Pages включат на этом репозитории.

## Запуск локально

Любой статический сервер из папки лендинга — `file://` не годится, importmap и модули требуют HTTP:

```bash
cd landing-pages/bcs-navigator
python3 -m http.server 8080
# http://localhost:8080
```

## Как добавить лендинг

С сохранением истории коммитов:

```bash
git subtree add --prefix="landing-pages/<имя>" https://github.com/FortheHorde31/<репозиторий>.git main
```

Подтянуть свежие изменения из исходного репозитория, если он ещё живёт своей жизнью:

```bash
git subtree pull --prefix="landing-pages/<имя>" https://github.com/FortheHorde31/<репозиторий>.git main
```

После добавления — обнови таблицу выше.
