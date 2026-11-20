import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {encodePng} from '../../png.mjs';
import {ROOT,OUT,RECORDS,MATERIALS,load,canvas,blit,crop,mean,luma,mosaic,pixel} from './lib.mjs';
try {
mkdirSync(RECORDS,{recursive:true});
const manifest=JSON.parse(readFileSync(resolve(OUT,'terrain.json'),'utf8'));
assert.equal(manifest.tile,128);assert.deepEqual(Object.keys(manifest.materials),MATERIALS);
const files=[...MATERIALS.flatMap(m=>manifest.materials[m]),'terrain.json'];
const hashes=()=>Object.fromEntries(files.map(f=>[f,createHash('md5').update(readFileSync(resolve(OUT,f))).digest('hex')]));
const first=hashes();
const log=execFileSync(process.execPath,['tools/assetgen/terrain/gen.mjs'],{cwd:ROOT,encoding:'utf8',timeout:60000});
writeFileSync(resolve(RECORDS,'gen-second.log'),log,'utf8');
const second=hashes();assert.deepEqual(first,second);
for(const f of files)console.log(`MD5 ${f} run1=${first[f]} run2=${second[f]} PASS`);
const ground=load('public/assets/sect/ground_bake.png'),samples={grass:crop(ground,[140,24,148,260]),dirt:crop(ground,[246,978,60,45])};
const targets=Object.fromEntries(Object.entries(samples).map(([k,v])=>[k,mean(v)]));
const images={},report={targets,hashesRun1:first,hashesRun2:second,materials:{}};
const errors=[];
const requireCheck=(ok,msg)=>{console.log(`${msg} ${ok?'PASS':'FAIL'}`);if(!ok)errors.push(msg);};
function repeat(im){const v=new Float64Array(im.w*im.h);let avg=0;for(let i=0;i<v.length;i++){v[i]=luma(im.data.subarray(i*4,i*4+3));avg+=v[i]/v.length;}for(let i=0;i<v.length;i++)v[i]-=avg;const results=[];for(const axis of ['x','y'])for(let lag=32;lag<=160;lag++){const phase=lag%128;if(phase<=8||phase>=120)continue;let ab=0,aa=0,bb=0;const W=im.w-(axis==='x'?lag:0),H=im.h-(axis==='y'?lag:0),off=axis==='x'?lag:lag*im.w;for(let y=0;y<H;y++)for(let x=0;x<W;x++){const p=y*im.w+x,a=v[p],b=v[p+off];ab+=a*b;aa+=a*a;bb+=b*b;}results.push({axis,lag,corr:ab/Math.sqrt(aa*bb)});}return results.sort((a,b)=>Math.abs(b.corr)-Math.abs(a.corr))[0];}
// Source-pixel membership replaces v1's procedural palette requirement: the new
// brief explicitly requires original pixels, whose ramp has many more shades.
const sourceColors=new Set();for(let p=0;p<samples.grass.data.length;p+=4)sourceColors.add(samples.grass.data.subarray(p,p+3).toString('hex'));
const sheet=canvas(1600,3936),atlas=load('public/assets/sect/sect_atlas.png'),dao=load('public/assets/dao_si.png');
const frames=JSON.parse(readFileSync(resolve(ROOT,'public/assets/sect/sect_atlas.json'),'utf8')).frames;
let joins=0;
for(let m=0;m<4;m++){
 const mat=MATERIALS[m],ims=manifest.materials[mat].map(f=>load(`public/assets/terrain/${f}`));images[mat]=ims;const means=[];
 for(let i=0;i<4;i++){
  const im=ims[i];assert.equal(im.w,128);assert.equal(im.h,128);for(let p=3;p<im.data.length;p+=4)assert.equal(im.data[p],255);
  means.push(mean(im));if(targets[mat]){const delta=means[i].map((v,c)=>Math.abs(v-targets[mat][c]));requireCheck(Math.max(...delta)<=6,`COLOR ${mat}_${i} delta=${delta.map(v=>v.toFixed(2))}`);}
  if(mat==='grass'){let count=0,flowers=0;for(let p=0;p<im.data.length;p+=4){if(sourceColors.has(im.data.subarray(p,p+3).toString('hex')))count++;if(im.data[p]===148&&im.data[p+1]===158)flowers++;}requireCheck(count===16384,`SOURCE grass_${i} original=${count}/16384`);requireCheck(flowers/16384<=.003,`FLOWERS grass_${i} count=${flowers}`);}
  if(mat==='dirt'){let green=0,edgeGrass=0;for(let y=0;y<128;y++)for(let x=0;x<128;x++){const c=pixel(im,x,y);if(c[1]>c[0]+4){green++;if(x<16||x>=112||y<16||y>=112)edgeGrass++;}}requireCheck(green/16384<=.03&&edgeGrass===0,`DIRT ${i} grass=${green}/16384 edge_grass=${edgeGrass}`);}
  for(let y=0;y<128;y++)for(let x=0;x<128;x++)if(x<8||x>=120||y<8||y>=120)assert.deepEqual(pixel(im,x,y),pixel(ims[0],x,y));
 }
 for(let a=0;a<4;a++)for(let b=0;b<4;b++){
  let lr=0,tb=0;for(let k=0;k<128;k++)for(let c=0;c<3;c++){lr+=Math.abs(pixel(ims[a],127,k)[c]-pixel(ims[b],0,k)[c]);tb+=Math.abs(pixel(ims[a],k,127)[c]-pixel(ims[b],k,0)[c]);}requireCheck(lr===0&&tb===0,`JOIN ${mat} ${a}|${b} LR=${lr/384} TB=${tb/384}`);joins++;
 }
 for(let c=0;c<3;c++)requireCheck(Math.max(...means.map(v=>v[c]))-Math.min(...means.map(v=>v[c]))<=4,`VARIANT ${mat} channel=${c}`);
 assert.equal(new Set(manifest.materials[mat].map(f=>first[f])).size,4);
 const tiling=mosaic(ims,8231+m);encodePng(tiling,resolve(RECORDS,`${mat}-960x540.png`));const repetition=repeat(tiling);
 requireCheck(Math.abs(repetition.corr)<=.25,`REPEAT ${mat} ${repetition.axis} lag=${repetition.lag} max=${Math.abs(repetition.corr).toFixed(4)}`);
 report.materials[mat]={means,repetition};
 const y0=m*984+24;blit(sheet,tiling,16,y0);blit(sheet,dao,976,y0+8,3,[0,0,64,64]);for(const [key,dx,dy] of [['rock_a',992,230],['pine_a',1120,20]]){const f=frames[key].frame;blit(sheet,atlas,dx,y0+dy,3,[f.x,f.y,f.w,f.h]);}for(let i=0;i<4;i++)blit(sheet,ims[i],16+i*392,y0+564,3);
}
const avg=m=>report.materials[m].means.reduce((s,a)=>s.map((v,c)=>v+a[c]/4),[0,0,0]);
const darkness=1-luma(avg('forest'))/luma(avg('grass'));requireCheck(Math.abs(darkness-.30)<=.05,`FOREST darker=${(darkness*100).toFixed(2)}%`);
// Four 240x128 panels at 2x, in the exact requested old/new grass, old/new dirt order.
const compare=canvas(1920,256),oldPanel=(s)=>{const o=canvas(240,128);for(let y=0;y<128;y++)for(let x=0;x<240;x++)o.data.set(pixel(s,x%s.w,y%s.h),(y*240+x)*4);return o;};
blit(compare,oldPanel(samples.grass),0,0,2);blit(compare,mosaic(images.grass,321,240,128),480,0,2);blit(compare,oldPanel(samples.dirt),960,0,2);blit(compare,mosaic(images.dirt,321,240,128),1440,0,2);
encodePng(compare,resolve(RECORDS,'compare.png'));encodePng(sheet,resolve(RECORDS,'sheet.png'));
writeFileSync(resolve(RECORDS,'check.json'),JSON.stringify({...report,forestDarkness:darkness,errors},null,2)+'\n','utf8');
if(errors.length){console.log(`FAIL terrain: ${errors.length} checks failed`);process.exitCode=1;} else
console.log(`PASS terrain: 16/16 tiles; ${joins} ordered joins; shared 8px; RGB delta <=6; repeat <=0.25; MD5 17/17; compare 1920x256; sheet 1600x3936`);

} catch (error) {
 console.log(`FAIL terrain: ${error.message}`);
 process.exitCode=1;
}
