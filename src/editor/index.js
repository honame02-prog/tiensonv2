// Area Editor (chi dev, nap dong tu AreaScene khi ?edit=1; xem docs/editor/THIET-KE.md 2, 5b). Cong cu chi ghi qua POST /__areaed/save (plugin vite areaEditor).
// Trang thai (module-level S) song qua scene.restart: Choi thu / them kit moi deu restart scene voi pieces+kits tu bo nho (AreaScene.init data.edit).
import { Model, piecesKey } from './model.js';
import { createPanel } from './panel.js';
import { tierAt, depthOf, CELL } from '../areaLayers.js';
import { kitCacheKey, kitTextureKey, kitPieceUrl } from '../areaKits.js';

const LS = (k, v) => { try { if (v === undefined) return JSON.parse(localStorage.getItem(k)); if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* bo qua: localStorage tat/day */ } return null; };
const DEFAULT_LAYERS = { grid: false, col: false, tier: false, collide: true, anchor: false, frame: false, portals: true, spawns: true, steps: true, exits: true };
const TIER_COLORS = [0x4caf50, 0x2196f3, 0xff9800, 0xe91e63, 0x9c27b0, 0x00bcd4];
const ZOOMS = [0.25, 0.5, 1, 2, 3, 4, 5, 6], MIN_ZOOM = 0.1, MAX_ZOOM = 6, DRAG_PX = 3, GUIDE_TOL = 2;   // thu nho 0.25/0.5 (xem ca khu), phong to nguyen 1-6; guide hien khi lech <= 2 px
let S = null;   // trang thai editor cua khu hien tai
let boot = null;   // Promise khoi tao (doc src, thu vien, ban nhap) cua khu hien tai

const clone = a => a.map(p => ({ ...p }));
const kitOf = k => k.slice(0, k.indexOf('/')), nameOf = k => k.slice(k.indexOf('/') + 1);
const inField = e => /^(INPUT|TEXTAREA|SELECT)$/.test(e.target?.tagName || '') && e.target.type !== 'checkbox' && e.target.type !== 'range';

// ---------- tra cuu kit/piece
function kitData(kit) { return S.scene.cache.json.get(kitCacheKey(S.id, kit)) || S.lib?.[kit] || null; }
function pieceInfo(k) { return kitData(kitOf(k))?.pieces?.[nameOf(k)] || null; }
function pieceSize(k) {
  const key = kitTextureKey(S.id, kitOf(k), nameOf(k));
  if (S.scene.textures.exists(key)) { const f = S.scene.textures.get(key).getSourceImage(); return [f.width, f.height]; }
  const p = pieceInfo(k); return p?.w ? [p.w, p.h] : [0, 0];
}

// ---------- toa do (man hinh <-> the gioi), camera tu do
function rectOf() { return S.scene.game.canvas.getBoundingClientRect(); }
function s2w(cx, cy) {
  const c = S.scene.cameras.main, r = rectOf(), gx = (cx - r.left) * c.width / r.width, gy = (cy - r.top) * c.height / r.height, z = c.zoom;
  return { x: (gx - c.width / 2) / z + c.width / 2 + c.scrollX, y: (gy - c.height / 2) / z + c.height / 2 + c.scrollY };
}
function camCenter() { const c = S.scene.cameras.main; return { x: c.scrollX + c.width / 2, y: c.scrollY + c.height / 2 }; }
function setCam(zoom, cx, cy) {   // dat zoom (0.25..6; so le chi khi 'vua khung') va tam camera (gioi han trong khu)
  const c = S.scene.cameras.main, m = S.model;
  c.setZoom(Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoom)));
  c.scrollX = Math.round(Math.max(0, Math.min(m.W, cx)) - c.width / 2); c.scrollY = Math.round(Math.max(0, Math.min(m.H, cy)) - c.height / 2);
  S.cam = { zoom: c.zoom, x: camCenter().x, y: camCenter().y }; S.panel?.refresh();
}
function zoomAt(dir, cx, cy) {   // dir > 0: len muc ke tiep trong ZOOMS; < 0: xuong muc ke duoi
  const c = S.scene.cameras.main, before = s2w(cx, cy), nz = dir > 0 ? ZOOMS.find(z => z > c.zoom + 1e-6) : [...ZOOMS].reverse().find(z => z < c.zoom - 1e-6);
  if (!nz) return;
  c.setZoom(nz); const after = s2w(cx, cy);
  c.scrollX = Math.round(c.scrollX + before.x - after.x); c.scrollY = Math.round(c.scrollY + before.y - after.y);
  S.cam = { zoom: nz, ...camCenter() }; S.panel?.refresh();
}
// phim 0: thu nho vua khung ca khu (zoom le = min(rong/W, cao/H)), tam o giua khu
function fitArea() { const c = S.scene.cameras.main, m = S.model; setCam(Math.min(c.width / m.W, c.height / m.H), m.W / 2, m.H / 2); }
function focusSel() {
  const idx = S.model.sel; if (!idx.length) return;
  const b = selBounds(idx); setCam(S.scene.cameras.main.zoom, b.x + b.w / 2, b.y + b.h / 2);
}

