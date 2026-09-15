import assert from "node:assert/strict";
import test from "node:test";

import {
	ALPHA_TEXT_STYLES,
	ALPHA_VOICE_PROFILES,
	applyAlphaTextStyle,
	getVoiceProfile,
	parseVoiceProfileArgs,
} from "../utils/alphaPresentation.js";

test("Alpha exposes practical named voice profiles", () => {
	for (const name of ["default", "man", "woman", "boy", "girl", "funny", "calm", "deep", "energetic", "storyteller", "radio", "nigerian"]) {
		assert.equal(ALPHA_VOICE_PROFILES.includes(name), true, `${name} profile should exist`);
		const profile = getVoiceProfile(name);
		assert.equal(profile.profile, name);
		assert.equal(typeof profile.voice, "string");
		assert.ok(profile.instructions.length > 15);
	}
});

test("voice profile parser supports defaults and one-off overrides", () => {
	assert.deepEqual(parseVoiceProfileArgs(["explain", "dns"], "woman"), {
		profile: "woman",
		args: ["explain", "dns"],
	});
	assert.deepEqual(parseVoiceProfileArgs(["funny", "explain", "dns"], "woman"), {
		profile: "funny",
		args: ["explain", "dns"],
	});
	assert.deepEqual(parseVoiceProfileArgs(["--voice=deep", "tell", "a", "story"], "default"), {
		profile: "deep",
		args: ["tell", "a", "story"],
	});
});

test("WhatsApp-safe text styles transform ordinary text without damaging URLs, code or mentions", () => {
	assert.ok(ALPHA_TEXT_STYLES.length >= 7);
	const input = "Hello @Martech visit https://example.com and use `npm test`";
	const styled = applyAlphaTextStyle(input, "serif");
	assert.notEqual(styled, input);
	assert.match(styled, /@Martech/);
	assert.match(styled, /https:\/\/example\.com/);
	assert.match(styled, /`npm test`/);
});

test("normal text style is an exact no-op", () => {
	const input = "Alpha keeps plain text plain.";
	assert.equal(applyAlphaTextStyle(input, "normal"), input);
});
