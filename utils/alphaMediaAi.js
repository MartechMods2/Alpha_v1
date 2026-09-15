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
const WHATSAPP_VOICE_MIMETYPE = "audio/ogg; codecs=opus";
const MAX_IMAGE_BYTES = 20 * 1024 * 1024;

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

export const imageMimeFromBuffer = (buffer) => {
	if (!Buffer.isBuffer(buffer) || buffer.length < 12) return "";
	if (buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "image/png";
	if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return "image/jpeg";
	if (buffer.subarray(0, 4).toString("ascii") === "RIFF" && buffer.subarray(8, 12).toString("ascii") === "WEBP") return "image/webp";
	return "";
};

const validateImageBuffer = (buffer) => {
	if (!Buffer.isBuffer(buffer) || !buffer.length) throw new Error("image provider returned an empty image");
	if (buffer.length > MAX_IMAGE_BYTES) throw new Error("generated image is unexpectedly large");
	const mimetype = imageMimeFromBuffer(buffer);
	if (!mimetype) throw new Error("image provider returned data that is not a supported PNG, JPEG or WebP image");
	return { buffer, mimetype };
};

const fetchImageBuffer = async (url) => {
	const parsed = new URL(String(url || ""));
	if (parsed.protocol !== "https:") throw new Error("image provider returned an unsafe image URL");
	const response = await fetch(parsed, { signal: AbortSignal.timeout(30_000) });
	if (!response.ok) throw new Error(`image download failed with HTTP ${response.status}`);
	const length = Number(response.headers.get("content-length") || 0);
	if (length > MAX_IMAGE_BYTES) throw new Error("generated image is unexpectedly large");
	return validateImageBuffer(Buffer.from(await response.arrayBuffer()));
};

const readableProviderError = async (response, label) => {
	let detail = "";
	try {
		const raw = await response.text();
		try {
			const parsed = JSON.parse(raw);
			detail = String(parsed?.error?.message || parsed?.message || "").replace(/\s+/g, " ").trim();
		} catch {
			detail = String(raw || "").replace(/\s+/g, " ").trim();
		}
	} catch {}
	const safeDetail = detail.slice(0, 220);
	return `${label} image provider HTTP ${response.status}${safeDetail ? `: ${safeDetail}` : ""}`;
};

const imageFromJson = async (data) => {
	const first = data?.data?.[0];
	if (first?.b64_json) return validateImageBuffer(Buffer.from(first.b64_json, "base64"));
	if (first?.url) return fetchImageBuffer(first.url);
	throw new Error("image provider returned no image data");
};

const generateOpenAiImage = async (prompt, apiKey) => {
	const model = String(process.env.OPENAI_IMAGE_MODEL || "gpt-image-2").trim();
	const size = String(process.env.OPENAI_IMAGE_SIZE || "1024x1024").trim();
	const quality = String(process.env.OPENAI_IMAGE_QUALITY || "low").trim();
	const response = await fetch("https://api.openai.com/v1/images/generations", {
		method: "POST",
		headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
		body: JSON.stringify({ model, prompt, size, quality }),
		signal: AbortSignal.timeout(120_000),
	});
	if (!response.ok) throw new Error(await readableProviderError(response, "OpenAI"));
	const image = await imageFromJson(await response.json());
	return { ...image, provider: "openai", model };
};

const generatePollinationsImage = async (prompt, apiKey) => {
	const baseUrl = String(process.env.POLLINATIONS_BASE_URL || "https://gen.pollinations.ai").replace(/\/+$/, "");
	const url = new URL(`${baseUrl}/v1/images/generations`);
	if (url.protocol !== "https:") throw new Error("Pollinations base URL must use HTTPS");
	const model = String(process.env.POLLINATIONS_IMAGE_MODEL || "flux").trim();
	const size = String(process.env.OPENAI_IMAGE_SIZE || "1024x1024").trim();
	const response = await fetch(url, {
		method: "POST",
		headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
		body: JSON.stringify({ model, prompt, size, n: 1 }),
		signal: AbortSignal.timeout(120_000),
	});
	if (!response.ok) throw new Error(await readableProviderError(response, "Pollinations"));
	const image = await imageFromJson(await response.json());
	return { ...image, provider: "pollinations", model };
};

export const imageProviderStatus = () => ({
	openai: Boolean(String(process.env.OPENAI_API_KEY || "").trim()),
	pollinations: Boolean(String(process.env.POLLINATIONS_API_KEY || "").trim()),
	openaiModel: String(process.env.OPENAI_IMAGE_MODEL || "gpt-image-2").trim(),
	pollinationsModel: String(process.env.POLLINATIONS_IMAGE_MODEL || "flux").trim(),
});

export const generateAlphaImage = async (rawPrompt) => {
	const prompt = imagePromptSafety(rawPrompt);
	const openAiKey = String(process.env.OPENAI_API_KEY || "").trim();
	const pollinationsKey = String(process.env.POLLINATIONS_API_KEY || "").trim();
	const providers = [];
	if (openAiKey) providers.push(() => generateOpenAiImage(prompt, openAiKey));
	if (pollinationsKey) providers.push(() => generatePollinationsImage(prompt, pollinationsKey));
	if (!providers.length) {
		throw new Error("image generation is not configured. Ask the admin to add OPENAI_API_KEY or POLLINATIONS_API_KEY, then use $imgstatus to verify it");
	}

	const failures = [];
	for (const provider of providers) {
		try {
			return await provider();
		} catch (error) {
			failures.push(String(error?.message || error));
		}
	}
	throw new Error(failures.join(" | ").slice(0, 650));
};

const runOneFfmpeg = (executable, args) => new Promise((resolve, reject) => {
	const child = spawn(executable, args, { stdio: ["ignore", "ignore", "pipe"] });
	let stderr = "";
	child.stderr.on("data", (chunk) => { stderr += String(chunk).slice(-4000); });
	child.once("error", reject);
	child.once("close", (code) => code === 0 ? resolve() : reject(new Error(`${executable} failed (${code}): ${stderr.slice(-500)}`)));
});

const runFfmpeg = async (args) => {
	const candidates = [...new Set([ffmpegPath, "ffmpeg"].filter(Boolean))];
	const failures = [];
	for (const executable of candidates) {
		try {
			await runOneFfmpeg(executable, args);
			return;
		} catch (error) {
			failures.push(error.message);
		}
	}
	throw new Error(`ffmpeg conversion failed: ${failures.join(" | ").slice(-1200)}`);
};

export const isWhatsAppVoiceBuffer = (buffer) => {
	if (!Buffer.isBuffer(buffer) || buffer.length < 64) return false;
	if (buffer.subarray(0, 4).toString("ascii") !== "OggS") return false;
	return buffer.includes(Buffer.from("OpusHead", "ascii"));
};

export const normalizeAudioForWhatsAppVoice = async (buffer, inputFormat = "mp3") => {
	if (!Buffer.isBuffer(buffer) || !buffer.length) throw new Error("voice provider returned no audio");
	if (buffer.length > 24 * 1024 * 1024) throw new Error("voice provider audio is unexpectedly large");
	const safeFormat = String(inputFormat || "mp3").toLowerCase().replace(/[^a-z0-9]/g, "");
	if (!safeFormat || safeFormat.length > 8) throw new Error("unsupported voice input format");

	const id = randomUUID();
	const input = path.join(tmpdir(), `alpha-${id}.${safeFormat}`);
	const output = path.join(tmpdir(), `alpha-${id}.ogg`);
	try {
		await writeFile(input, buffer);
		await runFfmpeg([
			"-hide_banner", "-loglevel", "error", "-y",
			"-fflags", "+genpts",
			"-i", input,
			"-map_metadata", "-1",
			"-vn",
			"-af", "aresample=async=1:first_pts=0",
			"-c:a", "libopus",
			"-application", "voip",
			"-ar", "48000",
			"-ac", "1",
			"-b:a", "32k",
			"-vbr", "on",
			"-avoid_negative_ts", "make_zero",
			"-f", "ogg",
			output,
		]);
		const normalized = await readFile(output);
		if (!isWhatsAppVoiceBuffer(normalized)) {
			throw new Error("ffmpeg produced an invalid WhatsApp Ogg/Opus voice file");
		}
		return normalized;
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
			const part = Buffer.from(String(base64 || ""), "base64");
			if (part.length) buffers.push(part);
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
			body: JSON.stringify({ model, voice, input: text, instructions, response_format: "mp3" }),
			signal: AbortSignal.timeout(90_000),
		});
		if (response.ok) {
			try {
				const mp3 = Buffer.from(await response.arrayBuffer());
				const buffer = await normalizeAudioForWhatsAppVoice(mp3, "mp3");
				return { buffer, mimetype: WHATSAPP_VOICE_MIMETYPE, provider: "openai", model, voice };
			} catch (error) {
				console.warn(`[ALPHA_TTS] OpenAI audio normalization failed: ${error.message}`);
			}
		} else {
			const detail = await response.text().catch(() => "");
			console.warn(`[ALPHA_TTS] OpenAI failed ${response.status}: ${detail.slice(0, 240)}`);
		}
	}

	const lang = String(options.lang || process.env.GOOGLE_TTS_LANG || "en").trim();
	const mp3 = await googleSpeechMp3(text, lang);
	const buffer = await normalizeAudioForWhatsAppVoice(mp3, "mp3");
	return { buffer, mimetype: WHATSAPP_VOICE_MIMETYPE, provider: "google-tts", model: "google-tts", voice: "default" };
};
