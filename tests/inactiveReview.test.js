import assert from "node:assert/strict";
import test from "node:test";
import {
	selectActionableInactiveMembers,
	selectUnknownInactiveHistoryMembers,
} from "../utils/inactiveReview.js";

const now = Date.now();
const daysAgo = (days) => new Date(now - days * 86_400_000).toISOString();

const metadata = {
	participants: [
		{ id: "111@s.whatsapp.net", lid: "a@lid" },
		{ id: "222@s.whatsapp.net", lid: "b@lid" },
		{ id: "333@s.whatsapp.net", lid: "c@lid", admin: "admin" },
		{ id: "444@s.whatsapp.net", lid: "d@lid" },
	],
};

test("inactive review uses proven age and excludes protected members", () => {
	const members = [
		{ id: "111@s.whatsapp.net", aliases: ["111@s.whatsapp.net", "a@lid"], lastMessageAt: daysAgo(90), isAdmin: false },
		{ id: "222@s.whatsapp.net", aliases: ["222@s.whatsapp.net", "b@lid"], lastMessageAt: daysAgo(90), isAdmin: false },
		{ id: "333@s.whatsapp.net", aliases: ["333@s.whatsapp.net", "c@lid"], lastMessageAt: daysAgo(90), isAdmin: true },
		{ id: "444@s.whatsapp.net", aliases: ["444@s.whatsapp.net", "d@lid"], lastMessageAt: daysAgo(20), isAdmin: false },
	];

	const selected = selectActionableInactiveMembers(
		members,
		60,
		metadata,
		["222@s.whatsapp.net"],
	);

	assert.deepEqual(selected.map((member) => member.id), ["111@s.whatsapp.net"]);
});

test("unknown activity history is reported separately and still respects protection", () => {
	const members = [
		{ id: "111@s.whatsapp.net", aliases: ["111@s.whatsapp.net", "a@lid"], lastMessageAt: null, isAdmin: false },
		{ id: "222@s.whatsapp.net", aliases: ["222@s.whatsapp.net", "b@lid"], lastMessageAt: null, isAdmin: false },
		{ id: "333@s.whatsapp.net", aliases: ["333@s.whatsapp.net", "c@lid"], lastMessageAt: null, isAdmin: true },
	];

	const unknown = selectUnknownInactiveHistoryMembers(
		members,
		metadata,
		["222@s.whatsapp.net"],
	);

	assert.deepEqual(unknown.map((member) => member.id), ["111@s.whatsapp.net"]);
});
