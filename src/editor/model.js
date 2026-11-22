// Area Editor: mo hinh du lieu thuan (khong phu thuoc Phaser/DOM). Don vi thao tac = placement (1 muc trong pieces), khong phai anh.
// Hoan tac = ngan xep anh chup (pieces + chon). 1 lan keo = 1 buoc; cac lan nhan mui ten lien tiep gop 1 buoc.
const MARGIN = 1024;   // validateEdit cho phep toa do trong [-1024, W/H+1024]
const clone = a => a.map(p => ({ ...p }));
export const piecesKey = pieces => JSON.stringify(pieces);

export class Model {
  constructor({ id, W, H, pieces, kits }) {
    this.id = id; this.W = W; this.H = H;
    this.pieces = clone(pieces); this.kits = { ...kits }; this.origKits = { ...kits };   // origKits = kit da co tren dia
    this.sel = []; this.undoStack = []; this.redoStack = []; this.listeners = [];
    this.savedKey = this.key(); this.lastNudge = 0;
  }
  // kits ghi xuong dia = kit goc (giu nguyen) + kit them moi ma con duoc dung
  usedKits() {
    const out = { ...this.origKits }, used = new Set(this.pieces.map(p => p.k.slice(0, p.k.indexOf('/'))));
    for (const [k, u] of Object.entries(this.kits)) if (!(k in out) && used.has(k)) out[k] = u;
    return out;
  }
  key() { return piecesKey(this.pieces) + '|' + JSON.stringify(this.usedKits()); }
  get dirty() { return this.key() !== this.savedKey; }
  markSaved() { this.savedKey = this.key(); this.emit('saved'); }
  on(fn) { this.listeners.push(fn); }
  emit(kind) { for (const fn of this.listeners) fn(kind); }

  snap() { return { pieces: clone(this.pieces), sel: [...this.sel] }; }
  restore(s) { this.pieces = clone(s.pieces); this.sel = [...s.sel]; }
  // dat 1 buoc hoan tac: before = snap() truoc khi sua. Bo qua neu khong co gi doi
  push(before, label) {
    if (piecesKey(before.pieces) === piecesKey(this.pieces)) return false;
    const now = Date.now();
    const selKey = JSON.stringify(before.sel);   // chi gop nudge khi cung tap chon
    if (label === 'nudge' && this.undoStack.length && this.undoStack.at(-1).label === 'nudge' && now - this.lastNudge < 700 && this.lastNudgeSel === selKey) { this.lastNudge = now; return true; }
    this.lastNudge = label === 'nudge' ? now : 0; this.lastNudgeSel = selKey;
    this.undoStack.push({ ...before, label }); if (this.undoStack.length > 200) this.undoStack.shift();
    this.redoStack = []; return true;
  }
  undo() {
    const s = this.undoStack.pop(); if (!s) return false;
    this.redoStack.push({ ...this.snap(), label: s.label }); this.restore(s); this.lastNudge = 0; this.emit('struct'); return true;
  }
  redo() {
    const s = this.redoStack.pop(); if (!s) return false;
    this.undoStack.push({ ...this.snap(), label: s.label }); this.restore(s); this.lastNudge = 0; this.emit('struct'); return true;
  }
  setSel(idx) { this.sel = [...new Set(idx.filter(i => i >= 0 && i < this.pieces.length))].sort((a, b) => a - b); this.emit('sel'); }

