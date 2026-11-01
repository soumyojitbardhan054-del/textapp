#!/bin/bash
# Mutation check: inject a bug into a copy of the source and confirm the self-test suite notices.
cd "$(dirname "$0")/.."
run(){ # name file old new
  rm -rf /tmp/mut && mkdir -p /tmp/mut && cp -r src tests /tmp/mut/ 
  python3 - "$2" "$3" "$4" <<'PY'
import sys
f,a,b=sys.argv[1:4];p='/tmp/mut/src/js/'+f;t=open(p).read()
assert a in t,('mutation target not found',a);open(p,'w').write(t.replace(a,b,1))
PY
  out=$(node /tmp/mut/tests/run-node.js 200 300 2>&1); fails=$(echo "$out" | grep -c '^FAIL')
  if [ "$fails" -gt 0 ]; then echo "CAUGHT   ($fails failing)  $1"; else echo "MISSED                $1"; fi
}
run "migration forgets to copy saved versions" 20-migrate.js "await dbulk(t,'versions',L.versions);" ""
run "migration verification disabled"           20-migrate.js "if(Object.keys(bad).length||!photoOK||!vidOK)throw" "if(false)throw"
run "migration skips photo check only"          20-migrate.js "||!photoOK" ""
run "migration writes to the v5 database"       20-migrate.js "let L;try{L=await readLegacy(ld)}finally{ld.close()}
  log('Found" "let L;try{L=await readLegacy(ld);await dput(ld,'entries',{...L.entries[0],title:'TOUCHED'})}finally{ld.close()}
  log('Found"
run "import drops unknown fields"               30-backup.js "return c}
/* Merge an archive" "delete c.zz;return c}
/* Merge an archive"
run "import allows prototype keys"              30-backup.js "if(k==='__proto__'||k==='constructor'||k==='prototype')continue;" ""
run "export omits a store (annotations)"        30-backup.js "for(const n of DATA_STORES)o[n]=await dall(d,n);" "for(const n of DATA_STORES)o[n]=n==='annotations'?[]:await dall(d,n);"
run "import truncates photographs"              30-backup.js "c.html=clean(c.html);fixNum" "c.html=clean(c.html).replace(/(base64,[^\"]{10})[^\"]*/g,'\$1');fixNum"
run "backups keep only 3"                       30-backup.js "while(autos.length>7)" "while(autos.length>3)"
run "safety snapshot gets rotated"              30-backup.js "const autos=ks.filter(x=>!x.keep)" "const autos=ks"
run "merge overwrites newer local edits"        30-backup.js "newer=(a,b)=>(+a.updated||+a.created||0)>(+b.updated||+b.created||0)" "newer=(a,b)=>true"
run "integrity check ignores bad photos"        40-integrity.js "if(!m[2].length||m[2].length%4||!/^[A-Za-z0-9+/]+={0,2}\$/.test(m[2]))badP.push(e.id)" ""
run "visibility rule differs from v5"           00-core.js "const vis=e=>!e.arch;" "const vis=e=>!e.arch&&!e.ev;"
