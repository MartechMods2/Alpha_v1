import mdClient from "./client.js";

const truthDareStats = mdClient.db("MyBotDataDB").collection("TruthDareStats");

const safeName = (value) =>
  String(value || "Player")
    .replace(/[\r\n\t*_~`]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80) || "Player";

const statId = (groupJid, memberJid) => `${groupJid}:${memberJid}`;

export const recordTruthDareSessionPlayer = async ({
  groupJid,
  memberJid,
  name,
  points = 0,
  truths = 0,
  dares = 0,
  skips = 0,
  timeouts = 0,
  won = false,
  perfect = false,
}) => {
  const cleanPoints = Math.max(0, Math.min(500, Number(points) || 0));
  return truthDareStats.findOneAndUpdate(
    { _id: statId(groupJid, memberJid) },
    {
      $set: {
        groupJid,
        memberJid,
        name: safeName(name),
        updatedAt: new Date(),
      },
      $setOnInsert: { createdAt: new Date() },
      $inc: {
        sessions: 1,
        points: cleanPoints,
        truths: Math.max(0, Number(truths) || 0),
        dares: Math.max(0, Number(dares) || 0),
        skips: Math.max(0, Number(skips) || 0),
        timeouts: Math.max(0, Number(timeouts) || 0),
        wins: won ? 1 : 0,
        perfectRuns: perfect ? 1 : 0,
      },
    },
    { upsert: true, returnDocument: "after" },
  );
};

export const getTruthDareProfile = (groupJid, memberJid) =>
  truthDareStats.findOne({ _id: statId(groupJid, memberJid) });

export const getTruthDareLeaderboard = (groupJid, limit = 10) =>
  truthDareStats
    .find({ groupJid })
    .sort({ points: -1, wins: -1, perfectRuns: -1, updatedAt: 1 })
    .limit(Math.max(1, Math.min(20, Number(limit) || 10)))
    .toArray();

export { truthDareStats };
