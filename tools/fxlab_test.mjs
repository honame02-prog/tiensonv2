// Test FxLab: node tools/fxlab_test.mjs [baseUrl]   (can preview dang chay, mac dinh http://localhost:8090/)
// Desktop: chon demo-hoa-cot, doi power cua light, phat, doi dai sang bang, Tai JSON (bat download), kiem JSON; Dem -> depth light 9100, Ngay -> -59.
// Mobile 844x390: bang mo/gap duoc. Anh: shots/fxlab_desktop.png, shots/fxlab_mobile.png
import { chromium } from 'playwright';
import { mkdirSync, readFileSync } from 'node:fs';
const base = process.argv[2] || 'http://localhost:8090/';
const url = base + '?fxlab=1';
mkdirSync('shots', { recursive: true });
const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const out = []; let fail = 0;
const check = (name, ok, info = '') => { out.push(`${ok ? 'OK  ' : 'LOI '} ${name} ${info}`); if (!ok) fail++; };

async function open(ctxOpts) {
  const ctx = await browser.newContext(ctxOpts);
  await ctx.addInitScript(() => { try { localStorage.clear(); } catch (e) { /* */ } });
  const page = await ctx.newPage(), errs = [];
  page.on('pageerror', e => errs.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  await page.goto(url, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__fxlab && document.querySelector('#fxlab'), null, { timeout: 60000 });
  await page.waitForTimeout(1500);
  return { ctx, page, errs };
}
const lightDepths = page => page.evaluate(() => __scene.children.list.filter(o => o.__fx && o.visible && o.active && o.texture && o.texture.key.startsWith('fx_light')).map(o => o.depth));

// ---------- desktop
{
  const { ctx, page, errs } = await open({ viewport: { width: 960, height: 540 } });
  check('bang hien', await page.locator('#fxlab').isVisible());
  await page.selectOption('#fxlab .row select >> nth=0', 'demo-hoa-cot');
  check('chon demo-hoa-cot', await page.evaluate(() => __fxlab.cue.id) === 'demo-hoa-cot');
  // mo track light dau tien, keo thanh power
  const blk = page.locator('#fxlab .trk').filter({ has: page.locator('b', { hasText: /^light$/ }) }).first();
  await blk.locator('.th').click();
  const f = blk.locator('.f').filter({ has: page.locator('label', { hasText: /^power$/ }) });
  await f.locator('input[type=range]').evaluate(el => { el.value = '1.6'; el.dispatchEvent(new Event('input', { bubbles: true })); });
  check('power ap vao cue', await page.evaluate(() => __fxlab.cue.tracks.find(t => t.type === 'light').power) === 1.6);
  // ngay: phat, kiem depth light = -59 (duoi actor, tren ground -60)
  await page.evaluate(() => __fxlab.play());
  await page.waitForTimeout(400);
  const dDay = await lightDepths(page);
  check('ngay: depth light = -59', dDay.length > 0 && dDay.every(d => d === -59), JSON.stringify(dDay));
  const hero = await page.evaluate(() => __scene.player.depth);
  check('ngay: light duoi actor', dDay.every(d => d < hero), `hero depth ${hero}`);
  await page.screenshot({ path: 'shots/fxlab_desktop.png' });
  // bat Dem bang nut UI trong luc dang phat: depth doi sang 9100
  await page.evaluate(() => __fxlab.play());
  await page.click('#fxlab button:has-text("Ngày → Đêm")');
  await page.waitForTimeout(300);
  const dNight = await lightDepths(page);
  check('dem (dang phat): depth light = 9100', dNight.length > 0 && dNight.every(d => d === 9100), JSON.stringify(dNight));
  await page.waitForFunction(() => __fx.stats().active === 0, null, { timeout: 8000 });
  await page.keyboard.press('n');   // phim N ngoai bang => ve Ngay
  await page.waitForTimeout(200);
  await page.evaluate(() => __fxlab.play()); await page.waitForTimeout(300);
  const dDay2 = await lightDepths(page);
  check('ngay lai (phim N): depth light = -59', dDay2.length > 0 && dDay2.every(d => d === -59), JSON.stringify(dDay2));
  await page.waitForFunction(() => __fx.stats().active === 0, null, { timeout: 8000 });
  // doi dai sang bang
  await page.selectOption('#fxlab .row select >> nth=1', 'bang');
  check('doi dai sang bang', await page.evaluate(() => __fxlab.cue.ramp) === 'bang');
  check('token mau doi theo dai', await page.evaluate(() => JSON.stringify(__fxlab.cue).includes('hoa.') === false));
  await page.evaluate(() => __fxlab.play()); await page.waitForTimeout(300);
  // Tai JSON
  const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#fxlab button:has-text("Tải JSON")')]);
  const path = await dl.path(); const json = JSON.parse(readFileSync(path, 'utf8'));
  check('ten file demo-hoa-cot.json', dl.suggestedFilename() === 'demo-hoa-cot.json', dl.suggestedFilename());
  check('JSON: ramp = bang, id dung, power moi', json.id === 'demo-hoa-cot' && json.ramp === 'bang' && json.tracks.find(t => t.type === 'light').power === 1.6);
  check('JSON hop le (tracks, type, at)', Array.isArray(json.tracks) && json.tracks.every(t => typeof t.type === 'string' && typeof t.at === 'number'));
  // nhan ban / tat / xoa / them
  const n0 = json.tracks.length;
  await blk.locator('button[title="nhân bản"]').click();
  check('nhan ban track', await page.evaluate(() => __fxlab.cue.tracks.length) === n0 + 1);
  await page.locator('#fxlab .trk').nth(1).locator('input[type=checkbox]').first().uncheck();
  check('tat track (off)', await page.evaluate(() => __fxlab.cue.tracks[1].off === true));
  await page.locator('#fxlab .trk').first().locator('button[title="xoá track"]').click();
  check('xoa track', await page.evaluate(() => __fxlab.cue.tracks.length) === n0);
  await page.selectOption('#fxlab .row select >> nth=2', 'ring').catch(() => {});
  await page.evaluate(() => __fxlab.addTrack('ring'));
  check('them track ring', await page.evaluate(() => __fxlab.cue.tracks.length) === n0 + 1);
  // ban nhap + khoi phuc
  const draft = await page.evaluate(() => localStorage.getItem('fxlab:draft:demo-hoa-cot'));
  check('luu nhap localStorage', !!draft && JSON.parse(draft).ramp === 'bang');
  await page.click('#fxlab button:has-text("Khôi phục bản gốc")');
  check('khoi phuc ban goc', await page.evaluate(() => __fxlab.cue.ramp === 'hoa' && localStorage.getItem('fxlab:draft:demo-hoa-cot') === null));
  // be nhin + canh bao ngan sach
  await page.click('#fxlab button:has-text("Đặt bù nhìn")');
  check('bu nhin xuat hien', await page.evaluate(() => !!__fxlab.dummy));
  await page.evaluate(() => { const c = __fxlab.cue; c.tracks.find(t => t.type === 'emitter' && t.config.frequency > 0).max = 300; c.tracks.find(t => t.type === 'emitter' && t.config.frequency > 0).config.quantity = 40; __fxlab.touch(); __fxlab.play(); });
  await page.waitForTimeout(1200);
  const warn = await page.locator('#fxlab .warn').innerText();
  check('canh bao do khi vuot ngan sach hat', /Hạt \d+ vượt ngân sách 120/.test(warn), warn.replace(/\n/g, ' | '));
  await page.evaluate(() => __fxlab.reset());
  // loop
  await page.evaluate(() => __fxlab.setLoop(true, 500)); await page.waitForTimeout(1700);
  check('lap chay', await page.evaluate(() => __fx.stats().active > 0));
  await page.evaluate(() => __fxlab.setLoop(false));
  // khong co co => khong co bang (kiem nhanh)
  check('0 loi console (desktop)', errs.length === 0, errs.join(' | '));
  await ctx.close();
}

// ---------- khong co co ?fxlab: khong bang
{
  const ctx = await browser.newContext({ viewport: { width: 960, height: 540 } }), page = await ctx.newPage();
  await page.goto(base, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__scene && window.__scene.fx, null, { timeout: 60000 });
  await page.waitForTimeout(800);
  check('khong co ?fxlab: khong co bang, khong co __fxlab', await page.evaluate(() => !document.querySelector('#fxlab') && !window.__fxlab && !window.__fxdemo));
  await ctx.close();
}

// ---------- mobile 844x390
{
  const { ctx, page, errs } = await open({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
  const box = () => page.locator('#fxlab').boundingBox();
  const b1 = await box();
  check('mobile: ngan keo duoi, khong che giua man hinh theo chieu doc', b1.y > 390 * 0.5 && b1.width >= 840, JSON.stringify(b1));
  await page.screenshot({ path: 'shots/fxlab_mobile.png' });
  await page.locator('#fxlab .hd').tap();
  const b2 = await box();
  check('mobile: gap lai (thap hon)', b2.height < 60 && await page.locator('#fxlab .body').isHidden(), `h ${b2.height}`);
  await page.locator('#fxlab .hd').tap();
  check('mobile: mo lai', (await box()).height > 100 && await page.locator('#fxlab .body').isVisible());
  check('mobile: nut cam ung 1/2/3 co', await page.evaluate(() => !!__fxdemo.btnBar));
  check('0 loi console (mobile)', errs.length === 0, errs.join(' | '));
  await ctx.close();
}

await browser.close();
console.log(out.join('\n'));
console.log(fail ? `TONG: ${fail} LOI` : 'TONG: tat ca dat');
process.exit(fail ? 1 : 0);
