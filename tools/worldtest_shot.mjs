import { chromium } from '/usr/local/lib/pnpm/5/.pnpm/playwright@1.63.0-alpha-2026-08-31/node_modules/playwright/index.mjs';
const URL = 'http://localhost:5199/worldtest7.html';
const SH = process.argv[2] || '/workspace/game-art/world/shots/';
const tag = process.argv[3] || 'v1';
const browser = await chromium.launch({ executablePath: '/home/box/.cache/ms-playwright/chromium-1248/chrome-linux64/chrome', args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const spots = [['path', 656, 432, 'down'], ['cliff', 520, 560, 'down_left'], ['stairs', 656, 300, 'up'], ['terrace', 820, 210, 'left'], ['westcliff', 260, 420, 'left']];
for (const [name, w, h, dpr, mobile] of [['desktop', 1280, 720, 1, false], ['portrait', 390, 844, 3, true], ['landscape', 844, 390, 3, true]]) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: dpr, isMobile: mobile, hasTouch: mobile });
  for (const [s, x, y, f] of spots) {
    if (name !== 'desktop' && !['path', 'cliff'].includes(s)) continue;
    const page = await ctx.newPage(); const errs = [];
    page.on('pageerror', e => errs.push(e.message)); page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
    await page.goto(`${URL}?x=${x}&y=${y}&face=${f}`);
    await page.waitForFunction(() => window.__scene && window.__scene.player, null, { timeout: 30000 });
    await page.waitForTimeout(1200);
    await page.screenshot({ path: `${SH}${tag}_${name}_${s}.png` });
    if (errs.length) console.log(name, s, errs);
    await page.close();
  }
  await ctx.close();
}
await browser.close(); console.log('done');
