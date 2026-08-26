import assert from "node:assert/strict";
import test from "node:test";
import { normalizeAlphaSettings, stripBotMention, useAlphaQuota } from "../utils/alphaMention.js";

test("Alpha settings use conservative bounds and supported modes", () => {
	const settings = normalizeAlphaSettings({ alphaMode: "invalid", alphaDailyQuota: 500, alphaMemoryLimit: -8 });
	assert.equal(settings.alphaMode, "smart");
	assert.equal(settings.alphaDailyQuota, 50);
	assert.equal(settings.alphaMemoryLimit, 0);
});

test("bot mentions are removed without deleting the user's request", () => {
	assert.equal(stripBotMention("@2348000000000 summarize this please", ["2348000000000@s.whatsapp.net"]), "summarize this please");
});

test("Alpha per-member quota rejects excess requests", () => {
	const group = `quota-${Date.now()}@g.us`;
	assert.equal(useAlphaQuota(group, "member@s.whatsapp.net", 2), true);
	assert.equal(useAlphaQuota(group, "member@s.whatsapp.net", 2), true);
	assert.equal(useAlphaQuota(group, "member@s.whatsapp.net", 2), false);
});
