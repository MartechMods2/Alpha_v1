import assert from "node:assert/strict";
import test from "node:test";
import { daysBetweenDateKeys, localClock } from "../utils/groupAutomationHelpers.js";

test("group automation clock respects the configured timezone", () => {
	const clock = localClock(new Date("2026-08-27T07:15:00Z"), "Africa/Lagos");
	assert.deepEqual(clock, { dateKey: "2026-08-27", time: "08:15", day: 27, month: 8 });
});

test("event milestone day differences are stable", () => {
	assert.equal(daysBetweenDateKeys("2026-08-27", "2026-09-26"), 30);
	assert.equal(daysBetweenDateKeys("2026-08-27", "2026-09-03"), 7);
	assert.equal(daysBetweenDateKeys("2026-08-27", "2026-08-27"), 0);
	assert.ok(Number.isNaN(daysBetweenDateKeys("invalid", "2026-08-27")));
});
