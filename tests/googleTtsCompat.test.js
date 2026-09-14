import test from "node:test";
import assert from "node:assert/strict";
import * as installedGoogleTTS from "google-tts-api";
import {
	getGoogleTtsCapabilities,
	resolveGoogleTtsMethod,
	splitGoogleTtsText,
} from "../utils/googleTtsCompat.js";

test("Google TTS compatibility resolves named and default exports", () => {
	const named = { getAudioUrl: () => "named" };
	const nested = { default: { getAudioUrl: () => "default" } };
	assert.equal(resolveGoogleTtsMethod(named, "getAudioUrl")(), "named");
	assert.equal(resolveGoogleTtsMethod(nested, "getAudioUrl")(), "default");
	assert.equal(resolveGoogleTtsMethod({}, "getAudioUrl"), null);
});

test("installed google-tts-api exposes at least one supported audio path", () => {
	const capabilities = getGoogleTtsCapabilities(installedGoogleTTS);
	assert.ok(
		Object.values(capabilities).some(Boolean),
		`Unsupported google-tts-api exports: ${JSON.stringify(capabilities)}`,
	);
});

test("Google TTS text splitting keeps every request within provider limits", () => {
	const text = "Alpha should explain DNS clearly. ".repeat(40).trim();
	const chunks = splitGoogleTtsText(text, 180);
	assert.ok(chunks.length > 1);
	assert.ok(chunks.every((chunk) => chunk.length > 0 && chunk.length <= 180));
	assert.equal(chunks.join(" ").replace(/\s+/g, " "), text.replace(/\s+/g, " "));
});
