import test from "node:test";
import assert from "node:assert/strict";
import {
	AI_FEATURE_CATEGORIES,
	AI_FEATURE_COMMANDS,
	AI_FEATURE_CATALOG,
} from "../utils/alphaFeatureCatalog.js";
import { PASSIVE_OSINT_COMMANDS } from "../commands/public/passiveOsintPack.js";

test("Alpha expansion exposes at least 160 distinct AI workflow commands", () => {
	assert.equal(AI_FEATURE_COMMANDS.length, 160);
	assert.equal(new Set(AI_FEATURE_COMMANDS).size, AI_FEATURE_COMMANDS.length);
	assert.equal(Object.keys(AI_FEATURE_CATEGORIES).length, 16);
	for (const [category, commands] of Object.entries(AI_FEATURE_CATEGORIES)) {
		assert.equal(commands.length, 10, `${category} should contain ten focused tools`);
		for (const command of commands) {
			assert.ok(command.startsWith("ai"));
			assert.equal(AI_FEATURE_CATALOG[command]?.category, category);
			assert.ok(AI_FEATURE_CATALOG[command]?.instruction?.length > 20);
		}
	}
});

test("passive OSINT pack exposes exactly 20 unique passive commands", () => {
	assert.equal(PASSIVE_OSINT_COMMANDS.length, 20);
	assert.equal(new Set(PASSIVE_OSINT_COMMANDS).size, 20);
	for (const command of PASSIVE_OSINT_COMMANDS) assert.match(command, /^osint[a-z]+$/);
});

test("important flagship commands are present", () => {
	for (const command of [
		"aisummarize", "aimeetingminutes", "ailessonplan", "aieditorialreview",
		"aibusinesscase", "aiprojectplan", "aijobdescription", "aicodeexplain",
	]) assert.ok(AI_FEATURE_COMMANDS.includes(command), command);
	for (const command of ["osintdomain", "osintip", "osinttls", "osintemailsec", "osintcertnames"]) {
		assert.ok(PASSIVE_OSINT_COMMANDS.includes(command), command);
	}
});
