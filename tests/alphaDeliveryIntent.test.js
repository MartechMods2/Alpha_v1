import test from "node:test";
import assert from "node:assert/strict";
import { alphaDeliveryDefaults, detectAlphaDeliveryIntent } from "../utils/alphaDeliveryIntent.js";

test("Alpha defaults to text when no delivery format is requested", () => {
	const result = detectAlphaDeliveryIntent("tell me how to create a website");
	assert.equal(result.mode, "text");
	assert.equal(result.explicit, false);
	assert.equal(alphaDeliveryDefaults().defaultMode, "text");
});

test("the exact @Alpha screenshot-style request routes directly to voice", () => {
	const result = detectAlphaDeliveryIntent("@Alpha tell me how to create a website using voice");
	assert.equal(result.mode, "voice");
	assert.equal(result.action, "speak");
	assert.equal(result.explicit, true);
	assert.match(result.prompt, /create a website/i);
	assert.doesNotMatch(result.prompt, /@alpha/i);
});

test("audio wording is treated as a voice-note delivery request", () => {
	for (const prompt of [
		"@Alpha explain DNS as audio",
		"@Alpha answer with an audio message",
		"@Alpha send me a voice message explaining DNS",
		"@Alpha explain DNS using a voice note",
	]) {
		const result = detectAlphaDeliveryIntent(prompt);
		assert.equal(result.mode, "voice", prompt);
		assert.equal(result.explicit, true, prompt);
	}
});

test("image generation wording explicitly routes to generated image", () => {
	const result = detectAlphaDeliveryIntent("@Alpha generate an image of a boy running in Lagos");
	assert.equal(result.mode, "image");
	assert.equal(result.action, "generate");
	assert.match(result.prompt, /boy running in Lagos/i);
});

test("ordinary show/send image wording generates with AI", () => {
	for (const prompt of [
		"@Alpha show me an image of a Nigerian classroom",
		"@Alpha send me a picture of a boy running",
		"@Alpha give me a photo of Lagos at night",
	]) {
		const result = detectAlphaDeliveryIntent(prompt);
		assert.equal(result.mode, "image", prompt);
		assert.equal(result.action, "generate", prompt);
	}
});

test("clearly search-oriented image wording still uses media search", () => {
	for (const prompt of [
		"@Alpha find me a real photo of Lagos",
		"@Alpha search for a stock image of a classroom",
	]) {
		const result = detectAlphaDeliveryIntent(prompt);
		assert.equal(result.mode, "image", prompt);
		assert.equal(result.action, "search", prompt);
	}
});

test("video wording explicitly routes to video search", () => {
	const result = detectAlphaDeliveryIntent("explain web design using a video");
	assert.equal(result.mode, "video");
	assert.equal(result.action, "search");
});

test("plural video wording also routes to video search", () => {
	const result = detectAlphaDeliveryIntent("teach me web design using videos");
	assert.equal(result.mode, "video");
	assert.equal(result.action, "search");
});

test("explicit text request remains text", () => {
	const result = detectAlphaDeliveryIntent("reply in text and explain DNS");
	assert.equal(result.mode, "text");
	assert.equal(result.explicit, true);
});

test("the last explicit delivery instruction wins", () => {
	const result = detectAlphaDeliveryIntent("make an image of DNS, then explain it using voice");
	assert.equal(result.mode, "voice");
});
