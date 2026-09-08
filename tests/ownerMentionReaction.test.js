import test from "node:test";
import assert from "node:assert/strict";
import {
	configuredOwnerJids,
	hasTypedMartechMention,
	isOwnerMention,
	ownerMentionBody,
	ownerMentionedJids,
	pickOwnerMentionReaction,
} from "../utils/ownerMentionReaction.js";

test("typed @Martech mention is detected case-insensitively", () => {
	assert.equal(hasTypedMartechMention("hello @Martech please check this"), true);
	assert.equal(hasTypedMartechMention("hello @MARTECH"), true);
	assert.equal(hasTypedMartechMention("hello Martech"), false);
});

test("owner mention helper reads body and mentioned JIDs", () => {
	const msg = { message: { extendedTextMessage: { text: "@Martech", contextInfo: { mentionedJid: ["2348012345678@s.whatsapp.net"] } } } };
	assert.equal(ownerMentionBody(msg), "@Martech");
	assert.deepEqual(ownerMentionedJids(msg), ["2348012345678@s.whatsapp.net"]);
});

test("configured owner numbers are normalized to WhatsApp PN JIDs", () => {
	assert.deepEqual(configuredOwnerJids("+234 801 234 5678, 234-809-000-1111"), ["2348012345678@s.whatsapp.net", "2348090001111@s.whatsapp.net"]);
});

test("direct PN owner mention matches without metadata", () => {
	assert.equal(isOwnerMention({ mentionedJids: ["2348012345678@s.whatsapp.net"], ownerJids: ["2348012345678@s.whatsapp.net"] }), true);
	assert.equal(isOwnerMention({ mentionedJids: ["2348099999999@s.whatsapp.net"], ownerJids: ["2348012345678@s.whatsapp.net"] }), false);
});

test("reaction is always crown or lightning and stable for a message id", () => {
	const first = pickOwnerMentionReaction("ABC123");
	const second = pickOwnerMentionReaction("ABC123");
	assert.equal(first, second);
	assert.ok(["👑", "⚡"].includes(first));
});
