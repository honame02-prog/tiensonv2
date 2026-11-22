// Node-only transactions. The lock covers reads, baking, backup and commit.
import * as fs from 'node:fs/promises';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';

const queues = new Map();
const idPattern = /^[a-z0-9-]+$/;
const backupPattern = /^\d{8}-\d{6}-\d{3}$/;
const pngSignature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
const sha = data => createHash('sha256').update(data).digest('hex');
const message = error => error instanceof Error ? error.message : String(error);

// Fault injection at the actual replacement boundary; unused by normal callers.
export const __testOnly = { beforeReplace: null };

class TxnError extends Error {
  constructor(code, error, extra = {}) {
    super(error);
    this.code = code;
    Object.assign(this, extra);
  }
}

function validId(id) {
  if (typeof id !== 'string' || !idPattern.test(id)) throw new TxnError('invalid', 'Invalid area id');
}

function inside(base, target) {
  const rel = path.relative(base, target);
  if (rel === '..' || rel.startsWith(`..${path.sep}`) || path.isAbsolute(rel)) {
    throw new TxnError('invalid', `Path outside ${base}`);
  }
  return target;
}

// Check existing ancestors too: a symlink in public/, .bak/ or .staging/ must
// never redirect a transaction outside its root, including when creating files.
async function safe(root, target) {
  inside(root, target);
  let ancestor = target;
  for (;;) {
    try {
      inside(root, await fs.realpath(ancestor));
      return target;
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
      const parent = path.dirname(ancestor);
      if (parent === ancestor) throw error;
      ancestor = parent;
    }
  }
}

async function context(root, id) {
  const areas = inside(root, path.resolve(root, 'tools/areas'));
  const src = inside(areas, path.resolve(areas, `${id}.src.json`));
  const staging = path.join(areas, '.staging');
  const ctx = { root, id, areas, staging,
    stagedSrc: path.join(staging, `${id}.src.json`),
    out: path.join(staging, `${id}-out`),
    journal: path.join(staging, `${id}.journal.json`),
    backups: path.join(areas, '.bak', id),
    targets: [src, path.join(root, 'public/assets/areas', id, 'area.json'),
      path.join(root, 'public/assets/areas', id, 'ground.png')],
    names: [`${id}.src.json`, 'area.json', 'ground.png'] };
  for (const target of [...ctx.targets, staging, ctx.backups, ctx.out, ctx.stagedSrc, ctx.journal]) await safe(root, target);
  return ctx;
}

async function locked(root, id, action) {
  validId(id);
  root = await fs.realpath(path.resolve(root));
  const key = process.platform === 'win32' ? `${root}/${id}`.toLowerCase() : `${root}/${id}`;
  const previous = queues.get(key) || Promise.resolve();
  const running = previous.catch(() => {}).then(async () => action(await context(root, id)));
  queues.set(key, running);
  try { return await running; }
  finally { if (queues.get(key) === running) queues.delete(key); }
}

async function exists(file) {
  try { await fs.access(file); return true; }
  catch (error) { if (error.code === 'ENOENT') return false; throw error; }
}

async function syncDir(dir) {
  let handle;
  try { handle = await fs.open(dir, 'r'); await handle.sync(); }
  catch (error) {
    // Windows does not support opening/syncing directory handles this way.
    if (process.platform !== 'win32' || !['EPERM', 'EACCES', 'EINVAL', 'EISDIR', 'EBADF'].includes(error.code)) throw error;
  } finally { await handle?.close(); }
}

async function atomicReplace(ctx, target, data, phase, index) {
  await safe(ctx.root, target);
  await __testOnly.beforeReplace?.({ root: ctx.root, id: ctx.id, target, phase, index });
  await fs.mkdir(path.dirname(target), { recursive: true });
  const tmp = `${target}.${randomUUID()}.tmp`;
  let handle;
  try {
    handle = await fs.open(tmp, 'wx');
    await handle.writeFile(data);
    await handle.sync();
    await handle.close(); handle = null;
    for (let attempt = 0; ; attempt++) {
      try { await fs.rename(tmp, target); break; }
      catch (error) {
        if (!['EPERM', 'EBUSY', 'EACCES'].includes(error.code) || attempt >= 9) throw error;
        await delay(100);
      }
    }
    await syncDir(path.dirname(target));
  } finally {
    await handle?.close();
    await fs.rm(tmp, { force: true });
  }
}

