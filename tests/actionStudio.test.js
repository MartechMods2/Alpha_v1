import assert from "node:assert/strict";
import test from "node:test";
import {
	ACTION_COMMANDS,
	ACTIONS,
	FRIENDLY_ACTIONS,
	createActionStickerImage,
} from "../utils/actionStudio.js";
import { convertMediaToSticker } from "../utils/mediaStudio.js";

test("action catalog includes requested play-fight and friendly commands", () => {
	for (const command of ["slap", "beat", "laugh", "hug", "highfive", "tickle"]) {
		assert.ok(ACTION_COMMANDS.includes(command));
	}
	assert.equal(ACTIONS.slap.tone, "rough");
	assert.ok(FRIENDLY_ACTIONS.includes("laugh"));
});

test("action renderer creates a PNG and converts it to WhatsApp WebP", async () => {
	const image = await createActionStickerImage({ action: "slap", actorName: "Ada", targetName: "Tunde" });
	assert.ok(image.length > 1000);
	assert.equal(image.subarray(1, 4).toString(), "PNG");
	const sticker = await convertMediaToSticker(image, { inputExtension: "png", pack: "Alpha Actions", author: "Tests" });
	assert.ok(sticker.length > 1000);
	assert.equal(sticker.subarray(0, 4).toString(), "RIFF");
	assert.equal(sticker.subarray(8, 12).toString(), "WEBP");
});

test("action renderer rejects an unknown action", async () => {
	await assert.rejects(createActionStickerImage({ action: "unknown", actorName: "A", targetName: "B" }), /unknown/i);
});
