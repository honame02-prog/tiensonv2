// PNG toi thieu (khong phu thuoc): decode 8-bit gray/RGB/RGBA/palette khong xen ke -> {w,h,data RGBA}; encode RGBA 8-bit.
import { inflateSync, deflateSync } from 'node:zlib';
import { readFileSync, writeFileSync } from 'node:fs';

export function decodePng(buf) {
  if (typeof buf === 'string') buf = readFileSync(buf);
  let p = 8, w = 0, h = 0, ct = 0, bd = 0, il = 0, plte = null, trns = null; const idat = [];
  while (p < buf.length) {
    const len = buf.readUInt32BE(p), type = buf.toString('latin1', p + 4, p + 8), d = buf.subarray(p + 8, p + 8 + len); p += 12 + len;
    if (type === 'IHDR') { w = d.readUInt32BE(0); h = d.readUInt32BE(4); bd = d[8]; ct = d[9]; il = d[12]; }
    else if (type === 'PLTE') plte = d; else if (type === 'tRNS') trns = d; else if (type === 'IDAT') idat.push(d);
  }
  if (bd !== 8 || il) throw new Error('chi ho tro 8-bit khong xen ke');
  const ch = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }[ct], bpp = ch, stride = w * ch;
  const raw = inflateSync(Buffer.concat(idat)), px = Buffer.alloc(stride * h);
  for (let y = 0; y < h; y++) {
    const f = raw[y * (stride + 1)], so = y * (stride + 1) + 1, o = y * stride;
    for (let i = 0; i < stride; i++) {
      const x = raw[so + i], a = i >= bpp ? px[o + i - bpp] : 0, b = y ? px[o - stride + i] : 0, c = i >= bpp && y ? px[o - stride + i - bpp] : 0;
      let v;
      if (f === 0) v = x; else if (f === 1) v = x + a; else if (f === 2) v = x + b; else if (f === 3) v = x + ((a + b) >> 1);
      else { const pp = a + b - c, pa = Math.abs(pp - a), pb = Math.abs(pp - b), pc = Math.abs(pp - c); v = x + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c); }
      px[o + i] = v & 255;
    }
  }
  const data = Buffer.alloc(w * h * 4);
  for (let i = 0; i < w * h; i++) {
    let r, g, b, a = 255;
    if (ct === 6) { r = px[i * 4]; g = px[i * 4 + 1]; b = px[i * 4 + 2]; a = px[i * 4 + 3]; }
    else if (ct === 2) { r = px[i * 3]; g = px[i * 3 + 1]; b = px[i * 3 + 2]; }
    else if (ct === 0) { r = g = b = px[i]; } else if (ct === 4) { r = g = b = px[i * 2]; a = px[i * 2 + 1]; }
    else { const k = px[i]; r = plte[k * 3]; g = plte[k * 3 + 1]; b = plte[k * 3 + 2]; if (trns && k < trns.length) a = trns[k]; }
    data[i * 4] = r; data[i * 4 + 1] = g; data[i * 4 + 2] = b; data[i * 4 + 3] = a;
  }
  return { w, h, data };
}

const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
const crc32 = (b) => { let c = 0xffffffff; for (let i = 0; i < b.length; i++) c = CRC[(c ^ b[i]) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
const chunk = (type, d) => { const o = Buffer.alloc(12 + d.length); o.writeUInt32BE(d.length, 0); o.write(type, 4, 'latin1'); d.copy(o, 8); o.writeUInt32BE(crc32(o.subarray(4, 8 + d.length)), 8 + d.length); return o; };

export function encodePng({ w, h, data }, file) {
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) { raw[y * (w * 4 + 1)] = 0; data.copy ? data.copy(raw, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4) : raw.set(data.subarray(y * w * 4, (y + 1) * w * 4), y * (w * 4 + 1) + 1); }
  const ih = Buffer.alloc(13); ih.writeUInt32BE(w, 0); ih.writeUInt32BE(h, 4); ih[8] = 8; ih[9] = 6;
  const out = Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ih), chunk('IDAT', deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
  if (file) writeFileSync(file, out);
  return out;
}
