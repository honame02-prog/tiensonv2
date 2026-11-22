// E2E Area Editor: dung ban sao repo trong thu muc tam, chay vite VOI vite.config.js (co plugin areaEditor) o cong 5190, dieu khien bang Playwright + window.__areaed.
// --part=1|2|3: chia luot (moi luot < 60 s; bake HVQ 18-45 s/lan), dung chung ban sao tam co dinh; khong co --part: chay het.
// Khong ghi gi vao tools/areas/ hay public/assets/areas/ cua repo that. Chay: node tools/editor_test.mjs
import assert from 'node:assert/strict';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync, symlinkSync, realpathSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { chromium, packagePath } from './area_tool_runtime.mjs';

const ID = 'huyen-van-quan-v2', PORT = 5190;
let checks = 0;
const check = (name, ok, extra = '') => { assert.ok(ok, name + ' ' + extra); checks++; console.log(`OK ${checks} ${name}${extra ? ' ' + extra : ''}`); };

// ---------- ban sao repo tam
const partArg = process.argv.find(a => a.startsWith('--part='))?.slice(7), PART = partArg ? +partArg : 0, run = n => !PART || PART === n, LAST = !PART || PART === 3;
const repo = resolve('.'), tmp = PART ? join(tmpdir(), 'areaed-e2e-part') : mkdtempSync(join(tmpdir(), 'areaed-e2e-'));
if (PART <= 1) {
  rmSync(tmp, { recursive: true, force: true }); mkdirSync(tmp, { recursive: true });
  for (const d of ['src', 'public', 'tools']) cpSync(join(repo, d), join(tmp, d), { recursive: true });
  for (const f of ['index.html', 'vite.config.js', 'package.json']) cpSync(join(repo, f), join(tmp, f));
  symlinkSync(realpathSync(join(repo, 'node_modules')), join(tmp, 'node_modules'), 'junction');
  cpSync(join(tmp, 'tools/areas/huyen-van-quan-v2.src.json'), join(tmp, 'original.src.json'));
}
const srcPath = join(tmp, `tools/areas/${ID}.src.json`), areaPath = join(tmp, `public/assets/areas/${ID}/area.json`);
const original = readFileSync(join(tmp, 'original.src.json'), 'utf8');
console.log('ban sao tam:', tmp);

