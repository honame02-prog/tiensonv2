import { chromium } from '../../area_tool_runtime.mjs';
import { prepareSceneShot, writeShot2x } from '../../scene_shot.mjs';
import { spawn, execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
const rec='records/CM-WALL2'; mkdirSync(rec,{recursive:true});
let server,browser;
const frames=[['v1','0,17.78125','4.15,22.6'],['west','1,25','8.2,31;10,29'],['east','25,15','31.7,20.6;35,23']];
const cmds=[];
try {
 server=spawn(process.execPath,['tools/area_tool_vite.mjs','--port','5198'],{stdio:'pipe',windowsHide:true});
 server.stdout.on('data',b=>process.stdout.write(b));server.stderr.on('data',b=>process.stderr.write(b));
 for(let i=0;i<100;i++){try{if((await fetch('http://127.0.0.1:5198/')).ok)break;}catch{}await new Promise(r=>setTimeout(r,200));}
 browser=await chromium.launch({args:['--use-gl=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});
 for(const when of ['before','after'])for(const [name,view,actors] of frames){
 const page=await browser.newPage({viewport:{width:480,height:270},deviceScaleFactor:1});const errors=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
 if(when==='before')await page.route('**/assets/**',async route=>{
  const path=new URL(route.request().url()).pathname.slice(1);
  if(path==='assets/areas/huyen-van-quan-v2/area.json'||path.startsWith('assets/kits/CM-WALL/')){
   const body=execFileSync('git',['show',`3af2339:public/${path}`]);
   await route.fulfill({body,contentType:path.endsWith('.json')?'application/json':'image/png'});
  }else await route.continue();
 });
 await page.addInitScript(()=>{Math.random=()=>.5});await page.goto('http://127.0.0.1:5198/?area=huyen-van-quan-v2',{waitUntil:'load'});
 await page.waitForFunction(()=>window.__scene?.player?.active&&__scene.fx,null,{timeout:30000});
 await prepareSceneShot(page,{view:view.split(',').map(Number),actors:actors.split(';').map(s=>s.split(',').map(Number))});
 await page.waitForTimeout(100); if(errors.length)throw Error(errors.join('\n'));
 const out=`${rec}/${when}-${name}.png`;await page.locator('canvas').screenshot({path:out});writeShot2x(out);
 console.log(`PASS scene_shot ${when} ${name}: 480x270 view=${view} actors=${actors} console errors=0; ${out}`);
 cmds.push(`${when==='before'?'# baseline assets intercepted from git 3af2339\n':''}node tools/scene_shot.mjs --area huyen-van-quan-v2 --view ${view} --actors "${actors}" --out ${out}`);
 await page.close();
 }
 writeFileSync(`${rec}/cmds.txt`,'Reproduce exact baseline via: node tools/sprites/CM-WALL/shots.mjs\n'+cmds.join('\n')+'\n');
}finally{await browser?.close();server?.kill();}
