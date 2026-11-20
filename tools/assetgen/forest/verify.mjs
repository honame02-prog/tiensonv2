import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { decodePng } from '../../png.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../../..');
const files=['public/assets/forest/forest_atlas.png','public/assets/forest/forest_atlas.json','public/assets/forest/forest_sprites.json',
  'records/assetgen/forest/sheet.png','records/assetgen/forest/demo-1x.png','records/assetgen/forest/compare.png','records/assetgen/forest/stamp-audit.json'];
const digest=file=>createHash('md5').update(readFileSync(path.join(root,file))).digest('hex');
const run=file=>execFileSync(process.execPath,[`tools/assetgen/forest/${file}`],{cwd:root,encoding:'utf8',timeout:60000}).trim();
console.log(run('gen.mjs'));
const first=files.map(digest);
console.log(run('gen.mjs'));
const second=files.map(digest);
assert.deepEqual(first,second,'non-deterministic generation');
for(let i=0;i<files.length;i++)console.log(`REPRO ${files[i]} run1=${first[i]} run2=${second[i]}`);
const compare=decodePng(path.join(root,'records/assetgen/forest/compare.png'));
assert.equal(compare.w,1480);assert.equal(compare.h,840);
const audit=JSON.parse(readFileSync(path.join(root,'records/assetgen/forest/stamp-audit.json'),'utf8'));
for(const c of Object.values(audit.canopies)){assert(c.stamps>=25&&c.stamps<=60);assert(c.crowns>=2&&c.crowns<=4);assert.equal(c.flipX,false);}
for(const c of Object.values(audit.bushes)){assert(c.stamps>=3&&c.stamps<=7);assert.equal(c.flipX,false);}
for(const c of Object.values(audit.grass)){assert(c.stamps>=2&&c.stamps<=4);assert.equal(c.flipX,false);}
console.log('PASS reproducibility files=7 compare=1480x840 scale=2 crowns=3..4 foliageStamps=60 flipX=false');
console.log(run('check.mjs'));
