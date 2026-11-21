// Bo do khu (GD2b/I4): node tools/area_metrics.mjs [--no-fps] [baseUrl]  -> bang PASS/FAIL/SKIP theo ma tieu chi file 15 muc 5, 3 khu xam.
//   L-1   cong 2 chieu: moi portal co spawn dich + co portal chieu nguoc ve khu nay voi spawn hop le
//   REACH duong toi duoc: BFS tu spawn mac dinh toi moi cong/spawn/cong trinh -> chay tools/blockout_reach.mjs (dung chung logic, khong chep lai) va doc ket qua tung khu
//   K-A2  khong doan mep thang > 64 px tren mat na di duoc (col = 0; TINH CA bien ngoai ban do; co tu kiem: mat na trong 10x10 phai FAIL)
//   K-A3  <= 3 lan / khu co 2 sprite cung khung (props.key) cach < 96 px
//   K-A6  FPS >= 50 (headless swiftshader): so frame game (__game.loop.frame) / thoi gian that trong 2 cua so 1.5 s co dinh khi dang di; so thuc, khong lam tron; mau thap nhat >= 50. --no-fps hoac khong khoi dong duoc -> SKIP + ly do
// Can bake san 3 khu (area.json). Thoat 1 neu co FAIL (SKIP khong tinh).
import { readFileSync } from 'node:fs';
import { spawn, spawnSync } from 'node:child_process';
const IDS = ['huyen-van-quan-v2', 'son-dao-v3', 'hau-son-v3'];
const args = process.argv.slice(2), noFps = args.includes('--no-fps'); let base = args.find(a => a.startsWith('http'));
const A = Object.fromEntries(IDS.map(id => [id, JSON.parse(readFileSync(`public/assets/areas/${id}/area.json`, 'utf8'))]));
const R = Object.fromEntries(IDS.map(id => [id, {}]));   // R[id][ma] = { s: 'PASS|FAIL|SKIP', d: chi tiet }
const put = (id, k, ok, d) => { R[id][k] = { s: ok === null ? 'SKIP' : ok ? 'PASS' : 'FAIL', d }; };

// ---- L-1
for (const id of IDS) {
  const bad = [];
  for (const p of A[id].portals) { const t = A[p.to.area]; const sp = t?.spawns?.[p.to.spawn]; const back = t?.portals.find(q => q.to.area === id);
    if (!t) bad.push(`${p.id}: khu dich ${p.to.area} khong co`); else if (!sp) bad.push(`${p.id}: spawn ${p.to.spawn} khong co`); else if (!back) bad.push(`${p.id}: khong co cong nguoc`); else if (!A[id].spawns[back.to.spawn]) bad.push(`${p.id}: cong nguoc ${back.id} -> spawn ${back.to.spawn} khong co`); }
  put(id, 'L-1', !bad.length, bad.length ? bad.join('; ') : `${A[id].portals.length} cong, 2 chieu day du`);
}
// ---- REACH (chay blockout_reach.mjs)
const rr = spawnSync(process.execPath, ['tools/blockout_reach.mjs'], { encoding: 'utf8', timeout: 30000 });
if (rr.error || rr.status === null) for (const id of IDS) put(id, 'REACH', null, 'khong chay duoc blockout_reach.mjs: ' + (rr.error?.message || 'timeout'));
else { const lines = rr.stdout.split('\n'); for (const id of IDS) {
  const mine = lines.filter(l => l.includes(id + ':') || l.includes(id + '/') || l.startsWith('== ' + id)), bad = mine.filter(l => l.startsWith('LOI')), sum = mine.find(l => l.includes(': toi duoc')) || '', cov = mine.find(l => l.startsWith('== '));
  put(id, 'REACH', !!sum && !bad.length, bad.length ? bad.map(l => l.trim()).join(' | ').slice(0, 300) : (sum.replace(/^OK\s+/, '') + (cov ? ' [' + cov.match(/toi (\d+ \([\d.]+ %\))/)?.[1] + ' o di duoc]' : '')).slice(0, 200)); } }
