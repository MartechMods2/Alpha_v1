import test from "node:test";
import assert from "node:assert/strict";
import {
	faqScore, findBestFaq, formatElapsed, makeProductivityId, parseTaskInput, quotedTextFromContext,
} from "../utils/groupProductivity.js";

test("task parser supports priority and human-readable due labels", () => {
	assert.deepEqual(parseTaskInput("Finish chapter 4 | high | due Friday"), {
		title: "Finish chapter 4", priority: "high", due: "Friday",
	});
	assert.deepEqual(parseTaskInput("Call supplier"), { title: "Call supplier", priority: "normal", due: "" });
	assert.equal(parseTaskInput(""), null);
});

test("productivity ids remain short and type-prefixed", () => {
	const id = makeProductivityId("task", 1_700_000_000_000, 0.5);
	assert.match(id, /^ta[a-z0-9]{8}$/);
});

test("FAQ matching prefers close saved questions without inventing answers", () => {
	const entries = [
		{ id: "f1", question: "What time does game night start?", answer: "8pm" },
		{ id: "f2", question: "Where are the group rules?", answer: "Pinned message" },
	];
	assert.ok(faqScore("game night start time", entries[0].question) >= 0.5);
	assert.equal(findBestFaq(entries, "when does game night start")?.entry.id, "f1");
	assert.equal(findBestFaq(entries, "what is the weather in Abuja"), null);
});

test("quoted message extraction supports text and media captions", () => {
	assert.equal(quotedTextFromContext({ quotedMessage: { conversation: "save this line" } }), "save this line");
	assert.equal(quotedTextFromContext({ quotedMessage: { imageMessage: { caption: "important diagram" } } }), "important diagram");
});

test("elapsed formatter stays concise for WhatsApp notices", () => {
	assert.equal(formatElapsed(0, 30_000), "less than a minute");
	assert.equal(formatElapsed(0, 3_600_000), "1h 0m");
	assert.equal(formatElapsed(0, 90_000_000), "1d 1h");
});
