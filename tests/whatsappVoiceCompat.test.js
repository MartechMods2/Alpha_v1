import test from "node:test";
import assert from "node:assert/strict";
import {
	isWhatsAppVoiceBuffer,
	normalizeAudioForWhatsAppVoice,
} from "../utils/alphaMediaAi.js";

const makeSilentWav = ({ sampleRate = 24000, seconds = 0.25 } = {}) => {
	const samples = Math.max(1, Math.floor(sampleRate * seconds));
	const dataSize = samples * 2;
	const wav = Buffer.alloc(44 + dataSize);
	wav.write("RIFF", 0, "ascii");
	wav.writeUInt32LE(36 + dataSize, 4);
	wav.write("WAVE", 8, "ascii");
	wav.write("fmt ", 12, "ascii");
	wav.writeUInt32LE(16, 16);
	wav.writeUInt16LE(1, 20);
	wav.writeUInt16LE(1, 22);
	wav.writeUInt32LE(sampleRate, 24);
	wav.writeUInt32LE(sampleRate * 2, 28);
	wav.writeUInt16LE(2, 32);
	wav.writeUInt16LE(16, 34);
	wav.write("data", 36, "ascii");
	wav.writeUInt32LE(dataSize, 40);
	return wav;
};

test("WhatsApp voice validator requires an Ogg Opus container", () => {
	assert.equal(isWhatsAppVoiceBuffer(Buffer.from("not audio")), false);
	assert.equal(isWhatsAppVoiceBuffer(Buffer.concat([
		Buffer.from("OggS"),
		Buffer.alloc(80),
	])), false);
});

test("voice normalization produces a validated WhatsApp Ogg Opus file", async () => {
	const voice = await normalizeAudioForWhatsAppVoice(makeSilentWav(), "wav");
	assert.ok(voice.length > 64);
	assert.equal(voice.subarray(0, 4).toString("ascii"), "OggS");
	assert.ok(voice.includes(Buffer.from("OpusHead", "ascii")));
	assert.equal(isWhatsAppVoiceBuffer(voice), true);
});
