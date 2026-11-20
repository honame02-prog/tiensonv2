// Independent artifact checks. No npm; every variant pair is tested in RGBA.
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { decodePng } from '../../png.mjs';

const ROOT=resolve(dirname(fileURLToPath(import.meta.url)),'../../..');
const OUT=resolve(ROOT,'public/assets/cliff'), REC=resolve(ROOT,'records/assetgen/cliff');
const artifacts=['public/assets/cliff/cliff_atlas.png','public/assets/cliff/cliff_atlas.json','public/assets/cliff/cliff_sprites.json','records/assetgen/cliff/sheet.png','records/assetgen/cliff/map_1x.png','records/assetgen/cliff/compare.png'];
const md5=p=>createHash('md5').update(readFileSync(resolve(ROOT,p))).digest('hex');
const runs=[];
for(let i=0;i<2;i++) {
  const result=spawnSync(process.execPath,[resolve(ROOT,'tools/assetgen/cliff/gen.mjs')],{cwd:ROOT,encoding:'utf8',timeout:60000});
  assert.equal(result.status,0,result.stderr||String(result.error));
  runs.push(Object.fromEntries(artifacts.map(p=>[p,md5(p)])));
  console.log(`RUN${i+1} atlas_md5=${runs[i][artifacts[0]]}`);
}
assert.deepEqual(runs[0],runs[1],'Generation is not byte reproducible');
for(const p of artifacts)console.log(`MD5 ${p} ${runs[0][p]} repeat=identical`);
const atlas=decodePng(resolve(OUT,'cliff_atlas.png'));
const meta=JSON.parse(readFileSync(resolve(OUT,'cliff_atlas.json'),'utf8'));
const info=JSON.parse(readFileSync(resolve(OUT,'cliff_sprites.json'),'utf8'));
assert.equal(Object.keys(meta.frames).length,20);
assert.equal(Object.keys(info.sprites).length,20);
assert.deepEqual(info.tileable,{n:{w:64},s:{w:64},w:{h:64},e:{h:64}});
assert.equal(meta.meta.image,'cliff_atlas.png');
assert.deepEqual(meta.meta.size,{w:atlas.w,h:atlas.h});
assert(atlas.w<=2048&&atlas.h<=2048);
const px=(f,x,y)=>[...atlas.data.subarray(((f.y+y)*atlas.w+f.x+x)*4,((f.y+y)*atlas.w+f.x+x)*4+4)];
const expected={};
for(const [dir,count,w,h] of [['n',4,64,84],['s',3,64,28],['w',3,40,64],['e',3,40,64]])for(let i=0;i<count;i++)expected[`cliff_${dir}_${i}`]=[w,h];
for(const d of ['nw','ne'])expected[`cliff_${d}`]=[40,84];
for(const d of ['sw','se'])expected[`cliff_${d}`]=[40,28];
for(const [i,w,h] of [[0,56,53],[1,68,60],[2,48,43]])expected[`boulder_${i}`]=[w,h];
const occupied=new Set();let opaque=0,semi=0,saturated=0;
const palette=new Set(['181010','24241f','34342f','3d3b38','48453f','54504c','69635e','8b8480','27332d','364636','46583f','576948','697a52','7d8b5d','949e6e']);
for(const [name,size] of Object.entries(expected)) {
  const m=meta.frames[name];assert(m,`Missing ${name}`);const f=m.frame,s=info.sprites[name];
  assert.deepEqual([f.w,f.h],size,`${name} dimensions`);
  assert.deepEqual([s.w,s.h],size,`${name} metadata`);
  assert.deepEqual(s.pivot,[.5,1]);assert.deepEqual(m.pivot,{x:.5,y:1});
  assert.deepEqual(m.sourceSize,{w:f.w,h:f.h});assert.equal(m.rotated,false);assert.equal(m.trimmed,false);
  assert.deepEqual(m.spriteSourceSize,{x:0,y:0,w:f.w,h:f.h});
  assert(s.foot.length===2&&s.foot[0]>0&&s.foot[0]<=f.w&&s.foot[1]>0&&s.foot[1]<=f.h);
  assert(f.x>=2&&f.y>=2&&f.x+f.w<=atlas.w-2&&f.y+f.h<=atlas.h-2);
  let footPixels=0,count=0;
  for(let y=0;y<f.h;y++)for(let x=0;x<f.w;x++) {
    const key=(f.y+y)*atlas.w+f.x+x;assert(!occupied.has(key),'Overlapping atlas frames');occupied.add(key);
    const c=px(f,x,y),a=c[3];if(a>0&&a<255)semi++;
    if(!a)continue;opaque++;count++;if(y===f.h-1)footPixels++;
    const high=Math.max(...c.slice(0,3)),low=Math.min(...c.slice(0,3));if(high&&(high-low)/high>.35)saturated++;
    assert(palette.has(c.slice(0,3).map(v=>v.toString(16).padStart(2,'0')).join('')),`${name} unapproved palette`);
  }
  assert(count>0,`${name} is empty`);assert(footPixels>0,`${name} does not touch bottom pivot`);
}
// Atlas padding must stay transparent (no extrusion spilling into adjacent frames).
for(let i=0;i<atlas.w*atlas.h;i++)if(!occupied.has(i))assert.equal(atlas.data[i*4+3],0,'Dirty padding');
let pairs=0,topDelta=0,colorDelta=0,alphaDelta=0;
for(const [dir,count] of [['n',4],['s',3],['w',3],['e',3]]) {
  let dirColor=0,dirAlpha=0;
  for(let a=0;a<count;a++)for(let b=0;b<count;b++) {
    const f=meta.frames[`cliff_${dir}_${a}`].frame,g=meta.frames[`cliff_${dir}_${b}`].frame;
    const horizontal=dir==='n'||dir==='s',len=horizontal?f.h:f.w;
    for(let k=0;k<len;k++) {
      const left=horizontal?px(f,f.w-1,k):px(f,k,f.h-1),right=horizontal?px(g,0,k):px(g,k,0);
      dirAlpha=Math.max(dirAlpha,Math.abs(left[3]-right[3]));
      if(left[3]&&right[3])for(let c=0;c<3;c++)dirColor=Math.max(dirColor,Math.abs(left[c]-right[c]));
    }
    if(dir==='n') {
      const first=(fr,x)=>{for(let y=0;y<fr.h;y++)if(px(fr,x,y)[3])return y;return fr.h;};
      topDelta=Math.max(topDelta,Math.abs(first(f,63)-first(g,0)));
    }
    pairs++;
  }
  colorDelta=Math.max(colorDelta,dirColor);alphaDelta=Math.max(alphaDelta,dirAlpha);
  console.log(`SEAM ${dir} pairs=${count*count} max_rgb_delta=${dirColor} max_alpha_delta=${dirAlpha}`);
}
assert(topDelta<=1,'North ridge displacement >1px');assert.equal(colorDelta,0,'Color jump at tile boundary');assert.equal(alphaDelta,0,'Alpha gap at tile boundary');
const luminance=dir=>{let sum=0,count=0;for(let i=0;i<3;i++){const f=meta.frames[`cliff_${dir}_${i}`].frame;for(let y=0;y<f.h;y++)for(let x=0;x<f.w;x++){const p=px(f,x,y);if(p[3]){sum+=.2126*p[0]+.7152*p[1]+.0722*p[2];count++;}}}return sum/count;};
const west=luminance('w'),east=luminance('e');assert(east>west,'East-facing-left wall should be brighter than west-facing-right wall');
const map=decodePng(resolve(REC,'map_1x.png')),sheet=decodePng(resolve(REC,'sheet.png'));
assert.deepEqual([map.w,map.h],[320,240]);assert.deepEqual([sheet.w,sheet.h],[1200,1600]);
// Preview is also a reproducible artifact and must include the complete map at 2x.
const compare=decodePng(resolve(REC,'compare.png'));assert.deepEqual([compare.w,compare.h],[960,540]);
let minRidge=84,maxRidge=0;
for(let i=0;i<4;i++){
 const f=meta.frames[`cliff_n_${i}`].frame;
 for(let x=1;x<63;x++){let top=0;while(top<f.h&&!px(f,x,top)[3])top++;minRidge=Math.min(minRidge,top);maxRidge=Math.max(maxRidge,top);}
 assert.equal(px(f,0,11)[3],0);assert.equal(px(f,0,12)[3],255,'Shared ridge must have 72px height');
}
assert(maxRidge-minRidge>=10,'Ridge is too flat across variants');
assert(minRidge>=0&&maxRidge<=20,'North silhouette heights must stay within 64..84px');
console.log(`RIDGE envelope=${minRidge}..${maxRidge}px shared_height=72px compare=960x540`);
assert.equal(semi,0);assert(saturated/opaque<=.01);
const report={sprites:20,pairs,topDelta,colorDelta,alphaDelta,opaque,semi,saturated,saturationPercent:saturated/opaque*100,westLuminance:west,eastLuminance:east,md5:runs[0]};
writeFileSync(resolve(REC,'check.json'),JSON.stringify(report,null,2)+'\n','utf8');
console.log(`LIGHT west=${west.toFixed(2)} east=${east.toFixed(2)}`);
console.log(`PASS sprites=20 pairs=${pairs} ridge_delta=${topDelta}px edge_rgb_delta=${colorDelta} semi_alpha=${(semi/opaque*100).toFixed(3)}% saturation_gt_0.35=${(saturated/opaque*100).toFixed(3)}% deterministic=2/2`);
