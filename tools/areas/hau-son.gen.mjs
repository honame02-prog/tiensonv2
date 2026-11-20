// Sinh tools/areas/hau-son.src.json (Hau Son, rung truc 640x640). Tat dinh (seed co dinh): node tools/areas/hau-son.gen.mjs
// Sau do: node tools/area_bake.mjs tools/areas/hau-son.src.json
import { writeFileSync } from 'node:fs';
function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const R = rng(20251121), W = 640, H = 640, GATE_Y = 320;
const props = [], P = (key, x, y) => props.push({ key, x: Math.round(x), y: Math.round(y) });

// ---- duong da: net tu cong tay (30,320) vao khoang trong (tam ~ (380,306))
const WALK = [[30, 320], [100, 330], [170, 316], [240, 304], [300, 306], [350, 312]];
const dist2seg = (px, py, a, b) => { const dx = b[0] - a[0], dy = b[1] - a[1], l2 = dx * dx + dy * dy; let t = l2 ? ((px - a[0]) * dx + (py - a[1]) * dy) / l2 : 0; t = Math.max(0, Math.min(1, t)); return Math.hypot(px - a[0] - dx * t, py - a[1] - dy * t); };
const walkDist = (x, y) => Math.min(...WALK.slice(1).map((p, i) => dist2seg(x, y, WALK[i], p)));
const CLEAR = { cx: 380, cy: 308, rx: 92, ry: 72 };   // khoang trong ~ 160x120 (+ le)
const inClear = (x, y, pad = 0) => ((x - CLEAR.cx) / (CLEAR.rx + pad)) ** 2 + ((y - CLEAR.cy) / (CLEAR.ry + pad)) ** 2 < 1;
// da lat: cum 3 vien (47x35) moi ~27 px doc duong, lech nhe
{ let acc = 0, k = 0;
  for (let i = 1; i < WALK.length; i++) { const a = WALK[i - 1], b = WALK[i], L = Math.hypot(b[0] - a[0], b[1] - a[1]);
    for (let d = acc; d < L; d += 27) { const t = d / L, x = a[0] + (b[0] - a[0]) * t + (R() - 0.5) * 4, y = a[1] + (b[1] - a[1]) * t + 16 + (R() - 0.5) * 6; if (x > 8) P('bamboofloor:stone_path_' + (k++ % 4), x, y); acc = d + 27 - L; } } }
// khoang trong: vai vien da lat roi + 3 mossrock (kem bong) + 1 cum da lat
for (const [x, y] of [[318, 316], [352, 336], [392, 330], [428, 318]]) P('bamboofloor:stone_path_' + Math.floor(R() * 4), x, y);
for (const [n, x, y] of [[1, 316, 262], [0, 446, 344], [2, 414, 258]]) { P(`bamboofloor:mossrock_${n}`, x, y); P(`bamboofloor:mossrock_${n}_shadow`, x + 3, y + 1); }
// hang rao tre men nam duong (x 78..270, y 362) + coc
for (const x of [110, 174, 238]) P('bamboofloor:fence_bamboo_h_' + Math.floor(R() * 2), x, 362);
for (const x of [78, 142, 206, 270]) P('bamboofloor:fence_bamboo_post', x, 363);
// bamboo_clump men duong
for (const [n, x, y] of [[0, 66, 296], [1, 132, 284], [2, 200, 272], [0, 274, 336], [1, 258, 276], [2, 118, 392], [0, 322, 366]]) P('bamboo:bamboo_clump_' + n, x, y);

// ---- bao mep: vach bac (cliff_n y=64) + goc
for (let i = 0; i < 10; i++) P('cliff:cliff_n_' + (i % 4), 32 + 64 * i, 64);
P('cliff:cliff_nw', 20, 64); P('cliff:cliff_ne', 620, 64);
// rung tan (canopy chong lan + trunkrow) o 3 mep con lai; chua khe cong tay (y 292..348)
const CAN = [0, 1, 2, 3, 4, 5], pickC = () => 'forest:canopy_' + CAN[Math.floor(R() * 6)];
for (let y = 112; y <= 700; y += 52) {
  const yy = y + Math.round((R() - 0.5) * 10);
  const gap = yy > 292 && yy < 440;   // canopy cao ~87 -> khong che khe cong
  if (!gap) { P(pickC(), 4 + Math.round((R() - 0.5) * 10), yy); }
  if (yy <= 600 || yy > 610) { if (yy <= 640) P(pickC(), 636 + Math.round((R() - 0.5) * 8), yy); }
  if (!gap && yy < 640) P('forest:trunkrow_' + Math.floor(R() * 2), 40, yy + 28);
  if (yy < 640) P('forest:trunkrow_' + Math.floor(R() * 2), 602, yy + 28);
}
for (let x = 40; x <= 640; x += 66) { const jx = x + Math.round((R() - 0.5) * 14); P(pickC(), jx, 652 + Math.round((R() - 0.5) * 6)); P(pickC(), jx + 33, 626 + Math.round((R() - 0.5) * 6)); }
// khe cong tay: rung dong dac phia nam khe thay canopy bang bush
for (const [x, y] of [[20, 392], [36, 420], [14, 452]]) P('forest:bush_' + Math.floor(R() * 4), x, y);

