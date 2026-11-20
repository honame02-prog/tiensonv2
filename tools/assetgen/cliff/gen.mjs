// Tiên Sơn cliff kit v1. Node-only, fixed seed, indexed STYLE §5 ramps.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';
import { decodePng, encodePng } from '../../png.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const OUT = resolve(ROOT, 'public/assets/cliff');
const REC = resolve(ROOT, 'records/assetgen/cliff');
mkdirSync(OUT, { recursive: true }); mkdirSync(REC, { recursive: true });
const rgb = hex => hex.match(/\w\w/g).map(s => parseInt(s, 16));
const ROCK = ['24241f','34342f','3d3b38','48453f','54504c','69635e','8b8480'].map(rgb);
const MOSS = ['27332d','364636','46583f','576948','697a52','7d8b5d','949e6e'].map(rgb);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const mod = (x, n) => ((x % n) + n) % n;
function hash(x, y, s = 0) {
  let z = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(s + 1777, 1274126177);
  z = Math.imul(z ^ z >>> 13, 1274126177); return ((z ^ z >>> 16) >>> 0) / 4294967296;
}
const img = (w,h,fill) => {
  const im = {w,h,data:Buffer.alloc(w*h*4)};
  if(fill) for(let y=0;y<h;y++) for(let x=0;x<w;x++) put(im,x,y,fill);
  return im;
};
function put(im,x,y,c) { if(x<0||y<0||x>=im.w||y>=im.h)return; const p=(y*im.w+x)*4; im.data.set([...c,255],p); }
function pixel(im,x,y) { return [...im.data.subarray((y*im.w+x)*4,(y*im.w+x)*4+4)]; }
function blit(dst,src,dx,dy,scale=1,clip=null) {
  for(let y=0;y<src.h;y++)for(let x=0;x<src.w;x++) {
    const c=pixel(src,x,y); if(!c[3])continue;
    for(let j=0;j<scale;j++)for(let i=0;i<scale;i++) {
      const px=dx+x*scale+i, py=dy+y*scale+j;
      if(clip&&(px<clip[0]||py<clip[1]||px>=clip[2]||py>=clip[3]))continue;
      put(dst,px,py,c.slice(0,3));
    }
  }
}
const shade = (ramp,v) => ramp[clamp(Math.round(v),0,ramp.length-1)];
// All grain comes from the owned atlas; random numbers place geometry only.
const sect=decodePng(resolve(ROOT,'public/assets/sect/sect_atlas.png'));
const sectMeta=JSON.parse(readFileSync(resolve(ROOT,'public/assets/sect/sect_atlas.json'),'utf8'));
const decals=decodePng(resolve(ROOT,'public/assets/sect/decals.png'));
const decalMeta=JSON.parse(readFileSync(resolve(ROOT,'public/assets/sect/decals.json'),'utf8'));
const ground=decodePng(resolve(ROOT,'public/assets/sect/ground_bake.png'));
function crop(source,x,y,w,h){const im=img(w,h);for(let yy=0;yy<h;yy++)source.data.copy(im.data,yy*w*4,((y+yy)*source.w+x)*4,((y+yy)*source.w+x+w)*4);return im;}
const brush={};
for(const k of ['rock_a','rock_b','rock_c','stele_a','pine_a']){const f=sectMeta.frames[k].frame;brush[k]=crop(sect,f.x,f.y,f.w,f.h);}
for(const k of ['tuft7','tuft8','tuft9','fern1','fern2']){const f=decalMeta.frames[k].frame;brush[k]=crop(decals,f.x,f.y,f.w,f.h);}
function nearest(ramp,c){let best=0,dist=Infinity;for(let i=0;i<ramp.length;i++){const d=ramp[i].reduce((v,n,j)=>v+(n-c[j])**2,0);if(d<dist){dist=d;best=i;}}return best;}
// Recover an opaque source pixel along its row; never fill with synthetic noise.
function sampleRock(name,u,v){
 const src=brush[name],x=clamp(Math.floor(u*(src.w-1)),0,src.w-1),y=clamp(Math.floor(v*(src.h-1)),2,src.h-3);
 for(let d=0;d<src.w;d++)for(const xx of [x-d,x+d])if(xx>=0&&xx<src.w){const c=pixel(src,xx,y);if(c[3]>127)return c;}
 return pixel(src,Math.floor(src.w/2),Math.floor(src.h/2));
}
function stone(name,u,v,light=0){const c=sampleRock(name,u,v);return shade(ROCK,nearest(ROCK,c)+light);}
// Sedimentary slabs: broad flat shoulders, long bedding joints, short offsets.
// Each 63px interface uses the same field; variant deformation fades at joins.
const bedding=[-22,3,27,49,74,101,127];
function rockField(t,d,variant,light=0){
 t=mod(t,63);
 const env=Math.sin(Math.PI*t/63)**2;
 const bed=(r)=>bedding[r]+Math.round(3*Math.sin(t*.073+r*1.7)+1.2*Math.sin(t*.19+r)+env*variant*Math.sin(r+1)*2);
 let row=0;
 while(row<bedding.length-2&&d>=bed(row+1))row++;
 const top=bed(row),bottom=bed(row+1),height=bottom-top;
 const shift=[9,37,18,49,4,29][row];
 const width=[51,44,48,54,43,50][row];
 const u=mod(t+shift+Math.round(env*variant*2),63);
 const large=u<width;
 const bend=Math.round(Math.sin(d*.19+row*2)*1.3);
 const bx=large?u:u-width,bw=large?width:63-width;
 const by=d-top;
 // Rounded, nearly level shoulders; no wedge or peaked triangular facet.
 const shoulder=Math.max(0,3-Math.min(bx,bw-1-bx));
 const beddingGap=by<1&&hash(Math.floor(t/5),row,801)>.18;
 const joint=beddingGap||(Math.abs(bx-bend)<.7&&by>3&&by<height-3);
 if(joint){
  const leaf=pixel(brush.tuft9,mod(Math.round(t),brush.tuft9.w),mod(Math.round(d),brush.tuft9.h));
  if(row%3===1&&leaf[3]>127&&by>height-3)return MOSS[1];
  return ROCK[hash(Math.floor(t/3),Math.floor(d/3),93)>.78?1:0];
 }
 const uSource=.16+bx/Math.max(1,bw-1)*.67;
 const vSource=.29+by/height*.53;
 const source=sampleRock(row%2?'rock_a':'rock_b',uSource,vSource);
 let level=nearest(ROCK,source)+light;
 // Wide lit top ledges and shaded undersides, with only a narrow right bevel.
 if(by<2+shoulder*.35)level+=.8;
 if(by>height-3)level-=.6;
 if(bx>bw-2)level-=.5;
 if(bx<2)level+=.3;
 if(hash(Math.floor(t),Math.floor(d),1777)>.975)level+=.6;
 return shade(ROCK,level);
}
// AG2b staggered nearest-cell construction, with a 252px four-variant field.
// Unequal horizontal spacing and row offsets prevent the old 32/63px grid.
const northCells=[];
for(let row=-1;row<6;row++){
 let x=-65+(row%2)*23;
 let col=0;
 while(x<320){
  const span=24+Math.floor(hash(col,row,2801)*33);
  northCells.push({x:x+span*.5,y:row*21+8+(hash(col,row,2802)-.5)*13,
   id:northCells.length,rock:(row+col)%2?'rock_a':'rock_b',span});
  x+=span;col++;
 }
}
function northField(t,d,variant){
 const xx=variant*63+t;
 let best=null,first=Infinity,second=Infinity;
 for(const c of northCells){
  const dx=xx-c.x,dy=d-c.y;
  // Broad rounded cells; a small shear avoids aligned vertical joints.
  const sy=dy+dx*.035*Math.sin(c.id*2.3);
  const dist=Math.sqrt((dx*.49)**4+sy**4);
  if(dist<first){second=first;first=dist;best=c;}else if(dist<second)second=dist;
 }
 const dx=xx-best.x,dy=d-best.y;
 // Short angled crevices stop at the neighbouring, offset course.
 if(second-first<19&&(dy>1||dx>10))return ROCK[0];
 const u=clamp(.5+dx/(best.span+19),.06,.94),v=clamp(.46+dy/34,.12,.92);
 // The cap has a broad level shoulder, rather than a sloping triangular peak.
 const shoulder=-5+Math.min(2,Math.floor(Math.abs(dx)/14));
 let level=(dy<shoulder?1:0)+(dx<-7?.4:0)-(dx>best.span*.3?.8:0)-(dy>7?.65:0);
 if(second-first<55&&dy<0)level+=.5;
 return stone(best.rock,u,v,level);
}
function quilt(x,y,variant=0){
 // Small overlapping patches of the actual grass bake, quantized to its moss ramp.
 const qx=Math.floor(x/13),qy=Math.floor(y/11);
 const sx=150+mod(qx*23+variant*17,65)+mod(x,13);
 const sy=24+mod(qy*29+variant*43,250)+mod(y,11);
 return MOSS[nearest(MOSS,pixel(ground,sx,sy))];
}
function stamp(dst,name,dx,dy,w,h,light=0,wrap=false){
 const src=brush[name];
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){
  const c=pixel(src,Math.floor(x*src.w/w),Math.floor(y*src.h/h));if(c[3]<128)continue;
  const ramp=name.startsWith('rock')?ROCK:MOSS;
  const color=shade(ramp,nearest(ramp,c)+light);
  const xx=wrap?mod(dx+x,63):dx+x;put(dst,xx,dy+y,color);
 }
}
function north(variant,legacy=false){
 const im=img(64,84),tops=[];
 for(let x=0;x<64;x++){
  const t=mod(x,63),env=Math.sin(Math.PI*t/63)**2;
  const top=legacy
   ?clamp(12+Math.round(env*([8,0,-12,-3][variant]+4*Math.sin(t*.19+variant)+2*Math.sin(t*.43))),0,20)
   :clamp(12+Math.round(env*([6,-1,-11,-4][variant]+2*Math.sin(t*.10+variant))),0,20);
  tops.push(top);
  for(let y=top;y<84;y++){
   let c=legacy?rockField(t,y+9,variant):northField(t,y+9,variant);
   if(y<top+6)c=quilt(t,y-top,variant*(env>.1?1:0));
   if(y>=76)c=shade(ROCK,Math.max(0,nearest(ROCK,c)-2));
   put(im,x,y,c);
  }
 }
 // Sparse hanging foliage uses source clusters, preserving top-left illumination.
 for(let k=0;k<4;k++){
  const x=6+k*15+(variant*3)%7;
  stamp(im,k%2?'tuft9':'fern2',x-4,tops[Math.min(62,x) ]-3,12,12,-1,true);
 }
 for(let k=0;k<4;k++){
  const x=5+k*16+(variant*5)%8;
  stamp(im,'rock_c',x,75+(k%2),8+(k%3),8,-1,true);
 }
 for(let k=0;k<9;k++)stamp(im,'rock_c',mod(k*11+variant*7,61),80+(k%2),2+k%4,3,0,true);
 // Exact shared boundary comes from the same source texture field at x=0.
 for(let y=0;y<84;y++){
  if(y<12){im.data.fill(0,(y*64)*4,(y*64)*4+4);im.data.fill(0,(y*64+63)*4,(y*64+63)*4+4);continue;}
  let c=y<18?quilt(0,y-12,0):rockField(0,y+9,0);if(y>=76)c=shade(ROCK,Math.max(0,nearest(ROCK,c)-2));
  put(im,0,y,c);put(im,63,y,c);
 }
 return im;
}
function south(variant){
 const im=img(64,28);
 for(let x=0;x<64;x++)for(let y=0;y<28;y++){
  const t=mod(x,63),env=Math.sin(Math.PI*t/63)**2,lip=7+Math.round(env*(1.5+2*Math.sin(t*.065+variant)));
  let c=y<lip?quilt(t,y,env>.1?variant:0):rockField(t,y+28,variant,-1);
  if(y>20)c=ROCK[y<24?1:0];
  put(im,x,y,c);
 }
 for(let y=0;y<28;y++)im.data.copy(im.data,(y*64+63)*4,(y*64)*4,(y*64)*4+4);
 return im;
}
function side(variant,east=false){
 const im=img(40,64);
 for(let y=0;y<64;y++)for(let x=0;x<40;x++){
  const t=mod(y,63),d=east?x:39-x,env=Math.sin(Math.PI*t/63)**2;
  const fringe=7+Math.round(env*(3*Math.sin(t*.09+variant)+Math.sin(t*.21)));
  const outer=37+Math.round(env*2*Math.sin(t*.16));if(d>outer)continue;
  let c=rockField(d*1.6,t+9,variant*env,east?.65:-.9);
  if(d<fringe)c=quilt(t,d,env>.1?variant:0);
  if(d>=outer-2)c=ROCK[0];
  put(im,x,y,c);
 }
 // Source foliage hangs over the inward, undulating grass/stone interface.
 for(let k=0;k<4;k++){
  const yy=6+k*15+(variant*3)%5;
  stamp(im,k%2?'tuft9':'fern2',east?3:26,yy,11,13,-1);
 }
 for(let x=0;x<40;x++)im.data.copy(im.data,(63*40+x)*4,x*4,x*4+4);
 return im;
}
function corner(n,west,northCorner) {
  const h=northCorner?84:28, im=img(40,h), sideIm=side(0,!west);
  // Curved end of the horizontal ledge, turning into the vertical side.
  for(let y=0;y<h;y++)for(let x=0;x<40;x++) {
    const inward=west?x:39-x, u=inward/39, v=y/(h-1);
    const nx=west?mod(x-39,63):x;
    const sy=mod(y-(northCorner?h-1:0),63);
    const a=pixel(n,nx,y), b=pixel(sideIm,x,sy);
    const t=northCorner ? (1-u)*v*v : (1-u)*(1-v)**2;
    if(!a[3]&&!b[3])continue;
    const c=t>.5?b:a;
    // Quantize the transition back to an existing material ramp.
    if(c[3]) {
      let target=c.slice(0,3);
      if(t>.08&&t<.92&&a[3]&&b[3]) {
        const mixed=a.slice(0,3).map((z,i)=>z*(1-t)+b[i]*t);
        const ramp=(b[1]>b[0]*1.12&&t>.55)?MOSS:ROCK;
        target=ramp.reduce((best,q)=>q.reduce((sum,z,i)=>sum+(z-mixed[i])**2,0)<best.dist?{c:q,dist:q.reduce((sum,z,i)=>sum+(z-mixed[i])**2,0)}:best,{c:ramp[0],dist:Infinity}).c;
      }
      put(im,x,y,target);
    }
  }
  // Exact join interfaces, excluding the shared single corner pixel.
  for(let y=0;y<h-1;y++) {
    const x=west?39:0, c=pixel(n,west?0:63,y);
    im.data.set(c,(y*40+x)*4);
  }
  for(let x=0;x<40;x++) {
    const c=pixel(sideIm,x,northCorner?0:63);
    im.data.set(c,((northCorner?h-1:0)*40+x)*4);
  }
  return im;
}
function boulder(index){
 const w=[56,68,48][index],h=[53,60,43][index],im=img(w,h);
 // Broad shoulder and irregular octagonal foot, unlike the old pointed peak.
 const points=[[.05,.75],[.08,.38],[.26,.13],[.48,.05],[.76,.16],[.94,.43],[.98,.77],[.78,.94],[.47,1],[.17,.94]].map(([x,y])=>[x*(w-1),y*(h-1)]);
 const inside=(x,y)=>{let yes=false;for(let i=0,j=points.length-1;i<points.length;j=i++){const a=points[i],b=points[j];if((a[1]>y)!==(b[1]>y)&&x<(b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0])yes=!yes;}return yes;};
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){
  if(!inside(x+.2,y+.1))continue;
  const u=x/(w-1),v=y/(h-1);
  // Four broad facets share the same source-pixel vein field.
  const roof=v<.34+u*.12,left=u<.32-v*.07,right=u>.71-v*.1;
  let light=roof?1:left?.5:right?-1.5:-.35;
  if(!inside(x+1.2,y+1.2))light-=1.5;
  const source=sampleRock('rock_a',.14+u*.72,.13+v*.78);
  const detail=sampleRock(index%2?'rock_b':'rock_a',.18+mod(x+index*5,22)/34,.18+mod(y+index*3,21)/32);
  let c=shade(ROCK,nearest(ROCK,source)+light+(nearest(ROCK,detail)-3)*.3);
  if(roof&&source[1]>source[0]*1.04)c=shade(MOSS,nearest(MOSS,source)-1);
  put(im,x,y,c);
 }
 stamp(im,'tuft9',Math.round(w*.27),Math.round(h*.07),Math.round(w*.28),8,-2);
 put(im,Math.round(w*.47),h-1,ROCK[0]);return im;
}
const frames={};
for(let i=0;i<4;i++)frames[`cliff_n_${i}`]=north(i);
for(let i=0;i<3;i++)frames[`cliff_s_${i}`]=south(i);
for(let i=0;i<3;i++)frames[`cliff_w_${i}`]=side(i);
for(let i=0;i<3;i++)frames[`cliff_e_${i}`]=side(i,true);
const retainedNorth=north(0,true);
frames.cliff_nw=corner(retainedNorth,true,true);
frames.cliff_ne=corner(retainedNorth,false,true);
frames.cliff_sw=corner(frames.cliff_s_0,true,false);
frames.cliff_se=corner(frames.cliff_s_0,false,false);
for(let i=0;i<3;i++)frames[`boulder_${i}`]=boulder(i);

