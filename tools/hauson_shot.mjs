// Anh 4 goc + giua khu Hau Son (1x, co Dao Si): node tools/hauson_shot.mjs [out.png] [baseUrl]   (khong co baseUrl: tu bat `vite preview` cong 8101, can `npm run build` truoc)
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { decodePng, encodePng } from './png.mjs';
const outFile = process.argv[2] || 'shots/hauson-4goc.png'; mkdirSync(dirname(outFile), { recursive: true });
let srv = null, base = process.argv[3];
if (!base) { srv = spawn(process.execPath, ['node_modules/vite/bin/vite.js', 'preview', '--port', '8101', '--strictPort'], { stdio: 'ignore' }); base = 'http://localhost:8101/';
  for (let i = 0; i < 40; i++) { try { if ((await fetch(base)).ok) break; } catch (e) { /* cho */ } await new Promise(r => setTimeout(r, 250)); } }
const PTS = [[70, 104, 'down'], [570, 104, 'down'], [320, 320, 'right'], [70, 560, 'up'], [570, 560, 'up']];
const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
try {
  const imgs = [];
  for (let i = 0; i < PTS.length; i++) {
    const [x, y, f] = PTS[i], ctx = await browser.newContext({ viewport: { width: 960, height: 540 } }), page = await ctx.newPage();
    await page.goto(`${base}?area=hau-son&x=${x}&y=${y}&face=${f}`, { waitUntil: 'load' });
    await page.waitForFunction(() => window.__scene?.meta?.id === 'hau-son' && window.__scene.player?.active, null, { timeout: 30000 });
    await page.waitForTimeout(1500);
    await page.evaluate(() => { document.getElementById('ui').style.visibility = 'hidden'; });
    const f1 = `shots/_hs_${i}.png`; await page.locator('canvas').screenshot({ path: f1 }); imgs.push(decodePng(f1)); await ctx.close();
  }
  const w = imgs[0].w, h = imgs[0].h, cols = 3, rows = 2, data = Buffer.alloc(cols * w * rows * h * 4, 0);
  imgs.forEach((im, k) => { const ox = (k % cols) * w, oy = Math.floor(k / cols) * h; for (let y = 0; y < h; y++) im.data.copy(data, ((oy + y) * cols * w + ox) * 4, y * w * 4, (y + 1) * w * 4); });
  encodePng({ w: cols * w, h: rows * h, data }, outFile); console.log('xong', outFile, cols * w, 'x', rows * h);
} finally { await browser.close(); if (srv) srv.kill(); }
