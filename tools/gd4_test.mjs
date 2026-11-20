// Test GD4 (track anim / atlas SkillFX): node tools/gd4_test.mjs [baseUrl]
// Khong co baseUrl: tu bat `vite preview` (can `npm run build` truoc) tren cong 8095 va tu tat (chi PID minh mo).
// Kiem: atlas nap + anim tao, phim 5 phat anim (origin theo meta.pivot, depth body), blend add, tu huy + khong ro ri,
// khong loi console, FxLab chon atlas/tag (ca nhanh nap atlas luc chay), anh shots/gd4_anim.png (khung giua luc dang phat).
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
mkdirSync('shots', { recursive: true });

let srv = null, base = process.argv[2];
if (!base) {
  const port = 8095;
  srv = spawn(process.execPath, ['node_modules/vite/bin/vite.js', 'preview', '--port', String(port), '--strictPort'], { stdio: 'ignore' });
  base = `http://localhost:${port}/`;
  for (let i = 0; i < 40; i++) { try { if ((await fetch(base)).ok) break; } catch (e) { /* cho */ } await new Promise(r => setTimeout(r, 250)); }
}
const out = []; let fail = 0;
const check = (name, ok, info = '') => { out.push(`${ok ? 'OK  ' : 'LOI '} ${name} ${info}`); if (!ok) fail++; };
const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
try {
  const ctx = await browser.newContext({ viewport: { width: 960, height: 540 } });
  await ctx.addInitScript(() => { try { localStorage.clear(); } catch (e) { /* */ } });
  const page = await ctx.newPage(), errs = [];
  page.on('pageerror', e => errs.push(e.message));
  page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') errs.push(m.type() + ': ' + m.text()); });
  await page.goto(base + '?fxlab=1', { waitUntil: 'load' });
  await page.waitForFunction(() => window.__fxlab && window.__fxlab.atlases.length > 0, null, { timeout: 60000 });
  await page.waitForTimeout(1500);
  const animSprites = () => page.evaluate(() => __scene.children.list.filter(o => o.__fx && o.type === 'Sprite' && o.texture.key === 'vocab-strike').length);
  const idle = () => page.waitForFunction(() => __fx.stats().active === 0, null, { timeout: 8000 });

  // 1. atlas + anim
  const info = await page.evaluate(() => ({
    tex: __scene.textures.exists('vocab-strike'), anim: __scene.anims.exists('vocab-strike'),
    frames: __scene.anims.get('vocab-strike')?.frames.length, manifest: __fxlab.atlases.map(a => a.key),
    cue: !!__fx.cues['demo-anim-strike'],
  }));
  check('atlas nap + anim tao', info.tex && info.anim && info.frames === 61, JSON.stringify(info));
  check('manifest index.json co vocab-strike', info.manifest.includes('vocab-strike'));

  // 2. phim 5 phat anim
  await page.keyboard.press('5');
  await page.waitForTimeout(100);
  const s1 = await page.evaluate(() => ({ st: __fx.stats(), n: __scene.children.list.filter(o => o.__fx && o.type === 'Sprite' && o.texture.key === 'vocab-strike').map(o => ({ ox: o.originX, oy: o.originY, depth: o.depth, x: o.x, y: o.y, blend: o.blendMode, playing: o.anims.isPlaying })), py: __scene.player.y, px: __scene.player.x }));
  check('phim 5: 1 run active, 1 sprite anim dang phat', s1.st.active === 1 && s1.n.length === 1 && s1.n[0].playing, JSON.stringify(s1.n));
  check('origin theo meta.pivot (44/176, 100/140)', Math.abs(s1.n[0].ox - 0.25) < 1e-6 && Math.abs(s1.n[0].oy - 100 / 140) < 1e-6, `${s1.n[0].ox},${s1.n[0].oy}`);
  check('depth = y+0.5 (lop body), vi tri = chan nguoi choi', s1.n[0].depth === Math.round(s1.py) + 0.5 && s1.n[0].x === Math.round(s1.px), `depth ${s1.n[0].depth} y ${s1.py}`);
  check('blend normal (0)', s1.n[0].blend === 0, String(s1.n[0].blend));
  await page.waitForTimeout(550);   // ~750 ms tinh ca chup: dang o cu dam nang (khung 22)
  const mid = await page.evaluate(() => { const s = __scene.children.list.find(o => o.__fx && o.type === 'Sprite' && o.texture.key === 'vocab-strike'); return s ? s.anims.currentFrame.index : -1; });
  check('giua luc phat: khung > 10', mid > 10, `frame ${mid}`);
  await page.click('#fxlab .hd');   // gap bang de thay tron anim
  await page.screenshot({ path: 'shots/gd4_anim.png' });
  await page.click('#fxlab .hd');
  await idle();
  await page.waitForTimeout(200);
  const e1 = await page.evaluate(() => ({ ...__fx.stats(), spr: __scene.children.list.filter(o => o.__fx && o.type === 'Sprite').length }));
  check('het anim: stats ve 0, khong sprite FX con lai', e1.active === 0 && e1.objects === 0 && e1.particles === 0 && e1.spr === 0, JSON.stringify(e1));

  // 3. blend add + scale + stop giua chung (khong ro ri)
  await page.evaluate(() => { __fx.play({ id: 'tmp-add', duration: 1000, tracks: [{ at: 0, type: 'anim', atlas: 'vocab-strike', anim: 'vocab-strike', blend: 'add', layer: 'overlay', fps: 60 }] }, { x: 300, y: 300, scale: 2 }); });
  await page.waitForTimeout(150);
  const s2 = await page.evaluate(() => { const o = __scene.children.list.find(o => o.__fx && o.type === 'Sprite' && o.texture.key === 'vocab-strike'); return { blend: o.blendMode, depth: o.depth, sc: o.scaleX, fr: o.anims.msPerFrame }; });
  check('blend add (1), overlay 9500, scale 2, fps 60 -> msPerFrame ~16.7', s2.blend === 1 && s2.depth === 9500 && s2.sc === 2 && Math.abs(s2.fr - 1000 / 60) < 0.5, JSON.stringify(s2));
  await idle();
  const e2 = await page.evaluate(() => ({ ...__fx.stats(), spr: __scene.children.list.filter(o => o.__fx && o.type === 'Sprite').length }));
  check('anim 60fps: tu huy, ve 0', e2.objects === 0 && e2.spr === 0, JSON.stringify(e2));
  await page.evaluate(() => { for (let i = 0; i < 5; i++) __fxdemo.castAnim().stop(); __fxdemo.castAnim(); });
  await page.evaluate(() => __fx.runs.forEach(r => r.kill()));
  const e3 = await page.evaluate(() => ({ ...__fx.stats(), spr: __scene.children.list.filter(o => o.__fx && o.type === 'Sprite').length }));
  check('stop/kill: khong ro ri', e3.active === 0 && e3.objects === 0 && e3.spr === 0, JSON.stringify(e3));
  // thieu atlas: bo qua, khong nem loi
  const warned = await page.evaluate(() => { const w = console.warn; let n = 0; console.warn = () => { n++; }; __fx.play({ id: 'tmp-x', duration: 200, tracks: [{ at: 0, type: 'anim', atlas: 'khong-co', anim: 'x', dur: 100 }] }, { x: 10, y: 10 }); console.warn = w; return n; });
  errs.length = 0;   // canh bao thieu atlas la co chu y o tren; khong tinh vao loi console
  await idle();

  // 4. FxLab
  await page.evaluate(() => { __fxlab.select('demo-anim-strike'); __fxlab.panel.open.add(__fxlab.cue.tracks[0]); __fxlab.panel.render(); });
  const sel = page.locator('#fxlab .atlas-sel').first();
  check('FxLab: o chon atlas co vocab-strike', (await sel.locator('option').allTextContents()).some(t => t.startsWith('vocab-strike')), String(await sel.locator('option').allTextContents()));
  check('FxLab: o chon tag co vocab-strike', (await page.locator('#fxlab .tag-sel').first().locator('option').allTextContents()).includes('vocab-strike'));
  await page.evaluate(() => { __fxlab.play(); });
  await page.waitForTimeout(200);
  check('FxLab: phat cue anim', await animSprites() === 1);
  await idle();
  // ep nap lai atlas luc chay: go texture + json roi chon lai
  await page.evaluate(() => { __scene.anims.remove('vocab-strike'); __scene.textures.remove('vocab-strike'); __scene.cache.json.remove('vocab-strike'); __fx._atlasOk.clear(); });
  check('da go atlas', await page.evaluate(() => !__fx.hasAtlas('vocab-strike')));
  await sel.selectOption('vocab-strike');
  await page.waitForFunction(() => __fx.hasAtlas('vocab-strike'), null, { timeout: 8000 });
  await page.waitForTimeout(250);
  check('FxLab: chon atlas -> nap luc chay + phat lai', await animSprites() === 1 && await page.evaluate(() => __scene.anims.exists('vocab-strike')));
  await idle();
  // them track anim moi vao cue khac
  await page.evaluate(() => { __fxlab.select('demo-hoa-cot'); __fxlab.addTrack('anim'); });
  const t = await page.evaluate(() => __fxlab.cue.tracks.at(-1));
  check('FxLab: them track anim', t.type === 'anim' && t.atlas === 'vocab-strike');
  await page.evaluate(() => __fxlab.reset());
  await idle();
  check('0 loi console', errs.length === 0, errs.join(' | '));
  check('thieu atlas: co canh bao, khong nem loi', warned >= 1, String(warned));
  await ctx.close();
} finally {
  await browser.close();
  if (srv) srv.kill();
}
console.log(out.join('\n'));
console.log(fail ? `TONG: ${fail} LOI` : 'TONG: tat ca dat');
process.exit(fail ? 1 : 0);
