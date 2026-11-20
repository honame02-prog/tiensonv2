// AG2d artifact regression audit, independent of generator geometry.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { decodePng } from '../../png.mjs';
const baseline=decodePng(execFileSync('git',['show','codex/AG2c:public/assets/cliff/cliff_atlas.png']));
const oldMeta=JSON.parse(execFileSync('git',['show','codex/AG2c:public/assets/cliff/cliff_atlas.json'],{encoding:'utf8'}));
const actual=decodePng('public/assets/cliff/cliff_atlas.png');
const meta=JSON.parse(readFileSync('public/assets/cliff/cliff_atlas.json','utf8'));
const crop=(im,f)=>Buffer.concat(Array.from({length:f.h},(_,y)=>im.data.subarray(((f.y+y)*im.w+f.x)*4,((f.y+y)*im.w+f.x+f.w)*4)));
let preserved=0;
const north=[];
for(const [name,item] of Object.entries(meta.frames)){
 const data=crop(actual,item.frame);
 if(/^cliff_n_[0-3]$/.test(name)){
  assert(!data.equals(crop(baseline,oldMeta.frames[name].frame)),`${name} was not changed`);
  north.push(data);
 }else{
  assert.deepEqual(item,oldMeta.frames[name],`${name} frame metadata changed`);
  assert(data.equals(crop(baseline,oldMeta.frames[name].frame)),`${name} pixels changed`);
  preserved++;
 }
}
assert.equal(preserved,16);
let minDiff=1;
for(let a=0;a<4;a++)for(let b=a+1;b<4;b++){
 let diff=0,total=0;
 for(let y=20;y<76;y++)for(let x=2;x<62;x++){
  const p=(y*64+x)*4;total++;
  if(!north[a].subarray(p,p+4).equals(north[b].subarray(p,p+4)))diff++;
 }
 minDiff=Math.min(minDiff,diff/total);
}
assert(minDiff>.35,'North variants too similar');
let periods=0;
for(let shift=1;shift<=64;shift++){
 let identical=true;
 for(let x=0;x<256-shift&&identical;x++)for(let y=20;y<76;y++){
  const a=(y*64+x%64)*4,b=(y*64+(x+shift)%64)*4;
  if(!north[Math.floor(x/64)].subarray(a,a+4).equals(north[Math.floor((x+shift)/64)].subarray(b,b+4))){identical=false;break;}
 }
 if(identical)periods++;
}
assert.equal(periods,0,'North strip has an exact period <=64px');
console.log(`PASS AG2d preserved=${preserved}/16 north_changed=4/4 min_pair_pixel_difference=${(minDiff*100).toFixed(1)}% exact_periods_1..64=${periods}`);