let ax=2,ay=2,rowH=0;const packed={};
for(const [name,im] of Object.entries(frames)) {
  if(ax+im.w+2>512){ax=2;ay+=rowH+4;rowH=0;}
  packed[name]={x:ax,y:ay,w:im.w,h:im.h};ax+=im.w+4;rowH=Math.max(rowH,im.h);
}
const atlas=img(512,ay+rowH+2), atlasFrames={}, sprites={};
for(const [name,im] of Object.entries(frames)) {
  const f=packed[name];blit(atlas,im,f.x,f.y);
  atlasFrames[name]={frame:f,rotated:false,trimmed:false,spriteSourceSize:{x:0,y:0,w:im.w,h:im.h},sourceSize:{w:im.w,h:im.h},pivot:{x:.5,y:1}};
  sprites[name]={w:im.w,h:im.h,foot:name.startsWith('boulder')?[Math.round(im.w*.6),9]:name.startsWith('cliff_n_')?[64,8]:name.startsWith('cliff_s_')?[64,6]:[24,8],pivot:[.5,1]};
}
const json=(path,obj)=>writeFileSync(path,JSON.stringify(obj,null,2)+'\n','utf8');
encodePng(atlas,resolve(OUT,'cliff_atlas.png'));
json(resolve(OUT,'cliff_atlas.json'),{frames:atlasFrames,meta:{app:'Tienson cliff assetgen v4 staggered broad north cells',image:'cliff_atlas.png',format:'RGBA8888',size:{w:atlas.w,h:atlas.h},scale:'1'}});
json(resolve(OUT,'cliff_sprites.json'),{sprites,layers:{},tileable:{n:{w:64},s:{w:64},w:{h:64},e:{h:64}}});

