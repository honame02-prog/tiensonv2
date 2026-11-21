// Bake nen + du lieu khu vuc, tai lap duoc (cung nguon + cung seed -> cung byte).
// node tools/area_bake.mjs tools/areas/<id>.src.json   ->  public/assets/areas/<id>/ground.png + area.json
// Cach dung va dinh dang: NOTES-AREA.md. Chat lieu = mau cat tu assets/sect/ground_bake.png (tools/area_materials.json).
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { createHash } from 'node:crypto';
import { decodePng, encodePng } from './png.mjs';
import { formatArea } from './area_common.mjs';

const srcFile = process.argv[2];
if (!srcFile) { console.error('Dung: node tools/area_bake.mjs tools/areas/<id>.src.json'); process.exit(2); }
const t0 = Date.now();
const src = JSON.parse(readFileSync(srcFile, 'utf8'));
const matDef = JSON.parse(readFileSync(src.materials || 'tools/area_materials.json', 'utf8'));
const B = src.bake, W = B.width, H = B.height, SEED = B.seed ?? 1;

// ---------------------------------------------------------------- tien ich ngau nhien (khong dung Math.random)
const hash = (x, y, s) => { let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(s | 0, 1274126177)) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16; return (h >>> 0) / 4294967296; };
const smooth = t => t * t * (3 - 2 * t);
const vnoise = (x, y, s) => { const xi = Math.floor(x), yi = Math.floor(y), fx = smooth(x - xi), fy = smooth(y - yi);
  const a = hash(xi, yi, s), b = hash(xi + 1, yi, s), c = hash(xi, yi + 1, s), d = hash(xi + 1, yi + 1, s); return (a + (b - a) * fx) + ((c + (d - c) * fx) - (a + (b - a) * fx)) * fy; };
function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

