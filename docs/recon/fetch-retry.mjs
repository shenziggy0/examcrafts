// Retry the chunks that failed, with backoff and jitter, through the live page origin.
import { Session, listTargets, sleep } from './cdp.mjs';
import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT = fileURLToPath(new URL('.', import.meta.url)).replace(/\/$/, '');
const ASSETS = join(OUT, 'assets');
mkdirSync(ASSETS, { recursive: true });

const all = readFileSync(join(OUT, 'chunks.txt'), 'utf8').trim().split('\n');
const have = new Set(
  all.filter((n) => {
    const p = join(ASSETS, n);
    return existsSync(p) && readFileSync(p, 'utf8').length > 2000;
  })
);
let todo = all.filter((n) => !have.has(n));
console.log(`total=${all.length} have=${have.size} todo=${todo.length}`);

// find the page target that is on examcrafts.com
const targets = await listTargets();
const page = targets.find((t) => t.type === 'page' && t.url.includes('examcrafts.com'));
if (!page) { console.error('no examcrafts page target'); process.exit(1); }
console.log('using target', page.id, page.url);

const s = await Session.connect(page.webSocketDebuggerUrl);
await s.send('Runtime.enable');

async function fetchText(path) {
  const expr = `(async () => {
    const r = await fetch(${JSON.stringify(path)}, { credentials: 'include', cache: 'force-cache' });
    const ct = r.headers.get('content-type') || '';
    const body = await r.text();
    return JSON.stringify({ status: r.status, ct, len: body.length, body });
  })()`;
  const raw = await s.evaluate(expr);
  return raw ? JSON.parse(raw) : null;
}

let round = 0;
while (todo.length && round < 8) {
  round++;
  const still = [];
  console.log(`--- round ${round}: ${todo.length} pending ---`);
  for (const name of todo) {
    try {
      const r = await fetchText('/assets/' + name);
      if (r && r.status === 200 && r.ct.includes('javascript') && r.len > 500) {
        writeFileSync(join(ASSETS, name), r.body);
        console.log(`  OK  ${name} (${r.len}b)`);
      } else {
        still.push(name);
        console.log(`  BAD ${name} status=${r?.status} ct=${r?.ct} len=${r?.len}`);
      }
    } catch (e) {
      still.push(name);
      console.log(`  ERR ${name} ${String(e).slice(0, 100)}`);
    }
    // gentle pacing
    await sleep(700 + Math.random() * 900);
  }
  todo = still;
  if (todo.length) await sleep(4000);
}

console.log(`\nremaining failures: ${todo.length}`);
if (todo.length) writeFileSync(join(OUT, 'chunk_failures.json'), JSON.stringify(todo, null, 2));
const finalHave = all.filter((n) => existsSync(join(ASSETS, n)) && readFileSync(join(ASSETS, n), 'utf8').length > 2000);
console.log(`final: ${finalHave.length}/${all.length}`);
s.close();
process.exit(0);
