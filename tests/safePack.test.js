import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import test from "node:test";
import { ACTION_COMMANDS, createActionStickerImage, getHumanActionAssetPath } from "../utils/actionStudio.js";
import { SAFE_PACK_COMMANDS, cleanSafeText, isWithinQuietHours, nextClockDate, parseClockWindow, parseSafeDuration, redactPii } from "../utils/safePack.js";
import { verifyWebhookSignature } from "../utils/signedWebhooks.js";
import { createHmac } from "node:crypto";
import { claimDeletionBudget } from "../utils/moderationCircuit.js";

test("safe pack command catalog is large and internally collision-free", () => {
	assert.ok(SAFE_PACK_COMMANDS.length >= 90);
	assert.equal(new Set(SAFE_PACK_COMMANDS).size, SAFE_PACK_COMMANDS.length);
	for (const command of ["antiraid", "schedulepost", "ocr", "ttt", "wallet", "backup", "privacydata", "safepackhelp"]) {
		assert.ok(SAFE_PACK_COMMANDS.includes(command));
	}
});

test("safe duration, text and clock helpers enforce bounds", () => {
	assert.equal(parseSafeDuration("30s"), 30_000);
	assert.equal(parseSafeDuration("31d"), null);
	assert.equal(parseSafeDuration("5 minutes"), null);
	assert.deepEqual(parseClockWindow("22:00-07:00"), { start: "22:00", end: "07:00" });
	assert.equal(parseClockWindow("25:00-07:00"), null);
	assert.equal(cleanSafeText(" hello\n world ", 20), "hello world");
});

test("quiet-hour evaluation handles windows that cross midnight", () => {
	const window = { start: "22:00", end: "07:00" };
	assert.equal(isWithinQuietHours(window, new Date("2026-08-28T22:30:00Z"), "UTC"), true);
	assert.equal(isWithinQuietHours(window, new Date("2026-08-28T12:00:00Z"), "UTC"), false);
});

test("scheduled clock conversion honors the configured timezone", () => {
	const now = new Date("2026-08-28T18:30:00Z");
	assert.equal(nextClockDate("20:00", "Africa/Lagos", now).toISOString(), "2026-08-28T19:00:00.000Z");
	assert.equal(nextClockDate("18:00", "Africa/Lagos", now).toISOString(), "2026-08-29T17:00:00.000Z");
});

test("PII redaction removes common Nigerian phone numbers and email addresses", () => {
	const result = redactPii("Email ada@example.com or call +2348012345678");
	assert.equal(result.includes("ada@example.com"), false);
	assert.equal(result.includes("+2348012345678"), false);
	assert.match(result, /\[email\].*\[phone\]/);
});

test("signed webhook verification rejects tampering and stale requests", () => {
	const secret = "test-secret-that-is-long-enough";
	const timestamp = String(Date.now());
	const body = JSON.stringify({ event: "bot.health", data: { ok: true } });
	const signature = `sha256=${createHmac("sha256", secret).update(`${timestamp}.${body}`).digest("hex")}`;
	assert.equal(verifyWebhookSignature({ body, timestamp, signature, secret }), true);
	assert.equal(verifyWebhookSignature({ body: `${body}x`, timestamp, signature, secret }), false);
	assert.equal(verifyWebhookSignature({ body, timestamp: String(Date.now() - 600_000), signature, secret }), false);
});

test("every action has a bundled human asset and the renderer produces PNG", async () => {
	for (const command of ACTION_COMMANDS) assert.ok(existsSync(getHumanActionAssetPath(command)), `${command} human artwork should exist`);
	const image = await createActionStickerImage({ action: "slap", actorName: "Ada", targetName: "Tunde", style: "human" });
	assert.ok(image.length > 1_000);
	assert.equal(image.subarray(1, 4).toString(), "PNG");
});

test("moderation deletion circuit stops a burst after ten group operations", () => {
	const group = "circuit-test@g.us";
	for (let index = 0; index < 10; index += 1) assert.equal(claimDeletionBudget(group), true);
	assert.equal(claimDeletionBudget(group), false);
});
