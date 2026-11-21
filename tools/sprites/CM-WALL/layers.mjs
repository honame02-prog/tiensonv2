import {spawn} from 'node:child_process';
let server;
try {
 server=spawn(process.execPath,['tools/area_tool_vite.mjs','--port','5195'],{stdio:'inherit',windowsHide:true});
 for(let i=0;i<80;i++){try{if((await fetch('http://127.0.0.1:5195/')).ok)break;}catch{}await new Promise(r=>setTimeout(r,200));}
 const args=['--import','./tools/area_tool_runtime.mjs','tools/area_layers_test.mjs','http://127.0.0.1:5195/'];
 const p=spawn(process.execPath,args,{stdio:'inherit',windowsHide:true});
 const code=await new Promise(r=>p.on('exit',r));process.exitCode=code;
}finally{server?.kill();}
