#!/usr/bin/env node
/* Tiny local web server (Node, zero dependencies). Serves dist/ and reference/ on http://localhost:8080.
   Bound to 127.0.0.1 only, so it is not reachable from other machines. Usage: node serve.js [port] */
'use strict';
const http=require('http'),fs=require('fs'),path=require('path');
const port=+process.env.PORT||+process.argv[2]||8080,roots=['dist','reference'].map(d=>path.join(__dirname,d));
const types={'.html':'text/html; charset=utf-8','.md':'text/plain; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json'};
http.createServer((req,res)=>{let u;try{u=decodeURIComponent(req.url.split('?')[0])}catch{res.writeHead(400);return res.end('Bad request')}
  if(u==='/')u='/evermore-v6.html';
  for(const r of roots){const f=path.join(r,u);if(f.startsWith(r+path.sep)&&fs.existsSync(f)&&fs.statSync(f).isFile()){res.writeHead(200,{'Content-Type':types[path.extname(f)]||'application/octet-stream','Cache-Control':'no-store'});return fs.createReadStream(f).pipe(res)}}
  res.writeHead(404,{'Content-Type':'text/plain'});res.end('Not found')}).listen(port,'127.0.0.1',()=>{
  console.log('Evermore 6 (Phase 0):    http://localhost:'+port+'/evermore-v6.html');
  if(fs.existsSync(path.join(__dirname,'reference/evermore-v5.html')))console.log('Evermore 5 (reference): http://localhost:'+port+'/evermore-v5.html   (same origin, so v6 can migrate from it)');
  console.log('Press Ctrl+C to stop.')}).on('error',e=>{console.error(e.code==='EADDRINUSE'?'Port '+port+' is in use. Try: node serve.js 8081':e.message);process.exit(1)});
