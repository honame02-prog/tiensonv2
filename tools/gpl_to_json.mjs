// Doc art/palette/tienson-fx.gpl -> src/fx/fx-palette.json { hoa:[[r,g,b]x7], ... } (0 = neo bong, 6 = loi)
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = {};
for (const line of readFileSync(join(root, 'art/palette/tienson-fx.gpl'), 'utf8').split(/\r?\n/)) {
  const m = line.match(/^\s*(\d+)\s+(\d+)\s+(\d+)\s+(\w+)\s*$/);
  if (!m) continue;
  (out[m[4]] ||= []).push('#' + [m[1], m[2], m[3]].map(v => (+v).toString(16).padStart(2, '0')).join(''));
}
for (const [k, v] of Object.entries(out)) if (v.length !== 7) throw new Error(`dai ${k} co ${v.length} mau, can 7`);
writeFileSync(join(root, 'src/fx/fx-palette.json'), JSON.stringify(out, null, 1) + '\n');
console.log('ok', Object.keys(out).join(','));
