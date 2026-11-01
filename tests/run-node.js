/* Runs the real data-layer modules (00,10,15,20,30,40) against the in-memory IndexedDB emulator. */
const fs=require('fs'),path=require('path'),{webcrypto}=require('crypto');
globalThis.indexedDB=require('./idb-emulator')();
if(!globalThis.crypto)globalThis.crypto=webcrypto;
// Test-only stand-in for the browser sanitiser (the in-app self-test uses the real one).
globalThis.clean=h=>String(h||'').replace(/<script[\s\S]*?<\/script>/gi,'').replace(/\son\w+=("[^"]*"|'[^']*'|[^\s>]+)/gi,'').replace(/<img(?![^>]*src="data:image)[^>]*>/gi,'');
const src=['00-core.js','10-db.js','15-digest.js','20-migrate.js','30-backup.js','40-integrity.js'].map(f=>fs.readFileSync(path.join(__dirname,'../src/js',f),'utf8')).join('\n');
const vm=require('vm');vm.runInThisContext(src+'\nglobalThis.__T={runSelfTests,verifyDB};',{filename:'evermore-data-layer.js'});
(async()=>{const n=+process.argv[2]||400,st=+process.argv[3]||1500,t0=Date.now(),res=await globalThis.__T.runSelfTests({n,stress:st});
  const out=res.map((r,i)=>`${r.ok?'PASS':'FAIL'}  ${String(i+1).padStart(2,'0')}  ${r.name}  [${r.ms} ms]${r.detail?'\n        '+r.detail:''}`).join('\n');
  console.log(out);const f=res.filter(r=>!r.ok).length;console.log(`\n${res.length-f}/${res.length} passed, ${f} failed, ${Date.now()-t0} ms total`);
  fs.mkdirSync(path.join(__dirname,'../build'),{recursive:true});fs.writeFileSync(path.join(__dirname,'../build/last-run.json'),JSON.stringify({at:new Date().toISOString(),node:process.version,n,stress:st,res},null,1));process.exit(f?1:0)})();
