import assert from "node:assert/strict";
import test from "node:test";
import { canUseAlphaMention, normalizeAlphaSettings, stripBotMention } from "../utils/alphaMention.js";

test("Alpha settings use conservative bounds and supported modes", () => {
	const settings = normalizeAlphaSettings({ alphaMode: "invalid", alphaDailyQuota: 500, alphaMemoryLimit: -8 });
	assert.equal(settings.alphaMode, "smart");
	assert.equal(settings.alphaDailyQuota, 50);
	assert.equal(settings.alphaMemoryLimit, 0);
});

test("bot mentions are removed without deleting the user's request", () => {
	assert.equal(stripBotMention("@2348000000000 summarize this please", ["2348000000000@s.whatsapp.net"]), "summarize this please");
});

test("Alpha access modes filter ordinary members while preserving admin access", () => {
	const senderJid = "member@s.whatsapp.net";
	const evaluate = (settings, overrides = {}) => canUseAlphaMention({
		settings: normalizeAlphaSettings(settings),
		senderJid,
		matches: (left, right) => left === right,
		...overrides,
	});
	assert.equal(evaluate({ alphaAccessMode: "everyone" }), true);
	assert.equal(evaluate({ alphaAccessMode: "admins" }), false);
	assert.equal(evaluate({ alphaAccessMode: "admins" }, { isAdmin: true }), true);
	assert.equal(evaluate({ alphaAccessMode: "allowlist", alphaAllowedMembers: [senderJid] }), true);
	assert.equal(evaluate({ alphaAccessMode: "allowlist", alphaAllowedMembers: [] }), false);
	assert.equal(evaluate({ alphaAccessMode: "denylist", alphaDeniedMembers: [senderJid] }), false);
	assert.equal(evaluate({ alphaAccessMode: "denylist", alphaDeniedMembers: [] }), true);
});

test("Alpha settings reject invalid clocks and normalize integer quotas", () => {
	const settings = normalizeAlphaSettings({
		alphaQuietStart: "99:99",
		alphaQuietEnd: "24:01",
		alphaDailyQuota: 9.8,
		alphaMemoryLimit: 4.9,
	});
	assert.equal(settings.alphaQuietStart, "");
	assert.equal(settings.alphaQuietEnd, "");
	assert.equal(settings.alphaDailyQuota, 9);
	assert.equal(settings.alphaMemoryLimit, 4);
});
