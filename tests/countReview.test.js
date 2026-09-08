import assert from "node:assert/strict";
import test from "node:test";
import {
	clearCountReview,
	getCountReview,
	saveCountReview,
} from "../utils/countReview.js";

test("count review saves the exact member aliases for one group and sender", () => {
	const groupJid = "123@g.us";
	const senderJid = "111@s.whatsapp.net";
	clearCountReview({ groupJid, senderJid });

	const saved = saveCountReview({
		groupJid,
		senderJid,
		label: "count zero",
		members: [
			{ id: "222@s.whatsapp.net", aliases: ["222@s.whatsapp.net", "aaa@lid"] },
			{ id: "333@s.whatsapp.net", aliases: ["bbb@lid"] },
		],
	});

	assert.equal(saved.label, "count zero");
	assert.equal(saved.memberCount, 2);
	assert.deepEqual(new Set(saved.memberAliases), new Set([
		"222@s.whatsapp.net",
		"aaa@lid",
		"333@s.whatsapp.net",
		"bbb@lid",
	]));
	assert.deepEqual(getCountReview({ groupJid, senderJid }), saved);
});

test("count reviews are isolated by group and admin sender", () => {
	const first = saveCountReview({
		groupJid: "group-one@g.us",
		senderJid: "111@s.whatsapp.net",
		label: "count inactive",
		members: [{ id: "222@s.whatsapp.net" }],
	});
	const second = saveCountReview({
		groupJid: "group-two@g.us",
		senderJid: "111@s.whatsapp.net",
		label: "count member min 20",
		members: [{ id: "333@s.whatsapp.net" }],
	});

	assert.equal(getCountReview({ groupJid: "group-one@g.us", senderJid: "111@s.whatsapp.net" }).label, first.label);
	assert.equal(getCountReview({ groupJid: "group-two@g.us", senderJid: "111@s.whatsapp.net" }).label, second.label);
	assert.equal(getCountReview({ groupJid: "group-one@g.us", senderJid: "999@s.whatsapp.net" }), null);
});

test("saving an empty count result still replaces the previous review safely", () => {
	const groupJid = "empty@g.us";
	const senderJid = "111@s.whatsapp.net";
	saveCountReview({
		groupJid,
		senderJid,
		label: "count",
		members: [{ id: "222@s.whatsapp.net" }],
	});
	const empty = saveCountReview({
		groupJid,
		senderJid,
		label: "count zero",
		members: [],
	});

	assert.equal(empty.memberCount, 0);
	assert.deepEqual(empty.memberAliases, []);
	assert.equal(getCountReview({ groupJid, senderJid }).label, "count zero");
});
