// Measure actual alpha edges adjacent to the exterior, never internal texture.
export function straightEdges(im,limit=6){
 const {w,h,data}=im,solid=(x,y)=>x>=0&&y>=0&&x<w&&y<h&&data[(y*w+x)*4+3]===255;
 const outside=new Uint8Array(w*h),q=[];
 const add=(x,y)=>{const i=y*w+x;if(!outside[i]&&!solid(x,y)){outside[i]=1;q.push(i);}};
 for(let x=0;x<w;x++){add(x,0);add(x,h-1);}for(let y=0;y<h;y++){add(0,y);add(w-1,y);}
 for(let k=0;k<q.length;k++){let i=q[k],x=i%w,y=(i/w)|0;if(x)add(x-1,y);if(x+1<w)add(x+1,y);if(y)add(x,y-1);if(y+1<h)add(x,y+1);}
 const exterior=(x,y)=>x<0||y<0||x>=w||y>=h||outside[y*w+x];
 const runs=[];
 for(const [dx,dy]of [[0,-1],[0,1],[-1,0],[1,0]]){
  const horizontal=dy!==0,lines=horizontal?h:w,length=horizontal?w:h;
  for(let a=0;a<lines;a++){let start=-1;
   for(let b=0;b<=length;b++){
    const x=horizontal?b:a,y=horizontal?a:b,edge=b<length&&solid(x,y)&&exterior(x+dx,y+dy);
    if(edge&&start<0)start=b;
    if(!edge&&start>=0){if(b-start>limit)runs.push({x:horizontal?start:a,y:horizontal?a:start,length:b-start,dx,dy});start=-1;}
   }
  }
 }
 return runs;
}
// Sub-pixel leaf tips cannot survive a long flat source boundary. Reveal a
// one-pixel transparent saddle at its midpoint, retaining all other source RGB.
export function relieveEdges(im){
 for(let pass=0;pass<64;pass++){
  const runs=straightEdges(im);if(!runs.length)return im;
  for(const r of runs){const d=Math.floor(r.length/2),x=r.x+(r.dy?d:0),y=r.y+(r.dx?d:0);im.data.fill(0,(y*im.w+x)*4,(y*im.w+x)*4+4);}
 }
 throw new Error('leaf edge relief did not converge');
}
