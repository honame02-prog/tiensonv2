// Run existing layer regression checks through the installed dependency resolver.
// Vite lifecycle is owned here; no asset, test or source mutation.
import { spawn } from 'node:child_process';
import { mkdirSync, createWriteStream } from 'node:fs';
import { chromium } from '../../area_tool_runtime.mjs';
import assert from 'node:assert/strict';
const root = new URL('../../../', import.meta.url);
process.chdir(root.pathname.replace(/^\/([A-Za-z]:)/,'$1'));
mkdirSync('records/CM-GATE',{recursive:true});
const base='http://127.0.0.1:5206/';
const server=spawn(process.execPath,['tools/area_tool_vite.mjs','--port','5206'],{stdio:'pipe',windowsHide:true});
let browser;
const run = (file,log) => new Promise((resolve,reject)=>{
  const out=createWriteStream(`records/CM-GATE/${log}`);
  const p=spawn(process.execPath,['--import','./tools/area_tool_runtime.mjs',file,base],{stdio:['ignore','pipe','pipe'],windowsHide:true});
  p.stdout.pipe(out); p.stderr.pipe(out);
  const timer=setTimeout(()=>{p.kill();reject(new Error(`${file} timeout 120s`));},120000);
  p.on('exit',code=>{clearTimeout(timer);out.end();code===0?resolve():reject(new Error(`${file} exit ${code}`));});
});
try {
  for(let i=0;i<100;i++) { try {if((await fetch(base)).ok)break;}catch{} await new Promise(r=>setTimeout(r,200)); }
  browser=await chromium.launch({args:['--use-gl=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});
  const page=await browser.newPage({viewport:{width:480,height:270}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base+'?area=huyen-van-quan-v2');
  await page.waitForFunction(()=>window.__scene?.player?.active&&__scene.fx,null,{timeout:30000});
  const count=await page.evaluate(()=>__scene.kitImages.filter(im=>im.getData('kitPiece')?.startsWith('CM-WALL/')).length);
  assert.equal(count,4); console.log('PASS runtime: CM-WALL 2 base + 2 paired roofs loaded');
  const tele=async(x,y)=>{await page.evaluate(([x,y])=>{const s=__scene;s.player.setPosition(x,y).setVelocity(0,0);s.lastGood={x,y};s.tier=null;},[x,y]);await page.waitForTimeout(300);};
  await tele(138,650); await page.waitForTimeout(500);
  const roofs=await page.evaluate(()=>__scene.roofs.filter(r=>r.img.getData('kitPiece')==='CM-WALL/moongate_h_roof').map(r=>({alpha:r.img.alpha,depth:r.img.depth,mask:r.rects.length})));
  assert.equal(roofs.length,2); assert(roofs.every(r=>r.mask>1&&r.depth>1600));
  assert(roofs.some(r=>r.alpha<=.351),'roof fade when Dao Si under arch');
  console.log('PASS runtime: roof above actor, pixel masks active, arch fades '+JSON.stringify(roofs));
  assert.equal(errors.length,0,errors.join('\n'));
  await browser.close();browser=null;
  await run('tools/area_layers_test.mjs','layers.log');
  console.log('PASS existing area_layers_test (see records/CM-GATE/layers.log)');
  await run('tools/blockout_walk.mjs','walk.log');
  console.log('PASS existing blockout_walk (see records/CM-GATE/walk.log)');
} finally {await browser?.close();server.kill();}
