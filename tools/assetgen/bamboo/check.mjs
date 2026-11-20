import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { decodePng } from '../../png.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../../..');
const out=path.join(root,'public/assets/bamboo'),rec=path.join(root,'records/assetgen/bamboo');
const read=f=>JSON.parse(readFileSync(f,'utf8'));
const atlas=decodePng(path.join(out,'bamboo_atlas.png')),meta=read(path.join(out,'bamboo_atlas.json')),info=read(path.join(out,'bamboo_sprites.json')),audit=read(path.join(rec,'brush-audit.json'));
const expected=[...Array.from({length:6},(_,i)=>`bamboo_stem_${i}`),...Array.from({length:6},(_,i)=>`bamboo_leaf_${i}`),...Array.from({length:3},(_,i)=>`bamboo_clump_${i}`)];
assert.deepEqual(Object.keys(meta.frames).sort(),expected.slice().sort());assert.deepEqual(Object.keys(info.sprites).sort(),expected.slice().sort());
assert(atlas.w<=2048&&atlas.h<=2048);assert.deepEqual(meta.meta.size,{w:atlas.w,h:atlas.h});
const palette=new Set(Object.values(info.palette).flat().map(c=>c.join(','))),rects=[];
let semi=0,sat=0,total=0;
for(const name of expected){
  const f=meta.frames[name].frame,entry=meta.frames[name],s=info.sprites[name];
  assert.equal(entry.rotated,false);assert.equal(entry.trimmed,false);
  assert.deepEqual(entry.sourceSize,{w:f.w,h:f.h});assert.deepEqual(entry.spriteSourceSize,{x:0,y:0,w:f.w,h:f.h});
  assert.equal(s.w,f.w);assert.equal(s.h,f.h);assert.deepEqual(s.pivot,[.5,1]);
  assert(f.x>=2&&f.y>=2&&f.x+f.w<atlas.w&&f.y+f.h<atlas.h);
  for(const r of rects)assert(f.x+f.w+2<=r.x||r.x+r.w+2<=f.x||f.y+f.h+2<=r.y||r.y+r.h+2<=f.y,'overlapping frames');rects.push(f);
  let n=0,partial=0,saturated=0,bottom=0;
  for(let y=0;y<f.h;y++)for(let x=0;x<f.w;x++){
    const p=((y+f.y)*atlas.w+x+f.x)*4,a=atlas.data[p+3];if(!a)continue;
    n++;if(a!==255)partial++;if(y===f.h-1)bottom++;
    const c=[...atlas.data.subarray(p,p+3)],hi=Math.max(...c),lo=Math.min(...c);
    if(hi&&(hi-lo)/hi>.35)saturated++;
    assert(palette.has(c.join(',')),`${name}: unlisted paint`);assert(hi<=217,`${name}: overbright`);
  }
  assert(n>0);assert(bottom>0,`${name}: no bottom contact`);assert.equal(partial,0);assert(saturated/n<=.01);
  total+=n;semi+=partial;sat+=saturated;
  if(name.includes('stem')){
    const a=audit.stems[name];assert(a.count>=2&&a.count<=5);assert(s.foot[0]>=8&&s.foot[0]<=14);assert.equal(s.foot[1],6);
    for(const st of a.stems){assert(st.width>=3&&st.width<=6);assert(st.height>=90&&st.height<=150);assert(Math.abs(st.leanDegrees)<=6);assert(st.nodeSpacing>=10&&st.nodeSpacing<=18);}
    const layer=info.layers[name];assert.equal(layer.base,name);assert(layer.clusters.length>0);
    for(const c of layer.clusters){assert(expected.includes(c.name));assert(c.cy>=c.y&&c.cy<=c.y+c.h);assert.equal(c.w,info.sprites[c.name].w);assert.equal(c.h,info.sprites[c.name].h);}
  }
  if(name.includes('leaf')){assert(f.w>=40&&f.w<=90,`${name}: width ${f.w}`);assert.equal(s.role,'overhead');assert.deepEqual(s.foot,[0,0]);}
  if(name.includes('clump'))assert(f.h>=40&&f.h<=64,`${name}: height ${f.h}`);
  console.log(`SPRITE ${name} ${f.w}x${f.h} alphaPartial=${partial} saturation=${(saturated/n*100).toFixed(3)}%`);
}
assert.equal(audit.flipX,false);assert.equal(info.flipX,false);
for(const [name,w,h] of [['sheet.png',1560,1260],['compare.png',1080,390],['demo-1x.png',480,270]]){const im=decodePng(path.join(rec,name));assert.equal(im.w,w);assert.equal(im.h,h);}
const hash=createHash('md5');for(const f of ['bamboo_atlas.png','bamboo_atlas.json','bamboo_sprites.json'])hash.update(readFileSync(path.join(out,f)));
console.log(`PASS bamboo sprites=${expected.length} partialAlpha=${semi} saturation=${(sat/total*100).toFixed(3)}% layers=${Object.keys(info.layers).length} demo=480x270 package_md5=${hash.digest('hex')}`);
