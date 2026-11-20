import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { decodePng, encodePng } from '../../png.mjs';
import { makeBrushes } from './stamps.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const out = path.join(root, 'public/assets/forest');
const records = path.join(root, 'records/assetgen/forest');
mkdirSync(out, { recursive: true }); mkdirSync(records, { recursive: true });
const rgb = hex => hex.match(/../g).map(x => parseInt(x, 16));
// Fixed STYLE section 5 ramps, projected to its S<=.35 gamut by raising only
// channels below ceil(max*.65). No interpolated paint or RGB noise is used.
const gamut = c => c.map(v => Math.max(v, Math.ceil(Math.max(...c) * .65)));
const ramp = s => s.split(' ').map(c => gamut(rgb(c)));
const palettes = {
  cold: ramp('0a110d 16221c 212e27 2b3830 39473d 48574b 667063'),
  olive: ramp('201c0c 322e15 3b371a 44402a 524e33 625e3e 7d765c'),
  wood: ramp('0e0c08 211c15 2a251d 342e24 413a30 4f473b 7b7062'),
  fern: ramp('191a0f 30301f 3b3c24 474731 515234 5f5f42 8e8e6f'),
};
const rng = seed => () => { let t = seed += 0x6d2b79f5; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; };
const canvas = (w, h, color) => { const im = { w, h, data: Buffer.alloc(w*h*4) }; if (color) for (let p=0;p<im.data.length;p+=4) im.data.set([...color,255],p); return im; };
function pixel(im,x,y,c) { x=Math.round(x); y=Math.round(y); if(x>=0&&y>=0&&x<im.w&&y<im.h) im.data.set([...c,255],(y*im.w+x)*4); }
function blit(dst,src,dx,dy,scale=1) { for(let y=0;y<src.h;y++)for(let x=0;x<src.w;x++){const p=(y*src.w+x)*4;if(!src.data[p+3])continue;for(let yy=0;yy<scale;yy++)for(let xx=0;xx<scale;xx++)pixel(dst,dx+x*scale+xx,dy+y*scale+yy,[...src.data.subarray(p,p+3)]);} }
function crop(im,f) { const o=canvas(f.w,f.h);for(let y=0;y<f.h;y++)im.data.copy(o.data,y*f.w*4,((f.y+y)*im.w+f.x)*4,((f.y+y)*im.w+f.x+f.w)*4);return o; }
const source = decodePng(path.join(root,'public/assets/sect/sect_atlas.png'));
const sourceFrames = JSON.parse(readFileSync(path.join(root,'public/assets/sect/sect_atlas.json'),'utf8')).frames;
const ref = name => crop(source,sourceFrames[name].frame);
const dao = crop(decodePng(path.join(root,'public/assets/dao_si.png')),{x:0,y:0,w:64,h:64});

const decalImage=decodePng(path.join(root,'public/assets/sect/decals.png'));
const decalFrames=JSON.parse(readFileSync(path.join(root,'public/assets/sect/decals.json'),'utf8')).frames;
const decal=name=>crop(decalImage,decalFrames[name].frame);
const {canopy,trunkrow,bush,grass,used,audit}=makeBrushes({ref,decal,canvas,crop,pixel,palettes,gamut,rng});

const sprites={};
const sizes=[[128,96],[144,104],[112,92],[136,96],[158,112],[120,88]];
for(let i=0;i<6;i++)sprites[`canopy_${i}`]=canopy(...sizes[i],i,i<3?'cold':'olive');
for(let i=0;i<2;i++)sprites[`trunkrow_${i}`]=trunkrow(i);
for(let i=0;i<4;i++)sprites[`bush_${i}`]=bush(32+i*8,24+(i%3)*4,i);
for(let i=0;i<4;i++)sprites[`tallgrass_${i}`]=grass(16+(i%3)*4,20+(i%3)*2,i);
const atlas=canvas(512,512),frames={},manifest={sprites:{},layers:{},palette:{...palettes,source:[...used.values()]}};
let ax=2,ay=2,rowH=0;
for(const [name,im]of Object.entries(sprites)){
  if(ax+im.w+2>atlas.w){ax=2;ay+=rowH+4;rowH=0;}
  if(ay+im.h+2>atlas.h)throw new Error('atlas overflow');
  blit(atlas,im,ax,ay);
  frames[name]={frame:{x:ax,y:ay,w:im.w,h:im.h},rotated:false,trimmed:false,spriteSourceSize:{x:0,y:0,w:im.w,h:im.h},sourceSize:{w:im.w,h:im.h},pivot:{x:.5,y:1}};
  manifest.sprites[name]={w:im.w,h:im.h,foot:[0,0],pivot:[.5,1],role:name.startsWith('canopy')?'overhead':'ground-decoration'};
  if(name.startsWith('canopy'))manifest.layers[name]={top:name,base:null,foot:[0,0],overlap:[.3,.5]};
  ax+=im.w+4;rowH=Math.max(rowH,im.h);
}
encodePng(atlas,path.join(out,'forest_atlas.png'));
writeFileSync(path.join(records,'stamp-audit.json'),JSON.stringify(audit,null,2)+'\n','utf8');
writeFileSync(path.join(out,'forest_atlas.json'),JSON.stringify({frames,meta:{image:'forest_atlas.png',size:{w:atlas.w,h:atlas.h},scale:'1'}},null,2)+'\n','utf8');
writeFileSync(path.join(out,'forest_sprites.json'),JSON.stringify(manifest,null,2)+'\n','utf8');

