import assert from "node:assert/strict";
import test from "node:test";
import { mergeLiveGroupActivity, summarizeGroupActivity } from "../utils/groupActivity.js";

test("live activity roster includes current zero-message members and excludes the bot", () => {
	const participants = [
		{ id: "111@s.whatsapp.net", lid: "aaa@lid", admin: "admin" },
		{ id: "222@s.whatsapp.net", lid: "bbb@lid" },
		{ id: "999@s.whatsapp.net", lid: "bot@lid" },
	];
	const trackedMembers = [
		{ id: "aaa@lid", name: "Ada", count: 12, texttotal: 10, imagetotal: 2, lastMessageAt: "2026-09-08T10:00:00Z" },
	];

	const roster = mergeLiveGroupActivity({
		participants,
		trackedMembers,
		botJids: ["999@s.whatsapp.net", "bot@lid"],
	});

	assert.equal(roster.length, 2);
	assert.equal(roster[0].name, "Ada");
	assert.equal(roster[0].count, 12);
	assert.equal(roster[0].isAdmin, true);
	assert.equal(roster[1].id, "222@s.whatsapp.net");
	assert.equal(roster[1].count, 0);
	assert.equal(roster[1].hasTrackedActivity, false);
});

test("PN and LID activity rows for one current member are merged instead of duplicated", () => {
	const roster = mergeLiveGroupActivity({
		participants: [{ id: "111@s.whatsapp.net", lid: "aaa@lid" }],
		trackedMembers: [
			{ id: "111@s.whatsapp.net", name: "Ada", count: 5, texttotal: 4, imagetotal: 1, lastMessageAt: "2026-09-01T10:00:00Z" },
			{ id: "aaa@lid", name: "Ada", count: 7, texttotal: 6, imagetotal: 1, lastMessageAt: "2026-09-08T10:00:00Z" },
		],
	});

	assert.equal(roster.length, 1);
	assert.equal(roster[0].count, 12);
	assert.equal(roster[0].texttotal, 10);
	assert.equal(roster[0].imagetotal, 2);
	assert.equal(new Date(roster[0].lastMessageAt).toISOString(), "2026-09-08T10:00:00.000Z");
});

test("activity summary exposes cleanup-friendly zero and low-activity buckets", () => {
	const summary = summarizeGroupActivity([
		{ count: 120, isAdmin: true },
		{ count: 51 },
		{ count: 23 },
		{ count: 15 },
		{ count: 4 },
		{ count: 0 },
		{ count: 0 },
	], 20);

	assert.equal(summary.totalMembers, 7);
	assert.equal(summary.activeMembers, 5);
	assert.equal(summary.zeroMembers, 2);
	assert.equal(summary.belowTarget, 4);
	assert.equal(summary.admins, 1);
	assert.equal(summary.totalMessages, 213);
	assert.deepEqual(summary.buckets, {
		zero: 2,
		oneToNine: 1,
		tenToNineteen: 1,
		twentyToFortyNine: 1,
		fiftyToNinetyNine: 1,
		hundredPlus: 1,
	});
});
