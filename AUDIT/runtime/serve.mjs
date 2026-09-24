import { createServer } from 'node:http';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHarness } from './harness.mjs';
const root=fileURLToPath(new URL('../../',import.meta.url));
const h=await createHarness();
const origin='http://127.0.0.1:4179';
h.env.FRONTEND_URL=origin;
// Job descriptions are already public; all people and account records are synthetic.
const {jobs}=JSON.parse(await readFile(path.join(root,'AUDIT/evidence/public-jobs.json'),'utf8'));
const columns=(await h.database.query("SELECT column_name FROM information_schema.columns WHERE table_name='jobs'")).rows.map(x=>x.column_name);
for(const job of jobs) {
 const pairs=Object.entries(job).map(([k,v])=>[k.replace(/[A-Z]/g,m=>'_'+m.toLowerCase()),v]).filter(([k])=>columns.includes(k));
 await h.database.query(`INSERT INTO jobs (${pairs.map(([k])=>'"'+k+'"').join(',')}) VALUES (${pairs.map((_,i)=>'$'+(i+1)).join(',')})`,pairs.map(([,v])=>v));
}
const staticRoot=path.join(root,'artifacts/swiftjob-systems/dist/public');
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp','.woff2':'font/woff2','.ico':'image/x-icon','.xml':'application/xml; charset=utf-8','.txt':'text/plain; charset=utf-8'};
const server=createServer(async(req,res)=>{
 try {
  if(req.headers.host!=='127.0.0.1:4179'&&req.headers.host!=='localhost:4179') {res.writeHead(403);res.end();return;}
  const url=new URL(req.url,origin);
  if(url.pathname.startsWith('/api/')||url.pathname==='/health') {
   const chunks=[];for await(const chunk of req) chunks.push(chunk);
   const headers=new Headers();for(const [k,v] of Object.entries(req.headers)) if(v)headers.set(k,String(v));
   headers.set('cf-connecting-ip','192.0.2.20');
   const request=new Request(url,{method:req.method,headers,body:['GET','HEAD'].includes(req.method)?undefined:Buffer.concat(chunks)});
   const response=await h.app.fetch(request,h.env,{waitUntil(p){h.pending.push(p);},passThroughOnException(){}});
   res.writeHead(response.status,Object.fromEntries(response.headers));res.end(Buffer.from(await response.arrayBuffer()));
   await Promise.allSettled(h.pending);
   await mkdir(path.join(root,'AUDIT/email-previews'),{recursive:true});
   for(let i=0;i<h.emails.length;i++)await writeFile(path.join(root,`AUDIT/email-previews/synthetic-${i+1}.html`),h.emails[i].html);
   await writeFile(path.join(root,'AUDIT/runtime/generated/mailbox.json'),JSON.stringify(h.emails,null,2));
   return;
  }
  const target=path.resolve(staticRoot,'.'+decodeURIComponent(url.pathname));
  if(!target.startsWith(staticRoot+path.sep)&&target!==staticRoot){res.writeHead(403);res.end();return;}
  let body;let ext=path.extname(target);
  try{body=await readFile(target);}catch{body=await readFile(path.join(staticRoot,'index.html'));ext='.html';}
  res.writeHead(200,{'Content-Type':mime[ext]??'application/octet-stream','Cache-Control':'no-store'});res.end(body);
 } catch(error) { console.error('Local audit server:',error.message);res.writeHead(500);res.end('Local test error'); }
});
server.listen(4179,'127.0.0.1',()=>console.log('Isolated SwiftJob preview: '+origin+'; outbound network blocked; synthetic account admin@example.test.'));
process.on('SIGINT',()=>server.close(async()=>{await h.close();process.exit(0);}));
