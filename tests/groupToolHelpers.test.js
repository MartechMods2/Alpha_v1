import assert from "node:assert/strict";
import test from "node:test";
import {
	cleanGroupToolText,
	daysUntilBirthday,
	parseBirthday,
	parseCountdownDate,
} from "../utils/groupToolHelpers.js";

test("birthday parser accepts valid day-month input and rejects impossible dates", () => {
	assert.deepEqual(parseBirthday("29-02"), { day: 29, month: 2 });
	assert.deepEqual(parseBirthday("7/11"), { day: 7, month: 11 });
	assert.equal(parseBirthday("31-02"), null);
	assert.equal(parseBirthday("2026-08-24"), null);
});

test("birthday countdown rolls into the next year", () => {
	assert.equal(daysUntilBirthday({ day: 24, month: 8 }, new Date("2026-08-24T10:00:00Z")), 0);
	assert.equal(daysUntilBirthday({ day: 25, month: 8 }, new Date("2026-08-24T10:00:00Z")), 1);
	assert.equal(daysUntilBirthday({ day: 23, month: 8 }, new Date("2026-08-24T10:00:00Z")), 364);
});

test("countdown dates and shared text are validated", () => {
	assert.equal(parseCountdownDate("2027-01-15")?.toISOString().slice(0, 10), "2027-01-15");
	assert.equal(parseCountdownDate("2027-02-30"), null);
	assert.equal(cleanGroupToolText("  hello\n world  ", 20), "hello world");
});
