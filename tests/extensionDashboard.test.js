import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import session from 'express-session';
import {createExtensionRouter} from '../routes/extensions.js';
import {createExtensionDashboardAccess} from '../utils/extensionDashboardAccess.js';
const phone='2348111111111';
test('dashboard invitations are number-bound, single-use, expiring and bounded',()=>{
  let time=0;const access=createExtensionDashboardAccess({now:()=>time});
  const item=access.create(phone);assert.equal(access.consume(item.token).phone,phone);assert.equal(access.consume(item.token),null);
  const expired=access.create(phone);time=900001;assert.equal(access.consume(expired.token),null);
  for(let i=0;i<20;i++)access.create(phone);assert.throws(()=>access.create(phone),/Too many/);
});
test('dashboard-only HTTP flow isolates visitor access, code retrieval, consent and admin controls',async t=>{
  let enabled=false,time=0;const calls=[],manager={
    overview:async()=>({enabled,max:1,accounts:[]}),enable:async value=>{enabled=Boolean(value);return {enabled};},
    pair:async value=>{calls.push(['pair',value]);return {status:'starting'}},
    pairingStatus:async value=>({status:'pairing',code:value===phone?'ABCD1234':'FOREIGN'}),
    stop:async value=>calls.push(['stop',value]),revoke:async value=>calls.push(['revoke',value]),
  };
  const app=express();app.use(express.json());app.use(session({secret:'synthetic-session-secret-for-tests-only',resave:false,saveUninitialized:false}));
  const requireAdmin=(req,res,next)=>req.get('x-test-admin')==='yes'?next():res.status(401).json({error:'Unauthorized'});
  app.use(createExtensionRouter({manager,requireAdmin,normalizePhone:value=>/^\d{7,15}$/.test(value||'')?value:null,primaryPhone:()=> '2348999999999',now:()=>time}));
  app.post('/existing-login',(_req,res)=>res.json({ok:true}));
  const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));t.after(()=>new Promise(r=>server.close(r)));
  const origin=`http://127.0.0.1:${server.address().port}`;
  const request=(path,{admin=false,cookie,body,foreign=false,noOrigin=false}={})=>fetch(origin+path,{method:body===undefined?'GET':'POST',headers:{...(body!==undefined?{'Content-Type':'application/json',...(!noOrigin?{Origin:foreign?'https://foreign.example':origin}:{})}:{}),...(admin?{'x-test-admin':'yes'}:{}),...(cookie?{Cookie:cookie}:{})},body:body===undefined?undefined:JSON.stringify(body)});
  assert.equal((await request('/api/admin/extensions')).status,401);
  assert.equal((await request('/api/admin/extensions/settings',{admin:true,body:{enabled:true},foreign:true})).status,403);
  assert.equal((await request('/api/admin/extensions/settings',{admin:true,body:{enabled:true},noOrigin:true})).status,403);
  assert.equal((await request('/existing-login',{body:{},noOrigin:true})).status,200);
  await request('/api/admin/extensions/settings',{admin:true,body:{enabled:true}});
  const invite=await (await request('/api/admin/extensions/invite',{admin:true,body:{phone}})).json();
  const token=new URLSearchParams(invite.path.split('#')[1]).get('invite');assert.ok(token);
  assert.equal((await request('/api/extensions/status')).status,403);
  const claim=await request('/api/extensions/claim',{body:{token}});assert.equal(claim.status,200);
  const cookie=claim.headers.get('set-cookie').split(';')[0];assert.ok(cookie);
  assert.equal((await request('/api/extensions/claim',{body:{token}})).status,403);
  assert.equal((await request('/api/admin/extensions',{cookie})).status,401);
  assert.equal((await request('/api/extensions/start',{cookie,body:{consent:false}})).status,400);
  assert.equal((await request('/api/extensions/start',{cookie,body:{consent:true,phone:'2348000000000'}})).status,200);
  assert.deepEqual(calls[0],['pair',phone]);
  const status=await request('/api/extensions/status',{cookie});assert.equal(status.headers.get('cache-control'),'no-store');assert.equal((await status.json()).code,'ABCD1234');
  await request('/api/extensions/stop',{cookie,body:{phone:'2348000000000'}});assert.deepEqual(calls.at(-1),['stop',phone]);
  time=900001;assert.equal((await request('/api/extensions/status',{cookie})).status,403);
});
