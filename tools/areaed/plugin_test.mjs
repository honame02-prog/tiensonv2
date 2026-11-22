// Kiem plugin areaEditor (vite.config.js): thu tu recover -> phuc vu, recover loi -> 503, Host sai -> 403. Root tam + txn.mjs gia; khong ghi vao repo.
import assert from 'node:assert/strict';
import * as fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { EventEmitter } from 'node:events';
import { fileURLToPath, pathToFileURL } from 'node:url';

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const { areaEditor } = await import(pathToFileURL(path.join(repo, 'vite.config.js')).href);
const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'areaed-plugin-'));
let n = 0;
const PORT = 5999;

async function makeRoot(name) {
  const root = path.join(tmp, name);
  await fs.mkdir(path.join(root, 'tools/areaed'), { recursive: true });
  await fs.writeFile(path.join(root, 'tools/areaed/txn.mjs'),
    `export const recoverJournals = () => globalThis.__recoverImpl(); export const listBackups = async () => ['20250101-000000-000'];\n`);
  await fs.copyFile(path.join(repo, 'tools/areaed/srcio.mjs'), path.join(root, 'tools/areaed/srcio.mjs'));
  return root;
}
function boot(root) {
  const handlers = [], server = { config: { root }, middlewares: { use: (p, fn) => handlers.push([p, fn]) }, httpServer: { address: () => ({ port: PORT }) } };
  areaEditor().configureServer(server);
  return { server, call: (p, { host = `127.0.0.1:${PORT}`, method = 'GET', url = '/?id=x' } = {}) => {
    const fn = handlers.find(h => h[0] === p)[1];
    const req = Object.assign(new EventEmitter(), { headers: { host }, method, url });
    return new Promise(resolve => {
      const res = { statusCode: 200, headers: {}, setHeader(k, v) { this.headers[k] = v; }, end(b) { resolve({ done: true, status: this.statusCode, body: b ? JSON.parse(b) : null }); } };
      fn(req, res);
    });
  } };
}
const settled = async (p, ms = 150) => Promise.race([p, new Promise(r => setTimeout(() => r({ done: false }), ms))]);
const test = async (name, fn) => { await fn(); n++; console.log('ok', n, '-', name); };

try {
  await test('request during pending recover is held; resolved -> 200', async () => {
    const root = await makeRoot('a'); let release;
    globalThis.__recoverImpl = () => new Promise(r => { release = () => r([]); });
    const { server, call } = boot(root);
    const p = call('/__areaed/backups');
    assert.equal((await settled(p)).done, false, 'handler tra loi khi recover con treo');
    release();
    const r = await settled(p, 2000);
    assert.equal(r.done, true); assert.equal(r.status, 200); assert.deepEqual(r.body, { ok: true, list: ['20250101-000000-000'] });
    assert.equal((await call('/__areaed/backups')).status, 200);
    await server.areaedReady;
  });

  await test('recover rejects -> 503 code recover (pending and later requests), nothing served', async () => {
    const root = await makeRoot('b'); let fail;
    globalThis.__recoverImpl = () => new Promise((_, rej) => { fail = () => rej(new Error('journal hong')); });
    const { call } = boot(root);
    const p = call('/__areaed/backups');
    assert.equal((await settled(p)).done, false);
    fail();
    const r = await settled(p, 2000);
    assert.equal(r.status, 503); assert.equal(r.body.ok, false); assert.equal(r.body.code, 'recover'); assert.match(r.body.error, /journal hong/);
    const r2 = await call('/__areaed/backups'); assert.equal(r2.status, 503); assert.equal(r2.body.code, 'recover');
    const r3 = await call('/__areaed/src', { url: '/?id=x' }); assert.equal(r3.status, 503);
  });

  await test('wrong Host -> 403 (even before recover finishes)', async () => {
    const root = await makeRoot('c');
    globalThis.__recoverImpl = () => new Promise(() => {});
    const { call } = boot(root);
    for (const host of ['evil.example:' + PORT, `127.0.0.1:${PORT + 1}`, '127.0.0.1', `localhost.evil.com:${PORT}`]) {
      const r = await settled(call('/__areaed/backups', { host }), 1000);
      assert.equal(r.status, 403, host);
    }
  });

  console.log(`PLUGIN PASS (${n})`);
} finally {
  assert.ok(path.basename(tmp).startsWith('areaed-plugin-'));
  await fs.rm(tmp, { recursive: true, force: true });
}
