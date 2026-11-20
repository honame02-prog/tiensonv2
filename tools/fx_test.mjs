// Do FPS + ro ri + anh cho FxPlayer trong SectScene: node tools/fx_test.mjs [baseUrl]   (can preview dang chay, mac dinh http://localhost:8080/)
// Desktop 960x540 va mobile 844x390 dpr3 + CPU 4x; moi cai do NGAY roi DEM (bam N). Moi che do: 5 mau actualFps nen vs lap 3 cue (R).
// Anh (desktop, ~300 ms sau khi bam phim): shots/v2_ngay_hoa.png, v2_dem_hoa.png, v2_dem_kim.png + shots/v2_strip.png (ghep doc).
import { chromium } from 'playwright';
import { mkdirSync, readFileSync } from 'node:fs';
const base = process.argv[2] || 'http://localhost:8080/';
const url = base + (base.includes('?') ? '&' : '?') + 'fx=1';
mkdirSync('shots', { recursive: true });
const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const fps = page => page.evaluate(() => Math.round(__game.loop.actualFps));
const result = {};

// chu ky tint cua moi doi tuong game (khong tinh FX) trong scene (de so sanh truoc/sau)
const tintSig = page => page.evaluate(() => JSON.stringify(__scene.children.list.filter(o => !o.__fx).map(o => [o.type, o.depth, o.tintTopLeft, o.tintTopRight, o.tintBottomLeft, o.tintBottomRight])));
const idle = (page, ms = 6000) => page.waitForFunction(() => __fx.stats().active === 0 && __fx.stats().particles === 0, null, { timeout: ms });

async function run(name, ctxOpts, rate) {
  const ctx = await browser.newContext(ctxOpts);
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  if (rate > 1) await (await ctx.newCDPSession(page)).send('Emulation.setCPUThrottlingRate', { rate });
  await page.goto(url, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__scene && window.__scene.fx && window.__fxdemo, null, { timeout: 60000 });
  await page.waitForTimeout(2000);
  const sample = async () => { const a = []; for (let i = 0; i < 5; i++) { a.push(await fps(page)); await page.waitForTimeout(1000); } return a; };
  const R = result[name] = { cpuThrottle: rate };
  // dat tint rieng len 1 doi tuong de kiem "tra lai dung tint cu" (prop dau tien trong atlas 'sect', depth < 8600)
  await page.evaluate(() => {
    const o = __scene.children.list.find(o => o.type === 'Image' && o.texture.key === 'sect' && o.depth > 0 && o.depth < 8000);
    o.setTint(0xffd0a0, 0xffd0a0, 0xa0c0ff, 0xa0c0ff); window.__tinted = o;
  });
  // lam nong (JIT, shader, pool) truoc khi do: lap 1 vong roi dung
  await page.keyboard.press('r'); await page.waitForTimeout(4500); await page.keyboard.press('r'); await idle(page, 8000); await page.waitForTimeout(6000);
  for (const mode of ['ngay', 'dem']) {
    if (mode === 'dem') { await page.keyboard.press('n'); await page.waitForTimeout(3200); }
    const M = R[mode] = {};
    const sig0 = await tintSig(page);
    M.idleFps = await sample();
    if (name === 'desktop') {
      const shots = mode === 'ngay' ? [['2', 'hoa']] : [['2', 'hoa'], ['3', 'kim']];
      for (const [key, nm] of shots) {
        await page.keyboard.press(key);
        await page.waitForTimeout(300);
        if (nm === 'kim') {   // dim: hero bi toi, lop dem/suong/doi tuong tint rieng dung
          M.dimCheck = await page.evaluate(() => {
            const s = __scene, h = s.player.tintTopLeft, n = s.nightImg.tintTopLeft, m = s.mistBands[0].tintTopLeft, f = s.fogA.tintTopLeft, t = __tinted;
            return { heroTint: h.toString(16), night: n.toString(16), mist: m.toString(16), fog: f.toString(16), preTinted: [t.tintTopLeft, t.tintBottomLeft].map(c => c.toString(16)), dimV: __fx._dimV };
          });
        }
        await page.screenshot({ path: `shots/v2_${mode}_${nm}.png` });
        await idle(page);
        await page.waitForTimeout(300);
      }
    }
    await page.keyboard.press('r');
    await page.waitForTimeout(3000);
    const peak = { particles: 0, objects: 0, active: 0 }, a = [];
    for (let i = 0; i < 5; i++) {
      a.push(await fps(page));
      const s = await page.evaluate(() => __fx.stats());
      for (const k in peak) peak[k] = Math.max(peak[k], s[k]);
      await page.waitForTimeout(1000);
    }
    M.playFps = a; M.peakStats = peak;
    await page.keyboard.press('r');
    await page.waitForTimeout(5000);
    M.afterStop = await page.evaluate(() => ({ ...__fx.stats(), dimV: __fx._dimV, hitFrozen: __fx._frozen, dimTargets: !!__fx._dimTargets }));
    const sig1 = await tintSig(page);
    M.tintRestored = sig0 === sig1;
    M.leak = M.afterStop.active + M.afterStop.objects + M.afterStop.particles !== 0 || M.afterStop.dimV !== 255 || M.afterStop.hitFrozen || !M.tintRestored;
  }
  R.errs = errs;
  await ctx.close();
}

await run('desktop', { viewport: { width: 960, height: 540 } }, 1);
await run('mobile_cpu4x', { viewport: { width: 844, height: 390 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true }, 4);

// anh ghep doc 3 anh
const sp = await browser.newPage({ viewport: { width: 960, height: 540 * 3 } });
const uri = f => 'data:image/png;base64,' + readFileSync(f).toString('base64');
await sp.setContent(`<body style="margin:0;background:#000">${['ngay_hoa', 'dem_hoa', 'dem_kim'].map(n => `<img style="display:block" src="${uri(`shots/v2_${n}.png`)}">`).join('')}</body>`);
await sp.waitForTimeout(500);
await sp.screenshot({ path: 'shots/v2_strip.png' });
console.log(JSON.stringify(result, null, 1));
await browser.close();