// ---------------------------------------------------------------- chat lieu
const srcImg = decodePng(matDef.source);
const lum = (r, g, b) => 0.299 * r + 0.587 * g + 0.114 * b;
function cutTile([x, y, w, h]) {
  const data = Buffer.alloc(w * h * 4);
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    const a = ((y + j) * srcImg.w + x + i) * 4; if (srcImg.data[a + 3] < 255) throw new Error(`mau chat lieu co pixel trong suot tai ${x + i},${y + j}`);
    srcImg.data.copy(data, (j * w + i) * 4, a, a + 4);
  }
  return { w, h, data };
}
const MATS = {}, MAT_NAMES = [];
function buildMaterial(name) {
  if (MATS[name]) return MATS[name];
  const d = matDef.materials[name]; if (!d) throw new Error('khong co chat lieu ' + name);
  let t;
  if (d.type === 'flat') t = { w: 1, h: 1, flat: d.color, data: Buffer.from([...d.color, 255]) };   // mau phang (khu xam / blockout)
  else if (d.type === 'tile') t = cutTile(d.rect);
  else if (d.type === 'shade') { const b = buildMaterial(d.base); t = { w: b.w, h: b.h, data: Buffer.from(b.data) }; for (let i = 0; i < t.w * t.h; i++) for (let c = 0; c < 3; c++) t.data[i * 4 + c] = Math.max(0, Math.min(255, Math.round(t.data[i * 4 + c] * d.mul[c]))); }
  else if (d.type === 'recolor') {   // giu do sang tuong doi cua nen `base`, doi sang bang mau lay tu cac vung `palette` (vd dat nau tu vung dat that)
    const b = buildMaterial(d.base), pal = [];
    for (const r of d.palette) { const c = cutTile(r); for (let i = 0; i < c.w * c.h; i++) { const r0 = c.data[i * 4], g0 = c.data[i * 4 + 1], b0 = c.data[i * 4 + 2]; pal.push([lum(r0, g0, b0), r0, g0, b0]); } }
    pal.sort((p, q) => p[0] - q[0]);
    const K = 8, ramp = []; for (let k = 0; k < K; k++) { const lo = Math.floor(k / K * pal.length), hi = Math.max(lo + 1, Math.floor((k + 1) / K * pal.length)); let s = [0, 0, 0]; for (let i = lo; i < hi; i++) for (let c = 0; c < 3; c++) s[c] += pal[i][c + 1]; ramp.push(s.map(v => v / (hi - lo))); }
    const ls = []; for (let i = 0; i < b.w * b.h; i++) ls.push(lum(b.data[i * 4], b.data[i * 4 + 1], b.data[i * 4 + 2])); const sorted = [...ls].sort((p, q) => p - q);
    t = { w: b.w, h: b.h, data: Buffer.alloc(b.w * b.h * 4) };
    for (let i = 0; i < b.w * b.h; i++) {
      let lo = 0, hi = sorted.length; while (lo < hi) { const m = (lo + hi) >> 1; if (sorted[m] < ls[i]) lo = m + 1; else hi = m; }
      const p = lo / sorted.length * (K - 1), k0 = Math.floor(p), k1 = Math.min(K - 1, k0 + 1), f = p - k0;
      for (let c = 0; c < 3; c++) t.data[i * 4 + c] = Math.round(ramp[k0][c] * (1 - f) + ramp[k1][c] * f); t.data[i * 4 + 3] = 255;
    }
  } else if (d.type === 'terrain') {   // bo o lat lien 128 px (public/assets/terrain): chon bien the theo hash(o, seed), wrap modulo, KHONG lat guong
    const tj = JSON.parse(readFileSync(d.src || 'public/assets/terrain/terrain.json', 'utf8')), files = tj.materials[d.set]; if (!files) throw new Error('terrain khong co bo ' + d.set);
    const T = tj.tile || 128, tiles = files.map(f => { const im = decodePng(`${dirname(d.src || 'public/assets/terrain/terrain.json')}/${f}`); if (im.w !== T || im.h !== T) throw new Error(`o ${f} khong phai ${T}x${T}`);
      for (let i = 0; i < T * T; i++) if (im.data[i * 4 + 3] < 255) throw new Error(`o ${f} co pixel trong suot`); return im.data; });
    t = { w: T, h: T, tiles, data: tiles[0] };
  } else throw new Error('type chat lieu la: ' + d.type);
  t.id = MAT_NAMES.length; MAT_NAMES.push(name); return (MATS[name] = t);
}
const mirror = (v, n) => { v = ((v % (2 * n)) + 2 * n) % (2 * n); return v < n ? v : 2 * n - 1 - v; };
// lay mau chat lieu tai (x,y): lat guong; tron 2 lop lech nhau theo nhieu thap tan (dither) de giau duong nen/doi xung
function matPix(m, x, y, out) {
  if (m.flat) { out[0] = m.flat[0]; out[1] = m.flat[1]; out[2] = m.flat[2]; return; }
  if (m.tiles) {   // terrain: o 128 px lien, bien the theo hash(o, seed), wrap modulo
    const T = m.w, tx = Math.floor(x / T), ty = Math.floor(y / T), a = (((y % T) + T) % T * T + ((x % T) + T) % T) * 4, td = m.tiles[Math.floor(hash(tx, ty, SEED * 31 + m.id * 7 + 11) * m.tiles.length)];
    out[0] = td[a]; out[1] = td[a + 1]; out[2] = td[a + 2]; return;
  }
  const n = vnoise(x / 56, y / 56, 77 + m.id) + (hash(x, y, 5 + m.id) - 0.5) * 0.2;
  const L = n > 0.5 ? 1 : 0, ox = L ? Math.floor(m.w * 0.43) : 0, oy = L ? Math.floor(m.h * 0.37) : 0;
  const a = (mirror(y + oy, m.h) * m.w + mirror(x + ox, m.w)) * 4;
  out[0] = m.data[a]; out[1] = m.data[a + 1]; out[2] = m.data[a + 2];
}

