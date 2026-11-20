import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {decodePng} from '../../png.mjs';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../../..');
const im=decodePng(path.join(root,'public/assets/bamboo/bamboo_atlas.png'));
const frames=JSON.parse(readFileSync(path.join(root,'public/assets/bamboo/bamboo_atlas.json'),'utf8')).frames;
const audit=JSON.parse(readFileSync(path.join(root,'records/assetgen/bamboo/brush-audit.json'),'utf8'));
const cross=(o,a,b)=>(a[0]-o[0])*(b[1]-o[1])-(a[1]-o[1])*(b[0]-o[0]);
for(let i=0;i<6;i++){
 const f=frames[`bamboo_leaf_${i}`].frame,pts=[];let count=0;
 // Hull of occupied pixel squares gives an area measured in whole pixels.
 for(let y=0;y<f.h;y++)for(let x=0;x<f.w;x++)if(im.data[((f.y+y)*im.w+f.x+x)*4+3]){
  count++;pts.push([x,y],[x+1,y],[x,y+1],[x+1,y+1]);
 }
 pts.sort((a,b)=>a[0]-b[0]||a[1]-b[1]);const lo=[],up=[];
 for(const q of pts){while(lo.length>1&&cross(lo.at(-2),lo.at(-1),q)<=0)lo.pop();lo.push(q);}
 for(const q of pts.slice().reverse()){while(up.length>1&&cross(up.at(-2),up.at(-1),q)<=0)up.pop();up.push(q);}
 const hull=lo.slice(0,-1).concat(up.slice(0,-1));let area=0;
 for(let k=0;k<hull.length;k++){const a=hull[k],b=hull[(k+1)%hull.length];area+=a[0]*b[1]-a[1]*b[0];}
 const coverage=count/(Math.abs(area)/2),height=f.h/frames[`bamboo_stem_${i}`].frame.h;
 assert(coverage>=.60&&coverage<=.75,`crown ${i}: coverage ${coverage}`);
 assert(height>=.25&&height<=.40,`crown ${i}: top height ${height}`);
 const stems=audit.stems[`bamboo_stem_${i}`].stems,sorted=stems.slice().sort((a,b)=>a.baseX-b.baseX),gaps=sorted.slice(1).map((s,j)=>s.baseX-sorted[j].baseX);
 assert(gaps.every(g=>g>=2-1e-6&&g<=14+1e-6));
 assert(stems.filter(s=>s.rear).length>=1&&stems.filter(s=>s.rear).length<=2);
 assert(stems.every(s=>s.branchCount>=2&&s.branchCount<=4));
 console.log(`CROWN ${i} size=${f.w}x${f.h} hull_coverage=${(coverage*100).toFixed(1)}% top_height=${(height*100).toFixed(1)}% base_gaps=${gaps.join(',')} rear=${stems.filter(s=>s.rear).length} branches=${stems.map(s=>s.branchCount).join(',')}`);
}
console.log('PASS bamboo geometry crowns=6 coverage=60..75% top_height=25..40% base_gaps=2..14px rear=1..2 branches=2..4');
