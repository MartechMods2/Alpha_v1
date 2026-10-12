import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';
import {privateChatTarget,renderPrivateGuide} from '../utils/privateGuide.js';
import {MODERATOR_MODES,moderatorModeInstruction} from '../utils/moderatorModes.js';
import {moderatorProfileJid} from '../utils/moderatorProfile.js';
import {isInternalDiagnosticReply,sanitizeAlphaErrorMessage} from '../utils/alphaErrorReporter.js';
test('private targets reject groups and mode instructions require authorization',()=>{
  assert.equal(privateChatTarget('123:1@s.whatsapp.net'),'123@s.whatsapp.net');assert.throws(()=>privateChatTarget('group@g.us'));
  for(const mode of Object.keys(MODERATOR_MODES))assert.equal(moderatorModeInstruction(mode,false),'');
  assert.match(moderatorModeInstruction('savage',true),/avoid threats/);assert.equal(moderatorModeInstruction('normal',true),'');
});
test('moderator profiles resolve PN/LID aliases and exclude ordinary admins',()=>{
  const old=process.env.MODERATORS;process.env.MODERATORS='123';
  try{const groupMetadata={participants:[{id:'123@s.whatsapp.net',lid:'abc@lid'}]};assert.equal(moderatorProfileJid({senderJid:'abc@lid',groupMetadata}),'123@s.whatsapp.net');assert.equal(moderatorProfileJid({senderJid:'456@s.whatsapp.net',isGroupAdmin:true,groupMetadata}),null);}finally{if(old===undefined)delete process.env.MODERATORS;else process.env.MODERATORS=old;}
});
test('private guide includes every supplied command, usage, example and disabled status',()=>{
  const text=renderPrivateGuide([{name:'sample',description:'Example',access:'Owner',disabled:true,category:'system',syntax:['$sample <text>'],examples:['$sample hello'],notes:['Note']}]);assert.match(text,/globally disabled/);assert.match(text,/\$sample <text>/);assert.match(text,/\$sample hello/);
});
test('internal diagnostic replies are detected and private errors redact credentials',()=>{
  assert.equal(isInternalDiagnosticReply('❌ MongoServerError: database offline'),true);assert.equal(isInternalDiagnosticReply('❌ Use a valid date.'),false);assert.equal(isInternalDiagnosticReply('Discuss AxiosError in code'),false);
  const text=sanitizeAlphaErrorMessage('mongodb+srv://user:pass@host/db password=supersecret api_key=mykey');assert.doesNotMatch(text,/user:pass|supersecret|mykey/);
});
test('private console sends a guide document only to the moderator and stores modes privately',async()=>{
  const state={sent:[],replies:[],row:{},writes:[]};globalThis.__privateConsole=state;
  const mod=source=>`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;
  const mocks={
    '../../utils/commandLoader.js':mod('export async function cmdToText(){return {publicCommands:[{cmd:["sample"],desc:"Sample",usage:"sample <text>"}]};}'),
    '../../db/botData.js':mod('export async function getBotData(){return {};}'),
    '../../db/members.js':mod('const s=globalThis.__privateConsole;export const member={findOne:async()=>s.row,updateOne:async(...args)=>{s.writes.push(args);s.row={...s.row,...args[1].$set};}};'),
    '../../queue/messageQueue.js':mod('export default {enqueue:async(_jid,send)=>send()};'),
  };
  const url=new URL('../commands/owner/privateConsole.js',import.meta.url);const source=(await readFile(url,'utf8')).replace(/from '([^']+)'/g,(_m,p)=>`from '${mocks[p]||new URL(p,url).href}'`);
  try{
    const command=(await import(mod(source))).default();const sock={sendMessage:async(jid,payload)=>{state.sent.push({jid,payload});}};
    const info={isOwner:true,senderJid:'test@s.whatsapp.net',command:'privateguide',prefix:'$',sendMessageWTyping:async(jid,payload)=>{state.replies.push({jid,payload});}};
    await command.handler(sock,{},'group@g.us',['all'],info);assert.equal(state.sent[0].jid,info.senderJid);assert.ok(Buffer.isBuffer(state.sent[0].payload.document));assert.match(state.sent[0].payload.document.toString(),/\$sample/);assert.equal(state.replies[0].payload.text,'📩 Sent to your personal chat.');
    await command.handler(sock,{},'group@g.us',['emotional'],{...info,command:'privatemode'});assert.equal(state.writes[0][1].$set.moderatorSupportMode,'emotional');assert.match(state.sent.at(-1).payload.text,/emotional/);
    const previous=state.sent.length;await command.handler(sock,{},'group@g.us',['angry'],{...info,command:'privatemode',isOwner:false,isGroupAdmin:true,senderJid:'nobody@s.whatsapp.net'});assert.equal(state.sent.length,previous);
  }finally{delete globalThis.__privateConsole;}
});
test('existing runtime reports are delivered privately with only a group acknowledgement',async()=>{
  const {default:factory}=await import('../commands/owner/runtimeMaintenance.js');const sent=[],replies=[];
  await factory().handler({sendMessage:async(jid,p)=>sent.push({jid,p})},{},'group@g.us',[],{isOwner:true,senderJid:'perf-test@s.whatsapp.net',command:'alphaperf',sendMessageWTyping:async(jid,p)=>replies.push({jid,p})});
  assert.equal(sent[0].jid,'perf-test@s.whatsapp.net');assert.match(sent[0].p.text,/Heap:/);assert.doesNotMatch(replies[0].p.text,/Heap|Queued messages/);
});
test('main AI response construction gates saved modes using runtime moderator identity',async()=>{
  const text=await readFile(new URL('../commands/public/chatbot.js',import.meta.url),'utf8');assert.match(text,/moderatorProfileJid\(msgInfoObj\)/);assert.match(text,/moderatorModeInstruction\(supportPreferences\.moderatorSupportMode, Boolean\(moderatorProfile\)\)/);assert.match(text,/\n\s+moderatorStyle,/);
});