// 3x contact sheet: first two rows canopies; third row bases + understory.
const bg=rgb('2a2e2a'),sheet=canvas(1500,1550,bg);
let index=0;
for(const [name,im]of Object.entries(sprites)){
  let x,y;
  if(index<6){x=(index%3)*500+10;y=Math.floor(index/3)*350+16;}
  else if(index<8){x=12+(index-6)*450;y=730;}
  else if(index<12){x=12+(index-8)*240;y=880;}
  else {x=1012+(index-12)*100;y=880;}
  // Small palette key and one tick per sprite index, no font dependency.
  const pal=name.startsWith('canopy')?(index<3?palettes.cold:palettes.olive):palettes.fern;
  for(let k=0;k<7;k++)for(let xx=0;xx<6;xx++)for(let yy=0;yy<3;yy++)pixel(sheet,x+k*7+xx,y-8+yy,pal[k]);
  blit(sheet,im,x,y,3);index++;
}
blit(sheet,ref('pine_a'),18,1020,3);blit(sheet,ref('pine_b'),495,990,3);
blit(sheet,dao,1010,1250,3);blit(sheet,ref('rock_a'),1250,1320,3);
encodePng(sheet,path.join(records,'sheet.png'));

// Reference-ground composition with two forest sections, pines alongside.
const demo=canvas(480,200),ground=decodePng(path.join(root,'public/assets/sect/ground_bake.png'));
blit(demo,crop(ground,{x:170,y:350,w:480,h:200}),0,0);
for(let x=-20;x<300;x+=96)blit(demo,sprites[`trunkrow_${Math.abs(Math.round(x/96))%2}`],x,84);
let cx=-22;
for(let i=0;i<4;i++){const im=sprites[`canopy_${i%3}`];blit(demo,im,cx,105-im.h);cx+=Math.round(im.w*.6);}
for(let i=0;i<3;i++){blit(demo,sprites[`bush_${i}`],8+i*68,154-sprites[`bush_${i}`].h);blit(demo,sprites[`tallgrass_${i}`],26+i*75,184-sprites[`tallgrass_${i}`].h);}
blit(demo,ref('pine_a'),225,39);blit(demo,ref('pine_b'),327,25);
blit(demo,dao,161,136);blit(demo,ref('rock_a'),112,159);
encodePng(demo,path.join(records,'demo-1x.png'));
// Explicit side-by-side 2x: both palettes shown, old pines remain unobstructed.
const compare=canvas(1480,840,bg);
for(let row=0;row<2;row++){
  const scene=canvas(740,200);
  blit(scene,crop(ground,{x:170,y:350,w:740,h:200}),0,0);
  for(let x=-15;x<400;x+=95)blit(scene,sprites[`trunkrow_${row}`],x,93);
  let x=-15;
  for(let i=0;i<4;i++){const im=sprites[`canopy_${row*3+i%3}`];blit(scene,im,x,115-im.h);x+=Math.round(im.w*.67);}
  for(let i=0;i<4;i++){const b=sprites[`bush_${i}`],g=sprites[`tallgrass_${i}`];blit(scene,b,15+i*80,170-b.h);blit(scene,g,40+i*80,194-g.h);}
  blit(scene,ref('pine_a'),412,200-161);blit(scene,ref('pine_b'),574,200-175);
  blit(scene,dao,352,136);blit(scene,ref('rock_a'),389,162);
  blit(compare,scene,0,10+row*420,2);
}
encodePng(compare,path.join(records,'compare.png'));
const md5=b=>createHash('md5').update(b).digest('hex');
console.log(`GEN forest sprites=${Object.keys(sprites).length} atlas=512x512 sheet=1500x1550 demo=480x200 md5=${md5(readFileSync(path.join(out,'forest_atlas.png')))}`);
