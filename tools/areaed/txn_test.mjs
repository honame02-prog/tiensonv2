import assert from 'node:assert/strict';
import * as fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import { saveArea, listBackups, restoreBackup, recoverJournals, __testOnly } from './txn.mjs';

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'areaed-txn-'));
const hash = data => createHash('sha256').update(data).digest('hex');
const md5 = data => createHash('md5').update(data).digest('hex');
const id = 'txn-small';
let cases = 0;

async function put(root, file, data) {
  const target = path.join(root, file);
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, data);
}

async function copy(root, file) {
  const target = path.join(root, file);
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.copyFile(path.join(repo, file), target);
}

function paths(root) {
  return [`tools/areas/${id}.src.json`, `public/assets/areas/${id}/area.json`, `public/assets/areas/${id}/ground.png`]
    .map(file => path.join(root, file));
}
async function triple(root) { return Promise.all(paths(root).map(file => fs.readFile(file))); }
async function unchanged(root, old) { assert.deepEqual(await triple(root), old); }
async function missing(file) { await assert.rejects(fs.access(file), { code: 'ENOENT' }); }
const journalPath = root => path.join(root, `tools/areas/.staging/${id}.journal.json`);
async function clean(root) {
  await missing(journalPath(root));
  await missing(path.join(root, `tools/areas/.staging/${id}.src.json`));
  await missing(path.join(root, `tools/areas/.staging/${id}-out`));
}
async function changed(root, label) {
  const src = JSON.parse(await fs.readFile(paths(root)[0], 'utf8'));
  src.area.name = label;
  src.pieces[0].x++;
  src.bake.regions[0].material = src.bake.regions[0].material === 'c_58544f' ? 'c_716b62' : 'c_58544f';
  return JSON.stringify(src) + '\n';
}
async function save(root, text, options = {}) {
  return saveArea({ root, id, baseHash: hash(await fs.readFile(paths(root)[0])), newText: text, ...options });
}
const curHash = async root => hash(await fs.readFile(paths(root)[0]));
function ok(result) { assert.equal(result.ok, true, JSON.stringify(result)); return result; }
async function runBake(root) {
  await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ['tools/area_bake.mjs', `tools/areas/${id}.src.json`], { cwd: root, windowsHide: true });
    let log = '';
    const timer = setTimeout(() => child.kill('SIGKILL'), 30000);
    child.stdout.on('data', chunk => { log += chunk; });
    child.stderr.on('data', chunk => { log += chunk; });
    child.once('error', error => { clearTimeout(timer); reject(error); });
    child.once('close', code => { clearTimeout(timer); code === 0 ? resolve() : reject(new Error(log)); });
  });
}

async function fixture(label) {
  const root = path.join(tmp, label);
  const files = ['tools/area_bake.mjs', 'tools/png.mjs', 'tools/area_common.mjs', 'src/areaKits.js',
    'tools/area_materials.json', 'tools/areas/blockout-materials.json', 'public/assets/sect/ground_bake.png'];
  await Promise.all(files.map(file => copy(root, file)));
  await fs.cp(path.join(repo, 'public/assets/kits/HVQ-existing'), path.join(root, 'public/assets/kits/HVQ-existing'), { recursive: true });
  await put(root, 'package.json', '{"type":"module"}\n');
  // Keep the real source's area metadata; a flat 320x320 bake needs no terrain
  // atlas. Both placement resolution and baking still use the real modules.
  const src = JSON.parse(await fs.readFile(path.join(repo, 'tools/areas/son-dao.src.json'), 'utf8'));
  src.area.id = id;
  src.materials = 'tools/areas/blockout-materials.json';
  src.kits = { 'HVQ-existing': 'assets/kits/HVQ-existing/kit.json' };
  src.pieces = [{ k: 'HVQ-existing/tamthanh', x: 150, y: 150 }];
  src.bake = { width: 320, height: 320, seed: 20, regions: [{ fill: true, material: 'c_58544f' }] };
  await put(root, `tools/areas/${id}.src.json`, JSON.stringify(src) + '\n');
  await runBake(root);
  return root;
}

