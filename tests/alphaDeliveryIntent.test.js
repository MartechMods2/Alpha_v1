import test from "node:test";
import assert from "node:assert/strict";
import { alphaDeliveryDefaults, detectAlphaDeliveryIntent } from "../utils/alphaDeliveryIntent.js";

test("Alpha defaults to text when no delivery format is requested", () => {
	const result = detectAlphaDeliveryIntent("tell me how to create a website");
	assert.equal(result.mode, "text");
	assert.equal(result.explicit, false);
	assert.equal(alphaDeliveryDefaults().defaultMode, "text");
});

test("voice wording explicitly routes to voice", () => {
	const result = detectAlphaDeliveryIntent("tell me how to create a website using voice");
	assert.equal(result.mode, "voice");
	assert.equal(result.explicit, true);
	assert.match(result.prompt, /create a website/i);
});

test("image generation wording explicitly routes to generated image", () => {
	const result = detectAlphaDeliveryIntent("generate an image of a boy running in Lagos");
	assert.equal(result.mode, "image");
	assert.equal(result.action, "generate");
	assert.match(result.prompt, /boy running in Lagos/i);
});

test("image search wording is distinguished from generation", () => {
	const result = detectAlphaDeliveryIntent("show me a photo of a Nigerian classroom");
	assert.equal(result.mode, "image");
	assert.equal(result.action, "search");
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
