/* Minimal in-memory IndexedDB emulator for Node. Implements only what Evermore's data layer uses:
   open/deleteDatabase/databases, versionchange + abort, object stores (keyPath, autoIncrement),
   indexes (single keyPath), put/get/delete/clear/getAll/count, index.getAll/count, transactions with complete events.
   It is NOT a full implementation; browser behaviour is covered by the in-app self-test. */
module.exports=function makeIDB(){
  const dbs=new Map(),later=f=>setTimeout(f,0);
  const cmp=(a,b)=>typeof a==typeof b?(a<b?-1:a>b?1:0):(typeof a=='number'?-1:1);
  const err=(n,m)=>Object.assign(new Error(m||n),{name:n});
  class Req{constructor(){this.result=undefined;this.error=null;this.onsuccess=null;this.onerror=null}}
  function connect(rec){
    return{get version(){return rec.version},_closed:false,
      get objectStoreNames(){const a=[...rec.stores.keys()];a.contains=x=>rec.stores.has(x);return a},
      createObjectStore(n,o={}){const s={keyPath:o.keyPath,auto:!!o.autoIncrement,idx:new Map(),data:new Map(),next:1};rec.stores.set(n,s);return mkStore(null,s)},
      transaction(names,mode='readonly'){names=[].concat(names);for(const n of names)if(!rec.stores.has(n))throw err('NotFoundError','No store '+n);return mkTx(rec,names,mode)},
      close(){this._closed=true}}}
  function mkTx(rec,names,mode){
    const tx={oncomplete:null,onerror:null,onabort:null,error:null,pending:0,done:false,mode};
    const check=()=>later(()=>{if(tx.pending===0&&!tx.done){tx.done=true;tx.oncomplete&&tx.oncomplete({target:tx})}});
    tx._req=op=>{const r=new Req();tx.pending++;later(()=>{try{r.result=op()}catch(e){r.error=e}tx.pending--;if(r.error){r.onerror&&r.onerror({target:r});tx.error=r.error;tx.onerror&&tx.onerror({target:tx})}else r.onsuccess&&r.onsuccess({target:r});check()});return r};
    tx.objectStore=n=>{if(!names.includes(n))throw err('NotFoundError',n);return mkStore(tx,rec.stores.get(n))};
    tx.abort=()=>{tx.done=true;tx.onabort&&tx.onabort({target:tx})};
    check();return tx}
  function sorted(s,rows){return rows.sort((a,b)=>cmp(a[0],b[0]))}
  function mkStore(tx,s){
    const R=op=>tx?tx._req(op):{};
    const w=m=>{if(tx&&tx.mode==='readonly'&&m)throw err('ReadOnlyError','readonly transaction')};
    return{
      createIndex(n,kp){s.idx.set(n,kp)},
      put(v){w(1);v=structuredClone(v);return R(()=>{let k;if(typeof s.keyPath=='string'){k=v[s.keyPath];if(k===undefined){if(!s.auto)throw err('DataError','no key');k=s.next++;v[s.keyPath]=k}else if(s.auto&&typeof k=='number'&&k>=s.next)s.next=Math.floor(k)+1}s.data.set(k,v);return k})},
      get(k){return R(()=>{const v=s.data.get(k);return v===undefined?undefined:structuredClone(v)})},
      delete(k){w(1);return R(()=>{s.data.delete(k)})},
      clear(){w(1);return R(()=>{s.data.clear()})},
      getAll(){return R(()=>sorted(s,[...s.data.entries()]).map(e=>structuredClone(e[1])))},
      count(){return R(()=>s.data.size)},
      index(n){const kp=s.idx.get(n);if(kp===undefined)throw err('NotFoundError','No index '+n);
        const rows=k=>sorted(s,[...s.data.entries()]).filter(e=>e[1][kp]!==undefined&&(k===undefined||e[1][kp]===k));
        return{getAll(k){return R(()=>rows(k).sort((a,b)=>cmp(a[1][kp],b[1][kp])).map(e=>structuredClone(e[1])))},count(k){return R(()=>rows(k).length)}}}}}
  return{
    open(name,version){const r=new Req();later(()=>{let rec=dbs.get(name);const cur=rec?rec.version:0,ver=version===undefined?(cur||1):version;
      if(rec&&ver<cur){r.error=err('VersionError');return r.onerror&&r.onerror({target:r})}
      if(!rec||ver>cur){const created=!rec;let snap=null;if(created)rec={version:0,stores:new Map()};else snap=new Map([...rec.stores].map(([k,s])=>[k,{...s,idx:new Map(s.idx),data:new Map(s.data)}]));
        const conn=connect(rec);let aborted=false;r.result=conn;r.transaction={abort(){aborted=true}};rec.version=ver;
        r.onupgradeneeded&&r.onupgradeneeded({oldVersion:cur,newVersion:ver,target:r});
        if(aborted){if(!created){rec.stores=snap;rec.version=cur}r.result=undefined;r.error=err('AbortError');return r.onerror&&r.onerror({target:r})}
        dbs.set(name,rec)}else r.result=connect(rec);
      r.onsuccess&&r.onsuccess({target:r})});return r},
    deleteDatabase(name){const r=new Req();later(()=>{dbs.delete(name);r.onsuccess&&r.onsuccess({target:r})});return r},
    databases(){return Promise.resolve([...dbs.entries()].map(([name,r])=>({name,version:r.version})))}}};
