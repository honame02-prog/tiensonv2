// Do FPS nen: node tools/fps_test.mjs [url] [cpuThrottle]  (mac dinh http://localhost:8080/, 1x)
import { chromium } from 'playwright';
const url = process.argv[2] || 'http://localhost:8080/';
const rate = +(process.argv[3] || 1);
const mobile = process.argv[4] === 'mobile';
const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const ctx = await browser.newContext(mobile ? { viewport: { width: 844, height: 390 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true } : { viewport: { width: 960, height: 540 } });
const page = await ctx.newPage();
const errs = []; page.on('pageerror', e => errs.push(e.message)); page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
const cdp = await ctx.newCDPSession(page);
if (rate > 1) await cdp.send('Emulation.setCPUThrottlingRate', { rate });
await page.goto(url, { waitUntil: 'load' });
await page.waitForFunction(() => window.__scene && window.__scene.player, null, { timeout: 60000 });
await page.waitForTimeout(1500);
await page.keyboard.down('ArrowRight'); await page.waitForTimeout(5000);
const samples = [];
for (let i = 0; i < 5; i++) { samples.push(await page.evaluate(() => Math.round(__game.loop.actualFps))); await page.waitForTimeout(1000); }
await page.keyboard.up('ArrowRight');
console.log(JSON.stringify({ url, mobile, cpuThrottle: rate, actualFpsSamples: samples, errs }));
await browser.close();
