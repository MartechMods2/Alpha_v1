import mdClient from "./client.js";
const sessions = mdClient.db("MyBotDataDB").collection("AutoGameSessions");
export const saveAutoGame = (groupJid, snapshot) => sessions.updateOne(
  { _id: groupJid }, { $set: { ...snapshot, groupJid, updatedAt: new Date() } }, { upsert: true });
export const readAutoGame = (groupJid) => sessions.findOne({ _id: groupJid });
export const listAutoGames = () => sessions.find({ status: { $in: ["lobby", "playing"] } }).toArray();
export const deleteAutoGame = (groupJid) => sessions.deleteOne({ _id: groupJid });
