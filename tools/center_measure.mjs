// Do toa do tam chieu 1-6 so voi chan/than hinh nom (?fx=1). node tools/center_measure.mjs [baseUrl]   (khong co baseUrl: tu bat vite preview cong 8097)
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
let srv = null, base = process.argv[2];
if (!base) { srv = spawn(process.execPath, ['node_modules/vite/bin/vite.js', 'preview', '--port', '8097', '--strictPort'], { stdio: 'ignore' }); base = 'http://localhost:8097/';
  for (let i = 0; i < 40; i++) { try { if ((await fetch(base)).ok) break; } catch (e) { /* */ } await new Promise(r => setTimeout(r, 250)); } }
const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
try {
  const page = await (await browser.newContext({ viewport: { width: 960, height: 540 } })).newPage();
  await page.goto(base + '?fx=1', { waitUntil: 'load' });
  await page.waitForFunction(() => window.__fx && window.__fxdemo, null, { timeout: 60000 });
  await page.waitForTimeout(1500);
  const res = await page.evaluate(async () => {
    const sleep = ms => new Promise(r => setTimeout(r, ms));
    const d0 = __fxdemo; d0.castTd?.(); d0.castAnim(); await sleep(1500); __fx.runs.forEach(r => r.kill());
    const dm = __fxdemo.dummy;
    const out = { dummy: { x: dm.x, y: dm.y, h: dm.displayHeight } };
    for (let k = 1; k <= 6; k++) {
      __fx.runs.forEach(r => r.kill()); await sleep(100);
      const names = ['', 'cast0', 'cast1', 'cast2', 'castAll', 'castAnim', 'castTd'];
      const pts = [];
      const grab = () => {
        for (const o of __scene.children.list) {
          if (!o.__fx || !o.visible || o.alpha <= 0.02) continue;
          if (o.type === 'Sprite') {   // anim: tam anh theo trong tam alpha cua khung hien tai
            const f = o.frame, img = f.source.image, c = document.createElement('canvas'); c.width = f.cutWidth; c.height = f.cutHeight;
            const g = c.getContext('2d'); g.drawImage(img, f.cutX, f.cutY, f.cutWidth, f.cutHeight, 0, 0, f.cutWidth, f.cutHeight);
            const px = g.getImageData(0, 0, c.width, c.height).data; let sx = 0, sy = 0, sw = 0;
            for (let i = 0; i < c.width * c.height; i++) { const a = px[i * 4 + 3]; if (a > 40) { sx += (i % c.width) * a; sy += Math.floor(i / c.width) * a; sw += a; } }
            if (sw) pts.push({ t: o.texture.key, kind: 'anim-px', x: o.x - o.originX * o.width + f.x + sx / sw, y: o.y - o.originY * o.height + f.y + sy / sw, ox: o.x, oy: o.y, n: sw });
          } else pts.push({ t: o.texture?.key || o.type, kind: o.type, x: o.x, y: o.y });
        }
      };
      if (k === 1) d0.cast(0); else if (k === 2) d0.cast(1); else if (k === 3) d0.cast(2); else if (k === 4) d0.castAll(); else if (k === 5) d0.castAnim(); else d0.castTd();
      const samples = [];
      for (const t of [150, 300, 450, 600, 750]) { await sleep(150); pts.length = 0; grab(); samples.push({ t, pts: pts.map(p => ({ ...p })) }); }
      out['k' + k] = samples;
      __fx.runs.forEach(r => r.kill());
      await sleep(100);
    }
    out.player = { x: __scene.player.x, y: __scene.player.y };
    return out;
  });
  console.log(JSON.stringify(res, (k, v) => typeof v === 'number' ? Math.round(v * 10) / 10 : v));
} finally { await browser.close(); srv?.kill(); }