// ---------- nhom anh theo placement
function buildGroups() {
  const g = new Map(), m = S.model;
  for (const im of S.scene.kitImages) {
    if (!im.active) continue;
    const i = im.getData('placement'); if (i == null || i < 0) continue;
    if (!g.has(i)) g.set(i, { imgs: [], x: m.pieces[i]?.x, y: m.pieces[i]?.y });
    g.get(i).imgs.push(im);
  }
  S.groups = g; applyVisibility();
}
const mainImg = i => { const g = S.groups.get(i), k = S.model.pieces[i]?.k; return g && (g.imgs.find(im => im.getData('kitPiece') === k) || g.imgs[0]); };
function boundsOf(i) {
  const g = S.groups.get(i); if (!g || !g.imgs.length) { const p = S.model.pieces[i]; return { x: p.x - 8, y: p.y - 16, w: 16, h: 16 }; }
  let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
  for (const im of g.imgs) { x0 = Math.min(x0, im.x); y0 = Math.min(y0, im.y); x1 = Math.max(x1, im.x + im.width); y1 = Math.max(y1, im.y + im.height); }
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}
function selBounds(idx) {
  let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
  for (const i of idx) { const b = boundsOf(i); x0 = Math.min(x0, b.x); y0 = Math.min(y0, b.y); x1 = Math.max(x1, b.x + b.w); y1 = Math.max(y1, b.y + b.h); }
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}
function applyVisibility() {
  if (!S.groups) return;
  for (const [i, g] of S.groups) { const vis = !S.hidden.has(kitOf(S.model.pieces[i]?.k || '/')); for (const im of g.imgs) im.setVisible(vis); }
}
// xem truoc khi keo: dich anh cua nhom + tinh lai depth bang depthOf va tier tai chan (chua cap nhat collider/mai/den)
function syncPositions() {
  const meta = S.scene.meta, m = S.model;
  for (const [i, g] of S.groups) {
    const p = m.pieces[i]; if (!p || (p.x === g.x && p.y === g.y)) continue;
    const dx = p.x - g.x, dy = p.y - g.y;
    for (const im of g.imgs) {
      im.x += dx; im.y += dy;
      const layer = pieceInfo(im.getData('kitPiece'))?.layer;
      if (layer && layer !== 'ground' && layer !== 'roof') im.setDepth(depthOf(p.y, tierAt(meta, p.x, p.y)));
    }
    g.x = p.x; g.y = p.y;
  }
}
function rebuild() {
  S.scene.meta.pieces = clone(S.model.pieces);
  S.scene.rebuildKitImages(); buildGroups();
}
const missingKits = () => { const have = S.scene.meta.kits || {}; return [...new Set(S.model.pieces.map(p => kitOf(p.k)))].filter(k => !(k in have)); };

// ---------- chon theo pixel that (bo qua vung trong suot cua anh)
function opaqueAt(im, wx, wy) {
  const lx = Math.floor(wx - im.x), ly = Math.floor(wy - im.y);
  if (lx < 0 || ly < 0 || lx >= im.width || ly >= im.height) return false;
  const key = im.texture.key; let m = S.alpha.get(key);
  if (!m) {
    try {
      const src = im.texture.getSourceImage(), cv = document.createElement('canvas'); cv.width = src.width; cv.height = src.height;
      const cx = cv.getContext('2d', { willReadFrequently: true }); cx.drawImage(src, 0, 0);
      m = { w: src.width, d: cx.getImageData(0, 0, src.width, src.height).data };
    } catch (e) { m = { w: 0, d: null }; }
    S.alpha.set(key, m);
  }
  return !m.d || m.d[(ly * m.w + lx) * 4 + 3] > 16;
}
// cac placement co anh dac tai diem, xep theo depth cua ANH THUC SU TRUNG con tro (mai depth H+1 che cay thi chon mai), khong theo anh than
function hitsAt(wx, wy) {
  const hits = [];
  for (const [i, g] of S.groups) {
    const kit = kitOf(S.model.pieces[i].k); if (S.hidden.has(kit) || S.locked.has(kit)) continue;
    let d = -Infinity; for (const im of g.imgs) if (im.depth > d && opaqueAt(im, wx, wy)) d = im.depth;
    if (d > -Infinity) hits.push({ i, d });
  }
  return hits.sort((a, b) => b.d - a.d || b.i - a.i);
}
function pickAt(wx, wy, alt) {
  const hits = hitsAt(wx, wy).map(h => h.i);
  if (!hits.length) return -1;
  if (alt) { const cur = S.model.sel.length === 1 ? hits.indexOf(S.model.sel[0]) : -1; return hits[(cur + 1) % hits.length]; }
  return hits[0];
}