let server, browser;
const cleanup = async () => { try { await browser?.close(); } catch { /* */ } try { await server?.close(); } catch { /* */ } if (!LAST || process.exitCode) return; try { rmSync(tmp, { recursive: true, force: true, maxRetries: 3 }); } catch { /* */ } };
try {
  const { createServer } = await import(pathToFileURL(packagePath('vite')).href);
  server = await createServer({ root: tmp, configFile: join(tmp, 'vite.config.js'), cacheDir: join(tmp, '.vitecache'), logLevel: 'warn',
    resolve: { alias: { phaser: join(realpathSync(join(repo, 'node_modules/phaser')), 'dist/phaser.esm.js') } },
    server: { host: '127.0.0.1', port: PORT, strictPort: true, fs: { strict: false } } });
  await server.listen();
  const base = `http://127.0.0.1:${PORT}/`;
  browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const ctx = await browser.newContext({ viewport: { width: 960, height: 540 }, deviceScaleFactor: 1 });
  const page = await ctx.newPage(), errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('dialog', d => d.dismiss()); page.on('crash', () => console.log('PAGE CRASH'));
  const ev = (fn, arg) => page.evaluate(fn, arg);
  const st = () => ev(() => window.__areaed.state());
  const parse = t => JSON.parse(t);

  // (a) mo khong loi
  await page.goto(base + `?area=${ID}&edit=1`);
  await page.waitForFunction(() => window.__areaed && window.__scene?.kitImages, null, { timeout: 40000 });
  await ev(() => window.__areaed.ready());
  await page.waitForTimeout(800);
  let s0 = await st();
  check('(a) editor mo, khong loi console', errors.length === 0 && s0.count > 100 && s0.images >= s0.count, `${s0.count} placement, ${s0.images} anh, loi=${JSON.stringify(errors)}`);
  check('(a) chi so placement gan cho moi anh', s0.groups === s0.count || s0.groups > s0.count - 5, `${s0.groups} nhom`);
  const sameView = await ev(() => { const a = window.__areaed, c = window.__scene.cameras.main, r = window.__game.canvas.getBoundingClientRect(); const p = a.s2w(r.left + r.width / 2 + 37, r.top + r.height / 2 + 11); const w = c.getWorldPoint(c.width / 2 + 37 * c.width / r.width, c.height / 2 + 11 * c.height / r.height); return Math.hypot(p.x - w.x, p.y - w.y); });
  check('(a) cong thuc toa do khop camera.getWorldPoint', sameView < 0.6, 'lech ' + sameView.toFixed(3));

  const idx = s0.pieces.findIndex(p => Number.isInteger(p.x) && Number.isInteger(p.y));
  const p0 = parse(original).pieces[idx];   // toa do GOC (ban goc ghi o original.src.json)
  if (run(1)) {
  // (b) doi 1 placement +5,+3 -> luu -> chi doi dung 1 muc
  await ev(i => window.__areaed.select([i]), idx);
  await ev(() => window.__areaed.moveBy(5, 3));
  let s1 = await st();
  check('(b) moveBy dich 5,3 + dirty', s1.pieces[idx].x === p0.x + 5 && s1.pieces[idx].y === p0.y + 3 && s1.dirty);
  const r1 = await ev(() => window.__areaed.save());
  check('(b) save ok', r1.ok === true, JSON.stringify({ ok: r1.ok, code: r1.code, error: r1.error, ms: r1.ms }));
  const saved = readFileSync(srcPath, 'utf8'), A0 = parse(original), A1 = parse(saved);
  const diffs = A1.pieces.map((p, i) => JSON.stringify(p) !== JSON.stringify(A0.pieces[i]) ? i : -1).filter(i => i >= 0);
  const other = Object.keys(A0).filter(k => k !== 'pieces' && JSON.stringify(A0[k]) !== JSON.stringify(A1[k]));
  check('(b) src chi doi dung 1 piece', diffs.length === 1 && diffs[0] === idx && other.length === 0 && A1.pieces.length === A0.pieces.length, `diff=${diffs} khoa khac doi=${other}`);
  let pre = 0; while (original[pre] === saved[pre]) pre++;
  let suf = 0; while (original[original.length - 1 - suf] === saved[saved.length - 1 - suf]) suf++;
  check('(b) vung doi nho (giu nguyen dinh dang)', original.length - pre - suf < 40 && saved.length - pre - suf < 40, `vung doi ${original.length - pre - suf} -> ${saved.length - pre - suf} ky tu`);
  const area1 = parse(readFileSync(areaPath, 'utf8'));
  check('(b) area.json bake lai co toa do moi', area1.pieces[idx].x === p0.x + 5 && area1.pieces[idx].y === p0.y + 3);
  check('(b) trang thai da luu', !(await st()).dirty);

  await ev(() => window.__areaed.undo());
  check('(c) undo tra ve toa do cu', (await st()).pieces[idx].x === p0.x && (await st()).dirty);
  }
  if (run(2)) {
  // (c) tro lai ban goc + luu -> dung byte goc (luot 2 mo trang moi: p0 la toa do goc = toa do hien tai - (5,3))
  if (PART === 2) { const cur = (await st()).pieces[idx]; check('(c) luot 2 thay ban luu o luot 1 (+5,+3)', cur.x === p0.x + 5 && cur.y === p0.y + 3 && !(await st()).dirty); }
  await ev(i => window.__areaed.select([i]), idx);
  await ev(() => window.__areaed.moveBy(-5, -3));
  const r2 = await ev(() => window.__areaed.save());
  check('(c) save sau undo ok', r2.ok === true, r2.error || '');
  check('(c) src tro lai DUNG BYTE goc', readFileSync(srcPath, 'utf8') === original);
  const area2 = parse(readFileSync(areaPath, 'utf8'));
  check('(c) area.json bake lai khop toa do goc', area2.pieces[idx].x === p0.x && area2.pieces[idx].y === p0.y);

  // chon + keo bang chuot that
  {
    const sel = await ev(async i => {
      const a = window.__areaed; const pl = a.placement(i), im = pl[0];
      await a.centerOn(a.state().pieces[i].x, a.state().pieces[i].y - 20, 2);
      const p = a.state().pieces[i];
      for (let dy = -60; dy <= 0; dy += 2) for (let dx = -40; dx <= 40; dx += 2) if (a.pickAt(p.x + dx, p.y + dy) === i) return { x: p.x + dx, y: p.y + dy };
      return null;
    }, idx);
    check('(h) tim duoc diem trung placement bang pickAt', !!sel);
    const c = await ev(({ x, y }) => window.__areaed.toClient(x, y), sel);
    const before = (await st()).pieces[idx];
    await page.mouse.click(c.x, c.y);
    check('(h) bam chuot chon dung placement', JSON.stringify((await st()).sel) === JSON.stringify([idx]), JSON.stringify((await st()).sel));
    await page.mouse.move(c.x, c.y); await page.mouse.down(); await page.mouse.move(c.x + 20, c.y + 12, { steps: 5 }); await page.mouse.up();
    const after = (await st()).pieces[idx];
    check('(h) keo chuot dich placement + 1 buoc hoan tac', (after.x !== before.x || after.y !== before.y) && (await st()).dirty, `${before.x},${before.y} -> ${after.x},${after.y}`);
    await ev(() => window.__areaed.undo());
    const back = (await st()).pieces[idx];
    check('(h) undo keo ve dung cho cu', back.x === before.x && back.y === before.y);
    await page.keyboard.press('ArrowRight'); await page.keyboard.press('ArrowRight');
    check('(h) mui ten dich 1 px', (await st()).pieces[idx].x === before.x + 2);
    await ev(() => window.__areaed.undo());
    check('(h) nhan mui ten lien tiep gop 1 buoc', (await st()).pieces[idx].x === before.x);
  }

  }
  if (run(3)) {
  // (d) them/xoa/nhan ban, anh mai di cung
  const kits = await (await fetch(base + '__areaed/kits')).json();
  const withPair = kits.find(k => k.kit === 'C-B3'), pairName = Object.entries(withPair.pieces).find(([, p]) => p.pair)[0];
  const cnt0 = (await st());
  await ev(n => window.__areaed.add('C-B3/' + n, 300, 400), pairName);   // kit ngoai khu -> restart nap them kit
  const sA = await st();
  check('(d) add kit moi: count +1, kits co C-B3, anh +2 (than + mai)', sA.count === cnt0.count + 1 && 'C-B3' in sA.kits && sA.images === cnt0.images + 2, `${cnt0.count}->${sA.count}, anh ${cnt0.images}->${sA.images}`);
  const grp = await ev(i => window.__areaed.placement(i), sA.count - 1);
  check('(d) nhom cua placement moi gom than + mai tu sinh', grp.length === 2 && grp.some(g => /_roof$/.test(g.k)), JSON.stringify(grp.map(g => g.k)));
  await ev(() => window.__areaed.duplicate());
  const sD = await st();
  check('(d) duplicate: count +1, anh +2, lech +8,+8', sD.count === sA.count + 1 && sD.images === sA.images + 2 && sD.pieces.at(-1).x === sD.pieces.at(-2).x + 8 && sD.pieces.at(-1).y === sD.pieces.at(-2).y + 8 && sD.sel.length === 1, `${sD.count}, anh ${sD.images}`);
  await ev(() => window.__areaed.remove());
  const sR = await st();
  check('(d) remove: count ve cu, anh ve cu', sR.count === sA.count && sR.images === sA.images);
  await ev(() => window.__areaed.undo());
  check('(d) undo remove', (await st()).count === sA.count + 1);
  await ev(() => window.__areaed.redo());
  check('(d) redo remove', (await st()).count === sA.count);
  // ban nhap: da dirty -> localStorage co ban nhap
  await page.waitForTimeout(500);
  const draft = await ev(() => Object.keys(localStorage).filter(k => k.startsWith('areaed:draft:')));
  check('(d) ban nhap luu vao localStorage khi chua luu', draft.length === 1, draft.join());

  // (f) choi thu: nhan vat di duoc, piece moi co va cham (kiem soat truoc khi them)
  const spawn = (await ev(() => window.__scene.meta.spawns.default));
  const walk = async (key, ms) => { await page.keyboard.down(key); await page.waitForTimeout(ms); await page.keyboard.up(key); await page.waitForTimeout(150); return ev(() => ({ x: window.__scene.player.x, y: window.__scene.player.y })); };
  const play = async () => { await ev((p) => window.__areaed.centerOn(p[0], p[1]), spawn); await ev(() => window.__areaed.togglePlay()); await page.waitForTimeout(500); };
  // bo het thay doi chua luu truoc (dua ve nhu goc) de phep thu chi do piece them vao
  while ((await st()).undo > 0) await ev(() => window.__areaed.undo());
  const DIRS = [['w', 0, -1], ['a', -1, 0], ['d', 1, 0], ['s', 0, 1]];
  let chosen = null;
  for (const [key, dx, dy] of DIRS) {
    await play();
    const sm = await st(); if (sm.mode !== 'play') continue;
    const a = await ev(() => ({ x: window.__scene.player.x, y: window.__scene.player.y }));
    const b = await walk(key, 1500);
    const d = Math.hypot(b.x - a.x, b.y - a.y);
    await ev(() => window.__areaed.togglePlay()); await page.waitForTimeout(300);
    if (d >= 75) { chosen = { key, dx, dy, free: d }; break; }
  }
  check('(f) choi thu: nhan vat di duoc (doi chung tren dat trong)', !!chosen, JSON.stringify(chosen));
  const solidPiece = Object.entries(kits).flatMap(([, k]) => Object.entries(k.pieces).map(([n, p]) => ({ k: k.kit + '/' + n, p }))).find(({ k, p }) => k.startsWith('C-B3/') === false && p.collide?.some(r => r[2] >= 16 && r[3] >= 8) && p.layer === 'base' && !p.pair && kits.find(q => q.kit === k.split('/')[0]).kit in (s0.kits));
  const rect = solidPiece.p.collide.find(r => r[2] >= 16 && r[3] >= 8);
  const T = { x: spawn[0] + chosen.dx * 35, y: spawn[1] + chosen.dy * 35 };
  await ev(({ k, x, y }) => window.__areaed.add(k, x, y), { k: solidPiece.k, x: Math.round(T.x - (rect[0] + rect[2] / 2)), y: Math.round(T.y - (rect[1] + rect[3] / 2)) });
  await play();
  const a2 = await ev(() => ({ x: window.__scene.player.x, y: window.__scene.player.y }));
  const b2 = await walk(chosen.key, 1500);
  const d2 = Math.hypot(b2.x - a2.x, b2.y - a2.y);
  check('(f) piece moi chan nhan vat (collider dung lai khi choi thu)', d2 < 50 && d2 < chosen.free - 25, `di duoc ${d2.toFixed(1)} px (khong co piece: ${chosen.free.toFixed(1)} px) voi ${solidPiece.k}`);
  await ev(() => window.__areaed.togglePlay());
  const sBack = await st();
  check('(f) Tab quay lai che do Sua, giu piece moi', sBack.mode === 'edit' && sBack.count === s0.count + 1, `count ${sBack.count}`);
  await ev(() => window.__areaed.undo());

  // (e) sua src tren dia khi editor dang mo -> luu bi tu choi
  const disk = readFileSync(srcPath, 'utf8');
  writeFileSync(srcPath, disk + '\n');
  await ev(i => window.__areaed.select([i]), idx);
  await ev(() => window.__areaed.moveBy(2, 2));
  const r3 = await ev(() => window.__areaed.save());
  check('(e) save tra conflict khi file tren dia da doi', r3.ok === false && r3.code === 'conflict', JSON.stringify({ ok: r3.ok, code: r3.code }));
  const stText = await ev(() => document.querySelector('#aed .st').textContent);
  check('(e) UI bao xung dot', /XUNG/.test(stText), stText);
  check('(e) file tren dia khong bi ghi de', readFileSync(srcPath, 'utf8') === disk + '\n');

  // (g) khong co ?edit=1: khong nap module editor
  const page2 = await ctx.newPage(), reqs = [], errs2 = [];
  page2.on('request', r => reqs.push(r.url())); page2.on('pageerror', e => errs2.push(e.message));
  await page2.goto(base + `?area=${ID}`);
  await page2.waitForFunction(() => window.__scene?.player, null, { timeout: 40000 });
  await page2.waitForTimeout(800);
  const hasApi = await page2.evaluate(() => typeof window.__areaed);
  check('(g) khong ?edit=1: khong nap module editor / goi /__areaed', !reqs.some(u => /\/src\/editor\/|__areaed/.test(u)) && hasApi === 'undefined' && errs2.length === 0, `${reqs.length} request`);
  const follow = await page2.evaluate(() => { const s = window.__scene; return { follow: !!s.cameras.main._follow, free: s.editFree }; });
  check('(g) camera van theo nhan vat, editFree=false', follow.follow && !follow.free, JSON.stringify(follow));
  }
  console.log(PART ? `\nEDITOR E2E PART ${PART} PASS (${checks} kiem tra)` : `\nEDITOR E2E PASS (${checks} kiem tra)`);
  if (PART === 3) console.log('EDITOR E2E PASS (3 luot)');
} catch (e) {
  console.error('EDITOR E2E FAIL:', e.message);
  process.exitCode = 1;
} finally { await cleanup(); }
