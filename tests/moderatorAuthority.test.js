import assert from "node:assert/strict";
import test, { after } from "node:test";

import {
	enforceModeratorMute,
	getModeratorTargetProtection,
	isModeratorProtectedTarget,
	isModeratorRootProtectedTarget,
} from "../utils/moderatorAuthority.js";

const previousModerators = process.env.MODERATORS;
const previousOwner = process.env.MY_NUMBER;
process.env.MODERATORS = "2348000000002";
process.env.MY_NUMBER = "2348000000009";

after(() => {
	if (previousModerators === undefined) delete process.env.MODERATORS;
	else process.env.MODERATORS = previousModerators;
	if (previousOwner === undefined) delete process.env.MY_NUMBER;
	else process.env.MY_NUMBER = previousOwner;
});

const metadata = {
	owner: "900000000000001@lid",
	ownerPn: "2348000000001@s.whatsapp.net",
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
			admin: "admin",
		},
		{
			id: "900000000000009@lid",
			jid: "2348000000009@s.whatsapp.net",
			admin: "admin",
		},
		{
			id: "900000000000010@lid",
			jid: "2348000000010@s.whatsapp.net",
			admin: "admin",
		},
	],
};

const botJids = ["900000000000010@lid", "2348000000010@s.whatsapp.net"];

test("uses separate soft and destructive Moderator Override protection tiers", () => {
	const groupOwner = getModeratorTargetProtection(metadata, "2348000000001@s.whatsapp.net", botJids);
	assert.equal(groupOwner.rootProtected, false);
	assert.equal(groupOwner.destructiveProtected, true);
	assert.equal(groupOwner.reason, "group-owner");

	const moderator = getModeratorTargetProtection(metadata, "900000000000002@lid", botJids);
	assert.equal(moderator.rootProtected, false);
	assert.equal(moderator.destructiveProtected, true);
	assert.equal(moderator.reason, "moderator");

	const ordinaryAdmin = getModeratorTargetProtection(metadata, "2348000000003@s.whatsapp.net", botJids);
	assert.equal(ordinaryAdmin.rootProtected, false);
	assert.equal(ordinaryAdmin.destructiveProtected, false);
	assert.equal(ordinaryAdmin.reason, "ordinary");

	assert.equal(isModeratorRootProtectedTarget(metadata, "2348000000009@s.whatsapp.net", botJids), true);
	assert.equal(isModeratorRootProtectedTarget(metadata, "900000000000010@lid", botJids), true);
	assert.equal(isModeratorProtectedTarget(metadata, "900000000000002@lid", botJids), true);
	assert.equal(isModeratorProtectedTarget(metadata, "2348000000003@s.whatsapp.net", botJids), false);
});

test("enforces Moderator mute against another configured moderator through PN/LID aliases", async () => {
	let deleteKey = null;
	const sock = {
		sendMessage: async (_groupJid, payload) => {
			deleteKey = payload?.delete || null;
		},
	};
	const msg = { key: { id: "moderator-message-1", remoteJid: "120363000000000000@g.us" } };
	const groupData = {
		moderatorMutedMembers: [{
			member: "2348000000002@s.whatsapp.net",
			mutedUntil: new Date(Date.now() + 60_000),
		}],
	};

	const result = await enforceModeratorMute({
		sock,
		msg,
		groupJid: "120363000000000000@g.us",
		memberJid: "900000000000002@lid",
		groupData,
		groupMetadata: metadata,
		botJids,
		isBotAdmin: true,
	});

	assert.equal(result.handled, true);
	assert.equal(result.moderatorMuted, true);
	assert.deepEqual(deleteKey, msg.key);
});

test("never enforces Moderator mute against Alpha or the configured creator", async () => {
	let sendCount = 0;
	const sock = { sendMessage: async () => { sendCount += 1; } };
	const base = {
		sock,
		msg: { key: { id: "root-protected", remoteJid: "120363000000000001@g.us" } },
		groupJid: "120363000000000001@g.us",
		groupMetadata: metadata,
		botJids,
		isBotAdmin: true,
	};

	const creatorResult = await enforceModeratorMute({
		...base,
		memberJid: "900000000000009@lid",
		groupData: { moderatorMutedMembers: [{ member: "2348000000009@s.whatsapp.net" }] },
	});
	const alphaResult = await enforceModeratorMute({
		...base,
		memberJid: "2348000000010@s.whatsapp.net",
		groupData: { moderatorMutedMembers: [{ member: "900000000000010@lid" }] },
	});

	assert.equal(creatorResult.handled, false);
	assert.equal(alphaResult.handled, false);
	assert.equal(sendCount, 0);
});
