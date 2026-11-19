import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {EventEmitter} from 'node:events';
import {patchStatusSource} from '../scripts/patch-baileys-status.mjs';
import {createModerationDeleter} from '../utils/moderationDelete.js';
import {BoundedTtlMap} from '../utils/boundedTtlMap.js';
import {FileCache} from '../utils/fileCache.js';
const user='2348111111111@s.whatsapp.net', bot='2348000000000@s.whatsapp.net', group='123456789@g.us';
const tick=()=>new Promise(r=>setImmediate(r));
const asModule=s=>'data:text/javascript;base64,'+Buffer.from(s).toString('base64');
async function load(file,replacements={}) {
 const url=new URL(file,import.meta.url), source=(await readFile(url,'utf8')).replace(/from ["']([^"']+)["']/g,(_,spec)=>`from "${replacements[spec]?asModule(replacements[spec]):spec.startsWith('.')?new URL(spec,url).href:import.meta.resolve(spec)}"`);
 return import(asModule(source)+'#'+Math.random());
}
test('real rc14 receive pipeline handles live/offline status ACKs and group content',async()=>{
 const {makeOfflineNodeProcessor}=await import('baileys/lib/Utils/offline-node-processor.js');
 let source=await readFile(new URL('../node_modules/baileys/lib/Socket/messages-recv.js',import.meta.url),'utf8');
 source=patchStatusSource(source);assert.equal(patchStatusSource(source),source);
 const fragment=source.slice(source.indexOf('    const processNodeWithBuffer'),source.indexOf("    ws.on('CB:ack,class:message'"));
 const compile=new Function('ws','ev','handleMessage','handleCall','handleReceipt','handleNotification','sendMessageAck','isJidGroup','getBinaryNodeChild','makeOfflineNodeProcessor','onUnexpectedError','S_WHATSAPP_NET','shouldIgnoreJid','areJidsSameUser','authState','NACK_REASONS','setImmediate',fragment);
 for(const offline of [false,true]) {
  const ws=new EventEmitter();ws.isOpen=true;
  const acks=[], delivered=[], errors=[];
  compile(ws,{buffer(){},flush(){}},async n=>delivered.push(n),async()=>{},async()=>{},async()=>{},async n=>acks.push(n),j=>j?.endsWith('@g.us'),(n,t)=>n.content?.find(c=>c.tag===t),makeOfflineNodeProcessor,(e)=>errors.push(e),'s.whatsapp.net',()=>false,()=>false,{creds:{me:{}}},{},setImmediate);
  const nodes=[{tag:'status',attrs:{from:user,id:'contact',...(offline?{offline:'true'}:{})}}, {tag:'status',attrs:{from:group,id:'group',...(offline?{offline:'true'}:{})},content:[{tag:'enc'}]}];
  for(const n of nodes) ws.emit('CB:status',n);
  await tick();await tick();
  assert.deepEqual(acks.map(n=>n.attrs.id),['contact','group']);
  assert.deepEqual(delivered.map(n=>n.attrs.id),['group']);assert.equal(errors.length,0);
 }
 assert.throws(()=>patchStatusSource("ws.on('CB:status',()=>{})"));
});
test('group status revoke carries required meta and author; ordinary messages keep normal deletion',async()=>{
 const sent=[], relayed=[];
 const metadata={id:group,participants:[{id:bot,admin:'admin'},{id:user}]};
 const sock={user:{id:bot},groupMetadata:async()=>metadata,sendMessage:async(...a)=>sent.push(a),relayMessage:async(...a)=>relayed.push(a)};
 const del=createModerationDeleter({claim:()=>true});
 const base={sock,groupJid:group,memberJid:user,botJids:[bot],groupMetadata:metadata};
 await del({...base,msg:{key:{id:'status',participant:user,remoteJid:group},message:{groupStatusMessageV2:{message:{imageMessage:{}}}}}});
 assert.equal(sent.length,0);assert.equal(relayed.length,1);
 assert.equal(relayed[0][1].protocolMessage.key.id,'status');assert.equal(relayed[0][1].protocolMessage.key.participant,user);
 assert.equal(relayed[0][2].additionalAttributes.edit,'8');assert.deepEqual(relayed[0][2].additionalNodes,[{tag:'meta',attrs:{is_group_status:'true',origin:'group_status'}}]);
 await del({...base,msg:{key:{id:'normal',participant:user,remoteJid:group},message:{conversation:'hello'}}});assert.equal(sent.length,1);assert.equal(relayed.length,1);
});
test('confirmed-bot enforcement removes only explicit matches with fresh bot-admin permission',async()=>{
 const {enforceConfirmedBot}=await load('../utils/antiBotEnforcement.js',{'./moderation.js':`export const isProtectedGroupMember=(m,j)=>m.participants.some(p=>p.id===j && p.admin);`});
 let removed=[];let metadata={id:group,participants:[{id:bot,admin:'admin'},{id:user,lid:'789@lid'},{id:'999@s.whatsapp.net'}]};
 const sock={user:{id:bot},groupMetadata:async()=>metadata,groupParticipantsUpdate:async(_g,ids)=>{removed.push(...ids);return ids.map(jid=>({jid,status:'200'}));}};
 const settings={antiBotEnabled:true,blockedBotJids:[user]};
 assert.equal((await enforceConfirmedBot({sock,groupJid:group,memberJid:'999@s.whatsapp.net',settings})).status,'unconfirmed');
 assert.equal((await enforceConfirmedBot({sock,groupJid:group,memberJid:'789@lid',settings})).status,'removed');assert.deepEqual(removed,[user]);
 metadata={...metadata,participants:[{id:bot},{id:user}]};
 assert.equal((await enforceConfirmedBot({sock,groupJid:group,memberJid:user,settings})).status,'not-admin');assert.equal(removed.length,1);
});
test('badSession status ACK errors recover, while logout and conflicts stay stopped',async()=>{
 const {default:update}=await load('../core/connectionUpdate.js');
 const run=async(error)=>{const actions=[];await update(async a=>actions.push(a),{connection:'close',lastDisconnect:{error}});return actions;};
 assert.deepEqual(await run({output:{statusCode:500},message:'Stream Errored (ack)',data:{tag:'ack',attrs:{class:'status'}}}),['reconnect']);
 for(const code of [500,401,440,411])assert.deepEqual(await run({output:{statusCode:code}}),['session-stop']);
});
test('transient moderation state and media cache remain bounded under many identities',()=>{
 let now=0;const map=new BoundedTtlMap({max:100,ttl:1000,now:()=>now});
 for(let i=0;i<10000;i++)map.set(i,i);
 assert.equal(map.size,100);assert.equal(map.expiry.size,100);
 now=1001;map.prune();assert.equal(map.size,0);assert.equal(map.expiry.size,0);
 const cache=new FileCache(1024);clearInterval(cache.cleanupInterval);
 for(let i=0;i<1000;i++)cache.set(i,Buffer.alloc(1));assert.equal(cache.cache.size,256);assert.equal(cache.currentSize,256);cache.clear();
});
test('confirmed-bot removal preserves admins and reports WhatsApp denial without success',async()=>{
 const {enforceConfirmedBot}=await load('../utils/antiBotEnforcement.js');
 const metadata={id:'other@g.us',participants:[{id:bot,admin:'admin'},{id:user,admin:'admin'},{id:'2348222222222@s.whatsapp.net'}]};
 const calls=[];const sock={user:{id:bot},groupMetadata:async()=>metadata,groupParticipantsUpdate:async(_g,ids)=>{calls.push(...ids);return ids.map(jid=>({jid,status:'403'}));}};
 const settings={antiBotEnabled:true,blockedBotJids:[user,'2348222222222@s.whatsapp.net']};
 assert.equal((await enforceConfirmedBot({sock,groupJid:metadata.id,memberJid:user,settings})).status,'protected');assert.equal(calls.length,0);
 assert.equal((await enforceConfirmedBot({sock,groupJid:metadata.id,memberJid:'2348222222222@s.whatsapp.net',settings})).status,'denied');assert.equal(calls.length,1);
});
test('lyrics handles an empty provider search without crashing or delaying',async()=>{
 const previous=process.env.GENIUS_ACCESS_SECRET;process.env.GENIUS_ACCESS_SECRET='synthetic-test-access';
 try {
  const {default:factory}=await load('../commands/group/members/lyrics.js',{'genius-lyrics':'export default {Client:class { songs={search:async()=>[]}; }};'});
  const replies=[];await factory().handler({}, {}, group, ['unknown'], {evv:'unknown',sendMessageWTyping:async(_g,p)=>replies.push(p.text)});
  assert.equal(replies.length,1);assert.match(replies[0],/couldn't find that song/);
 } finally {if(previous===undefined)delete process.env.GENIUS_ACCESS_SECRET;else process.env.GENIUS_ACCESS_SECRET=previous;}
});
test('patched dependency interfaces and dashboard routes remain compatible',async()=>{
 const {createRequire}=await import('node:module');
 const require=createRequire(import.meta.url);
 const redstarPath=require.resolve('redstar',{paths:[require.resolve('node-fzf',{paths:[require.resolve('yt-search')]})]});
 const fromRedstar=createRequire(redstarPath), match=fromRedstar('minimatch');
 assert.equal(match('photo.jpg','*.jpg'),true);assert.equal(match('photo.jpg','*.txt'),false);
 const proxyRoot=new URL('../vendor/bgutil-ytdlp-pot-provider/package.json',import.meta.url);
 const fromVendor=createRequire(proxyRoot), proxyPath=fromVendor.resolve('proxy-agent');
 const pac=createRequire(proxyPath).resolve('pac-proxy-agent');
 const uri=createRequire(pac).resolve('get-uri');
 const ftp=await import(createRequire(uri).resolve('basic-ftp'));
 assert.equal(typeof ftp.Client.prototype.access,'function');assert.equal(typeof ftp.Client.prototype.list,'function');
 const fromDashboard=createRequire(new URL('../dashboard/package.json',import.meta.url));
 const router=await import(fromDashboard.resolve('react-router-dom'));
 const routes=[{path:'/login'},{path:'/groups/:id'},{path:'/health'}];
 assert.equal(router.matchRoutes(routes,'/groups/test')[0].params.id,'test');
 assert.equal(router.matchRoutes(routes,'/health')[0].route.path,'/health');
});
