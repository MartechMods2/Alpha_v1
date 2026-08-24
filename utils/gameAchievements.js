export const GAME_ACHIEVEMENTS = Object.freeze([
	{ id: "first_win", emoji: "🥉", name: "First Blood", test: (profile) => (profile.wins || 0) >= 1 },
	{ id: "hot_streak", emoji: "🔥", name: "Hot Streak", test: (profile) => (profile.bestStreak || 0) >= 3 },
	{ id: "ten_games", emoji: "🎮", name: "Arena Regular", test: (profile) => (profile.plays || 0) >= 10 },
	{ id: "centurion", emoji: "💯", name: "Point Hunter", test: (profile) => (profile.points || 0) >= 100 },
	{ id: "battle_win", emoji: "⚔️", name: "Duelist", test: (profile) => (profile.gameWins?.battle || 0) >= 1 },
	{ id: "daily_win", emoji: "🌞", name: "Daily Hero", test: (profile) => (profile.gameWins?.daily || 0) >= 1 },
	{ id: "five_streak", emoji: "☄️", name: "Unstoppable", test: (profile) => (profile.bestStreak || 0) >= 5 },
	{ id: "twenty_five_wins", emoji: "🏅", name: "Serial Winner", test: (profile) => (profile.wins || 0) >= 25 },
	{ id: "master", emoji: "👑", name: "Arena Master", test: (profile) => (profile.points || 0) >= 700 },
	{ id: "legend", emoji: "🏆", name: "Living Legend", test: (profile) => (profile.points || 0) >= 1500 },
]);

export const getGameAchievements = (profile = {}) =>
	GAME_ACHIEVEMENTS.filter((achievement) => achievement.test(profile)).map(({ test, ...achievement }) => achievement);

export const getNextGameAchievement = (profile = {}) => {
	const earned = new Set(getGameAchievements(profile).map((achievement) => achievement.id));
	return GAME_ACHIEVEMENTS.find((achievement) => !earned.has(achievement.id)) || null;
};
