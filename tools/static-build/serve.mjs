import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { ROOT, readJson } from './shared.mjs';
const mime = { '.html':'text/html; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.css':'text/css; charset=utf-8', '.json':'application/json', '.png':'image/png', '.ico':'image/x-icon', '.woff2':'font/woff2', '.md':'text/plain; charset=utf-8' };
export async function serve(profile, port = 0) {
  if (!['global','china'].includes(profile)) throw Error('Expected global or china');
  const manifest = await readJson(`dist/${profile}/build-manifest.json`), basePath = manifest.basePath;
  const root = path.join(ROOT,'dist',profile), requests = [];
  const server = http.createServer(async (req,res) => {
    const row = { url:req.url, method:req.method }; requests.push(row);
    try {
      const url = new URL(req.url,'http://local.invalid');
      if (basePath !== '/' && url.pathname === basePath.slice(0,-1)) { row.status=301; res.writeHead(301,{location:basePath+url.search}).end();return; }
      if (!url.pathname.startsWith(basePath) || !['GET','HEAD'].includes(req.method)) { row.status=404;res.writeHead(404).end();return; }
      let local = decodeURIComponent(url.pathname.slice(basePath.length));
      if (!local || local.endsWith('/')) local += 'index.html';
      const file = path.resolve(root,local);
      if (!file.startsWith(root+path.sep)) { row.status=403;res.writeHead(403).end();return; }
      const st=await fs.stat(file);
      if(st.isDirectory()) { row.status=301;res.writeHead(301,{location:url.pathname+'/'+url.search}).end();return; }
      const bytes=await fs.readFile(file); row.status=200;res.writeHead(200,{'content-type':mime[path.extname(file)]??'application/octet-stream','cache-control':'no-store'}).end(req.method==='HEAD'?undefined:bytes);
    }catch{row.status=404;res.writeHead(404).end('Not found');}
  });
  await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(port,'127.0.0.1',resolve);});
  return {server,requests,manifest,url:`http://127.0.0.1:${server.address().port}${basePath}`,close:()=>new Promise(resolve=>server.close(resolve))};
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) { const host=await serve(process.argv[2], Number(process.argv[3]??4173));console.log(`Local preview: ${host.url}`); }
