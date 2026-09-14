import { createRequire } from 'node:module';
import { writeFile } from 'node:fs/promises';
const workerRequire=createRequire(new URL('../../workers-api/package.json',import.meta.url));
const require=createRequire(workerRequire.resolve('wrangler/package.json'));
const {Miniflare}=require('miniflare');
const mf=new Miniflare({modules:true,compatibilityDate:'2024-08-01',compatibilityFlags:['nodejs_compat'],script:`
export default {async fetch(){
 const key=await crypto.subtle.importKey('raw',new TextEncoder().encode('SyntheticPassword42!'),'PBKDF2',false,['deriveBits']);
 const results=[];
 for(const iterations of [100000,150000]) {
  try {await crypto.subtle.deriveBits({name:'PBKDF2',salt:new Uint8Array(16),iterations,hash:'SHA-256'},key,256);results.push({iterations,status:'PASS'});}
  catch(error){results.push({iterations,status:'FAIL',error:error.message});}
 }
 return Response.json(results);
}}`});
try{const results=await(await mf.dispatchFetch('http://localhost/')).json();console.log(results);await writeFile(new URL('../evidence/crypto-runtime.json',import.meta.url),JSON.stringify(results,null,2));}finally{await mf.dispose();}