// ---------- ve lop phu (Graphics o depth 9700, ve lai moi khung, chi o ngoai thuc vung nhin)
function draw() {
  const sc = S.scene, g = S.gfx, c = sc.cameras.main, m = S.model, meta = sc.meta, L = S.layers, z = c.zoom, lw = 1 / z;
  if (!g || !g.active) return;
  g.clear(); const n = S.stats = { grid: 0, col: 0, tier: 0, collide: 0, anchor: 0, frame: 0, portals: 0, spawns: 0, steps: 0, exits: 0 };   // so doi tuong da ve moi lop (test dung)
  const v = c.worldView, x0 = Math.floor(v.x / CELL) - 1, x1 = Math.ceil(v.right / CELL) + 1, y0 = Math.floor(v.y / CELL) - 1, y1 = Math.ceil(v.bottom / CELL) + 1;
  const cells = (rows, fn) => { if (rows) for (let cy = Math.max(0, y0); cy <= y1 && cy < rows.length; cy++) { const r = rows[cy]; for (let cx = Math.max(0, x0); cx <= x1 && cx < r.length; cx++) fn(cx, cy, r[cx]); } };
  if (L.tier) cells(meta.tierRows, (cx, cy, ch) => { if (ch !== '.') { n.tier++; g.fillStyle(TIER_COLORS[+ch % TIER_COLORS.length], 0.22); g.fillRect(cx * CELL, cy * CELL, CELL, CELL); } });
  if (L.col) cells(meta.col, (cx, cy, v2) => { if (v2) { n.col++; g.fillStyle(0xe53935, 0.3); g.fillRect(cx * CELL, cy * CELL, CELL, CELL); } });
  if (L.grid) {
    g.lineStyle(lw, 0xffffff, 0.22); n.grid = 1;
    for (let cx = Math.max(0, x0); cx <= Math.min(x1, m.W / CELL); cx++) g.lineBetween(cx * CELL, Math.max(0, y0 * CELL), cx * CELL, Math.min(m.H, y1 * CELL));
    for (let cy = Math.max(0, y0); cy <= Math.min(y1, m.H / CELL); cy++) g.lineBetween(Math.max(0, x0 * CELL), cy * CELL, Math.min(m.W, x1 * CELL), cy * CELL);
  }
  const box = (r, color, a, key) => { n[key]++; g.lineStyle(lw * 2, color, a); g.strokeRect(r[0], r[1], r[2], r[3]); g.fillStyle(color, 0.12); g.fillRect(r[0], r[1], r[2], r[3]); };
  if (L.portals) for (const q of meta.portals || []) box(q.rect, 0x66bb6a, 0.95, 'portals');
  if (L.exits) for (const q of meta.exits || []) box(q.rect, 0xffa726, 0.95, 'exits');
  if (L.steps) for (const q of meta.steps || []) box(q.rect, 0x42a5f5, 0.95, 'steps');
  if (L.spawns) for (const [name, s] of Object.entries(meta.spawns || {})) {
    n.spawns++; g.lineStyle(lw * 2, 0xffee58, 1); g.strokeCircle(s[0], s[1], 6); g.lineBetween(s[0] - 9, s[1], s[0] + 9, s[1]); g.lineBetween(s[0], s[1] - 9, s[0], s[1] + 9);
  }
  if (L.collide) for (let i = 0; i < m.pieces.length; i++) {
    const p = m.pieces[i], info = pieceInfo(p.k); if (!info?.collide?.length || S.hidden.has(kitOf(p.k))) continue;
    g.lineStyle(lw, 0xff5252, 0.95); g.fillStyle(0xff5252, 0.18);
    for (const [rx, ry, rw, rh] of info.collide) { n.collide++; g.fillRect(p.x + rx, p.y + ry, rw, rh); g.strokeRect(p.x + rx, p.y + ry, rw, rh); }
  }
  if (L.frame) { g.lineStyle(lw, 0x80deea, 0.7); for (const [, grp] of S.groups) for (const im of grp.imgs) if (im.visible) { n.frame++; g.strokeRect(im.x, im.y, im.width, im.height); } }
  if (L.anchor) for (const p of m.pieces) { n.anchor++; g.lineStyle(lw, 0xffffff, 0.9); g.lineBetween(p.x - 3, p.y, p.x + 3, p.y); g.lineBetween(p.x, p.y - 3, p.x, p.y + 3); }
  // chon
  for (const i of m.sel) {
    if (!m.pieces[i]) continue; const b = boundsOf(i), p = m.pieces[i];
    g.lineStyle(lw * 2, 0xffd54f, 1); g.strokeRect(b.x, b.y, b.w, b.h);
    g.lineStyle(lw * 2, 0xffd54f, 1); g.lineBetween(p.x - 5, p.y, p.x + 5, p.y); g.lineBetween(p.x, p.y - 5, p.x, p.y + 5);
  }
  for (const gd of S.guides) { g.lineStyle(lw, 0xff4081, 0.95); g.lineBetween(gd.l[0], gd.l[1], gd.l[2], gd.l[3]); }
  if (S.marquee) { const r = S.marquee; g.lineStyle(lw, 0xffffff, 0.9); g.strokeRect(r.x, r.y, r.w, r.h); g.fillStyle(0xffffff, 0.08); g.fillRect(r.x, r.y, r.w, r.h); }
  if (S.armed && S.mouse) { g.lineStyle(lw, 0x69f0ae, 1); g.strokeCircle(S.mouse.x, S.mouse.y, 4); }
}

// ---------- duong can chan (guide): chan thang hang voi placement khac (cung y hoac cung x)
function computeGuides() {
  const out = [], m = S.model, sel = new Set(m.sel);
  for (const i of m.sel) {
    const p = m.pieces[i];
    for (let j = 0; j < m.pieces.length; j++) {
      if (sel.has(j)) continue; const q = m.pieces[j];
      if (Math.abs(q.y - p.y) <= GUIDE_TOL) out.push({ ref: j, axis: 'y', l: [Math.min(p.x, q.x) - 8, q.y, Math.max(p.x, q.x) + 8, q.y] });   // chan lech <= 2 px: ve duong tai y cua muc tham chieu
      if (Math.abs(q.x - p.x) <= GUIDE_TOL) out.push({ ref: j, axis: 'x', l: [q.x, Math.min(p.y, q.y) - 8, q.x, Math.max(p.y, q.y) + 8] });
    }
  }
  S.guides = out.slice(0, 40);
}

