// Full output checks; baseline captured before the first generator invocation.
import assert from 'node:assert/strict';
import {readFileSync,readdirSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {decodePng} from '../../png.mjs';
const ROOT=fileURLToPath(new URL('../../../',import.meta.url)),TERR=resolve(ROOT,'public/assets/terrain'),OUT=resolve(ROOT,'public/assets/bamboofloor'),REC=resolve(ROOT,'records/assetgen/bamboofloor');
const json=f=>JSON.parse(readFileSync(f,'utf8')),md5=f=>createHash('md5').update(readFileSync(f)).digest('hex');
const baseline=json(new URL('./baseline.json',import.meta.url));
const outputFiles=()=>[...readdirSync(OUT).map(f=>resolve(OUT,f)),...Array.from({length:4},(_,i)=>resolve(TERR,`leaflitter_${i}.png`)),resolve(TERR,'terrain.json'),...['sheet.png','compare.png','demo-1x.png','mosaic-1x.png'].map(f=>resolve(REC,f))].sort();
function generate(){const p=spawnSync(process.execPath,[resolve(ROOT,'tools/assetgen/bamboofloor/gen.mjs')],{cwd:ROOT,encoding:'utf8',timeout:60000});assert.equal(p.status,0,p.stderr||p.error?.message);return Object.fromEntries(outputFiles().map(f=>[f.slice(ROOT.length).replaceAll('\\','/'),md5(f)]));}
const before=Object.fromEntries(Object.keys(baseline.hashes).map(f=>[f,md5(resolve(TERR,f))]));
assert.deepEqual(before,baseline.hashes,'Old terrain changed before verification');
const run1=generate(),run2=generate();assert.deepEqual(run1,run2,'Generator output is not byte deterministic');
const after=Object.fromEntries(Object.keys(baseline.hashes).map(f=>[f,md5(resolve(TERR,f))]));assert.deepEqual(after,baseline.hashes,'Generator modified old terrain');
console.log(`PASS deterministic ${Object.keys(run1).length}/${Object.keys(run1).length} outputs MD5 identical across 2 runs; old terrain PNG ${Object.keys(after).length}/16 unchanged`);
const terrain=json(resolve(TERR,'terrain.json'));
assert.deepEqual(terrain.materials.leaflitter,Array.from({length:4},(_,i)=>`leaflitter_${i}.png`));delete terrain.materials.leaflitter;assert.deepEqual(terrain,baseline.terrain,'Only leaflitter registration may be added');
console.log('PASS terrain.json: only materials.leaflitter added; all old values preserved');
const atlas=decodePng(resolve(OUT,'bamboofloor_atlas.png')),meta=json(resolve(OUT,'bamboofloor_atlas.json')),sprites=json(resolve(OUT,'bamboofloor_sprites.json')).sprites;
assert.deepEqual(meta.meta.size,{w:atlas.w,h:atlas.h});assert(atlas.w<=2048&&atlas.h<=2048);
function crop(f){const o={w:f.w,h:f.h,data:Buffer.alloc(f.w*f.h*4)};for(let y=0;y<f.h;y++)atlas.data.copy(o.data,y*f.w*4,((y+f.y)*atlas.w+f.x)*4,((y+f.y)*atlas.w+f.x+f.w)*4);return o;}
let semi=0,high=0,opaque=0;const cut={};
function colourCheck(t,name,solid=false){let hs=0,op=0;for(let p=0;p<t.data.length;p+=4){const a=t.data[p+3];if(solid)assert.equal(a,255,`${name}: transparent floor`);if(a!==0&&a!==255)semi++;if(a){op++;const c=[t.data[p],t.data[p+1],t.data[p+2]],max=Math.max(...c),min=Math.min(...c);if(max&&1-min/max>.35)hs++;}}assert(hs/Math.max(1,op)<=.01,`${name}: saturated pixels ${hs}/${op}`);high+=hs;opaque+=op;}
const rectangles=[];
for(const [key,entry] of Object.entries(meta.frames)){const f=entry.frame,s=sprites[key];assert(s,`${key} lacks sprite metadata`);assert.equal(f.w,s.w);assert.equal(f.h,s.h);assert(f.x>=0&&f.y>=0&&f.x+f.w<=atlas.w&&f.y+f.h<=atlas.h);assert.deepEqual(entry.sourceSize,{w:f.w,h:f.h});assert.equal(entry.rotated,false);assert.equal(entry.trimmed,false);assert(s.foot.length===2&&s.foot[0]>=0&&s.foot[0]<=s.w&&s.foot[1]>=0&&s.foot[1]<=s.h);for(const r of rectangles)assert(f.x>=r.x+r.w||r.x>=f.x+f.w||f.y>=r.y+r.h||r.y>=f.y+f.h,`${key}: atlas overlap`);rectangles.push(f);cut[key]=crop(f);colourCheck(cut[key],key);if(s.role==='prop'){const last=cut[key].data.subarray((f.h-1)*f.w*4);assert([...last].some((v,i)=>i%4===3&&v===255),`${key}: foot does not reach bottom`);}}
for(const key of ['fence_bamboo_h_0','fence_bamboo_h_1','fence_bamboo_post','mossrock_0','mossrock_1','mossrock_2','stone_path_0','stone_path_1','stone_path_2','stone_path_3'])assert(cut[key],`Missing ${key}`);
assert.equal(Object.keys(sprites).length,Object.keys(meta.frames).length);
for(const key of ['fence_bamboo_h_0','fence_bamboo_h_1'])assert.deepEqual([cut[key].w,cut[key].h],[64,28]);
for(let i=0;i<3;i++)assert(cut[`mossrock_${i}`].w>=20&&cut[`mossrock_${i}`].w<=40&&cut[`mossrock_${i}`].h>=20&&cut[`mossrock_${i}`].h<=40);
// Compare every RGBA channel at both directions of every variant pairing.
function edge(a,b,axis){let max=0;for(let k=0;k<(axis==='x'?a.h:a.w);k++)for(let c=0;c<4;c++){const pa=axis==='x'?(k*a.w+a.w-1)*4+c:((a.h-1)*a.w+k)*4+c,pb=axis==='x'?k*b.w*4+c:k*4+c;max=Math.max(max,Math.abs(a.data[pa]-b.data[pb]));}return max;}
const tiles=Array.from({length:4},(_,i)=>decodePng(resolve(TERR,`leaflitter_${i}.png`)));let tileMax=0,fenceMax=0;
for(const t of tiles){assert.deepEqual([t.w,t.h],[128,128]);colourCheck(t,'leaflitter',true);}
for(const a of tiles)for(const b of tiles)for(const axis of ['x','y'])tileMax=Math.max(tileMax,edge(a,b,axis));assert(tileMax<=4,`Leaflitter seam max ${tileMax}`);
for(let i=0;i<2;i++)for(let j=0;j<2;j++)fenceMax=Math.max(fenceMax,edge(cut[`fence_bamboo_h_${i}`],cut[`fence_bamboo_h_${j}`],'x'));assert(fenceMax<=4,`Fence seam max ${fenceMax}`);
// Check atlas padding too, rather than only populated rectangles.
for(let p=3;p<atlas.data.length;p+=4)assert(atlas.data[p]===0||atlas.data[p]===255,'Atlas contains partial alpha');assert.equal(semi,0);
console.log(`PASS alpha partial=${semi}; saturation>0.35=${high}/${opaque} (${(high/opaque*100).toFixed(3)}%); sprites=${Object.keys(cut).length}`);
console.log(`PASS leaflitter all 16 variant pairs x 2 axes (all 4 edges): max channel delta=${tileMax}; fence all 4 pairs: max channel delta=${fenceMax}`);
for(const [name,w,h] of [['sheet.png',1536,1275],['compare.png',1040,380],['demo-1x.png',480,270],['mosaic-1x.png',960,540]]){const t=decodePng(resolve(REC,name));assert.deepEqual([t.w,t.h],[w,h]);}
for(const [f,hash] of Object.entries(run1))console.log(`MD5 BOTH ${f} ${hash}`);
writeFileSync(resolve(REC,'verification.json'),JSON.stringify({pass:true,deterministic:run1,oldTerrain:after,metrics:{partialAlpha:semi,highSaturationPixels:high,opaquePixels:opaque,tileMax,fenceMax,frames:Object.keys(cut).length}},null,2)+'\n');
console.log('CHECK PASS bamboofloor: deterministic 12/12; old terrain 16/16; alpha=0; saturation<=1%; leaflitter seams<=4; fence seams<=4; preview dimensions valid');
