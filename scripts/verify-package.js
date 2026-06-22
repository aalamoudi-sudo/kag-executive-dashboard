const fs=require('fs');
const required=['server.js','package.json','render.yaml','public/index.html','public/style.css','public/script.js','public/manifest.webmanifest','public/service-worker.js'];
let ok=true;
for(const f of required){ if(!fs.existsSync(f)){ console.error('MISSING',f); ok=false; } }
const html=fs.readFileSync('public/index.html','utf8');
for(const name of ['مركز الإشعارات','مركز المهام والمتابعة','ملخص التشغيل','جودة البيانات']){ if(!html.includes(name)){ console.error('UI LABEL MISSING',name); ok=false; } }
const server=fs.readFileSync('server.js','utf8');
for(const endpoint of ['/api/operational-summary','/api/data-quality','/api/action-update','/api/approval-update']){ if(!server.includes(endpoint)){ console.error('ENDPOINT MISSING',endpoint); ok=false; } }
if(server.includes('eval(')){ console.error('UNSAFE eval FOUND'); ok=false; }
if(ok) console.log('KAG package verification passed.');
process.exit(ok?0:1);
