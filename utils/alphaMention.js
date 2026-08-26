import { GoogleGenerativeAI } from "@google/generative-ai";
import { downloadResolvedMedia, quotedText, resolveMediaEnvelope } from "./mediaInput.js";

const quota = new Map();

export const DEFAULT_ALPHA_SETTINGS = Object.freeze({
	alphaMode: "smart",
	alphaMemoryLimit: 5,
	alphaDailyQuota: 10,
	alphaImageOn: true,
	alphaVoiceOn: false,
	alphaDocOn: false,
	alphaStickerOn: true,
	alphaPersonality: "friendly",
	alphaResponseLength: "short",
	alphaQuietStart: "",
	alphaQuietEnd: "",
});

export const normalizeAlphaSettings = (data = {}) => ({
	alphaMode: ["smart", "text", "mixed", "sticker", "off"].includes(data.alphaMode) ? data.alphaMode : DEFAULT_ALPHA_SETTINGS.alphaMode,
	alphaMemoryLimit: Number.isFinite(Number(data.alphaMemoryLimit))
		? Math.min(20, Math.max(0, Number(data.alphaMemoryLimit)))
		: DEFAULT_ALPHA_SETTINGS.alphaMemoryLimit,
	alphaDailyQuota: Number.isFinite(Number(data.alphaDailyQuota))
		? Math.min(50, Math.max(1, Number(data.alphaDailyQuota)))
		: DEFAULT_ALPHA_SETTINGS.alphaDailyQuota,
	alphaImageOn: data.alphaImageOn !== false,
	alphaVoiceOn: Boolean(data.alphaVoiceOn),
	alphaDocOn: Boolean(data.alphaDocOn),
	alphaStickerOn: data.alphaStickerOn !== false,
	alphaPersonality: ["friendly", "funny", "professional"].includes(data.alphaPersonality) ? data.alphaPersonality : "friendly",
	alphaResponseLength: ["short", "normal", "detailed"].includes(data.alphaResponseLength) ? data.alphaResponseLength : "short",
	alphaQuietStart: /^\d{2}:\d{2}$/.test(data.alphaQuietStart || "") ? data.alphaQuietStart : "",
	alphaQuietEnd: /^\d{2}:\d{2}$/.test(data.alphaQuietEnd || "") ? data.alphaQuietEnd : "",
});

const localMinutes = () => {
	const parts = new Intl.DateTimeFormat("en-GB", {
		timeZone: process.env.BOT_TIMEZONE || "Africa/Lagos",
		hour: "2-digit",
		minute: "2-digit",
		hour12: false,
	}).formatToParts(new Date());
	return Number(parts.find((part) => part.type === "hour")?.value || 0) * 60
		+ Number(parts.find((part) => part.type === "minute")?.value || 0);
};

export const isAlphaQuiet = (settings) => {
	if (!settings.alphaQuietStart || !settings.alphaQuietEnd) return false;
	const toMinutes = (value) => Number(value.slice(0, 2)) * 60 + Number(value.slice(3));
	const start = toMinutes(settings.alphaQuietStart);
	const end = toMinutes(settings.alphaQuietEnd);
	const now = localMinutes();
	return start <= end ? now >= start && now < end : now >= start || now < end;
};

export const useAlphaQuota = (groupJid, senderJid, limit) => {
	const key = `${new Date().toISOString().slice(0, 10)}:${groupJid}:${senderJid}`;
	const used = quota.get(key) || 0;
	if (used >= limit) return false;
	quota.set(key, used + 1);
	if (quota.size > 5000) {
		const today = `${new Date().toISOString().slice(0, 10)}:`;
		for (const entry of quota.keys()) if (!entry.startsWith(today)) quota.delete(entry);
	}
	return true;
};

const mediaInstruction = (kind) => ({
	image: "Describe the image and answer the user's request. Do not identify real people or infer sensitive traits.",
	audio: "Transcribe the important spoken content, then answer the user's request.",
	document: "Read this document and answer using only information that is present. Say when information is unavailable.",
}[kind] || "Analyze this media safely.");

export const analyzeMentionMedia = async (sock, msg, settings, userPrompt) => {
	const resolved = resolveMediaEnvelope(msg);
	if (!resolved) return "";
	if (resolved.kind === "image" && !settings.alphaImageOn) throw new Error("Alpha image understanding is disabled in this group");
	if (resolved.kind === "audio" && !settings.alphaVoiceOn) throw new Error("Alpha voice understanding is disabled in this group");
	if (resolved.kind === "document" && !settings.alphaDocOn) throw new Error("Alpha document understanding is disabled in this group");
	if (!["image", "audio", "document"].includes(resolved.kind)) return "";
	if (!process.env.GOOGLE_API_KEY) throw new Error("Media understanding requires GOOGLE_API_KEY");
	const media = await downloadResolvedMedia(sock, msg, {
		allowedKinds: [resolved.kind],
		maxBytes: resolved.kind === "document" ? 8 * 1024 * 1024 : 12 * 1024 * 1024,
	});
	const client = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);
	const model = client.getGenerativeModel({ model: process.env.GEMINI_MEDIA_MODEL || "gemini-2.0-flash" });
	const response = await model.generateContent([
		`${mediaInstruction(resolved.kind)}\nUser request: ${String(userPrompt || "Please explain this").slice(0, 1000)}`,
		{ inlineData: { data: media.buffer.toString("base64"), mimeType: media.mime } },
	]);
	return String(response.response.text() || "").trim().slice(0, 4000);
};

export const stripBotMention = (body, mentionedJids = []) => {
	let text = String(body || "");
	for (const jid of mentionedJids) {
		const number = String(jid).split("@")[0].split(":")[0];
		if (number) text = text.replace(new RegExp(`@${number}\\b`, "g"), " ");
	}
	return text.replace(/\s+/g, " ").trim();
};

export const buildAlphaPrompt = async ({ sock, msg, body, mentionedJids, settings }) => {
	let prompt = stripBotMention(body, mentionedJids);
	const quoted = quotedText(msg);
	if (quoted) prompt += `\n\nQuoted message: ${quoted.slice(0, 1200)}`;
	const mediaAnalysis = await analyzeMentionMedia(sock, msg, settings, prompt).catch((error) => {
		if (resolveMediaEnvelope(msg)) throw error;
		return "";
	});
	if (mediaAnalysis) prompt += `\n\nMedia analysis:\n${mediaAnalysis}`;
	const style = `Reply in a ${settings.alphaPersonality} style. Keep the response ${settings.alphaResponseLength}.`;
	return `${prompt || "Greet me briefly and ask how you can help."}\n\n${style}`;
};
