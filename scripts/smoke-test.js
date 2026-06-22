const http=require('http');
const {spawn}=require('child_process');
const port=process.env.PORT||3100;
const env=Object.assign({}, process.env, {PORT:String(port), REQUIRE_LOGIN:'false'});
const child=spawn(process.execPath,['server.js'],{env,stdio:['ignore','pipe','pipe']});
function get(path){return new Promise((resolve,reject)=>{http.get({host:'127.0.0.1',port,path,timeout:5000},res=>{let d='';res.on('data',c=>d+=c);res.on('end',()=>resolve({status:res.statusCode,body:d}));}).on('error',reject);});}
(async()=>{try{await new Promise(r=>setTimeout(r,1200));
for(const path of ['/api/health','/api/state','/api/operational-summary','/api/data-quality']){const r=await get(path); if(r.status!==200) throw new Error(path+' status '+r.status); console.log('OK',path);}
process.exitCode=0;}catch(e){console.error('SMOKE FAIL',e.message);process.exitCode=1;}finally{child.kill();}})();
