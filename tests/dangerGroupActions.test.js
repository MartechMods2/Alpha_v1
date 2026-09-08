import assert from "node:assert/strict";
import test from "node:test";
import {
	candidateAliasSet,
	chunkDangerTargets,
	keepPreviewedCandidates,
	parseDayToken,
	selectInactiveCandidates,
	selectKickAllCandidates,
	unknownActivityMembers,
} from "../utils/dangerGroupActions.js";

test("day token parser accepts explicit day durations only", () => {
	assert.equal(parseDayToken("120d"), 120);
	assert.equal(parseDayToken("1D"), 1);
	assert.equal(parseDayToken("0d"), null);
	assert.equal(parseDayToken("120"), null);
	assert.equal(parseDayToken("7h"), null);
});

test("inactive cleanup only selects provably stale non-admin members", () => {
	const now = Date.UTC(2026, 8, 8, 12, 0, 0);
	const members = [
		{ id: "old@s.whatsapp.net", lastMessageAt: "2026-04-01T00:00:00Z", isAdmin: false },
		{ id: "recent@s.whatsapp.net", lastMessageAt: "2026-08-20T00:00:00Z", isAdmin: false },
		{ id: "unknown@s.whatsapp.net", lastMessageAt: null, isAdmin: false },
		{ id: "admin@s.whatsapp.net", lastMessageAt: "2025-01-01T00:00:00Z", isAdmin: true },
	];

	const selected = selectInactiveCandidates(members, 120, now);
	assert.deepEqual(selected.map((member) => member.id), ["old@s.whatsapp.net"]);
	assert.deepEqual(unknownActivityMembers(members).map((member) => member.id), ["unknown@s.whatsapp.net"]);
});

test("kick-all candidates exclude current admins", () => {
	const selected = selectKickAllCandidates([
		{ id: "member1@s.whatsapp.net", isAdmin: false },
		{ id: "admin@s.whatsapp.net", isAdmin: true },
		{ id: "member2@s.whatsapp.net" },
	]);
	assert.deepEqual(selected.map((member) => member.id), ["member1@s.whatsapp.net", "member2@s.whatsapp.net"]);
});

test("confirmation revalidation keeps only members shown in the preview across PN/LID aliases", () => {
	const preview = [{ id: "111@s.whatsapp.net", aliases: ["111@s.whatsapp.net", "aaa@lid"] }];
	const allowed = candidateAliasSet(preview);
	const current = [
		{ id: "aaa@lid", aliases: ["aaa@lid", "111@s.whatsapp.net"] },
		{ id: "222@s.whatsapp.net", aliases: ["222@s.whatsapp.net"] },
	];
	const kept = keepPreviewedCandidates(current, allowed);
	assert.equal(kept.length, 1);
	assert.equal(kept[0].id, "aaa@lid");
});

test("danger targets are split into controlled batches", () => {
	const rows = Array.from({ length: 18 }, (_, index) => ({ id: String(index + 1) }));
	const batches = chunkDangerTargets(rows, 8);
	assert.deepEqual(batches.map((batch) => batch.length), [8, 8, 2]);
});
