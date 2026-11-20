import { straightEdges } from './outline.mjs';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { decodePng } from '../../png.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../../..');
const dir=path.join(root,'public/assets/forest');
const png=readFileSync(path.join(dir,'forest_atlas.png')),atlas=decodePng(png);
const json=JSON.parse(readFileSync(path.join(dir,'forest_atlas.json'),'utf8'));
const info=JSON.parse(readFileSync(path.join(dir,'forest_sprites.json'),'utf8'));
const sect=decodePng(path.join(root,'public/assets/sect/sect_atlas.png'));
const refs=JSON.parse(readFileSync(path.join(root,'public/assets/sect/sect_atlas.json'),'utf8'));
function stats(im,f) {
  let n=0,semi=0,sat=0,luma=0,bottom=0,top=0,left=0,right=0;
  for(let y=0;y<f.h;y++)for(let x=0;x<f.w;x++){
    const i=((f.y+y)*im.w+f.x+x)*4,a=im.data[i+3];
    if(!a)continue;
    n++;if(a!==255)semi++;
    const r=im.data[i],g=im.data[i+1],b=im.data[i+2],hi=Math.max(r,g,b),lo=Math.min(r,g,b);
    if(hi&&(hi-lo)/hi>.35)sat++;
    luma+=r*.2126+g*.7152+b*.0722;
    if(y===f.h-1)bottom++;if(y===0)top++;if(x===0)left++;if(x===f.w-1)right++;
  }
  assert(n>0,'empty image');return{n,semi,sat,luma:luma/n,bottom,top,left,right};
}
const reference=stats(sect,refs.frames.pine_b_f0.frame).luma;
const expected=[...Array.from({length:6},(_,i)=>`canopy_${i}`),...Array.from({length:2},(_,i)=>`trunkrow_${i}`),...Array.from({length:4},(_,i)=>`bush_${i}`),...Array.from({length:4},(_,i)=>`tallgrass_${i}`)];
assert.deepEqual(Object.keys(json.frames).sort(),expected.slice().sort());
assert.deepEqual(Object.keys(info.sprites).sort(),expected.slice().sort());
assert(atlas.w<=2048&&atlas.h<=2048);assert.deepEqual(json.meta.size,{w:atlas.w,h:atlas.h});
const palette=new Set(Object.values(info.palette).flat().map(c=>c.join(',')));
let total=0,saturated=0,semi=0,maxDelta=0;
const rects=[];
for(const name of expected){
  const entry=json.frames[name],f=entry.frame,s=info.sprites[name];
  assert.equal(entry.rotated,false);assert.equal(entry.trimmed,false);
  assert.deepEqual(entry.sourceSize,{w:f.w,h:f.h});assert.deepEqual(entry.spriteSourceSize,{x:0,y:0,w:f.w,h:f.h});
  assert.deepEqual(entry.pivot,{x:.5,y:1});assert.deepEqual(s.pivot,[.5,1]);assert.deepEqual(s.foot,[0,0]);
  assert.equal(s.w,f.w);assert.equal(s.h,f.h);
  assert(f.x>=2&&f.y>=2&&f.x+f.w<atlas.w&&f.y+f.h<atlas.h);
  for(const r of rects)assert(f.x+f.w+2<=r.x||r.x+r.w+2<=f.x||f.y+f.h+2<=r.y||r.y+r.h+2<=f.y,`${name}: padding/overlap`);
  rects.push(f);
  if(name.startsWith('canopy')){assert(f.w>=96&&f.w<=160&&f.h>=80&&f.h<=120);assert.equal(s.role,'overhead');assert.equal(info.layers[name].top,name);assert.equal(info.layers[name].base,null);}
  if(name.startsWith('trunkrow'))assert(f.w===128&&f.h===40);
  if(name.startsWith('bush'))assert(f.w>=32&&f.w<=56&&f.h>=20&&f.h<=32);
  if(name.startsWith('tallgrass'))assert(f.w>=16&&f.w<=24&&f.h>=16&&f.h<=24);
  if(name.startsWith('canopy')){
    const im={w:f.w,h:f.h,data:Buffer.alloc(f.w*f.h*4)};
    for(let y=0;y<f.h;y++)atlas.data.copy(im.data,y*f.w*4,((f.y+y)*atlas.w+f.x)*4,((f.y+y)*atlas.w+f.x+f.w)*4);
    const runs=straightEdges(im);assert.equal(runs.length,0,`${name}: long exterior edge ${JSON.stringify(runs)}`);
    console.log(`EDGE ${name} exteriorRuns>6=${runs.length}`);
  }
  if(name.startsWith('trunkrow')){
    const connected=new Uint8Array(f.w*f.h),queue=[];
    const add=(x,y)=>{const i=y*f.w+x;if(!connected[i]&&atlas.data[((f.y+y)*atlas.w+f.x+x)*4+3]===255){connected[i]=1;queue.push(i);}};
    for(let x=0;x<f.w;x++)add(x,f.h-1);
    for(let k=0;k<queue.length;k++){const i=queue[k],x=i%f.w,y=Math.floor(i/f.w);if(x)add(x-1,y);if(x+1<f.w)add(x+1,y);if(y)add(x,y-1);if(y+1<f.h)add(x,y+1);}
    let stems=0;
    for(let x=0;x<f.w;x++)if(atlas.data[(f.y*atlas.w+f.x+x)*4+3]===255){stems++;assert(connected[x],`${name}: upper bark disconnected from ground at x=${x}`);}
    assert(stems>0);console.log(`TRUNK ${name} topToBottom=true upperPixels=${stems}`);
  }
  const t=stats(atlas,f);total+=t.n;saturated+=t.sat;semi+=t.semi;
  assert(t.bottom>0,`${name}: no bottom contact`);
  for(let y=f.y;y<f.y+f.h;y++)for(let x=f.x;x<f.x+f.w;x++){
    const p=(y*atlas.w+x)*4;if(!atlas.data[p+3])continue;
    assert(palette.has([...atlas.data.subarray(p,p+3)].join(',')),`${name}: off-palette paint`);
  }
  const delta=Math.abs(t.luma/reference-1)*100;
  if(name.startsWith('canopy'))maxDelta=Math.max(maxDelta,delta);
  console.log(`${name} ${f.w}x${f.h} S>.35=${(t.sat/t.n*100).toFixed(3)}% semi=${t.semi} luma=${t.luma.toFixed(3)}${name.startsWith('canopy')?` delta=${delta.toFixed(3)}%`:''}`);
  assert(t.sat/t.n<=.01,`${name}: saturation >1%`);assert.equal(t.semi,0,`${name}: partial alpha`);
  if(name.startsWith('canopy'))assert(delta<=10,`${name}: luminance delta ${delta.toFixed(3)}% >10%`);
}
const sheet=decodePng(path.join(root,'records/assetgen/forest/sheet.png'));
const demo=decodePng(path.join(root,'records/assetgen/forest/demo-1x.png'));
assert(sheet.w>=1440&&sheet.h>=1200);assert.equal(demo.w,480);assert.equal(demo.h,200);
const files=['forest_atlas.png','forest_atlas.json','forest_sprites.json'];
const digest=createHash('md5');for(const f of files)digest.update(readFileSync(path.join(dir,f)));
const md5=createHash('md5').update(png).digest('hex');
console.log(`PASS forest frames=${expected.length} saturation=${(saturated/total*100).toFixed(3)}% partialAlpha=${semi} pine_b_f0=${reference.toFixed(3)} maxCanopyDelta=${maxDelta.toFixed(3)}% atlas_md5=${md5} package_md5=${digest.digest('hex')}`);
