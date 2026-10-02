import { randomInt } from 'node:crypto';
import { isSameGroupUser } from './groupParticipants.js';
import { safeDisplayName } from './alphaStyle.js';

export const CLUB_PROMPTS = {
  caption: ['Your phone battery is at 1% and the group chooses now to start a game.', 'You hear “food is ready” but the pot is still on the stove.', 'The group admin says “one quick announcement” and sends 14 voice notes.', 'Your code works only while somebody is watching.'],
  pitch: ['Pitch a ridiculous but useful invention for surviving a power outage.', 'Sell the group a gadget that stops people saying “I am five minutes away”.', 'Pitch an app that makes Monday mornings easier.', 'Invent a harmless superpower that would improve group chats.'],
  tagline: ['Write a catchy slogan for a fictional jollof delivery business.', 'Give Alpha a funny game-night slogan.', 'Create a slogan for a fictional Wi-Fi café.', 'Write a slogan for a team that always makes a comeback.'],
};
export const clubPrompt = mode => {
  if (!CLUB_PROMPTS[mode]) throw new Error('Choose caption, pitch or tagline.');
  return CLUB_PROMPTS[mode][randomInt(CLUB_PROMPTS[mode].length)];
};
export const clubCanManage = (session, info) => Boolean(info.isOwner || info.isGroupAdmin || isSameGroupUser(info.groupMetadata, info.senderJid, [session.ownerJid]));
export const submitClubEntry = (session, {senderJid, name, text, metadata}) => {
  if (session.phase !== 'collecting') throw new Error('Submissions are closed.');
  const entry = String(text || '').replace(/[\r\n\t]/g,' ').replace(/\s+/g,' ').trim();
  if (!entry || entry.length > 240) throw new Error('Send an entry of 1–240 characters.');
  const index = session.entries.findIndex(row => isSameGroupUser(metadata,senderJid,[row.jid]));
  if (index < 0 && session.entries.length >= 8) throw new Error('This contest already has 8 entries.');
  const row = {jid:senderJid, name:safeDisplayName(name,senderJid), text:entry};
  if (index >= 0) session.entries[index] = row;
  else session.entries.push(row);
  return session;
};
export const clubOptions = session => session.entries.map((_row,index) => `Entry ${index+1}`);
export const tallyClub = (session, votes, metadata) => {
  const latest = [];
  for (const vote of [...votes].sort((a,b)=>new Date(a.votedAt||0)-new Date(b.votedAt||0))) {
    const index = latest.findIndex(row=>isSameGroupUser(metadata,vote.voterJid,[row.voterJid]));
    if (index >= 0) latest[index]=vote; else latest.push(vote);
  }
  const scores = clubOptions(session).map((option,index)=>({...session.entries[index], votes:latest.filter(v=>v.option===option).length}));
  const max = Math.max(0,...scores.map(row=>row.votes));
  return {scores,winners:max ? scores.filter(row=>row.votes===max) : []};
};
export const clubBoard = session => session.entries.map((row,index)=>`${index+1}. ${row.name}: ${row.text}`).join('\n\n') || 'No entries yet.';
export const clubResult = result => result.winners.length
  ? `🏆 Group Club ${result.winners.length>1?'tie':'winner'}: ${result.winners.map(row=>row.name).join(', ')}\n\n${result.scores.map(row=>`${row.name}: ${row.votes} vote(s)`).join('\n')}`
  : '🎨 Group Club finished with no votes. No winner was selected.';
