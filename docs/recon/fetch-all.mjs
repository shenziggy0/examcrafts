// Load examcrafts.com in a real Chrome, solve the EdgeOne challenge, then pull
// every bundle through the page's own origin so requests carry the session cookie.
import { Session, newPage, UA, sleep, listTargets } from './cdp.mjs';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT = fileURLToPath(new URL('.', import.meta.url)).replace(/\/$/, '');
const ASSETS = join(OUT, 'assets');
mkdirSync(ASSETS, { recursive: true });

const t = await newPage();
const s = await Session.connect(t.webSocketDebuggerUrl);
console.log('page target:', t.id);

await s.send('Page.enable');
await s.send('Network.enable');
await s.send('Runtime.enable');
await s.send('Network.setUserAgentOverride', {
  userAgent: UA,
  acceptLanguage: 'zh-CN,zh;q=0.9,en;q=0.8',
  platform: 'MacIntel',
});

const navErrors = [];
s.on((m) => {
  if (m.method === 'Network.loadingFailed') navErrors.push(m.params.errorText);
});

console.log('navigating...');
await s.send('Page.navigate', { url: 'https://examcrafts.com/' });

// Poll until the SPA actually boots (EdgeOne challenge takes a moment).
let ready = false;
for (let i = 0; i < 40; i++) {
  await sleep(1000);
  try {
    const st = await s.evaluate(`(() => {
      const app = document.getElementById('app');
      return JSON.stringify({
        title: document.title,
        url: location.href,
        appChildren: app ? app.children.length : -1,
        scripts: document.scripts.length,
        cookie: document.cookie.length,
      });
    })()`);
    const o = JSON.parse(st);
    console.log(`  t=${i + 1}s`, st);
    if (o.appChildren > 0) { ready = true; break; }
  } catch (e) {
    console.log(`  t=${i + 1}s eval error`, String(e).slice(0, 120));
  }
}
console.log('SPA booted:', ready);

// Grab whatever the app already loaded, plus cookies.
const cookies = await s.send('Network.getCookies', { urls: ['https://examcrafts.com/'] });
writeFileSync(join(OUT, 'cookies.json'), JSON.stringify(cookies.cookies, null, 2));
console.log('cookies:', cookies.cookies.map((c) => c.name).join(', ') || '(none)');

// Fetch a same-origin path as text, through the page (inherits cookies + origin).
async function fetchText(path) {
  const expr = `(async () => {
    const r = await fetch(${JSON.stringify(path)}, { credentials: 'include' });
    const ct = r.headers.get('content-type') || '';
    const body = await r.text();
    return JSON.stringify({ status: r.status, ct, len: body.length, body });
  })()`;
  const raw = await s.evaluate(expr);
  if (!raw) throw new Error('empty eval for ' + path);
  return JSON.parse(raw);
}

// 1) core bundles referenced by index.html
const core = ['/assets/index-C-mmH9Q6.js', '/assets/vendor-Bg96V-a1.js'];
const got = {};
for (const p of core) {
  const r = await fetchText(p);
  console.log(`${p} -> ${r.status} ${r.ct} ${r.len}b`);
  if (r.status === 200 && r.ct.includes('javascript')) {
    got[p] = r.body;
    writeFileSync(join(ASSETS, p.split('/').pop()), r.body);
  }
}

// 2) discover the lazy chunk names from the index bundle
const idx = got['/assets/index-C-mmH9Q6.js'];
if (!idx) {
  console.error('FATAL: index bundle not retrieved; cannot enumerate chunks');
  writeFileSync(join(OUT, 'debug_loaded_scripts.json'), JSON.stringify(await s.evaluate(`JSON.stringify(performance.getEntriesByType('resource').map(e=>e.name))`), null, 2));
  process.exit(2);
}
const chunkNames = [...new Set([...idx.matchAll(/"\.\/([A-Za-z0-9_.-]+\.js)"/g)].map((m) => m[1]))].sort();
writeFileSync(join(OUT, 'chunks.txt'), chunkNames.join('\n') + '\n');
console.log('discovered chunks:', chunkNames.length);

// 3) pull every chunk
let ok = 0; const failed = [];
const CONC = 5;
for (let i = 0; i < chunkNames.length; i += CONC) {
  const batch = chunkNames.slice(i, i + CONC);
  await Promise.all(batch.map(async (name) => {
    try {
      const r = await fetchText('/assets/' + name);
      if (r.status === 200 && r.ct.includes('javascript')) {
        writeFileSync(join(ASSETS, name), r.body);
        ok++;
      } else {
        failed.push({ name, status: r.status, ct: r.ct, len: r.len });
      }
    } catch (e) {
      failed.push({ name, error: String(e).slice(0, 200) });
    }
  }));
}
console.log(`chunks ok=${ok} failed=${failed.length}`);
if (failed.length) writeFileSync(join(OUT, 'chunk_failures.json'), JSON.stringify(failed, null, 2));

// 4) also grab the CSS + index.html for completeness
for (const p of ['/assets/index-CILwo6Dd.css', '/', '/manifest.json', '/robots.txt', '/sitemap.xml']) {
  try {
    const r = await fetchText(p);
    const fname = p === '/' ? 'index_live.html' : p.split('/').pop();
    writeFileSync(join(OUT, 'fetched_' + fname), r.body);
    console.log(`extra ${p} -> ${r.status} ${r.len}b`);
  } catch (e) { console.log('extra fail', p, String(e).slice(0, 100)); }
}

console.log('DONE');
s.close();
process.exit(0);
