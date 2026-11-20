// Test khu vuc (AREA-1): node tools/area_test.mjs [baseUrl]   (khong co baseUrl: tu bat `vite preview` cong 8100, can `npm run build` truoc; chi tat PID minh mo)
// Kiem: vao Huyen Van Quan -> di bo qua cong sang Son Dao (spawn north) -> di bo ve lai (spawn gate), lap 3 lan; so display object / texture / DOM khong tang;
// 0 loi console; nhan cong hien khi lai gan; FPS moi khu; va cham (khong xuyen khoi chan o Son Dao: bien rung + da); anh shots/area_*.png.
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
mkdirSync('shots', { recursive: true });
let srv = null, base = process.argv[2];
if (!base) { srv = spawn(process.execPath, ['node_modules/vite/bin/vite.js', 'preview', '--port', '8100', '--strictPort'], { stdio: 'ignore' }); base = 'http://localhost:8100/';
  for (let i = 0; i < 40; i++) { try { if ((await fetch(base)).ok) break; } catch (e) { /* cho */ } await new Promise(r => setTimeout(r, 250)); } }
const out = []; let fail = 0;
const check = (n, ok, info = '') => { out.push(`${ok ? 'OK  ' : 'LOI '} ${n} ${info}`); if (!ok) fail++; };
const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
try {
  const ctx = await browser.newContext({ viewport: { width: 960, height: 540 } });
  await ctx.addInitScript(() => { try { localStorage.clear(); } catch (e) { /* */ } });
  const page = await ctx.newPage(), errs = [];
  page.on('pageerror', e => errs.push(e.message));
  page.on('console', m => { if ((m.type() === 'error' || m.type() === 'warning') && !/GL Driver Message|CONTEXT_LOST_WEBGL: loseContext/.test(m.text())) errs.push(m.type() + ': ' + m.text()); });
  const inArea = (id) => page.waitForFunction((id) => window.__scene?.meta?.id === id && window.__scene.player?.active && !window.__scene.busy, id, { timeout: 20000 });
  const stats = () => page.evaluate(() => ({ area: __scene.meta.id, objs: __scene.children.list.length, tex: Object.keys(__game.textures.list).length, anims: __game.anims.anims.size,
    dom: document.getElementsByTagName('*').length, ui: document.querySelectorAll('#ui').length, tweens: __scene.tweens.getTweens().length, px: Math.round(__scene.player.x), py: Math.round(__scene.player.y) }));
  const hold = async (key, ms) => { await page.keyboard.down(key); await page.waitForTimeout(ms); await page.keyboard.up(key); };
  const fps = async () => { await page.waitForTimeout(800); const v = []; for (let i = 0; i < 6; i++) { await page.waitForTimeout(400); v.push(await page.evaluate(() => __game.loop.actualFps)); } return Math.round(v.reduce((a, b) => a + b, 0) / v.length * 10) / 10; };
  const tele = (x, y) => page.evaluate(([x, y]) => { __scene.player.setPosition(x, y); __scene.player.setVelocity(0, 0); __scene.cameras.main.centerOn(x, y); }, [x, y]);

  await page.goto(base, { waitUntil: 'load' });
  await inArea('huyen-van-quan'); await page.waitForTimeout(1500);
  const s0 = await stats(); out.push('HVQ vao dau: ' + JSON.stringify(s0));
  check('HVQ spawn mac dinh (496,563)', Math.abs(s0.px - 496) < 3 && Math.abs(s0.py - 563) < 4);
  const fpsHvq = await fps(); out.push(`FPS HVQ (swiftshader, 960x540): ${fpsHvq}`);
  await page.locator('canvas').screenshot({ path: 'shots/area_hvq.png' });

  // nhan cong khi lai gan (HVQ chan cau thang) + anh cong
  await tele(496, 905); await page.waitForTimeout(700);
  const lab = await page.evaluate(() => { const p = document.querySelector('#ui .prompt'); return { disp: p.style.display, txt: p.textContent }; });
  check('nhan cong HVQ hien khi lai gan', lab.disp === 'block' && /Sơn Đạo/.test(lab.txt), JSON.stringify(lab));
  await page.locator('canvas').screenshot({ path: 'shots/area_portal.png' });
  await page.evaluate(() => document.getElementById('ui').style.visibility = 'visible');

  // qua - ve 3 lan (di bo that: giu phim)
  const arrive = { 'son-dao': [], 'huyen-van-quan': [] };
  for (let n = 1; n <= 3; n++) {
    await tele(496, 925); await page.waitForTimeout(300);
    await page.keyboard.down('ArrowDown'); await page.waitForFunction(() => __scene.busy, null, { timeout: 8000 }).catch(() => {}); await page.keyboard.up('ArrowDown');
    await inArea('son-dao'); await page.waitForTimeout(900);
    const a = await stats(); arrive['son-dao'].push(a); out.push(`lan ${n} -> Son Dao: ` + JSON.stringify(a));
    check(`lan ${n}: vao Son Dao dung spawn north`, a.area === 'son-dao' && Math.abs(a.px - 330) < 6 && a.py > 40 && a.py < 70, `(${a.px},${a.py})`);
    if (n === 1) {
      const labS = await page.evaluate(() => ({ t: document.querySelector('#ui .title b').textContent }));
      check('ten khu hien khi vao: Son Dao', labS.t === 'Sơn Đạo', labS.t);
      await page.waitForTimeout(500);
      await tele(330, 66); await page.waitForTimeout(500);
      const l2 = await page.evaluate(() => { const p = document.querySelector('#ui .prompt'); return { disp: p.style.display, txt: p.textContent }; });
      check('nhan cong Son Dao hien khi lai gan', l2.disp === 'block' && /Huyền Vân Quan/.test(l2.txt), JSON.stringify(l2));
      await page.locator('canvas').screenshot({ path: 'shots/area_sondao_player.png' });
    }
    await tele(330, 60); await page.waitForTimeout(300);
    await page.keyboard.down('ArrowUp'); await page.waitForFunction(() => __scene.busy, null, { timeout: 8000 }).catch(() => {}); await page.keyboard.up('ArrowUp');
    await inArea('huyen-van-quan'); await page.waitForTimeout(900);
    const b = await stats(); arrive['huyen-van-quan'].push(b); out.push(`lan ${n} -> HVQ: ` + JSON.stringify(b));
    check(`lan ${n}: ve HVQ dung spawn gate`, b.area === 'huyen-van-quan' && Math.abs(b.px - 496) < 6 && Math.abs(b.py - 738) < 6, `(${b.px},${b.py})`);
  }
  for (const id of Object.keys(arrive)) {
    const L = arrive[id], k = ['objs', 'tex', 'anims', 'dom', 'ui', 'tweens'];
    check(`${id}: objs/tex/anims/dom/ui/tweens khong doi qua 3 lan`, L.every(s => k.every(f => s[f] === L[0][f])), k.map(f => `${f}=${L.map(s => s[f]).join('/')}`).join(' '));
  }
  check('HVQ sau 3 vong = HVQ luc dau (objs, tex)', arrive['huyen-van-quan'][2].objs === s0.objs && arrive['huyen-van-quan'][2].tex === s0.tex, `objs ${s0.objs}->${arrive['huyen-van-quan'][2].objs}, tex ${s0.tex}->${arrive['huyen-van-quan'][2].tex}`);
  check('dung 1 UI trong DOM', arrive['huyen-van-quan'][2].ui === 1);

  // Son Dao: FPS, va cham, anh
  await page.goto(base + '?area=son-dao', { waitUntil: 'load' }); await inArea('son-dao'); await page.waitForTimeout(1200);
  const fpsSd = await fps(); out.push(`FPS Son Dao (swiftshader, 960x540): ${fpsSd}`);
  check('FPS Son Dao >= 0.8 x FPS HVQ', fpsSd >= fpsHvq * 0.8, `${fpsSd} vs ${fpsHvq}`);
  // (1) bien rung trai: o chan x<64 quanh y=300
  await tele(140, 300); await hold('ArrowLeft', 2500); let p = await stats();
  check('khong xuyen bien rung trai (x >= 62)', p.px >= 62 && p.px < 100, `x=${p.px}`);
  await tele(520, 470); await hold('ArrowRight', 2500); p = await stats();
  check('khong xuyen bien rung phai (x <= 608: luoi chan 32 px)', p.px <= 608 && p.px > 540, `x=${p.px}`);
  // (2) day vao 1 da / cay: lay prop, dat o phia nam, day len
  for (const kind of ['rock', 'pine']) {
    const t = await page.evaluate((kind) => { const FOOT = { rock_a: [26, 9], rock_b: [22, 8], rock_c: [16, 6], pine_a: [26, 10], pine_b: [26, 10] };
      // chon prop co o trong phia nam 40 px (khong bi chan khac): thu lan luot
      const c = __scene.meta.props.filter(q => q.key.startsWith(kind)); const free = (x, y) => { const cx = Math.floor(x / 32), cy = Math.floor(y / 32); return !(__scene.meta.col[cy] || [])[cx]; };
      const q = c.find(q => free(q.x, q.y + 36) && free(q.x, q.y + 20) && q.x > 100 && q.x < 540 && q.y > 100 && q.y < 760 && !c.some(o => o !== q && Math.abs(o.x - q.x) < 40 && o.y > q.y - 10 && o.y < q.y + 60));
      return q ? { ...q, h: FOOT[q.key][1] } : null; }, kind);
    if (!t) { check(`va cham ${kind}: tim duoc prop de thu`, false); continue; }
    await tele(t.x, t.y + 36); await hold('ArrowUp', 1800); const r = await stats();
    check(`khong xuyen ${t.key} tai (${t.x},${Math.round(t.y)}): chan lai o y >= ${Math.round(t.y + 5)}`, r.py >= t.y + 5 && Math.abs(r.px - t.x) < 14, `chan o (${r.px},${r.py})`);
  }
  // anh toan canh (thu nho) bang camera zoom, khung dung
  const page2 = await ctx.newPage(); const errs2 = [];
  page2.on('pageerror', e => errs2.push(e.message));
  await page2.setViewportSize({ width: 540, height: 960 });
  await page2.goto(base + '?area=son-dao', { waitUntil: 'load' });
  await page2.waitForFunction(() => window.__scene?.meta?.id === 'son-dao' && window.__scene.player?.active, null, { timeout: 20000 });
  await page2.waitForTimeout(1200);
  await page2.evaluate(() => { const c = __scene.cameras.main; c.stopFollow(); c.setBounds(-200, -200, 1040, 1200); c.setZoom(0.4); c.centerOn(320, 400); document.getElementById('ui').style.visibility = 'hidden'; });
  await page2.waitForTimeout(500);
  await page2.locator('canvas').screenshot({ path: 'shots/area_sondao.png' });
  check('0 loi console (trang chinh + trang anh toan canh)', errs.length === 0 && errs2.length === 0, JSON.stringify([...errs, ...errs2]).slice(0, 400));
} catch (e) { check('test chay het', false, String(e.stack || e).slice(0, 600)); }
finally { await browser.close(); if (srv) srv.kill(); }
console.log(out.join('\n')); console.log(fail ? `\n${fail} LOI` : '\nTAT CA DAT');
process.exit(fail ? 1 : 0);
