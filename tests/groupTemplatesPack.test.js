import test from "node:test";
import assert from "node:assert/strict";
import { GROUP_TEMPLATE_KEYS, GROUP_TEMPLATES, groupTemplatePlaceholders, renderGroupTemplate } from "../utils/groupTemplates.js";
import { buildAutomationPackUpdates, RECOMMENDED_GROUP_AUTOMATION_FIELDS, RECOMMENDED_SCHEDULED_AUTOMATION_FIELDS } from "../utils/automationPack.js";

test("built-in group template pack contains every required community template", () => {
	const required = ["welcome", "birthday", "goodbye", "warning", "final-warning", "anti-link", "anti-link-action", "anti-status", "anti-status-final", "anti-spam", "muted", "unmuted", "removed", "inactivity", "inactivity-cleanup", "group-locked", "group-reopened", "announcement", "morning", "night", "game", "game-result", "event", "poll", "game-join", "count-report", "kick-count-confirmation", "mute-count-confirmation", "security-alert", "member-cleared"];
	for (const key of required) { assert.ok(GROUP_TEMPLATE_KEYS.includes(key), `${key} should be registered`); assert.ok(GROUP_TEMPLATES[key]?.length > 80, `${key} should be detailed`); }
	assert.equal(new Set(GROUP_TEMPLATE_KEYS).size, GROUP_TEMPLATE_KEYS.length);
});

test("template rendering replaces provided placeholders without changing the stored default", () => {
	const original = GROUP_TEMPLATES.warning;
	const rendered = renderGroupTemplate("warning", { user: "@Ada", group: "Alpha Test", reason: "Spam", warning: 2, max: 3, meter: "🔴🔴⚪", action: "Please slow down." });
	assert.match(rendered, /@Ada/); assert.match(rendered, /Alpha Test/); assert.match(rendered, /2\/3/); assert.doesNotMatch(rendered, /\{user\}|\{warning\}|\{max\}/); assert.equal(GROUP_TEMPLATES.warning, original);
});

test("template placeholder discovery is deterministic", () => { assert.deepEqual(groupTemplatePlaceholders("anti-link"), ["user", "group", "warning", "max", "action"]); });

test("recommended automation pack enables and disables only the intended safe defaults", () => {
	const on = buildAutomationPackUpdates(true); const off = buildAutomationPackUpdates(false);
	assert.deepEqual(Object.keys(on.groupUpdate), [...RECOMMENDED_GROUP_AUTOMATION_FIELDS]); assert.deepEqual(Object.keys(on.scheduledUpdate), [...RECOMMENDED_SCHEDULED_AUTOMATION_FIELDS]);
	assert.ok(Object.values(on.groupUpdate).every(Boolean)); assert.ok(Object.values(on.scheduledUpdate).every(Boolean)); assert.ok(Object.values(off.groupUpdate).every((value) => value === false)); assert.ok(Object.values(off.scheduledUpdate).every((value) => value === false)); assert.equal("actionDailyEnabled" in on.scheduledUpdate, false);
});
