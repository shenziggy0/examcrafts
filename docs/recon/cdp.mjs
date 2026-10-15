// Minimal CDP client for driving the headless Chrome instance.
const PORT = 9333;
const BASE = `http://127.0.0.1:${PORT}`;

export async function listTargets() {
  const r = await fetch(`${BASE}/json/list`);
  return r.json();
}

export class Session {
  constructor(ws) {
    this.ws = ws;
    this.id = 0;
    this.pending = new Map();
    this.events = [];
    this.listeners = [];
    ws.addEventListener('message', (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.id !== undefined) {
        const p = this.pending.get(msg.id);
        if (p) {
          this.pending.delete(msg.id);
          msg.error ? p.reject(new Error(JSON.stringify(msg.error))) : p.resolve(msg.result);
        }
      } else {
        this.events.push(msg);
        for (const l of this.listeners) l(msg);
      }
    });
  }

  static async connect(wsUrl) {
    const ws = new WebSocket(wsUrl);
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
        if (this.pending.has(id)) {
          this.pending.delete(id);
          reject(new Error(`timeout: ${method}`));
        }
      }, 120000);
    });
  }

  on(fn) { this.listeners.push(fn); }

  async evaluate(expression) {
    const r = await this.send('Runtime.evaluate', {
      expression,
      awaitPromise: true,
      returnByValue: true,
      allowUnsafeEvalBlockedByCSP: true,
    });
    if (r.exceptionDetails) {
      throw new Error('eval failed: ' + JSON.stringify(r.exceptionDetails).slice(0, 600));
    }
    return r.result?.value;
  }

  close() { try { this.ws.close(); } catch {} }
}

export async function newPage() {
  const r = await fetch(`${BASE}/json/new?about:blank`, { method: 'PUT' });
  if (!r.ok) {
    // Older Chrome uses GET
    const r2 = await fetch(`${BASE}/json/new?about:blank`);
    return r2.json();
  }
  return r.json();
}

export const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Safari/537.36';
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
