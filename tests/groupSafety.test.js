import test from "node:test";
import assert from "node:assert/strict";
import {
	extractLinkHosts,
	findMutedMember,
	getGroupSafetySettings,
	hasDisallowedLink,
	isGroupStatusMentionMessage,
	parseMuteDuration,
	renderTemplate,
} from "../utils/groupSafety.js";
import { clearSpamTracker, detectSpam } from "../utils/spamTracker.js";

test("safety settings are off by default and numeric values are bounded", () => {
	const settings = getGroupSafetySettings({
		spamLimit: 99,
		spamWindowSeconds: 1,
		duplicateLimit: 20,
		warningLimit: 50,
	});
	assert.equal(settings.isAntiLinkOn, false);
	assert.equal(settings.isAntiSpamOn, false);
	assert.equal(settings.isAntiStatusMentionOn, false);
	assert.equal(settings.spamLimit, 12);
	assert.equal(settings.spamWindowSeconds, 5);
	assert.equal(settings.duplicateLimit, 5);
	assert.equal(settings.warningLimit, 10);
	assert.equal(getGroupSafetySettings(null).isAntiSpamOn, false);
});

test("mute durations are bounded and permanent mutes remain supported", () => {
	assert.equal(parseMuteDuration("30m").milliseconds, 30 * 60_000);
	assert.equal(parseMuteDuration("2h").milliseconds, 2 * 3_600_000);
	assert.equal(parseMuteDuration("forever").milliseconds, null);
	assert.equal(parseMuteDuration("31d").valid, false);
	assert.equal(parseMuteDuration("tomorrow").valid, false);
});

test("muted-member matching supports active, expired and aliased identities", () => {
	const matches = (left, right) => left.split("@")[0] === right.split("@")[0];
	const active = findMutedMember({ mutedMembers: [{ member: "123@lid", mutedUntil: new Date(20_000) }] }, "123@s.whatsapp.net", matches, 10_000);
	assert.equal(active.entry.member, "123@lid");
	const expired = findMutedMember({ mutedMembers: [{ member: "123@lid", mutedUntil: new Date(5_000) }] }, "123@s.whatsapp.net", matches, 10_000);
	assert.equal(expired.entry, null);
	assert.deepEqual(expired.expiredMembers, ["123@lid"]);
});

test("group status mentions are recognized through Baileys wrappers", () => {
	assert.equal(isGroupStatusMentionMessage({ message: { groupStatusMentionMessage: { message: {} } } }), true);
	assert.equal(isGroupStatusMentionMessage({ message: { ephemeralMessage: { message: { groupStatusMentionMessage: { message: {} } } } } }), true);
	assert.equal(isGroupStatusMentionMessage({ message: { conversation: "hello" } }), false);
});

test("legacy welcome text remains enabled unless explicitly disabled", () => {
	assert.equal(getGroupSafetySettings({ welcome: "Hello" }).isWelcomeOn, true);
	assert.equal(
		getGroupSafetySettings({ welcome: "Hello", isWelcomeOn: false }).isWelcomeOn,
		false,
	);
});

test("link detection honors exact domains and their subdomains", () => {
	assert.deepEqual(extractLinkHosts("See https://news.example.com/a and wa.me/123"), [
		"news.example.com",
		"wa.me",
	]);
	assert.equal(hasDisallowedLink("https://news.example.com/a", ["example.com"]), false);
	assert.equal(hasDisallowedLink("https://evil-example.com", ["example.com"]), true);
	assert.equal(hasDisallowedLink("ordinary group conversation", []), false);
});

test("join/leave templates replace every supported placeholder", () => {
	assert.equal(
		renderTemplate("Hi {user} in {group}; users={users}; count={count}", {
			users: "@1, @2",
			group: "Alpha",
			count: 20,
		}),
		"Hi @1, @2 in Alpha; users=@1, @2; count=20",
	);
});

test("spam tracker detects duplicate messages and applies a cooldown", () => {
	clearSpamTracker();
	const settings = { spamWindowSeconds: 10, spamLimit: 6, duplicateLimit: 3 };
	assert.equal(detectSpam({ key: "g:u", body: "hello", settings, now: 0 }), null);
	assert.equal(detectSpam({ key: "g:u", body: " hello ", settings, now: 1000 }), null);
	assert.equal(
		detectSpam({ key: "g:u", body: "HELLO", settings, now: 2000 }),
		"Repeated-message spam",
	);
	assert.equal(detectSpam({ key: "g:u", body: "hello", settings, now: 3000 }), null);
});

test("spam tracker detects a flood inside the configured window", () => {
	clearSpamTracker();
	const settings = { spamWindowSeconds: 5, spamLimit: 4, duplicateLimit: 3 };
	assert.equal(detectSpam({ key: "g:u", body: "one", settings, now: 0 }), null);
	assert.equal(detectSpam({ key: "g:u", body: "two", settings, now: 1000 }), null);
	assert.equal(detectSpam({ key: "g:u", body: "three", settings, now: 2000 }), null);
	assert.equal(
		detectSpam({ key: "g:u", body: "four", settings, now: 3000 }),
		"Message flood detected",
	);
});
