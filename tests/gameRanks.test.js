import assert from "node:assert/strict";
import test from "node:test";
import { formatGameRank, getGameRank } from "../utils/gameRanks.js";

test("game rank boundaries are stable", () => {
	assert.equal(getGameRank(0).name, "Rookie");
	assert.equal(getGameRank(49).name, "Rookie");
	assert.equal(getGameRank(50).name, "Explorer");
	assert.equal(getGameRank(700).name, "Master");
	assert.equal(getGameRank(1500).name, "Legend");
});

test("rank progress never becomes negative", () => {
	assert.equal(getGameRank(-100).pointsToNext, 50);
	assert.equal(getGameRank(1499).pointsToNext, 1);
	assert.equal(getGameRank(9999).pointsToNext, 0);
	assert.match(formatGameRank(350), /Expert/);
});
