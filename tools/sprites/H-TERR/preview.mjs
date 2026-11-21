import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { validateKit, resolveKitPieces } from '../../../src/areaKits.js';
import { decodePng } from '../../png.mjs';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'../../..');
process.chdir(root);
const rec=resolve(root,'records/S1-TERR4'); mkdirSync(rec,{recursive:true});
process.env.CHROME_LOG_FILE=resolve(rec,'chromium.log');
const { chromium }=await import('../../area_tool_runtime.mjs');
const json=p=>JSON.parse(readFileSync(p,'utf8'));
const data=p=>'data:image/png;base64,'+readFileSync(p).toString('base64');
const kits={},textures={};
for(const id of ['H-TERR','H-STAIR']){
 const base=`public/assets/kits/${id}/`;
 kits[id]=validateKit(id,json(base+'kit.json'));
 for(const [name,p] of Object.entries(kits[id].pieces)) textures[id+'/'+name]=data(base+p.file);
}
const placements=resolveKitPieces({kits:{'H-TERR':'x','H-STAIR':'y'},pieces:json(rec+'/placements.json')},kits);
const frames=json('public/assets/dao_si.json').frames;
const frame=frames.find(f=>f.filename==='dao_si_idle_down_00').frame;
const actor=data('public/assets/dao_si.png');
const concept=data('D:/SkillFX_TuThienChi_HoaLien/design/tienson/hvq-scene/C/V1.png');
// Chromium may create debug.log in its cwd; contain all generated logs.
process.chdir(rec);
const browser=await chromium.launch({headless:true});
const errors=[];
try{
 const page=await browser.newPage({viewport:{width:480,height:270},deviceScaleFactor:1});
 page.on('pageerror',e=>errors.push(String(e)));
 await page.setContent('<style>body{margin:0}canvas{image-rendering:pixelated}</style><canvas width="480" height="270"></canvas>');
 await page.evaluate(async({textures,placements,actor,concept,frame})=>{
  const load=url=>new Promise((ok,no)=>{const im=new Image();im.onload=()=>ok(im);im.onerror=no;im.src=url;});
  const imgs={}; for(const [key,url] of Object.entries(textures)) imgs[key]=await load(url);
  const c=document.querySelector('canvas').getContext('2d');c.imageSmoothingEnabled=false;
  const floor=await load(concept);
  for(let y=0;y<270;y+=110)for(let x=0;x<480;x+=260)c.drawImage(floor,215,28,260,110,x,y,260,110);
  for(const p of placements)c.drawImage(imgs[p.k],p.x-p.piece.anchor[0],p.y-p.piece.anchor[1]);
  const atlas=await load(actor);
  for(const [x,y] of [[220,132],[362,205]])c.drawImage(atlas,frame.x,frame.y,64,64,x-32,y-61,64,64);
 },{textures,placements,actor,concept,frame});
 await page.locator('canvas').screenshot({path:rec+'/runtime-1x.png'});
 assert.equal(errors.length,0,errors.join('\n'));
 const actual=decodePng(rec+'/runtime-1x.png'),expected=decodePng(rec+'/assembly-frame.png');
 assert.equal(actual.w,480);assert.equal(actual.h,270);
 let mismatch=0;for(let i=0;i<actual.data.length;i+=4){if(!actual.data.subarray(i,i+4).equals(expected.data.subarray(i,i+4)))mismatch++;}
 assert.equal(mismatch,0,'browser/Pillow mismatch');
 const line=`PASS browser H-TERR=13 H-STAIR=${Object.keys(kits['H-STAIR'].pieces).length} placements=${placements.length} frame=480x270 pixel-mismatch=${mismatch} page-errors=${errors.length}`;
 console.log(line);writeFileSync(rec+'/runtime.log',line+'\n');
}finally{await browser.close();process.chdir(root);}
