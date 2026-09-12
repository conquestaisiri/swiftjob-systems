import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { writeFile } from 'node:fs/promises';
import { createHarness } from './harness.mjs';
const { SignJWT, decodeJwt } = createRequire(new URL('../../workers-api/package.json',import.meta.url))('jose');
const h=await createHarness();
const results=[];
async function check(name,fn) { try { await fn();results.push({name,status:'PASS'}); } catch(error) {results.push({name,status:'FAIL',error:error.message});throw error;} }
const post=(route,body,token)=>h.request(route,{method:'POST',body,token});
const email='owner@example.test';
const password='SyntheticOwnerPassword!42';
let verifiedToken, passwordToken;
try {
 await check('Valid contact JSON reaches email sink',async()=>{
  const result=await post('/api/contact',{firstName:'Audit',email,interest:'Finding work',message:'Synthetic contact validation message.'});
  assert.equal(result.status,201);assert.equal(h.emails.length,1);
 });
 await check('Malformed, null and array JSON return 400',async()=>{
  for(const rawBody of ['{','null','[]','"text"'])assert.equal((await h.request('/api/contact',{method:'POST',rawBody})).status,400);
 });
 await check('Anonymous password registration cannot create or overwrite accounts',async()=>{
  assert.equal((await post('/api/auth/register',{email,password,applicationId:crypto.randomUUID()})).status,401);
  assert.equal((await h.database.query('SELECT count(*)::int AS count FROM candidate_accounts')).rows[0].count,0);
 });
 await check('Magic-link request reaches synthetic mailbox and verifies once',async()=>{
  assert.equal((await post('/api/auth/magic-link',{email,turnstileToken:null})).status,200);
  const message=h.emails.at(-1);
  const token=message.html.match(/\/login\/confirm\?token=([a-f0-9]+)/)?.[1];
  assert.ok(token,'Magic link missing from HTML');
  const result=await h.request('/api/auth/verify?token='+token);
  assert.equal(result.status,200);verifiedToken=result.data.token;
  assert.ok(result.headers['set-cookie'].startsWith('swiftjob_session='));
  assert.equal((await h.request('/api/auth/verify?token='+token)).status,401);
 });
 await check('Verified owner can access portal before setting a password',async()=>{
  assert.equal((await h.request('/api/candidate/applications',{token:verifiedToken})).status,200);
 });
 await check('Verified user cannot set another email password',async()=>{
  assert.equal((await post('/api/auth/register',{email:'other@example.test',password},verifiedToken)).status,403);
  assert.equal((await h.database.query('SELECT count(*)::int AS count FROM candidate_accounts')).rows[0].count,0);
 });
 await check('Verified owner sets password and replaces existing sessions',async()=>{
  const result=await post('/api/auth/register',{password},verifiedToken);
  assert.equal(result.status,200);passwordToken=result.data.token;
  assert.equal((await h.request('/api/candidate/applications',{token:verifiedToken})).status,401);
  assert.equal((await h.request('/api/candidate/applications',{token:passwordToken})).status,200);
 });
 await check('Existing password cannot be overwritten anonymously',async()=>{
  const before=(await h.database.query('SELECT password_hash FROM candidate_accounts WHERE email=$1',[email])).rows[0].password_hash;
  assert.equal((await post('/api/auth/register',{email,password:'AttackerPassword42!',applicationId:crypto.randomUUID()})).status,401);
  const after=(await h.database.query('SELECT password_hash FROM candidate_accounts WHERE email=$1',[email])).rows[0].password_hash;
  assert.equal(before,after);
 });
 await check('Wrong password rejected and correct password produces usable Bearer/cookie sessions',async()=>{
  assert.equal((await post('/api/auth/login-password',{email,password:'WrongPassword!42'})).status,401);
  const result=await post('/api/auth/login-password',{email:' OWNER@example.test ',password});
  assert.equal(result.status,200);passwordToken=result.data.token;
  assert.equal((await h.request('/api/candidate/applications',{token:passwordToken})).status,200);
  assert.equal((await h.request('/api/candidate/applications',{cookie:result.headers['set-cookie'].split(';')[0]})).status,200);
 });
 await check('Password login rate limit blocks repeated attempts per IP without locking another IP',async()=>{
  const headers={'cf-connecting-ip':'198.51.100.77'};
  const statuses=[];
  for(let i=0;i<10;i++) statuses.push((await h.request('/api/auth/login-password',{method:'POST',headers,body:{email:'unknown@example.test',password}})).status);
  assert.deepEqual(statuses,Array(10).fill(401));
  assert.equal((await h.request('/api/auth/login-password',{method:'POST',headers,body:{email:'unknown@example.test',password}})).status,429);
  assert.equal((await h.request('/api/auth/login-password',{method:'POST',headers:{'cf-connecting-ip':'198.51.100.78'},body:{email:'unknown@example.test',password}})).status,401);
 });
 await check('Signed tokens with invalid role, email or missing expiry rejected',async()=>{
  const original=decodeJwt(passwordToken);const secret=new TextEncoder().encode(h.env.JWT_SECRET);
  const {exp,...withoutExpiry}=original;
  for(const claims of [{...original,role:'admin'},{...original,email:'other@example.test'},withoutExpiry,{...original,exp:1}]) {
   const token=await new SignJWT(claims).setProtectedHeader({alg:'HS256'}).sign(secret);
   assert.equal((await h.request('/api/candidate/applications',{token})).status,401);
  }
 });
 await check('Candidate session cannot access admin APIs',async()=>{
  for(const route of ['/api/admin/stats','/api/admin/jobs','/api/admin/contacts','/api/admin/campaigns','/api/admin/referrals']) {
   const status=(await h.request(route,{token:passwordToken})).status;assert.ok(status===401||status===403);
  }
 });
 await check('Malformed candidate cookie is handled without a server error',async()=>{
  assert.equal((await h.request('/api/candidate/applications',{cookie:'swiftjob_session=%E0%A4%A'})).status,401);
 });
 await check('Logout revokes the session and clears the shared cookie',async()=>{
  const result=await post('/api/auth/logout',undefined,passwordToken);
  assert.equal(result.status,200);assert.ok(result.headers['set-cookie'].includes('Max-Age=0'));
  assert.equal((await h.request('/api/candidate/applications',{token:passwordToken})).status,401);
 });
 await check('Admin login/read still work and admin token is not a candidate session',async()=>{
  const result=await post('/api/admin/login',{email:h.env.ADMIN_EMAIL,password:h.env.ADMIN_PASSWORD});
  assert.equal(result.status,200);
  assert.equal((await h.request('/api/admin/stats',{token:result.data.token})).status,200);
  assert.equal((await h.request('/api/candidate/applications',{token:result.data.token})).status,401);
 });
} finally {
 await writeFile(new URL('../evidence/auth-regression.json',import.meta.url),JSON.stringify({environment:'Local PGlite + actual Worker; synthetic email sink; no production access',results},null,2));
 await h.close();console.log(JSON.stringify(results,null,2));
}
