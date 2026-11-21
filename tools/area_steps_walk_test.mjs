// HK-STEPFIX: di bo THAT bang phim (ArrowUp roi ArrowDown) qua tung bac trong area.json.steps; FAIL neu khong doi tang hoac bi chan/chuyen khu giua chung.
// Dung: node tools/area_steps_walk_test.mjs [areaId=huyen-van-quan-v2]   (< 60 s; cong 5199)
// Luu y: portal dat tren chan bac-vao (y 1580..1600) -> bac-vao bat dau o giua bac (cach portal >= 30 px), khong tu mep duoi.
import { chromium } from './area_tool_runtime.mjs';
import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
const AREA = process.argv[2] || 'huyen-van-quan-v2';
const a = JSON.parse(readFileSync(`public/assets/areas/${AREA}/area.json`, 'utf8'));
const server = spawn(process.execPath, ['tools/area_tool_vite.mjs', '--port', '5199'], { stdio: 'pipe', windowsHide: true });
const base = 'http://127.0.0.1:5199/';
const fails = [], errs = [];
let browser;
try {
  for (let i = 0; i < 80; i++) { try { if ((await fetch(base)).ok) break; } catch {} await new Promise(r => setTimeout(r, 200)); }
  browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const page = await browser.newPage({ viewport: { width: 480, height: 270 } });
  page.on('pageerror', e => errs.push(e.message)); page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  await page.goto(`${base}?area=${AREA}`, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__scene?.player?.active, null, { timeout: 30000 });
  await page.waitForTimeout(500);
  const st = () => page.evaluate(() => ({ x: Math.round(__scene.player.x), y: Math.round(__scene.player.y), t: +__scene.tier.toFixed(2), area: __scene.areaId }));
  const tele = (x, y) => page.evaluate(([x, y]) => { __scene.player.setPosition(x, y); __scene.player.setVelocity(0, 0); __scene.lastGood = { x, y }; __scene.tier = null; }, [x, y]);
  for (const s of a.steps || []) {
    const [x, y, w, h] = s.rect, cx = x + w / 2;
    const sy = s.dir === 'up' && s.id === 'bac-vao' ? y + 46 : y + h + 24;   // bac-vao: portal nam o chan bac
    if (s.dir !== 'up') { fails.push(`${s.id}: test chi ho tro dir=up (dir=${s.dir})`); continue; }
    await tele(cx, sy); await page.waitForTimeout(250);
    const p0 = await st();
    // LEN: giu ArrowUp toi khi tang >= hi - 0.05 (toi da 3 s)
    await page.keyboard.down('ArrowUp');
    await page.waitForFunction(([hi, ar]) => __scene.tier >= hi - 0.05 || __scene.areaId !== ar, [s.hi, AREA], { timeout: 3000 }).catch(() => {});
    await page.keyboard.up('ArrowUp');
    const p1 = await st(); await page.waitForTimeout(150);
    // XUONG: giu ArrowDown toi khi y >= diem bat dau (toi da 4 s)
    await page.keyboard.down('ArrowDown');
    await page.waitForFunction(y0 => __scene.player.y >= y0, sy, { timeout: 4000 }).catch(() => {});
    await page.keyboard.up('ArrowDown');
    const p2 = await st();
    const ok = p0.area === AREA && p1.area === AREA && p2.area === AREA && p1.t >= s.hi - 0.05 && Math.abs(p2.t - p0.t) <= 0.1 && p2.y >= sy - 2;
    console.log(`${s.id.padEnd(9)} ${ok ? 'OK  ' : 'FAIL'} start ${JSON.stringify(p0)} up-> ${JSON.stringify(p1)} down-> ${JSON.stringify(p2)}`);
    if (!ok) fails.push(`${s.id}: up tier ${p1.t} (can >= ${s.hi}), y ${p1.y}, area ${p1.area}; down tier ${p2.t} (can ~${p0.t}), y ${p2.y}`);
  }
} finally { await browser?.close(); server.kill(); }
if (errs.length) fails.push(`console errors: ${errs.slice(0, 3).join(' | ')}`);
console.log(fails.length ? `FAIL ${fails.length}\n- ${fails.join('\n- ')}` : `PASS area_steps_walk_test: ${a.steps.length} bac, len + xuong deu doi tang`);
process.exit(fails.length ? 1 : 0);