async function test(name, action) {
  __testOnly.beforeReplace = null;
  await action();
  __testOnly.beforeReplace = null;
  cases++;
  console.log(`ok ${cases} - ${name}`);
}

try {
  const root = await fixture('main');
  await test('successful save, complete backup, exact hash and reproducible bake', async () => {
    const old = await triple(root), newText = await changed(root, 'Luu thanh cong');
    const result = ok(await save(root, newText));
    assert.equal(result.hash, hash(Buffer.from(newText)));
    assert.ok(result.ms >= 0);
    assert.match(result.bakeLog, /bake txn-small: 320x320/);
    const next = await triple(root);
    assert.equal(next[0].toString(), newText);
    assert.notDeepEqual(next[1], old[1]); assert.notDeepEqual(next[2], old[2]);
    const names = await listBackups(root, id);
    assert.equal(names.length, 1);
    const dir = path.join(root, 'tools/areas/.bak', id, names[0]);
    assert.deepEqual((await fs.readdir(dir)).sort(), [`${id}.src.json`, 'area.json', 'ground.png'].sort());
    assert.deepEqual(await Promise.all([`${id}.src.json`, 'area.json', 'ground.png'].map(file => fs.readFile(path.join(dir, file)))), old);
    ok(await save(root, newText));
    assert.deepEqual((await triple(root)).slice(1).map(md5), next.slice(1).map(md5));
    await clean(root);
  });

  await test('conflict returns current disk text and changes no file', async () => {
    const baseHash = hash(await fs.readFile(paths(root)[0]));
    const text = await changed(root, 'External edit');
    await fs.writeFile(paths(root)[0], text);
    const old = await triple(root), count = (await listBackups(root, id)).length;
    const result = await saveArea({ root, id, baseHash, newText: await changed(root, 'Rejected') });
    assert.equal(result.code, 'conflict'); assert.equal(result.diskText, text);
    await unchanged(root, old);
    assert.equal((await listBackups(root, id)).length, count);
  });

  await test('unknown kit fails real bake without changing the three live files', async () => {
    const old = await triple(root), src = JSON.parse(await changed(root, 'Bad kit'));
    src.pieces = [{ k: 'MISSING/no-such-piece', x: 10, y: 20 }];
    const result = await save(root, JSON.stringify(src));
    assert.equal(result.code, 'bake'); assert.match(result.bakeLog, /Unknown kit piece/);
    await unchanged(root, old); await clean(root);
  });

  await test('two simultaneous saves with one base hash produce one success and one conflict', async () => {
    const baseHash = hash(await fs.readFile(paths(root)[0]));
    const results = await Promise.all(['Concurrent A', 'Concurrent B'].map(async label =>
      saveArea({ root, id, baseHash, newText: await changed(root, label) })));
    assert.equal(results.filter(result => result.ok).length, 1);
    assert.equal(results.filter(result => result.code === 'conflict').length, 1);
    assert.equal(results.find(result => result.code === 'conflict').diskText, (await fs.readFile(paths(root)[0], 'utf8')));
    await clean(root);
  });

  await test('failure at second atomic replacement restores all original bytes', async () => {
    const old = await triple(root);
    __testOnly.beforeReplace = ({ phase, index }) => { if (phase === 'commit' && index === 1) throw new Error('Injected second replacement failure'); };
    const result = await save(root, await changed(root, 'Fail second file'));
    assert.equal(result.code, 'io'); assert.match(result.error, /Injected second/);
    await unchanged(root, old); await clean(root);
    __testOnly.beforeReplace = null;
    ok(await save(root, await changed(root, 'Queue remains usable')));
  });

  await test('pending journal survives interrupted rollback and recovers on startup', async () => {
    const old = await triple(root);
    __testOnly.beforeReplace = ({ phase, index }) => {
      if (phase === 'commit' && index === 1 || phase === 'rollback') throw new Error('Simulated interruption');
    };
    const result = await save(root, await changed(root, 'Interrupted'));
    assert.equal(result.code, 'io'); assert.match(result.error, /journal retained/);
    const journal = JSON.parse(await fs.readFile(journalPath(root), 'utf8'));
    assert.equal(journal.files.length, 3);
    assert.notDeepEqual((await triple(root))[0], old[0]);
    __testOnly.beforeReplace = null;
    assert.deepEqual(await recoverJournals(root), [id]);
    await unchanged(root, old); await clean(root);
    assert.deepEqual(await recoverJournals(root), []);
  });

  await test('backup rotation retains exactly keepBackups newest snapshots', async () => {
    for (let i = 0; i < 4; i++) ok(await save(root, await changed(root, `Rotation ${i}`), { keepBackups: 2 }));
    const names = await listBackups(root, id);
    assert.equal(names.length, 2);
    assert.deepEqual(names, names.slice().sort().reverse());
    assert.equal((await fs.readdir(path.join(root, 'tools/areas/.bak', id))).length, 2);
  });

  await test('invalid ids, mismatched JSON id and malformed JSON fail without writes', async () => {
    const old = await triple(root);
    for (const badId of ['../x', 'A', '', 'a/b', 'a\\b']) {
      const result = await saveArea({ root, id: badId, baseHash: hash(old[0]), newText: old[0].toString() });
      assert.equal(result.code, 'invalid', badId);
    }
    for (const text of ['{', 'null', '{}', '{"area":{"id":"different"}}']) assert.equal((await save(root, text)).code, 'invalid');
    assert.equal((await save(root, old[0].toString(), { keepBackups: -1 })).code, 'invalid');
    assert.equal((await save(root, old[0].toString(), { bakeTimeoutMs: 0 })).code, 'invalid');
    await unchanged(root, old);
  });

  await test('restoreBackup restores the saved triple and backs up the replaced state', async () => {
    const names = await listBackups(root, id), name = names.at(-1);
    const dir = path.join(root, 'tools/areas/.bak', id, name);
    const expected = await Promise.all([`${id}.src.json`, 'area.json', 'ground.png'].map(file => fs.readFile(path.join(dir, file))));
    const old = await triple(root), result = ok(await restoreBackup(root, id, name, { baseHash: await curHash(root) }));
    assert.equal(result.hash, hash(expected[0]));
    await unchanged(root, expected);
    const latest = (await listBackups(root, id))[0];
    assert.deepEqual(await Promise.all([`${id}.src.json`, 'area.json', 'ground.png'].map(file => fs.readFile(path.join(root, 'tools/areas/.bak', id, latest, file)))), old);
    assert.equal((await restoreBackup(root, id, '../escape', { baseHash: await curHash(root) })).code, 'invalid');
    await clean(root);
  });

  await test('restore uses the same rollback path on replacement failure', async () => {
    const name = (await listBackups(root, id)).at(-1), old = await triple(root);
    __testOnly.beforeReplace = ({ phase, index }) => { if (phase === 'commit' && index === 1) throw new Error('Restore failure'); };
    assert.equal((await restoreBackup(root, id, name, { baseHash: await curHash(root) })).code, 'io');
    await unchanged(root, old); await clean(root);
  });

  await test('restore conflicts on stale or missing baseHash and writes nothing', async () => {
    const name = (await listBackups(root, id)).at(-1), old = await triple(root), before = await listBackups(root, id);
    const r = await restoreBackup(root, id, name, { baseHash: hash('stale') });
    assert.equal(r.ok, false); assert.equal(r.code, 'conflict');
    assert.equal((await restoreBackup(root, id, name)).code, 'invalid');
    await unchanged(root, old); await clean(root);
    assert.deepEqual(await listBackups(root, id), before);
  });

  await test('restore rejects truncated / signature-only / corrupt ground.png backups', async () => {
    const latest = (await listBackups(root, id))[0], src = path.join(root, 'tools/areas/.bak', id, latest), old = await triple(root);
    const png = await fs.readFile(path.join(src, 'ground.png'));
    const flipped = Buffer.from(png); flipped[Math.floor(png.length / 2)] ^= 0xff;
    const variants = { '20990101-000000-001': png.subarray(0, 8), '20990101-000000-002': png.subarray(0, png.length - 20), '20990101-000000-003': flipped, '20990101-000000-004': Buffer.concat([png, Buffer.from('x')]) };
    for (const [name, bytes] of Object.entries(variants)) {
      const dir = path.join(root, 'tools/areas/.bak', id, name);
      await fs.mkdir(dir, { recursive: true });
      for (const f of [`${id}.src.json`, 'area.json']) await fs.copyFile(path.join(src, f), path.join(dir, f));
      await fs.writeFile(path.join(dir, 'ground.png'), bytes);
      const r = await restoreBackup(root, id, name, { baseHash: await curHash(root) });
      assert.equal(r.ok, false, name); assert.equal(r.code, 'invalid', name);
      await unchanged(root, old); await clean(root);
      await fs.rm(dir, { recursive: true, force: true });
    }
  });

  await test('recovery refuses an external edit and preserves journal plus all disk bytes', async () => {
    const old = await triple(root), text = await changed(root, 'Before recovery conflict');
    __testOnly.beforeReplace = ({ phase, index }) => {
      if (phase === 'commit' && index === 1 || phase === 'rollback') throw new Error('Interrupt for conflict');
    };
    assert.equal((await save(root, text)).code, 'io');
    __testOnly.beforeReplace = null;
    await fs.writeFile(paths(root)[1], 'External output change');
    const external = await triple(root);
    await assert.rejects(recoverJournals(root), /Recovery conflict/);
    await unchanged(root, external);
    await fs.access(journalPath(root));
    await fs.writeFile(paths(root)[1], old[1]);
    assert.deepEqual(await recoverJournals(root), [id]);
    await unchanged(root, old);
  });

  await test('source changed while baking is rejected before commit', async () => {
    const old = await triple(root);
    const external = Buffer.from((await changed(root, 'External during bake')));
    __testOnly.beforeReplace = async ({ phase }) => { if (phase === 'staging') await fs.writeFile(paths(root)[0], external); };
    const result = await save(root, await changed(root, 'Stale bake'));
    assert.equal(result.code, 'conflict');
    assert.equal(result.diskText, external.toString());
    await unchanged(root, [external, old[1], old[2]]); await clean(root);
  });

  await test('timeout terminates baker before returning and preserves all live bytes', async () => {
    const timeoutRoot = await fixture('timeout'), old = await triple(timeoutRoot);
    await put(timeoutRoot, 'tools/area_bake.mjs', "console.log('waiting'); setInterval(() => {}, 1000);\n");
    const start = Date.now();
    const result = await save(timeoutRoot, await changed(timeoutRoot, 'Timed out'), { bakeTimeoutMs: 100 });
    assert.equal(result.code, 'bake'); assert.match(result.error, /timed out/);
    assert.ok(Date.now() - start < 5000);
    await unchanged(timeoutRoot, old); await clean(timeoutRoot);
  });

  await test('missing, malformed and wrong-id outputs or bad PNG are rejected', async () => {
    const badRoot = await fixture('bad-output'), old = await triple(badRoot);
    const prefix = "import * as fs from 'node:fs'; const out=process.argv[process.argv.indexOf('--out')+1]; fs.mkdirSync(out,{recursive:true});\n";
    for (const [area, png] of [[null, null], ['{', old[2]], ['{"id":"wrong"}', old[2]], [`{"id":"${id}"}`, Buffer.from('not png')]]) {
      let script = prefix;
      if (area !== null) script += `fs.writeFileSync(out+'/area.json',${JSON.stringify(area)});\n`;
      if (png !== null) script += `fs.writeFileSync(out+'/ground.png',Buffer.from('${png.toString('base64')}','base64'));\n`;
      await put(badRoot, 'tools/area_bake.mjs', script);
      assert.equal((await save(badRoot, await changed(badRoot, 'Invalid output'))).code, 'bake');
      await unchanged(badRoot, old); await clean(badRoot);
    }
  });

  await test('zero retention, empty backup listing and missing staging are supported', async () => {
    const fresh = await fixture('fresh');
    assert.deepEqual(await listBackups(fresh, id), []);
    assert.deepEqual(await recoverJournals(fresh), []);
    ok(await save(fresh, await changed(fresh, 'No retained backups'), { keepBackups: 0 }));
    assert.deepEqual(await listBackups(fresh, id), []);
    await clean(fresh);
  });

  await test('first and third replacement failures roll back the entire triple', async () => {
    for (const failIndex of [0, 2]) {
      const old = await triple(root);
      __testOnly.beforeReplace = ({ phase, index }) => {
        if (phase === 'commit' && index === failIndex) throw new Error(`Commit failure ${failIndex}`);
      };
      assert.equal((await save(root, await changed(root, `Fail index ${failIndex}`))).code, 'io');
      await unchanged(root, old); await clean(root);
    }
  });

  await test('partial backup failure leaves live bytes unchanged and no incomplete backup directory', async () => {
    const old = await triple(root), before = (await fs.readdir(path.join(root, 'tools/areas/.bak', id))).sort();
    __testOnly.beforeReplace = ({ phase, index }) => { if (phase === 'backup' && index === 1) throw new Error('Backup copy failure'); };
    const result = await save(root, await changed(root, 'Failed backup'));
    assert.equal(result.code, 'io'); assert.match(result.error, /Backup copy failure/);
    await unchanged(root, old); await clean(root);
    assert.deepEqual((await fs.readdir(path.join(root, 'tools/areas/.bak', id))).sort(), before);
  });

  await test('corrupt backup and journal traversal are rejected before any recovery writes', async () => {
    const old = await triple(root);
    __testOnly.beforeReplace = ({ phase, index }) => {
      if (phase === 'commit' && index === 1 || phase === 'rollback') throw new Error('Interrupt for tamper checks');
    };
    assert.equal((await save(root, await changed(root, 'Pending tamper checks'))).code, 'io');
    __testOnly.beforeReplace = null;
    const journalText = await fs.readFile(journalPath(root), 'utf8'), journal = JSON.parse(journalText);
    const pending = await triple(root), backupFile = path.resolve(root, journal.backupDir, 'ground.png');
    const backupBytes = await fs.readFile(backupFile);
    await fs.writeFile(backupFile, 'Corrupt backup');
    await assert.rejects(recoverJournals(root), /Backup hash mismatch/);
    await unchanged(root, pending);
    await fs.writeFile(backupFile, backupBytes);
    journal.files[0].path = '../outside.src.json';
    await fs.writeFile(journalPath(root), JSON.stringify(journal));
    await assert.rejects(recoverJournals(root), /Invalid journal file/);
    await unchanged(root, pending);
    await fs.writeFile(journalPath(root), journalText);
    assert.deepEqual(await recoverJournals(root), [id]);
    await unchanged(root, old); await clean(root);
  });

  console.log(`TXN PASS (${cases} cases; real 320x320 bake; temporary roots only)`);
} finally {
  __testOnly.beforeReplace = null;
  // Only this run's verified temporary project is removed; never touch repo data.
  assert.ok(path.basename(tmp).startsWith('areaed-txn-'));
  assert.equal(path.dirname(tmp), os.tmpdir());
  await fs.rm(tmp, { recursive: true, force: true });
}
