#!/usr/bin/env node
// Drawing register: keeps drawings.json, the revision files and the short links in step.
//
//   node tools/register.mjs check                      validate the register and rewrite the short links
//   node tools/register.mjs revise MHB-0102 --note "Langere staaf" [--viewer 2]
//                                                      new revision: copies the latest file to the next letter
//   node tools/register.mjs archive MHB-0102           move a drawing to the archive
//   node tools/register.mjs restore MHB-0102           bring it back from the archive
//
// Rules: a released revision file is never edited again; changes go into a new revision.
// Old revisions stay online and show a "superseded" banner, read from drawings.json.
import { readFileSync, writeFileSync, existsSync, copyFileSync, mkdirSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const REG = join(ROOT, 'drawings.json');
const load = () => JSON.parse(readFileSync(REG, 'utf8'));
const save = reg => writeFileSync(REG, JSON.stringify(reg, null, 2) + '\n');
const today = () => new Date().toISOString().slice(0, 10);
const nextRev = r => (r === 'Z' ? null : String.fromCharCode(r.charCodeAt(0) + 1));
const die = msg => { console.error(msg); process.exit(1); };

function find(reg, number) {
  const d = reg.drawings.find(x => x.number === number);
  if (!d) die(`Unknown drawing ${number}. Known: ${reg.drawings.map(x => x.number).join(', ')}`);
  return d;
}

// ---------- Link previews (WhatsApp, Mail, iMessage, Teams …) ----------
// Crawlers don't run JavaScript, so the preview tags must be in the HTML of the page that is shared:
// the short link pages (latest revision) and each revision file. They only describe the page; the
// drawing itself is never touched. Images come from tools/previews.mjs.
const attr = s => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
function previewTags(reg, { title, description, path, image }) {
  if (!reg.site) return '';
  const site = reg.site.endsWith('/') ? reg.site : reg.site + '/';
  const img = image && existsSync(join(ROOT, image)) ? site + image : null;
  return [
    `<meta name="description" content="${attr(description)}">`,
    `<meta property="og:type" content="website">`,
    `<meta property="og:site_name" content="Tekeningenregister">`,
    `<meta property="og:title" content="${attr(title)}">`,
    `<meta property="og:description" content="${attr(description)}">`,
    `<meta property="og:url" content="${attr(site + path)}">`,
    ...(img ? [
      `<meta property="og:image" content="${attr(img)}">`,
      `<meta property="og:image:type" content="image/jpeg">`,
      `<meta property="og:image:width" content="1200">`,
      `<meta property="og:image:height" content="630">`,
      `<meta property="og:image:alt" content="${attr(title)}">`,
      `<meta name="twitter:card" content="summary_large_image">`
    ] : [`<meta name="twitter:card" content="summary">`])
  ].join('\n');
}
const latestTags = (reg, d) => {
  const L = d.revisions[d.revisions.length - 1];
  return previewTags(reg, {
    title: `${d.title} · ${d.number}`,
    description: `${d.description} Altijd de laatste revisie (nu ${L.rev}).`,
    path: `drawings/${d.number}/`,
    image: `previews/${d.number}-${L.rev}.jpg`
  });
};
const START = '<!-- link-preview -->', END = '<!-- /link-preview -->';
function setRevisionTags(reg, d, r) {
  const file = join(ROOT, r.file);
  if (!existsSync(file)) return;
  const html = readFileSync(file, 'utf8');
  const tags = previewTags(reg, {
    title: `${d.title} · ${d.number}-${r.rev}`,
    description: `${d.description} Revisie ${r.rev} van ${r.date}.`,
    path: r.file,
    image: `previews/${d.number}-${r.rev}.jpg`
  });
  const block = tags ? `${START}\n${tags}\n${END}` : '';
  let next;
  if (html.includes(START)) next = html.replace(new RegExp(`${START}[\\s\\S]*?${END}\\n?`), block ? block + '\n' : '');
  else if (block) next = html.replace(/(<\/title>\n)/, `$1${block}\n`);
  else next = html;
  if (next !== html) writeFileSync(file, next);
}

function redirectPage(target, title, tags = '') {
  return `<!doctype html>
<html lang="nl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title}</title>
${tags ? tags + '\n' : ''}<meta http-equiv="refresh" content="0; url=${target}">
<style>body{margin:0;padding:24px;font:15px system-ui,sans-serif}[hidden]{display:none!important}</style>
</head>
<body>
<p><a href="${target}">${title}</a></p>
<script>location.replace(${JSON.stringify(target)} + location.hash);</script>
</body>
</html>
`;
}

// Short links: drawings/<number>/ always opens the latest revision, and the optional "link"
// (e.g. trapleuning.html) points there too, so shared links keep working after a new revision.
function sync(reg) {
  for (const d of reg.drawings) {
    const latest = d.revisions[d.revisions.length - 1];
    const dir = join(ROOT, 'drawings', d.number);
    mkdirSync(dir, { recursive: true });
    const title = `${d.title} (${d.number}-${latest.rev})`;
    const tags = latestTags(reg, d);
    writeFileSync(join(dir, 'index.html'), redirectPage(relative(dir, join(ROOT, latest.file)), title, tags));
    if (d.link) writeFileSync(join(ROOT, d.link), redirectPage(`drawings/${d.number}/`, title, tags));
    d.revisions.forEach(r => setRevisionTags(reg, d, r));
  }
}

function check(reg) {
  const problems = [];
  const seen = new Set();
  for (const d of reg.drawings) {
    if (seen.has(d.number)) problems.push(`${d.number}: listed twice`);
    seen.add(d.number);
    if (!['current', 'archived'].includes(d.status)) problems.push(`${d.number}: status must be "current" or "archived"`);
    if (!d.revisions || !d.revisions.length) { problems.push(`${d.number}: no revisions`); continue; }
    let prev = '';
    for (const r of d.revisions) {
      if (!/^[A-Z]$/.test(r.rev) || r.rev <= prev) problems.push(`${d.number}: revisions must be single letters in order (got ${r.rev} after ${prev || 'start'})`);
      prev = r.rev;
      const file = join(ROOT, r.file);
      if (!existsSync(file)) { problems.push(`${d.number}-${r.rev}: missing file ${r.file}`); continue; }
      const html = readFileSync(file, 'utf8');
      const m = html.match(/viewer\/(\d+(?:\.\d+\.\d+)?)\/viewer\.js/);
      if (!m) problems.push(`${d.number}-${r.rev}: does not load the shared viewer`);
      else {
        if (r.viewer && m[1] !== r.viewer) problems.push(`${d.number}-${r.rev}: register says viewer ${r.viewer}, file uses ${m[1]}`);
        if (!existsSync(join(ROOT, 'viewer', m[1], 'viewer.js'))) problems.push(`${d.number}-${r.rev}: viewer ${m[1]} is not released in viewer/`);
      }
      if (!html.includes(`number: '${d.number}', rev: '${r.rev}'`)) problems.push(`${d.number}-${r.rev}: register block in the file does not match`);
    }
  }
  return problems;
}

const [cmd, number, ...rest] = process.argv.slice(2);
const opt = name => { const i = rest.indexOf('--' + name); return i >= 0 ? rest[i + 1] : undefined; };
const reg = load();

if (cmd === 'revise') {
  if (!number) die('Usage: revise <NUMBER> --note "what changed" [--viewer 2 | x.y.z]');
  const d = find(reg, number);
  const last = d.revisions[d.revisions.length - 1];
  const rev = nextRev(last.rev);
  if (!rev) die(`${number} is at revision Z`);
  const file = `drawings/${number}/${rev}.html`;
  let html = readFileSync(join(ROOT, last.file), 'utf8')
    .split(`${number}-${last.rev}`).join(`${number}-${rev}`)
    .replace(`number: '${number}', rev: '${last.rev}'`, `number: '${number}', rev: '${rev}'`);
  const viewer = opt('viewer');
  if (viewer) {
    if (!existsSync(join(ROOT, 'viewer', viewer, 'viewer.js'))) die(`viewer/${viewer} is not released yet`);
    html = html.replace(/viewer\/\d+(?:\.\d+\.\d+)?\//g, `viewer/${viewer}/`);
  }
  writeFileSync(join(ROOT, file), html);
  d.revisions.push({ rev, date: today(), file, viewer: viewer || last.viewer, note: opt('note') || `Revisie ${rev}` });
  if (d.status === 'archived') d.status = 'current';
  save(reg); sync(reg);
  console.log(`${number}-${rev} created: ${file}. Edit that file; ${last.file} stays as it was and now shows as superseded.`);
} else if (cmd === 'archive' || cmd === 'restore') {
  if (!number) die(`Usage: ${cmd} <NUMBER>`);
  find(reg, number).status = cmd === 'archive' ? 'archived' : 'current';
  save(reg); sync(reg);
  console.log(`${number} ${cmd === 'archive' ? 'archived' : 'restored'}.`);
} else if (cmd === 'check' || !cmd) {
  const problems = check(reg);
  sync(reg);
  if (problems.length) { problems.forEach(p => console.log('  ' + p)); die(`${problems.length} problem(s) in the register`); }
  console.log(`register ok: ${reg.drawings.length} drawings, ${reg.drawings.reduce((n, d) => n + d.revisions.length, 0)} revisions; short links rewritten`);
} else {
  die('Commands: check | revise <NUMBER> --note "..." [--viewer x.y.z] | archive <NUMBER> | restore <NUMBER>');
}
