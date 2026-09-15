import assert from "node:assert/strict";
import test from "node:test";

import { imageMimeFromBuffer } from "../utils/alphaMediaAi.js";
import { imageProviderStatus } from "../utils/alphaImage.js";

test("Alpha image validator recognizes WhatsApp-compatible image containers", () => {
	const png = Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a,0,0,0,0]);
	const jpeg = Buffer.from([0xff,0xd8,0xff,0xe0,0,0,0,0,0,0,0,0]);
	const webp = Buffer.from("RIFF1234WEBP", "ascii");
	assert.equal(imageMimeFromBuffer(png), "image/png");
	assert.equal(imageMimeFromBuffer(jpeg), "image/jpeg");
	assert.equal(imageMimeFromBuffer(webp), "image/webp");
	assert.equal(imageMimeFromBuffer(Buffer.from("not-an-image")), "");
});

test("image provider status includes OpenAI, Gemini and Pollinations without exposing secrets", () => {
	const oldOpenAI = process.env.OPENAI_API_KEY;
	const oldGoogle = process.env.GOOGLE_API_KEY;
	const oldPollinations = process.env.POLLINATIONS_API_KEY;
	try {
		process.env.OPENAI_API_KEY = "test-secret-openai";
		process.env.GOOGLE_API_KEY = "test-secret-google";
		process.env.POLLINATIONS_API_KEY = "test-secret-pollinations";
		const status = imageProviderStatus();
		assert.equal(status.openai, true);
		assert.equal(status.gemini, true);
		assert.equal(status.pollinations, true);
		const serialized = JSON.stringify(status);
		assert.equal(serialized.includes("test-secret-openai"), false);
		assert.equal(serialized.includes("test-secret-google"), false);
		assert.equal(serialized.includes("test-secret-pollinations"), false);
	} finally {
		if (oldOpenAI === undefined) delete process.env.OPENAI_API_KEY; else process.env.OPENAI_API_KEY = oldOpenAI;
		if (oldGoogle === undefined) delete process.env.GOOGLE_API_KEY; else process.env.GOOGLE_API_KEY = oldGoogle;
		if (oldPollinations === undefined) delete process.env.POLLINATIONS_API_KEY; else process.env.POLLINATIONS_API_KEY = oldPollinations;
	}
});