// ---------- thao tac cap cao (UI + API dung chung)
const A = {
  addPiece(k, x, y) {
    const kit = kitOf(k), m = S.model;
    if (!m.kits[kit]) { const url = S.lib?.[kit]?.url; if (!url) throw new Error('kit khong co trong thu vien: ' + kit); m.kits[kit] = url; }
    return m.add(k, x, y);
  },
  async save() {
    if (S.op?.kind === 'baking') return { ok: false, code: 'busy', error: 'dang bake' };
    if (!S.baseHash) { S.op = { kind: 'error', msg: 'khong co may chu luu (plugin areaEditor)' }; S.panel.refresh(); return { ok: false, code: 'noserver', error: S.op.msg }; }
    S.op = { kind: 'baking' }; S.panel.refresh();
    const st0 = S, m = S.model, key = m.key(), oldDraft = draftKey();   // st0: phien (khu) luc bat dau luu; phan hoi tra ve sau khi da chuyen khu bi bo
    const sid = st0.id;
    let r;
    try {
      const res = await fetch('/__areaed/save', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: S.id, baseHash: S.baseHash, pieces: m.pieces, kits: m.usedKits() }) });
      r = await res.json();
    } catch (e) { r = { ok: false, code: 'io', error: String(e.message || e) }; }
    if (S !== st0) { if (r.ok) LS(oldDraft, null); return r; }   // da sang khu khac / editor moi: khong cham vao trang thai khu moi
    if (r.ok) {
      S.baseHash = r.hash; m.savedKey = key; S.op = { kind: 'saved', ms: r.ms }; LS(oldDraft, null);
      if (m.key() !== key) saveDraft();
    } else S.op = { kind: 'error', code: r.code, msg: r.error || r.code };
    S.panel.refresh(); return r;
  },
  applyDraft() { const d = S.draft; if (!d) return; S.draft = null; S.model.reset(d.pieces, d.kits); S.panel.refresh(); },
  discardDraft() { LS(draftKey(), null); S.draft = null; S.panel.refresh(); },
  async listBackups() {
    try { const r = await (await fetch('/__areaed/backups?id=' + encodeURIComponent(S.id))).json(); return r.ok === false ? { list: [], error: r.error } : { list: r.list || [] }; } catch (e) { return { list: [], error: String(e.message || e) }; }
  },
  async restore(name) {
    const st0 = S; let r; try { r = await (await fetch('/__areaed/restore', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: S.id, name, baseHash: S.baseHash }) })).json(); } catch (e) { r = { ok: false, error: String(e.message || e) }; }
    if (!r.ok && r.code === 'conflict' && S === st0) { S.op = { kind: 'error', code: 'conflict', msg: r.error || 'conflict' }; S.panel.refresh(); }
    if (r.ok) { window.removeEventListener('beforeunload', beforeUnload); location.reload(); }   // nap lai canh tu dia (khong hoi 'chua luu')
    return r;
  },
  async check() {
    S.panel.showLog('Dang kiem tra (blockout_reach)...');
    let r; try { r = await (await fetch('/__areaed/check', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: S.id }) })).json(); } catch (e) { r = { ok: false, error: String(e) }; }
    S.panel.showLog((r.ok ? 'DAT' : 'LOI') + ' (exit ' + r.exit + ')\n' + (r.stdout || '') + (r.stderr || '') + (r.error || '')); return r;
  },
  undo() { return S.model.undo(); }, redo() { return S.model.redo(); },
  remove() { return S.model.remove(); },
  duplicate() { return S.model.duplicate(); },
  copy() { S.clip = S.model.sel.map(i => ({ ...S.model.pieces[i] })); },
  paste() { if (S.clip?.length) S.model.paste(S.clip, S.mouse ? S.mouse.x : S.clip[0].x + 8, S.mouse ? S.mouse.y : S.clip[0].y + 8); },
  selectAll() { S.model.setSel(S.model.pieces.map((_, i) => i).filter(i => !S.hidden.has(kitOf(S.model.pieces[i].k)) && !S.locked.has(kitOf(S.model.pieces[i].k)))); },
  focus: focusSel,
  // doi k cua muc chon sang manh khac (kit phai co trong thu vien hoac khu); tra ve false neu khong co
  setK(k) { const kit = kitOf(k), info = S.lib?.[kit]?.pieces?.[nameOf(k)]; if (!info || !S.model.sel.length) return false; if (!S.model.kits[kit]) S.model.kits[kit] = S.lib[kit].url; S.model.setK(S.model.sel, k); return true; },
  setLayer(name, on) { S.layers[name] = on; persistUi(); },
  setKitFlag(kit, flag, on) { const s = flag === 'hidden' ? S.hidden : S.locked; on ? s.add(kit) : s.delete(kit); if (flag === 'hidden' && on) S.model.setSel(S.model.sel.filter(i => kitOf(S.model.pieces[i].k) !== kit)); persistUi(); applyVisibility(); S.panel.refresh(); },
  pieceInfo, pieceSize, kitOf, nameOf,
  togglePlay() { return S.mode === 'play' ? exitPlay() : enterPlay(); },
  tierAtFoot(p) { return tierAt(S.scene.meta, p.x, p.y); },
  depthAt(i) { return mainImg(i)?.depth; },
  concept: null,
};

