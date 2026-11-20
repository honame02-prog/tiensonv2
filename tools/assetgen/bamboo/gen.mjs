import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { decodePng, encodePng } from '../../png.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../../..');
const out=path.join(root,'public/assets/bamboo'),rec=path.join(root,'records/assetgen/bamboo');
mkdirSync(out,{recursive:true});mkdirSync(rec,{recursive:true});
const rgb=s=>s.match(/../g).map(n=>parseInt(n,16));
const ramp='17221c 26352b 354438 465544 59684f 718064 8e9a72'.split(' ').map(rgb);
const dry='24241f 393b30 545447 706b55'.split(' ').map(rgb);
const rng=seed=>()=>{let t=seed+=0x6d2b79f5;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return((t^t>>>14)>>>0)/4294967296;};
const canvas=(w,h,c)=>{const im={w,h,data:Buffer.alloc(w*h*4)};if(c)for(let p=0;p<im.data.length;p+=4)im.data.set([...c,255],p);return im;};
function pixel(im,x,y,c){x=Math.round(x);y=Math.round(y);if(x>=0&&y>=0&&x<im.w&&y<im.h)im.data.set([...c,255],(y*im.w+x)*4);}
function line(im,x,y,xx,yy,c){const n=Math.max(Math.abs(xx-x),Math.abs(yy-y));for(let t=0;t<=Math.ceil(n);t++)pixel(im,x+(xx-x)*t/Math.max(1,n),y+(yy-y)*t/Math.max(1,n),c);}
function blit(dst,src,x,y,s=1){for(let yy=0;yy<src.h;yy++)for(let xx=0;xx<src.w;xx++){const p=(yy*src.w+xx)*4;if(src.data[p+3])for(let sy=0;sy<s;sy++)for(let sx=0;sx<s;sx++)pixel(dst,x+xx*s+sx,y+yy*s+sy,[...src.data.subarray(p,p+3)]);}}
function crop(im,f){const o=canvas(f.w,f.h);for(let y=0;y<f.h;y++)im.data.copy(o.data,y*f.w*4,((y+f.y)*im.w+f.x)*4,((y+f.y)*im.w+f.x+f.w)*4);return o;}
function tight(im){let x0=im.w,y0=im.h,x1=-1,y1=-1;for(let y=0;y<im.h;y++)for(let x=0;x<im.w;x++)if(im.data[(y*im.w+x)*4+3]){x0=Math.min(x0,x);x1=Math.max(x1,x);y0=Math.min(y0,y);y1=Math.max(y1,y);}return crop(im,{x:x0,y:y0,w:x1-x0+1,h:y1-y0+1});}
const sect=decodePng(path.join(root,'public/assets/sect/sect_atlas.png'));
const sf=JSON.parse(readFileSync(path.join(root,'public/assets/sect/sect_atlas.json'),'utf8')).frames;
const ref=n=>crop(sect,sf[n].frame);
const dao=crop(decodePng(path.join(root,'public/assets/dao_si.png')),{x:0,y:0,w:64,h:64});
// Original pixel brushes supply spatial shade patterns, quantized to the muted
// bamboo ramp. Leaf silhouettes remain narrow bamboo lances, never pine crowns.
const brushes=['pine_a_f0','pine_a_f2','pine_a_f6','pine_b_f1','fern_a'].map(ref);
function sourceShade(k,x,y){const b=brushes[k%brushes.length],p=(((Math.abs(y)%b.h)*b.w)+Math.abs(x)%b.w)*4;return b.data[p+3]?(b.data[p]+b.data[p+1]+b.data[p+2])/3:38;}
function lance(im,x,y,angle,len,width,level,brush){
  const dx=Math.cos(angle),dy=Math.sin(angle);
  for(let t=0;t<len;t++){
    const xx=x+dx*t,yy=y+dy*t+.012*t*t;
    const sampled=sourceShade(brush,Math.round(xx),Math.round(yy));
    const shade=Math.max(1,Math.min(6,level+(sampled>96?1:sampled<25?-1:0)));
    pixel(im,xx,yy,ramp[shade]);
    // Overlapping two-pixel lance blades; only their terminal tips are one pixel.
    if(width===2&&t>=1&&t<len-1)pixel(im,xx-dy,yy+dx,ramp[Math.max(1,shade-(t>len*.65?1:0))]);
  }
}
function fan(im,x,y,dir,r,level,brush,scale=1){
  const count=10+Math.floor(r()*3),length=(11+r()*4)*scale;
  // A short woody rachis stays buried inside a compact radial leaf fan.
  line(im,x-dir*3,y-2,x+dir*5,y+2,ramp[1]);
  for(let j=0;j<count;j++){
    const t=j/(count-1),angle=dir>0?-.65+t*1.9:Math.PI+.65-t*1.9;
    const bx=x+dir*(t*4-1),by=y+t*2;
    lance(im,bx,by,angle+(r()-.5)*.12,length*(.82+r()*.25),2,
      Math.max(1,level-(t>.6?1:0)),brush+j);
  }
}
function foliage(i){
  const r=rng(4103+i*123),w=[66,76,60,78,70,74][i],h=[38,45,43,50,41,47][i];
  const im=canvas(w+20,h+20);
  // Interlocking fans form a crown rather than isolated leaves on long twigs.
  // The staggered lower lobes leave narrow shadow clefts and drooping tips.
  const marks=[ [.26,.23,-1], [.46,.15,1], [.63,.28,1],
    [.24,.48,-1], [.48,.43,1], [.71,.53,1],
    [.32,.71,-1], [.54,.68,1], [.46,.34,-1] ];
  if([1,3,4,5].includes(i))marks.push([.46,.55,-1]);
  if([3,5].includes(i))marks.push([.58,.40,-1]);
  if([1,3,5].includes(i))marks.push([.50,.40,-1,.7],[.55,.55,-1,.7],[.42,.30,1,.7]);
  for(const [bx,by,dir] of marks){
    const x=10+w*bx+(r()-.5)*3,y=6+h*by+(r()-.5)*2;
    line(im,10+w*.48,6+h*.48,x,y,ramp[1]);
  }
  // Back/lower fans first, then lit upper-left planes from the reference brushes.
  for(const [b,m] of marks.map((m,b)=>[b,m]).sort((a,b)=>b[1][1]-a[1][1])){
    const [bx,by,dir]=m,x=10+w*bx,y=6+h*by;
    fan(im,x,y,dir,r,m[3]?2:by<.35?4:by<.6?3:2,b+i,m[3]||1);
  }
  // Close isolated one-pixel pinholes inside overlapping blades. Broad shadow
  // clefts between the fans stay transparent, preserving the scalloped outline.
  const mask=Buffer.from(im.data);
  for(let y=1;y<im.h-1;y++)for(let x=1;x<im.w-1;x++){
    const a=(y*im.w+x)*4+3;
    if(!mask[a]&&[a-4,a+4,a-im.w*4,a+im.w*4].every(p=>mask[p]))pixel(im,x,y,ramp[2]);
  }
  return tight(im);
}
const audit={sourceBrushes:['pine_a_f0','pine_a_f2','pine_a_f6','pine_b_f1','fern_a'],flipX:false,stems:{},clumps:{}};
function stems(i,small=false){
  const r=rng(8109+i*311+(small?402:0)),w=small?52+i*7:72+(i%3)*8,h=small?[40,52,64][i]:[114,137,126,150,121,143][i];
  const im=canvas(w,h),n=small?2+i:2+i%4,items=[];
  let base=w*.5-(n-1)*4;
  for(let j=0;j<n;j++){
    if(j)base+=2+Math.floor(r()*13);
    const rear=j<Math.min(2,n-1),width=small?3:rear?3:4+Math.floor(r()*3);
    const height=small?(j===0?h-1:h-5-Math.floor(r()*12)):j===n-1?h-4:Math.max(90,h-9-Math.floor(r()*19));
    const lean=(j/(n-1)-.5)*.15+(r()-.5)*.025,phase=r()*6,spacing=10+Math.floor(r()*9),offset=Math.floor(r()*spacing);
    const nodes=[];for(let yy=h-7-offset;yy>h-1-height+4;yy-=spacing)nodes.push(yy);
    items.push({base,width,height,lean,phase,nodes,spacing,rear,branchCount:2+j%3});
  }
  const mid=(items[0].base+items.at(-1).base+items.at(-1).width)/2;
  for(const s of items)s.base+=w/2-mid;
  // Opaque horizontal contact shade and sparse dry leaves, all before the culms.
  for(const s of items)for(let y=h-4;y<h;y++)for(let x=s.base-7;x<s.base+s.width+8;x++)if(Math.abs(x-s.base-s.width/2)<9-(y===h-4?3:0))pixel(im,x,y,ramp[y===h-2?0:1]);
  items.sort((a,b)=>Number(b.rear)-Number(a.rear));
  for(const s of items){
    for(let y=h-1-s.height;y<h-1;y++){
      const rise=h-1-y,xx=s.base+s.lean*rise+Math.sign(s.lean)*1.5*(rise/s.height)**2;
      const fade=rise>s.height-22?1:0;
      const sw=Math.max(1,s.width-Math.floor((rise/s.height)**2*(s.width-2)));
      for(let k=0;k<sw;k++)pixel(im,xx+k,y,ramp[Math.max(1,(k===0?5:k===1?4:k===sw-1?1:3)-fade-(s.rear?1:0))]);
      if(s.nodes.includes(y)){
        for(let k=-1;k<=sw;k++){pixel(im,xx+k,y,ramp[1]);pixel(im,xx+k,y-1,ramp[Math.max(2,(fade?3:5)-(s.rear?1:0))]);}
        const ni=s.nodes.length-1-s.nodes.indexOf(y),side=(ni%2?1:-1);
        if(ni<s.branchCount){
          const reach=7+ni*2;
          line(im,xx+sw/2,y-1,xx+side*reach,y-3,ramp[s.rear?1:2]);
          line(im,xx+side*reach,y-3,xx+side*(reach+3),y-6,ramp[2]);
        }
      }
    }
    for(let j=0;j<3;j++){const x=s.base-6+r()*16,y=h-1-Math.floor(r()*3);line(im,x,y,x+3,y-1,dry[2+j%2]);}
  }
  if(small){
    // Young wrapped shoots with diagonal sheath seams among the low leaves.
    const sx=w*.56,sy=h-1;for(let y=sy-24;y<sy;y++){const t=(y-(sy-24))/24,hw=1+t*3;for(let x=sx-hw;x<=sx+hw;x++)pixel(im,x,y,dry[x<sx?3:1]);if(y%6===0)line(im,sx-hw,y,sx+hw,y-3,dry[0]);}
    for(let j=0;j<13+i*3;j++)fan(im,12+r()*(w-24),9+r()*(h-25),j%2?1:-1,r,2+Math.floor(r()*3),j+i);
  }
  (small?audit.clumps:audit.stems)[`bamboo_${small?'clump':'stem'}_${i}`]={count:n,stems:items.map(s=>({baseX:s.base,rear:s.rear,branchCount:s.branchCount,width:s.width,height:s.height,leanDegrees:Math.atan(s.lean)*180/Math.PI,nodeSpacing:s.spacing,nodeRows:s.nodes})),flipX:false};
  return small?tight(im):im;
}
const sprites={};for(let i=0;i<6;i++)sprites[`bamboo_stem_${i}`]=stems(i);
for(let i=0;i<6;i++)sprites[`bamboo_leaf_${i}`]=foliage(i);
for(let i=0;i<3;i++)sprites[`bamboo_clump_${i}`]=stems(i,true);
const atlas=canvas(512,512),frames={},manifest={sprites:{},layers:{},palette:{bamboo:ramp,dry},lighting:'upper-left',flipX:false};
let ax=2,ay=2,row=0;
for(const [name,im] of Object.entries(sprites)){
  if(ax+im.w+2>atlas.w){ax=2;ay+=row+4;row=0;}if(ay+im.h+2>atlas.h)throw Error('atlas overflow');
  blit(atlas,im,ax,ay);frames[name]={frame:{x:ax,y:ay,w:im.w,h:im.h},rotated:false,trimmed:false,spriteSourceSize:{x:0,y:0,w:im.w,h:im.h},sourceSize:{w:im.w,h:im.h}};
  manifest.sprites[name]={w:im.w,h:im.h,foot:name.includes('leaf')?[0,0]:[name.includes('stem')?8+(Number(name.at(-1))%4)*2:12,6],pivot:[.5,1],role:name.includes('leaf')?'overhead':'base'};
  ax+=im.w+4;row=Math.max(row,im.h);
}
for(let i=0;i<6;i++){
  const base=`bamboo_stem_${i}`,leaf=`bamboo_leaf_${i}`,im=sprites[leaf],stem=sprites[base];
  const clusters=[{name:leaf,x:Math.round((stem.w-im.w)/2),y:0,w:im.w,h:im.h,cy:im.h*.48}];

  manifest.layers[base]={base,clusters};
}
encodePng(atlas,path.join(out,'bamboo_atlas.png'));
const json=(file,obj)=>writeFileSync(file,JSON.stringify(obj,null,2)+'\n','utf8');
json(path.join(out,'bamboo_atlas.json'),{frames,meta:{image:'bamboo_atlas.png',size:{w:512,h:512},scale:'1'}});
json(path.join(out,'bamboo_sprites.json'),manifest);json(path.join(rec,'brush-audit.json'),audit);
function drawBase(dst,i,x,foot){const im=sprites[`bamboo_stem_${i}`];blit(dst,im,Math.round(x-im.w/2),foot-im.h);}
function drawTop(dst,i,x,foot){const b=sprites[`bamboo_stem_${i}`];for(const c of manifest.layers[`bamboo_stem_${i}`].clusters)blit(dst,sprites[c.name],Math.round(x-b.w/2)+c.x,foot-b.h+c.y);}
const sheet=canvas(1560,1260,rgb('2a2e2a'));
for(let i=0;i<6;i++){
  const x=16+i*258,stem=sprites[`bamboo_stem_${i}`],leaf=sprites[`bamboo_leaf_${i}`];
  blit(sheet,stem,x,24+(150-stem.h)*3,3);blit(sheet,leaf,x,510,3);
  for(let j=0;j<=i;j++)line(sheet,x+j*7,10,x+j*7+3,10,ramp[5]);
}
for(let i=0;i<3;i++)blit(sheet,sprites[`bamboo_clump_${i}`],18+i*240,710,3);
blit(sheet,ref('pine_a'),800,740,3);blit(sheet,ref('rock_a'),1350,1050,3);blit(sheet,ref('fern_a'),1330,910,3);blit(sheet,dao,70,1020,3);
encodePng(sheet,path.join(rec,'sheet.png'));
const compare=canvas(1080,390,rgb('2a2e2a')),one=canvas(540,195,rgb('2a2e2a'));
for(let i=0;i<3;i++){drawBase(one,i,49+i*96,178);drawTop(one,i,49+i*96,178);}
blit(one,ref('pine_a'),310,17);blit(one,ref('fern_a'),455,151);blit(one,ref('rock_a'),495,140);blit(one,dao,267,114);blit(compare,one,0,0,2);encodePng(compare,path.join(rec,'compare.png'));
const demo=canvas(480,270),tiles=['forest_0','forest_1','forest_2','forest_3'].map(n=>decodePng(path.join(root,`public/assets/terrain/${n}.png`)));
for(let y=0;y<270;y++)for(let x=0;x<480;x++){const tile=tiles[(Math.floor(x/128)+Math.floor(y/128)*3)%tiles.length],p=((y%tile.h)*tile.w+x%tile.w)*4;pixel(demo,x,y,[...tile.data.subarray(p,p+3)]);}
const placements=[[29,154,0],[100,150,3],[208,182,1],[275,152,5],[368,159,2],[451,157,4],[16,263,2],[468,274,3]];
for(const [x,y,i] of placements)drawBase(demo,i,x,y);
for(let i=0;i<3;i++)blit(demo,sprites[`bamboo_clump_${i}`],69+i*146,226-sprites[`bamboo_clump_${i}`].h);
blit(demo,dao,207,104); // First character frame; the near canopy crosses the hat.
for(const [x,y,i] of placements)drawTop(demo,i,x,y);
encodePng(demo,path.join(rec,'demo-1x.png'));
console.log(`GEN bamboo sprites=15 atlas=512x512 sheet=${sheet.w}x${sheet.h} compare=1080x390 demo=480x270 atlas_md5=${createHash('md5').update(readFileSync(path.join(out,'bamboo_atlas.png'))).digest('hex')}`);
