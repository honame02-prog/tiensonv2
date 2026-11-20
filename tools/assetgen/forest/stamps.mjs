import { relieveEdges } from './outline.mjs';
// All marks come from project-owned source pixels. No flip or generated noise.
export function makeBrushes({ ref, decal, canvas, crop, pixel, palettes, gamut, rng }) {
  const used = new Map();
  function color(c, shade=1) {
    // Keep safe source RGB exactly; clamp only the old art's out-of-gamut colors.
    const base=gamut(c), target=base.map(v=>Math.round(v*shade));
    const result=shade===1?base:nearest(target);
    used.set(result.join(','),result);return result;
  }
  const colors=[];
  const sourceNames=[...Array.from({length:10},(_,i)=>`pine_a_f${i}`),...Array.from({length:5},(_,i)=>`pine_b_f${i}`),'pine_a_trunk','pine_b_trunk','fern_a','fern_b','fern_c'];
  const originals=sourceNames.map(ref).concat(Array.from({length:8},(_,i)=>decal(`fern${i+1}`)),Array.from({length:11},(_,i)=>decal(`tuft${i+1}`)));
  const seen=new Set();
  for(const im of originals)for(let p=0;p<im.data.length;p+=4)if(im.data[p+3]){
    const c=gamut([...im.data.subarray(p,p+3)]),key=c.join(',');
    if(!seen.has(key)){seen.add(key);colors.push(c);}
  }
  colors.push(...Object.values(palettes).flat());
  function nearest(c){let best=colors[0],dist=Infinity;for(const q of colors){const d=(q[0]-c[0])**2+(q[1]-c[1])**2+(q[2]-c[2])**2;if(d<dist){dist=d;best=q;}}return best;}
  function stamp(dst,src,dx,dy,shade=1,lean=0){
    dx=Math.round(dx);dy=Math.round(dy);
    for(let y=0;y<src.h;y++)for(let x=0;x<src.w;x++){
      const p=(y*src.w+x)*4;if(src.data[p+3]!==255)continue;
      pixel(dst,dx+x+Math.round(lean*(1-y/Math.max(1,src.h-1))),dy+y,color([...src.data.subarray(p,p+3)],shade));
    }
  }
  function contact(im){
    // Extend the lowest real mark to the bottom; no synthetic pivot speck.
    let bottom=-1;for(let y=0;y<im.h;y++)for(let x=0;x<im.w;x++)if(im.data[(y*im.w+x)*4+3])bottom=y;
    if(bottom<0)throw new Error('empty stamp composition');
    if(bottom<im.h-1){const copy=Buffer.from(im.data);im.data.fill(0);copy.copy(im.data,(im.h-1-bottom)*im.w*4,0,(bottom+1)*im.w*4);}
    return im;
  }
  function tight(im){
    let x0=im.w,y0=im.h,x1=0,y1=0;
    for(let y=0;y<im.h;y++)for(let x=0;x<im.w;x++)if(im.data[(y*im.w+x)*4+3]){x0=Math.min(x0,x);x1=Math.max(x1,x);y0=Math.min(y0,y);y1=Math.max(y1,y);}
    return crop(im,{x:x0,y:y0,w:x1-x0+1,h:y1-y0+1});
  }
  const olive=Array.from({length:10},(_,i)=>ref(`pine_a_f${i}`));
  // Whole source bough masks only: rectangular subdivisions sever leaf tips.
  const cold=['pine_b_f1','pine_b_f2','pine_b_f3','pine_b_f4'].map(ref);
  const audit={canopies:{},trunks:{},bushes:{},grass:{}};
  function canopy(w,h,variant,kind){
    const pad=14,im=canvas(w+pad*2,h+pad*2),r=rng(8300+variant*101),brushes=kind==='cold'?cold:olive;
    const crowns=variant%3===1?4:3,marks=[];
    for(let c=0;c<crowns;c++){
      const cx=(c+.45+(r()-.5)*.3)*w/crowns;
      const top=2+r()*11+(c%2)*5,base=h-1-r()*5;
      // Four irregular narrowing rings describe each rounded cone. Rings are
      // independently offset in x/y, then depth-sorted; never horizontal rows.
      const count=crowns===4?15:20;
      for(let i=0;i<count;i++){
        const t=i/(count-1),pool=kind==='olive'&&r()<.8?olive.slice(0,5):brushes;
        const brush=pool[Math.floor(r()*pool.length)];
        const spread=(w/crowns)*(.08+.55*Math.sin(t*Math.PI*.68));
        const x=pad+Math.max(0,Math.min(w-brush.w,cx+(r()*2-1)*spread-brush.w/2));
        const y=pad+Math.max(0,Math.min(h-brush.h-3,top+t*(base-top-brush.h)+(r()-.5)*9));
        marks.push({brush,x,y,depth:c+(r()-.5)*.3,shade:i>count*.76?(kind==='cold'?.9:.6):i>count*.42?.92:1});
      }
    }
    // Rear crowns and hanging lower boughs darken first; foreground top lips
    // retain their source texture and gamut-safe highlights.
    marks.sort((a,b)=>a.depth-b.depth||b.y-a.y);
    // The dark silhouette is made of the same serrated alpha masks, offset
    // a few pixels down/right. It connects the wall without a geometric fill.
    for(const m of marks)stamp(im,m.brush,m.x+1,m.y+2,kind==='cold'?.9:.6);
    for(const m of marks)stamp(im,m.brush,m.x,m.y,m.shade);
    // Fill enclosed pinholes with nearby leaf tones; keep the exterior and
    // its open saddles transparent instead of painting large black voids.
    w=im.w;h=im.h;
    const outside=new Uint8Array(w*h),queue=[];
    const add=(x,y)=>{const p=y*w+x;if(!outside[p]&&!im.data[p*4+3]){outside[p]=1;queue.push(p);}};
    for(let x=0;x<w;x++){add(x,0);add(x,h-1);}for(let y=0;y<h;y++){add(0,y);add(w-1,y);}
    for(let i=0;i<queue.length;i++){const p=queue[i],x=p%w,y=Math.floor(p/w);if(x)add(x-1,y);if(x<w-1)add(x+1,y);if(y)add(x,y-1);if(y<h-1)add(x,y+1);}
    const holes=[];
    for(let y=0;y<h;y++)for(let x=0;x<w;x++)if(!outside[y*w+x]&&!im.data[(y*w+x)*4+3])holes.push([x,y]);
    for(const [x,y] of holes){
      let chosen=null;
      for(let d=1;d<=Math.max(w,h)&&!chosen;d++)for(const [xx,yy] of [[x-d,y],[x+d,y],[x,y-d],[x,y+d]]){
        if(xx<0||yy<0||xx>=w||yy>=h)continue;const p=(yy*w+xx)*4;
        if(im.data[p+3]===255){chosen=[...im.data.subarray(p,p+3)];break;}
      }
      pixel(im,x,y,color(chosen,.95));
    }
    for(let y=0;y<h;y++)for(let x=0;x<w;x++)if(im.data[(y*w+x)*4+3]===255&&(x<12||y<12||x>=w-12||y>=h-12))throw new Error('canopy stamp escaped 12px safety margin');
    audit.canopies[`canopy_${variant}`]={crowns,stamps:marks.length,shadowStamps:marks.length,padding:pad,source:kind==='cold'?'pine_b_f1..f4':'pine_a_f0..f9',flipX:false};
    return tight(relieveEdges(im));
  }
  // Continuous longitudinal bark: source root rectangles caused cross-cut seams.
  function trunkrow(variant){
    const im=canvas(128,40),r=rng(9700+variant*73),stems=[];
    for(let x=-3;x<128;){
      const width=3+Math.floor(r()*8),foot=32+Math.floor(r()*8);
      stems.push({x,width,foot,lean:(r()-.5)*4,phase:r()*6.28,
        flare:1+Math.floor(r()*3),grain:Array.from({length:width},()=>r())});
      x+=width+5+Math.floor(r()*18);
    }
    // Opaque palette steps and a sparse edge soften the ground shadow; shadows
    // precede every stem so they can never overwrite bark with a horizontal cut.
    for(const s of stems){
      const cx=s.x+s.width/2+1,rx=s.width/2+s.flare+4;
      const cy=(s.foot+39)/2,ry=(39-s.foot)/2+1;
      for(let y=s.foot-1;y<40;y++)for(let x=Math.floor(cx-rx);x<=cx+rx;x++){
        const d=((x-cx)/rx)**2+((y-cy)/ry)**2;
        if(d>1||d>.65&&(x*3+y*7+variant)%5<2)continue;
        const c=d<.35?palettes.cold[1]:d<.7?palettes.cold[2]:palettes.fern[1];
        pixel(im,x,y,color(c));
      }
      // One central contact keeps even a high rear foot grounded in the shade.
      for(let y=s.foot;y<40;y++)pixel(im,Math.round(cx),y,color(palettes.cold[1]));
    }
    for(const s of stems){
      for(let y=0;y<=s.foot;y++){
        const t=y/s.foot,root=Math.max(0,(y-s.foot+5)/5);
        const flare=Math.floor(root*s.flare);
        const bend=Math.round(s.lean*(1-t)+Math.sin(t*3+s.phase)*.65);
        for(let xx=-flare;xx<s.width+flare;xx++){
          const u=Math.max(0,Math.min(s.width-1,xx));
          // Each fibre changes tone at its own height. No sampled image rows,
          // root stamps, or common horizontal transition can cross the stem.
          const fibre=s.grain[u],fade=Math.max(0,Math.min(1,(y-3-fibre*12)/24));
          const lit=xx<s.width*.4?1:0;
          let level=1+Math.floor(fade*2)+lit;
          if(fibre>.68&&y>8+u*2)level--;
          if(xx===s.width-1||xx===s.width+flare-1)level=Math.max(1,level-1);
          // A thin winding highlight reads as bark rather than flat fence wood.
          if(xx===Math.floor(s.width*.27+Math.sin(y*.12+s.phase)*.7)&&y>15+fibre*7)level++;
          // Interrupt equal-colour plateaus with longitudinal dark fissures.
          level=(xx+flare)%4===3?0:Math.max(1,level);
          pixel(im,s.x+bend+xx,y,color(palettes.wood[Math.min(5,level)]));
        }
      }
    }
    audit.trunks[`trunkrow_${variant}`]={positions:stems.map(s=>s.x),width:[3,10],
      height:stems.map(s=>s.foot+1),rootFlare:stems.map(s=>s.flare),
      continuousBark:true,rootStamps:false,shadow:'opaque stepped feather',flipX:false};
    return im;
  }
  function bush(w,h,v){
    const im=canvas(w,h),r=rng(12500+v*127),count=3+v;
    const brushes=[ref('fern_a'),ref('fern_b'),ref('fern_c'),...Array.from({length:8},(_,i)=>decal(`fern${i+1}`))];
    const marks=[];for(let i=0;i<count;i++){const s=brushes[(i*3+v)%brushes.length];marks.push({s,x:(w-s.w)*(i/Math.max(1,count-1))+(r()-.5)*5,y:h-s.h-r()*5});}
    marks.sort((a,b)=>a.y-b.y);for(let i=0;i<marks.length;i++){const m=marks[i];stamp(im,m.s,m.x,m.y,i<count/2?.7:1);}
    audit.bushes[`bush_${v}`]={stamps:count,flipX:false};return contact(im);
  }
  function grass(w,h,v){
    const im=canvas(w,h),r=rng(15100+v*233),count=2+v%3;
    for(let i=0;i<count;i++){const s=decal(`tuft${1+(v*3+i*4)%11}`);stamp(im,s,(w-s.w)/2+(r()-.5)*8,h-s.h-r()*3,i===0?.7:1);}
    audit.grass[`tallgrass_${v}`]={stamps:count,flipX:false};return contact(im);
  }
  return {canopy,trunkrow,bush,grass,used,audit};
}