// ---------- ban nhap (localStorage theo id + baseHash)
const draftKey = () => `areaed:draft:${S.id}:${S.baseHash}`;
function saveDraft() {
  clearTimeout(S.draftT);
  S.draftT = setTimeout(() => { if (!S || S.draft) return; if (S.model.dirty) LS(draftKey(), { pieces: S.model.pieces, kits: S.model.usedKits(), t: Date.now() }); else LS(draftKey(), null); }, 300);
}
function persistUi() { LS('areaed:ui', { layers: S.layers }); LS('areaed:kitflags:' + S.id, { hidden: [...S.hidden], locked: [...S.locked] }); }

// ---------- restart scene voi du lieu trong bo nho
function sceneData(extra) { return { area: S.id, edit: { pieces: clone(S.model.pieces), kits: { ...S.model.kits }, ...extra } }; }
function reload(extra) {
  const prev = S.resolveAttach; S.attachP = new Promise(res => { S.resolveAttach = () => { prev?.(); res(); }; });
  S.scene.scene.restart(sceneData(extra)); return S.attachP;
}
function enterPlay() {
  const at = camCenter(); S.cam = { zoom: S.scene.cameras.main.zoom, ...at }; S.mode = 'play';
  return reload({ play: true, at: { x: Math.round(at.x), y: Math.round(at.y) } });
}
function exitPlay() { S.mode = 'edit'; return reload(); }

