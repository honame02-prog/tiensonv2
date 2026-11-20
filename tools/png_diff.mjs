// So anh theo diem anh: node tools/png_diff.mjs <tien-to-A> <tien-to-B> [n=8]  -> so pixel khac giua shots/<A>_hvq_i.png va shots/<B>_hvq_i.png
import { decodePng } from './png.mjs';
const [A, B, n = 8] = [process.argv[2], process.argv[3], +(process.argv[4] || 8)];
let total = 0;
for (let i = 0; i < n; i++) {
  const a = decodePng(`shots/${A}_hvq_${i}.png`), b = decodePng(`shots/${B}_hvq_${i}.png`);
  if (a.w !== b.w || a.h !== b.h) { console.log(i, 'khac kich thuoc', a.w, a.h, b.w, b.h); total += 1e9; continue; }
  let d = 0, maxd = 0;
  for (let k = 0; k < a.w * a.h; k++) { const dd = Math.max(Math.abs(a.data[k * 4] - b.data[k * 4]), Math.abs(a.data[k * 4 + 1] - b.data[k * 4 + 1]), Math.abs(a.data[k * 4 + 2] - b.data[k * 4 + 2])); if (dd) { d++; if (dd > maxd) maxd = dd; } }
  console.log(`anh ${i}: ${a.w}x${a.h}  pixel khac = ${d}  (max lech kenh = ${maxd})`); total += d;
}
console.log('TONG pixel khac =', total);
