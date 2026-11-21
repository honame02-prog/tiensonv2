// Di thu that qua cong giua 3 khu xam: node tools/blockout_walk.mjs [baseUrl]  (khong co: tu bat vite dev cong 5192)
// HVQ -> Son Dao -> HVQ -> Hau Son -> HVQ: dat nhan vat sat cong, giu phim, kiem khu + spawn den.
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
let srv = null, base = process.argv[2];
if (!base) { srv = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--port', '5192', '--strictPort'], { stdio: 'ignore' }); base = 'http://localhost:5192/';
  for (let i = 0; i < 60; i++) { try { if ((await fetch(base)).ok) break; } catch (e) { /* cho */ } await new Promise(r => setTimeout(r, 250)); } }
const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
let fail = 0; const ck = (n, ok, i = '') => { console.log((ok ? 'OK   ' : 'LOI  ') + n + ' ' + i); if (!ok) fail++; };
try {
  const ctx = await browser.newContext({ viewport: { width: 960, height: 540 } }), page = await ctx.newPage(), errs = [];
  await ctx.addInitScript(() => { try { localStorage.clear(); } catch (e) { /* */ } });
  page.on('pageerror', e => errs.push(e.message));
  page.on('console', m => { if ((m.type() === 'error' || m.type() === 'warning') && !/GL Driver Message|CONTEXT_LOST_WEBGL/.test(m.text())) errs.push(m.text()); });
  const inArea = id => page.waitForFunction(id => window.__scene?.meta?.id === id && window.__scene.player?.active && !window.__scene.busy, id, { timeout: 20000 });
  const pos = () => page.evaluate(() => ({ a: __scene.meta.id, x: Math.round(__scene.player.x), y: Math.round(__scene.player.y) }));
  const tele = (x, y) => page.evaluate(([x, y]) => { __scene.player.setPosition(x, y); __scene.player.setVelocity(0, 0); __scene.cameras.main.centerOn(x, y); }, [x, y]);
  const go = async (key, dest, x, y) => { await tele(x, y); await page.waitForTimeout(300); await page.keyboard.down(key); await page.waitForFunction(() => __scene.busy, null, { timeout: 8000 }).catch(() => {}); await page.keyboard.up(key); await inArea(dest); await page.waitForTimeout(500); return pos(); };
  await page.goto(base + '?area=huyen-van-quan-v2', { waitUntil: 'load' }); await inArea('huyen-van-quan-v2'); await page.waitForTimeout(800);
  let p = await pos(); ck('HVQ v2 spawn mac dinh (640,1562)', Math.abs(p.x - 640) < 4 && Math.abs(p.y - 1562) < 5, JSON.stringify(p));
  p = await go('ArrowDown', 'son-dao-v3', 640, 1560); ck('HVQ -> Son Dao v3 spawn north (480,96)', Math.abs(p.x - 480) < 6 && Math.abs(p.y - 96) < 6, JSON.stringify(p));
  p = await go('ArrowUp', 'huyen-van-quan-v2', 480, 70); ck('Son Dao v3 -> HVQ v2 spawn gate (640,1562)', Math.abs(p.x - 640) < 6 && Math.abs(p.y - 1562) < 6, JSON.stringify(p));
  p = await go('ArrowUp', 'hau-son-v3', 992, 40); ck('HVQ -> Hau Son v3 spawn south (640,1203)', Math.abs(p.x - 640) < 6 && Math.abs(p.y - 1203) < 6, JSON.stringify(p));
  p = await go('ArrowDown', 'huyen-van-quan-v2', 640, 1240); ck('Hau Son v3 -> HVQ v2 spawn hau (912,154)', Math.abs(p.x - 912) < 6 && Math.abs(p.y - 154) < 6, JSON.stringify(p));
  // va cham: tu spawn Son Dao di thang sang trai vao vach nui
  await page.goto(base + '?area=son-dao-v3', { waitUntil: 'load' }); await inArea('son-dao-v3'); await page.waitForTimeout(600);
  await page.keyboard.down('ArrowLeft'); await page.waitForTimeout(3000); await page.keyboard.up('ArrowLeft'); p = await pos();
  ck('Son Dao v3: di trai bi chan boi o chan (x >= 320)', p.x >= 320 && p.x < 480, JSON.stringify(p));
  ck('0 loi console', errs.length === 0, JSON.stringify(errs).slice(0, 300));
} catch (e) { ck('test chay het', false, String(e.stack || e).slice(0, 500)); } finally { await browser.close(); if (srv) srv.kill(); }
console.log(fail ? `\n${fail} LOI` : '\nTAT CA DAT'); process.exit(fail ? 1 : 0);
