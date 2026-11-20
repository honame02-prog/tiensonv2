// Texture thu tuc pixel art cho FX, sinh 1 lan luc boot (khong loc muot). Dung canvas 2D de kiem soat tung pixel.
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
const bayer = (x, y) => (BAYER[(y & 3) * 4 + (x & 3)] + 0.5) / 16;   // nguong 0..1

function canvasTex(scene, key, w, h, draw) {
  if (scene.textures.exists(key)) return key;
  const t = scene.textures.createCanvas(key, w, h);
  const ctx = t.getContext();
  const img = ctx.createImageData(w, h);
  draw((x, y, r, g, b, a) => { const i = (y * w + x) * 4; img.data[i] = r; img.data[i + 1] = g; img.data[i + 2] = b; img.data[i + 3] = a; }, w, h);
  ctx.putImageData(img, 0, 0);
  t.refresh();
  return key;
}

// Anh sang: gradient tron 5 nac (dither Bayer 4x4), xam tren nen den: dung voi blend ADD + tint.
export function lightTex(scene, size = 64) {
  return canvasTex(scene, size === 64 ? 'fx_light' : `fx_light${size}`, size, size, (set, w, h) => {
    const c = (w - 1) / 2;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const d = Math.hypot(x - c, y - c) / (w / 2);
      const v = Math.max(0, 1 - d);
      const q = Math.min(4, Math.max(0, Math.floor(v * 4 + bayer(x, y))));
      const g = Math.round(q / 4 * 255);
      set(x, y, g, g, g, 255);
    }
  });
}

// Vong tron trang, day `width` px, mep ngoai/trong dither. r = ban kinh ngoai.
export function ringTex(scene, r = 32, width = 3) {
  const key = r === 32 && width === 3 ? 'fx_ring' : `fx_ring_${r}_${width}`;
  return canvasTex(scene, key, r * 2, r * 2, (set, w, h) => {
    const c = (w - 1) / 2;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const d = Math.hypot(x - c, y - c);
      const inner = r - width;
      let a = 0;
      if (d <= r - 0.5 && d >= inner) a = 1;
      else if (d <= r + 0.5 && d > r - 0.5) a = bayer(x, y) < 0.6 ? 1 : 0;           // mep ngoai dither
      else if (d < inner && d >= inner - 1) a = bayer(x, y) < 0.5 ? 1 : 0;            // mep trong dither
      set(x, y, 255, 255, 255, a ? 255 : 0);
    }
  });
}

// Dia mo dither (alpha nhi phan, nac 4): mat decal tren san.
export function decalTex(scene) {
  return canvasTex(scene, 'fx_decal', 64, 64, (set, w, h) => {
    const c = (w - 1) / 2;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const v = Math.max(0, 1 - Math.hypot(x - c, y - c) / (w / 2));
      const q = Math.floor(Math.min(1, v * 1.6) * 4 + bayer(x, y) - 0.0) / 4;   // 0..1 theo nac
      set(x, y, 255, 255, 255, v > 0 && q >= 0.5 ? 255 : (v > 0 && q >= 0.25 && bayer(x, y) < 0.5 ? 255 : 0));
    }
  });
}

// Cot dung dung: nhieu nac mau tu dai (loi giua sang, mep toi), vien 1px mau neo, dither o ranh gioi nac, mep re nhon.
// Cache theo (dai, w, h). Goc duoi = chan (origin 0.5,1).
export function columnTex(scene, ramp, w, h, palette) {
  const key = `fx_col_${ramp}_${w}_${h}`;
  const pal = palette[ramp];
  return canvasTex(scene, key, w, h, (set) => {
    const cx = (w - 1) / 2;
    const mask = new Uint8Array(w * h);
    const lvl = new Uint8Array(w * h);
    for (let y = 0; y < h; y++) {
      const t = y / (h - 1);                                  // 0 dinh .. 1 chan
      const taper = 0.55 + 0.45 * Math.min(1, t * 3);        // dinh thon
      const wob = 1 + 0.1 * Math.sin(y * 0.35) + 0.06 * Math.sin(y * 0.9 + 1.3);
      const hw = (w / 2) * taper * wob;
      for (let x = 0; x < w; x++) {
        const d = Math.abs(x - cx) / hw;
        if (d > 1) continue;
        mask[y * w + x] = 1;
        const v = (1 - Math.pow(d, 1.3)) * (0.78 + 0.22 * t);    // 1 giua, 0 mep
        lvl[y * w + x] = Math.min(5, Math.max(0, Math.floor(v * 5.4 + (bayer(x, y) - 0.5))));
      }
    }
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (!mask[i]) { set(x, y, 0, 0, 0, 0); continue; }
      const edge = x === 0 || y === 0 || x === w - 1 || !mask[i - 1] || !mask[i + 1] || (y > 0 && !mask[i - w]) || (y < h - 1 && !mask[i + w]);
      const col = edge ? pal[0] : pal[1 + lvl[i]];
      set(x, y, (col >> 16) & 255, (col >> 8) & 255, col & 255, 255);
    }
  });
}

export function makeFxTextures(scene) {
  canvasTex(scene, 'fx_px1', 1, 1, set => set(0, 0, 255, 255, 255, 255));
  canvasTex(scene, 'fx_px2', 2, 2, set => { for (let i = 0; i < 4; i++) set(i & 1, i >> 1, 255, 255, 255, 255); });
  canvasTex(scene, 'fx_spark', 3, 3, set => { for (let y = 0; y < 3; y++) for (let x = 0; x < 3; x++) set(x, y, 255, 255, 255, (x === 1 || y === 1) ? 255 : 0); });
  lightTex(scene, 64); lightTex(scene, 128);
  ringTex(scene); decalTex(scene);
}
