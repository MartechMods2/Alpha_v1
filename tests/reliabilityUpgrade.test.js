import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
const asModule = source => `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;

test('queue cleanup preserves a chat with an in-flight send and delivers subsequent messages', async t => {
  t.mock.method(globalThis, 'setInterval', () => ({unref(){}}));
  const source = await readFile(new URL('../queue/messageQueue.js', import.meta.url), 'utf8');
  const {default: queue} = await import(asModule(source));
  queue.messageDelay = 0;
  let release;
  const started = new Promise(resolve => { release = resolve; });
  const order = [];
  const first = queue.enqueue('queue@s.whatsapp.net', async () => { await started; order.push(1); });
  queue.cleanupEmptyQueues();
  assert.equal(queue.queues.has('queue@s.whatsapp.net'), true);
  const second = queue.enqueue('queue@s.whatsapp.net', async () => { order.push(2); });
  release();
  await Promise.all([first, second]);
  assert.deepEqual(order, [1, 2]);
});

test('poll persistence rejects older votes and keeps retractions across reloads', async t => {
  let row = {_id:'poll', status:'open', votes:[]};
  globalThis.__reliabilityPollCollection = {
    async findOneAndUpdate(filter, pipeline) {
      const timestamp = filter.votes.$not.$elemMatch.votedAt.$gt;
      if (row.status !== 'open' || row.votes.some(v => v.voterJid === filter.votes.$not.$elemMatch.voterJid && v.votedAt > timestamp)) return null;
      const vote = pipeline[0].$set.votes.$concatArrays[1].$literal[0];
      row.votes = [...row.votes.filter(v => v.voterJid !== vote.voterJid), structuredClone(vote)];
      return structuredClone(row);
    },
    async findOne() { return structuredClone(row); },
  };
  t.after(() => { delete globalThis.__reliabilityPollCollection; });
  const client = asModule('export default {db:()=>({collection:()=>globalThis.__reliabilityPollCollection})};');
  const store = new URL('../utils/pollMessageStore.js', import.meta.url).href;
  const source = (await readFile(new URL('../db/pollSessionData.js', import.meta.url), 'utf8'))
    .replace('from "./client.js"', `from "${client}"`).replace('from "../utils/pollMessageStore.js"', `from "${store}"`);
  const db = await import(asModule(source));
  await db.replacePollVote('poll', 'guest@lid', 'Join', new Date(1000));
  await db.replacePollVote('poll', 'guest@lid', '', new Date(3000));
  assert.equal(await db.replacePollVote('poll', 'guest@lid', 'Join', new Date(2000)), null);
  const restored = await db.getPollSession('poll');
  assert.equal(restored.votes[0].option, '');
  assert.equal(restored.votes[0].votedAt.getTime(), 3000);
  await db.replacePollVote('poll', 'guest@lid', 'Join', new Date(4000));
  assert.equal(row.votes.length, 1);
  assert.equal(row.votes[0].option, 'Join');
  await assert.rejects(db.replacePollVote('poll','guest@lid','Join','bad-date'), /Invalid/);
});

test('birthday confirmation closes its cached poll and cannot repeat on replay', async () => {
  const root = new URL('../utils/pollManager.js', import.meta.url);
  const state = {row:null, saves:0, replies:0};
  globalThis.__birthdayReliability = state;
  try {
    const mocks = {
      '../db/pollSessionData.js': asModule(`const s=globalThis.__birthdayReliability;
        export async function createPollSession(row){s.row=structuredClone(row);return s.row;}
        export async function getPollSession(){return s.row;}
        export async function replacePollVote(){}
        export async function closePollSession(){return {...s.row,status:'closed'};}`),
      '../db/groupTools.js': asModule('export async function setGroupBirthday(){globalThis.__birthdayReliability.saves++;}'),
      '../queue/messageQueue.js': asModule('export default {enqueue:async (_jid,send)=>send()};'),
    };
    const source = (await readFile(root, 'utf8')).replace(/from "([^"]+)"/g, (_match, name) => `from "${mocks[name] || new URL(name,root).href}"`);
    const polls = await import(asModule(source));
    const group = 'birthday@g.us';
    const sock = {sendMessage:async()=>{state.replies++;}};
    await polls.registerInteractivePoll({sentMessage:{key:{id:'birthday-poll',remoteJid:group},message:{}},groupJid:group,type:'birthday-confirm',ownerJid:'creator@lid',options:['✅ Save'],payload:{day:25,month:9,name:'Martech'}});
    const {createHash} = await import('node:crypto');
    const event = {key:{id:'birthday-poll',remoteJid:group},update:{pollUpdates:[{pollUpdateMessageKey:{participant:'creator@lid'},vote:{selectedOptions:[createHash('sha256').update('✅ Save').digest()]}}]}};
    assert.equal(await polls.handleInteractivePollUpdate(sock, {...event,key:{...event.key,remoteJid:'other@g.us'}}), false);
    await polls.handleInteractivePollUpdate(sock,event);
    await polls.handleInteractivePollUpdate(sock,event);
    assert.equal(state.saves,1);
    assert.equal(state.replies,1);
    assert.equal((await polls.readInteractivePoll('birthday-poll')).status,'closed');
  } finally {delete globalThis.__birthdayReliability;}
});
