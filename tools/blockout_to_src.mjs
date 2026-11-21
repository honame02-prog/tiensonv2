// Khu xam (GD2b/I1): sinh 3 file src.json tu so do khoi (layout.json, o 32 px) de bake bang tools/area_bake.mjs.
//   node tools/blockout_to_src.mjs [duong-dan-layout.json]   (mac dinh: tools/areas/blockout-layout.json, ban chep tu design/tienson/blockout/tools/layout.json)
// Sinh: tools/areas/{huyen-van-quan-v2,son-dao-v3,hau-son-v3}.src.json + tools/areas/blockout-materials.json
// Luat o di duoc: trong tiers  U  dai duong (main rong 2.5 o, side 1.5 o)  U  bac/cau/cua cong  -  khoi cong trinh  -  nuoc  -  walls  -  mep giua 2 tang khac level
// (chi ho o cho bac/cau). Cong (gate) rong >= 5 o: 2 dau chan (1.5 o), giua la loi di; cong hep: di xuyen.
import { readFileSync, writeFileSync } from 'node:fs';

const layoutFile = process.argv[2] || 'tools/areas/blockout-layout.json';
const L = JSON.parse(readFileSync(layoutFile, 'utf8'));
const ID = { hvq: 'huyen-van-quan-v2', 'son-dao': 'son-dao-v3', 'hau-son': 'hau-son-v3' };
const META = {
  hvq: { name: 'Huyền Vân Quan (khu xám)', sub: 'Sơ đồ khối v2 — thử kích thước và nhịp đường' },
  'son-dao': { name: 'Sơn Đạo (khu xám)', sub: 'Sơ đồ khối v3 — thử kích thước và nhịp đường' },
  'hau-son': { name: 'Hậu Sơn (khu xám)', sub: 'Sơ đồ khối v3 — thử kích thước và nhịp đường' },
};
const DIR = { N: 'up', S: 'down', E: 'right', W: 'left' };
const ZC = { cloud: '#dfe8f1', cliff: '#6b6760', mountain: '#8a8278', forest: '#4d7548', pine: '#3f6650', bamboo: '#86b05c', water: '#6fa6cf', garden: '#a9c27a', rock: '#9a958c' };
const BC = { hall: '#9c3b36', building: '#b8574c', pavilion: '#c9785a', gate: '#7b3f8c', prop: '#3f6aa3', bridge: '#8a6a3a', stairs: '#cfc2a3', water: '#6fa6cf' };
const TIER = Object.fromEntries(L.tiers.map(t => [t.level, t.color]));
const WALL_C = '#7a2e22', EDGE_C = '#5b4636', MAIN_C = '#e07b1a', SIDE_C = '#d9b21c', NEUTRAL = '#cdbf9a';
const hex = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
const toHex = c => '#' + c.map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
const mix = (a, b, t) => { const x = hex(a), y = hex(b); return toHex(x.map((v, i) => v * (1 - t) + y[i] * t)); };
const dim = (a, k) => toHex(hex(a).map(v => v * k));

const inPoly = (poly, x, y) => { let ins = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const [xi, yi] = poly[i], [xj, yj] = poly[j]; if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) ins = !ins; } return ins; };
const segDist = (px, py, a, b) => { const dx = b[0] - a[0], dy = b[1] - a[1], l2 = dx * dx + dy * dy; let t = l2 ? ((px - a[0]) * dx + (py - a[1]) * dy) / l2 : 0; t = Math.max(0, Math.min(1, t)); return Math.hypot(px - a[0] - dx * t, py - a[1] - dy * t); };
const overlap = (cx, cy, b) => Math.max(0, Math.min(cx + 1, b.x + b.w) - Math.max(cx, b.x)) * Math.max(0, Math.min(cy + 1, b.y + b.h) - Math.max(cy, b.y));   // dien tich giao o (cx,cy) voi khoi, don vi o^2
const fold = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[đĐ]/g, 'd').toUpperCase().replace(/[^A-Z0-9.\/\- ]/g, ' ').replace(/\s+/g, ' ').trim();

