import { randomUUID } from "node:crypto";
import { readFile, unlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import ffmpegPath from "ffmpeg-static";
import * as googleTTS from "google-tts-api";
import {
	resolveGoogleTtsMethod,
	resolveLegacyGoogleTtsFunction,
	splitGoogleTtsText,
} from "./googleTtsCompat.js";

const imageUsage = new Map();
const voiceUsage = new Map();
const WINDOW_MS = 10 * 60_000;

const claimWindow = (store, key, limit, now = Date.now()) => {
	const id = String(key || "unknown");
	const current = store.get(id);
	if (!current || now - current.startedAt >= WINDOW_MS) {
		store.set(id, { startedAt: now, count: 1 });
		return { allowed: true, remaining: limit - 1 };
	}
	if (current.count >= limit) {
		return { allowed: false, retryAfterSeconds: Math.ceil((current.startedAt + WINDOW_MS - now) / 1000) };
	}
	current.count += 1;
	return { allowed: true, remaining: limit - current.count };
};

export const claimImageQuota = (memberJid) => claimWindow(imageUsage, memberJid, Math.max(1, Math.min(10, Number(process.env.IMAGE_WINDOW_LIMIT) || 3)));
export const claimVoiceQuota = (memberJid) => claimWindow(voiceUsage, memberJid, Math.max(3, Math.min(40, Number(process.env.VOICE_WINDOW_LIMIT) || 12)));

const imagePromptSafety = (prompt) => {
	const text = String(prompt || "").trim();
	if (!text) throw new Error("add an image description after the command");
	if (text.length > 1400) throw new Error("image prompt is too long; keep it under 1,400 characters");
	const minor = /\b(child|children|kid|kids|minor|minors|underage|preteen|young teen|schoolchild)\b/i.test(text);
	const sexual = /\b(nude|naked|porn|pornographic|sex|sexual|explicit|genitals|erotic)\b/i.test(text);
	if (minor && sexual) throw new Error("Alpha cannot generate sexual content involving minors");
	return text;
};

const fetchImageBuffer = async (url) => {
	const response = await fetch(url, { signal: AbortSignal.timeout(30_000) });
	if (!response.ok) throw new Error(`image download failed with HTTP ${response.status}`);
	const length = Number(response.headers.get("content-length") || 0);
	if (length > 20 * 1024 * 1024) throw new Error("generated image is unexpectedly large");
	const bytes = Buffer.from(await response.arrayBuffer());
	if (!bytes.length || bytes.length > 20 * 1024 * 1024) throw new Error("invalid generated image payload");
	return bytes;
};

export const generateAlphaImage = async (rawPrompt) => {
	const prompt = imagePromptSafety(rawPrompt);
	const apiKey = String(process.env.OPENAI_API_KEY || "").trim();
	if (!apiKey) throw new Error("OPENAI_API_KEY is not configured for image generation");
	const model = String(process.env.OPENAI_IMAGE_MODEL || "gpt-image-2").trim();
	const size = String(process.env.OPENAI_IMAGE_SIZE || "1024x1024").trim();
	const quality = String(process.env.OPENAI_IMAGE_QUALITY || "low").trim();
	const response = await fetch("https://api.openai.com/v1/images/generations", {
		method: "POST",
		headers: {
			Authorization: `Bearer ${apiKey}`,
			"Content-Type": "application/json",
		},
		body: JSON.stringify({ model, prompt, size, quality }),
		signal: AbortSignal.timeout(120_000),
	});
	if (!response.ok) {
		const error = await response.text().catch(() => "");
		throw new Error(`image provider HTTP ${response.status}${error ? `: ${error.slice(0, 240)}` : ""}`);
	}
	const data = await response.json();
	const first = data?.data?.[0];
	if (first?.b64_json) {
		const buffer = Buffer.from(first.b64_json, "base64");
		if (!buffer.length) throw new Error("image provider returned an empty image");
		return { buffer, provider: "openai", model };
	}
	if (first?.url) return { buffer: await fetchImageBuffer(first.url), provider: "openai", model };
	throw new Error("image provider returned no image data");
};

const runFfmpeg = (args) => new Promise((resolve, reject) => {
	const executable = ffmpegPath || "ffmpeg";
	const child = spawn(executable, args, { stdio: ["ignore", "ignore", "pipe"] });
	let stderr = "";
	child.stderr.on("data", (chunk) => { stderr += String(chunk).slice(-4000); });
	child.once("error", reject);
	child.once("close", (code) => code === 0 ? resolve() : reject(new Error(`ffmpeg failed (${code}): ${stderr.slice(-500)}`)));
});

const mp3ToOggOpus = async (buffer) => {
	const id = randomUUID();
	const input = path.join(tmpdir(), `alpha-${id}.mp3`);
	const output = path.join(tmpdir(), `alpha-${id}.ogg`);
	try {
		await writeFile(input, buffer);
		await runFfmpeg(["-hide_banner", "-loglevel", "error", "-y", "-i", input, "-vn", "-c:a", "libopus", "-b:a", "48k", "-vbr", "on", "-application", "voip", "-ar", "48000", "-ac", "1", output]);
		return await readFile(output);
	} finally {
		await Promise.allSettled([unlink(input), unlink(output)]);
	}
};

const fetchGoogleSpeechPart = async (rawUrl) => {
	const url = new URL(String(rawUrl || ""));
	if (url.protocol !== "https:") throw new Error("Google TTS returned an unsafe audio URL");
	const response = await fetch(url, {
		headers: { "User-Agent": "Mozilla/5.0 AlphaBot/1.0" },
		signal: AbortSignal.timeout(20_000),
	});
	if (!response.ok) throw new Error(`Google TTS audio download failed with HTTP ${response.status}`);
	const length = Number(response.headers.get("content-length") || 0);
	if (length > 6 * 1024 * 1024) throw new Error("Google TTS audio part is unexpectedly large");
	const buffer = Buffer.from(await response.arrayBuffer());
	if (!buffer.length || buffer.length > 6 * 1024 * 1024) throw new Error("Google TTS returned an invalid audio part");
	return buffer;
};

const googleSpeechMp3 = async (text, lang) => {
	const getAllAudioBase64 = resolveGoogleTtsMethod(googleTTS, "getAllAudioBase64");
	if (getAllAudioBase64) {
		const parts = await getAllAudioBase64(text, { lang, slow: false });
		const buffers = (parts || [])
			.map((part) => Buffer.from(part?.base64 || part || "", "base64"))
			.filter((buffer) => buffer.length);
		if (buffers.length) return Buffer.concat(buffers);
	}

	const getAudioBase64 = resolveGoogleTtsMethod(googleTTS, "getAudioBase64");
	if (getAudioBase64) {
		const buffers = [];
		for (const chunk of splitGoogleTtsText(text, 180)) {
			const base64 = await getAudioBase64(chunk, { lang, slow: false, timeout: 15_000 });
			const buffer = Buffer.from(String(base64 || ""), "base64");
			if (buffer.length) buffers.push(buffer);
		}
		if (buffers.length) return Buffer.concat(buffers);
	}

	const getAllAudioUrls = resolveGoogleTtsMethod(googleTTS, "getAllAudioUrls");
	if (getAllAudioUrls) {
		const parts = await Promise.resolve(getAllAudioUrls(text, { lang, slow: false, splitPunct: ",.!?;:" }));
		const buffers = [];
		for (const part of parts || []) {
			const url = part?.url || part;
			if (url) buffers.push(await fetchGoogleSpeechPart(url));
		}
		if (buffers.length) return Buffer.concat(buffers);
	}

	const getAudioUrl = resolveGoogleTtsMethod(googleTTS, "getAudioUrl");
	if (getAudioUrl) {
		const buffers = [];
		for (const chunk of splitGoogleTtsText(text, 180)) {
			const url = await Promise.resolve(getAudioUrl(chunk, { lang, slow: false }));
			if (url) buffers.push(await fetchGoogleSpeechPart(url));
		}
		if (buffers.length) return Buffer.concat(buffers);
	}

	// google-tts-api@0.0.6 exports one async function with the signature
	// (text, lang, speed). It returns a temporary Google Translate TTS URL.
	const legacyTts = resolveLegacyGoogleTtsFunction(googleTTS);
	if (legacyTts) {
		const buffers = [];
		for (const chunk of splitGoogleTtsText(text, 180)) {
			const url = await legacyTts(chunk, lang, 1);
			if (url) buffers.push(await fetchGoogleSpeechPart(url));
		}
		if (buffers.length) return Buffer.concat(buffers);
	}

	throw new Error("installed google-tts-api exposes no supported audio method");
};

export const generateAlphaVoiceNote = async (rawText, options = {}) => {
	const text = String(rawText || "").replace(/\s+/g, " ").trim();
	if (!text) throw new Error("add text for Alpha to speak");
	if (text.length > 2800) throw new Error("voice-note text is too long; keep it under 2,800 characters");
	const apiKey = String(process.env.OPENAI_API_KEY || "").trim();
	if (apiKey) {
		const model = String(process.env.OPENAI_TTS_MODEL || "gpt-4o-mini-tts").trim();
		const voice = String(options.voice || process.env.OPENAI_TTS_VOICE || "coral").trim();
		const instructions = String(options.instructions || process.env.OPENAI_TTS_INSTRUCTIONS || "Speak naturally, warmly and clearly like a helpful WhatsApp assistant.").slice(0, 500);
		const response = await fetch("https://api.openai.com/v1/audio/speech", {
			method: "POST",
			headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
			body: JSON.stringify({ model, voice, input: text, instructions, response_format: "opus" }),
			signal: AbortSignal.timeout(90_000),
		});
		if (response.ok) {
			const buffer = Buffer.from(await response.arrayBuffer());
			if (buffer.length) return { buffer, mimetype: "audio/ogg; codecs=opus", provider: "openai", model };
		}
		const detail = await response.text().catch(() => "");
		console.warn(`[ALPHA_TTS] OpenAI failed ${response.status}: ${detail.slice(0, 240)}`);
	}

	const lang = String(options.lang || process.env.GOOGLE_TTS_LANG || "en").trim();
	const mp3 = await googleSpeechMp3(text, lang);
	if (!mp3.length) throw new Error("voice provider returned no audio");
	try {
		return { buffer: await mp3ToOggOpus(mp3), mimetype: "audio/ogg; codecs=opus", provider: "google-tts", model: "google-tts" };
	} catch (error) {
		console.warn("[ALPHA_TTS] opus conversion failed; sending MPEG audio fallback:", error.message);
		return { buffer: mp3, mimetype: "audio/mpeg", provider: "google-tts", model: "google-tts" };
	}
};
