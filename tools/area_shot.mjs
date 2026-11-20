// Chup anh khu vuc de so sanh diem anh: node tools/area_shot.mjs <tien-to-anh> [baseUrl]   (vd base -> shots/base_hvq_0.png ...)
// Khong co baseUrl: tu bat `vite` dev cong 5190 (chi PID minh mo). Dong (may troi, ca, khoi, la, nhan vat) bi an truoc khi chup; ghi them tong kiem doi tuong.
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
mkdirSync('shots', { recursive: true });
const prefix = process.argv[2] || 'base'; let srv = null, base = process.argv[3];
if (!base) { srv = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--port', '5190', '--strictPort'], { stdio: 'ignore' }); base = 'http://localhost:5190/';
  for (let i = 0; i < 60; i++) { try { if ((await fetch(base)).ok) break; } catch (e) { /* cho */ } await new Promise(r => setTimeout(r, 250)); } }
const POINTS = [[496, 563, 'up'], [166, 640, 'right'], [496, 330, 'up'], [496, 800, 'down'], [496, 930, 'down'], [330, 1000, 'right'], [800, 160, 'down'], [600, 450, 'left']];
const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
try {
  const census = {};
  for (let i = 0; i < POINTS.length; i++) {
    const [x, y, f] = POINTS[i];
    const ctx = await browser.newContext({ viewport: { width: 960, height: 540 } });
    await ctx.addInitScript(() => { try { localStorage.clear(); } catch (e) { /* */ } });
    const page = await ctx.newPage(); const errs = [];
    page.on('pageerror', e => errs.push(e.message));
    await page.goto(`${base}?area=huyen-van-quan&x=${x}&y=${y}&face=${f}`, { waitUntil: 'load' });
    await page.waitForFunction(() => window.__scene && window.__scene.player, null, { timeout: 50000 });
    await page.waitForTimeout(1800);
    const c = await page.evaluate(() => {
      const s = __scene, cnt = {};
      for (const o of s.children.list) { const k = o.type + ':' + (o.texture?.key || ''); cnt[k] = (cnt[k] || 0) + 1; }
      for (const o of s.children.list) {
        if (['TileSprite', 'ParticleEmitter', 'Sprite', 'Graphics'].includes(o.type) || o.frame?.name === 'pond_glint' || o.texture?.key === 'shadow') o.setVisible(false);
      }
      s.foliage.forEach(f => f.img.setVisible(false)); document.getElementById('ui').style.visibility = 'hidden';
      return { n: s.children.list.length, cnt, textures: Object.keys(s.textures.list).length };
    });
    await page.waitForTimeout(400);
    await page.locator('canvas').screenshot({ path: `shots/${prefix}_hvq_${i}.png` });
    census[i] = { ...c, errs };
    await ctx.close();
  }
  writeFileSync(`shots/${prefix}_census.json`, JSON.stringify(census, null, 1));
  console.log('xong', POINTS.length, 'anh; loi:', JSON.stringify(Object.values(census).map(c => c.errs)), 'n0=', census[0].n);
} finally { await browser.close(); if (srv) srv.kill(); }
