import mdClient from "./client.js";

const gameScores = mdClient.db("MyBotDataDB").collection("GameScores");

const scoreId = (groupJid, memberJid) => `${groupJid}:${memberJid}`;
const safeName = (value) =>
	String(value || "Player").replace(/[\r\n\t*_~`]/g, " ").replace(/\s+/g, " ").trim().slice(0, 80) || "Player";
const gameField = (game) => `byGame.${String(game || "other").replace(/[^a-z0-9_-]/gi, "").slice(0, 30) || "other"}`;

export const recordGameResult = async ({
	groupJid,
	memberJid,
	name,
	game,
	points = 0,
	won = false,
	correct = false,
}) => {
	const awarded = Math.max(0, Math.min(100, Number(points) || 0));
	const nextStreak = correct
		? { $add: [{ $ifNull: ["$streak", 0] }, 1] }
		: 0;
	const result = await gameScores.findOneAndUpdate(
		{ _id: scoreId(groupJid, memberJid) },
		[
			{
				$set: {
					groupJid,
					memberJid,
					name: safeName(name),
					points: { $add: [{ $ifNull: ["$points", 0] }, awarded] },
					plays: { $add: [{ $ifNull: ["$plays", 0] }, 1] },
					wins: { $add: [{ $ifNull: ["$wins", 0] }, won ? 1 : 0] },
					correct: { $add: [{ $ifNull: ["$correct", 0] }, correct ? 1 : 0] },
					streak: nextStreak,
					[gameField(game)]: { $add: [{ $ifNull: [`$${gameField(game)}`, 0] }, awarded] },
					updatedAt: "$$NOW",
				},
			},
			{
				$set: {
					bestStreak: { $max: [{ $ifNull: ["$bestStreak", 0] }, "$streak"] },
					createdAt: { $ifNull: ["$createdAt", "$$NOW"] },
				},
			},
		],
		{ upsert: true, returnDocument: "after" },
	);
	return result;
};

export const getGameProfile = (groupJid, memberJid) =>
	gameScores.findOne({ _id: scoreId(groupJid, memberJid) });

export const getGameLeaderboard = (groupJid, limit = 10) =>
	gameScores
		.find({ groupJid })
		.sort({ points: -1, wins: -1, bestStreak: -1, updatedAt: 1 })
		.limit(Math.max(1, Math.min(20, limit)))
		.toArray();

export const resetGroupGameScores = (groupJid) => gameScores.deleteMany({ groupJid });

export { gameScores };
