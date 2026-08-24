export const GAME_RANKS = Object.freeze([
	{ name: "Rookie", emoji: "🌱", minPoints: 0 },
	{ name: "Explorer", emoji: "🧭", minPoints: 50 },
	{ name: "Challenger", emoji: "⚔️", minPoints: 150 },
	{ name: "Expert", emoji: "💎", minPoints: 350 },
	{ name: "Master", emoji: "👑", minPoints: 700 },
	{ name: "Legend", emoji: "🏆", minPoints: 1500 },
]);

export const getGameRank = (points = 0) => {
	const safePoints = Math.max(0, Number(points) || 0);
	let rank = GAME_RANKS[0];
	for (const candidate of GAME_RANKS) {
		if (safePoints < candidate.minPoints) break;
		rank = candidate;
	}
	const index = GAME_RANKS.indexOf(rank);
	const next = GAME_RANKS[index + 1] || null;
	return {
		...rank,
		next,
		pointsToNext: next ? Math.max(0, next.minPoints - safePoints) : 0,
	};
};

export const formatGameRank = (points = 0) => {
	const rank = getGameRank(points);
	return `${rank.emoji} ${rank.name}`;
};
