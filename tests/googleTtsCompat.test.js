import test from "node:test";
import assert from "node:assert/strict";
import * as installedGoogleTTS from "google-tts-api";
import {
	getGoogleTtsCapabilities,
	resolveGoogleTtsMethod,
	resolveLegacyGoogleTtsFunction,
	splitGoogleTtsText,
} from "../utils/googleTtsCompat.js";

test("Google TTS compatibility resolves named and default method exports", () => {
	const named = { getAudioUrl: () => "named" };
	const nested = { default: { getAudioUrl: () => "default" } };
	assert.equal(resolveGoogleTtsMethod(named, "getAudioUrl")(), "named");
	assert.equal(resolveGoogleTtsMethod(nested, "getAudioUrl")(), "default");
	assert.equal(resolveGoogleTtsMethod({}, "getAudioUrl"), null);
});

test("Google TTS compatibility resolves legacy callable exports", async () => {
	const direct = async () => "direct-url";
	const nested = { default: async () => "default-url" };
	assert.equal(await resolveLegacyGoogleTtsFunction(direct)("hello", "en", 1), "direct-url");
	assert.equal(await resolveLegacyGoogleTtsFunction(nested)("hello", "en", 1), "default-url");
	assert.equal(resolveLegacyGoogleTtsFunction({}), null);
});

test("installed google-tts-api exposes at least one supported audio path", () => {
	const capabilities = getGoogleTtsCapabilities(installedGoogleTTS);
	assert.ok(
		Object.values(capabilities).some(Boolean),
		`Unsupported google-tts-api exports: ${JSON.stringify(capabilities)}`,
	);
	assert.equal(
		typeof resolveLegacyGoogleTtsFunction(installedGoogleTTS),
		"function",
		"google-tts-api@0.0.6 should be recognized as the legacy callable API",
	);
});

test("Google TTS text splitting keeps every request within provider limits", () => {
	const text = "Alpha should explain DNS clearly. ".repeat(40).trim();
	const chunks = splitGoogleTtsText(text, 180);
	assert.ok(chunks.length > 1);
	assert.ok(chunks.every((chunk) => chunk.length > 0 && chunk.length <= 180));
	assert.equal(chunks.join(" ").replace(/\s+/g, " "), text.replace(/\s+/g, " "));
});
