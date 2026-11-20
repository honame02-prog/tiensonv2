// Headless screenshots of the sect zone: spots x {day, night} x {desktop, portrait, landscape}. Usage: node tools/sect_shot.mjs <url> <outdir> <tag> [spots]
import { chromium } from '/usr/local/lib/pnpm/5/.pnpm/playwright@1.63.0-alpha-2026-08-31/node_modules/playwright/index.mjs';
const URL = process.argv[2] || 'http://localhost:5199/index.html';
const SH = process.argv[3] || '/workspace/game-art/sect/shots/';
const tag = process.argv[4] || 's1';
const only = (process.argv[5] || '').split(',').filter(Boolean);
const browser = await chromium.launch({ executablePath: '/home/box/.cache/ms-playwright/chromium-1248/chrome-linux64/chrome', args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const spots = [['courtyard', 496, 560, 'up'], ['hall', 496, 300, 'up'], ['gate', 496, 700, 'down'], ['stairs', 496, 900, 'down'], ['pond', 236, 560, 'left'], ['landing', 420, 1000, 'down']];
const sizes = [['desktop', 1280, 720, 1, false], ['portrait', 390, 844, 3, true], ['landscape', 844, 390, 3, true]];
let total = 0;
for (const [name, w, h, dpr, mobile] of sizes) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: dpr, isMobile: mobile, hasTouch: mobile });
  for (const [s, x, y, f] of spots) {
    if (only.length && !only.includes(s)) continue;
    if (name !== 'desktop' && !['courtyard', 'gate', 'pond'].includes(s)) continue;
    for (const night of [false, true]) {
      const page = await ctx.newPage(); const errs = [];
      page.on('pageerror', e => errs.push(e.message)); page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') errs.push(m.type() + ': ' + m.text()); });
      page.on('requestfailed', r => errs.push('reqfail ' + r.url().slice(0, 80)));
      page.on('response', r => { if (r.status() >= 400) errs.push(r.status() + ' ' + r.url().slice(0, 100)); });
      await page.goto(`${URL}?x=${x}&y=${y}&face=${f}${night ? '&night=1' : ''}`);
      await page.waitForFunction(() => window.__scene && window.__scene.player, null, { timeout: 30000 });
      await page.waitForTimeout(2500);
      await page.screenshot({ path: `${SH}${tag}_${name}_${s}_${night ? 'night' : 'day'}.png` });
      if (errs.length) { console.log(name, s, night, errs); total += errs.length; }
      await page.close();
    }
  }
  await ctx.close();
}
await browser.close(); console.log('done, console issues:', total);
