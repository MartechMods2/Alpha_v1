import mdClient from './client.js';
const clubs = mdClient.db('MyBotDataDB').collection('GroupClubSessions');
export const readGroupClub = groupJid => clubs.findOne({_id:groupJid});
export const saveGroupClub = (groupJid, session) => clubs.updateOne({_id:groupJid}, {$set:{...session, updatedAt:new Date()}}, {upsert:true});
