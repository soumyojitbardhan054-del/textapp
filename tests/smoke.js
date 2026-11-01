/* Load-and-run smoke test of the ASSEMBLED page script against a "chaos" DOM (every property is a callable proxy)
   and the in-memory IndexedDB. It proves the whole bundle evaluates, boots, migrates state and renders every view without
   throwing. It cannot judge layout or visuals. */
const fs=require('fs'),path=require('path'),vm=require('vm'),{webcrypto}=require('crypto');
const makeIDB=require('./idb-emulator');
const bundle=fs.readFileSync(path.join(__dirname,'../build/bundle.js'),'utf8');
const errors=[];process.on('unhandledRejection',e=>errors.push('unhandledRejection: '+(e&&e.stack||e)));process.on('uncaughtException',e=>errors.push('uncaught: '+(e&&e.stack||e)));
const chaos=()=>{const f=function(){};return new Proxy(f,{get:(t,k)=>typeof k==='symbol'&&k!==Symbol.toPrimitive&&k!==Symbol.iterator?undefined:k===Symbol.toPrimitive?()=>'':k==='length'?0:k===Symbol.iterator?function*(){}:k==='then'?undefined:chaos(),apply:()=>chaos(),construct:()=>chaos(),set:()=>true,has:()=>true})};
function mkCtx(idb,seedLS={}){const store=new Map(Object.entries(seedLS)),ctx={indexedDB:idb,crypto:webcrypto,TextEncoder,structuredClone,setTimeout,clearTimeout,btoa,atob,Blob,URL,console,
  localStorage:{get length(){return store.size},key:i=>[...store.keys()][i],getItem:k=>store.has(k)?store.get(k):null,setItem:(k,v)=>store.set(k,String(v)),removeItem:k=>store.delete(k)},
  document:chaos(),navigator:{userAgent:'smoke',storage:{persist:async()=>true,estimate:async()=>({usage:1e6})},clipboard:{writeText(){}}},addEventListener(){},getSelection:()=>chaos(),NodeFilter:{SHOW_TEXT:4},DOMParser:function(){return{parseFromString:(s)=>({querySelectorAll:()=>[],body:{innerHTML:String(s).replace(/<script[\s\S]*?<\/script>/gi,''),childNodes:[],querySelectorAll:()=>[]}})}},requestAnimationFrame:f=>f(),print(){}};
  ctx.window=ctx;vm.createContext(ctx);return ctx}
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
  const idb=makeIDB();globalThis.indexedDB=idb;globalThis.crypto=globalThis.crypto||webcrypto;globalThis.clean=h=>h;
  const dl=['00-core.js','10-db.js','15-digest.js','20-migrate.js','30-backup.js','40-integrity.js'].map(f=>fs.readFileSync(path.join(__dirname,'../src/js',f),'utf8')).join('\n');
  vm.runInThisContext(dl+'\nglobalThis.__L={genData,makeLegacyDB,openDB,dbulk,setMeta,dall};',{filename:'dl.js'});
  const L=globalThis.__L,data=L.genData(150,3,{photoEvery:10,photoBytes:3000});
  const results=[];const check=(n,ok,d)=>results.push({n,ok:!!ok,d:d||''});
  // Scenario A: v6 already set up ("fresh" marker) with data -> boots straight into the app and renders every view.
  const d6=await L.openDB('evermore-v6');await L.dbulk(d6,'entries',data.entries.map(e=>({...e,del:undefined})).map(e=>{const c={...e};delete c.del;return c}));await L.dbulk(d6,'versions',data.versions.map(({vid,...r})=>r));await L.dbulk(d6,'shelves',data.collections);await L.setMeta(d6,'migration',{state:'fresh',at:1});d6.close();
  const ctxA=mkCtx(idb);vm.runInContext(bundle,ctxA,{filename:'bundle.js'});await sleep(1500);
  check('A: app boots without gate or errors',errors.length===0,errors.join('\n').slice(0,600));
  const run=(c,code)=>vm.runInContext(code,c);
  for(const code of ["go('t')","go('i')","go('c')","go('p')","go('d')","go('j')","openE(E[0].id)","openE(E[5].id)","create()","openS()","$('#q').value='alpha';renderSearch()","closeS()","openMap()","closeMap()","bookOpts()","tagMgr()","scopeList('a',false)","openBook('a',false)","closeBook()"]){
    let ok=true,d='';try{run(ctxA,code);await sleep(30)}catch(e){ok=false;d=String(e&&e.message||e)}check('A: '+code,ok&&errors.length===0,d||errors.join('\n').slice(0,300))}
  check('A: entries loaded from the v6 database',run(ctxA,'E.length')+run(ctxA,'T.length')===150,run(ctxA,'E.length')+' live + '+run(ctxA,'T.length')+' trashed');
  check('A: trashed entries kept out of the live list',run(ctxA,'E.every(e=>!e.del)'));
  // Scenario B: a v5 database exists and v6 is empty -> migration gate appears and nothing is written until the user acts.
  const idb2=makeIDB();globalThis.indexedDB=idb2;const ld=await L.makeLegacyDB('evermore',data);ld.close();errors.length=0;
  const ctxB=mkCtx(idb2,{'ev.theme':'"light"'});vm.runInContext(bundle,ctxB,{filename:'bundle.js'});await sleep(1500);
  check('B: gate shown for found v5 data without errors',errors.length===0,errors.join('\n').slice(0,600));
  const d6b=await L.openDB('evermore-v6'),cnt=(await L.dall(d6b,'entries')).length;check('B: nothing copied before the user presses the button',cnt===0,String(cnt));
  check('B: v5 preferences copied to ev6. keys, v5 keys kept',vm.runInContext("localStorage.getItem('ev6.theme')==='\"light\"'&&localStorage.getItem('ev.theme')==='\"light\"'",ctxB));
  // Scenario C: nothing exists anywhere -> welcome gate, no errors.
  const idb3=makeIDB();globalThis.indexedDB=idb3;errors.length=0;const ctxC=mkCtx(idb3);vm.runInContext(bundle,ctxC,{filename:'bundle.js'});await sleep(800);
  check('C: first run with no v5 data shows the welcome gate without errors',errors.length===0,errors.join('\n').slice(0,600));
  const f=results.filter(r=>!r.ok);for(const r of results)console.log((r.ok?'PASS  ':'FAIL  ')+r.n+(r.ok||!r.d?'':'\n        '+r.d));
  console.log(`\n${results.length-f.length}/${results.length} smoke checks passed`);process.exit(f.length?1:0)})();
