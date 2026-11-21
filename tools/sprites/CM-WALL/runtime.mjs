// Verify the expanded kit using the real loader, actor ordering and alpha masks.
import {spawn} from 'node:child_process';
import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import {chromium} from '../../area_tool_runtime.mjs';
const area=JSON.parse(readFileSync('public/assets/areas/huyen-van-quan-v2/area.json','utf8'));
const kit=JSON.parse(readFileSync('public/assets/kits/CM-WALL/kit.json','utf8'));
const expected=area.pieces.filter(p=>p.k.startsWith('CM-WALL/')).reduce((n,p)=>n+1+(kit.pieces[p.k.split('/')[1]].pair?1:0),0);
let server,browser;
try{
 server=spawn(process.execPath,['tools/area_tool_vite.mjs','--port','5194'],{stdio:'pipe',windowsHide:true});
 for(let i=0;i<80;i++){try{if((await fetch('http://127.0.0.1:5194/')).ok)break;}catch{}await new Promise(r=>setTimeout(r,200));}
 browser=await chromium.launch({args:['--use-gl=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});
 const page=await browser.newPage({viewport:{width:480,height:270}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
 await page.goto('http://127.0.0.1:5194/?area=huyen-van-quan-v2');
 await page.waitForFunction(()=>window.__scene?.player?.active&&__scene.fx,null,{timeout:30000});
 const count=await page.evaluate(()=>__scene.kitImages.filter(im=>im.getData('kitPiece')?.startsWith('CM-WALL/')).length);
 assert.equal(count,expected);console.log(`PASS runtime: ${count}/${expected} CM-WALL base+paired roof images loaded`);
 await page.evaluate(()=>{const s=__scene;s.player.setPosition(138,650).setVelocity(0,0);s.lastGood={x:138,y:650};s.tier=null;});
 await page.waitForTimeout(800);
 const roofs=await page.evaluate(()=>__scene.roofs.filter(r=>r.img.getData('kitPiece')==='CM-WALL/moongate_h_roof').map(r=>({alpha:r.img.alpha,depth:r.img.depth,mask:r.rects.length})));
 assert.equal(roofs.length,2);assert(roofs.every(r=>r.mask>1&&r.depth>1600));assert(roofs.some(r=>r.alpha<=.351));
 assert.equal(errors.length,0,errors.join('\n'));console.log('PASS runtime: approved arch roof above actor, pixel-mask fade=0.35; console errors=0');
 await browser.close();browser=null;
 const walk=spawn(process.execPath,['--import','./tools/area_tool_runtime.mjs','tools/blockout_walk.mjs','http://127.0.0.1:5194/'],{stdio:'inherit',windowsHide:true});
 const timeout=setTimeout(()=>walk.kill(),120000);const code=await new Promise(r=>walk.on('exit',r));clearTimeout(timeout);assert.equal(code,0);
 console.log('PASS existing blockout_walk');
}finally{await browser?.close();server?.kill();}