// ---------- chuot/ban phim tren canvas (che do Sua)
function onDown(e) {
  if (S.mode !== 'edit') return;
  const canvas = e.currentTarget, m = S.model, w = s2w(e.clientX, e.clientY);
  S.mouse = w; canvas.setPointerCapture?.(e.pointerId);
  if (e.button === 1 || (e.button === 0 && S.space)) { S.drag = { type: 'pan', cx: e.clientX, cy: e.clientY }; e.preventDefault(); return; }
  if (e.button === 0 && S.keyC && S.conceptKey && !S.concept.locked) { S.drag = { type: 'concept', w0: w, c0: { x: S.concept.x, y: S.concept.y } }; return; }   // giu C + keo: dich concept
  if (e.button === 2) { S.drag = { type: 'marquee', w0: w, add: e.shiftKey, base: [...m.sel] }; return; }
  if (e.button !== 0) return;
  if (S.armed) { const g = e.ctrlKey ? (e.shiftKey ? 32 : 8) : 1; A.addPiece(S.armed, Math.round(w.x / g) * g, Math.round(w.y / g) * g); return; }
  const hit = pickAt(w.x, w.y, e.altKey);
  if (hit < 0) { S.drag = { type: 'marquee', w0: w, add: e.shiftKey, base: [...m.sel], click: true }; if (!e.shiftKey) m.setSel([]); return; }
  const inSel = m.sel.includes(hit);
  if (!e.shiftKey && !inSel) m.setSel([hit]);
  else if (e.shiftKey && !inSel) m.setSel([...m.sel, hit]);
  const ids = [...m.sel];
  S.drag = { type: 'move', w0: w, cx: e.clientX, cy: e.clientY, hit, inSel, shift: e.shiftKey, moved: false, before: m.snap(), ids, primary: ids.includes(hit) ? hit : ids[0], origs: new Map(ids.map(i => [i, { x: m.pieces[i].x, y: m.pieces[i].y }])) };
}
function onMove(e) {
  if (S.mode !== 'edit') return;
  const m = S.model, w = s2w(e.clientX, e.clientY), d = S.drag, c = S.scene.cameras.main; S.mouse = w;
  if (!d) return;
  if (d.type === 'pan') {
    const r = rectOf(), k = c.width / r.width / c.zoom;
    c.scrollX = Math.round(c.scrollX - (e.clientX - d.cx) * k); c.scrollY = Math.round(c.scrollY - (e.clientY - d.cy) * k); d.cx = e.clientX; d.cy = e.clientY;
    S.cam = { zoom: c.zoom, ...camCenter() };
  } else if (d.type === 'concept') { S.concept.x = Math.round(d.c0.x + w.x - d.w0.x); S.concept.y = Math.round(d.c0.y + w.y - d.w0.y); S.panel.refresh(); applyConcept(); }
  else if (d.type === 'marquee') {
    const x = Math.min(w.x, d.w0.x), y = Math.min(w.y, d.w0.y); S.marquee = { x, y, w: Math.abs(w.x - d.w0.x), h: Math.abs(w.y - d.w0.y) };
  } else if (d.type === 'move') {
    if (!d.moved && Math.hypot(e.clientX - d.cx, e.clientY - d.cy) < DRAG_PX) return;
    d.moved = true;
    let dx = w.x - d.w0.x, dy = w.y - d.w0.y; const o = d.origs.get(d.primary), g = e.ctrlKey ? (e.shiftKey ? 32 : 8) : 1;
    if (g > 1) { dx = Math.round((o.x + dx) / g) * g - o.x; dy = Math.round((o.y + dy) / g) * g - o.y; } else { dx = Math.round(dx); dy = Math.round(dy); }
    m.dragTo(d.origs, dx, dy); computeGuides();
  }
}
function onUp(e) {
  const d = S.drag, m = S.model; S.drag = null; S.guides = []; S.marquee = null;
  if (!d || S.mode !== 'edit') return;
  if (d.type === 'move') {
    if (d.moved) { if (m.push(d.before, 'drag')) m.emit('commit'); }
    else if (d.shift && d.inSel) m.setSel(m.sel.filter(i => i !== d.hit));
    else if (!d.shift && d.inSel && d.ids.length > 1) m.setSel([d.hit]);
  } else if (d.type === 'marquee') {
    const w = s2w(e.clientX, e.clientY), x0 = Math.min(w.x, d.w0.x), x1 = Math.max(w.x, d.w0.x), y0 = Math.min(w.y, d.w0.y), y1 = Math.max(w.y, d.w0.y);
    if (x1 - x0 < 3 && y1 - y0 < 3 && d.click) return;   // chi bam vao cho trong: da bo chon
    const inside = m.pieces.map((p, i) => i).filter(i => { const p = m.pieces[i], kit = kitOf(p.k); return !S.hidden.has(kit) && !S.locked.has(kit) && p.x >= x0 && p.x <= x1 && p.y >= y0 && p.y <= y1; });
    m.setSel(d.add ? [...d.base, ...inside] : inside);
  }
}
function onWheel(e) { if (S.mode !== 'edit') return; e.preventDefault(); zoomAt(e.deltaY < 0 ? 1 : -1, e.clientX, e.clientY); }
function onDragOver(e) { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; }
function onDrop(e) {
  e.preventDefault(); if (S.mode !== 'edit') return;
  const w = s2w(e.clientX, e.clientY), k = e.dataTransfer.getData('text/areaed');
  if (k) { const g = e.ctrlKey ? (e.shiftKey ? 32 : 8) : 1; A.addPiece(k, Math.round(w.x / g) * g, Math.round(w.y / g) * g); return; }
  const f = [...(e.dataTransfer.files || [])].find(x => /^image\//.test(x.type));
  if (f) { const rd = new FileReader(); rd.onload = () => loadConcept({ path: null, name: f.name, url: rd.result }); rd.readAsDataURL(f); }
}
function onKeyDown(e) {
  if (!S || S.dead) return;
  if (e.key === 'Tab') { e.preventDefault(); A.togglePlay(); return; }
  if (S.mode !== 'edit') return;
  const ctrl = e.ctrlKey || e.metaKey, k = e.key.toLowerCase();
  if (ctrl && k === 's') { e.preventDefault(); A.save(); return; }
  if (inField(e)) { if (e.key === 'Escape') e.target.blur(); return; }
  if (e.key === ' ') { S.space = true; e.preventDefault(); return; }
  if (k === 'c' && !ctrl) { S.keyC = true; return; }
  if (ctrl && k === 'z') { e.preventDefault(); e.shiftKey ? A.redo() : A.undo(); return; }
  if (ctrl && k === 'y') { e.preventDefault(); A.redo(); return; }
  if (ctrl && k === 'd') { e.preventDefault(); A.duplicate(); return; }
  if (ctrl && k === 'c') { e.preventDefault(); A.copy(); return; }
  if (ctrl && k === 'v') { e.preventDefault(); A.paste(); return; }
  if (ctrl && k === 'a') { e.preventDefault(); A.selectAll(); return; }
  if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); A.remove(); return; }
  if (k === 'f') { focusSel(); return; }
  if (e.key === '0') { fitArea(); return; }
  if (e.key === 'Escape') { if (S.armed) A.arm(null); else S.model.setSel([]); return; }
  const dir = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key];
  if (dir && S.model.sel.length) { e.preventDefault(); const s = e.shiftKey ? 8 : 1; S.model.moveBy(dir[0] * s, dir[1] * s, 'nudge'); }
}
function onKeyUp(e) { if (e.key === ' ') S.space = false; if (e.key.toLowerCase() === 'c') S.keyC = false; }
function onBlur() { S.space = false; S.keyC = false; }
const beforeUnload = e => { if (S?.model?.dirty) { e.preventDefault(); e.returnValue = ''; } };

