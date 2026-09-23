import { GoogleGenerativeAI } from "@google/generative-ai";
import { downloadResolvedMedia, quotedText, resolveMediaEnvelope } from "./mediaInput.js";
import { notifyAlphaOwnerFailure } from "./alphaErrorReporter.js";

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
	alphaAccessMode: "everyone",
	alphaAllowedMembers: [],
	alphaDeniedMembers: [],
});

const validClock = (value) => /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(String(value || ""));

const normalizeMemberList = (value) => Array.isArray(value)
	? [...new Set(value.map((jid) => String(jid || "").trim()).filter((jid) => jid.includes("@")))].slice(0, 100)
	: [];

export const normalizeAlphaSettings = (data = {}) => ({
	alphaMode: ["smart", "text", "mixed", "sticker", "off"].includes(data.alphaMode) ? data.alphaMode : DEFAULT_ALPHA_SETTINGS.alphaMode,
	alphaMemoryLimit: Number.isFinite(Number(data.alphaMemoryLimit))
		? Math.min(20, Math.max(0, Math.trunc(Number(data.alphaMemoryLimit))))
		: DEFAULT_ALPHA_SETTINGS.alphaMemoryLimit,
	alphaDailyQuota: Number.isFinite(Number(data.alphaDailyQuota))
		? Math.min(50, Math.max(1, Math.trunc(Number(data.alphaDailyQuota))))
		: DEFAULT_ALPHA_SETTINGS.alphaDailyQuota,
	alphaImageOn: data.alphaImageOn !== false,
	alphaVoiceOn: Boolean(data.alphaVoiceOn),
	alphaDocOn: Boolean(data.alphaDocOn),
	alphaStickerOn: data.alphaStickerOn !== false,
	alphaPersonality: ["friendly", "funny", "professional", "desire"].includes(data.alphaPersonality) ? data.alphaPersonality : "friendly",
	alphaResponseLength: ["short", "normal", "detailed"].includes(data.alphaResponseLength) ? data.alphaResponseLength : "short",
	alphaQuietStart: validClock(data.alphaQuietStart) ? data.alphaQuietStart : "",
	alphaQuietEnd: validClock(data.alphaQuietEnd) ? data.alphaQuietEnd : "",
	alphaAccessMode: ["everyone", "admins", "allowlist", "denylist"].includes(data.alphaAccessMode)
		? data.alphaAccessMode
		: DEFAULT_ALPHA_SETTINGS.alphaAccessMode,
	alphaAllowedMembers: normalizeMemberList(data.alphaAllowedMembers),
	alphaDeniedMembers: normalizeMemberList(data.alphaDeniedMembers),
});

export const canUseAlphaMention = ({
	settings,
	senderJid,
	isAdmin = false,
	isOwner = false,
	matches = (left, right) => left === right,
}) => {
	if (isAdmin || isOwner) return true;
	const mode = settings?.alphaAccessMode || "everyone";
	if (mode === "everyone") return true;
	if (mode === "admins") return false;
	const isListed = (mode === "allowlist" ? settings.alphaAllowedMembers : settings.alphaDeniedMembers)
		.some((jid) => matches(senderJid, jid));
	return mode === "allowlist" ? isListed : !isListed;
};

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

const mediaInstruction = (kind) => ({
	image: "Describe the image and answer the user's request. Do not identify real people or infer sensitive traits.",
	audio: "Transcribe the important spoken content, then answer the user's request.",
	document: "Read this document and answer using only information that is present. Say when information is unavailable.",
}[kind] || "Analyze this media safely.");

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const mediaModelCandidates = () => {
	const primary = process.env.GEMINI_MEDIA_MODEL || "gemini-3.5-flash-lite";
	const fallback = String(process.env.GEMINI_MEDIA_FALLBACK_MODELS || "")
		.split(",")
		.map((value) => value.trim())
		.filter(Boolean);
	const textModel = String(process.env.GEMINI_TEXT_MODEL || "").trim();
	return [...new Set([primary, ...fallback, textModel].filter(Boolean))];
};

const geminiStatus = (error) => Number(
	error?.status ||
	error?.response?.status ||
	String(error?.message || "").match(/\[(\d{3})\s/)?.[1] ||
	0,
);

const isTemporaryGeminiError = (error) => {
	const status = geminiStatus(error);
	if ([429, 500, 502, 503, 504].includes(status)) return true;
	return /high demand|service unavailable|temporar|overloaded|rate limit|resource exhausted/i.test(String(error?.message || ""));
};

const generateMediaAnalysis = async ({ client, models, prompt, media }) => {
	let lastError;
	for (const modelName of models) {
		for (let attempt = 0; attempt < 2; attempt += 1) {
			try {
				const model = client.getGenerativeModel({ model: modelName });
				const response = await model.generateContent([
					prompt,
					{ inlineData: { data: media.buffer.toString("base64"), mimeType: media.mime } },
				]);
				return {
					text: String(response.response.text() || "").trim().slice(0, 4000),
					model: modelName,
				};
			} catch (error) {
				lastError = error;
				if (!isTemporaryGeminiError(error) || attempt === 1) break;
				await sleep(700 * (attempt + 1));
			}
		}
	}
	throw lastError || new Error("Gemini media analysis failed");
};

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
	const models = mediaModelCandidates();
	try {
		const result = await generateMediaAnalysis({
			client,
			models,
			prompt: `${mediaInstruction(resolved.kind)}\nUser request: ${String(userPrompt || "Please explain this").slice(0, 1000)}`,
			media,
		});
		return result.text;
	} catch (error) {
		if (isTemporaryGeminiError(error)) {
			notifyAlphaOwnerFailure({
				sock,
				scope: "media-understanding",
				error,
				groupName: msg?.key?.remoteJid?.endsWith("@g.us") ? "WhatsApp group" : "",
				senderName: msg?.pushName || "",
				detail: `kind=${resolved.kind}; models=${models.join(",")}`,
			});
			return "MEDIA_UNAVAILABLE: The attached media could not be inspected because the media AI service is temporarily busy. Do not guess what is in the media. Tell the user briefly that Alpha could not inspect the media right now and ask them to retry shortly or paste the important text.";
		}
		throw error;
	}
};

export const stripBotMention = (body, mentionedJids = []) => {
	let text = String(body || "");
	for (const jid of mentionedJids) {
		const number = String(jid).split("@")[0].split(":")[0];
		if (number) text = text.replace(new RegExp(`@${number}\\b`, "g"), " ");
	}
	return text.replace(/\s+/g, " ").trim();
};

const personalityInstruction = (settings) => {
	if (settings.alphaPersonality === "desire") {
		return "Use Desire Hub AFTER DARK personality: roughly 30% teasing, 30% helpful and 40% chaotic. Be short, witty, Nigerian-flavoured and human. Flirting must stay non-explicit, consensual and respectful. Never pressure, degrade, harass or sound like a corporate notice.";
	}
	return `Reply in a ${settings.alphaPersonality} style.`;
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
	const style = `${personalityInstruction(settings)} Keep the response ${settings.alphaResponseLength}. Unless the user explicitly asks for another format, answer as normal text.`;
	return `${prompt || "Greet me briefly and ask how you can help."}\n\n${style}`;
};
