// Deliberately artificial labelled blocks; not production artwork.
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { encodePng } from '../../../../tools/png.mjs';
const dir = fileURLToPath(new URL('.', import.meta.url));
const glyph = { G: [7,4,5,5,7], B: [6,5,6,5,6], R: [6,5,6,5,5], O: [7,5,5,5,7] };
function image(name, w, h, color, label, hole = false) {
  const data = Buffer.alloc(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (hole && x >= 40 && x < 88 && y >= 20) continue;
    const i = (y * w + x) * 4; data.set([...color, 255], i);
  }
  for (let y = 0; y < 5; y++) for (let x = 0; x < 3; x++) if (glyph[label][y] & (4 >> x)) data.set([255,255,255,255], ((y + 3) * w + x + 3) * 4);
  // A non-symmetric texture proves modulo repetition (not mirror/noise).
  if (name === 'ground') data.set([30,150,40,255], (h * w - 1) * 4);
  encodePng({ w, h, data }, dir + name + '.png');
}
image('ground', 64, 64, [40,180,60], 'G');
image('base', 64, 64, [180,40,40], 'B');
image('roof', 64, 32, [40,60,190], 'R');
image('gate', 128, 64, [180,120,40], 'O', true);
image('gate_roof', 128, 24, [70,60,160], 'R');
const piece = (file, layer, anchor, footprint, collide = []) => ({ file: file + '.png', layer, anchor, footprint, collide });
const kit = { kit: 'FAKE', pieces: {
  ground: piece('ground', 'ground', [16,16], [64,64]),
  base: piece('base', 'base', [32,64], [64,12], [[-32,-12,64,12]]),
  roof: piece('roof', 'roof', [32,64], [64,12]),
  gate: { ...piece('gate', 'base', [64,64], [128,12], [[-64,-12,40,12],[24,-12,40,12]]), pair: 'gate_roof' },
  gate_roof: piece('gate_roof', 'roof', [64,80], [128,12]),
} };
writeFileSync(dir + 'kit.json', JSON.stringify(kit, null, 2) + '\n', 'utf8');
console.log('FAKE kit: 5 labelled PNGs (ground/base/roof, solid base + open gate)');