// ---------------------------------------------------------------- hinh hoc: duong cong, vung, khoang cach co dau
function catmull(pts, closed, step = 3, widths) {
  const n = pts.length, xs = [], ys = [], ws = [], P = i => closed ? pts[((i % n) + n) % n] : pts[Math.max(0, Math.min(n - 1, i))];
  const segs = closed ? n : n - 1;
  for (let i = 0; i < segs; i++) {
    const p0 = P(i - 1), p1 = P(i), p2 = P(i + 1), p3 = P(i + 2), len = Math.hypot(p2[0] - p1[0], p2[1] - p1[1]), k = Math.max(2, Math.ceil(len / step));
    for (let s = 0; s < k; s++) {
      const t = s / k, t2 = t * t, t3 = t2 * t, f = (a, b, c, d) => 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
      xs.push(f(p0[0], p1[0], p2[0], p3[0])); ys.push(f(p0[1], p1[1], p2[1], p3[1]));
      if (widths) ws.push((widths[i] * (1 - t) + widths[(i + 1) % widths.length] * t) / 2);
    }
  }
  const last = closed ? pts[0] : pts[n - 1]; xs.push(last[0]); ys.push(last[1]); if (widths) ws.push(widths[closed ? 0 : n - 1] / 2);
  return { xs, ys, ws };
}
function pathSd(c, scale = 1, wOverride) {   // khoang cach toi mep net duong (am = ben trong)
  const { xs, ys, ws } = c, n = xs.length;
  return (x, y) => {
    let best = 1e9;
    for (let i = 0; i < n - 1; i++) {
      const ax = xs[i], ay = ys[i], dx = xs[i + 1] - ax, dy = ys[i + 1] - ay, l2 = dx * dx + dy * dy;
      let t = l2 ? ((x - ax) * dx + (y - ay) * dy) / l2 : 0; t = t < 0 ? 0 : t > 1 ? 1 : t;
      const d = Math.hypot(x - ax - dx * t, y - ay - dy * t) - (wOverride != null ? wOverride / 2 : (ws[i] * (1 - t) + ws[i + 1] * t) * scale);
      if (d < best) best = d;
    }
    return best;
  };
}
function polySd(c) {
  const { xs, ys } = c, n = xs.length;
  return (x, y) => {
    let best = 1e18, inside = false;
    for (let i = 0, j = n - 1; i < n; j = i++) {
      const ax = xs[j], ay = ys[j], dx = xs[i] - ax, dy = ys[i] - ay, l2 = dx * dx + dy * dy;
      let t = l2 ? ((x - ax) * dx + (y - ay) * dy) / l2 : 0; t = t < 0 ? 0 : t > 1 ? 1 : t;
      const d2 = (x - ax - dx * t) ** 2 + (y - ay - dy * t) ** 2; if (d2 < best) best = d2;
      if ((ys[i] > y) !== (ys[j] > y) && x < (xs[j] - xs[i]) * (y - ys[i]) / (ys[j] - ys[i]) + xs[i]) inside = !inside;
    }
    return inside ? -Math.sqrt(best) : Math.sqrt(best);
  };
}
const inPoly = (poly, x, y) => polySd({ xs: poly.map(p => p[0]), ys: poly.map(p => p[1]) })(x, y) < 0;

const PATHS = {};
for (const [name, p] of Object.entries(B.paths || {})) { const c = catmull(p.pts, false, 3, p.width.length === p.pts.length ? p.width : p.pts.map(() => p.width[0])); PATHS[name] = { c, sd: pathSd(c) }; }
function regionSd(r) {
  if (r.fill) return () => -1e6;
  if (r.path) { const P = PATHS[r.path]; if (!P) throw new Error('khong co path ' + r.path); return r.width != null ? pathSd(P.c, 1, r.width) : (r.widthMul ? pathSd(P.c, r.widthMul) : P.sd); }
  if (r.poly) return polySd(r.smooth ? catmull(r.poly, true, 3) : { xs: r.poly.map(p => p[0]), ys: r.poly.map(p => p[1]) });
  throw new Error('vung can fill / path / poly');
}

// ---------------------------------------------------------------- to nen
const img = Buffer.alloc(W * H * 4, 0), matMap = new Uint8Array(W * H).fill(255);
const px = [0, 0, 0];
let ri = 0;
for (const r of B.regions) {
  ri++; const m = buildMaterial(r.material);
  if (r.cells) {   // to theo o luoi 32 px: [[cy,cx0,cx1],...] (khu xam: khop dung voi luoi va cham)
    for (const [cy, c0, c1] of r.cells) for (let y = cy * 32; y < Math.min(H, cy * 32 + 32); y++) for (let x = c0 * 32; x < Math.min(W, (c1 + 1) * 32); x++) { matPix(m, x, y, px); const o = (y * W + x) * 4; img[o] = px[0]; img[o + 1] = px[1]; img[o + 2] = px[2]; img[o + 3] = 255; matMap[y * W + x] = m.id; }
    continue;
  }
  const sd = regionSd(r), wob = r.wobble ?? 3, dith = r.dither ?? 3, rim = r.rim, seed = r.seed ?? ri * 31 + SEED;
  const pad = wob + dith + (rim ? (rim.px || 1) + (rim.shadow || 0) + 1 : 1);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    let d = sd(x + 0.5, y + 0.5); if (d > pad + 2) continue;
    const wv = (vnoise(x / 22, y / 22, seed) - 0.5) * 2 * wob;
    d += wv;
    const o = (y * W + x) * 4;
    if (d + (hash(x, y, seed) - 0.5) * 2 * dith < 0) { matPix(m, x, y, px); img[o] = px[0]; img[o + 1] = px[1]; img[o + 2] = px[2]; img[o + 3] = 255; matMap[y * W + x] = m.id; }
    else if (rim && img[o + 3] === 255 && d >= 0) {
      // vien toi 1 px quanh mep + bong 'shadow' px phia duoi (mep tren cua vung chiu bong de len phan sau no)
      const ds = sd(x + 0.5, y + 0.5 - (rim.shadow || 0)) + wv;
      if (d < (rim.px || 1) || (rim.shadow && ds < 0)) for (let c = 0; c < 3; c++) img[o + c] = Math.round(img[o + c] * (rim.dark ?? 0.6));
    }
  }
}

