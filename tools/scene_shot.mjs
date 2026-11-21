// Exact world-space camera capture, with real Dao Si actors. No asset/area mutation.
import { chromium } from './area_tool_runtime.mjs';
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { decodePng, encodePng } from './png.mjs';
import { depthOf, tierAt } from '../src/areaLayers.js';

export function parseShotArgs(args) {
  const opts = {};
  for (let i = 0; i < args.length; i += 2) {
    if (!['--area', '--view', '--actors', '--out'].includes(args[i]) || args[i + 1] === undefined) throw new Error('Usage: --area ID --view x,y --actors "x,y;x,y" --out file.png');
    opts[args[i].slice(2)] = args[i + 1];
  }
  const point = s => { const p = s.split(',').map(Number); if (p.length !== 2 || p.some(n => !Number.isFinite(n))) throw new Error('Invalid coordinates: ' + s); return p; };
  if (!opts.area || !opts.view || !opts.out || !/\.png$/i.test(opts.out)) throw new Error('Required: --area ID --view x,y --out file.png');
  return { ...opts, view: point(opts.view), actors: opts.actors ? opts.actors.split(';').map(point) : [] };
}

export async function prepareSceneShot(page, { view, actors }) {
  const actorDepths = await page.evaluate(({ view, actors }) => {
    const s = window.__scene, c = s.cameras.main, [x, y] = view.map(v => v * 32);
    if (x < 0 || y < 0 || x + 480 > s.W || y + 270 > s.H) throw new Error('View is outside area bounds');
    document.getElementById('ui').style.visibility = 'hidden';
    s.player.setVisible(false).setVelocity(0, 0); s.player.body.enable = false; s.shadow.setVisible(false);
    // Stop update/physics/tweens before fixing camera and actors: no drift or idle frames advancing.
    s.scene.pause(); s.tweens.pauseAll(); s.anims.pauseAll();
    for (const o of [s.fogA, s.fogB, s.seaDrift, s.smoke, s.smokeLit, s.ember, s.emberGlow, s.ripples, ...s.mistBands]) o?.setVisible(false);
    // No active FX should be present even if the calling page enabled a demo.
    for (const o of s.children.list) if (o.type === 'ParticleEmitter') o.setVisible(false);
    s.nightK = 0; s.applyNight(); for (const g of s.glows) g.g.setVisible(false);
    c.stopFollow(); c.setZoom(1); c.setRoundPixels(true); c.setScroll(x, y);
    s.shotActors = actors.map(([ax, ay]) => s.add.image(ax * 32, ay * 32, 'hero', 'dao_si_idle_down_00').setOrigin(32 / 64, 61 / 64));
    return actors.map(([ax, ay]) => [ax * 32, ay * 32, s.meta]);
  }, { view, actors });
  // Use the same shared tier/depth rule as the player.
  const depths = actorDepths.map(([x, y, meta]) => depthOf(y, tierAt(meta, x, y)));
  await page.evaluate(depths => { const s = __scene; s.shotActors.forEach((im, i) => im.setDepth(depths[i])); }, depths);
  // Fade a roof when it covers any visible ruler actor, using the scene's existing masks.
  const { roofTargetAlpha } = await import('../src/areaLayers.js');
  const roofs = await page.evaluate(() => __scene.roofs.map(r => ({ rects: r.rects, base: r.base, depth: r.img.depth })));
  const alpha = roofs.map(r => Math.min(r.base, ...actors.map(([x, y], i) => r.depth > depths[i] ? roofTargetAlpha(r.rects, x * 32, y * 32, r.base) : r.base)));
  await page.evaluate(alpha => __scene.roofs.forEach((r, i) => r.img.setAlpha(alpha[i])), alpha);
}

export function writeShot2x(file) {
  const im = decodePng(file), w = im.w * 2, h = im.h * 2, data = Buffer.alloc(w * h * 4);
  if (im.w !== 480 || im.h !== 270) throw new Error(`Expected 480x270, got ${im.w}x${im.h}`);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const a = (Math.floor(y / 2) * im.w + Math.floor(x / 2)) * 4;
    im.data.copy(data, (y * w + x) * 4, a, a + 4);
  }
  const out = file.replace(/\.png$/i, '@2x.png'); encodePng({ w, h, data }, out); return out;
}

export async function sceneShot(opts) {
  let browser, server;
  try {
    server = spawn(process.execPath, ['tools/area_tool_vite.mjs', '--port', '5197'], { stdio: 'pipe', windowsHide: true });
    let serverError = ''; server.stderr.on('data', b => { serverError += b; });
    const base = 'http://127.0.0.1:5197/'; let ready = false;
    for (let i = 0; i < 80; i++) {
      if (server.exitCode !== null) throw new Error('Vite exited: ' + serverError);
      try { if ((await fetch(base)).ok) { ready = true; break; } } catch { /* wait */ }
      await new Promise(r => setTimeout(r, 200));
    }
    if (!ready) throw new Error('Vite startup timed out');
    browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
    const page = await browser.newPage({ viewport: { width: 480, height: 270 }, deviceScaleFactor: 1 }), errors = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
    await page.addInitScript(() => { Math.random = () => 0.5; });
    await page.goto(`${base}?area=${encodeURIComponent(opts.area)}`, { waitUntil: 'load' });
    await page.waitForFunction(() => window.__scene?.player?.active && __scene.fx, null, { timeout: 30000 });
    await prepareSceneShot(page, opts);
    await page.waitForTimeout(100);
    const state = await page.evaluate(() => ({ x: __scene.cameras.main.scrollX, y: __scene.cameras.main.scrollY, actors: __scene.shotActors.length }));
    if (state.x !== opts.view[0] * 32 || state.y !== opts.view[1] * 32) throw new Error('Camera moved: ' + JSON.stringify(state));
    if (errors.length) throw new Error(errors.join('\n'));
    mkdirSync(dirname(opts.out), { recursive: true });
    await page.locator('canvas').screenshot({ path: opts.out });
    const double = writeShot2x(opts.out);
    console.log(`scene_shot ${opts.area}: 480x270 1x, view=${opts.view}, actors=${state.actors}, console errors=0 -> ${opts.out}; 960x540 -> ${double}`);
  } finally { await browser?.close(); server?.kill(); }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  sceneShot(parseShotArgs(process.argv.slice(2))).catch(e => { console.error(e); process.exitCode = 1; });
}
