import test from "node:test";
import assert from "node:assert/strict";
import {
	AI_IMAGE_COMMANDS,
	AI_VOICE_COMMANDS,
	MEDIA_HELP_COMMANDS,
	RAW_TTS_COMMANDS,
	classifyAlphaMediaCommand,
	resolveExplicitMediaPrompt,
} from "../utils/explicitMediaMode.js";

test("explicit Alpha output command catalog contains the core modes", () => {
	assert.ok(AI_IMAGE_COMMANDS.includes("img"));
	assert.ok(AI_VOICE_COMMANDS.includes("voice"));
	assert.ok(RAW_TTS_COMMANDS.includes("say"));
	assert.ok(MEDIA_HELP_COMMANDS.includes("aimedia"));
});

test("voice is an intelligent AI-answer mode, not raw TTS", () => {
	assert.equal(classifyAlphaMediaCommand("voice"), "voice-ai");
	assert.ok(AI_VOICE_COMMANDS.includes("voice"));
	assert.ok(!RAW_TTS_COMMANDS.includes("voice"));
});

test("say and speak remain exact text-to-speech commands", () => {
	assert.equal(classifyAlphaMediaCommand("say"), "voice-tts");
	assert.equal(classifyAlphaMediaCommand("speak"), "voice-tts");
});

test("img always routes to AI image generation", () => {
	assert.equal(classifyAlphaMediaCommand("img"), "image");
	assert.ok(AI_IMAGE_COMMANDS.includes("img"));
});

test("explicit media prompt uses command arguments first", () => {
	assert.equal(resolveExplicitMediaPrompt(["explain", "DNS", "simply"], {}), "explain DNS simply");
});

test("explicit media prompt can use replied text when arguments are empty", () => {
	const context = { quotedMessage: { conversation: "Explain DNS simply" } };
	assert.equal(resolveExplicitMediaPrompt([], context), "Explain DNS simply");
});