// ---------- lop phu concept
function conceptCfg() { return LS('areaed:concept:' + S.id) || { path: null, opacity: 0.5, x: 0, y: 0, zoom: 1, locked: false, visible: true }; }
function persistConcept() { LS('areaed:concept:' + S.id, { ...S.concept, url: undefined, name: undefined }); }
function loadConcept(c) {   // c = {path, name, url?}: path -> GET /__areaed/concept?path=; url = file tha vao (khong luu duoc qua lan tai lai)
  S.concept = { ...S.concept, path: c.path, name: c.name || c.path, url: c.url || null };
  const src = c.url || '/__areaed/concept?path=' + encodeURIComponent(c.path), sc = S.scene, key = 'areaed:concept';
  const img = new Image(); img.onload = () => {
    if (sc !== S.scene || !sc.sys.isActive()) return;
    if (sc.textures.exists(key)) sc.textures.remove(key);
    sc.textures.addImage(key, img); S.conceptKey = key; S.conceptImg?.destroy(); S.conceptImg = sc.add.image(0, 0, key).setOrigin(0).setDepth(9650); applyConcept(); S.panel.refresh();
  };
  img.onerror = () => { S.op = { kind: 'error', msg: 'khong nap duoc concept ' + (c.path || c.name) }; S.panel.refresh(); };
  img.src = src; persistConcept();
}
function applyConcept() {
  const c = S.concept; if (!S.conceptImg || !S.conceptImg.active) return;
  S.conceptImg.setPosition(c.x, c.y).setScale(c.zoom).setAlpha(c.opacity).setVisible(c.visible && S.mode === 'edit'); persistConcept();
}
A.concept = { load: p => loadConcept({ path: p, name: p }), clear() { S.conceptImg?.destroy(); S.conceptImg = null; S.conceptKey = null; S.concept = { ...S.concept, path: null, name: null, url: null }; persistConcept(); S.panel.refresh(); }, apply: applyConcept };

// ---------- thu vien kit: moi kit trong public/assets/kits (server) + kit cua khu (cache scene)
async function loadLibrary() {
  const lib = {};
  try { for (const k of await (await fetch('/__areaed/kits')).json()) lib[k.kit] = k; } catch (e) { /* khong co plugin: chi kit cua khu */ }
  S.lib = lib;
}
function refreshAreaKits() {   // kit cua khu nam ngoai thu vien (vd HVQ-floor): lay tu cache scene
  for (const [kit, url] of Object.entries(S.scene.meta.kits || {})) {
    const d = S.scene.cache.json.get(kitCacheKey(S.id, kit)); if (!d) continue;
    if (!S.lib[kit]) S.lib[kit] = { kit, url, pieces: Object.fromEntries(Object.entries(d.pieces).map(([n, p]) => [n, { ...p }])), areaOnly: true };
    S.lib[kit].inArea = true;
  }
  for (const [kit, k] of Object.entries(S.lib)) if (S.model.kits[kit]) k.inArea = true;
}
const thumbUrl = (kit, name) => { const k = S.lib?.[kit], p = k?.pieces?.[name]; return k && p ? kitPieceUrl(k.url, p.file) : ''; };
A.thumbUrl = thumbUrl; A.arm = k => { S.armed = k; S.panel.refresh(); };

// ---------- khoi tao theo khu
async function init(scene) {
  const id = scene.areaId, W = scene.meta.width, H = scene.meta.height;
  S = { id, scene, mode: 'edit', layers: { ...DEFAULT_LAYERS, ...(LS('areaed:ui')?.layers || {}) }, groups: new Map(), alpha: new Map(), guides: [], marquee: null, drag: null, space: false, keyC: false,
    armed: null, clip: null, mouse: null, op: null, hidden: new Set(), locked: new Set(), baseHash: null, lib: {}, cam: null, concept: null, offs: [] };
  const flags = LS('areaed:kitflags:' + id); if (flags) { S.hidden = new Set(flags.hidden); S.locked = new Set(flags.locked); }
  S.concept = conceptCfg();
  let view = null;
  try { const r = await (await fetch('/__areaed/src?id=' + encodeURIComponent(id))).json(); if (r.hash) { S.baseHash = r.hash; view = r.view; } else S.op = { kind: 'error', msg: r.error || 'khong doc duoc src' }; }
  catch (e) { S.op = { kind: 'error', msg: 'khong co may chu luu (plugin areaEditor): ' + e.message }; }
  const meta = scene.meta;
  S.model = new Model({ id, W, H, pieces: view?.pieces || meta.pieces || [], kits: view?.kits || meta.kits || {} });
  await loadLibrary();
  // ban nhap chua luu (bo qua neu bang ban tren dia)
  // ban nhap chua luu: hien banner DOM (Khoi phuc / Bo nhap); chua chon thi khong dong vao localStorage
  const dr = S.baseHash && LS(draftKey());
  if (dr && piecesKey(dr.pieces) !== piecesKey(S.model.pieces)) S.draft = dr; else if (dr) LS(draftKey(), null);
  S.panel = createPanel(S, A);
  window.addEventListener('beforeunload', beforeUnload);
  S.model.on(kind => {
    if (!S || S.dead) return;
    if (kind === 'move') syncPositions();
    else if (kind === 'struct' || kind === 'commit') { if (missingKits().length) reload(); else { rebuild(); } }
    if (kind !== 'sel' && kind !== 'move') saveDraft();
    S.panel.refresh();
  });
}

