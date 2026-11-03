#!/usr/bin/env node
// Link preview images: renders every revision in the viewer's preview mode (?preview) and saves
// previews/<number>-<rev>.jpg (1200×630, the size WhatsApp, Mail, iMessage and Teams use for link cards).
// Only renders what changed: the hash of the revision file plus the viewer it uses is kept in
// previews/manifest.json. Afterwards `node tools/register.mjs check` writes the preview tags.
//
//   node tools/previews.mjs            render new or changed revisions
//   node tools/previews.mjs --all      render everything again
//
// Needs Playwright with Chromium. PREVIEW_THREE=/path/to/three.min.js serves three.js from disk
// instead of the CDN (for machines without internet access).
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'previews');
const MANIFEST = join(OUT, 'manifest.json');
const all = process.argv.includes('--all');
const { chromium } = createRequire(import.meta.url)('playwright');

const reg = JSON.parse(readFileSync(join(ROOT, 'drawings.json'), 'utf8'));
const manifest = existsSync(MANIFEST) ? JSON.parse(readFileSync(MANIFEST, 'utf8')) : {};
mkdirSync(OUT, { recursive: true });

function hashOf(file) {
  const html = readFileSync(join(ROOT, file), 'utf8');
  const m = html.match(/viewer\/([\w.]+)\/viewer\.js/);
  const h = createHash('sha256').update(html);
  if (m) for (const f of ['viewer.js', 'viewer.css']) {
    const p = join(ROOT, 'viewer', m[1], f);
    if (existsSync(p)) h.update(readFileSync(p));
  }
  return h.digest('hex').slice(0, 16);
}

const todo = [];
for (const d of reg.drawings) for (const r of d.revisions) {
  const key = `${d.number}-${r.rev}`;
  const hash = hashOf(r.file);
  if (all || manifest[key] !== hash || !existsSync(join(OUT, key + '.jpg'))) todo.push({ key, file: r.file, hash });
}
if (!todo.length) { console.log('previews up to date'); process.exit(0); }

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json' };
const server = createServer((req, res) => {
  let file = join(ROOT, decodeURIComponent(new URL(req.url, 'http://x').pathname));
  if (file.endsWith('/')) file += 'index.html';
  if (!file.startsWith(ROOT) || !existsSync(file)) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'content-type': TYPES[extname(file)] || 'application/octet-stream' });
  res.end(readFileSync(file));
}).listen(0);
const base = `http://127.0.0.1:${server.address().port}/`;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
if (process.env.PREVIEW_THREE) {
  const three = readFileSync(process.env.PREVIEW_THREE);
  await page.route('**/three.min.js', r => r.fulfill({ body: three, contentType: 'text/javascript' }));
}
let failed = 0;
for (const t of todo) {
  try {
    await page.goto(base + t.file + '?preview');
    await page.waitForFunction(() => document.documentElement.dataset.dvReady === '1', null, { timeout: 20000 });
    await page.waitForTimeout(300);
    await page.screenshot({ path: join(OUT, t.key + '.jpg'), type: 'jpeg', quality: 85 });
    manifest[t.key] = t.hash;
    console.log(`rendered previews/${t.key}.jpg`);
  } catch (err) {
    failed++;
    console.error(`could not render ${t.key}: ${err.message.split('\n')[0]}`);
  }
}
await browser.close();
server.close();
writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2) + '\n');
process.exit(failed ? 1 : 0);
