import { chromium } from '/usr/local/lib/pnpm/5/.pnpm/playwright@1.63.0-alpha-2026-08-31/node_modules/playwright/index.mjs';
const FILE = 'file://' + (process.argv[2] || '/workspace/TienSon_DaoSi_mobile.html');
const SH = '/workspace/game/shots/daosi/';
const browser = await chromium.launch({ executablePath: '/home/box/.cache/ms-playwright/chromium-1248/chrome-linux64/chrome', args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const out = {}; const fails = [];
const ANG = { right: 0, down_right: 45, down: 90, down_left: 135, left: 180, up_left: 225, up: 270, up_right: 315 };
const st = p => p.evaluate(() => { const s = __scene, a = s.player.anims;
  return { anim: a.currentAnim?.key, playing: a.isPlaying, frame: s.player.frame.name, x: +s.player.x.toFixed(1), y: +s.player.y.toFixed(1),
    vx: Math.round(s.player.body.velocity.x), vy: Math.round(s.player.body.velocity.y), facing: s.facing, acting: s.acting, mag: s.touch.mag, dialog: !!s.dialog }; });
const center = p => p.evaluate(() => { const s = __scene, sp = s.interactables.map(i => i.x); // park in an open spot: spawn
  const sp0 = s.spawnPt; s.player.setPosition(sp0.x, sp0.y); s.player.setVelocity(0, 0); });
for (const [name, w, h] of [['portrait', 390, 844], ['landscape', 844, 390]]) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 3, isMobile: true, hasTouch: true,
    userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Mobile Safari/537.36' });
  const page = await ctx.newPage(); const errs = [];
  page.on('pageerror', e => errs.push(e.message)); page.on('console', m => { if (m.type() === 'error' || (m.type() === 'warning' && !m.text().includes('GL Driver Message'))) errs.push(m.type() + ': ' + m.text()); });
  await page.goto(FILE);
  await page.waitForFunction(() => window.__scene && window.__scene.player && window.__scene.touch, null, { timeout: 30000 });
  await page.evaluate(() => { __scene.spawnPt = { x: __scene.player.x, y: __scene.player.y }; });
  await page.waitForTimeout(1000);
  const cdp = await ctx.newCDPSession(page);
  const touch = (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts.map(([x, y, id]) => ({ x, y, id, radiusX: 4, radiusY: 4, force: 1 })) });
  const I = await page.evaluate(() => { const s = __scene, r = s.game.canvas.getBoundingClientRect(); return { zoom: s.scale.zoom, gw: s.scale.width, gh: s.scale.height, cl: r.left, ct: r.top, R: s.ui.D / 2, btn: (() => { const b = s.ui.btn.getBoundingClientRect(); return { x: b.left + b.width / 2, y: b.top + b.height / 2 }; })(), css: s.game.canvas.style.width + 'x' + s.game.canvas.style.height, canvas: s.game.canvas.width + 'x' + s.game.canvas.height, touchMode: !!s.touchMode, pixelArt: s.game.config.pixelArt }; });
  const r = { info: I, start: await st(page), dirs: {} };
  await page.screenshot({ path: `${SH}${name}_start.png` });
  const Rc = I.R; const sx = w * 0.22, sy = h * 0.70;
  for (const [d, deg] of Object.entries(ANG)) {
    for (const [mode, f] of [['walk', 0.45], ['run', 0.95]]) {
      await center(page);
      const rad = deg * Math.PI / 180, ex = sx + Math.cos(rad) * Rc * f, ey = sy + Math.sin(rad) * Rc * f;
      await touch('touchStart', [[sx, sy, 1]]);
      for (let i = 1; i <= 4; i++) { await touch('touchMove', [[sx + (ex - sx) * i / 4, sy + (ey - sy) * i / 4, 1]]); await page.waitForTimeout(25); }
      await page.waitForTimeout(450);
      const s1 = await st(page);
      if (d === 'up_right' || (name === 'portrait' && d === 'down_left')) await page.screenshot({ path: `${SH}${name}_${mode}_${d}.png` });
      await touch('touchEnd', []); await page.waitForTimeout(250);
      const s2 = await st(page);
      r.dirs[`${mode}_${d}`] = { held: s1.anim, mag: +s1.mag.toFixed(2), speed: Math.round(Math.hypot(s1.vx, s1.vy)), released: s2.anim, rel_playing: s2.playing };
      if (s1.anim !== `${mode}_${d}`) fails.push(`${name} ${mode}_${d}: got ${s1.anim}`);
      if (s2.anim !== `idle_${d}` || !s2.playing) fails.push(`${name} release ${d}: got ${s2.anim} playing=${s2.playing}`);
    }
  }
  // interact via E button (away from interactables), facing last dir
  await center(page);
  const [bx, by] = [I.btn.x, I.btn.y];
  await touch('touchStart', [[bx, by, 5]]); await page.waitForTimeout(60); await touch('touchEnd', []);
  await page.waitForTimeout(300); const a1 = await st(page);
  await page.screenshot({ path: `${SH}${name}_interact.png` });
  await page.waitForTimeout(900); const a2 = await st(page);
  r.interact = { during: a1.anim, frameDuring: a1.frame, acting: a1.acting, after: a2.anim, afterPlaying: a2.playing };
  if (!a1.anim?.startsWith('interact_') || a2.anim !== `idle_${a1.facing}`) fails.push(`${name} interact: ${JSON.stringify(r.interact)}`);
  // interact near NPC -> gesture then dialog
  await page.evaluate(() => { const n = __scene.npc; __scene.player.setPosition(n.x - 26, n.y); });
  await page.waitForTimeout(300);
  await touch('touchStart', [[bx, by, 6]]); await page.waitForTimeout(60); await touch('touchEnd', []);
  await page.waitForTimeout(250); const n1 = await st(page);
  await page.waitForTimeout(2200); const n2 = await st(page);
  r.npc = { during: n1.anim, dialogDuring: n1.dialog, after: n2.anim, dialogAfter: n2.dialog };
  if (n1.anim !== 'interact_right' || !n2.dialog) fails.push(`${name} npc: ${JSON.stringify(r.npc)}`);
  await page.screenshot({ path: `${SH}${name}_npc_dialog.png` });
  r.errs = errs; if (errs.length) fails.push(`${name} console: ${errs.join(' | ')}`);
  out[name] = r; await ctx.close();
}
{ // desktop keyboard
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } }); const page = await ctx.newPage(); const errs = [];
  page.on('pageerror', e => errs.push(e.message)); page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  await page.goto(FILE); await page.waitForFunction(() => window.__scene && window.__scene.player); await page.waitForTimeout(800);
  await page.evaluate(() => { __scene.spawnPt = { x: __scene.player.x, y: __scene.player.y }; });
  const KEYS = { right: ['d'], down_right: ['s', 'd'], down: ['ArrowDown'], down_left: ['ArrowDown', 'ArrowLeft'], left: ['a'], up_left: ['w', 'a'], up: ['ArrowUp'], up_right: ['ArrowUp', 'ArrowRight'] };
  const r = { info: await page.evaluate(() => ({ zoom: __scene.scale.zoom, gw: __scene.scale.width, gh: __scene.scale.height, touchMode: !!__scene.touchMode })), dirs: {} };
  for (const [d, ks] of Object.entries(KEYS)) for (const run of [false, true]) {
    await center(page);
    if (run) await page.keyboard.down('Shift');
    for (const k of ks) await page.keyboard.down(k);
    await page.waitForTimeout(400); const s1 = await st(page);
    if (d === 'down_right' && run) await page.screenshot({ path: `${SH}desktop_run_down_right.png` });
    for (const k of ks) await page.keyboard.up(k); if (run) await page.keyboard.up('Shift');
    await page.waitForTimeout(200); const s2 = await st(page);
    const m = run ? 'run' : 'walk';
    r.dirs[`${m}_${d}`] = { held: s1.anim, speed: Math.round(Math.hypot(s1.vx, s1.vy)), released: s2.anim };
    if (s1.anim !== `${m}_${d}` || s2.anim !== `idle_${d}`) fails.push(`desktop ${m}_${d}: ${s1.anim} -> ${s2.anim}`);
  }
  await center(page);
  await page.keyboard.press('e'); await page.waitForTimeout(250); const e1 = await st(page);
  await page.screenshot({ path: `${SH}desktop_interact.png` });
  await page.waitForTimeout(900); const e2 = await st(page);
  await page.keyboard.press(' '); await page.waitForTimeout(250); const e3 = await st(page);
  r.interact = { E: e1.anim, after: e2.anim, space: e3.anim };
  if (!e1.anim?.startsWith('interact_') || !e2.anim?.startsWith('idle_') || !e3.anim?.startsWith('interact_')) fails.push('desktop interact ' + JSON.stringify(r.interact));
  await page.waitForTimeout(1200); await page.screenshot({ path: `${SH}desktop_idle.png` });
  r.errs = errs; if (errs.length) fails.push('desktop console: ' + errs.join(' | '));
  out.desktop = r; await ctx.close();
}
console.log(JSON.stringify(out, null, 0).replace(/\},"/g, '},\n"'));
console.log('FAILS', fails.length, JSON.stringify(fails, null, 1));
await browser.close();
