// Anh toan canh 3 khu xam: node tools/blockout_shot.mjs [thu-muc-ra=review-graybox] [baseUrl]   (khong co baseUrl: tu bat vite dev cong 5191, chi tat PID minh mo)
// Moi khu: ?area=<id>, camera zoom ra het khu, an UI; kiem 0 loi console, nhan vat khong xuyen o chan (thu 1 o chan ngay canh spawn).
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
const outDir = process.argv[2] || 'review-graybox'; mkdirSync(outDir, { recursive: true });
let srv = null, base = process.argv[3];
if (!base) { srv = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--port', '5191', '--strictPort'], { stdio: 'ignore' }); base = 'http://localhost:5191/';
  for (let i = 0; i < 60; i++) { try { if ((await fetch(base)).ok) break; } catch (e) { /* cho */ } await new Promise(r => setTimeout(r, 250)); } }
const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
let fail = 0;
try {
  for (const [id, W, H] of [['huyen-van-quan-v2', 1280, 1600], ['son-dao-v3', 960, 1600], ['hau-son-v3', 1280, 1280]]) {
    const ctx = await browser.newContext({ viewport: { width: 540, height: 960 } }), page = await ctx.newPage(), errs = [];
    await ctx.addInitScript(() => { try { localStorage.clear(); } catch (e) { /* */ } });
    page.on('pageerror', e => errs.push(e.message));
    page.on('console', m => { if ((m.type() === 'error' || m.type() === 'warning') && !/GL Driver Message|CONTEXT_LOST_WEBGL/.test(m.text())) errs.push(m.text()); });
    await page.goto(`${base}?area=${id}`, { waitUntil: 'load' });
    await page.waitForFunction((id) => window.__scene?.meta?.id === id && window.__scene.player?.active, id, { timeout: 40000 });
    await page.waitForTimeout(1500);
    const info = await page.evaluate(([W, H]) => { const c = __scene.cameras.main, gw = __scene.scale.width, gh = __scene.scale.height, z = Math.min(gw / W, gh / H) * 0.98; c.stopFollow(); c.setBounds(-1000, -1000, W + 2000, H + 2000); c.setZoom(z); c.centerOn(W / 2, H / 2); document.getElementById('ui').style.visibility = 'hidden'; return { p: [Math.round(__scene.player.x), Math.round(__scene.player.y)], zoom: z }; }, [W, H]);
    await page.waitForTimeout(600);
    await page.locator('canvas').screenshot({ path: `${outDir}/${id}.png` });
    console.log(`${id}: spawn ${info.p}, zoom ${info.zoom.toFixed(3)}, loi console: ${errs.length}${errs.length ? ' ' + JSON.stringify(errs).slice(0, 300) : ''} -> ${outDir}/${id}.png`);
    if (errs.length) fail++;
    await ctx.close();
  }
} finally { await browser.close(); if (srv) srv.kill(); }
process.exit(fail ? 1 : 0);
