import assert from "node:assert/strict";
import test from "node:test";
import {
	createGameRound,
	gameCategories,
	isCorrectGameAnswer,
	normalizeGameAnswer,
} from "../utils/gameEngine.js";

test("game answers ignore case, punctuation and repeated spaces", () => {
	assert.equal(normalizeGameAnswer("  The   NILE!! "), "the nile");
	assert.equal(isCorrectGameAnswer("CENTRAL processing unit!", ["central processing unit"]), true);
	assert.equal(isCorrectGameAnswer("processor", ["central processing unit"]), false);
});

test("every scored round has a prompt, answer and bounded points", () => {
	for (const game of ["trivia", "mathgame", "scramble", "emojiguess", "riddle", "fasttype"]) {
		const round = createGameRound(game, "science", () => 0.25);
		assert.equal(round.game, game);
		assert.ok(round.prompt.length > 0);
		assert.ok(round.answers.length > 0);
		assert.ok(round.points >= 1 && round.points <= 20);
	}
});

test("unknown trivia categories fall back safely", () => {
	assert.deepEqual(gameCategories, ["general", "science", "tech", "africa"]);
	assert.equal(createGameRound("trivia", "not-a-category", () => 0).category, "general");
});

test("unknown game type is rejected", () => {
	assert.throws(() => createGameRound("roulette"), /Unknown game type/);
});
