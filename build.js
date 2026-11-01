#!/usr/bin/env node
/* Evermore build script (Node, zero dependencies).
   Concatenates src/ into ONE self-contained HTML file: dist/evermore-v6.html  (and build/bundle.js for the tests).
   Output is deterministic: the same source always produces the same bytes. */
'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm');
const root=__dirname,rd=p=>fs.readFileSync(path.join(root,'src',p),'utf8');
const files=fs.readdirSync(path.join(root,'src/js')).filter(f=>f.endsWith('.js')).sort();
const js=files.map(f=>'/* ===== '+f+' ===== */\n'+rd('js/'+f)).join('\n');
const css=rd('style.css').replace(/\s+$/,'')+'\n'+rd('css-v6.css');
const shell=rd('shell.html');
const html=rd('head.html')+css+'</style></head><body>\n'+shell+'<script>\n'+js+'</script></body></html>\n';
try{new vm.Script(js,{filename:'bundle.js'})}catch(e){console.error('SYNTAX ERROR in the assembled script:',e.message);process.exit(1)}
// every element id the code looks up must exist in the markup or be created by the code
const ids=new Set([...shell.matchAll(/id="([\w-]+)"/g)].map(m=>m[1]).concat([...js.matchAll(/\bid:'([\w-]+)'/g)].map(m=>m[1])));
const used=new Set([...js.matchAll(/'#([\w-]+)'/g)].map(m=>m[1]));
const missing=[...used].filter(x=>!ids.has(x));
if(missing.length){console.error('Element ids referenced but never defined:',missing.join(', '));process.exit(1)}
fs.mkdirSync(path.join(root,'dist'),{recursive:true});fs.mkdirSync(path.join(root,'build'),{recursive:true});
fs.writeFileSync(path.join(root,'dist/evermore-v6.html'),html);fs.writeFileSync(path.join(root,'build/bundle.js'),js);
console.log('Built dist/evermore-v6.html ('+Math.round(html.length/1024)+' KB) from '+files.length+' modules. Syntax OK, '+used.size+' element ids resolved.');
