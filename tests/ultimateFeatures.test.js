import assert from "node:assert/strict";
import test from "node:test";
import {
	cleanFeatureText,
	convertUnit,
	createPassword,
	decodeMorse,
	encodeMorse,
	fromRoman,
	matchesTriggerPhrase,
	minuteWithinWindow,
	textToolResult,
	toRoman,
} from "../utils/featureSuite.js";
import {
	ARCADE_COMMANDS,
	COMMUNITY_COMMANDS,
	ENHANCEMENT_ADMIN_COMMANDS,
	PRODUCTIVITY_COMMANDS,
	TEXT_LAB_COMMANDS,
	ULTIMATE_FEATURE_COMMANDS,
} from "../utils/ultimateFeatureCatalog.js";

test("ultimate pack exposes more than 50 collision-free commands across five suites", () => {
	assert.ok(ULTIMATE_FEATURE_COMMANDS.length >= 60);
	assert.equal(new Set(ULTIMATE_FEATURE_COMMANDS).size, ULTIMATE_FEATURE_COMMANDS.length);
	for (const suite of [TEXT_LAB_COMMANDS, COMMUNITY_COMMANDS, PRODUCTIVITY_COMMANDS, ARCADE_COMMANDS, ENHANCEMENT_ADMIN_COMMANDS]) {
		assert.ok(suite.length >= 10);
	}
});

test("feature text cleaning and transformations are bounded and Unicode-safe", () => {
	assert.equal(cleanFeatureText("  hello\nworld  ", 30), "hello world");
	assert.equal(textToolResult("titlecase", "alpha feature PACK"), "Alpha Feature Pack");
	assert.equal(textToolResult("reverse", "A😀B"), "B😀A");
	assert.match(textToolResult("sha256", "Alpha"), /^[a-f0-9]{64}$/);
});

test("unit conversion covers compatible families and rejects incompatible units", () => {
	assert.equal(convertUnit(5, "km", "m"), 5000);
	assert.equal(convertUnit(1000, "g", "kg"), 1);
	assert.equal(convertUnit(1, "kg", "m"), null);
});

test("Roman and Morse conversions round-trip valid values", () => {
	assert.equal(toRoman(49), "XLIX");
	assert.equal(fromRoman("XLIX"), 49);
	assert.equal(fromRoman("IIII"), null);
	assert.equal(decodeMorse(encodeMorse("help")), "help");
});

test("password generation enforces safe length bounds", () => {
	assert.equal(createPassword(4).length, 8);
	assert.equal(createPassword(20).length, 20);
	assert.equal(createPassword(100).length, 64);
});

test("auto-reply matching respects full phrase boundaries", () => {
	assert.equal(matchesTriggerPhrase("Good morning, everyone!", "good morning"), true);
	assert.equal(matchesTriggerPhrase("this should not match", "hi"), false);
	assert.equal(matchesTriggerPhrase("HI!", "hi"), true);
	assert.equal(minuteWithinWindow(9 * 60, 8 * 60, 22 * 60), true);
	assert.equal(minuteWithinWindow(23 * 60, 22 * 60, 7 * 60), true);
	assert.equal(minuteWithinWindow(12 * 60, 22 * 60, 7 * 60), false);
});
