import assert from "node:assert/strict";
import test from "node:test";

import {
	cleanAiPollJson,
	getQuizPollAnswer,
	inferTwoChoicePoll,
	normalizeNativePoll,
	parsePipePoll,
	parseWouldYouRatherPoll,
	rememberQuizPoll,
	shouldUseAiPoll,
} from "../utils/alphaPolls.js";

test("native poll normalization deduplicates and bounds choices", () => {
	const poll = normalizeNativePoll({
		name: "Where should we go?",
		values: ["Beach", "Cinema", "Beach", "Arcade"],
		selectableCount: 99,
	});
	assert.equal(poll.name, "Where should we go?");
	assert.deepEqual(poll.values, ["Beach", "Cinema", "Arcade"]);
	assert.equal(poll.selectableCount, 3);
});

test("manual pipe polls support single and multi-select modes", () => {
	assert.deepEqual(parsePipePoll("Best day? | Friday | Saturday"), {
		name: "Best day?",
		values: ["Friday", "Saturday"],
		selectableCount: 1,
	});
	assert.equal(parsePipePoll("Too few | only one"), null);
	assert.equal(parsePipePoll("Pick days | Friday | Saturday | Sunday", { multi: true }).selectableCount, 3);
});

test("Would You Rather prompts become two-choice native polls", () => {
	const poll = parseWouldYouRatherPoll("Would you rather explore the deep ocean or outer space?");
	assert.equal(poll.name, "🤔 Would you rather?");
	assert.deepEqual(poll.values, ["explore the deep ocean", "outer space"]);
	assert.equal(poll.selectableCount, 1);
});

test("natural two-choice inference requires an actual voting signal", () => {
	assert.equal(inferTwoChoicePoll("I like beach or cinema"), null);
	const poll = inferTwoChoicePoll("choose between beach or cinema");
	assert.ok(poll);
	assert.deepEqual(poll.values, ["beach", "cinema"]);
	assert.equal(shouldUseAiPoll("help us decide the best day for our hangout"), true);
});

test("AI poll JSON is validated and quiz answers stay bounded to a group", () => {
	const poll = cleanAiPollJson('```json\n{"question":"Capital of Nigeria?","options":["Lagos","Abuja","Kano","Ibadan"],"selectableCount":1,"correctIndex":1}\n```');
	assert.equal(poll.correctIndex, 1);
	assert.equal(poll.values[1], "Abuja");
	assert.equal(rememberQuizPoll("test-group@g.us", poll, poll.correctIndex), true);
	const stored = getQuizPollAnswer("test-group@g.us");
	assert.equal(stored.answer, "Abuja");
	assert.equal(getQuizPollAnswer("different-group@g.us"), null);
});
