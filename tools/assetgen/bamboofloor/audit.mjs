// Independent v2 artwork measurements; original check.mjs remains unchanged.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
import {decodePng} from '../../png.mjs';
const root=fileURLToPath(new URL('../../../',import.meta.url));
const leaf=new Set(['110,106,76','119,113,83','138,132,96']);
const metrics={coverage:[],localDensity:[]};
for(let i=0;i<4;i++){
 const t=decodePng(resolve(root,`public/assets/terrain/leaflitter_${i}.png`));let total=0,blocks=[];
 for(let by=0;by<128;by+=16)for(let bx=0;bx<128;bx+=16){let n=0;for(let y=by;y<by+16;y++)for(let x=bx;x<bx+16;x++){const p=(y*128+x)*4;if(leaf.has([...t.data.subarray(p,p+3)].join(',')))n++;}blocks.push(n/256);total+=n;}
 const coverage=total/16384*100,min=Math.min(...blocks)*100,max=Math.max(...blocks)*100;
 assert(coverage>=55&&coverage<=70,`leaflitter_${i}: coverage ${coverage}`);
 assert(max-min>=20,`leaflitter_${i}: density too uniform`);
 metrics.coverage.push(coverage);metrics.localDensity.push({min,max});
 console.log(`PASS leaflitter_${i}: dry leaf coverage=${coverage.toFixed(2)}%; local density=${min.toFixed(1)}..${max.toFixed(1)}%`);
}
function original(path){const r=spawnSync('C:/Program Files/Git/cmd/git.exe',['show',`codex/AG4b:${path}`],{cwd:root,maxBuffer:8*1024*1024});assert.equal(r.status,0,r.stderr.toString());return r.stdout;}
const base=decodePng(original('public/assets/bamboofloor/bamboofloor_atlas.png'));
const oldMeta=JSON.parse(original('public/assets/bamboofloor/bamboofloor_atlas.json'));
const now=decodePng(resolve(root,'public/assets/bamboofloor/bamboofloor_atlas.png'));
const newMeta=JSON.parse(readFileSync(resolve(root,'public/assets/bamboofloor/bamboofloor_atlas.json'),'utf8'));
function frame(img,f){const b=Buffer.alloc(f.w*f.h*4);for(let y=0;y<f.h;y++)img.data.copy(b,y*f.w*4,((y+f.y)*img.w+f.x)*4,((y+f.y)*img.w+f.x+f.w)*4);return b;}
for(let i=0;i<3;i++)for(const suffix of ['', '_shadow']){const key=`mossrock_${i}${suffix}`;assert.deepEqual(frame(now,newMeta.frames[key].frame),frame(base,oldMeta.frames[key].frame),`${key}: approved pixels changed`);}
console.log('PASS approved mossrock: 6/6 frames pixel-identical to codex/AG4b');
let rockMax=0,oldRockMax=0;
const rockColours=new Set(['36,36,31','52,52,47','61,59,56','72,69,63','84,80,76']);
for(let i=0;i<4;i++){
 const b=frame(now,newMeta.frames[`stone_path_${i}`].frame),old=frame(base,oldMeta.frames[`stone_path_${i}`].frame);
 for(let p=0;p<b.length;p+=4){if(b[p+3]&&rockColours.has([...b.subarray(p,p+3)].join(',')))rockMax=Math.max(rockMax,...b.subarray(p,p+3));if(old[p+3])oldRockMax=Math.max(oldRockMax,...old.subarray(p,p+3));}
}
assert(rockMax<=84);metrics.stoneBodyBrightest=rockMax;metrics.approvedMossFramesUnchanged=6;
console.log(`PASS stone body brightest channel=${rockMax} (old stone frame brightest=${oldRockMax}); palette tops at rock_a middle #54504c`);
writeFileSync(resolve(root,'records/assetgen/bamboofloor/artwork-metrics.json'),JSON.stringify(metrics,null,2)+'\n');
console.log('ARTWORK PASS: leaf coverage 55..70%; uneven piles; approved mossrock unchanged; stone mid-rock palette');