async function readTriple(ctx) { return Promise.all(ctx.targets.map(file => fs.readFile(file))); }

async function assertUnchanged(ctx, expected) {
  const current = await readTriple(ctx);
  if (current.some((data, i) => sha(data) !== sha(expected[i]))) {
    throw new TxnError('conflict', 'Files changed on disk during transaction', { diskText: current[0].toString('utf8') });
  }
}

const crcTable = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
function crc32(buf) { let c = 0xffffffff; for (const b of buf) c = crcTable[(c ^ b) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; }
// Walk every PNG chunk to IEND and verify each CRC; the file must end exactly at IEND.
function checkPng(buf) {
  if (!buf.subarray(0, 8).equals(pngSignature)) throw new Error('Invalid PNG signature');
  let pos = 8, first = true;
  for (;;) {
    if (pos + 12 > buf.length) throw new Error('Truncated PNG');
    const len = buf.readUInt32BE(pos), type = buf.toString('latin1', pos + 4, pos + 8), end = pos + 12 + len;
    if (end > buf.length) throw new Error('Truncated PNG chunk');
    if (first && type !== 'IHDR') throw new Error('PNG must start with IHDR');
    first = false;
    if (crc32(buf.subarray(pos + 4, pos + 8 + len)) !== buf.readUInt32BE(pos + 8 + len)) throw new Error('PNG CRC mismatch in ' + type);
    pos = end;
    if (type === 'IEND') { if (pos !== buf.length) throw new Error('Data after IEND'); return; }
  }
}

function checkTriple(id, data) {
  try {
    if (JSON.parse(data[0].toString('utf8'))?.area?.id !== id) throw new Error('Source id mismatch');
    if (JSON.parse(data[1].toString('utf8'))?.id !== id) throw new Error('Baked area id mismatch');
    checkPng(data[2]);
  } catch (error) { throw new TxnError('invalid', message(error)); }
}

async function backup(ctx, data) {
  await fs.mkdir(ctx.backups, { recursive: true });
  let dir, stamp = Date.now();
  for (;;) {
    const iso = new Date(stamp++).toISOString();
    const name = iso.slice(0, 10).replaceAll('-', '') + '-' + iso.slice(11, 19).replaceAll(':', '') + '-' + iso.slice(20, 23);
    dir = path.join(ctx.backups, name);
    try { await fs.mkdir(dir); break; }
    catch (error) { if (error.code !== 'EEXIST') throw error; }
  }
  // A backup becomes visible to listBackups only once all three files exist.
  try {
    for (let i = 0; i < data.length; i++) await atomicReplace(ctx, path.join(dir, ctx.names[i]), data[i], 'backup', i);
    await syncDir(ctx.backups);
  } catch (error) {
    await fs.rm(await safe(ctx.root, dir), { recursive: true, force: true });
    throw error;
  }
  return dir;
}

async function backupNames(ctx) {
  let entries;
  try { entries = await fs.readdir(ctx.backups, { withFileTypes: true }); }
  catch (error) { if (error.code === 'ENOENT') return []; throw error; }
  const names = [];
  for (const entry of entries) {
    if (!entry.isDirectory() || !backupPattern.test(entry.name)) continue;
    const dir = path.join(ctx.backups, entry.name);
    if ((await Promise.all(ctx.names.map(name => exists(path.join(dir, name))))).every(Boolean)) names.push(entry.name);
  }
  return names.sort().reverse();
}

async function prune(ctx, keep) {
  for (const name of (await backupNames(ctx)).slice(keep)) {
    const dir = await safe(ctx.root, path.join(ctx.backups, name));
    await fs.rm(dir, { recursive: true });
  }
}

async function cleanStaging(ctx) {
  await fs.rm(ctx.stagedSrc, { force: true });
  await fs.rm(ctx.out, { recursive: true, force: true });
}

// Journal paths are root-relative. Validate all of them before reading backups
// or writing anything; recovery must not turn a corrupt journal into data loss.
async function journalData(ctx, journal) {
  if (!journal || !Array.isArray(journal.files) || journal.files.length !== 3 || typeof journal.backupDir !== 'string') throw new Error('Invalid journal');
  const backupDir = path.resolve(ctx.root, journal.backupDir);
  if (path.dirname(backupDir) !== ctx.backups || !backupPattern.test(path.basename(backupDir))) throw new Error('Invalid journal backup directory');
  await safe(ctx.root, backupDir);
  const data = [];
  for (let i = 0; i < 3; i++) {
    const file = journal.files[i];
    if (!file || path.resolve(ctx.root, file.path) !== ctx.targets[i] || file.backup !== ctx.names[i] ||
        !/^[a-f0-9]{64}$/.test(file.oldHash) || !/^[a-f0-9]{64}$/.test(file.newHash)) throw new Error('Invalid journal file');
    const backupFile = await safe(ctx.root, path.join(backupDir, file.backup));
    const bytes = await fs.readFile(backupFile);
    if (sha(bytes) !== file.oldHash) throw new Error(`Backup hash mismatch: ${file.backup}`);
    data.push(bytes);
  }
  return data;
}

async function rollback(ctx, journal) {
  const old = await journalData(ctx, journal);
  // Preflight the whole triple, then check again at each replacement. Preserve
  // the journal on conflict so an operator can resolve the external edit.
  const check = async i => {
    const hash = sha(await fs.readFile(ctx.targets[i]));
    const file = journal.files[i];
    if (hash !== file.oldHash && hash !== file.newHash) throw new Error(`Recovery conflict: ${ctx.targets[i]}`);
    return hash;
  };
  for (let i = 0; i < 3; i++) await check(i);
  for (let i = 0; i < 3; i++) if (await check(i) !== journal.files[i].oldHash) await atomicReplace(ctx, ctx.targets[i], old[i], 'rollback', i);
  await cleanStaging(ctx);
  await fs.unlink(ctx.journal);
  await syncDir(ctx.staging);
}

async function commit(ctx, old, next, keep) {
  await assertUnchanged(ctx, old);
  const backupDir = await backup(ctx, old);
  const journal = { backupDir: path.relative(ctx.root, backupDir), files: ctx.targets.map((target, i) => ({
    path: path.relative(ctx.root, target), backup: ctx.names[i], oldHash: sha(old[i]), newHash: sha(next[i]) })) };
  await atomicReplace(ctx, ctx.journal, JSON.stringify(journal), 'journal', -1);
  try {
    // Recheck all files after backup/journaling (not just the source).
    await assertUnchanged(ctx, old);
    for (let i = 0; i < 3; i++) {
      if (sha(await fs.readFile(ctx.targets[i])) !== journal.files[i].oldHash) throw new Error(`File changed before commit: ${ctx.targets[i]}`);
      await atomicReplace(ctx, ctx.targets[i], next[i], 'commit', i);
    }
    await cleanStaging(ctx);
    await fs.unlink(ctx.journal);
    await syncDir(ctx.staging);
  } catch (error) {
    try { await rollback(ctx, journal); }
    catch (recoveryError) { throw new TxnError('io', `${message(error)}; rollback failed (journal retained): ${message(recoveryError)}`); }
    throw new TxnError('io', message(error));
  }
  await prune(ctx, keep);
}

async function bake(ctx, timeout) {
  return new Promise((resolve, reject) => {
    let log = '', timedOut = false;
    const child = spawn(process.execPath, [path.join(ctx.root, 'tools/area_bake.mjs'), ctx.stagedSrc, '--out', ctx.out],
      { cwd: ctx.root, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
    const append = chunk => { log = (log + chunk.toString()).slice(-1024 * 1024); };
    child.stdout.on('data', append); child.stderr.on('data', append);
    const timer = setTimeout(() => { timedOut = true; child.kill('SIGKILL'); }, timeout);
    child.once('error', error => { clearTimeout(timer); reject(new TxnError('bake', message(error), { bakeLog: log })); });
    child.once('close', (code, signal) => {
      clearTimeout(timer);
      if (timedOut || code !== 0) reject(new TxnError('bake', timedOut ? `Bake timed out after ${timeout} ms` : `Bake exited ${code ?? signal}`, { bakeLog: log }));
      else resolve(log);
    });
  });
}

function failure(error) {
  const result = { ok: false, code: error instanceof TxnError ? error.code : 'io', error: message(error) };
  for (const key of ['diskText', 'bakeLog']) if (error[key] !== undefined) result[key] = error[key];
  return result;
}

export async function saveArea({ root, id, baseHash, newText, bakeTimeoutMs = 120000, keepBackups = 30 } = {}) {
  const start = Date.now();
  let bakeLog;
  try {
    return await locked(root, id, async ctx => {
      // A pending journal must be recovered explicitly before a fresh save.
      if (await exists(ctx.journal)) throw new Error('Pending journal; run recoverJournals first');
      const source = await fs.readFile(ctx.targets[0]);
      if (sha(source) !== baseHash) return { ok: false, code: 'conflict', error: 'Source changed on disk', diskText: source.toString('utf8') };
      try {
        if (typeof newText !== 'string' || JSON.parse(newText)?.area?.id !== id) throw new Error('Source area.id must match id');
        if (!Number.isInteger(keepBackups) || keepBackups < 0 || !Number.isInteger(bakeTimeoutMs) || bakeTimeoutMs <= 0 || bakeTimeoutMs > 2147483647) throw new Error('Invalid backup count or bake timeout');
      } catch (error) { throw new TxnError('invalid', message(error)); }
      const old = [source, ...await Promise.all(ctx.targets.slice(1).map(file => fs.readFile(file)))];
      await fs.mkdir(ctx.staging, { recursive: true });
      try {
        await cleanStaging(ctx);
        await atomicReplace(ctx, ctx.stagedSrc, newText, 'staging', -1);
        bakeLog = await bake(ctx, bakeTimeoutMs);
        let next;
        try {
          next = [Buffer.from(newText), await fs.readFile(path.join(ctx.out, 'area.json')), await fs.readFile(path.join(ctx.out, 'ground.png'))];
          checkTriple(id, next);
        } catch (error) { throw new TxnError('bake', `Invalid bake output: ${message(error)}`, { bakeLog }); }
        await commit(ctx, old, next, keepBackups);
        return { ok: true, hash: sha(next[0]), ms: Date.now() - start, bakeLog };
      } finally {
        // Keep evidence intact if rollback itself could not finish.
        if (!await exists(ctx.journal)) await cleanStaging(ctx);
      }
    });
  } catch (error) {
    const result = failure(error);
    if (bakeLog !== undefined && result.bakeLog === undefined) result.bakeLog = bakeLog;
    return result;
  }
}

// Names are newest first and can be passed directly to restoreBackup.
export async function listBackups(root, id) {
  return locked(root, id, ctx => backupNames(ctx));
}

// Restoring uses the saved triple verbatim; it does not rebake historical data.
// It creates a fresh backup of the current triple and retains the default 30.
export async function restoreBackup(root, id, name, { baseHash } = {}) {
  const start = Date.now();
  try {
    return await locked(root, id, async ctx => {
      if (typeof name !== 'string' || !backupPattern.test(name)) throw new TxnError('invalid', 'Invalid backup name');
      if (await exists(ctx.journal)) throw new Error('Pending journal; run recoverJournals first');
      const dir = await safe(ctx.root, path.join(ctx.backups, name));
      const next = await Promise.all(ctx.names.map(async file => fs.readFile(await safe(ctx.root, path.join(dir, file)))));
      checkTriple(id, next);
      const old = await readTriple(ctx);
      if (typeof baseHash !== 'string') throw new TxnError('invalid', 'Missing baseHash');
      if (sha(old[0]) !== baseHash) return { ok: false, code: 'conflict', error: 'Source changed on disk', diskText: old[0].toString('utf8') };
      await fs.mkdir(ctx.staging, { recursive: true });
      await commit(ctx, old, next, 30);
      return { ok: true, hash: sha(next[0]), ms: Date.now() - start, bakeLog: '' };
    });
  } catch (error) { return failure(error); }
}

// Returns recovered area ids. On corrupt backups or external edits, throws and
// preserves that journal instead of silently overwriting or discarding it.
export async function recoverJournals(root) {
  root = await fs.realpath(path.resolve(root));
  const staging = await safe(root, path.join(root, 'tools/areas/.staging'));
  let entries;
  try { entries = await fs.readdir(staging); }
  catch (error) { if (error.code === 'ENOENT') return []; throw error; }
  const recovered = [];
  for (const name of entries.sort()) {
    if (!name.endsWith('.journal.json')) continue;
    const id = name.slice(0, -'.journal.json'.length);
    await locked(root, id, async ctx => {
      if (!await exists(ctx.journal)) return;
      const journal = JSON.parse(await fs.readFile(ctx.journal, 'utf8'));
      await rollback(ctx, journal);
      recovered.push(id);
    });
  }
  return recovered;
}
