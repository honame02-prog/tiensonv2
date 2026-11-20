// Do FPS + ro ri cho FxPlayer: node tools/fx_test.mjs [baseUrl]   (can preview dang chay, mac dinh http://localhost:8080/)
// Chay desktop 960x540 va mobile 844x390 dpr3 + CPU 4x. Anh: shots/fx_<cue>.png (desktop, ~300 ms sau khi phat).
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const base = process.argv[2] || 'http://localhost:8080/';
const url = base + (base.includes('?') ? '&' : '?') + 'fx=1';
mkdirSync('shots', { recursive: true });
const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const fps = page => page.evaluate(() => Math.round(__game.loop.actualFps));
const result = {};

async function run(name, ctxOpts, rate) {
  const ctx = await browser.newContext(ctxOpts);
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  if (rate > 1) await (await ctx.newCDPSession(page)).send('Emulation.setCPUThrottlingRate', { rate });
  await page.goto(url, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__fxscene && window.__fx, null, { timeout: 60000 });
  await page.waitForTimeout(2000);
  const r = { cpuThrottle: rate };
  const sample = async () => { const a = []; for (let i = 0; i < 5; i++) { a.push(await fps(page)); await page.waitForTimeout(1000); } return a; };
  r.idleFps = await sample();
  if (name === 'desktop') {
    const ids = await page.evaluate(() => ['demo-bang-vong', 'demo-hoa-cot', 'demo-kim-giang']);
    for (let i = 0; i < 3; i++) {
      await page.evaluate(i => __fxscene.cast(i), i);
      await page.waitForTimeout(300);
      await page.screenshot({ path: `shots/fx_${ids[i].replace('demo-', '')}.png` });
      await page.waitForTimeout(2500);
    }
  }
  await page.evaluate(() => __fxscene.setLoop(true));
  await page.waitForTimeout(3000);
  const peak = { particles: 0, objects: 0, active: 0 };
  const a = [];
  for (let i = 0; i < 5; i++) {
    a.push(await fps(page));
    const s = await page.evaluate(() => __fx.stats());
    for (const k in peak) peak[k] = Math.max(peak[k], s[k]);
    await page.waitForTimeout(1000);
  }
  r.playFps = a; r.peakStats = peak;
  await page.evaluate(() => __fxscene.setLoop(false));
  await page.waitForTimeout(5000);   // cho hat tan het
  r.afterStop = await page.evaluate(() => ({ ...__fx.stats(), dimV: __fx._dimV, hitFrozen: __fx._frozen }));
  r.leak = r.afterStop.active + r.afterStop.objects + r.afterStop.particles !== 0 || r.afterStop.dimV !== 255 || r.afterStop.hitFrozen;
  r.errs = errs;
  result[name] = r;
  await ctx.close();
}

await run('desktop', { viewport: { width: 960, height: 540 } }, 1);
await run('mobile_cpu4x', { viewport: { width: 844, height: 390 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true }, 4);
console.log(JSON.stringify(result, null, 1));
await browser.close();
