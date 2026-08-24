import mdClient from "./client.js";

const gameScores = mdClient.db("MyBotDataDB").collection("GameScores");
const dailyChallenges = mdClient.db("MyBotDataDB").collection("GameDailyChallenges");

const scoreId = (groupJid, memberJid) => `${groupJid}:${memberJid}`;
const safeName = (value) =>
	String(value || "Player").replace(/[\r\n\t*_~`]/g, " ").replace(/\s+/g, " ").trim().slice(0, 80) || "Player";
const safeGameKey = (game) => String(game || "other").replace(/[^a-z0-9_-]/gi, "").slice(0, 30) || "other";
const gameField = (game) => `byGame.${safeGameKey(game)}`;

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
	const gameKey = safeGameKey(game);
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
					[`gamePlays.${gameKey}`]: {
						$add: [{ $ifNull: [`$gamePlays.${gameKey}`, 0] }, 1],
					},
					[`gameWins.${gameKey}`]: {
						$add: [{ $ifNull: [`$gameWins.${gameKey}`, 0] }, won ? 1 : 0],
					},
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

export const getBattleLeaderboard = (groupJid, limit = 10) =>
	gameScores
		.find({ groupJid, "gamePlays.battle": { $gt: 0 } })
		.sort({ "gameWins.battle": -1, "byGame.battle": -1, points: -1 })
		.limit(Math.max(1, Math.min(20, limit)))
		.toArray();

export const getGroupGameStats = async (groupJid) => {
	const [stats] = await gameScores.aggregate([
		{ $match: { groupJid } },
		{
			$group: {
				_id: null,
				players: { $sum: 1 },
				points: { $sum: "$points" },
				plays: { $sum: "$plays" },
				wins: { $sum: "$wins" },
				bestStreak: { $max: "$bestStreak" },
			},
		},
	]).toArray();
	return stats || { players: 0, points: 0, plays: 0, wins: 0, bestStreak: 0 };
};

export const getDailyChallengeClaim = (groupJid, dateKey) =>
	dailyChallenges.findOne({ _id: `${groupJid}:${dateKey}` });

export const claimDailyChallenge = async ({ groupJid, dateKey, memberJid, name }) => {
	try {
		await dailyChallenges.insertOne({
			_id: `${groupJid}:${dateKey}`,
			groupJid,
			dateKey,
			memberJid,
			name: safeName(name),
			claimedAt: new Date(),
			expiresAt: new Date(Date.now() + 120 * 86_400_000),
		});
		return true;
	} catch (error) {
		if (error?.code === 11000) return false;
		throw error;
	}
};

export const resetGroupGameScores = (groupJid) => gameScores.deleteMany({ groupJid });

export { dailyChallenges, gameScores };
