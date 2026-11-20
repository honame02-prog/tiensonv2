// Bamboofloor v2: clustered dry bamboo litter, weathered slabs and irregular fencing.
import {mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {decodePng,encodePng} from '../../png.mjs';
import {rng,mincut,error} from '../terrain/lib.mjs';
const ROOT=fileURLToPath(new URL('../../../',import.meta.url));
const OUT=resolve(ROOT,'public/assets/bamboofloor'), TERR=resolve(ROOT,'public/assets/terrain'), REC=resolve(ROOT,'records/assetgen/bamboofloor');
for(const p of [OUT,REC])mkdirSync(p,{recursive:true});
const rgb=h=>h.match(/../g).map(v=>parseInt(v,16));
const LEAF=['4a4636','6e6a4c','777153','8a8460'].map(rgb);
const MOSS=['303022','3b3c2a','474731','515239','5f5f42','8e8e6f'].map(rgb);
const BAMBOO=['302e25','413e30','514f3b','626047','7b765b','91896d'].map(rgb);
const ROCK=['24241f','34342f','3d3b38','48453f','54504c','69635e','8b8480'].map(rgb);
const SLAB=['4b4e4b','676767','73756a','7e7c77','84837e','8c8b86','95938c'].map(rgb);
const load=p=>decodePng(resolve(ROOT,p)), json=p=>JSON.parse(readFileSync(resolve(ROOT,p),'utf8'));
function img(w,h,c){const o={w,h,data:Buffer.alloc(w*h*4)};if(c)for(let p=0;p<o.data.length;p+=4)o.data.set([...c,255],p);return o;}
const px=(o,x,y)=>o.data.subarray((y*o.w+x)*4,(y*o.w+x)*4+4);
function put(o,x,y,c){x=Math.round(x);y=Math.round(y);if(x>=0&&y>=0&&x<o.w&&y<o.h)o.data.set(c.length===4?c:[...c,255],(y*o.w+x)*4);}
function blit(o,s,dx,dy,k=1){for(let y=0;y<s.h;y++)for(let x=0;x<s.w;x++){const c=px(s,x,y);if(!c[3])continue;for(let j=0;j<k;j++)for(let i=0;i<k;i++)put(o,dx+x*k+i,dy+y*k+j,c);}}
function crop(s,f){const o=img(f.w,f.h);for(let y=0;y<f.h;y++)for(let x=0;x<f.w;x++)put(o,x,y,px(s,x+f.x,y+f.y));return o;}
function nearest(r,c){let best=0,d=Infinity;for(let i=0;i<r.length;i++){const e=error(r[i],c);if(e<d){best=i;d=e;}}return best;}
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const sat=c=>Math.max(...c.slice(0,3))?1-Math.min(...c.slice(0,3))/Math.max(...c.slice(0,3)):0;
const sect=load('public/assets/sect/sect_atlas.png'), sm=json('public/assets/sect/sect_atlas.json');
const brush=Object.fromEntries(['rock_a','fern_a','pine_a'].map(k=>[k,crop(sect,sm.frames[k].frame)]));
const dao=crop(load('public/assets/dao_si.png'),{x:0,y:0,w:64,h:64});
const forest=Array.from({length:4},(_,i)=>load(`public/assets/terrain/forest_${i}.png`));
// Keep colours sampled from the approved floor; map only over-saturated needles
// to the nearest already-present muted colour (no RGB interpolation).
const muted=[...new Map(forest.flatMap(t=>Array.from({length:t.w*t.h},(_,i)=>[...t.data.subarray(i*4,i*4+3)]).filter(c=>sat(c)<=.35).map(c=>[c.join(','),c]))).values()];
const muteCache=new Map();
for(const t of forest)for(let p=0;p<t.data.length;p+=4){const c=[...t.data.subarray(p,p+3)];if(sat(c)>.35){const key=c.join(',');if(!muteCache.has(key))muteCache.set(key,muted[nearest(muted,c)]);t.data.set(muteCache.get(key),p);}}
// Efros/Freeman 32px patches, 8px minimum-error overlap. Source orientation stays fixed.
function quilt(seed){const random=rng(seed),o=img(160,160);for(let y=0;y<160;y+=24)for(let x=0;x<160;x+=24){let best=null;for(let n=0;n<36;n++){const src=forest[Math.floor(random()*4)],sx=Math.floor(random()*96),sy=Math.floor(random()*96);let e=0;for(let j=0;j<32&&y+j<160;j++)for(let i=0;i<32&&x+i<160;i++)if((x&&i<8)||(y&&j<8))e+=error(px(o,x+i,y+j),px(src,sx+i,sy+j));if(!best||e<best.e)best={src,sx,sy,e};}const {src,sx,sy}=best,W=Math.min(32,160-x),H=Math.min(32,160-y),left=x?mincut(8,H,(i,j)=>error(px(o,x+i,y+j),px(src,sx+i,sy+j))):null,top=y?mincut(8,W,(j,i)=>error(px(o,x+i,y+j),px(src,sx+i,sy+j))):null;for(let j=0;j<H;j++)for(let i=0;i<W;i++)if(!(left&&i<left[j])&&!(top&&j<top[i]))put(o,x+i,y+j,px(src,sx+i,sy+j));}return crop(o,{x:0,y:0,w:128,h:128});}
// Periodic low-frequency value noise controls clearings and overlapping windrows.
function field(seed){const r=rng(seed),g=Array.from({length:16},()=>r());return (x,y)=>{x=((x%128)+128)%128/32;y=((y%128)+128)%128/32;const ix=Math.floor(x),iy=Math.floor(y),u=x-ix,v=y-iy,fx=u*u*(3-2*u),fy=v*v*(3-2*v),at=(a,b)=>g[(b%4)*4+a%4];return (at(ix,iy)*(1-fx)+at(ix+1,iy)*fx)*(1-fy)+(at(ix,iy+1)*(1-fx)+at(ix+1,iy+1)*fx)*fy;};}
function leaves(t,seed){
  const random=rng(seed),density=field(seed+81),direction=field(seed+509),mask=new Uint8Array(128*128);
  const ground=['3d4238','454a3d','4a4636','514d3b','55513e'].map(rgb),green=['364636','46583f'].map(rgb);
  for(let y=0;y<128;y++)for(let x=0;x<128;x++){
    const c=px(t,x,y),level=Math.floor((c[0]+c[1]+c[2])/100);
    // Small green windows, no large brown blotches under the dry carpet.
    put(t,x,y,density(x,y)<.30?green[clamp(level-1,0,1)]:ground[clamp(level,0,4)]);
    if(random()<.006)put(t,x,y,[86,74,69]);
  }
  let covered=0;
  const wrap=(x,y,c,body=false)=>{x=((Math.round(x)%128)+128)%128;y=((Math.round(y)%128)+128)%128;const k=y*128+x;put(t,x,y,c);if(body&&!mask[k]){mask[k]=1;covered++;}else if(!body&&mask[k]){mask[k]=0;covered--;}};
  for(let n=0;covered<128*128*.635&&n<18000;n++){
    const x=random()*128,y=random()*128,d=density(x,y);
    if(random()>clamp((d-.17)**2*3.4,.008,.98))continue;
    const a=direction(x,y)*Math.PI*2+(random()-.5)*2.8+(random()<.18?Math.PI/2:0),len=7+Math.floor(random()*8),width=1.45+random()*.65;
    const ca=Math.cos(a),sa=Math.sin(a),colour=1+Math.floor(random()*3),bend=(random()-.5)*1.4;
    // Tapered, gently bent lanceolate silhouettes; dark underside belongs to each leaf.
    for(const shadow of [true,false])for(let k=0;k<len;k++){
      const u=k/(len-1),half=Math.sin(Math.PI*u)*width,cx=x+ca*k-sa*bend*Math.sin(u*Math.PI),cy=y+sa*k+ca*bend*Math.sin(u*Math.PI);
      for(let j=-Math.floor(half);j<=Math.floor(half);j++)wrap(cx-sa*j+(shadow?1:0),cy+ca*j+(shadow?1:0),shadow?LEAF[0]:LEAF[j<0?Math.max(1,colour-1):colour],!shadow);
    }
  }
  return t;
}
const common=leaves({...forest[0],data:Buffer.from(forest[0].data)},8117);
// All four sides share the approved boundary and its leaf scatter. Irregular
// error-minimising joins inside 8..16px avoid a rectangular border band.
function join(t){const cuts=[];for(let side=0;side<4;side++)cuts.push(mincut(8,128,(d,k)=>{const x=side===0?8+d:side===1?119-d:k,y=side===2?8+d:side===3?119-d:k;return error(px(common,x,y),px(t,x,y))+d*40;}));for(let y=0;y<128;y++)for(let x=0;x<128;x++)if(!(x>=8+cuts[0][y]&&x<=119-cuts[1][y]&&y>=8+cuts[2][x]&&y<=119-cuts[3][x]))put(t,x,y,px(common,x,y));for(let y=0;y<128;y++)put(t,127,y,px(t,0,y));for(let x=0;x<128;x++)put(t,x,127,px(t,x,0));return t;}
const tiles=Array.from({length:4},(_,i)=>join(leaves(quilt(17011+i*1877),711+i*391)));
for(let i=0;i<4;i++)encodePng(tiles[i],resolve(TERR,`leaflitter_${i}.png`));
// Preserve every existing byte except insertion of the leaflitter member.
const tf=resolve(TERR,'terrain.json'),old=readFileSync(tf,'utf8'),obj=JSON.parse(old),members=Array.from({length:4},(_,i)=>`leaflitter_${i}.png`);
if(obj.materials.leaflitter){if(JSON.stringify(obj.materials.leaflitter)!==JSON.stringify(members))throw Error('Existing leaflitter registration differs');}
else {const end=old.lastIndexOf('}'),materialsEnd=old.lastIndexOf('}',end-1),before=old.slice(0,materialsEnd).trimEnd();writeFileSync(tf,before+',\n    "leaflitter": '+JSON.stringify(members)+'\n  '+old.slice(materialsEnd),'utf8');}
const sprites={},info={};
function add(key,o,foot,role='prop'){sprites[key]=o;info[key]={w:o.w,h:o.h,foot,pivot:[.5,1],role};}
function sampleRock(u,v){const s=brush.rock_a,x=clamp(Math.floor(u*(s.w-1)),0,s.w-1),y=clamp(Math.floor(v*(s.h-1)),0,s.h-1);for(let d=0;d<s.w;d++)for(const xx of [x-d,x+d])if(xx>=0&&xx<s.w&&px(s,xx,y)[3]>127)return px(s,xx,y);return ROCK[2];}
function wood(x,y,edge){const source=sampleRock(((x*3+7)%29)/29,((y*2+3)%31)/31);return BAMBOO[clamp(2+(nearest(ROCK,source)>3?1:0)+edge,0,5)];}
function fence(v){
  const o=img(64,28),railY=(x,y0)=>y0+Math.round(Math.sin(x/63*Math.PI)**2*(v?2:1));
  for(const y0 of [10,20])for(let x=0;x<64;x++)for(let j=0;j<3;j++)put(o,x,railY(x,y0)+j,BAMBOO[j===0?4:j===2?0:2]);
  const random=rng(879+v*541),poles=v?[5,11,24,36,44,57]:[3,13,25,32,45,58];
  for(let n=0;n<poles.length;n++){
    const x0=poles[n],top=1+Math.floor(random()*7),lean=n===1?-2:n===4?2:0,stem=y=>x0+Math.round(lean*(27-y)/27);
    for(let y=top;y<28;y++){
      const x=stem(y);for(let j=0;j<3;j++)put(o,x+j,y,wood(j,y,j===0?1:j===2?-1:0));
      if(y===top||y===top+9||y===top+18)for(let j=0;j<3;j++)put(o,x+j,y,BAMBOO[j===0?4:1]);
    }
    for(const y0 of [10,20]){const yy=railY(x0,y0),x=stem(yy);for(let j=-1;j<4;j++){put(o,x+j,yy+(j&1),BAMBOO[0]);put(o,x+j,yy+2-(j&1),BAMBOO[1]);}put(o,x-1,yy+3,BAMBOO[0]);}
  }
  return o;
}
for(let v=0;v<2;v++)add(`fence_bamboo_h_${v}`,fence(v),[64,5]);
const post=img(7,31);for(let y=0;y<31;y++)for(let x=1;x<6;x++)put(post,x,y,BAMBOO[y%10===0?x===1?5:1:x===1?4:x===5?0:2]);for(const yy of [12,22])for(let x=0;x<7;x++)put(post,x,yy+(x%2),LEAF[1]);add('fence_bamboo_post',post,[5,4]);
for(let v=0;v<3;v++){const [w,h]=[[27,28],[35,36],[22,23]][v],o=img(w,h),s=brush.rock_a;for(let y=0;y<h;y++)for(let x=0;x<w;x++){const c=px(s,Math.floor(x*s.w/w),Math.floor(y*s.h/h));if(c[3]<128)continue;const idx=nearest(ROCK,c);put(o,x,y,ROCK[idx]);const fern=brush.fern_a,fc=px(fern,(x*2+v*7)%fern.w,8+(y*2+v*3)%19);const cap=.35*h+Math.sin(x*.5+v)*1.5;if(y<cap&&fc[3]>110){const level=clamp(nearest(ROCK,c)-1+(y<h*.18?1:0),0,5);put(o,x,y,MOSS[level]);}}add(`mossrock_${v}`,o,[Math.round(w*.62),6]);const shadow=img(w+4,8);for(let y=0;y<8;y++)for(let x=0;x<w+4;x++)if(((x-(w+4)/2)/((w+3)/2))**2+((y-3.5)/3.5)**2<1&&(x+y)%3===0)put(shadow,x,y,[27,31,27]);add(`mossrock_${v}_shadow`,shadow,[0,0],'ground-decal');}
function inside(x,y,points){let b=false;for(let i=0,j=points.length-1;i<points.length;j=i++)if((points[i][1]>y)!==(points[j][1]>y)&&x<(points[j][0]-points[i][0])*(y-points[i][1])/(points[j][1]-points[i][1])+points[i][0])b=!b;return b;}
function stone(o,x0,y0,w,h,variant){
  const random=rng(5301+variant*71+x0*13+y0),shape=[[.08,.12],[.68,0],[.93,.06],[1,.62],[.88,.91],[.25,1],[0,.82],[.03,.3]];
  const points=shape.map(([x,y],i)=>[clamp(Math.round(x*(w-1))+(i===1||i===5?Math.floor(random()*3)-1:0),0,w-1),Math.round(y*(h-1))]);
  const on=(x,y)=>inside(x+.1,y+.1,points);
  for(let y=0;y<h;y++)for(let x=0;x<w;x++)if(on(x,y)){
    const index=nearest(ROCK,sampleRock(.15+x/w*.68,.22+y/h*.55));
    const edge=!(on(x+1,y)&&on(x,y+1));
    put(o,x0+x,y0+y,ROCK[edge?1:clamp(index-2+(y<3?1:0),2,4)]);
  }
  // Short hairline fracture and a few embedded moss flecks on the flat face.
  const cx=Math.floor(w*(.3+random()*.25)),cy=Math.floor(h*.38);
  for(let k=0;k<Math.floor(w*.32);k++){const x=cx+k,y=cy+Math.floor(k/3)+(k>3?1:0);if(on(x,y)&&on(x+1,y+1))put(o,x0+x,y0+y,ROCK[2]);}
  for(let k=0;k<4;k++){const x=Math.floor(w*.7)+k%2,y=Math.floor(h*.57)+Math.floor(k/2);if(on(x,y))put(o,x0+x,y0+y,MOSS[1+k%2]);}
  // One-pixel litter/grass tongues obscure sections of the lower and right rim.
  for(let k=0;k<5;k++){
    const x=2+Math.floor(random()*(w-4));let y=h-1;while(y>0&&!on(x,y))y--;
    if(y>1){put(o,x0+x,y0+y,k%2?LEAF[1]:MOSS[2]);if(k%2)put(o,x0+x+1,y0+y-1,LEAF[2]);}
  }
}
for(let v=0;v<4;v++){const o=img(47,35),layouts=[[[0,3,18,12],[26,1,19,13],[13,21,17,12]],[[1,0,14,11],[23,5,20,13],[2,24,14,10],[30,24,16,11]],[[0,6,20,14],[27,1,18,12],[22,23,20,12]],[[3,1,18,13],[27,9,19,13],[2,24,16,11]]];for(const [x,y,w,h] of layouts[v])stone(o,x,y,w,h,v);for(const [x,y] of [[20,17],[24,21],[18,26]]){put(o,x,y,MOSS[1]);put(o,x+1,y-1,MOSS[3]);put(o,x-1,y-2,MOSS[2]);}add(`stone_path_${v}`,o,[0,0],'ground-decal');}
// TexturePacker hash, 2px padding, binary alpha throughout.
const atlas=img(256,192),frames={};let ax=2,ay=2,row=0;
for(const [key,s] of Object.entries(sprites)){if(ax+s.w+2>atlas.w){ax=2;ay+=row+2;row=0;}blit(atlas,s,ax,ay);frames[key]={frame:{x:ax,y:ay,w:s.w,h:s.h},rotated:false,trimmed:false,spriteSourceSize:{x:0,y:0,w:s.w,h:s.h},sourceSize:{w:s.w,h:s.h}};ax+=s.w+2;row=Math.max(row,s.h);}
encodePng(atlas,resolve(OUT,'bamboofloor_atlas.png'));
writeFileSync(resolve(OUT,'bamboofloor_atlas.json'),JSON.stringify({frames,meta:{image:'bamboofloor_atlas.png',size:{w:atlas.w,h:atlas.h},scale:'1'}},null,2)+'\n');
writeFileSync(resolve(OUT,'bamboofloor_sprites.json'),JSON.stringify({sprites:info,layers:{},version:1,sources:['terrain/forest_0..3','sect/rock_a','sect/fern_a'],placement:{flipX:false,shadowOffset:[3,1],shadowDepth:'ground; separate shadow frames'}},null,2)+'\n');
const bg=[42,46,42],sheet=img(512,425,bg);for(let i=0;i<4;i++)blit(sheet,tiles[i],4+i*128,4);let sx=6,sy=148,rh=0;for(const [key,s] of Object.entries(sprites)){if(sx+s.w+7>380){sx=6;sy+=rh+10;rh=0;}blit(sheet,s,sx,sy);sx+=s.w+9;rh=Math.max(rh,s.h);}blit(sheet,brush.pine_a,344,220);blit(sheet,dao,12,330);blit(sheet,brush.rock_a,90,340);blit(sheet,brush.fern_a,145,350);const scaled=img(sheet.w*3,sheet.h*3);blit(scaled,sheet,0,0,3);encodePng(scaled,resolve(REC,'sheet.png'));
const compare=img(520,190,bg);blit(compare,forest[0],4,4);blit(compare,tiles[0],138,4);blit(compare,brush.rock_a,275,8);blit(compare,brush.fern_a,319,14);blit(compare,sprites.mossrock_1,365,10);blit(compare,dao,436,0);blit(compare,sprites.fence_bamboo_h_0,10,151);blit(compare,sprites.fence_bamboo_h_1,74,151);blit(compare,sprites.fence_bamboo_post,6,148);blit(compare,sprites.fence_bamboo_post,138,148);for(let i=0;i<4;i++)blit(compare,sprites[`stone_path_${i}`],175+i*58,147);const c2=img(1040,380);blit(c2,compare,0,0,2);encodePng(c2,resolve(REC,'compare.png'));
const demo=img(480,270),random=rng(17079);for(let y=0;y<384;y+=128)for(let x=0;x<512;x+=128)blit(demo,tiles[Math.floor(random()*4)],x,y);for(let n=0;n<9;n++){const y=250-n*29,x=220+Math.round(34*Math.sin(n*.45));blit(demo,sprites[`stone_path_${n%4}`],x,y);}for(let n=0;n<4;n++)blit(demo,sprites[`fence_bamboo_h_${n%2}`],44+n*64,66);blit(demo,post,41,63);blit(demo,post,298,63);for(const [v,x,y] of [[0,104,158],[1,343,196]]){blit(demo,sprites[`mossrock_${v}_shadow`],x+3,y-6);blit(demo,sprites[`mossrock_${v}`],x,y-sprites[`mossrock_${v}`].h);}blit(demo,dao,230,125);encodePng(demo,resolve(REC,'demo-1x.png'));
const mosaic=img(960,540);for(let y=0;y<540;y+=128)for(let x=0;x<960;x+=128)blit(mosaic,tiles[Math.floor(random()*4)],x,y);encodePng(mosaic,resolve(REC,'mosaic-1x.png'));
const outputs=[...Array.from({length:4},(_,i)=>resolve(TERR,`leaflitter_${i}.png`)),tf,...['bamboofloor_atlas.png','bamboofloor_atlas.json','bamboofloor_sprites.json'].map(f=>resolve(OUT,f)),...['sheet.png','compare.png','demo-1x.png','mosaic-1x.png'].map(f=>resolve(REC,f))];
for(const f of outputs)console.log(`MD5 ${f.slice(ROOT.length).replaceAll('\\','/')} ${createHash('md5').update(readFileSync(f)).digest('hex')}`);
console.log(`GEN PASS: 4 leaflitter tiles 128x128; ${Object.keys(sprites).length} frames; atlas 256x192; sheet 1536x1275; compare 1040x380; demo 480x270`);