// ---- rung truc: ~34 cum (2-3 than/cum), day o mep, thua dan vao trong, khong xep luoi, than cach >= 20 px
const stems = [], clusters = [];
const edgeD = (x, y) => Math.min(x, W - x, y - 64, H - y);
const blocked = (x, y) => walkDist(x, y) < 46 || inClear(x, y, 34) || (x < 120 && Math.abs(y - GATE_Y) < 54) || (y > 340 && y < 392 && x > 60 && x < 290) ||
  (Math.hypot(x - 46, y - GATE_Y) < 70);
const okStem = (x, y) => !blocked(x, y) && stems.every(s => Math.hypot(s.x - x, s.y - y) >= 20) && props.every(p => !/clump|mossrock_\d$/.test(p.key) || Math.hypot(p.x - x, p.y - y) >= 24);
for (let tries = 0; tries < 20000 && clusters.length < 34; tries++) {
  const x = 22 + R() * 596, y = 74 + R() * 540, d = edgeD(x, y), pr = d < 56 ? 1 : d < 130 ? 0.5 : 0.1;
  if (R() > pr) continue;
  if (clusters.some(c => Math.hypot(c.x - x, c.y - y) < (d < 56 ? 40 : 70))) continue;
  const n = d < 130 ? 3 : 2, mine = [];
  for (let k = 0; k < n * 6 && mine.length < n; k++) { const sx = x + (R() - 0.5) * 50, sy = y + (R() - 0.5) * 30; if (sx < 10 || sx > 630 || sy < 74 || sy > 632) continue;
    if (okStem(sx, sy) && mine.every(m => Math.hypot(m.x - sx, m.y - sy) >= 20)) mine.push({ x: sx, y: sy }); }
  if (!mine.length) continue;
  clusters.push({ x, y }); for (const m of mine) { stems.push(m); P('bamboo:bamboo_stem_' + Math.floor(R() * 6), m.x, m.y); }
}

// ---- nen + chat lieu
const src = {
  materials: 'tools/area_materials.json',
  area: { id: 'hau-son', name: 'Hậu Sơn', sub: 'Rừng trúc sau núi', backdrop: 'none', bg: '#16221a', atlases: ['cliff', 'forest', 'bamboo', 'bamboofloor'],
    spawns: { default: [46, GATE_Y, 'right'], west: [46, GATE_Y, 'right'] },
    portals: [{ id: 'to-son-dao', rect: [0, 292, 18, 56], to: { area: 'son-dao', spawn: 'east' }, label: 'Sơn Đạo' }],
    features: {}, texts: {} },
  bake: {
    width: W, height: H, seed: 31,
    paths: { walk: { pts: WALK.map(p => p), width: [46, 46, 44, 44, 44, 44] } },
    regions: [
      { material: 'leaflitter', fill: true },
      { material: 'forest', poly: [[0, 470], [120, 450], [210, 520], [250, 640], [0, 640]], smooth: true, dither: 8, wobble: 10, seed: 3 },
      { material: 'forest', poly: [[640, 80], [520, 90], [470, 140], [500, 220], [640, 250]], smooth: true, dither: 8, wobble: 10, seed: 4 },
      { material: 'grass', poly: [[440, 560], [560, 540], [640, 570], [640, 640], [420, 640]], smooth: true, dither: 8, wobble: 9, seed: 5 },
      { material: 'dirt', path: 'walk', dither: 3, wobble: 3, seed: 6 },
      { material: 'dirt', poly: [[300, 262], [390, 236], [468, 262], [478, 330], [420, 376], [340, 372], [296, 330]], smooth: true, dither: 6, wobble: 5, seed: 7 }
    ],
    blocks: [
      { poly: [[0, 0], [640, 0], [640, 64], [0, 64]] },
      { poly: [[0, 0], [56, 0], [56, 288], [0, 288]] }, { poly: [[0, 352], [56, 352], [56, 640], [0, 640]] },
      { poly: [[584, 0], [640, 0], [640, 640], [584, 640]] },
      { poly: [[0, 584], [640, 584], [640, 640], [0, 640]] }
    ],
    props,
    scatter: [
      { soft: true, keys: ['forest:bush_0', 'forest:bush_1', 'forest:bush_2', 'forest:bush_3'], count: 14, in: { rect: [60, 90, 520, 500] }, on: ['leaflitter', 'forest', 'grass'], avoidPaths: [{ path: 'walk', dist: 26 }], keepClear: [[380, 308, 100], [46, 320, 60]], minDist: 40, seed: 8 },
      { soft: true, keys: ['forest:tallgrass_0', 'forest:tallgrass_1', 'forest:tallgrass_2', 'forest:tallgrass_3'], count: 24, in: { rect: [60, 90, 520, 500] }, on: ['leaflitter', 'forest', 'grass'], avoidPaths: [{ path: 'walk', dist: 18 }], keepClear: [[380, 308, 80]], minDist: 26, seed: 9 },
      { kind: 'decal', keys: ['tuft1', 'tuft2', 'tuft3', 'tuft4', 'tuft5', 'tuft6'], count: 22, on: ['forest', 'grass'], minDist: 30, seed: 4 },
      { kind: 'decal', keys: ['ground1', 'ground2', 'ground3', 'ground4', 'ground5', 'ground6', 'ground7', 'ground8', 'ground9'], count: 10, on: ['dirt'], minDist: 36, seed: 6 }
    ]
  }
};
writeFileSync('tools/areas/hau-son.src.json', JSON.stringify(src, null, 1).replace(/\n\s+/g, m => m.length > 1 ? '\n ' : m) + '\n');
console.log(`hau-son.src.json: ${props.length} props, ${clusters.length} cum truc, ${stems.length} than truc`);
