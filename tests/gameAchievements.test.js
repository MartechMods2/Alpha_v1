import assert from "node:assert/strict";
import test from "node:test";
import { getGameAchievements, getNextGameAchievement } from "../utils/gameAchievements.js";

test("achievements unlock from persistent profile statistics", () => {
	const badges = getGameAchievements({
		wins: 2,
		plays: 12,
		points: 120,
		bestStreak: 3,
		gameWins: { battle: 1, daily: 1 },
	});
	assert.deepEqual(
		badges.map((badge) => badge.id),
		["first_win", "hot_streak", "ten_games", "centurion", "battle_win", "daily_win"],
	);
});

test("next achievement advances as milestones are met", () => {
	assert.equal(getNextGameAchievement({}).id, "first_win");
	assert.equal(getNextGameAchievement({ wins: 1 }).id, "hot_streak");
	assert.equal(getNextGameAchievement({ wins: 30, plays: 30, points: 2000, bestStreak: 8, gameWins: { battle: 2, daily: 2 } }), null);
});
