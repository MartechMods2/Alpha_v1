import test from "node:test";
import assert from "node:assert/strict";
import mediaPack, {
	AI_IMAGE_COMMANDS,
	AI_VOICE_COMMANDS,
	RAW_TTS_COMMANDS,
	classifyAlphaMediaCommand,
	resolveExplicitMediaPrompt,
} from "../commands/public/aiMedia.js";

test("explicit Alpha output commands are registered", () => {
	const config = mediaPack();
	for (const command of ["img", "voice", "say"]) {
		assert.ok(config.cmd.includes(command), `${command} should be registered`);
	}
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