// ---------------------------------------------------------------- nhan chu (khu xam): font 3x5 phong x scale, chi A-Z 0-9 . - /
const G = { A:[2,5,7,5,5],B:[6,5,6,5,6],C:[3,4,4,4,3],D:[6,5,5,5,6],E:[7,4,6,4,7],F:[7,4,6,4,4],G:[3,4,5,5,3],H:[5,5,7,5,5],I:[7,2,2,2,7],J:[1,1,1,5,2],K:[5,5,6,5,5],L:[4,4,4,4,7],M:[5,7,7,5,5],N:[7,5,5,5,5],O:[2,5,5,5,2],P:[6,5,6,4,4],Q:[2,5,5,7,3],R:[6,5,6,5,5],S:[3,4,2,1,6],T:[7,2,2,2,2],U:[5,5,5,5,7],V:[5,5,5,5,2],W:[5,5,7,7,5],X:[5,5,2,5,5],Y:[5,5,2,2,2],Z:[7,1,2,4,7],
  0:[7,5,5,5,7],1:[2,6,2,2,7],2:[6,1,2,4,7],3:[6,1,2,1,6],4:[5,5,7,1,1],5:[7,4,6,1,6],6:[3,4,7,5,7],7:[7,1,2,2,2],8:[7,5,7,5,7],9:[7,5,7,1,6],'-':[0,0,7,0,0],'.':[0,0,0,0,2],'/':[1,1,2,4,4] };
function drawText(text, cx, cy, sc, col) {   // can giua tai (cx,cy); bong den 1 px
  const adv = 4 * sc, w = text.length * adv - sc, x0 = Math.round(cx - w / 2), y0 = Math.round(cy - 5 * sc / 2);
  const put = (x, y, c) => { if (x < 0 || y < 0 || x >= W || y >= H) return; const o = (y * W + x) * 4; img[o] = c[0]; img[o + 1] = c[1]; img[o + 2] = c[2]; };
  for (const pass of [0, 1]) for (let i = 0; i < text.length; i++) { const g = G[text[i]]; if (!g) continue;
    for (let r = 0; r < 5; r++) for (let b = 0; b < 3; b++) if (g[r] & (4 >> b)) for (let dy = 0; dy < sc; dy++) for (let dx = 0; dx < sc; dx++) put(x0 + i * adv + b * sc + dx + (pass ? 0 : 1), y0 + r * sc + dy + (pass ? 0 : 1), pass ? col : [20, 14, 12]); }
}
for (const L of B.labels || []) drawText(L.text, L.x, L.y, L.scale || 2, L.color || [255, 255, 255]);
for (let i = 0; i < W * H; i++) if (img[i * 4 + 3] !== 255) throw new Error('nen con pixel trong: vung dau tien phai la "fill"');

