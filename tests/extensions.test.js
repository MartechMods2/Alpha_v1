import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { extensionId, extensionDatabase, extensionLimit, extensionAuthCodec } from "../utils/extensionPolicy.js";
import { createExtensionManager } from "../utils/extensionManager.js";
const a="2348111111111", b="2348222222222", secret="test-only-secret-with-at-least-32-characters";
const settle=()=>new Promise(r=>setImmediate(r));
function fixture(max=2){
  let enabled=false; const rows=new Map(), children=[], notices=[], timers=[];
  const store={enabled:async value=>{if(value!==undefined)enabled=value;return enabled;},list:async()=>[...rows.values()],put:async row=>rows.set(row._id,structuredClone(row))};
  const manager=createExtensionManager({store,max,notify:async(phone,text)=>notices.push({phone,text}),delay:fn=>{timers.push(fn);return fn;},cancel:()=>{},launch:async(row,hooks)=>{const child={row,hooks,stopped:false,stop:async()=>{child.stopped=true;hooks.exit();}};children.push(child);return child;}});
  return {manager,rows,children,notices,timers,store};
}
test("extension database namespaces preserve primary data and reject invalid tenant identifiers",()=>{
  assert.equal(extensionDatabase("MyBotDataDB",""),"MyBotDataDB");
  assert.notEqual(extensionDatabase("MyBotDataDB",extensionId(a)),extensionDatabase("MyBotDataDB",extensionId(b)));
  assert.throws(()=>extensionDatabase("MyBotDataDB","../primary"));
  assert.throws(()=>extensionId("bad@lid"));
  assert.equal(extensionLimit("999"),1);assert.equal(extensionLimit("3"),3);
});
test("encrypted auth uses random nonces, rejects tampering and is bound to its tenant and secret",()=>{
  const codec=extensionAuthCodec(extensionId(a),secret), plain='{"privateSession":"synthetic"}';
  const first=codec.encode(plain), second=codec.encode(plain);
  assert.notEqual(first,second);assert.ok(!first.includes("synthetic"));assert.equal(codec.decode(first),plain);
  assert.throws(()=>extensionAuthCodec(extensionId(b),secret).decode(first));
  assert.throws(()=>extensionAuthCodec(extensionId(a),secret+"different").decode(first));
  const changed=JSON.parse(first);changed.tag=Buffer.alloc(16).toString("base64");
  assert.throws(()=>codec.decode(JSON.stringify(changed)));
  assert.throws(()=>extensionAuthCodec(extensionId(a),"short"));
  assert.equal(extensionAuthCodec("").encode(plain),plain);
});
test("pairing is opt-in, one session per verified number, capacity is serialized and stop frees the slot",async()=>{
  const f=fixture(1);
  await assert.rejects(f.manager.pair(a),/OFF/);
  await f.manager.enable(true);
  const outcomes=await Promise.allSettled([f.manager.pair(a),f.manager.pair(b)]);
  assert.equal(outcomes.filter(x=>x.status==="fulfilled").length,1);
  assert.equal(f.children.length,1);
  await assert.rejects(f.manager.pair(a),/already running/);
  await f.manager.stop(a);await settle();
  await f.manager.pair(b);assert.equal(f.children.length,2);
  await f.manager.shutdown();
});
test("pairing codes are browser-only, account-scoped, never persisted and cleared after connection",async()=>{
  const f=fixture();await f.manager.enable(true);await f.manager.pair(a);
  const child=f.children[0];
  child.hooks.message({type:"code",code:"ABCD-1234"});child.hooks.message({type:"code",code:"ABCD-1234"});await settle();
  assert.equal(f.notices.length,0);assert.equal((await f.manager.pairingStatus(a)).code,"ABCD-1234");
  assert.equal((await f.manager.pairingStatus(b)).code,undefined);
  assert.ok(!JSON.stringify([...f.rows.values()]).includes("ABCD-1234"));
  child.hooks.message({type:"open"});child.hooks.message({type:"open"});await settle();
  assert.equal((await f.manager.status(a)).status,"connected");
  assert.equal(f.notices.length,0);assert.equal((await f.manager.pairingStatus(a)).code,undefined);
  await f.manager.shutdown();
});
test("failed and expired pairing release capacity; restored sessions exclude pending and blocked users",async()=>{
  const f=fixture();await f.manager.enable(true);await f.manager.pair(a);
  f.children[0].hooks.exit();await settle();assert.equal(f.rows.get(extensionId(a)).active,false);
  await f.manager.pair(b);f.timers.at(-1)();await settle();
  assert.equal(f.children[1].stopped,true);assert.equal(f.rows.get(extensionId(b)).active,false);
  const g=fixture();await g.store.enabled(true);
  await g.store.put({_id:extensionId(a),phone:a,paired:true,active:true});
  await g.store.put({_id:extensionId(b),phone:b,paired:false,active:true});
  await g.manager.restore();assert.equal(g.rows.get(extensionId(b)).active,false);assert.equal(g.children.length,1);assert.equal(g.children[0].row.phone,a);
  await g.manager.revoke(a);await settle();assert.equal(g.rows.get(extensionId(a)).blocked,true);
  await assert.rejects(g.manager.pair(a),/disabled|minute/);
  await f.manager.shutdown();await g.manager.shutdown();
});
test("creator pause stops workers while retaining resumable data; shutdown does not restart workers",async()=>{
  const f=fixture();await f.manager.enable(true);await f.manager.pair(a);
  f.children[0].hooks.message({type:"open"});await settle();
  await f.manager.enable(false);assert.equal(f.children[0].stopped,true);
  await f.manager.enable(true);assert.equal(f.children.length,2);
  await f.manager.shutdown();await assert.rejects(f.manager.pair(b),/OFF/);
});
test("extension chat command only directs users to dashboard without launching anything",async()=>{
  const {default:create}=await import("../commands/public/extension.js");
  const replies=[],info={isGroup:true,sendMessageWTyping:async(_to,p)=>replies.push(p.text)};
  await create().handler({}, {}, "12345@g.us",["pair"],info);
  assert.match(replies.pop(),/only through the dashboard/);
  await create().handler({}, {}, a+"@s.whatsapp.net",["pair",b],{...info,isGroup:false,senderJid:a+"@s.whatsapp.net"});
  assert.match(replies.pop(),/Chat cannot create sessions/);
});
test("extension workers do not start a web server or inherit fromMe creator authorization",async()=>{
  const worker=await fs.readFile(new URL("../extensions/worker.js",import.meta.url),"utf8");
  assert.ok(!worker.includes('import("../index.js")'));
  const router=await fs.readFile(new URL("../core/messages.js",import.meta.url),"utf8");
  assert.match(router,/!process.env.ALPHA_EXTENSION_ID && msg.key.fromMe === true/);
  const loader=await fs.readFile(new URL("../utils/commandLoader.js",import.meta.url),"utf8");
  assert.match(loader,/ALPHA_EXTENSION_ID.*endsWith\("\/owner\/"\)/);
});
test("paired account owner flags cannot activate extensions or claim creator authority",async()=>{
  const {default:create}=await import("../commands/public/extension.js");
  const replies=[];
  await create().handler({}, {}, a+"@s.whatsapp.net",["on"],{isOwner:true,isGroup:false,senderJid:a+"@s.whatsapp.net",sendMessageWTyping:async(_to,p)=>replies.push(p.text)});
  assert.match(replies[0],/only through the dashboard/);
});
test("group activation is scoped to the current group and requires actual admin authorization",async()=>{
  let source=await fs.readFile(new URL("../commands/group/admins/extensionGroup.js",import.meta.url),"utf8");
  const updates=[];globalThis.__extensionGroupUpdates=updates;
  const mock="data:text/javascript;base64,"+Buffer.from('export const group={updateOne:async(...args)=>globalThis.__extensionGroupUpdates.push(args)};').toString("base64");
  source=source.replace('"../../../db/groupData.js"',JSON.stringify(mock)).replace('"../../../utils/groupParticipants.js"',JSON.stringify(new URL("../utils/groupParticipants.js",import.meta.url).href));
  const {default:create}=await import("data:text/javascript;base64,"+Buffer.from(source).toString("base64"));
  const previous=process.env.ALPHA_EXTENSION_ID;process.env.ALPHA_EXTENSION_ID=extensionId(a);
  try{
    const info={isGroup:true,senderJid:a+"@s.whatsapp.net",sendMessageWTyping:async()=>{}};
    const sock={groupMetadata:async()=>({participants:[{id:a+"@s.whatsapp.net",admin:"admin"}]})};
    await create().handler({}, {},"12345@g.us",["on"],info);assert.equal(updates.length,0);
    await create().handler({groupMetadata:async()=>({participants:[{id:a+"@s.whatsapp.net"}]})}, {},"12345@g.us",["on"],{...info,isGroupAdmin:true});assert.equal(updates.length,0);
    await create().handler(sock, {},"12345@g.us",["on"],{...info,isGroupAdmin:true});
    assert.deepEqual(updates[0],[{_id:"12345@g.us"},{$set:{isBotOn:true,isChatBotOn:true}}]);
    await create().handler(sock, {},"12345@g.us",["off"],{...info,isGroupAdmin:true});assert.equal(updates[1][1].$set.isBotOn,false);
  }finally{if(previous===undefined)delete process.env.ALPHA_EXTENSION_ID;else process.env.ALPHA_EXTENSION_ID=previous;delete globalThis.__extensionGroupUpdates;}
});
test("permission notices are English and do not retain the old romanized Hindi replies",async()=>{
  const source=await fs.readFile(new URL("../core/messages.js",import.meta.url),"utf8");
  assert.ok(!/kya matlab|admin nhi|mere owner/.test(source));assert.match(source,/Only group admins can use this command/);
});
