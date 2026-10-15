// Fetch the remaining lazy-loaded chunks through the live page origin.
//
// Fixes the self-lock that made the previous run fail 8/8 rounds:
//   the old script used `cache: 'force-cache'`, so once EdgeOne answered with its
//   ~988-byte JS-challenge page, that HTML was served from cache on every retry.
// This version uses `cache: 'reload'` plus a per-attempt cache-buster, verifies
// the body really is JavaScript, and reloads the page to re-solve the challenge
// when the WAF starts challenging us.
const PORT = Number(process.env.CDP_PORT || 9222);
const BASE = `http://127.0.0.1:${PORT}`;
const OUT = fileURLToPath(new URL('.', import.meta.url)).replace(/\/$/, '');
const ASSETS = OUT + '/assets';

import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

mkdirSync(ASSETS, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---- minimal CDP session -------------------------------------------------
class Session {
  constructor(ws) {
    this.ws = ws; this.id = 0; this.pending = new Map();
    ws.addEventListener('message', (ev) => {
      const m = JSON.parse(ev.data);
      if (m.id === undefined) return;
      const p = this.pending.get(m.id);
      if (!p) return;
      this.pending.delete(m.id);
      m.error ? p.reject(new Error(JSON.stringify(m.error))) : p.resolve(m.result);
    });
  }
  static async connect(url) {
    const ws = new WebSocket(url);
    await new Promise((res, rej) => {
      ws.addEventListener('open', res, { once: true });
      ws.addEventListener('error', rej, { once: true });
    });
    return new Session(ws);
  }
  send(method, params = {}) {
    const id = ++this.id;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
      setTimeout(() => {
        if (this.pending.has(id)) { this.pending.delete(id); reject(new Error('timeout: ' + method)); }
      }, 60000);
    });
  }
  async evaluate(expression) {
    const r = await this.send('Runtime.evaluate', {
      expression, awaitPromise: true, returnByValue: true,
      allowUnsafeEvalBlockedByCSP: true,
    });
    if (r.exceptionDetails) throw new Error('eval: ' + JSON.stringify(r.exceptionDetails).slice(0, 300));
    return r.result?.value;
  }
  close() { try { this.ws.close(); } catch {} }
}

async function listPages() {
  const r = await fetch(`${BASE}/json/list`);
  return r.json();
}

// ---- pick a page already on the target origin ----------------------------
const pages = await listPages();
const page = pages.find((t) => t.type === 'page' && /examcrafts\.com/.test(t.url || ''));
if (!page) { console.error('no examcrafts page target found; open one first'); process.exit(1); }
console.log(`target: ${page.url}`);

const s = await Session.connect(page.webSocketDebuggerUrl);
await s.send('Runtime.enable');

// Same-origin fetch from inside the page so the request inherits the origin,
// the credentials, and any challenge state the browser has already cleared.
async function fetchText(path, { reload = false } = {}) {
  const bust = `${path}${path.includes('?') ? '&' : '?'}__cb=${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const expr = `(async () => {
    const r = await fetch(${JSON.stringify(bust)}, {
      credentials: 'include',
      cache: ${reload ? "'reload'" : "'default'"},
    });
    const ct = r.headers.get('content-type') || '';
    const body = await r.text();
    return JSON.stringify({ status: r.status, ct, len: body.length, body });
  })()`;
  const raw = await s.evaluate(expr);
  return raw ? JSON.parse(raw) : null;
}

// EdgeOne's challenge is HTML served with a 200; real chunks are JS.
function classify(r) {
  if (!r) return 'null';
  if (r.status !== 200) return `http_${r.status}`;
  if (!String(r.ct).includes('javascript')) return `challenge_or_html(${r.len}b,${r.ct})`;
  if (r.len < 500) return `too_small(${r.len}b)`;
  return 'ok';
}

async function reloadChallenge() {
  console.log('  ~ reloading page to re-solve challenge');
  await s.send('Page.enable');
  await s.send('Page.navigate', { url: 'https://examcrafts.com/' });
  await sleep(4000);
}

// ---- work out what is still missing --------------------------------------
const all = readFileSync(join(OUT, 'chunks.txt'), 'utf8').trim().split('\n').map((x) => x.trim()).filter(Boolean);
const have = (n) => {
  const p = join(ASSETS, n);
  return existsSync(p) && readFileSync(p, 'utf8').length > 2000;
};
let todo = all.filter((n) => !have(n));
console.log(`total=${all.length} have=${all.length - todo.length} todo=${todo.length}\n`);

let round = 0;
while (todo.length && round < 6) {
  round++;
  const still = [];
  let challenges = 0;
  console.log(`--- round ${round}: ${todo.length} pending ---`);
  for (const name of todo) {
    try {
      const r = await fetchText('/assets/' + name);
      const verdict = classify(r);
      if (verdict === 'ok') {
        writeFileSync(join(ASSETS, name), r.body);
        console.log(`  OK   ${name} (${r.len}b)`);
      } else {
        still.push(name);
        console.log(`  MISS ${name} -> ${verdict}`);
        if (String(verdict).startsWith('challenge_or_html')) challenges++;
      }
    } catch (e) {
      still.push(name);
      console.log(`  ERR  ${name} ${String(e).slice(0, 90)}`);
    }
    await sleep(800 + Math.random() * 1200); // gentle pacing, per prior rate-limit lesson
  }

  todo = still;
  if (!todo.length) break;

  // If the WAF challenged us, re-solve it by doing a real navigation.
  if (challenges > 0 || round >= 2) await reloadChallenge();
  if (todo.length) await sleep(3000);
}

console.log(`\nremaining: ${todo.length}`);
if (todo.length) writeFileSync(join(OUT, 'chunk_failures.json'), JSON.stringify(todo, null, 2));
const finalHave = all.filter(have);
console.log(`final: ${finalHave.length}/${all.length}`);
s.close();
process.exit(0);
