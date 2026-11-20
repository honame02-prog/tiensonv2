import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
import {decodePng} from '../../png.mjs';
export const ROOT=fileURLToPath(new URL('../../../',import.meta.url));
export const OUT=resolve(ROOT,'public/assets/terrain'), RECORDS=resolve(ROOT,'records/assetgen/terrain');
export const MATERIALS=['grass','forest','dirt','gravel'];
export const load=p=>decodePng(readFileSync(resolve(ROOT,p)));
export function rng(seed){return ()=>{let t=seed+=0x6d2b79f5;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return ((t^(t>>>14))>>>0)/4294967296;};}
export function canvas(w,h,c=[42,46,42]){const data=Buffer.alloc(w*h*4);for(let p=0;p<data.length;p+=4)data.set([...c,255],p);return {w,h,data};}
export function blit(dst,src,dx,dy,scale=1,rect=[0,0,src.w,src.h]){for(let y=0;y<rect[3];y++)for(let x=0;x<rect[2];x++){const p=((rect[1]+y)*src.w+x+rect[0])*4;if(!src.data[p+3])continue;for(let j=0;j<scale;j++)for(let i=0;i<scale;i++){const X=dx+x*scale+i,Y=dy+y*scale+j;if(X>=0&&Y>=0&&X<dst.w&&Y<dst.h)dst.data.set(src.data.subarray(p,p+4),(Y*dst.w+X)*4);}}}
export function crop(src,r){const o=canvas(r[2],r[3]);blit(o,src,0,0,1,r);return o;}
export function mean(im){const s=[0,0,0];for(let p=0;p<im.data.length;p+=4)for(let c=0;c<3;c++)s[c]+=im.data[p+c];return s.map(v=>v/(im.w*im.h));}
export const luma=c=>c[0]*.2126+c[1]*.7152+c[2]*.0722;
export const pixel=(im,x,y)=>im.data.subarray((y*im.w+x)*4,(y*im.w+x)*4+4);
export function error(a,b){let s=0;for(let c=0;c<3;c++)s+=(a[c]-b[c])**2;return s;}
// Dynamic-programming minimum-error path, one position per row; never blend pixels.
export function mincut(w,h,cost){const dp=new Float64Array(w*h),prev=new Int16Array(w*h);for(let x=0;x<w;x++)dp[x]=cost(x,0);for(let y=1;y<h;y++)for(let x=0;x<w;x++){let k=x;for(let d=-1;d<=1;d++)if(x+d>=0&&x+d<w&&dp[(y-1)*w+x+d]<dp[(y-1)*w+k])k=x+d;dp[y*w+x]=dp[(y-1)*w+k]+cost(x,y);prev[y*w+x]=k;}let k=0;for(let x=1;x<w;x++)if(dp[(h-1)*w+x]<dp[(h-1)*w+k])k=x;const path=new Int16Array(h);for(let y=h-1;y>=0;y--){path[y]=k;k=prev[y*w+k];}return path;}
export function mosaic(tiles,seed,w=960,h=540){const o=canvas(w,h),r=rng(seed);for(let y=0;y<h;y+=128)for(let x=0;x<w;x+=128)blit(o,tiles[Math.floor(r()*tiles.length)],x,y);return o;}
