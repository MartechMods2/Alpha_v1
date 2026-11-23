import test from 'node:test';
import assert from 'node:assert/strict';
import { createReceiptTracker, receiptReport } from '../utils/messageReceipts.js';
const group = '123-456@g.us';
const update = (id='one', jid='123@s.whatsapp.net', fields={ readTimestamp: 100 }) => ({ key: { remoteJid: group, id, fromMe: true }, receipt: { userJid: jid, ...fields } });
test('merges and deduplicates delivery/read events without downgrading', () => {
 const t=createReceiptTracker(); t.record([update('one','123:4@s.whatsapp.net'),update('one','123@s.whatsapp.net',{receiptTimestamp:90}),update('one','123@s.whatsapp.net',{readTimestamp:80})]);
 assert.deepEqual(t.get(group,'one'),[{jid:'123@s.whatsapp.net',read:100,delivered:90}]);
 assert.deepEqual(t.get('999@g.us','one'),[]);
});
test('rejects receipts for other senders, private chats and invalid timestamps',()=>{
 const t=createReceiptTracker();const a=update();a.key.fromMe=false;const b=update();b.key.remoteJid='123@s.whatsapp.net';
 t.record([a,b,update('one','invalid'),update('one','123@lid',{readTimestamp:-1}),null]);assert.equal(t.get(group,'one').length,0);
});
test('memory limits and retention apply even when repeated updates arrive',()=>{
 let now=0;const t=createReceiptTracker({now:()=>now,max:1,maxReaders:1,ttl:100});t.record([update(),update('one','456@lid')]);assert.equal(t.get(group,'one').length,1);
 now=50;t.record([update()]);now=101;assert.equal(t.get(group,'one').length,0);
 t.record([update(),update('two')]);assert.equal(t.get(group,'one').length,0);assert.equal(t.get(group,'two').length,1);t.clear();assert.equal(t.get(group,'two').length,0);
});
const setup=()=>{const sent=[];return {sent,sock:{user:{id:'999:2@s.whatsapp.net'}},info:{isGroup:true,isGroupAdmin:true,botJids:['999@s.whatsapp.net'],extendedMessageOriginal:{stanzaId:'one',participant:'999@s.whatsapp.net'},sendMessageWTyping:async(to,payload)=>sent.push(payload)}};};
test('receipt command checks group, admin and quoted message ownership',async()=>{
 const f=setup();f.info.isGroupAdmin=false;await receiptReport(f.sock,{},group,[],f.info);assert.match(f.sent.at(-1).text,/Only group admins/);
 f.info.isGroupAdmin=true;f.info.extendedMessageOriginal.participant='888@s.whatsapp.net';await receiptReport(f.sock,{},group,[],f.info);assert.match(f.sent.at(-1).text,/separate account/);
 f.info.extendedMessageOriginal.participant='999@s.whatsapp.net';f.info.extendedMessageOriginal.remoteJid='other@g.us';await receiptReport(f.sock,{},group,[],f.info);assert.match(f.sent.at(-1).text,/this group/);
});
test('unknown is never represented as unread and reports do not tag recipients',async()=>{
 const f=setup(),t=createReceiptTracker();await receiptReport(f.sock,{},group,[],f.info,t);assert.match(f.sent.at(-1).text,/does not mean nobody read/);
 t.record([update(),update('one','456@lid',{receiptTimestamp:99})]);await receiptReport(f.sock,{},group,[],f.info,t);
 const result=f.sent.at(-1);assert.match(result.text,/Read: \*1\*/);assert.match(result.text,/read not recorded: \*1\*/);assert.equal(result.mentions,undefined);
});
test('pagination bounds report size',async()=>{
 const f=setup(),t=createReceiptTracker();t.record(Array.from({length:25},(_,i)=>update('one',`${100+i}@lid`)));await receiptReport(f.sock,{},group,['1'],f.info,t);assert.match(f.sent.at(-1).text,/Page 1\/2/);assert.equal((f.sent.at(-1).text.match(/✓✓ Read/g)||[]).length,20);
 await receiptReport(f.sock,{},group,['3'],f.info,t);assert.match(f.sent.at(-1).text,/between 1 and 2/);
});
test('phone and LID aliases count the same group member once',async()=>{
 const f=setup(),t=createReceiptTracker();f.info.groupMetadata={participants:[{id:'123@lid',phoneNumber:'456@s.whatsapp.net'}]};t.record([update('one','123@lid'),update('one','456@s.whatsapp.net')]);await receiptReport(f.sock,{},group,[],f.info,t);assert.match(f.sent.at(-1).text,/Read: \*1\*/);
});