// ---- K-A2: doan mep thang tren mat na di duoc. Mep = canh o giua o di duoc va o khong di duoc HOAC ngoai ban do (bien ngoai tinh nhu mep); doan = chuoi canh lien tiep cung huong + cung phia.
function straightEdges(col) {
  const R = col.length, C = col[0].length, w = (x, y) => !col[y][x], runs = [];
  const scan = (outer, inner, isEdge) => { for (let o = 0; o < outer; o++) { let n = 0; for (let i = 0; i <= inner; i++) { const e = i < inner && isEdge(o, i); if (e) n++; else { if (n) runs.push(n * 32); n = 0; } } } };
  for (const [dx, dy] of [[0, -1], [0, 1]]) scan(R, C, (y, x) => w(x, y) && !(y + dy >= 0 && y + dy < R && w(x, y + dy)));   // mep ngang (tren/duoi), theo hang
  for (const [dx, dy] of [[-1, 0], [1, 0]]) scan(C, R, (x, y) => w(x, y) && !(x + dx >= 0 && x + dx < C && w(x + dx, y)));   // mep doc (trai/phai), theo cot
  return runs;
}
{ const m = straightEdges(Array.from({ length: 10 }, () => Array(10).fill(0))), mx = Math.max(0, ...m);   // tu kiem: mat na di duoc 10x10 (320 px moi canh) phai bi bat
  if (!(mx > 64)) { console.error(`TU KIEM K-A2 HONG: mat na 10x10 chi co doan dai nhat ${mx} px (phai > 64)`); process.exit(2); }
  console.log(`tu kiem K-A2: mat na trong 10x10 -> doan dai nhat ${mx} px > 64 -> FAIL (dung)
`); }
for (const id of IDS) { const runs = straightEdges(A[id].col), over = runs.filter(l => l > 64), mx = Math.max(0, ...runs); put(id, 'K-A2', !over.length, `${over.length} doan > 64 px (dai nhat ${mx} px, tong ${runs.length} doan)`); }
// ---- K-A3
for (const id of IDS) { const ps = A[id].props || [], pairs = []; for (let i = 0; i < ps.length; i++) for (let j = i + 1; j < ps.length; j++) if (ps[i].key === ps[j].key && Math.hypot(ps[i].x - ps[j].x, ps[i].y - ps[j].y) < 96) pairs.push([ps[i].key, ps[j].key]);
  put(id, 'K-A3', pairs.length <= 3, `${pairs.length} cap trung < 96 px (${ps.length} sprite${ps.length ? '' : ' - khu xam chua co sprite nen dat hien nhien'})`); }
// ---- K-A6
async function fps() {
  let srv = null;
  try {
    const { chromium } = await import('playwright');
    if (!base) { srv = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--port', '5195', '--strictPort'], { stdio: 'ignore' }); base = 'http://localhost:5195/';
      for (let i = 0; i < 60; i++) { try { if ((await fetch(base)).ok) break; } catch (e) { /* cho */ } await new Promise(r => setTimeout(r, 250)); } }
    const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
    try {
      for (const id of IDS) {
        const ctx = await browser.newContext({ viewport: { width: 960, height: 540 } }), page = await ctx.newPage();
        await page.goto(base + '?area=' + id, { waitUntil: 'load' });
        await page.waitForFunction(i => window.__scene?.meta?.id === i && window.__scene.player?.active, id, { timeout: 20000 });
        await page.waitForTimeout(1000); await page.keyboard.down('ArrowLeft'); await page.waitForTimeout(3000);
        // dem frame game (loop.frame) / thoi gian that trong cua so co dinh 1.5 s, 2 lan; khong lam tron truoc khi so 50
        const s = []; for (let i = 0; i < 2; i++) s.push(await page.evaluate(ms => new Promise(res => { const f0 = __game.loop.frame, t0 = performance.now(); setTimeout(() => res({ frames: __game.loop.frame - f0, ms: performance.now() - t0 }), ms); }), 1500));
        await page.keyboard.up('ArrowLeft'); await ctx.close();
        const v = s.map(r => r.frames / r.ms * 1000), mn = Math.min(...v);
        put(id, 'K-A6', mn >= 50, `fps ${v.map(x => x.toFixed(2)).join(' / ')} (${s.map(r => `${r.frames} frame/${r.ms.toFixed(0)} ms`).join(', ')}); thap nhat ${mn.toFixed(2)} vs 50; headless swiftshader`);
      }
    } finally { await browser.close(); }
  } catch (e) { for (const id of IDS) if (!R[id]['K-A6']) put(id, 'K-A6', null, 'khong do duoc: ' + String(e.message || e).split('\n')[0].slice(0, 120)); }
  finally { if (srv) srv.kill(); }
}
if (noFps) for (const id of IDS) put(id, 'K-A6', null, 'bo qua do FPS (--no-fps)'); else await fps();
// ---- bang
const CODES = ['L-1', 'REACH', 'K-A2', 'K-A3', 'K-A6']; let fail = 0;
console.log('| khu | ' + CODES.join(' | ') + ' |\n|---|' + CODES.map(() => '---').join('|') + '|');
for (const id of IDS) console.log(`| ${id} | ${CODES.map(c => R[id][c].s).join(' | ')} |`);
console.log('\nChi tiet:'); for (const id of IDS) for (const c of CODES) { const r = R[id][c]; if (r.s === 'FAIL') fail++; console.log(`  ${r.s.padEnd(4)} ${id.padEnd(18)} ${c.padEnd(5)} ${r.d}`); }
console.log(fail ? `\n${fail} FAIL` : '\nKHONG CO FAIL'); process.exit(fail ? 1 : 0);
