// Test GD5 (Cot Linh Lanh Hoa top-down, 3 lop atlas): node tools/gd5_test.mjs [baseUrl]
// Khong co baseUrl: tu bat `vite preview` (can `npm run build` truoc) tren cong 8096 va tu tat (chi PID minh mo).
// Kiem: 3 atlas nap, phim 6 phat len hinh nom, depth floor < nom < front va back < nom, toa do sprite == chan nom (+-0,5), event freeze/hit,
// tint muc tieu 1,10-1,75 roi tra lai, het 2,5 s stats 0, 0 loi console, FPS trong luc phat; anh shots/gd5_hit.png (~1,3 s), shots/gd5_burst.png (~1,85 s).
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
mkdirSync('shots', { recursive: true });

let srv = null, base = process.argv[2];
if (!base) {
  const port = 8096;
  srv = spawn(process.execPath, ['node_modules/vite/bin/vite.js', 'preview', '--port', String(port), '--strictPort'], { stdio: 'ignore' });
  base = `http://localhost:${port}/`;
  for (let i = 0; i < 40; i++) { try { if ((await fetch(base)).ok) break; } catch (e) { /* cho */ } await new Promise(r => setTimeout(r, 250)); }
}
const out = []; let fail = 0;
const check = (name, ok, info = '') => { out.push(`${ok ? 'OK  ' : 'LOI '} ${name} ${info}`); if (!ok) fail++; };
const PARTS = ['floor', 'back', 'front'];
const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
try {
  const ctx = await browser.newContext({ viewport: { width: 960, height: 540 } });
  await ctx.addInitScript(() => { try { localStorage.clear(); } catch (e) { /* */ } });
  const page = await ctx.newPage(), errs = [];
  page.on('pageerror', e => errs.push(e.message));
  page.on('console', m => { if ((m.type() === 'error' || m.type() === 'warning') && !/GL Driver Message|CONTEXT_LOST_WEBGL: loseContext/.test(m.text())) errs.push(m.type() + ': ' + m.text()); });   // bo qua nhieu hieu nang swiftshader (GPU stall khi chup anh) va canh bao loseContext luc khoi dong (co san tu truoc GD5, swiftshader)
  await page.goto(base + '?fx=1', { waitUntil: 'load' });
  await page.waitForFunction(() => window.__fx && window.__fxdemo, null, { timeout: 60000 });
  await page.waitForTimeout(1500);
  const idle = () => page.waitForFunction(() => __fx.stats().active === 0, null, { timeout: 8000 });
  const waitT = ms => page.waitForFunction(ms => { const r = [...__fx.runs][0]; return !r || r.t >= ms; }, ms, { timeout: 8000, polling: 20 });

  // 1. atlas + cue
  const info = await page.evaluate(parts => ({
    cue: !!__fx.cues['cot-linh-td'],
    atl: parts.map(p => ({ p, tex: __scene.textures.exists('cotlinh-td-' + p), anim: __scene.anims.get('cotlinh-td-' + p)?.frames.length })),
  }), PARTS);
  check('cue cot-linh-td co mat', info.cue);
  check('3 atlas nap + anim 76 khung (75 + khung cuoi)', info.atl.every(a => a.tex && a.anim === 76), JSON.stringify(info.atl));

  // 2. phat phim 6
  await page.waitForTimeout(500);   // on dinh FPS truoc khi do
  await page.evaluate(() => { window.__fps = []; window.__fpsT = setInterval(() => window.__fps.push(__scene.game.loop.actualFps), 100); });
  await page.keyboard.press('6');
  await page.waitForTimeout(120);
  const s1 = await page.evaluate(() => {
    const d = __fxdemo.dummy, sp = __scene.children.list.filter(o => o.__fx && o.type === 'Sprite' && o.texture.key.startsWith('cotlinh-td-'));
    return { st: __fx.stats(), d: d && { x: d.x, y: d.y, depth: d.depth, tint: d.tintTopLeft }, px: __scene.player.x, py: __scene.player.y,
      sp: sp.map(o => ({ k: o.texture.key.slice(11), x: o.x, y: o.y, depth: o.depth, ox: o.originX, oy: o.originY, playing: o.anims.isPlaying })) };
  });
  const dist = s1.d ? Math.hypot(s1.d.x - s1.px, s1.d.y - s1.py) : -1;
  check('hinh nom ton tai, dung truoc mat Dao Si (cach ~56 px)', dist > 40 && dist < 70, JSON.stringify(s1.d) + ` dist ${dist.toFixed(1)}`);
  check('1 run active, 3 sprite anim dang phat', s1.st.active === 1 && s1.sp.length === 3 && s1.sp.every(o => o.playing), JSON.stringify(s1.sp));
  const by = Object.fromEntries(s1.sp.map(o => [o.k, o]));
  check('depth floor(-60) < nom < front, back < nom', by.floor.depth === -60 && by.floor.depth < s1.d.depth && by.back.depth < s1.d.depth && by.front.depth > s1.d.depth,
    `floor ${by.floor.depth} back ${by.back.depth} nom ${s1.d.depth} front ${by.front.depth}`);
  check('back = y-1, front = y+1 (sat than nom)', by.back.depth === s1.d.y - 1 && by.front.depth === s1.d.y + 1);
  check('toa do sprite anim == chan nom (+-0,5 px), 3 lop', s1.sp.every(o => Math.abs(o.x - s1.d.x) <= 0.5 && Math.abs(o.y - s1.d.y) <= 0.5), s1.sp.map(o => `${o.x},${o.y}`).join(' ') + ` nom ${s1.d.x},${s1.d.y}`);
  check('origin theo pivot (112/224, 122/176)', s1.sp.every(o => Math.abs(o.ox - 0.5) < 1e-6 && Math.abs(o.oy - 122 / 176) < 1e-6), s1.sp.map(o => `${o.ox},${o.oy}`).join(' '));

  // 3. tint 1,10-1,75 va anh ~1,3 s
  await waitT(1300);
  const mid = await page.evaluate(() => ({ t: [...__fx.runs][0]?.t, tint: __fxdemo.dummy.tintTopLeft, ev: [...(__scene.fxEvents || [])] }));
  check('1,3 s: da co event freeze, chua co hit', mid.ev.join() === 'freeze', JSON.stringify(mid));
  check('1,3 s: muc tieu bi nhuom bang (tint != goc 0xffb070)', mid.tint !== 0xffb070 && ((mid.tint >> 16) & 255) < 0xff, '0x' + mid.tint.toString(16));
  await page.screenshot({ path: 'shots/gd5_hit.png' });
  // 4. anh ~1,85 s
  await waitT(1850);
  await page.screenshot({ path: 'shots/gd5_burst.png' });
  const late = await page.evaluate(() => ({ t: [...__fx.runs][0]?.t, ev: [...__scene.fxEvents], tint: __fxdemo.dummy.tintTopLeft }));
  check('1,85 s: event freeze, hit theo thu tu; tint da tra lai goc', late.ev.join() === 'freeze,hit' && late.tint === 0xffb070, JSON.stringify(late));

  // 5. het 2,5 s
  await idle();
  await page.waitForTimeout(300);
  const fps = await page.evaluate(() => { clearInterval(window.__fpsT); const a = window.__fps.slice(2); return { n: a.length, avg: a.reduce((x, y) => x + y, 0) / a.length, min: Math.min(...a) }; });
  const e1 = await page.evaluate(() => ({ ...__fx.stats(), spr: __scene.children.list.filter(o => o.__fx && o.type === 'Sprite').length, tint: __fxdemo.dummy.tintTopLeft }));
  check('het cue: stats ve 0, khong sprite FX con lai', e1.active === 0 && e1.objects === 0 && e1.particles === 0 && e1.spr === 0, JSON.stringify(e1));
  check('muc tieu tra lai tint goc', e1.tint === 0xffb070);
  check(`FPS trong luc phat (swiftshader) avg ${fps.avg.toFixed(1)} min ${fps.min.toFixed(1)} (${fps.n} mau) >= 55`, fps.avg >= 55);
  // 6. phat lien tiep + stop giua chung, khong ro ri
  await page.evaluate(() => { __fxdemo.castTd(); __fxdemo.castTd().stop(); __fxdemo.castTd(); });
  await page.waitForTimeout(300);
  await page.evaluate(() => __fx.runs.forEach(r => r.kill()));
  const e2 = await page.evaluate(() => ({ ...__fx.stats(), spr: __scene.children.list.filter(o => o.__fx && o.type === 'Sprite').length }));
  check('stop/kill giua chung: khong ro ri', e2.active === 0 && e2.objects === 0 && e2.spr === 0, JSON.stringify(e2));
  // nut 6
  await page.locator('div[title="cot-linh-td"]').dispatchEvent('pointerdown');
  await page.waitForTimeout(150);
  check('nut 6 phat cue', await page.evaluate(() => __fx.stats().active === 1));
  await page.evaluate(() => __fx.runs.forEach(r => r.kill()));
  check('0 loi console', errs.length === 0, errs.join(' | '));
  await ctx.close();
} finally {
  await browser.close();
  if (srv) srv.kill();
}
console.log(out.join('\n'));
console.log(fail ? `TONG: ${fail} LOI` : 'TONG: tat ca dat');
process.exit(fail ? 1 : 0);
