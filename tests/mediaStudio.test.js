import assert from "node:assert/strict";
import test from "node:test";
import { createMemeImage, createTextStickerImage } from "../utils/mediaStudio.js";

test("text sticker renderer creates a PNG", () => {
	const image = createTextStickerImage("Alpha squad");
	assert.ok(image.length > 1000);
	assert.equal(image.subarray(1, 4).toString(), "PNG");
});

test("meme renderer creates a captioned PNG from an image buffer", async () => {
	const source = createTextStickerImage("Source");
	const image = await createMemeImage(source, "Top", "Bottom");
	assert.ok(image.length > 1000);
	assert.equal(image.subarray(1, 4).toString(), "PNG");
});

test("media renderer rejects empty inputs", async () => {
	await assert.rejects(createMemeImage(Buffer.alloc(0), "Top", "Bottom"), /empty/i);
	assert.throws(() => createTextStickerImage(""), /empty/i);
});
