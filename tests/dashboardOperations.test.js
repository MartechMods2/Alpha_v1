import test from "node:test";
import assert from "node:assert/strict";
import { DASHBOARD_OPERATIONS, OPERATION_CATEGORIES, operationCount } from "../dashboard/src/lib/operations.js";

test("premium dashboard exposes more than 20 distinct indexed functions", () => {
	assert.ok(operationCount >= 30);
	assert.equal(operationCount, DASHBOARD_OPERATIONS.length);
	assert.equal(new Set(DASHBOARD_OPERATIONS.map((item) => item.id)).size, DASHBOARD_OPERATIONS.length);
});

test("every dashboard operation is actionable and categorized", () => {
	for (const item of DASHBOARD_OPERATIONS) {
		assert.ok(item.label?.length > 2, `${item.id} needs a label`);
		assert.ok(item.description?.length > 10, `${item.id} needs a useful description`);
		assert.ok(OPERATION_CATEGORIES.includes(item.category), `${item.id} has an unknown category`);
		assert.ok(Boolean(item.to) !== Boolean(item.command), `${item.id} must have exactly one action target`);
	}
});

test("important group-management shortcuts are indexed", () => {
	const commands = new Set(DASHBOARD_OPERATIONS.map((item) => item.command).filter(Boolean));
	for (const expected of ["$automationpack on", "$grouppulse", "$count zero", "$countinactive 60d", "$kickcount", "$mutecount", "$danger"]) {
		assert.ok(commands.has(expected), `${expected} should be available from the premium dashboard`);
	}
});