  // gioi han do doi (dx, dy) de moi placement da chon van nam trong khu [0..W] x [0..H] (validateEdit phia server yeu cau so nguyen trong khu)
  clampDelta(dx, dy, idx = this.sel) {
    for (const i of idx) { const p = this.pieces[i]; dx = Math.max(-MARGIN - p.x, Math.min(this.W + MARGIN - p.x, dx)); dy = Math.max(-MARGIN - p.y, Math.min(this.H + MARGIN - p.y, dy)); }
    return [dx, dy];
  }
  // dich cac placement da chon (khong dat buoc hoan tac, dung cho keo); tra ve [dx, dy] thuc te
  shift(dx, dy, idx = this.sel) {
    [dx, dy] = this.clampDelta(Math.round(dx), Math.round(dy), idx);
    if (dx || dy) { for (const i of idx) { this.pieces[i].x = Math.round(this.pieces[i].x + dx); this.pieces[i].y = Math.round(this.pieces[i].y + dy); } this.emit('move'); }
    return [dx, dy];
  }
  // keo: dat moi placement ve vi tri goc (origs: Map chi so -> {x,y}) cong do doi (dx, dy), co gioi han trong khu
  dragTo(origs, dx, dy) {
    const idx = [...origs.keys()];
    for (const i of idx) { const o = origs.get(i); dx = Math.max(-MARGIN - o.x, Math.min(this.W + MARGIN - o.x, dx)); dy = Math.max(-MARGIN - o.y, Math.min(this.H + MARGIN - o.y, dy)); }
    for (const i of idx) { const o = origs.get(i); this.pieces[i].x = (dx || dy) ? Math.round(o.x + dx) : o.x; this.pieces[i].y = (dx || dy) ? Math.round(o.y + dy) : o.y; }   // muc duoc doi -> so nguyen; chua doi giu nguyen gia tri goc
    this.emit('move'); return [dx, dy];
  }
  moveBy(dx, dy, label = 'move') {
    const b = this.snap(); const r = this.shift(dx, dy); if (this.push(b, label)) this.emit('commit'); return r;
  }
  add(k, x, y) {
    const b = this.snap(); this.pieces.push({ k, x: Math.max(-MARGIN, Math.min(this.W + MARGIN, Math.round(x))), y: Math.max(-MARGIN, Math.min(this.H + MARGIN, Math.round(y))) });
    this.sel = [this.pieces.length - 1]; this.push(b, 'add'); this.emit('struct'); return this.pieces.length - 1;
  }
  remove(idx = this.sel) {
    if (!idx.length) return 0; const b = this.snap(), del = new Set(idx);
    this.pieces = this.pieces.filter((_, i) => !del.has(i)); this.sel = []; this.push(b, 'remove'); this.emit('struct'); return del.size;
  }
  duplicate(idx = this.sel, off = 8) {
    if (!idx.length) return []; const b = this.snap(), [dx, dy] = this.clampDelta(off, off, idx), start = this.pieces.length;
    for (const i of idx) this.pieces.push({ ...this.pieces[i], x: Math.round(this.pieces[i].x + dx), y: Math.round(this.pieces[i].y + dy) });   // toa do dich lam tron nguyen (kể ca khi goc le)
    this.sel = idx.map((_, n) => start + n); this.push(b, 'duplicate'); this.emit('struct'); return [...this.sel];
  }
  // dan cac placement (chep tu clipboard) sao cho placement dau tien nam o (x, y)
  paste(items, x, y) {
    if (!items.length) return []; const b = this.snap(), start = this.pieces.length, ox = items[0].x, oy = items[0].y;
    for (const p of items) this.pieces.push({ ...p, x: Math.max(-MARGIN, Math.min(this.W + MARGIN, Math.round(p.x - ox + x))), y: Math.max(-MARGIN, Math.min(this.H + MARGIN, Math.round(p.y - oy + y))) });
    this.sel = items.map((_, n) => start + n); this.push(b, 'paste'); this.emit('struct'); return [...this.sel];
  }
  // nhap so: lam tron toa do DICH (623.8 -> nhap 624 thi ghi 624, khong giu 623.8)
  setPos(i, x, y) {
    const p = this.pieces[i], b = this.snap();
    p.x = Math.max(-MARGIN, Math.min(this.W + MARGIN, Math.round(x))); p.y = Math.max(-MARGIN, Math.min(this.H + MARGIN, Math.round(y)));
    this.emit('move'); if (this.push(b, 'setpos')) this.emit('commit');
  }
  setK(idx, k) {
    const b = this.snap(); for (const i of idx) this.pieces[i].k = k; this.push(b, 'setk'); this.emit('struct');
  }
  // thay doi tu ben ngoai (nhap nhap khoi phuc): dat lai toan bo, xoa lich su
  reset(pieces, kits) { this.pieces = clone(pieces); this.kits = { ...this.kits, ...kits }; this.sel = []; this.undoStack = []; this.redoStack = []; this.emit('struct'); }
}
