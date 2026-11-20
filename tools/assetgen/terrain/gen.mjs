import {mkdirSync,writeFileSync,readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {encodePng} from '../../png.mjs';
import {OUT,MATERIALS,load,rng,canvas,crop,pixel,error,mincut} from './lib.mjs';
const started=performance.now();mkdirSync(OUT,{recursive:true});
const ground=load('public/assets/sect/ground_bake.png');
const grass=crop(ground,[140,24,148,260]),soil=crop(ground,[246,978,60,45]);
const ramps={stone:['34342f','3d3b38','48453f','54504c','69635e'],needle:['342e24','413a30','44402a','524e33']};
const rgb=h=>h.match(/../g).map(x=>parseInt(x,16));
const colors=Object.fromEntries(Object.entries(ramps).map(([k,v])=>[k,v.map(rgb)]));
function candidates(src,b,brown){const out=[];for(let y=0;y<=src.h-b;y+=2)for(let x=0;x<=src.w-b;x+=2){let green=0;for(let j=0;j<b;j++)for(let i=0;i<b;i++){const c=pixel(src,x+i,y+j);if(c[1]>c[0])green++;}if(!brown||green===0)out.push([x,y]);}if(!out.length)throw Error('No clean source patches');return out;}
// Efros/Freeman quilting: 32/8 grass and 12/6 soil, source pixels only.
function quilt(src,seed,b=32,ov=8,brown=false){const r=rng(seed),o=canvas(160,160),pool=candidates(src,b,brown),step=b-ov;
 for(let y=0;y<160;y+=step)for(let x=0;x<160;x+=step){let choices=[];for(let n=0;n<48;n++){const [sx,sy]=pool[Math.floor(r()*pool.length)];let e=0;for(let j=0;j<b&&y+j<160;j++)for(let i=0;i<b&&x+i<160;i++)if((x&&i<ov)||(y&&j<ov))e+=error(pixel(o,x+i,y+j),pixel(src,sx+i,sy+j));choices.push({sx,sy,e});}choices.sort((a,b)=>a.e-b.e);const {sx,sy}=choices[Math.floor(r()*Math.min(4,choices.length))];const W=Math.min(b,160-x),H=Math.min(b,160-y);
 const left=x?mincut(ov,H,(i,j)=>error(pixel(o,x+i,y+j),pixel(src,sx+i,sy+j))):null;
 const top=y?mincut(ov,W,(j,i)=>error(pixel(o,x+i,y+j),pixel(src,sx+i,sy+j))):null;
 for(let j=0;j<H;j++)for(let i=0;i<W;i++)if(!(left&&i<left[j])&&!(top&&j<top[i]))o.data.set(pixel(src,sx+i,sy+j),((y+j)*160+x+i)*4);
 }
 // Minimum-error overlaps join opposite sides on a torus (no mirroring).
 const v=mincut(32,160,(x,y)=>error(pixel(o,x,y),pixel(o,x+128,y))),a=canvas(128,160);
 for(let y=0;y<160;y++)for(let x=0;x<128;x++)a.data.set(pixel(o,x<32&&x<v[y]?x+128:x,y),(y*128+x)*4);
 const h=mincut(32,128,(y,x)=>error(pixel(a,x,y),pixel(a,x,y+128))),t=canvas(128,128);
 for(let y=0;y<128;y++)for(let x=0;x<128;x++)t.data.set(pixel(a,x,y<32&&y<h[x]?y+128:y),(y*128+x)*4);
 return t;
}
function endpoints(t){for(let y=0;y<128;y++)t.data.set(pixel(t,0,y),(y*128+127)*4);for(let x=0;x<128;x++)t.data.set(pixel(t,x,0),(127*128+x)*4);return t;}
// Generate the common boundary first; overlap cuts inside it retain >=8 locked pixels.
function fill(common,own,mat){const cuts=[];for(let side=0;side<4;side++)cuts.push(mincut(8,128,(d,k)=>{const x=side===0?8+d:side===1?119-d:k,y=side===2?8+d:side===3?119-d:k;return error(pixel(common,x,y),pixel(own,x,y))+d*(mat==='dirt'?8:160);}));const o=canvas(128,128);for(let y=0;y<128;y++)for(let x=0;x<128;x++){const interior=x>=8+cuts[0][y]&&x<=119-cuts[1][y]&&y>=8+cuts[2][x]&&y<=119-cuts[3][x];o.data.set(pixel(interior?own:common,x,y),(y*128+x)*4);}return endpoints(o);}
function decorate(t,mat,seed){const r=rng(seed),put=(x,y,c)=>t.data.set([...c,255],(((y+128)%128)*128+(x+128)%128)*4);
 if(mat==='forest'){
  for(let p=0;p<t.data.length;p+=4)for(let c=0;c<3;c++)t.data[p+c]=Math.round(t.data[p+c]*[.66,.74,.70][c]);
  for(let n=0;n<12;n++){const x=4+Math.floor(r()*116),y=4+Math.floor(r()*116),w=6+Math.floor(r()*7),h=3+Math.floor(r()*5),sx=Math.floor(r()*(soil.w-w)),sy=Math.floor(r()*(soil.h-h));for(let j=0;j<h;j++)for(let i=0;i<w;i++)if((i-w/2)**2/(w*w/4)+(j-h/2)**2/(h*h/4)<.8){const c=pixel(soil,sx+i,sy+j);if(c[0]>=c[1])put(x+i,y+j,[...c.subarray(0,3)].map(v=>Math.round(v*.7)));}}
  for(let n=0;n<170;n++){const x=Math.floor(r()*128),y=Math.floor(r()*128),len=3+Math.floor(r()*3),c=colors.needle[Math.floor(r()*4)];for(let j=0;j<len;j++)put(x+Math.floor(j/3),y+j,c);}
 }
 if(mat==='gravel')for(let p=0;p<t.data.length;p+=4)for(let c=0;c<3;c++)t.data[p+c]=Math.round(t.data[p+c]*.9);
 if(mat==='dirt'){
  // Rank source texture into brown earth with muted ochre grains, never pale grey patches.
  // Every colour occurs in the source soil or STYLE section 5; no RGB blending.
  const ramp=[[61,62,55],[86,74,69],[102,89,81],[98,94,62]];
  const ranks=Array.from({length:16384},(_,i)=>({i,v:t.data[i*4]*.2126+t.data[i*4+1]*.7152+t.data[i*4+2]*.0722+r()*2})).sort((a,b)=>a.v-b.v);
  for(let k=0;k<ranks.length;k++){
   const band=k<2458?0:k<3441?1:k<15073?2:3;
   t.data.set([...ramp[band],255],ranks[k].i*4);
  }
  // Sparse, irregular tufts stay clear of all shared edges (at most 210 pixels).
  for(let n=0;n<42;n++){
   const x=18+Math.floor(r()*90),y=18+Math.floor(r()*90);
   const c=[70,88,63];
   for(const [dx,dy] of [[0,0],[0,-1],[1,1],[-1,1],[0,1]])put(x+dx,y+dy,c);
  }
 }
 if(mat==='dirt'||mat==='gravel'){const count=Math.round(16384/(mat==='dirt'?160:20));for(let n=0;n<count;n++){const x=Math.floor(r()*128),y=Math.floor(r()*128),w=2+Math.floor(r()*(mat==='dirt'?3:5)),h=Math.max(2,Math.round(w*.65));for(let j=0;j<h;j++)for(let i=0;i<w;i++){if((i===0||i===w-1)&&(j===0||j===h-1)&&w>3)continue;put(x+i,y+j,colors.stone[j===h-1?0:i===0||j===0?3:2]);}put(x,y,colors.stone[4]);put(x+w-1,y+h-1,colors.stone[0]);}}
 return t;
}
for(let m=0;m<4;m++){const mat=MATERIALS[m],isSoil=m>1,src=isSoil?soil:grass,b=m===2?10:isSoil?12:32,ov=isSoil?6:8;
 const boundary=decorate(quilt(src,4201+m*997+(m===1?37:0),b,ov,isSoil),mat,717+m);
 const common=endpoints(boundary);
 for(let v=0;v<4;v++){const t=fill(common,decorate(quilt(src,9013+m*1009+v*337+(m===1?37:0),b,ov,isSoil),mat,8001+m*503+v*157),mat),file=`${mat}_${v}.png`;encodePng(t,resolve(OUT,file));console.log(`MD5 ${file} ${createHash('md5').update(readFileSync(resolve(OUT,file))).digest('hex')}`);}
}
writeFileSync(resolve(OUT,'terrain.json'),JSON.stringify({tile:128,version:2,method:'source-pixel minimum-error quilting; toroidal overlap; shared outer 8px',sources:{grass:[140,24,148,260],dirt:[246,978,60,45]},materials:Object.fromEntries(MATERIALS.map(m=>[m,Array.from({length:4},(_,i)=>`${m}_${i}.png`)]))},null,2)+'\n','utf8');
console.log(`GEN ${(performance.now()-started).toFixed(1)} ms; 16 opaque tiles 128x128`);