function bindEdit(scene) {
  const canvas = scene.game.canvas, kb = scene.input.keyboard;
  if (kb) { kb.enabled = false; kb.clearCaptures?.(); }   // editor tu bat phim (E/Space/WASD cua game khong chay trong che do Sua)
  const c = scene.cameras.main; c.removeBounds?.(); c.stopFollow();
  S.model.W = scene.meta.width; S.model.H = scene.meta.height;
  if (S.cam) setCam(S.cam.zoom, S.cam.x, S.cam.y); else setCam(1, scene.player.x, scene.player.y);
  S.gfx = scene.add.graphics().setDepth(9700);
  scene.events.on('update', draw); S.offs.push(() => scene.events.off('update', draw));
  const add = (t, ev, fn, opt) => { t.addEventListener(ev, fn, opt); S.offs.push(() => t.removeEventListener(ev, fn, opt)); };
  add(canvas, 'pointerdown', onDown); add(window, 'pointermove', onMove); add(window, 'pointerup', onUp);
  add(canvas, 'wheel', onWheel, { passive: false }); add(canvas, 'contextmenu', e => e.preventDefault());
  add(canvas, 'dragover', onDragOver); add(canvas, 'drop', onDrop);
  add(window, 'blur', onBlur);
  rebuild();   // scene co the dang giu pieces khac (ban nhap) -> dung lai anh theo model
  if (S.concept.path) loadConcept({ path: S.concept.path, name: S.concept.path });
}

export async function attach(scene) {
  const id = scene.areaId;
  if (!S || S.id !== id) { if (S) teardownDom(); S = null; boot = init(scene); }
  await boot;
  if (!scene.sys.isActive() || !S) return;
  S.scene = scene; S.dead = false; S.offs = []; S.guides = []; S.drag = null; S.marquee = null;
  const play = !!scene.editData?.play;
  S.mode = play ? 'play' : 'edit';
  S.model.W = scene.meta.width; S.model.H = scene.meta.height;
  scene.events.once('shutdown', () => { for (const f of S.offs) f(); S.offs = []; S.gfx = null; S.conceptImg = null; S.groups = new Map(); });
  window.addEventListener('keydown', onKeyDown); window.addEventListener('keyup', onKeyUp);
  S.offs.push(() => { window.removeEventListener('keydown', onKeyDown); window.removeEventListener('keyup', onKeyUp); });
  if (play) { scene.input.keyboard.enabled = true; S.panel.setMode('play'); }
  else {
    S.panel.setMode('edit'); refreshAreaKits(); buildGroups();
    if (missingKits().length) { reload(); return; }   // ban nhap/kit moi: can nap them kit
    bindEdit(scene);
  }
  S.panel.refresh();
  const done = S.resolveAttach; S.attachP = null; S.resolveAttach = null; done?.();
}
function teardownDom() { S.dead = true; S.panel?.destroy(); window.removeEventListener('beforeunload', beforeUnload); }

// ---------- API test: window.__areaed (chi dev)
const settle = async () => { while (!boot) await new Promise(r => setTimeout(r, 30)); await boot; while (S.attachP) await S.attachP; };
const guard = async fn => { await settle(); const r = fn(); const p = S.attachP; if (p) await p; return r; };
window.__areaed = {
  ready: () => settle(),
  state: () => S && S.model ? { id: S.id, mode: S.mode, baseHash: S.baseHash, dirty: S.model.dirty, sel: [...S.model.sel], count: S.model.pieces.length, pieces: clone(S.model.pieces), kits: { ...S.model.kits }, usedKits: S.model.usedKits(),
    images: S.scene.kitImages.length, zoom: S.scene.cameras.main.zoom, guides: S.guides.map(g => ({ ref: g.ref, axis: g.axis })), draft: !!S.draft, hidden: [...S.hidden], locked: [...S.locked],
    concept: { ...S.concept, url: undefined, loaded: !!S.conceptImg?.active, texture: S.scene.textures.exists('areaed:concept'), visible: S.conceptImg?.active ? S.conceptImg.visible : null }, overlay: { ...S.stats }, groups: S.groups.size, undo: S.model.undoStack.length, redo: S.model.redoStack.length, op: S.op, cam: S.cam, layers: { ...S.layers } } : null,
  select: idx => guard(() => S.model.setSel(idx)),
  moveBy: (dx, dy) => guard(() => S.model.moveBy(dx, dy)),
  add: (k, x, y) => guard(() => A.addPiece(k, x, y)),
  remove: () => guard(() => A.remove()), duplicate: () => guard(() => A.duplicate()),
  undo: () => guard(() => A.undo()), redo: () => guard(() => A.redo()),
  save: async () => { await settle(); return A.save(); },
  check: async () => { await settle(); return A.check(); },
  togglePlay: () => guard(() => A.togglePlay()),
  setLayer: (name, on) => { A.setLayer(name, on); S.panel.refresh(); }, fit: () => guard(() => fitArea()),
  centerOn: (x, y, zoom) => guard(() => setCam(zoom || S.scene.cameras.main.zoom, x, y)),
  // tien ich cho test: chon bang click gia lap tai toa do the gioi; doi toa do the gioi -> client
  hitsAt: (x, y) => hitsAt(x, y),
  pickAt: (x, y, alt) => { const i = pickAt(x, y, !!alt); return i; },
  toClient: (x, y) => { const c = S.scene.cameras.main, r = rectOf(), z = c.zoom, gx = (x - c.scrollX - c.width / 2) * z + c.width / 2, gy = (y - c.scrollY - c.height / 2) * z + c.height / 2; return { x: r.left + gx * r.width / c.width, y: r.top + gy * r.height / c.height }; },
  s2w: (cx, cy) => s2w(cx, cy),
  placement: i => { const g = S.groups.get(i); return g ? g.imgs.map(im => ({ x: im.x, y: im.y, depth: im.depth, k: im.getData('kitPiece'), visible: im.visible })) : null; },
};
