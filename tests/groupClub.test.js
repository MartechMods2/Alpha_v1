import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { clubPrompt, submitClubEntry, tallyClub, clubCanManage } from '../utils/groupClub.js';
const metadata={participants:[{id:'one@s.whatsapp.net',lid:'one@lid'},{id:'two@s.whatsapp.net',lid:'two@lid'}]};
test('club validates modes, entry length, one entry per identity and management permissions',()=>{
  for (const mode of ['caption','pitch','tagline']) assert.ok(clubPrompt(mode));
  assert.throws(()=>clubPrompt('bad'),/Choose/);
  const session={phase:'collecting',ownerJid:'one@s.whatsapp.net',entries:[]};
  submitClubEntry(session,{senderJid:'one@s.whatsapp.net',name:'One',text:'First',metadata});
  submitClubEntry(session,{senderJid:'one@lid',name:'One',text:'Edited',metadata});
  assert.equal(session.entries.length,1);
  assert.equal(session.entries[0].text,'Edited');
  assert.throws(()=>submitClubEntry(session,{text:'x'.repeat(241)}),/240/);
  assert.equal(clubCanManage(session,{senderJid:'one@lid',groupMetadata:metadata}),true);
  assert.equal(clubCanManage(session,{senderJid:'two@lid',groupMetadata:metadata}),false);
  assert.equal(clubCanManage(session,{isGroupAdmin:true}),true);
});
test('club tallies latest PN/LID votes, retractions, ties and no-vote contests',()=>{
  const session={entries:[{name:'One'},{name:'Two'}]};
  const result=tallyClub(session,[
    {voterJid:'one@s.whatsapp.net',option:'Entry 1',votedAt:1},
    {voterJid:'one@lid',option:'Entry 2',votedAt:2},
    {voterJid:'two@lid',option:'Entry 1',votedAt:3},
  ],metadata);
  assert.equal(result.winners.length,2);
  assert.equal(result.scores[0].votes,1);
  const retracted=tallyClub(session,[{voterJid:'one@lid',option:'Entry 1',votedAt:1},{voterJid:'one@s.whatsapp.net',option:'',votedAt:2}],metadata);
  assert.equal(retracted.winners.length,0);
});
test('club command runs submissions, admin participation, poll voting, finish and reload',async()=>{
  const state={row:null,poll:null,replies:[]};
  globalThis.__clubFlow=state;
  const module=source=>`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;
  const mocks={
    '../../../queue/messageQueue.js':module('export default {enqueue:async (_jid,send)=>send()};'),
    '../../../db/groupClubData.js':module(`const s=globalThis.__clubFlow; export async function readGroupClub(){return structuredClone(s.row);} export async function saveGroupClub(_jid,row){s.row=structuredClone(row);}`),
    '../../../utils/pollManager.js':module(`const s=globalThis.__clubFlow;export async function registerInteractivePoll(row){s.poll={...row,votes:[]};}export async function readInteractivePoll(){return s.poll;}export async function finishInteractivePoll(){return s.poll;}`),
  };
  const url=new URL('../commands/group/members/groupClub.js',import.meta.url);
  const source=(await readFile(url,'utf8')).replace(/from '([^']+)'/g,(_m,p)=>`from '${mocks[p]||new URL(p,url).href}'`);
  try{
    const command=(await import(module(source))).default();
    const info={senderJid:'one@s.whatsapp.net',updateName:'One',groupMetadata:metadata,isGroupAdmin:true,prefix:'!',sendMessageWTyping:async(_jid,payload)=>{state.replies.push(payload);return {key:{id:'poll',remoteJid:'club@g.us'},message:{}};}};
    const run=(args,overrides={})=>command.handler({sendMessage:info.sendMessageWTyping}, {}, 'club@g.us',args,{...info,...overrides});
    await run(['start','caption']);
    await run(['submit','Admin entry']);
    await run(['vote']);assert.equal(state.row.phase,'collecting');
    await run(['submit','Member entry'],{senderJid:'two@lid',updateName:'Two',isGroupAdmin:false});
    await run(['vote'],{senderJid:'two@lid',isGroupAdmin:false});assert.equal(state.row.phase,'collecting');
    await run(['vote']);assert.equal(state.row.phase,'voting');
    await run(['submit','Late entry']);assert.match(state.replies.at(-1).text,/closed/);
    state.poll.votes=[{voterJid:'two@lid',option:'Entry 1',votedAt:new Date()}];
    await run(['finish']);assert.equal(state.row.phase,'completed');assert.match(state.replies.at(-1).text,/winner: One/);
    await run(['status']);assert.match(state.replies.at(-1).text,/winner: One/);
    await run(['start','pitch']);assert.equal(state.row.mode,'pitch');
    await run(['stop']);assert.equal(state.row.phase,'stopped');
  }finally{delete globalThis.__clubFlow;}
});
