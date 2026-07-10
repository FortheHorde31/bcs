#!/usr/bin/env node
/**
 * Unpack BCS Editorial Standalone.html into a multi-file project.
 * Usage: node scripts/unpack.mjs [path/to/standalone.html]
 */

import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '..');

const SOURCE = process.argv[2] ||
  path.join(PROJECT_ROOT, 'standalone', 'BCS Editorial Standalone.html');

const ASSET_MAP = {
  '942b1473-b64e-4593-8e9e-0130f34f889d': 'assets/images/logo-blue.svg',
  'a680cdd1-ba6b-48dc-82eb-b15cdc7c7a12': 'assets/images/qr-app.svg',
  'c60731f7-c612-44b2-95bb-09a6435e79c3': 'assets/images/icon-today.svg',
  'ca75d987-0ea9-4c21-a47f-59055c4c037d': 'assets/images/favicon.svg',
  '393bc54a-b1c0-4e89-b858-24764ed3d01c': 'assets/images/favicon-32.png',
  'ff17f539-cb17-4285-90d3-0d55a5bbee50': 'assets/images/apple-touch-icon.png',
  '8056068d-83a0-44b9-a88f-57ed2f2c3b07': 'assets/images/og-image.png',
  'ab6639a4-49ac-476a-bea1-24d205bba754': 'assets/js/app.bundle.js',
  '0c25ed8a-531f-46cd-bd76-60b95f5912e4': 'assets/js/react.production.min.js',
  'dd433f8f-4186-44b7-9950-177e8e50821f': 'assets/js/react-dom.production.min.js',
  '0008ef47-3ab1-4ac5-824f-9c3a3ccc7865': 'assets/fonts/golos-text-400-cyrillic-ext.woff2',
  'be6e757f-ea65-40ce-ba6f-21a3e47aada9': 'assets/fonts/golos-text-400-cyrillic.woff2',
  'afab5e17-9389-4afa-aad2-574908f5e023': 'assets/fonts/golos-text-400-latin-ext.woff2',
  '96502502-1d47-4e01-baa6-cdbee9399f05': 'assets/fonts/golos-text-400-latin.woff2',
  'b3b1b5df-5eb0-4f37-9138-6e508f25480a': 'assets/fonts/golos-text-600-cyrillic-ext.woff2',
  'f8344ea3-e0c4-46b4-b667-13dfb85c2bce': 'assets/fonts/golos-text-600-cyrillic.woff2',
  'b01111dd-e7df-413b-bb42-1a529ed9a0cc': 'assets/fonts/golos-text-600-vietnamese.woff2',
  'e716d55a-e25f-4b87-a595-99c8e12944c6': 'assets/fonts/golos-text-600-latin.woff2',
};

const EXT_RESOURCES = [
  {
    id: 'https://unpkg.com/react@18.3.1/umd/react.production.min.js',
    uuid: '0c25ed8a-531f-46cd-bd76-60b95f5912e4',
  },
  {
    id: 'https://unpkg.com/react-dom@18.3.1/umd/react-dom.production.min.js',
    uuid: 'dd433f8f-4186-44b7-9950-177e8e50821f',
  },
];

function decodeAsset(entry) {
  let data = Buffer.from(entry.data, 'base64');
  if (entry.compressed) data = zlib.gunzipSync(data);
  return data;
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function parseStandalone(html) {
  const manifestMatch = html.match(/<script type="__bundler\/manifest">([\s\S]*?)<\/script>/);
  const templateMatch = html.match(/<script type="__bundler\/template">([\s\S]*?)<\/script>/);
  if (!manifestMatch || !templateMatch) {
    throw new Error('Not a bundled standalone HTML (missing manifest/template)');
  }
  return {
    manifest: JSON.parse(manifestMatch[1]),
    template: JSON.parse(templateMatch[1]),
  };
}

function buildPublicIndex(template) {
  let html = template;

  for (const [uuid, relPath] of Object.entries(ASSET_MAP)) {
    html = html.split(uuid).join(relPath);
  }

  const resources = {};
  for (const { id, uuid } of EXT_RESOURCES) {
    resources[id] = ASSET_MAP[uuid];
  }

  const resourceScript =
    `<script>window.__resources = ${JSON.stringify(resources)};</script>`;

  const headOpen = html.match(/<head[^>]*>/i);
  if (headOpen) {
    const i = headOpen.index + headOpen[0].length;
    html = html.slice(0, i) + resourceScript + html.slice(i);
  }

  return html;
}

function main() {
  if (!fs.existsSync(SOURCE)) {
    console.error(`Source not found: ${SOURCE}`);
    process.exit(1);
  }

  const html = fs.readFileSync(SOURCE, 'utf8');
  const { manifest, template } = parseStandalone(html);

  const publicDir = path.join(PROJECT_ROOT, 'public');
  const sourceDir = path.join(PROJECT_ROOT, 'source');
  const standaloneDir = path.join(PROJECT_ROOT, 'standalone');

  ensureDir(publicDir);
  ensureDir(sourceDir);
  ensureDir(standaloneDir);

  for (const [uuid, relPath] of Object.entries(ASSET_MAP)) {
    const entry = manifest[uuid];
    if (!entry) {
      console.warn(`Warning: ${uuid} not in manifest, skipping ${relPath}`);
      continue;
    }
    const outPath = path.join(publicDir, relPath);
    ensureDir(path.dirname(outPath));
    fs.writeFileSync(outPath, decodeAsset(entry));
  }

  fs.writeFileSync(path.join(sourceDir, 'template.html'), template, 'utf8');
  fs.writeFileSync(
    path.join(sourceDir, 'asset-map.json'),
    JSON.stringify({ assets: ASSET_MAP, extResources: EXT_RESOURCES }, null, 2) + '\n',
    'utf8',
  );

  fs.writeFileSync(path.join(publicDir, 'index.html'), buildPublicIndex(template), 'utf8');

  const standaloneName = path.basename(SOURCE);
  const standaloneDest = path.join(standaloneDir, standaloneName);
  if (path.resolve(SOURCE) !== path.resolve(standaloneDest)) {
    fs.copyFileSync(SOURCE, standaloneDest);
  }

  console.log('Unpacked project:');
  console.log(`  source/template.html`);
  console.log(`  source/asset-map.json`);
  console.log(`  public/index.html + ${Object.keys(ASSET_MAP).length} assets`);
  console.log(`  standalone/${standaloneName}`);
}

main();