// Sua loi du lieu so do khoi (khong sua duoc layout.json): moi muc {note, rect:[x,y,w,h] don vi o} -> o co tam trong rect thanh loi di (xoa tuong/mep tang), to xanh de thay. Danh sach nay LA bao cao loi so do.
const FIXES = (() => { try { return JSON.parse(readFileSync('tools/areas/blockout-fixes.json', 'utf8')); } catch (e) { return {}; } })();
const FIX_C = '#4fb06a';
const mats = {};   // ten -> mau
const matOf = hexc => { const n = 'c_' + hexc.slice(1); mats[n] = { type: 'flat', color: hex(hexc) }; return n; };
const report = [];

for (const A of L.areas) {
  const id = ID[A.id], W = A.w, H = A.h, PW = W * 32, PH = H * 32;
  const grid = (f) => Array.from({ length: H }, (_, cy) => Array.from({ length: W }, (_, cx) => f(cx, cy)));
  // ---- lop co so
  const zoneAt = grid((cx, cy) => { let k = A.base; for (const z of A.zones) if (inPoly(z.poly, cx + 0.5, cy + 0.5)) k = z.kind; return k; });
  const lvl = grid((cx, cy) => { let m = -1; for (const t of A.tiers) if (t.level > m && inPoly(t.poly, cx + 0.5, cy + 0.5)) m = t.level; return m; });
  const strip = grid(() => 0);   // 0 / 1 side / 2 main
  for (const p of A.paths) { const hw = p.kind === 'main' ? 1.25 : 0.75, v = p.kind === 'main' ? 2 : 1;
    for (let cy = 0; cy < H; cy++) for (let cx = 0; cx < W; cx++) { let d = 1e9; for (let i = 0; i + 1 < p.pts.length; i++) d = Math.min(d, segDist(cx + 0.5, cy + 0.5, p.pts[i], p.pts[i + 1])); if (d <= hw) strip[cy][cx] = Math.max(strip[cy][cx], v); } }
  // ---- khoi
  const solid = grid(() => 0), wild = grid(() => 0), water = grid(() => 0), wall = grid(() => 0), edge = grid(() => 0);
  for (let cy = 0; cy < H; cy++) for (let cx = 0; cx < W; cx++) if (zoneAt[cy][cx] === 'water') water[cy][cx] = 1;
  for (const b of A.blocks) {
    const cells = []; let best = null;
    for (let cy = Math.max(0, Math.floor(b.y)); cy < Math.min(H, Math.ceil(b.y + b.h)); cy++) for (let cx = Math.max(0, Math.floor(b.x)); cx < Math.min(W, Math.ceil(b.x + b.w)); cx++) {
      const o = overlap(cx, cy, b); if (!best || o > best.o) best = { cx, cy, o }; if (o >= 0.3) cells.push([cx, cy]);
    }
    if (!cells.length && best) cells.push([best.cx, best.cy]);
    if (b.kind === 'stairs' || b.kind === 'bridge') { for (let cy = Math.max(0, Math.floor(b.y)); cy < Math.min(H, Math.ceil(b.y + b.h)); cy++) for (let cx = Math.max(0, Math.floor(b.x)); cx < Math.min(W, Math.ceil(b.x + b.w)); cx++) if (overlap(cx, cy, b) >= 0.25) wild[cy][cx] = 1; }
    else if (b.kind === 'water') cells.forEach(([cx, cy]) => { water[cy][cx] = 1; });
    else if (b.kind === 'gate') cells.forEach(([cx, cy]) => { const mx = cx + 0.5, side = b.w >= 5 && (mx < b.x + 1.5 || mx > b.x + b.w - 1.5); if (side) solid[cy][cx] = 1; else wild[cy][cx] = 1; });
    else cells.forEach(([cx, cy]) => { solid[cy][cx] = 1; });
  }
  for (const w of A.walls) for (let i = 0; i + 1 < w.pts.length; i++) {
    const a = w.pts[i], c = w.pts[i + 1], len = Math.hypot(c[0] - a[0], c[1] - a[1]), n = Math.max(1, Math.round(len / 0.1));
    for (let k = 0; k < n; k++) { const t = (k + 0.5) / n, cx = Math.floor(a[0] + (c[0] - a[0]) * t), cy = Math.floor(a[1] + (c[1] - a[1]) * t); if (cx >= 0 && cy >= 0 && cx < W && cy < H) wall[cy][cx] = 1; }
  }
  const fixc = grid(() => 0);
  for (const f of FIXES[A.id] || []) for (let cy = 0; cy < H; cy++) for (let cx = 0; cx < W; cx++) { const mx = cx + 0.5, my = cy + 0.5; if (mx >= f.rect[0] && mx <= f.rect[0] + f.rect[2] && my >= f.rect[1] && my <= f.rect[1] + f.rect[3]) { fixc[cy][cx] = 1; wall[cy][cx] = 0; solid[cy][cx] = 0; water[cy][cx] = 0; wild[cy][cx] = 1; } }
  // ---- o di duoc truoc khi tinh mep tang
  const walk0 = grid((cx, cy) => wild[cy][cx] ? 1 : (lvl[cy][cx] >= 0 || strip[cy][cx]) && !water[cy][cx] && !solid[cy][cx] && !wall[cy][cx] ? 1 : 0);
  // mep giua 2 tang khac level: o co level cao hon bi chan (tru o bac/cau/cong)
  for (let cy = 0; cy < H; cy++) for (let cx = 0; cx < W; cx++) {
    if (!walk0[cy][cx] || wild[cy][cx] || lvl[cy][cx] < 0) continue;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const x = cx + dx, y = cy + dy; if (x < 0 || y < 0 || x >= W || y >= H) continue;
      if (walk0[y][x] && !wild[y][x] && lvl[y][x] >= 0 && lvl[y][x] < lvl[cy][cx]) { edge[cy][cx] = 1; break; } }
  }
  const col = grid((cx, cy) => (walk0[cy][cx] && !edge[cy][cx]) ? 0 : 1);
  // ---- mau tung o
  const colorOf = (cx, cy) => {
    const z = zoneAt[cy][cx];
    if (fixc[cy][cx]) return FIX_C;
    if (wild[cy][cx]) return lvl[cy][cx] >= 0 ? TIER[lvl[cy][cx]] : NEUTRAL;
    if (water[cy][cx]) return ZC.water;
    if (wall[cy][cx]) return WALL_C;
    if (edge[cy][cx]) return EDGE_C;
    if (walk0[cy][cx]) { const base = lvl[cy][cx] >= 0 ? TIER[lvl[cy][cx]] : NEUTRAL; return strip[cy][cx] === 2 ? mix(base, MAIN_C, 0.35) : strip[cy][cx] === 1 ? mix(base, SIDE_C, 0.3) : base; }
    return dim(ZC[z] || ZC.cliff, 0.82);   // khong di duoc: mau zone toi hon chut
  };
  const byColor = {};
  for (let cy = 0; cy < H; cy++) { let cx = 0; while (cx < W) { const c = colorOf(cx, cy); let e = cx; while (e + 1 < W && colorOf(e + 1, cy) === c) e++; (byColor[c] ||= []).push([cy, cx, e]); cx = e + 1; } }
  const regions = [{ material: matOf(dim(ZC[A.base] || ZC.cliff, 0.82)), fill: true }];
  for (const [c, rows] of Object.entries(byColor)) regions.push({ material: matOf(c), cells: rows });
  const rect = b => [[b.x * 32, b.y * 32], [(b.x + b.w) * 32, b.y * 32], [(b.x + b.w) * 32, (b.y + b.h) * 32], [b.x * 32, (b.y + b.h) * 32]].map(p => p.map(v => Math.round(v)));
  const labels = [];
  for (const b of A.blocks) {
    regions.push({ material: matOf(BC[b.kind]), poly: rect(b), dither: 0, wobble: 0, rim: { px: 1, shadow: 0, dark: 0.55 } });
    const pw = b.w * 32, ph = b.h * 32, maxc = Math.floor((pw - 4) / 8); if (maxc < 3 || ph < 14) continue;
    const words = fold(b.label).split(' '), lines = []; let cur = '';
    for (const w of words) { if ((cur ? cur + ' ' + w : w).length <= maxc) cur = cur ? cur + ' ' + w : w; else { if (cur) lines.push(cur); cur = w.slice(0, maxc); } } if (cur) lines.push(cur); if (!lines.length) continue;
    const nl = Math.max(1, Math.min(lines.length, 3, Math.floor((ph - 2) / 12))), cx = (b.x + b.w / 2) * 32, cy0 = (b.y + b.h / 2) * 32 - (nl - 1) * 6;
    for (let i = 0; i < nl; i++) labels.push({ text: lines[i], x: Math.round(cx), y: Math.round(cy0 + i * 12), scale: 2, color: b.kind === 'stairs' || b.kind === 'bridge' ? [40, 30, 20] : [255, 255, 255] });
  }
  for (const w of A.walls) for (let i = 0; i + 1 < w.pts.length; i++) { const [a, c] = [w.pts[i], w.pts[i + 1]].map(p => p.map(v => v * 32));
    const x0 = Math.min(a[0], c[0]) - 3, x1 = Math.max(a[0], c[0]) + 3, y0 = Math.min(a[1], c[1]) - 3, y1 = Math.max(a[1], c[1]) + 3;
    regions.push({ material: matOf(WALL_C), poly: [[x0, y0], [x1, y0], [x1, y1], [x0, y1]].map(p => p.map(Math.round)), dither: 0, wobble: 0 }); }
  // ---- spawn, cong
  const spawns = {}, spawnList = A.spawns.map((s, i) => ({ ...s, key: (i === 0 ? s.id : (s.id === 'default' ? 'chan-nui' : s.id)) }));
  for (const s of spawnList) spawns[s.key] = [Math.round(s.x * 32), Math.round(s.y * 32), DIR[s.dir] || 'up'];
  spawns.default = [...spawns[spawnList[0].key]];
  const portals = [], exits = [];
  for (const p of A.portals) {
    if (p.to === '-' ) { const d = spawns['chan-nui'] || spawns.default; exits.push({ rect: [Math.round(p.x * 32 - 48), PH - 28, 96, 28], title: 'Chân núi', text: 'Đường xuống chân núi đang được xây dựng.', to: { x: d[0], y: d[1], face: d[2] } }); continue; }
    const [ta, ts] = p.to.split(':'); const top = p.y < 2, bot = p.y > H - 2;
    const r = top ? [Math.round(p.x * 32 - 48), 0, 96, 20] : bot ? [Math.round(p.x * 32 - 48), PH - 20, 96, 20] : [Math.round(p.x * 32 - 48), Math.round(p.y * 32 - 10), 96, 20];
    portals.push({ id: p.id, rect: r, to: { area: ID[ta], spawn: ts }, label: p.label.replace(/^→\s*/, '') });
  }
  const src = {
    materials: 'tools/areas/blockout-materials.json',
    area: { id, name: META[A.id].name, sub: META[A.id].sub, backdrop: 'none', bg: '#1e1e22', spawns, portals, exits },
    bake: { width: PW, height: PH, seed: 1, regions, colRows: col.map(r => r.join('')), labels },
    blockout: { wallCells: wall.flatMap((r, cy) => r.map((v, cx) => v ? [cx, cy] : null).filter(Boolean)), source: 'design/tienson/blockout/tools/layout.json', area: A.id, cell: 32, blocks: A.blocks.map(b => ({ id: b.id, kind: b.kind, label: b.label, rect: [b.x * 32, b.y * 32, b.w * 32, b.h * 32] })) },
  };
  writeFileSync(`tools/areas/${id}.src.json`, JSON.stringify(src) + '\n');
  report.push(`${id}: ${W}x${H} o, ${regions.length} vung, ${labels.length} nhan, chan ${col.flat().reduce((a, b) => a + b, 0)}/${W * H} o (mep tang ${edge.flat().reduce((a, b) => a + b, 0)})`);
}
writeFileSync('tools/areas/blockout-materials.json', JSON.stringify({ source: 'public/assets/sect/ground_bake.png', ghi_chu: 'Chat lieu phang cho khu xam (blockout_to_src.mjs sinh ra, khong sua tay).', materials: mats }) + '\n');
console.log(report.join('\n'));