const map=img(320,240,rgb('2a2e2a'));
for(let y=84;y<212;y++)for(let x=40;x<280;x++)put(map,x,y,MOSS[hash(x,y,401)<.035?2:hash(x,y,401)>.975?4:3]);
for(let i=0;i<4;i++) {
  blit(map,frames[`cliff_n_${i}`],40+i*64,0,1,[40,0,280,84]);
  blit(map,frames[`cliff_s_${i%3}`],40+i*64,212,1,[40,212,280,240]);
}
for(let i=0;i<3;i++) {
  blit(map,frames[`cliff_w_${i}`],0,84+i*64,1,[0,84,40,212]);
  blit(map,frames[`cliff_e_${i}`],280,84+i*64,1,[280,84,320,212]);
}
blit(map,frames.cliff_nw,0,0);blit(map,frames.cliff_ne,280,0);
blit(map,frames.cliff_sw,0,212);blit(map,frames.cliff_se,280,212);
blit(map,frames.boulder_0,68,108);blit(map,frames.boulder_1,194,146);
encodePng(map,resolve(REC,'map_1x.png'));
// 3x contact sheet, five columns. Dots beneath frames are stable index labels.
const sheet=img(1200,1600,rgb('2a2e2a'));
Object.entries(frames).forEach(([name,im],i)=>{
  const x=20+(i%5)*236,y=18+Math.floor(i/5)*270;
  blit(sheet,im,x,y,3);
  for(let j=0;j<=i%5;j++)for(let yy=0;yy<3;yy++)for(let xx=0;xx<3;xx++)put(sheet,x+j*7+xx,y+255+yy,ROCK[5]);
});
const dao=decodePng(resolve(ROOT,'public/assets/dao_si.png'));
blit(sheet,crop(dao,0,0,64,64),380,1270,3);
for(const [name,x,y,scale] of [['rock_a',602,1320,3],['pine_a',720,1100,3]]) {
  const f=sectMeta.frames[name].frame;blit(sheet,crop(sect,f.x,f.y,f.w,f.h),x,y,scale);
}
blit(sheet,map,20,1160);
encodePng(sheet,resolve(REC,'sheet.png'));
const compare=img(480,270,rgb('2a2e2a'));
blit(compare,map,0,15);
blit(compare,brush.rock_a,338,32);blit(compare,brush.rock_b,386,36);blit(compare,brush.stele_a,435,18);
blit(compare,frames.boulder_2,344,104);blit(compare,frames.cliff_n_2,408,105);
const compare2=img(960,540,rgb('2a2e2a'));blit(compare2,compare,0,0,2);encodePng(compare2,resolve(REC,'compare.png'));
const outputs=['cliff_atlas.png','cliff_atlas.json','cliff_sprites.json'];
for(const name of outputs)console.log(`GEN ${name} md5=${createHash('md5').update(readFileSync(resolve(OUT,name))).digest('hex')}`);
console.log(`GEN sprites=${Object.keys(frames).length} atlas=${atlas.w}x${atlas.h} sheet=${sheet.w}x${sheet.h} map=320x240 seed=1777`);
