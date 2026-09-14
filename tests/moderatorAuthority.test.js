import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test, { after } from "node:test";

import {
	getModeratorTargetProtection,
	isConfiguredModerator,
	isModeratorProtectedTarget,
	isModeratorRootProtectedTarget,
} from "../utils/moderatorProtection.js";

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
	assert.equal(isModeratorRootProtectedTarget(metadata, "2348000000001@s.whatsapp.net", botJids), false);
	assert.equal(isModeratorRootProtectedTarget(metadata, "900000000000002@lid", botJids), false);
	assert.equal(isModeratorProtectedTarget(metadata, "900000000000002@lid", botJids), true);
	assert.equal(isModeratorProtectedTarget(metadata, "2348000000003@s.whatsapp.net", botJids), false);
});

test("configured moderator identity matches across PN and LID aliases", () => {
	assert.equal(isConfiguredModerator(metadata, "2348000000002@s.whatsapp.net"), true);
	assert.equal(isConfiguredModerator(metadata, "900000000000002@lid"), true);
	assert.equal(isConfiguredModerator(metadata, "2348000000003@s.whatsapp.net"), false);
});

test("moderator protection reads runtime configuration instead of stale module constants", () => {
	process.env.MODERATORS = "2348000000003";
	assert.equal(isConfiguredModerator(metadata, "900000000000003@lid"), true);
	assert.equal(isConfiguredModerator(metadata, "900000000000002@lid"), false);
	process.env.MODERATORS = "2348000000002";
});

test("mute enforcement uses root-only protection before the ordinary admin exemption", async () => {
	const authoritySource = await readFile(new URL("../utils/moderatorAuthority.js", import.meta.url), "utf8");
	const automodSource = await readFile(new URL("../utils/automod.js", import.meta.url), "utf8");

	assert.match(
		authoritySource,
		/isModeratorRootProtectedTarget\(groupMetadata, memberJid, botJids\)/,
	);
	assert.doesNotMatch(
		authoritySource,
		/if\s*\(isModeratorProtectedTarget\(groupMetadata, memberJid, botJids\)\)/,
	);

	const moderatorMuteIndex = automodSource.indexOf("const moderatorMute = await enforceModeratorMute");
	const adminExemptionIndex = automodSource.indexOf("if (isGroupAdmin) return { handled: false };");
	assert.ok(moderatorMuteIndex >= 0, "Moderator mute enforcement must be present");
	assert.ok(adminExemptionIndex > moderatorMuteIndex, "Moderator mute must run before the ordinary admin exemption");
});
