import { chromium } from '/usr/local/lib/pnpm/5/.pnpm/playwright@1.63.0-alpha-2026-08-31/node_modules/playwright/index.mjs';
const browser = await chromium.launch({ executablePath: '/home/box/.cache/ms-playwright/chromium-1248/chrome-linux64/chrome', args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const SH = '/workspace/game/shots/';
const results = {};
for (const [name, w, h] of [['landscape', 844, 390], ['portrait', 390, 844]]) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 3, isMobile: true, hasTouch: true,
    userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Mobile Safari/537.36' });
  const page = await ctx.newPage();
  const errs = []; page.on('pageerror', e => errs.push(e.message)); page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  await page.goto('file:///workspace/TienSon_choi_thu_mobile.html');
  await page.waitForFunction(() => window.__scene && window.__scene.player && window.__scene.touch, null, { timeout: 30000 });
  await page.waitForTimeout(1200);
  const cdp = await ctx.newCDPSession(page);
  const touch = (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts.map(([x, y, id]) => ({ x, y, id, radiusX: 4, radiusY: 4, force: 1 })) });
  const info = () => page.evaluate(() => { const s = __scene, r = s.game.canvas.getBoundingClientRect();
    return { px: Math.round(s.player.x), py: Math.round(s.player.y), frame: s.player.frame.name, zoom: s.scale.zoom, gw: s.scale.width, gh: s.scale.height,
      cl: r.left, ct: r.top, cw: r.width, ch: r.height, touchMode: !!s.touchMode, help: s.helpText.text, btn: s.touch.btnPos, btnR: s.touch.btnR,
      vec: [+s.touch.vec.x.toFixed(2), +s.touch.vec.y.toFixed(2)], joy: s.touch.joyId, dialog: s.dialog ? s.dialog.i : null, dtext: s.dlgText.text,
      scrollY: window.scrollY, vv: window.visualViewport?.scale }; });
  const r = { start: await info() };
  await page.screenshot({ path: `${SH}mobile_${name}_start.png` });
  const I = r.start, toCss = (gx, gy) => [I.cl + gx * I.zoom, I.ct + gy * I.zoom];
  // --- joystick drag: touch left-lower area, drag right+up
  const sx = w * 0.18, sy = h * 0.72;
  await touch('touchStart', [[sx, sy, 1]]);
  for (let i = 1; i <= 6; i++) { await touch('touchMove', [[sx + i * 10, sy - i * 4, 1]]); await page.waitForTimeout(30); }
  await page.waitForTimeout(700);
  r.dragging = await info();
  // multi-touch: press E button while joystick still held
  const [bx, by] = toCss(I.btn.x, I.btn.y);
  await touch('touchStart', [[sx + 60, sy - 24, 1], [bx, by, 2]]);
  await page.waitForTimeout(100);
  r.multi = await page.evaluate(() => ({ joy: __scene.touch.joyId, btn: __scene.touch.btnId, vec: [__scene.touch.vec.x, __scene.touch.vec.y] }));
  await page.screenshot({ path: `${SH}mobile_${name}_joystick.png` });
  await page.waitForTimeout(500);
  await touch('touchMove', [[sx + 60, sy - 24, 1]]);   // lift button only
  await touch('touchEnd', []);
  await page.waitForTimeout(200);
  r.afterDrag = await info();
  // --- go to NPC and tap E
  await page.evaluate(() => { const n = __scene.npc; __scene.player.setPosition(n.x - 26, n.y); });
  await page.waitForTimeout(500);
  r.prompt = await page.evaluate(() => __scene.prompt.visible && __scene.prompt.text);
  const tap = async (x, y, id = 5) => { await touch('touchStart', [[x, y, id]]); await page.waitForTimeout(60); await touch('touchEnd', []); await page.waitForTimeout(60); };
  await tap(bx, by);
  await page.waitForTimeout(2600);
  r.dialogOpen = await info();
  await page.screenshot({ path: `${SH}mobile_${name}_dialog.png` });
  // tap dialog box to advance
  const d = await page.evaluate(() => { const q = __scene.dlgRect; return { x: q.centerX, y: q.centerY }; });
  const [dx, dy] = toCss(d.x, d.y);
  await tap(dx, dy); await page.waitForTimeout(150);
  r.afterBoxTap = await page.evaluate(() => ({ i: __scene.dialog?.i, typing: __scene.typing }));
  await tap(dx, dy); await page.waitForTimeout(150); await tap(dx, dy);
  r.afterBoxTap2 = await page.evaluate(() => ({ i: __scene.dialog?.i, typing: __scene.typing }));
  r.errs = errs;
  results[name] = r;
  await ctx.close();
}
// --- orientation change on one page + keyboard still works (desktop)
{
  const ctx = await browser.newContext({ viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true, deviceScaleFactor: 3 });
  const page = await ctx.newPage(); await page.goto('file:///workspace/TienSon_choi_thu_mobile.html');
  await page.waitForFunction(() => window.__scene && window.__scene.player);
  await page.setViewportSize({ width: 390, height: 844 }); await page.waitForTimeout(1200);
  results.rotate = await page.evaluate(() => ({ gw: __scene.scale.width, gh: __scene.scale.height, zoom: __scene.scale.zoom, cam: [__scene.cameras.main.width, __scene.cameras.main.height], mist: [__scene.mistA.width, __scene.mistA.height] }));
  await page.screenshot({ path: SH + 'mobile_rotated_to_portrait.png' });
  await ctx.close();
  const c2 = await browser.newContext({ viewport: { width: 1280, height: 720 } }); const p2 = await c2.newPage();
  await p2.goto('file:///workspace/TienSon_choi_thu_mobile.html'); await p2.waitForFunction(() => window.__scene && window.__scene.player); await p2.waitForTimeout(500);
  const a = await p2.evaluate(() => [__scene.player.x, __scene.player.y, __scene.touchMode, __scene.touch.base.visible, __scene.scale.width, __scene.scale.height, __scene.scale.zoom]);
  await p2.keyboard.down('ArrowUp'); await p2.waitForTimeout(800); await p2.keyboard.up('ArrowUp');
  const b = await p2.evaluate(() => [__scene.player.x, __scene.player.y]);
  results.desktop = { before: a, after: b };
  await p2.screenshot({ path: SH + 'mobile_desktop_check.png' }); await c2.close();
}
console.log(JSON.stringify(results, null, 1));
await browser.close();
