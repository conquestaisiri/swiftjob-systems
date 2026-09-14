import fs from 'node:fs/promises';
const origin='https://swiftjob.online';
const results=[];
for (const path of ['/api/healthz','/api/jobs','/api/admin/stats','/api/candidate/applications','/robots.txt','/sitemap.xml']) {
  const start=performance.now();
  try {
    const r=await fetch(origin+path,{signal:AbortSignal.timeout(20000)});
    const body=await r.text();
    const entry={path,status:r.status,ms:Math.round(performance.now()-start),contentType:r.headers.get('content-type'),cacheControl:r.headers.get('cache-control'),securityHeaders:Object.fromEntries(['x-content-type-options','referrer-policy','content-security-policy','strict-transport-security','x-frame-options'].map(k=>[k,r.headers.get(k)]))};
    if(path==='/api/jobs'&&r.ok) { const data=JSON.parse(body); entry.jobCount=data.jobs.length; await fs.writeFile(new URL('./evidence/public-jobs.json',import.meta.url),JSON.stringify(data,null,2)); }
    if(path==='/robots.txt')entry.body=body;
    if(path==='/sitemap.xml')entry.validXml=body.trim().startsWith('<?xml')||body.includes('<urlset');
    results.push(entry);
  } catch(e){results.push({path,error:e.name});}
}
await fs.writeFile(new URL('./evidence/public-baseline.json',import.meta.url),JSON.stringify(results,null,2));
console.log(JSON.stringify(results,null,2));
