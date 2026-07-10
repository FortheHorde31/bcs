# БКС «Умножаем инвестиции» — лендинг

Проект лендинга акции «Умножаем инвестиции».

## Почему раньше был только index.html?

Исходник — **standalone HTML** (`BCS Editorial Standalone.html`): один файл, внутри которого через `__bundler/manifest` и `__bundler/template` упакованы все 18 ассетов (картинки, шрифты, JS). Для деплоя в Object Storage достаточно было скопировать его как `index.html`.

Для редактирования и версионирования удобнее разложить всё по папкам — для этого есть `scripts/unpack.mjs`.

## Структура

```
bcs-landing/
├── standalone/          # однофайловая версия (для пересылки / архива)
│   └── BCS Editorial Standalone.html
├── source/              # исходники для правок
│   ├── template.html    # HTML-шаблон (UUID ассетов)
│   └── asset-map.json   # соответствие UUID → файлы
├── public/              # папка для деплоя и локального просмотра
│   ├── index.html
│   └── assets/
│       ├── images/
│       ├── fonts/
│       └── js/
└── scripts/
    ├── unpack.mjs       # распаковка standalone → public/
    └── deploy-yc.sh     # деплой public/ в Yandex Cloud
```

## Команды

Распаковать standalone в `public/`:

```bash
node scripts/unpack.mjs
```

Локальный просмотр (нужен HTTP-сервер, file:// не подойдёт):

```bash
npx --yes serve public
```

Деплой в Yandex Object Storage:

```bash
./scripts/deploy-yc.sh
```

## Редактирование

1. Правьте `source/template.html` (тексты, блоки, ссылки).
2. Заменяйте картинки в `public/assets/images/` (имена — в `source/asset-map.json`).
3. Пересоберите `public/index.html` скриптом unpack или вручную подставьте пути из `asset-map.json`.

Для полной пересборки standalone из source потребуется обратный pack-скрипт (пока не реализован) — пока проще править standalone напрямую и снова запускать `unpack.mjs`.
