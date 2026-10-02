import messageQueue from '../../../queue/messageQueue.js';
import { readGroupClub, saveGroupClub } from '../../../db/groupClubData.js';
import { registerInteractivePoll, finishInteractivePoll } from '../../../utils/pollManager.js';
import { clubPrompt, clubCanManage, submitClubEntry, clubOptions, tallyClub, clubBoard, clubResult } from '../../../utils/groupClub.js';

const locks = new Map();
const serial = async (jid, action) => {
  const previous = locks.get(jid) || Promise.resolve();
  const next = previous.catch(()=>{}).then(action);
  locks.set(jid,next);
  try { return await next; } finally { if (locks.get(jid)===next) locks.delete(jid); }
};
const handler = async (sock,msg,from,args,info) => serial(from, async()=>{
  const prefix = info.prefix || '$';
  const reply = text => info.sendMessageWTyping(from,{text},{quoted:msg});
  if (!from.endsWith('@g.us')) return reply('Group Club is for group chats.');
  const action = String(args[0]||'help').toLowerCase();
  if (action==='help') return reply(`🎨 *Alpha Group Club*\n\n${prefix}club start caption|pitch|tagline\n${prefix}club submit Your entry\n${prefix}club status\n${prefix}club vote\n${prefix}club finish\n${prefix}club stop\n\nOne entry per member; resubmit to edit. Maximum 8 entries, 240 characters each. Keep entries friendly. Starter and admins can play and manage. Voting lasts 10 minutes; use finish to announce the result. Everyone in the group may vote, including entrants. Sessions last up to 24 hours and survive restarts.`);
  try {
    let session = await readGroupClub(from);
    const active = session && ['collecting','voting'].includes(session.phase) && new Date(session.expiresAt)>new Date();
    if (action==='start') {
      if (active) return reply(`A Group Club is already active. Use ${prefix}club status.`);
      const mode = String(args[1]||'caption').toLowerCase();
      session = {ownerJid:info.senderJid,mode,prompt:clubPrompt(mode),phase:'collecting',entries:[],expiresAt:new Date(Date.now()+86400000)};
      await saveGroupClub(from,session);
      return reply(`🎨 *Group Club: ${mode}*\n\n${session.prompt}\n\nSubmit with ${prefix}club submit Your entry\nMaximum 8 entries. Starter/admin: use ${prefix}club vote when ready.`);
    }
    if (action==='status' && session?.phase==='completed') return reply(clubResult(session.result));
    if (!active) return reply(`No active Group Club. Start one with ${prefix}club start caption.`);
    if (action==='submit') {
      submitClubEntry(session,{senderJid:info.senderJid,name:info.updateName||msg.pushName,text:args.slice(1).join(' '),metadata:info.groupMetadata});
      delete session._id;
      await saveGroupClub(from,session);
      return reply(`✅ Entry saved (${session.entries.length}/8). You can edit it by submitting again before voting opens.`);
    }
    if (action==='status') return reply(`🎨 ${session.mode} · ${session.phase}\n${session.prompt}\n\n${clubBoard(session)}${session.phase==='voting'?'\n\nVote on the poll. Starter/admin: finish announces the result.':''}`);
    if (!['vote','finish','stop'].includes(action)) return reply(`Use ${prefix}club help for commands.`);
    if (!clubCanManage(session,info)) return reply('Only the starter, group admins or owner can manage this contest.');
    if (action==='vote') {
      if (session.phase!=='collecting') return reply('Voting is already open.');
      if (session.entries.length<2) return reply('At least 2 different members must submit before voting.');
      await reply(`🎨 *Choose your favourite entry*\n${session.prompt}\n\n${clubBoard(session)}\n\nVote for the matching entry number. Voting lasts 10 minutes.`);
      const sent = await messageQueue.enqueue(from, () => sock.sendMessage(from,{poll:{name:`Group Club: ${session.mode}`,values:clubOptions(session),selectableCount:1}},{quoted:msg}), 1);
      await registerInteractivePoll({sentMessage:sent,groupJid:from,type:'group-club',options:clubOptions(session),ttlMs:600000});
      session.phase='voting';session.pollId=sent.key.id;
    } else if (action==='finish') {
      if (session.phase!=='voting') return reply(`Open voting first with ${prefix}club vote.`);
      const poll = await finishInteractivePoll(session.pollId);
      if (!poll) throw new Error('Poll session unavailable');
      session.result=tallyClub(session,poll.votes||[],info.groupMetadata);
      session.phase='completed';
    } else {
      if (session.pollId) await finishInteractivePoll(session.pollId);
      session.phase='stopped';
    }
    delete session._id;
    await saveGroupClub(from,session);
    return reply(session.phase==='completed'?clubResult(session.result):session.phase==='stopped'?'Group Club stopped.':`📊 Voting is open. Use ${prefix}club finish to announce the winner. Results are also available with ${prefix}club status after finishing.`);
  } catch(error) {
    console.warn('[GROUP_CLUB]',error.message);
    if (/Choose caption|Submissions|entry of|8 entries/.test(error.message)) return reply(error.message);
    return reply(`Group Club hit a temporary error. Check ${prefix}club status before retrying.`);
  }
});
export default ()=>({cmd:['club'],desc:'Group caption contests, funny product pitches and tagline challenges with native poll voting and winners',usage:'club start caption | club start pitch | club start tagline | club submit My entry | club status | club vote | club finish | club stop | club help',handler});
