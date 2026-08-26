import assert from "node:assert/strict";
import test from "node:test";
import {
	createMemeImage,
	createPhotoGrid,
	createProfileCard,
	createTextStickerImage,
	createThumbnail,
	convertMediaToSticker,
	transformImage,
} from "../utils/mediaStudio.js";

test("text sticker renderer creates a PNG", () => {
	const image = createTextStickerImage("Alpha squad");
	assert.ok(image.length > 1000);
	assert.equal(image.subarray(1, 4).toString(), "PNG");
});

test("sticker converter emits a WhatsApp-compatible WebP buffer", async () => {
	const png = createTextStickerImage("Alpha sticker check");
	const sticker = await convertMediaToSticker(png, { inputExtension: "png", pack: "Alpha", author: "Tests" });
	assert.ok(sticker.length > 1000);
	assert.equal(sticker.subarray(0, 4).toString(), "RIFF");
	assert.equal(sticker.subarray(8, 12).toString(), "WEBP");
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

test("selected image studio operations produce valid PNG or JPEG buffers", async () => {
	const source = createTextStickerImage("Source");
	for (const operation of ["upscale", "replacebg", "passport", "signature", "scan"]) {
		const output = await transformImage(source, operation, { color: "#ffffff" });
		assert.ok(output.length > 1000, operation);
	}
	const thumbnail = await createThumbnail(source, "Alpha Media Studio", "Safe group tools");
	assert.ok(thumbnail.length > 1000);
	const grid = await createPhotoGrid([source, source]);
	assert.ok(grid.length > 1000);
});

test("profile and rank card renderer produces a PNG", async () => {
	const card = await createProfileCard({ name: "Alpha Player", subtitle: "Gold Rank", points: 450 });
	assert.ok(card.length > 1000);
	assert.equal(card.subarray(1, 4).toString(), "PNG");
});
