#!/usr/bin/env node
// Собирает единый самодостаточный HTML из public/ — все ассеты (JS, шрифты,
// картинки) встраиваются как data:-URI. Результат работает даже из file://,
// без HTTP-сервера и без интернета.
//
//   node scripts/build-standalone.mjs
//
// Выход: standalone/index.html

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const pub = join(root, 'public');

const MIME = {
  '.js': 'text/javascript',
  '.woff2': 'font/woff2',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
};

function ext(p) {
  const i = p.lastIndexOf('.');
  return i < 0 ? '' : p.slice(i);
}

function dataUri(relPath) {
  const file = join(pub, relPath);
  const mime = MIME[ext(relPath)] || 'application/octet-stream';
  const b64 = readFileSync(file).toString('base64');
  return `data:${mime};base64,${b64}`;
}

let html = readFileSync(join(pub, 'index.html'), 'utf8');

// Реальные относительные ассеты, которые надо встроить.
// Абсолютные прод-URL (https://promo.bcs.ru/assets/...) не трогаем —
// это og:image / canonical / JSON-LD для соцсетей.
const assets = [
  'assets/js/app.bundle.js',
  'assets/js/react.production.min.js',
  'assets/js/react-dom.production.min.js',
  'assets/images/logo-blue.svg',
  'assets/images/icon-today.svg',
  'assets/images/qr-app.svg',
  'assets/images/favicon.svg',
  'assets/images/favicon-32.png',
  'assets/images/apple-touch-icon.png',
  'assets/fonts/golos-text-400-cyrillic-ext.woff2',
  'assets/fonts/golos-text-400-cyrillic.woff2',
  'assets/fonts/golos-text-400-latin-ext.woff2',
  'assets/fonts/golos-text-400-latin.woff2',
  'assets/fonts/golos-text-600-cyrillic-ext.woff2',
  'assets/fonts/golos-text-600-cyrillic.woff2',
  'assets/fonts/golos-text-600-latin.woff2',
  'assets/fonts/golos-text-600-vietnamese.woff2',
];

let replaced = 0;
for (const a of assets) {
  if (!existsSync(join(pub, a))) {
    console.warn('! пропущен (нет файла):', a);
    continue;
  }
  const uri = dataUri(a);
  // Заменяем только точное вхождение пути в кавычках/скобках: "assets/..."
  // Абсолютные URL содержат домен перед assets/, поэтому не совпадут.
  const before = html;
  html = html.split(a).join(uri);
  if (html !== before) replaced++;
}

// Проверка: не осталось ли невстроенных относительных ссылок на assets/.
const leftovers = [...html.matchAll(/(?<!promo\.bcs\.ru\/)["'(]assets\/[A-Za-z0-9._/-]+/g)]
  .map((m) => m[0].slice(1));
const unique = [...new Set(leftovers)];

// Пишем и однофайловый архив, и папку для деплоя на Pages по пути /double_investment.
const outputs = [
  join(root, 'standalone', 'index.html'),
  join(root, 'double_investment', 'index.html'),
];
for (const out of outputs) {
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, html);
}

const bytes = Buffer.byteLength(html);
for (const out of outputs) console.log(`✓ ${out}`);
console.log(`  встроено ассетов: ${replaced}/${assets.length}`);
console.log(`  размер: ${(bytes / 1024 / 1024).toFixed(2)} МБ`);
if (unique.length) {
  console.log('  ⚠ остались относительные ссылки на assets/ (проверь):');
  for (const u of unique) console.log('    ', u);
} else {
  console.log('  внешних относительных ассетов не осталось — файл автономен.');
}
