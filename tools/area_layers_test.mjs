// Test I2 (tang dai + bac) va I3/K-A4 (tan/mai mo): node tools/area_layers_test.mjs [baseUrl]   (khong co: tu bat vite dev cong 5196, tu tat)
// Phan A (thuan, khong trinh duyet): du lieu tang/bac cua 3 khu xam + quet vi tri mai che than.
// Phan B (trinh duyet headless): di that len/xuong bac, dung o mep tang khong buoc xuong duoc, mai cong/dien khu cu mo khi che.
import { readFileSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { stepAt, tierAt, tierStepOk, roofTargetAlpha, bodyVisible, ROOF_FADE_ALPHA, bodyRect, isRoofFrame, alphaMaskRects, STEP_TOL } from '../src/areaLayers.js';
import { decodePng } from './png.mjs';
const IDS = ['huyen-van-quan-v2', 'son-dao-v3', 'hau-son-v3'];
const A = Object.fromEntries(IDS.map(id => [id, JSON.parse(readFileSync(`public/assets/areas/${id}/area.json`, 'utf8'))]));
let fail = 0; const ck = (n, ok, i = '') => { console.log((ok ? 'OK   ' : 'LOI  ') + n + (i ? ' ' + i : '')); if (!ok) fail++; };

// ================= A. thuan
for (const id of IDS) {
  const a = A[id], col = a.col, R = col.length, C = col[0].length, T = a.tierRows;
  ck(`${id}: co tierRows ${R}x${C} + ${a.steps.length} bac`, T?.length === R && T[0].length === C && a.steps.length > 0);
  // I2: moi cap o ke nhau di duoc (col=0) khac tang -> mot trong hai o nam trong bac noi dung cap tang do (mep tang chi qua o bac)
  let pairs = 0; const bad = [];
  const lv = (x, y) => (T[y][x] === '.' ? -1 : +T[y][x]);
  const inStep = (x, y, la, lb) => { const s = stepAt(a, x * 32 + 16, y * 32 + 16); return !!s && Math.min(la, lb) >= s.lo && Math.max(la, lb) <= s.hi; };
  for (let y = 0; y < R; y++) for (let x = 0; x < C; x++) {
    if (col[y][x] || lv(x, y) < 0) continue;
    for (const [dx, dy] of [[1, 0], [0, 1]]) {
      const X = x + dx, Y = y + dy; if (X >= C || Y >= R || col[Y][X] || lv(X, Y) < 0) continue;
      const la = lv(x, y), lb = lv(X, Y);
      if (la !== lb) { pairs++; if (!inStep(x, y, la, lb) && !inStep(X, Y, la, lb)) bad.push(`(${x},${y})L${la}-(${X},${Y})L${lb}`); }
    }
  }
  ck(`${id}: o ke nhau di duoc khac tang chi o bac (${pairs} cap)`, !bad.length, bad.slice(0, 4).join(' '));
  // moi bac: noi suy lo -> hi tang don dieu; chan duoi o tang lo, dau tren o tang hi, ca hai di duoc
  const walkAt = (x, y) => col[Math.floor(y / 32)]?.[Math.floor(x / 32)] === 0;
  for (const s of a.steps) {
    const [rx, ry, rw, rh] = s.rect, cx = rx + rw / 2;
    const pts = [0, 0.25, 0.5, 0.75, 1].map(t => tierAt(a, cx, ry + rh - 0.01 - t * (rh - 0.02)));   // dir = up trong du lieu hien tai
    const mono = pts.every((v, i) => i === 0 || v >= pts[i - 1]), ends = Math.abs(pts[0] - s.lo) < 0.02 && Math.abs(pts[4] - s.hi) < 0.02;
    const below = ry + rh + 20 < R * 32 ? tierAt(a, cx, ry + rh + 20, -9) : s.lo, above = ry - 20 >= 0 ? tierAt(a, cx, ry - 20, -9) : s.hi;   // ngoai ban do thi bo qua
    ck(`${id}/${s.id}: tang ${s.lo}->${s.hi} noi suy don dieu [${pts.map(v => v.toFixed(2)).join(' ')}]; truoc bac tang ${below}, sau bac tang ${above}; hai dau di duoc`,
      s.dir === 'up' && mono && ends && (below === s.lo || below === -9) && above === s.hi && (ry + rh + 20 >= R * 32 || walkAt(cx, ry + rh + 20)) && (ry - 20 < 0 || walkAt(cx, ry - 20)));
  }
  // bao ve tierStepOk: nhay tu o tang thap sang o tang cao ngoai bac bi tu choi, di qua bac thi chap nhan
  let rej = 0, tried = 0;
  for (let y = 1; y < R - 1; y++) for (let x = 1; x < C - 1; x++) {
    const la = lv(x, y), lb = lv(x, y - 1), px = x * 32 + 16, py = y * 32 + 16;
    if (la >= 0 && lb > la && !stepAt(a, px, py) && !stepAt(a, px, py - 32)) { tried++; if (!tierStepOk(a, px, py, px, py - 32)) rej++; }
  }
  ck(`${id}: tierStepOk tu choi moi cu nhay tang ngoai bac (${rej}/${tried})`, rej === tried);
  for (const s of a.steps) {   // di bo tung 2 px tu duoi bac len tren bac: moi buoc deu hop le, ca chang tang di tu lo toi hi
    const cx = s.rect[0] + s.rect[2] / 2; let okAll = true, py = Math.min(R * 32 - 1, s.rect[1] + s.rect[3] + 10), cur = s.lo;   // cur = tang hien tai, cap nhat theo tung buoc nhu AreaScene
    for (; py > s.rect[1] - 10; py -= 2) { if (!tierStepOk(a, cx, py, cx, py - 2, cur)) okAll = false; cur = tierAt(a, cx, py - 2, cur); }
    ck(`${id}/${s.id}: tierStepOk cho phep di bo tung 2 px xuyen bac`, okAll);
  }
}
// P1-a (hoi quy): khu hoi moi cap o ke nhau di duoc CUNG tang (hoac mot o '.' ngoai tang): buoc qua ranh 2 px phai duoc CA HAI CHIEU khi truyen tang hien tai (o '.' giu tang cu)
for (const id of IDS) {
  const a = A[id], col = a.col, R = col.length, C = col[0].length, T = a.tierRows; let tried = 0; const bad = [];
  for (let y = 0; y < R; y++) for (let x = 0; x < C; x++) {
    if (col[y][x]) continue;
    for (const [dx, dy] of [[1, 0], [0, 1]]) {
      const X = x + dx, Y = y + dy; if (X >= C || Y >= R || col[Y][X]) continue;
      const ca = T[y][x], cb = T[Y][X]; if (ca === '.' && cb === '.') continue; if (ca !== '.' && cb !== '.' && ca !== cb) continue;
      const cur = +(ca === '.' ? cb : ca), bx = (x + dx * 0.5 + 0.5) * 32, by = (y + dy * 0.5 + 0.5) * 32, ex = dx * 1, ey = dy * 1;   // diem giua 2 tam o (tren ranh), lui/tien 1 px
      const p0 = [bx - ex, by - ey], p1 = [bx + ex, by + ey]; tried++;
      if (stepAt(a, ...p0) || stepAt(a, ...p1)) continue;   // cap tren bac thuoc phan P1-b
      if (!tierStepOk(a, ...p0, ...p1, cur) || !tierStepOk(a, ...p1, ...p0, cur)) bad.push(`(${x},${y})-(${X},${Y}) cur ${cur}`);
    }
  }
  ck(`${id}: khu hoi moi cap o ke cung tang qua ranh 2 chieu deu duoc (${tried} cap)`, !bad.length, bad.slice(0, 4).join(' '));
}
{ const a = A['son-dao-v3']; ck('P1-a Son Dao (464,801)<->(464,799) tang hien tai 2: ca hai chieu duoc', tierStepOk(a, 464, 801, 464, 799, 2) && tierStepOk(a, 464, 799, 464, 801, 2), `di ${tierStepOk(a, 464, 801, 464, 799, 2)} ve ${tierStepOk(a, 464, 799, 464, 801, 2)}`); }
// P1-b (hoi quy): thoat HONG giua bac bi chan (tang bac khac tang o ben canh >= STEP_TOL); di het bac doc truc van duoc. Ca 2 canh, o 4 diem tien do 0.3..0.7
for (const id of IDS) for (const sp of A[id].steps) {
  const a = A[id], [rx, ry, rw, rh] = sp.rect; let blockedAll = true, n = 0; const leaks = [];
  for (const pr of [0.3, 0.4, 0.5, 0.6, 0.7]) { const y = ry + rh * (1 - pr);   // dir up: tien do = tu duoi len
    for (const [xin, xout] of [[rx + 1, rx - 1], [rx + rw - 1, rx + rw + 1]]) {
      const walk = a.col[Math.floor(y / 32)]?.[Math.floor(xout / 32)] === 0; if (!walk) continue;   // ben canh la o chan: da bi luoi col chan
      n++; const cur = tierAt(a, xin, y), out = tierAt(a, xout, y, cur); if (Math.abs(out - cur) < STEP_TOL) continue;   // tang o ben canh khop tang bac -> thoat hop le
      if (tierStepOk(a, xin, y, xout, y, cur)) { blockedAll = false; leaks.push(`(${xin},${Math.round(y)})->(${xout})`); } }
  }
  ck(`P1-b ${id}/${sp.id}: thoat hong giua bac bi chan (${n} diem ben canh di duoc)`, blockedAll, leaks.slice(0, 3).join(' '));
}
{ const a = A['son-dao-v3']; ck('P1-b Son Dao bac-2 (257,1022)->(255,1022) bi chan', !tierStepOk(a, 257, 1022, 255, 1022, tierAt(a, 257, 1022))); }
// I3 that: mat na pixel dac cua hall_roof / gate_roof doc tu sect_atlas.png that
const atlas = decodePng('public/assets/sect/sect_atlas.png'), AJ = JSON.parse(readFileSync('public/assets/sect/sect_atlas.json', 'utf8')), MASK = {};
for (const k of ['hall_roof', 'gate_roof']) { const f = AJ.frames[k].frame; MASK[k] = alphaMaskRects(atlas.data, atlas.w, atlas.h, 200, 200, f); }
{
  const bb = r => r.reduce((m, q) => [Math.min(m[0], q[0]), Math.min(m[1], q[1]), Math.max(m[2], q[0] + q[2]), Math.max(m[3], q[1] + q[3])], [1e9, 1e9, -1e9, -1e9]), hb = bb(MASK.hall_roof);
  ck(`I3 mat na that hall_roof: pixel dac cao ${hb[3] - hb[1]} / 235 px (phai < 235), ${MASK.hall_roof.length} rect`, hb[3] - hb[1] < 200 && MASK.hall_roof.length > 0);
  // khung 338x235 tai (200,200) -> dung truoc dien (330 - 327 = x+3, y goc 33 -> 200 - 33 = 167 duoi dinh anh) giong tinh huong review (330,200) o toa do the gioi (anh o 327,33)
  const wx = 327 - 200, wy = 33 - 200, al = roofTargetAlpha(MASK.hall_roof, 330 - wx, 200 - wy);
  ck(`I3 dung truoc dien (330,200) voi mat na that: mai khong mo (alpha ${al})`, al === 1);
  for (const k of ['hall_roof', 'gate_roof']) { let n = 0, mv = 1, nf = 0;
    for (let x = 80; x <= 560; x += 3) for (let y = 120; y <= 520; y += 3) { const al2 = roofTargetAlpha(MASK[k], x, y), cov = bodyVisible(MASK[k], x, y, 1) < 1; if (cov) { n++; mv = Math.min(mv, bodyVisible(MASK[k], x, y, al2)); if (al2 > ROOF_FADE_ALPHA + 1e-9) nf++; } }
    ck(`I3 mat na that ${k}: ${n} vi tri che, than thay toi thieu ${(mv * 100).toFixed(1)} % (>= 60 %), ${nf} vi tri che chua mo`, n > 0 && mv >= 0.6 && nf === 0); }
}

// I3 thuan: moi kich thuoc mai quet than nhan vat moi 2 px: cho nao than giao bbox thi alpha on dinh -> than thay >= 60 %
{
  const SIZES = [[64, 64], [128, 96], [338, 235], [259, 191], [448, 304], [30, 20]]; let n = 0, minVis = 1, noFade = 0, farOk = true;
  for (const [w, h] of SIZES) {
    const roof = [200, 200, w, h];
    for (let x = roof[0] - 120; x <= roof[0] + w + 120; x += 2) for (let y = roof[1] - 20; y <= roof[1] + h + 120; y += 2) {
      const al = roofTargetAlpha(roof, x, y), b = bodyRect(x, y), covers = b[0] < roof[0] + w && roof[0] < b[0] + b[2] && b[1] < roof[1] + h && roof[1] < b[1] + b[3];
      if (covers) { n++; minVis = Math.min(minVis, bodyVisible(roof, x, y, al)); if (al > ROOF_FADE_ALPHA + 1e-9) noFade++; }
      if (al < 1 && (x < roof[0] - 60 || x > roof[0] + w + 60)) farOk = false;
    }
  }
  ck(`I3 quet ${n} vi tri che: than thay duoc toi thieu ${(minVis * 100).toFixed(1)} % (can >= 60 %), ${noFade} vi tri che ma mai chua mo`, minVis >= 0.6 && noFade === 0);
  ck('I3 xa mai > 60 px theo chieu ngang thi mai khong mo', farOk);
  ck('isRoofFrame nhan *_roof / canopy', isRoofFrame('hall_roof') && isRoofFrame('forest:canopy_2') && isRoofFrame('tamthanh_roof') && !isRoofFrame('pine_a') && !isRoofFrame('roofer'));
}

// ================= B. trinh duyet
let srv = null, base = process.argv[2];
try {
  const { chromium } = await import('playwright');
  if (!base) {
    srv = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--port', '5196', '--strictPort'], { stdio: 'ignore' }); base = 'http://localhost:5196/';
    for (let i = 0; i < 60; i++) { try { if ((await fetch(base)).ok) break; } catch (e) { /* cho */ } await new Promise(r => setTimeout(r, 250)); }
  }
  const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  try {
    const ctx = await browser.newContext({ viewport: { width: 960, height: 540 } }), page = await ctx.newPage(), errs = [];
    await ctx.addInitScript(() => { try { localStorage.clear(); } catch (e) { /* */ } });
    page.on('pageerror', e => errs.push(e.message));
    page.on('console', m => { if ((m.type() === 'error' || m.type() === 'warning') && !/GL Driver Message|CONTEXT_LOST_WEBGL/.test(m.text())) errs.push(m.text()); });
    const open = async id => { await page.goto(base + '?area=' + id, { waitUntil: 'load' }); await page.waitForFunction(i => window.__scene?.meta?.id === i && window.__scene.player?.active && !window.__scene.busy, id, { timeout: 20000 }); await page.waitForTimeout(500); };
    const tele = (x, y) => page.evaluate(([x, y]) => { __scene.player.setPosition(x, y); __scene.player.setVelocity(0, 0); __scene.cameras.main.centerOn(x, y); }, [x, y]);
    const st = () => page.evaluate(() => ({ x: Math.round(__scene.player.x), y: Math.round(__scene.player.y), tier: +__scene.tier.toFixed(3), depth: __scene.player.depth }));
    const hold = async (key, ms, shift) => { if (shift) await page.keyboard.down('Shift'); await page.keyboard.down(key); await page.waitForTimeout(ms); await page.keyboard.up(key); if (shift) await page.keyboard.up('Shift'); await page.waitForTimeout(150); };
    // ---- I2: len / xuong bac Son Dao bac-1 (tang 0 -> 1), x giua bac
    await open('son-dao-v3');
    const s1 = A['son-dao-v3'].steps.find(s => s.id === 'bac-1'), [rx, ry, rw, rh] = s1.rect, mx = rx + rw / 2;
    await tele(mx, ry + rh + 24); await page.waitForTimeout(200); let p = await st();
    ck('I2 dung duoi bac-1: tang 0', p.tier === 0, JSON.stringify(p));
    await hold('ArrowUp', 2000, true); p = await st();   // chay (118 px/s x 2 s ~ 236 px)
    ck('I2 giu Len: len qua bac -> tang 1 o dau tren', p.tier === 1 && p.y < ry, JSON.stringify(p));
    ck('I2 depth nguoi = y + tang * 0.01', Math.abs(p.depth - (p.y + p.tier * 0.01)) < 0.6, 'depth ' + p.depth);
    await tele(mx, ry + rh / 2); await page.waitForTimeout(150); p = await st();
    ck('I2 giua bac: tang noi suy 0.2 < t < 0.8', p.tier > 0.2 && p.tier < 0.8, JSON.stringify(p));
    await tele(mx, ry + 20); await hold('ArrowDown', 1500, true); p = await st();
    ck('I2 giu Xuong: xuong qua bac -> tang 0 o chan duoi', p.tier === 0 && p.y > ry + rh, JSON.stringify(p));
    // ---- I2: dung o mep tang (o di duoc sat mep, phia Nam la o mep chan) khong buoc xuong duoc
    for (const id of ['son-dao-v3', 'huyen-van-quan-v2']) {
      await open(id);
      const a = A[id], col = a.col, T = a.tierRows, R = col.length, C = col[0].length; let found = null;
      const nearStep = (x, y) => a.steps.some(s => x * 32 + 16 > s.rect[0] - 96 && x * 32 + 16 < s.rect[0] + s.rect[2] + 96 && y * 32 + 16 > s.rect[1] - 96 && y * 32 + 16 < s.rect[1] + s.rect[3] + 96);
      for (const strict of [true, false]) for (let y = 1; y < R - 3 && !found; y++) for (let x = 2; x < C - 2 && !found; x++) {   // luot 1: mep tang that (o mep cung tang, duoi no tang thap); luot 2: rim tang (o chan bat ky)
        const L = T[y][x] === '.' ? -1 : +T[y][x];
        if (L < 1 || col[y][x] || !col[y + 1][x] || col[y][x - 1] || col[y][x + 1] || nearStep(x, y)) continue;
        if (strict && (T[y + 1][x] === '.' || +T[y + 1][x] !== L || (T[y + 2][x] !== '.' && +T[y + 2][x] >= L))) continue;
        found = [x, y, L, strict];
      }
      if (!found) { ck(`I2 ${id}: tim duoc mep tang de thu`, false); continue; }
      const [x, y, L, strictEdge] = found; await tele(x * 32 + 16, y * 32 + 20); await page.waitForTimeout(200); const before = await st();
      await hold('ArrowDown', 2500, true); p = await st();
      ck(`I2 ${id}: dung ${strictEdge ? 'mep tang' : 'rim tang'} ${L} o o (${x},${y}), giu Xuong 2.5 s: khong xuong tang thap (tang ${p.tier}, y ${before.y} -> ${p.y}, mep o hang ${y + 1} = y ${(y + 1) * 32})`, p.tier === L && p.y < (y + 1) * 32, JSON.stringify(p));
      await tele(x * 32 + 16, y * 32 + 20); await hold('ArrowDown', 1000); await hold('ArrowLeft', 800); p = await st();
      ck(`I2 ${id}: truot doc mep van o tang ${L}`, p.tier === L, JSON.stringify(p));
    }
    // ---- I3: mai cong + dien (khu cu huyen-van-quan co hall_roof / gate_roof)
    await open('huyen-van-quan');
    const roofs = await page.evaluate(() => __scene.roofs.map(r => ({ rect: r.rect, a: r.img.alpha, d: r.img.depth })));
    ck('I3 khu cu dang ky mai (hall_roof + gate_roof)', roofs.length === 2, JSON.stringify(roofs.map(r => r.rect)));
    const gi = roofs.findIndex(r => r.d === 8000), hi = roofs.findIndex(r => r.d !== 8000);
    const [gx, gy, gw, gh] = roofs[gi].rect, [hx, hy, hw, hh] = roofs[hi].rect;
    const alphaOf = () => page.evaluate(() => __scene.roofs.map(r => +r.img.alpha.toFixed(3)));
    await tele(gx + gw / 2, gy + gh * 0.6); await page.waitForTimeout(700); let al = await alphaOf();   // trong bbox mai cong (mai depth 8000 luon de len)
    const gv = await page.evaluate(i => { const r = __scene.roofs[i]; return { rect: r.rect, a: r.img.alpha, x: __scene.player.x, y: __scene.player.y }; }, gi);
    const vf = bodyVisible(gv.rect, gv.x, gv.y, gv.a);
    ck(`I3 nhan vat duoi mai cong: alpha mai ${gv.a} <= ${ROOF_FADE_ALPHA}, than thay ${(vf * 100).toFixed(1)} % >= 60 %`, gv.a <= ROOF_FADE_ALPHA + 0.001 && vf >= 0.6, JSON.stringify(al));
    await tele(gx + gw / 2, gy + gh + 140); await page.waitForTimeout(700); al = await alphaOf();
    ck('I3 ra xa mai: mai tro lai alpha 1', al.every(v => v === 1), JSON.stringify(al));
    await tele(hx + hw / 2, hy + hh * 0.35); await page.waitForTimeout(700); al = await alphaOf();   // sau (phia Bac) than dien: mai ve de len
    ck(`I3 nhan vat sau dien (y nho hon): mai dien mo (alpha ${al[hi]})`, al[hi] <= ROOF_FADE_ALPHA + 0.001, JSON.stringify(al));
    await tele(hx + hw / 2, hy + hh + 30); await page.waitForTimeout(700); al = await alphaOf();   // truoc dien: khong bi che -> mai khong mo
    ck(`I3 nhan vat truoc dien (khong bi che): mai dien giu alpha 1 (alpha ${al[hi]})`, al[hi] === 1, JSON.stringify(al));
    await tele(330, 200); await page.waitForTimeout(700); al = await alphaOf();   // P2-a: goc duoi trai bbox anh nhung ngoai pixel mai that
    ck(`P2-a dung (330,200) (trong bbox anh 338x235, ngoai pixel mai): mai dien khong mo (alpha ${al[hi]})`, al[hi] === 1, JSON.stringify(al));
    const nr = await page.evaluate(i => __scene.roofs[i].rects.length, hi); ck(`P2-a canh dung mat na pixel (${nr} rect, khong phai bbox 1 rect)`, nr > 1);
    ck('0 loi console', errs.length === 0, JSON.stringify(errs).slice(0, 300));
  } finally { await browser.close(); }
} catch (e) { ck('phan trinh duyet chay het', false, String(e.stack || e).slice(0, 500)); } finally { if (srv) srv.kill(); }
console.log(fail ? `\n${fail} LOI` : '\nTAT CA DAT'); process.exit(fail ? 1 : 0);
