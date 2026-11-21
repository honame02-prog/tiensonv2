// Logic thuan (khong phu thuoc Phaser) cho khu nhieu tang dai (I2) va tan/mai mo (I3). AreaScene dung, tools/area_layers_test.mjs + tools/area_metrics.mjs kiem.
// Du lieu khu (area.json, do tools/blockout_to_src.mjs + area_bake.mjs sinh): tierRows[cy][cx] = ky tu so tang ('.' = ngoai tang), steps = [{id, rect:[x,y,w,h] px, dir:'up|down|left|right', lo, hi}]
// (dir = huong DI LEN tu tang lo sang tang hi). Mep giua 2 tang khac muc da la o chan (col) tru o bac; tierAt/stepAt cho biet tang hien tai de sap lop va de bao ve.
export const CELL = 32;
export const TIER_DEPTH = 0.01;      // chenh depth moi tang: chi de phan xu khi cung y (depth chinh van la y)
export const ROOF_FADE_ALPHA = 0.35; // alpha mai/tan khi che nhan vat -> than thay duoc >= 65 % (K-A4: >= 60 %)
export const ROOF_MARGIN_X = 24, ROOF_MARGIN_Y = 12;   // mo som truoc khi che de alpha kip on dinh: ngang 24 px, doc 12 px (khong mo khi dung truoc dien cach pixel mai > 12 px)
export const ROOF_FADE_MS = 150;                       // thoi gian mo/hien lai (chay 118 px/s ~ 18 px)
export const BODY_W = 24, BODY_H = 46;   // than nhan vat (khung visible ~ 24 x 46 px, chan o (x, y))

export const bodyRect = (x, y) => [x - BODY_W / 2, y - BODY_H, BODY_W, BODY_H];
export const rectsOverlap = (a, b) => a[0] < b[0] + b[2] && b[0] < a[0] + a[2] && a[1] < b[1] + b[3] && b[1] < a[1] + a[3];
const clamp01 = v => Math.max(0, Math.min(1, v));

export function stepAt(meta, x, y) {
  for (const s of meta.steps || []) { const [rx, ry, rw, rh] = s.rect; if (x >= rx && x < rx + rw && y >= ry && y < ry + rh) return s; }
  return null;
}
// tien do len bac 0..1 theo huong dir
export function stepProgress(s, x, y) {
  const [rx, ry, rw, rh] = s.rect;
  switch (s.dir) { case 'down': return clamp01((y - ry) / rh); case 'left': return clamp01((rx + rw - x) / rw); case 'right': return clamp01((x - rx) / rw); default: return clamp01((ry + rh - y) / rh); }
}
// tang (so thuc) tai diem: tren bac noi suy lo -> hi; ngoai bac doc tierRows; o khong thuoc tang nao ('.') giu `prev`
export function tierAt(meta, x, y, prev = 0) {
  const s = stepAt(meta, x, y); if (s) return s.lo + (s.hi - s.lo) * stepProgress(s, x, y);
  const row = meta.tierRows?.[Math.floor(y / CELL)], ch = row?.[Math.floor(x / CELL)];
  return !ch || ch === '.' ? prev : +ch;
}
export const depthOf = (y, tier) => y + tier * TIER_DEPTH;
// Bao ve: tang chi doi lien tuc. cur = tang HIEN TAI cua nhan vat (o '.' ngoai tang giu nguyen tang cu, khong suy ve 0). Ngoai bac: khong nhay >= 1 giua 2 khung.
// Cham bac (diem di hoac diem den nam trong bac): tang moi phai khop tang cu trong STEP_TOL, tuc chi doi tang theo truc bac (dir); thoat canh hong giua bac (tang bac != tang o ben canh) bi chan.
export const STEP_TOL = 0.25;
export function tierStepOk(meta, x0, y0, x1, y1, cur) {
  const t0 = cur ?? tierAt(meta, x0, y0), t1 = tierAt(meta, x1, y1, t0);
  return Math.abs(t1 - t0) < ((stepAt(meta, x0, y0) || stepAt(meta, x1, y1)) ? STEP_TOL : 1);
}

// ---- tan / mai (K-A4): mai = anh co vung dac. `shape` = 1 rect [x,y,w,h] HOAC mang rect (mat na pixel dac, alphaMaskRects). Mo (ROOF_FADE_ALPHA) khi than cham shape (nong margin) ma mai dang che; khong thi alpha goc.
const rectsOf = shape => (Array.isArray(shape[0]) ? shape : [shape]);
export const roofTargetAlpha = (shape, x, y, base = 1) => { const b = bodyRect(x, y), mx = ROOF_MARGIN_X, my = ROOF_MARGIN_Y;
  return rectsOf(shape).some(r => rectsOverlap([r[0] - mx, r[1] - my, r[2] + 2 * mx, r[3] + 2 * my], b)) ? Math.min(base, ROOF_FADE_ALPHA) : base; };
// ti le than thay duoc (0..1) khi mai co alpha `alpha`: 1 - dien tich than bi phan dac cua mai che * alpha (cac rect cua mat na khong chong nhau)
export function bodyVisible(shape, x, y, alpha) {
  const b = bodyRect(x, y); let cov = 0;
  for (const r of rectsOf(shape)) cov += Math.max(0, Math.min(b[0] + b[2], r[0] + r[2]) - Math.max(b[0], r[0])) * Math.max(0, Math.min(b[1] + b[3], r[1] + r[3]) - Math.max(b[1], r[1]));
  return 1 - Math.min(1, cov / (b[2] * b[3])) * alpha;
}
// mat na pixel dac cua mai: data = RGBA (w x h), (ox, oy) = goc anh trong the gioi; chia o `cell` px, o co pixel alpha > thr thi dac; gop run ngang -> mang rect the gioi. (frame = {x,y,w,h} cat tu atlas neu data la ca atlas)
export function alphaMaskRects(data, w, h, ox, oy, frame = { x: 0, y: 0, w, h }, cell = 8, thr = 16) {
  const out = [];
  for (let cy = 0; cy * cell < frame.h; cy++) {
    let run = -1;
    for (let cx = 0; cx <= Math.ceil(frame.w / cell); cx++) {
      let solid = false;
      if (cx * cell < frame.w) for (let yy = cy * cell; yy < Math.min(frame.h, (cy + 1) * cell) && !solid; yy++) for (let xx = cx * cell; xx < Math.min(frame.w, (cx + 1) * cell); xx++) if (data[((frame.y + yy) * w + frame.x + xx) * 4 + 3] > thr) { solid = true; break; }
      if (solid && run < 0) run = cx; else if (!solid && run >= 0) { out.push([ox + run * cell, oy + cy * cell, Math.min(frame.w, cx * cell) - run * cell, Math.min(cell, frame.h - cy * cell)]); run = -1; }
    }
  }
  return out;
}
export const isRoofFrame = name => /(^|[_:])(roof|canopy)(_|$)|_roof$/.test(name);