// ---------------------------------------------------------------- va cham (luoi 32 px) tu cac da giac chan
const cols = Math.ceil(W / 32), rows = Math.ceil(H / 32);
const col = Array.from({ length: rows }, () => Array(cols).fill(0));
if (B.colRows) B.colRows.forEach((r, cy) => { for (let cx = 0; cx < cols; cx++) col[cy][cx] = r[cx] === '1' ? 1 : 0; });   // va cham cho san (chuoi '0/1' moi hang), thay cho blocks
for (const blk of B.blocks || []) {
  const c = blk.smooth ? catmull(blk.poly, true, 4) : { xs: blk.poly.map(p => p[0]), ys: blk.poly.map(p => p[1]) }, sd = polySd(c);
  for (let cy = 0; cy < rows; cy++) for (let cx = 0; cx < cols; cx++) {
    let n = 0; for (let j = 0; j < 3; j++) for (let i = 0; i < 3; i++) if (sd(cx * 32 + 5 + i * 11, cy * 32 + 5 + j * 11) < 0) n++;
    if (n >= 5) col[cy][cx] = 1;
  }
}

// ---------------------------------------------------------------- props + decal: danh sach + rai theo chat lieu (seed co dinh)
const props = (B.props || []).map(p => ({ key: p.key, x: p.x, y: p.y })), objs = (B.objs || []).map(o => ({ name: o.name, x: o.x, y: o.y }));
const placed = props.map(p => ({ x: p.x, y: p.y, r: 14 }));
for (const s of B.scatter || []) {
  const R = rng((s.seed ?? 1) * 7919 + SEED), area = s.in?.rect || [0, 0, W, H], want = s.count, minD = s.minDist ?? 24, avoidSd = (s.avoidPaths || []).map(a => [PATHS[a.path].sd, a.dist]);
  const on = (s.on || []).map(n => MATS[n]?.id ?? buildMaterial(n).id); let got = 0;
  for (let tries = 0; tries < want * 400 && got < want; tries++) {
    const x = Math.round(area[0] + R() * area[2]), y = Math.round(area[1] + R() * area[3]);
    if (x < 4 || y < 4 || x >= W - 4 || y >= H - 4) continue;
    if (on.length && !on.includes(matMap[y * W + x])) continue;
    if (s.in?.poly && !inPoly(s.in.poly, x, y)) continue;
    if ((s.keepClear || []).some(([cx, cy, rr]) => Math.hypot(x - cx, y - cy) < rr)) continue;
    if (avoidSd.some(([f, dist]) => f(x, y) < dist)) continue;
    if (placed.some(q => Math.hypot(x - q.x, y - q.y) < (s.soft ? minD : Math.max(minD, q.r)))) continue;   // soft: do vat nho, chi tranh tam vat khac trong minDist cua chinh no
    const key = s.keys[Math.floor(R() * s.keys.length)];
    if (s.kind === 'decal') objs.push({ name: key, x, y }); else props.push({ key, x, y });
    placed.push({ x, y, r: s.kind === 'decal' ? minD * 0.6 : s.soft ? 0 : minD }); got++;
  }
  if (got < want) console.warn(`  canh bao: scatter ${s.keys.join('/')} chi dat ${got}/${want}`);
}
props.sort((a, b) => a.y - b.y); objs.sort((a, b) => a.y - b.y);

// ---------------------------------------------------------------- ghi
const A = src.area, outDir = `public/assets/areas/${A.id}`;
mkdirSync(outDir, { recursive: true });
const png = encodePng({ w: W, h: H, data: img }, `${outDir}/ground.png`);
const area = { ...A, ground: `assets/areas/${A.id}/ground.png`, width: W, height: H, baked: true, walls: [], stairs: [], col, objs, props };
const order = ['id', 'name', 'sub', 'ground', 'backdrop', 'bg', 'atlases', 'width', 'height', 'baked', 'spawns', 'portals', 'features', 'exits', 'texts', 'walls', 'stairs', 'col', 'objs', 'props'];
const ordered = {}; for (const k of order) if (area[k] !== undefined) ordered[k] = area[k]; for (const k of Object.keys(area)) if (!(k in ordered)) ordered[k] = area[k];
const json = formatArea(ordered); writeFileSync(`${outDir}/area.json`, json);
const md5 = s => createHash('md5').update(s).digest('hex').slice(0, 12);
const cnt = {}; for (const p of props) cnt[p.key] = (cnt[p.key] || 0) + 1;
console.log(`bake ${A.id}: ${W}x${H}, ${B.regions.length} vung, ${props.length} props ${JSON.stringify(cnt)}, ${objs.length} decal, ${col.flat().filter(Boolean).length}/${cols * rows} o chan, ${Date.now() - t0} ms`);
console.log(`  ground.png md5=${md5(png)}  area.json md5=${md5(json)}`);
