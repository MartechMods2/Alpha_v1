import assert from "node:assert/strict";
import test from "node:test";

import {
	getBotIdentityJids,
	isGroupOwner,
	isJidGroupAdmin,
	isSameGroupUser,
} from "../utils/groupParticipants.js";

const metadata = {
	owner: "900000000000001@lid",
	participants: [
		{
			id: "900000000000001@lid",
			jid: "2348000000001@s.whatsapp.net",
			admin: "superadmin",
		},
		{
			id: "900000000000002@lid",
			jid: "2348000000002@s.whatsapp.net",
			admin: "admin",
		},
		{
			id: "900000000000003@lid",
			jid: "2348000000003@s.whatsapp.net",
			admin: null,
		},
	],
};

test("matches a PN socket identity to an admin LID participant", async () => {
	const sock = {
		user: { id: "2348000000002:7@s.whatsapp.net" },
		signalRepository: {
			lidMapping: {
				getLIDForPN: async () => "900000000000002@lid",
				getPNForLID: async () => null,
			},
		},
	};

	const botJids = await getBotIdentityJids(sock, metadata, []);
	assert.equal(isJidGroupAdmin(metadata, botJids), true);
	assert.equal(isSameGroupUser(metadata, "900000000000002@lid", botJids), true);
});

test("matches a direct LID socket identity without a PN mapping", async () => {
	const sock = { user: { id: "900000000000002:4@lid" } };
	const botJids = await getBotIdentityJids(sock, metadata, []);
	assert.equal(isJidGroupAdmin(metadata, botJids), true);
});

test("does not mark a normal participant as admin", () => {
	assert.equal(isJidGroupAdmin(metadata, "900000000000003@lid"), false);
	assert.equal(isJidGroupAdmin(metadata, "2348000000003@s.whatsapp.net"), false);
});

test("recognizes the group owner through either PN or LID alias", () => {
	assert.equal(isGroupOwner(metadata, "900000000000001@lid"), true);
	assert.equal(isGroupOwner(metadata, "2348000000001@s.whatsapp.net"), true);
	assert.equal(isGroupOwner(metadata, "2348000000003@s.whatsapp.net"), false);
});
