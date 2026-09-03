import test from "node:test";
import assert from "node:assert/strict";
import martechToolkit from "../commands/public/martechToolkit.js";
import {
	areAnagrams, convertCase, daysBetween, isPalindrome, moneyResult,
	percentageChange, splitTeams, textStats, uniqueLines,
} from "../utils/creatorToolkit.js";

test("Martech utility pack exposes at least 35 unique commands", () => {
	const command = martechToolkit();
	assert.ok(command.cmd.length >= 35);
	assert.equal(new Set(command.cmd).size, command.cmd.length);
});

test("text tools are bounded and deterministic", () => {
	assert.equal(textStats("Alpha is useful.").words, 3);
	assert.equal(convertCase("Alpha WhatsApp Bot", "snakecase"), "alpha_whatsapp_bot");
	assert.deepEqual(uniqueLines("Ada\nAda\nMusa"), ["Ada", "Musa"]);
	assert.equal(isPalindrome("Never odd or even"), true);
	assert.equal(areAnagrams("listen", "silent"), true);
});

test("date and money helpers return expected results", () => {
	assert.equal(daysBetween("2026-09-01", "2026-09-11"), 10);
	assert.equal(percentageChange(200, 250), 25);
	assert.deepEqual(moneyResult("discountcalc", [1000, 10]), { amount: 100, final: 900 });
});

test("random teams preserve every member", () => {
	const members = ["Ada", "Musa", "Tunde", "Chioma"];
	const teams = splitTeams(members, 2);
	assert.deepEqual(teams.flat().sort(), [...members].sort());
});
