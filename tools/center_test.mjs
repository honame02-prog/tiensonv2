// Test GD5-center: moi phim 1-6 trong ?fx=1 phat dung tam hinh nom (lech x <= 2 px). node tools/center_test.mjs [baseUrl]  (khong co baseUrl: tu bat vite preview cong 8098, can npm run build truoc)
// Do: phim 1/2/3 = x trung binh cac doi tuong FX (decal/ring/cot/den/emitter) so voi chan nom; 4 = tam 3 decal; 5 = tam pixel (trong so alpha) khung vu no (khung 23-28) cua vocab-strike; 6 = tam pixel 3 lop cotlinh-td.
// Anh shots/center_1..6.png.
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
mkdirSync('shots', { recursive: true });
let srv = null, base = process.argv[2];
if (!base) { srv = spawn(process.execPath, ['node_modules/vite/bin/vite.js', 'preview', '--port', '8098', '--strictPort'], { stdio: 'ignore' }); base = 'http://localhost:8098/';
  for (let i = 0; i < 40; i++) { try { if ((await fetch(base)).ok) break; } catch (e) { /* */ } await new Promise(r => setTimeout(r, 250)); } }
const out = []; let fail = 0;
const check = (n, ok, info = '') => { out.push(`${ok ? 'OK  ' : 'LOI '} ${n} ${info}`); if (!ok) fail++; };
const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
try {
  const ctx = await browser.newContext({ viewport: { width: 960, height: 540 } });
  await ctx.addInitScript(() => { try { localStorage.clear(); } catch (e) { /* */ } });
  const page = await ctx.newPage(), errs = [];
  page.on('pageerror', e => errs.push(e.message));
  page.on('console', m => { if ((m.type() === 'error' || m.type() === 'warning') && !/GL Driver Message|CONTEXT_LOST_WEBGL: loseContext/.test(m.text())) errs.push(m.type() + ': ' + m.text()); });
  await page.goto(base + '?fx=1', { waitUntil: 'load' });
  await page.waitForFunction(() => window.__fx && window.__fxdemo, null, { timeout: 60000 });
  await page.waitForTimeout(1500);
  check('hinh nom co san ngay khi vao ?fx=1 (chua bam phim)', await page.evaluate(() => !!__fxdemo.dummy && !!__fxdemo.dummy.scene));
  // nap truoc atlas vocab-strike (nap lazy) + cotlinh
  await page.evaluate(async () => { __fxdemo.castAnim(); __fxdemo.castTd(); await new Promise(r => setTimeout(r, 2500)); __fx.runs.forEach(r => r.kill()); });
  await page.waitForTimeout(500);
  const dummy = await page.evaluate(() => ({ x: __fxdemo.dummy.x, y: __fxdemo.dummy.y }));
  // do trong trang: tra {cx, n, objs}
  const probe = (mode) => page.evaluate((mode) => {
    const px = (o) => {   // tam pixel (trong so alpha) cua khung hien tai cua sprite o, toa do the gioi
      const f = o.frame, c = document.createElement('canvas'); c.width = f.cutWidth; c.height = f.cutHeight;
      const g = c.getContext('2d'); g.drawImage(f.source.image, f.cutX, f.cutY, f.cutWidth, f.cutHeight, 0, 0, f.cutWidth, f.cutHeight);
      const d = g.getImageData(0, 0, c.width, c.height).data; let sx = 0, sy = 0, sw = 0;
      for (let i = 0; i < c.width * c.height; i++) { const a = d[i * 4 + 3]; if (a > 40) { sx += (i % c.width) * a; sy += Math.floor(i / c.width) * a; sw += a; } }
      return sw ? { x: o.x - o.originX * o.width + f.x + sx / sw, y: o.y - o.originY * o.height + f.y + sy / sw, w: sw } : null;
    };
    const vis = __scene.children.list.filter(o => o.__fx && o.visible && o.alpha > 0.02);
    if (mode === 'obj') {
      const o = vis.filter(o => o.type !== 'Sprite' && (o.x !== 0 || o.y !== 0) && /decal|ring|col_|light|^fx_px2|^fx_spark/.test(o.texture?.key || ''));
      return { n: o.length, cx: o.reduce((a, b) => a + b.x, 0) / (o.length || 1), cy: o.reduce((a, b) => a + b.y, 0) / (o.length || 1) };
    }
    if (mode === 'decal') { const o = vis.filter(o => o.texture?.key === 'fx_decal'); return { n: o.length, cx: o.reduce((a, b) => a + b.x, 0) / (o.length || 1), cy: o.reduce((a, b) => a + b.y, 0) / (o.length || 1) }; }
    if (mode === 'vocab') {
      const s = vis.find(o => o.type === 'Sprite' && o.texture.key === 'vocab-strike'); const i = s?.anims.currentFrame?.index;
      if (!s || i < 23 || i > 28) return { n: 0, idx: i };
      const p = px(s); return { n: 1, idx: i, cx: p.x, cy: p.y };
    }
    const ps = vis.filter(o => o.type === 'Sprite' && o.texture.key.startsWith('cotlinh-td-')).map(px).filter(Boolean);
    return { n: ps.length, cx: ps.reduce((a, b) => a + b.x, 0) / (ps.length || 1), cy: ps.reduce((a, b) => a + b.y, 0) / (ps.length || 1) };
  }, mode);
  const cases = [
    { k: '1', mode: 'obj', at: 300, label: 'bang-vong' }, { k: '2', mode: 'obj', at: 600, label: 'hoa-cot' }, { k: '3', mode: 'obj', at: 500, label: 'kim-giang' },
    { k: '4', mode: 'decal', at: 500, label: 'ca ba' }, { k: '5', mode: 'vocab', at: 0, label: 'vocab-strike (vu no)' }, { k: '6', mode: 'td', at: 1300, label: 'cot-linh-td' },
  ];
  for (const c of cases) {
    await page.evaluate(() => __fx.runs.forEach(r => r.kill())); await page.waitForTimeout(150);
    await page.keyboard.press(c.k);
    let m;
    if (c.mode === 'vocab') {   // cho den khung vu no (23-28)
      await page.waitForFunction(() => { const s = __scene.children.list.find(o => o.__fx && o.type === 'Sprite' && o.texture.key === 'vocab-strike'); const i = s?.anims.currentFrame?.index; return i >= 24 && i <= 27; }, null, { timeout: 8000, polling: 10 });
      m = await probe('vocab');
    } else { await page.waitForTimeout(c.at); m = await probe(c.mode); }
    await page.screenshot({ path: `shots/center_${c.k}.png` });
    const dx = m.cx - dummy.x;
    check(`phim ${c.k} ${c.label}: tam x ${m.cx?.toFixed(1)} vs nom ${dummy.x} (lech ${dx.toFixed(1)} px, y ${m.cy?.toFixed(1)} vs chan ${dummy.y}, ${m.n} doi tuong) <= 2`, m.n > 0 && Math.abs(dx) <= 2);
  }
  await page.evaluate(() => __fx.runs.forEach(r => r.kill()));
  // nut cam ung 5 cung dung nom
  await page.locator('div[title="demo-anim-strike"]').dispatchEvent('pointerdown');
  await page.waitForFunction(() => { const s = __scene.children.list.find(o => o.__fx && o.type === 'Sprite' && o.texture.key === 'vocab-strike'); const i = s?.anims.currentFrame?.index; return i >= 24 && i <= 27; }, null, { timeout: 8000, polling: 10 });
  const mb = await probe('vocab');
  check(`nut 5: tam x ${mb.cx?.toFixed(1)} vs nom ${dummy.x}`, mb.n > 0 && Math.abs(mb.cx - dummy.x) <= 2);
  await page.evaluate(() => __fx.runs.forEach(r => r.kill()));
  check('0 loi console', errs.length === 0, errs.join(' | '));
  await ctx.close();
} finally { await browser.close(); srv?.kill(); }
console.log(out.join('\n'));
console.log(fail ? `TONG: ${fail} LOI` : 'TONG: tat ca dat');
process.exit(fail ? 1 : 0);
