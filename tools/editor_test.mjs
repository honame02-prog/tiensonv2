// E2E Area Editor: dung ban sao repo trong thu muc tam, chay vite VOI vite.config.js (co plugin areaEditor) o cong 5190, dieu khien bang Playwright + window.__areaed.
// --part=1..7: chia luot (moi luot < 60 s; bake HVQ 18-45 s/lan), dung chung ban sao tam co dinh; khong co --part: chay het.
// Khong ghi gi vao tools/areas/ hay public/assets/areas/ cua repo that. Chay: node tools/editor_test.mjs
import assert from 'node:assert/strict';
import http from 'node:http';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync, symlinkSync, realpathSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { chromium, packagePath } from './area_tool_runtime.mjs';

const ID = 'huyen-van-quan-v2', PORT = 5190;
let checks = 0;
const check = (name, ok, extra = '') => { assert.ok(ok, name + ' ' + extra); checks++; console.log(`OK ${checks} ${name}${extra ? ' ' + extra : ''}`); };

// ---------- ban sao repo tam
const partArg = process.argv.find(a => a.startsWith('--part='))?.slice(7), PART = partArg ? +partArg : 0, run = n => !PART || PART === n, LAST = !PART || PART === 7;
// thu muc concept gia (plugin doc AREAED_CONCEPT_DIR); ban sao tam khong co design/tienson
const cdir = join(tmpdir(), 'areaed-e2e-concepts'); mkdirSync(join(cdir, 'sub'), { recursive: true });
cpSync(join(repo0(), 'public/assets/mist.png'), join(cdir, 'sub/c1.png')); process.env.AREAED_CONCEPT_DIR = cdir;
function repo0() { return resolve('.'); }
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
const cleanup = async () => { try { await browser?.close(); } catch { /* */ } try { await server?.close(); } catch { /* */ } if (!LAST || process.exitCode) return; try { rmSync(tmp, { recursive: true, force: true, maxRetries: 3 }); rmSync(cdir, { recursive: true, force: true }); } catch { /* */ } };
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
  const dialogs = []; page.on('dialog', d => { dialogs.push(d.type()); return d.type() === 'beforeunload' ? d.accept() : d.dismiss(); }); page.on('crash', () => console.log('PAGE CRASH'));
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
  writeFileSync(join(tmp, 's1.src.json'), saved);   // ban luu #1 (dung cho test khoi phuc luot 6)
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
  if ((await st()).pieces[idx].x !== p0.x) await ev(() => window.__areaed.moveBy(-5, -3));   // chay mot mach: phien con nguyen, da undo ve goc o cuoi luot 1 -> luu thang (undo + save that su)
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
  // ======================= luot 4: zoom, banner nhap, concept (khong bake)
  const bp = () => ev(() => document.activeElement?.blur?.()), cam = () => ev(() => { const c = window.__scene.cameras.main; return { z: c.zoom, w: c.width, h: c.height }; });
  const worldErr = (dx, dy) => ev(([dx, dy]) => { const a = window.__areaed, c = window.__scene.cameras.main, r = window.__game.canvas.getBoundingClientRect(); const p = a.s2w(r.left + r.width / 2 + dx, r.top + r.height / 2 + dy); const w = c.getWorldPoint(c.width / 2 + dx * c.width / r.width, c.height / 2 + dy * c.height / r.height); return Math.hypot(p.x - w.x, p.y - w.y); }, [dx, dy]);
  const findPoint = (i, scan = 60) => ev(([i, scan]) => { const a = window.__areaed, p = a.state().pieces[i]; for (let dy = -scan; dy <= 8; dy += 2) for (let dx = -scan; dx <= scan; dx += 2) if (a.pickAt(p.x + dx, p.y + dy) === i) return { x: p.x + dx, y: p.y + dy }; return null; }, [i, scan]);
  const clientOf = pt => ev(({ x, y }) => window.__areaed.toClient(x, y), pt);
  const resetEdits = async () => { while ((await st()).undo > 0) await ev(() => window.__areaed.undo()); };
  const reopen = async () => { await page.reload(); await page.waitForFunction(() => window.__areaed?.state() && window.__scene?.kitImages); await ev(() => window.__areaed.ready()); await page.waitForTimeout(300); s0 = await st(); };
  if (run(4)) {
    if (!PART) await reopen();   // chay mot mach: bat dau tu trang sach (luot 3 de lai xung dot + sua tren dia)
    // (1) zoom 0.25 / 0.5 / 1-6, phim 0, nhan zoom
    await ev(() => window.__areaed.centerOn(640, 800, 1)); await bp();
    await page.mouse.move(480, 270);
    const zs = []; for (const dy of [100, 100, 100, -100, -100, -100, -100]) { await page.mouse.wheel(0, dy); await page.waitForTimeout(120); zs.push((await st()).zoom); }
    check('(1) lan chuot: 1 -> 0.5 -> 0.25 (chan duoi) -> 0.5 -> 1 -> 2 -> 3', JSON.stringify(zs) === JSON.stringify([0.5, 0.25, 0.25, 0.5, 1, 2, 3]), JSON.stringify(zs));
    await ev(() => window.__areaed.centerOn(640, 800, 0.5)); await page.waitForTimeout(200);
    const c5 = await cam();
    check('(1) camera.zoom = 0.5', c5.z === 0.5, JSON.stringify(c5));
    const e5 = Math.max(await worldErr(0, 0), await worldErr(137, -61), await worldErr(-200, 90));
    check('(1) toa do chuot -> the gioi khop camera.getWorldPoint o zoom 0.5', e5 < 0.6, 'lech ' + e5.toFixed(3));
    const lbl = await ev(() => document.querySelector('#aed .zm').textContent);
    check('(1) hien thi muc zoom', lbl === '0.5×', lbl);
    await page.keyboard.press('0'); await page.waitForTimeout(250);
    const cf = await cam(), view = await ev(() => { const v = window.__scene.cameras.main.worldView; return [v.x, v.y, v.width, v.height]; });
    check('(1) phim 0: vua khung ca khu', Math.abs(cf.z - Math.min(cf.w / 1280, cf.h / 1600)) < 1e-6 && view[2] >= 1279 && view[3] >= 1599 && view[0] <= 1 && view[1] <= 1, `zoom ${cf.z.toFixed(4)} view ${view.map(v => Math.round(v))}`);
    const lbl2 = await ev(() => document.querySelector('#aed .zm').textContent);
    check('(1) nhan zoom cap nhat sau phim 0', /^0\.1\d×$/.test(lbl2), lbl2);
    await ev(() => window.__areaed.centerOn(window.__areaed.state().pieces[0].x, window.__areaed.state().pieces[0].y - 20, 0.5));
    { const pt = await findPoint(0); const c = await clientOf(pt); await page.mouse.click(c.x, c.y);
      check('(1) bam chuot o zoom 0.5 chon dung placement', JSON.stringify((await st()).sel) === '[0]', JSON.stringify((await st()).sel)); }
    await ev(() => window.__areaed.select([])); await ev(() => window.__areaed.centerOn(640, 800, 1));

    // (3) banner nhap: Khoi phuc / Bo nhap
    dialogs.length = 0;
    const dk = () => ev(() => Object.keys(localStorage).filter(k => k.startsWith('areaed:draft:')));
    for (const k of await dk()) await ev(k => localStorage.removeItem(k), k);
    await ev(i => window.__areaed.select([i]), idx); await ev(() => window.__areaed.moveBy(7, 0)); await page.waitForTimeout(700);
    check('(3) nhap da luu truoc khi dong trang', (await dk()).length === 1);
    await reopen();
    let s4 = await st();
    check('(3) mo lai: banner hien, CHUA ap dung nhap', s4.draft === true && s4.pieces[idx].x === p0.x && !s4.dirty && await ev(() => getComputedStyle(document.querySelector('#aed .dr')).display) === 'flex');
    await page.click('#aed [data-a=drrestore]'); await page.waitForTimeout(300);
    s4 = await st();
    check('(3) bam Khoi phuc: ap dung nhap, dirty, banner an', s4.pieces[idx].x === p0.x + 7 && s4.dirty && s4.draft === false && await ev(() => getComputedStyle(document.querySelector('#aed .dr')).display) === 'none');
    await page.waitForTimeout(700); await reopen();
    s4 = await st();
    check('(3) mo lai lan nua: banner hien lai (nhap van con)', s4.draft === true && s4.pieces[idx].x === p0.x);
    await page.click('#aed [data-a=drdiscard]'); await page.waitForTimeout(300);
    s4 = await st();
    check('(3) bam Bo nhap: giu ban dia, xoa nhap, banner an', s4.pieces[idx].x === p0.x && !s4.dirty && s4.draft === false && (await dk()).length === 0);
    await reopen();
    check('(3) sau khi bo nhap mo lai khong con banner; khong dung window.confirm', (await st()).draft === false && !dialogs.includes('confirm'), JSON.stringify(dialogs));

    // (4) concept
    const list = await (await fetch(base + '__areaed/concepts')).json();
    check('(4) liet ke concept tu /__areaed/concepts', list.includes('sub/c1.png'), JSON.stringify(list));
    const okImg = await fetch(base + '__areaed/concept?path=' + encodeURIComponent('sub/c1.png'));
    check('(4) doc concept 200 image/png', okImg.status === 200 && okImg.headers.get('content-type') === 'image/png');
    const bads = ['../package.json', '..%2f..%2fpublic%2fassets%2fmist.png', '../../public/assets/mist.png', 'C:/Windows/win.png', '/etc/x.png', '../x.png'];
    const codes = []; for (const b of bads) codes.push((await fetch(base + '__areaed/concept?path=' + (b.includes('%') ? b : encodeURIComponent(b)))).status);
    check('(4) path traversal bi 400', codes.every(c => c === 400), JSON.stringify(codes));
    check('(4) file khong ton tai 404', (await fetch(base + '__areaed/concept?path=sub/none.png')).status === 404);
    await page.selectOption('#aed-cs', 'sub/c1.png');
    await page.waitForFunction(() => window.__areaed.state().concept.texture && window.__areaed.state().concept.loaded, null, { timeout: 8000 });
    check('(4) chon concept: texture nap + anh tren canh', (await st()).concept.path === 'sub/c1.png');
    await page.evaluate(() => { const e = document.querySelector('#aed-co'); e.value = '0.3'; e.dispatchEvent(new Event('change', { bubbles: true })); });
    await page.fill('#aed-cx', '40'); await page.press('#aed-cx', 'Enter');
    await page.fill('#aed-cy', '25'); await page.press('#aed-cy', 'Enter');
    await page.fill('#aed-cz', '2'); await page.press('#aed-cz', 'Enter');
    await page.check('#aed-cl');
    let cs = (await st()).concept;
    check('(4) doi do mo/dich/zoom/khoa', cs.opacity === 0.3 && cs.x === 40 && cs.y === 25 && cs.zoom === 2 && cs.locked === true, JSON.stringify(cs));
    const info = await ev(() => { const im = window.__scene.children.list.find(o => o.texture?.key === 'areaed:concept'); return { x: im.x, y: im.y, a: im.alpha, s: im.scaleX }; });
    check('(4) anh concept ap dung thong so', info.x === 40 && info.y === 25 && Math.abs(info.a - 0.3) < 1e-6 && info.s === 2, JSON.stringify(info));
    await bp(); await ev(() => window.__areaed.centerOn(640, 800, 1));
    const dragC = async () => { await page.keyboard.down('c'); await page.mouse.move(400, 250); await page.mouse.down(); await page.mouse.move(440, 280, { steps: 4 }); await page.mouse.up(); await page.keyboard.up('c'); };
    await dragC();
    check('(4) khoa concept: giu C + keo khong dich', (await st()).concept.x === 40);
    await page.uncheck('#aed-cl'); await dragC();
    cs = (await st()).concept;
    check('(4) mo khoa: giu C + keo dich concept', cs.x !== 40 && cs.locked === false, `x=${cs.x} y=${cs.y}`);
    await page.waitForTimeout(200); await reopen();
    await page.waitForFunction(() => window.__areaed.state().concept.loaded, null, { timeout: 8000 });
    const cs2 = (await st()).concept;
    check('(4) tai lai trang: cau hinh concept con', cs2.path === 'sub/c1.png' && cs2.opacity === 0.3 && cs2.zoom === 2 && cs2.x === cs.x && cs2.y === cs.y && cs2.locked === false, JSON.stringify(cs2));
  }

  // ======================= luot 5: lop phu, khoa/an kit, thu vien, chon, phim tat, panel, kiem tra, guide
  if (run(5)) {
    if (!PART) await reopen();
    await ev(() => window.__areaed.fit()); await page.waitForTimeout(300);
    const LAYERS = ['grid', 'col', 'tier', 'collide', 'anchor', 'frame', 'portals', 'spawns', 'steps', 'exits'];
    const setOnly = async only => { for (const l of LAYERS) await ev(([l, on]) => window.__areaed.setLayer(l, on), [l, l === only]); await page.waitForTimeout(180); return ev(() => window.__areaed.state().overlay); };
    const exp = await ev(() => { const m = window.__scene.meta, a = window.__areaed.state(); let collide = 0;
      for (const p of a.pieces) { const kit = p.k.split('/')[0], d = window.__scene.cache.json.get('kit:' + a.id + ':' + kit); collide += d.pieces[p.k.slice(kit.length + 1)].collide.length; }
      return { col: m.col.flat().filter(Boolean).length, tier: m.tierRows.join('').split('').filter(c => c !== '.').length, collide, anchor: a.pieces.length, frame: a.images, portals: m.portals.length, spawns: Object.keys(m.spawns).length, steps: (m.steps || []).length, exits: (m.exits || []).length }; });
    const off = await setOnly(null);
    check('(4b) tat het lop phu: khong ve gi', Object.values(off).every(v => v === 0), JSON.stringify(off));
    const got = {};
    for (const l of ['col', 'tier', 'collide', 'anchor', 'frame', 'portals', 'spawns', 'steps']) got[l] = (await setOnly(l))[l];
    got.grid = (await setOnly('grid')).grid;
    check('(4b) lop phu HVQ: so doi tuong ve khop du lieu', ['col', 'tier', 'collide', 'anchor', 'frame', 'portals', 'spawns', 'steps'].every(l => got[l] === exp[l]) && got.grid > 0 && exp.col > 100 && exp.tier > 100 && exp.collide > 20, `ve ${JSON.stringify(got)} / du lieu ${JSON.stringify(exp)}`);
    const pg2 = await ctx.newPage(), errs5 = []; pg2.on('pageerror', e => errs5.push(e.message)); pg2.on('console', m => { if (m.type() === 'error') errs5.push(m.text()); });
    await pg2.goto(base + '?area=son-dao-v3&edit=1'); await pg2.waitForFunction(() => window.__areaed?.state() && window.__scene?.kitImages); await pg2.evaluate(() => window.__areaed.ready());
    await pg2.evaluate(() => window.__areaed.fit()); await pg2.waitForTimeout(300);
    const sd = {}; for (const l of ['exits', 'steps', 'portals', 'spawns', 'col']) { for (const k of LAYERS) await pg2.evaluate(([k, on]) => window.__areaed.setLayer(k, on), [k, k === l]); await pg2.waitForTimeout(180); sd[l] = await pg2.evaluate(l => window.__areaed.state().overlay[l], l); }
    const sdExp = await pg2.evaluate(() => { const m = window.__scene.meta; return { exits: m.exits.length, steps: m.steps.length, portals: m.portals.length, spawns: Object.keys(m.spawns).length, col: m.col.flat().filter(Boolean).length, count: window.__areaed.state().count }; });
    check('(4b) lop phu son-dao-v3 (khu khong co pieces): exits/steps/portals/spawns/col khop', sd.exits === sdExp.exits && sd.exits >= 1 && sd.steps === sdExp.steps && sd.steps >= 2 && sd.portals === sdExp.portals && sd.spawns === sdExp.spawns && sd.col === sdExp.col && sdExp.count === 0 && errs5.length === 0, `${JSON.stringify(sd)} loi=${JSON.stringify(errs5)}`);
    await pg2.close();
    for (const l of LAYERS) await ev(([l, on]) => window.__areaed.setLayer(l, on), [l, ['collide', 'portals', 'spawns', 'steps', 'exits'].includes(l)]);

    await ev(() => window.__areaed.centerOn(640, 800, 1));
    // khoa / an theo kit
    const kitK = s0.pieces[idx].k.split('/')[0];
    const ptK = await findPoint(idx); check('(4c) co diem bam duoc placement thu nghiem', !!ptK);
    await ev(i => window.__areaed.select([i]), idx);
    await page.check(`[data-kf="locked:${kitK}"]`);
    await ev(({ x, y }) => window.__areaed.centerOn(x, y, 1), ptK);
    const ck = await clientOf(ptK); await ev(() => window.__areaed.select([]));
    await page.mouse.click(ck.x, ck.y);
    const pk = await ev(([x, y]) => window.__areaed.pickAt(x, y), [ptK.x, ptK.y]);
    check('(4c) khoa kit: bam khong chon duoc', pk !== idx && !(await st()).sel.includes(idx) && (await st()).locked.includes(kitK), `pick=${pk}`);
    await page.uncheck(`[data-kf="locked:${kitK}"]`);
    await page.mouse.click(ck.x, ck.y);
    check('(4c) mo khoa: chon lai duoc', (await st()).sel.includes(idx));
    await page.check(`[data-kf="hidden:${kitK}"]`);
    const vis = await ev(i => window.__areaed.placement(i).map(g => g.visible), idx);
    check('(4c) an kit: anh bi an va khong chon duoc', vis.every(v => v === false) && await ev(([x, y, i]) => window.__areaed.pickAt(x, y) !== i, [ptK.x, ptK.y, idx]));
    await page.uncheck(`[data-kf="hidden:${kitK}"]`);
    check('(4c) bo an: anh hien lai', (await ev(i => window.__areaed.placement(i).map(g => g.visible), idx)).every(Boolean));

    // keo tha tu thu vien bang chuot that + dat bang bam
    await ev(() => window.__areaed.centerOn(640, 800, 1)); await resetEdits();
    const kName = s0.pieces[idx].k.slice(kitK.length + 1), cnt = (await st()).count, kFull = s0.pieces[idx].k;
    await page.fill('#aed .q', kName); await page.waitForSelector(`#aed .it[data-k="${kFull}"]`);
    await page.locator(`#aed .it[data-k="${kFull}"]`).dragTo(page.locator('#game canvas'), { targetPosition: { x: 480, y: 270 } });
    await ev(() => window.__areaed.ready());
    let sL = await st(); const w0 = await ev(() => window.__areaed.s2w(480, 270)), dropped = sL.pieces.at(-1);
    check('(5) keo tha tu thu vien vao canh: them 1 placement dung k + vi tri', sL.count === cnt + 1 && dropped.k === kFull && Math.abs(dropped.x - w0.x) <= 2 && Math.abs(dropped.y - w0.y) <= 2, `${JSON.stringify(dropped)} vs ${w0.x},${w0.y}`);
    await page.click(`#aed .it[data-k="${kFull}"]`);
    check('(5) chon trong thu vien: trang thai bao dang dat', (await ev(() => document.querySelector('#aed .st').textContent)).includes('đang đặt'));
    await page.mouse.click(520, 300);
    check('(5) bam vao canh: dat them 1', (await st()).count === cnt + 2);
    await bp(); await page.keyboard.press('Escape');
    await page.mouse.click(520, 300);
    check('(5) Esc thoi dat (bam chi chon)', (await st()).count === cnt + 2);
    await resetEdits(); await page.fill('#aed .q', ''); await bp();

    // chon khung (chuot phai)
    await ev(i => window.__areaed.centerOn(window.__areaed.state().pieces[i].x, window.__areaed.state().pieces[i].y, 0.5), idx);
    await page.mouse.move(250, 120); await page.mouse.down({ button: 'right' }); await page.mouse.move(700, 420, { steps: 5 }); await page.mouse.up({ button: 'right' });
    { const a = await ev(() => window.__areaed.s2w(250, 120)), b = await ev(() => window.__areaed.s2w(700, 420)), s = await st();
      const exp2 = s.pieces.map((p, i) => i).filter(i => { const p = s.pieces[i]; return p.x >= a.x && p.x <= b.x && p.y >= a.y && p.y <= b.y; });
      check('(5) keo khung chon nhieu: dung tap placement trong khung', exp2.length >= 2 && JSON.stringify(s.sel) === JSON.stringify(exp2), `${s.sel.length} chon / ${exp2.length} mong doi`); }
    await ev(() => window.__areaed.select([]));

    // Alt chon lop duoi
    const alt = await ev(async () => { const a = window.__areaed, S = a.state(); for (let i = 0; i < S.count; i++) { const p = S.pieces[i];
      for (let dy = -40; dy <= 0; dy += 6) for (let dx = -40; dx <= 40; dx += 6) { const x = p.x + dx, y = p.y + dy, top = a.pickAt(x, y); if (top < 0) continue; await a.select([top]); const below = a.pickAt(x, y, true); if (below >= 0 && below !== top) return { x, y, top, below }; } } await a.select([]); return null; });
    check('(5) tim duoc diem co >= 2 lop chong nhau', !!alt);
    await ev(({ x, y }) => window.__areaed.centerOn(x, y, 1), alt); await ev(({ top }) => window.__areaed.select([top]), alt);
    const ca = await clientOf(alt);
    await page.keyboard.down('Alt'); await page.mouse.click(ca.x, ca.y); await page.keyboard.up('Alt');
    check('(5) Alt+bam chon placement ben duoi', JSON.stringify((await st()).sel) === JSON.stringify([alt.below]), `${JSON.stringify((await st()).sel)} mong doi ${alt.below} (top ${alt.top})`);
    await ev(() => window.__areaed.select([]));

    // Ctrl+C / Ctrl+V
    await resetEdits(); await ev(i => window.__areaed.select([i]), idx); await bp();
    const cnt2 = (await st()).count;
    await page.keyboard.press('Control+c'); await page.mouse.move(400, 200); await page.keyboard.press('Control+v');
    { const s = await st(), w = await ev(() => window.__areaed.s2w(400, 200)), n = s.pieces.at(-1);
      check('(5) Ctrl+C / Ctrl+V: dan 1 ban sao tai con tro', s.count === cnt2 + 1 && n.k === kFull && Math.abs(n.x - w.x) <= 1 && Math.abs(n.y - w.y) <= 1, `${JSON.stringify(n)} vs ${w.x},${w.y}`); }
    await resetEdits();

    // phim F
    await ev(i => window.__areaed.select([i]), idx); await ev(() => window.__areaed.centerOn(100, 100, 2)); await bp(); await page.keyboard.press('f');
    { const b = await ev(i => { let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9; for (const o of window.__scene.kitImages.filter(o => o.getData('placement') === i)) { x0 = Math.min(x0, o.x); y0 = Math.min(y0, o.y); x1 = Math.max(x1, o.x + o.width); y1 = Math.max(y1, o.y + o.height); } return { cx: (x0 + x1) / 2, cy: (y0 + y1) / 2 }; }, idx), s = await st();
      check('(5) phim F dua camera toi muc chon', Math.abs(s.cam.x - b.cx) <= 1.5 && Math.abs(s.cam.y - b.cy) <= 1.5, `cam ${s.cam.x},${s.cam.y} muc ${b.cx},${b.cy}`); }

    // panel thuoc tinh: sua x/y
    await resetEdits(); await ev(i => window.__areaed.select([i]), idx);
    const px0 = (await st()).pieces[idx];
    await page.fill('#aed-x', String(px0.x + 9)); await page.press('#aed-x', 'Enter');
    await page.fill('#aed-y', String(px0.y - 4)); await page.press('#aed-y', 'Enter');
    { const s = await st(); check('(5) panel: sua x/y + Enter doi vi tri, moi lan 1 buoc undo', s.pieces[idx].x === px0.x + 9 && s.pieces[idx].y === px0.y - 4 && s.undo === 2, `${JSON.stringify(s.pieces[idx])} undo=${s.undo}`); }
    await bp(); await page.keyboard.press('Control+z');
    check('(5) Ctrl+Z hoan tac 1 buoc sua panel', (await st()).pieces[idx].y === px0.y && (await st()).pieces[idx].x === px0.x + 9);
    await resetEdits();

    // nut Kiem tra
    await page.click('#aed [data-a=check]');
    await page.waitForFunction(() => /TAT CA DAT/.test(document.querySelector('#aed .log pre').textContent), null, { timeout: 15000 });
    check('(5) nut Kiem tra: hien ket qua blockout_reach', await ev(() => getComputedStyle(document.querySelector('#aed .log')).display) === 'block' && /DAT \(exit 0\)/.test(await ev(() => document.querySelector('#aed .log pre').textContent)));
    await page.click('#aed [data-a=closelog]');

    // guide can chan (lech <= 2 px)
    const gp = await ev(() => { const a = window.__areaed, S = a.state(); const ok = i => Number.isInteger(S.pieces[i].x) && Number.isInteger(S.pieces[i].y);
      for (let i = 0; i < S.count; i++) { if (!ok(i)) continue; for (let j = 0; j < S.count; j++) { if (i === j || !ok(j)) continue; const dx = S.pieces[j].x - S.pieces[i].x, dy = S.pieces[j].y - S.pieces[i].y;
        if (Math.abs(dx) < 220 && Math.abs(dx) > 40 && Math.abs(dy) < 120 && Math.abs(dy) > 20 && S.pieces.every((q, n) => n === j || Math.abs(q.y - S.pieces[j].y) > 9)) {
          for (let yy = -30; yy <= 0; yy += 2) for (let xx = -30; xx <= 30; xx += 2) if (a.pickAt(S.pieces[i].x + xx, S.pieces[i].y + yy) === i) return { a: i, b: j, pt: { x: S.pieces[i].x + xx, y: S.pieces[i].y + yy } }; } } } return null; });
    check('(5) tim duoc cap placement cho thu guide', !!gp);
    const sA = (await st()).pieces[gp.a], sB = (await st()).pieces[gp.b];
    await ev(({ a, b }) => { const S = window.__areaed.state(); window.__areaed.centerOn((S.pieces[a].x + S.pieces[b].x) / 2, (S.pieces[a].y + S.pieces[b].y) / 2, 1); }, gp);
    const c0 = await clientOf(gp.pt);
    const target = dy => clientOf({ x: gp.pt.x + (sB.x - sA.x), y: gp.pt.y + (sB.y + dy - sA.y) });
    await page.mouse.move(c0.x, c0.y); await page.mouse.down();
    const far = await target(7); await page.mouse.move(far.x, far.y, { steps: 6 });
    const gFar = (await st()).guides.filter(g => g.ref === gp.b && g.axis === 'y').length;
    const near = await target(1); await page.mouse.move(near.x, near.y, { steps: 6 });
    const gNear = (await st()).guides.filter(g => g.ref === gp.b && g.axis === 'y').length, sMid = await st();
    await page.mouse.up();
    check('(5) guide can chan: hien khi lech <= 2 px, khong hien khi lech 7 px', gNear >= 1 && gFar === 0 && Math.abs(sMid.pieces[gp.a].y - (sB.y + 1)) <= 1, `lech7: ${gFar} guide, lech1: ${gNear} guide, y ${sMid.pieces[gp.a].y} vs ${sB.y}`);
    check('(5) tha chuot: guide bien mat', (await st()).guides.length === 0);
    await resetEdits();
  }

  // ======================= luot 6: khoi phuc ban sao luu trong UI + chup anh UI
  if (run(6)) {
    if (!PART) await reopen();
    dialogs.length = 0;
    const bdir = join(tmp, `tools/areas/.bak/${ID}`), s1 = readFileSync(join(tmp, 's1.src.json'), 'utf8');
    const lst = await (await fetch(base + `__areaed/backups?id=${ID}`)).json();
    check('(2) GET /__areaed/backups liet ke >= 2 ban (moi nhat truoc)', lst.ok && lst.list.length >= 2 && [...lst.list].sort().reverse().join() === lst.list.join(), JSON.stringify(lst.list));
    const hasSrc = n => readFileSync(join(bdir, n, `${ID}.src.json`), 'utf8');
    const want = lst.list.find(n => hasSrc(n) === s1);
    check('(2) co ban sao luu = noi dung luot 1 (src +5,+3)', !!want, `ban: ${lst.list.length}`);
    check('(2) src hien tai khac ban 1', readFileSync(srcPath, 'utf8') !== s1);
    await page.click('#aed [data-a=bak]');
    await page.waitForSelector(`#aed [data-a=bkrestore][data-name="${want}"]`);
    check('(2) panel liet ke ban sao (thoi gian + nut Khoi phuc)', (await page.locator('#aed [data-a=bkrestore]').count()) === lst.list.length);
    await page.click(`#aed [data-a=bkrestore][data-name="${want}"]`);
    await page.waitForSelector('#aed [data-cf="0"]');
    check('(2) hop thoai xac nhan la DOM cua editor (khong window.confirm)', !dialogs.includes('confirm') && await page.locator('#aed [data-cf="1"]').isVisible());
    await page.click('#aed [data-cf="0"]');
    check('(2) Huy: khong doi file', readFileSync(srcPath, 'utf8') !== s1);
    await page.waitForSelector(`#aed [data-a=bkrestore][data-name="${want}"]`);
    await page.click(`#aed [data-a=bkrestore][data-name="${want}"]`); await page.waitForSelector('#aed [data-cf="1"]');
    const nav = page.waitForEvent('load', { timeout: 30000 });
    await page.click('#aed [data-cf="1"]'); await nav;
    await page.waitForFunction(() => window.__areaed?.state() && window.__scene?.kitImages, null, { timeout: 40000 }); await ev(() => window.__areaed.ready());
    check('(2) khoi phuc ban 1: src DUNG BYTE ban 1', readFileSync(srcPath, 'utf8') === s1);
    const sR = await st();
    check('(2) sau khoi phuc canh tai lai theo ban 1 (toa do +5,+3), khong dirty', sR.pieces[idx].x === p0.x + 5 && sR.pieces[idx].y === p0.y + 3 && !sR.dirty);
    check('(2) khoi phuc tao them 1 ban sao luu (ban hien tai truoc do)', (await (await fetch(base + `__areaed/backups?id=${ID}`)).json()).list.length === lst.list.length + 1);
    mkdirSync(join(repo, 'records/editor'), { recursive: true });
    for (const l of ['col', 'portals']) await ev(l => window.__areaed.setLayer(l, true), l);
    await ev(() => window.__areaed.select([])); await ev(() => window.__areaed.centerOn(640, 1480, 1)); await page.waitForTimeout(500);
    await page.screenshot({ path: join(repo, 'records/editor/ui-1x.png') });
    await ev(() => window.__areaed.centerOn(640, 800, 0.5)); await page.waitForTimeout(500);
    await page.screenshot({ path: join(repo, 'records/editor/ui-overview.png') });
    check('(6) da chup records/editor/ui-1x.png + ui-overview.png', existsSync(join(repo, 'records/editor/ui-1x.png')) && existsSync(join(repo, 'records/editor/ui-overview.png')));
  }
  // ======================= luot 7: bao mat dev-server, hit-test theo anh trung, lam tron, gop nudge, token phien luu (khong bake)
  if (run(7)) {
    if (!PART) await reopen();
    // (P1) Host / Origin
    const rq = (method, path, headers = {}, body) => new Promise((ok, no) => { const r = http.request({ host: '127.0.0.1', port: PORT, method, path, headers: { host: `127.0.0.1:${PORT}`, ...headers } }, res => { let b = ''; res.on('data', c => { b += c; }); res.on('end', () => ok({ status: res.statusCode, body: b })); }); r.on('error', no); if (body) r.write(body); r.end(); });
    const jh = { 'content-type': 'application/json' }, bad = JSON.stringify({ id: ID, name: 'x' });
    const st403 = [(await rq('GET', '/__areaed/kits', { host: 'attacker.test' })).status, (await rq('GET', '/__areaed/kits', { host: `attacker.test:${PORT}` })).status, (await rq('GET', '/__areaed/kits', { host: '127.0.0.1:9999' })).status,
      (await rq('GET', `/__areaed/src?id=${ID}`, { host: `evil.localhost.attacker.test:${PORT}` })).status, (await rq('POST', '/__areaed/save', { ...jh, host: 'attacker.test' }, '{}')).status];
    check('(P1) Host la (attacker.test, cong sai...) -> 403 cho GET/POST /__areaed/*', st403.every(c => c === 403), JSON.stringify(st403));
    const okHost = [(await rq('GET', '/__areaed/kits', { host: `localhost:${PORT}` })).status, (await rq('GET', '/__areaed/kits', { host: `127.0.0.1:${PORT}` })).status];
    check('(P1) Host localhost/127.0.0.1:cong dung -> 200', okHost.every(c => c === 200), JSON.stringify(okHost));
    const oBad = [(await rq('POST', '/__areaed/restore', { ...jh, origin: 'http://evil.test' }, bad)).status, (await rq('POST', '/__areaed/restore', { ...jh, origin: 'null' }, bad)).status, (await rq('POST', '/__areaed/restore', { ...jh, origin: `http://localhost:${PORT}` }, bad)).status];
    check('(P1) POST Origin la / null / khac nguon -> 403', oBad.every(c => c === 403), JSON.stringify(oBad));
    const oOk = [(await rq('POST', '/__areaed/restore', { ...jh, origin: `http://127.0.0.1:${PORT}` }, bad)).status, (await rq('POST', '/__areaed/restore', jh, bad)).status];
    check('(P1) POST cung nguon hoac khong Origin duoc xu ly (400 vi ten sao luu sai, khong phai 403)', oOk.every(c => c === 400), JSON.stringify(oOk));
    check('(P2) plugin giu Promise recoverJournals (areaedReady) va da xong', typeof server.areaedReady?.then === 'function' && (await Promise.race([server.areaedReady.then(() => 'xong'), new Promise(r => setTimeout(() => r('treo'), 3000))])) === 'xong');

    // (P2) chon theo anh THUC SU trung con tro (mai depth H+1 che than depth y)
    await resetEdits();
    const kitsAll = await (await fetch(base + '__areaed/kits')).json();
    const cwall = kitsAll.find(k => k.kit === 'C-B3'), A_NAME = Object.entries(cwall.pieces).find(([, p]) => p.pair)[0];
    const bases = kitsAll.filter(k => k.kit in s0.kits).flatMap(k => Object.entries(k.pieces).filter(([, p]) => p.layer === 'base' && !p.pair && p.w >= 24 && p.h >= 24).map(([n]) => k.kit + '/' + n)).slice(0, 25);
    await ev(n => window.__areaed.add('C-B3/' + n, 640, 900), A_NAME);
    const found = await ev(async bases => {
      const a = window.__areaed, S = a.state(), A = S.count - 1, roofs = window.__scene.kitImages.filter(o => o.getData('placement') === A && /_roof$/.test(o.getData('kitPiece')));
      if (!roofs.length) return { err: 'khong co anh mai' };
      const r = roofs[0], pts = []; for (let yy = 2; yy < r.height; yy += 4) for (let xx = 2; xx < r.width; xx += 4) pts.push([r.x + xx, r.y + yy]);
      for (const k of bases) for (const off of [6, 20]) {
        const sz = window.__areaed.state(); await a.add(k, 640, 900 + off); const B = a.state().count - 1;
        for (const [x, y] of pts) { const h = a.hitsAt(x, y); if (h.length >= 2 && h[0].i === A && h.some(q => q.i === B)) {
          const mainA = a.placement(A).find(g => g.k === S.pieces[A].k).depth, mainB = a.placement(B)[0].depth;
          return { A, B, x, y, pick: a.pickAt(x, y), mainA, mainB, k }; } }
        await a.undo();
      }
      return { err: 'khong tim duoc diem mai A chong than B' };
    }, bases);
    check('(P2) hit-test theo anh trung: mai (depth H+1) che than cua placement khac -> chon placement cua mai', !found.err && found.pick === found.A && found.mainB > found.mainA, JSON.stringify(found));
    await resetEdits();

    // (P2) lam tron toa do dich + gop nudge theo tap chon
    const fi = s0.pieces.findIndex(p => !Number.isInteger(p.y) || !Number.isInteger(p.x));
    check('(P2) HVQ co placement toa do le (vd y 827.2)', fi >= 0, JSON.stringify(s0.pieces[fi]));
    const pf = s0.pieces[fi];
    await ev(i => window.__areaed.select([i]), fi);
    await page.fill('#aed-y', String(Math.round(pf.y))); await page.press('#aed-y', 'Enter');
    { const s = await st(); check('(P2) nhap y=lam tron cua 623.8-kieu: ghi so nguyen (khong giu so le)', s.pieces[fi].y === Math.round(pf.y) && Number.isInteger(s.pieces[fi].x) && Number.isInteger(s.pieces[fi].y) && s.undo === 1, `${JSON.stringify(pf)} -> ${JSON.stringify(s.pieces[fi])}`); }
    await resetEdits(); await ev(i => window.__areaed.select([i]), fi); await ev(() => window.__areaed.duplicate());
    { const s = await st(), n = s.pieces.at(-1); check('(P2) duplicate ra toa do nguyen (khong 631.8)', Number.isInteger(n.x) && Number.isInteger(n.y) && n.x === Math.round(pf.x + 8) && n.y === Math.round(pf.y + 8), JSON.stringify(n)); }
    await resetEdits(); await ev(i => window.__areaed.select([i]), fi); await bp(); await page.keyboard.press('ArrowDown');
    { const s = await st(); check('(P2) nudge len muc le -> toa do dich nguyen', Number.isInteger(s.pieces[fi].y) && s.pieces[fi].y === Math.round(pf.y + 1), JSON.stringify(s.pieces[fi])); }
    await resetEdits();
    const other = idx === 0 ? 1 : 0;
    await ev(i => window.__areaed.select([i]), idx); await page.keyboard.press('ArrowRight'); await page.keyboard.press('ArrowRight');
    const u1 = (await st()).undo;
    await ev(i => window.__areaed.select([i]), other); await page.keyboard.press('ArrowRight'); await page.keyboard.press('ArrowRight');
    const u2 = (await st()).undo, mv = await st();
    await ev(() => window.__areaed.undo());
    const mid = await st();
    check('(P2) nudge chi gop khi cung tap chon: cung chon 2 lan = 1 buoc, doi chon = buoc moi', u1 === 1 && u2 === 2 && mid.pieces[other].x === s0.pieces[other].x && mid.pieces[idx].x === s0.pieces[idx].x + 2, `undo ${u1}->${u2}`);
    await resetEdits();

    // (P2) phan hoi luu cua khu cu khong ghi baseHash vao khu moi
    await ev(i => window.__areaed.select([i]), idx); await ev(() => window.__areaed.moveBy(1, 0));
    let held = null; const FAKE = 'f'.repeat(64);
    await page.route('**/__areaed/save', route => { held = route; });
    const savePromise = page.evaluate(() => window.__areaed.save());
    for (let t = 0; t < 50 && !held; t++) await page.waitForTimeout(100);
    check('(P2) yeu cau luu dang cho (khu cu)', !!held);
    await ev(() => { window.__scene.scene.restart({ area: 'son-dao-v3' }); return 1; });
    await page.waitForFunction(() => window.__areaed.state()?.id === 'son-dao-v3' && window.__scene?.areaId === 'son-dao-v3', null, { timeout: 30000 });
    await ev(() => window.__areaed.ready());
    const hBefore = (await st()).baseHash;
    await held.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, hash: FAKE, ms: 1 }) });
    await savePromise; await page.waitForTimeout(200);
    const sNew = await st();
    check('(P2) phan hoi cua khu cu bi bo: khu moi giu baseHash, khong bao "da luu"', sNew.id === 'son-dao-v3' && sNew.baseHash === hBefore && sNew.baseHash !== FAKE && sNew.op === null && !sNew.dirty, JSON.stringify({ id: sNew.id, same: sNew.baseHash === hBefore, op: sNew.op }));
    await page.unroute('**/__areaed/save');
    for (const k of await ev(() => Object.keys(localStorage).filter(k => k.startsWith('areaed:draft:')))) await ev(k => localStorage.removeItem(k), k);
    await reopen();
  }
  const realErr = errors.filter(e => !/status of 409/.test(e));   // 409 la phan hoi conflict mong doi cua test (e)
  check('khong loi console/pageerror o luot nay', realErr.length === 0, JSON.stringify(realErr.slice(0, 3)));
  console.log(PART ? `\nEDITOR E2E PART ${PART} PASS (${checks} kiem tra)` : `\nEDITOR E2E PASS (${checks} kiem tra)`);
  if (PART === 7) console.log('EDITOR E2E PASS (7 luot)');
} catch (e) {
  console.error('EDITOR E2E FAIL:', e.message);
  process.exitCode = 1;
} finally { await cleanup(); }
