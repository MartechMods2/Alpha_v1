import { getGroupData } from "../db/groupData.js";
import { askSafeAi, useSafeAiBudget } from "./safeAi.js";
import {
	buildAlphaPrompt,
	canUseAlphaMention,
	isAlphaQuiet,
	normalizeAlphaSettings,
	useAlphaQuota,
} from "./alphaMention.js";
import {
	claimImageQuota,
	claimVoiceQuota,
	generateAlphaImage,
	generateAlphaVoiceNote,
} from "./alphaMediaAi.js";
import { detectAlphaDeliveryIntent } from "./alphaDeliveryIntent.js";
import { getBotIdentityJids, isJidGroupAdmin, isSameGroupUser } from "./groupParticipants.js";
import { detectSmartIntent } from "./smartIntent.js";
import { runSmartIntent } from "../commands/public/smartIntent.js";

const contextInfoOf = (msg) => {
	const m = msg?.message || {};
	return m.extendedTextMessage?.contextInfo ||
		m.imageMessage?.contextInfo ||
		m.videoMessage?.contextInfo ||
		m.documentMessage?.contextInfo ||
		m.audioMessage?.contextInfo ||
		{};
};

const ownerNumbers = () => String(process.env.MY_NUMBER || "")
	.split(/[,;\s]+/)
	.map((value) => value.replace(/\D/g, ""))
	.filter(Boolean);

const senderDigits = (jid) => String(jid || "").split("@")[0].split(":")[0].replace(/\D/g, "");
const isConfiguredOwner = (jid) => {
	const value = senderDigits(jid);
	return value && ownerNumbers().some((owner) => value === owner || value.endsWith(owner) || owner.endsWith(value));
};

const botSeedJids = (sock) => {
	const configured = String(process.env.BOT_NUMBER || "").replace(/\D/g, "");
	return [
		sock?.user?.id,
		sock?.user?.lid,
		configured ? `${configured}@s.whatsapp.net` : "",
	].filter(Boolean);
};

const escapeRegExp = (value) => String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const alphaNames = () => [...new Set([
	"Alpha",
	process.env.ALPHA_NAME,
	process.env.BOT_NAME,
].map((value) => String(value || "").trim()).filter(Boolean))];

export const bodyAddressesAlpha = (body) => {
	const text = String(body || "").trim();
	if (!text) return false;
	return alphaNames().some((name) => {
		const safe = escapeRegExp(name);
		return new RegExp(`(?:^|\\s)@${safe}(?:\\b|$)`, "i").test(text)
			|| new RegExp(`^${safe}(?:\\b|[,:])`, "i").test(text);
	});
};

const send = (sock, to, content, options) => sock.sendMessage(to, content, options);
const safePrompt = (value, max = 5000) => String(value || "").replace(/\s+/g, " ").trim().slice(0, max);

const deliveryStyle = (settings) => settings.alphaPersonality === "desire"
	? "You are Alpha in Desire Hub AFTER DARK mode: 30% teasing, 30% helpful and 40% chaotic. Sound witty, Nigerian-flavoured and human, but keep flirting non-explicit, consensual and respectful. Never pressure, degrade or harass anyone."
	: "You are Alpha, a warm, intelligent WhatsApp assistant. Answer naturally and accurately.";

const sendVoiceAnswer = async ({ sock, msg, groupJid, senderJid, prompt, settings }) => {
	const quota = claimVoiceQuota(senderJid);
	if (!quota.allowed) {
		await send(sock, groupJid, { text: `⏳ Voice-note limit reached. Try again in about ${Math.ceil(quota.retryAfterSeconds / 60)} minute(s).` }, { quoted: msg });
		return true;
	}
	if (!await useSafeAiBudget(groupJid, senderJid).catch(() => true)) {
		await send(sock, groupJid, { text: "⏳ Your Alpha AI limit for today has been reached." }, { quoted: msg });
		return true;
	}
	const built = await buildAlphaPrompt({ sock, msg, body: prompt, mentionedJids: [], settings });
	const { text } = await askSafeAi({
		groupJid,
		systemPrompt: `${deliveryStyle(settings)} The answer will be spoken as a WhatsApp voice note. Use natural spoken language, no markdown, and stay under about 220 words unless detail is essential.`,
		messages: [{ role: "user", content: built }],
	});
	const spoken = String(text || "").replace(/[*_`#]/g, "").trim().slice(0, 2800);
	if (!spoken) throw new Error("Alpha returned no text to speak");
	const audio = await generateAlphaVoiceNote(spoken, {
		instructions: settings.alphaPersonality === "desire"
			? "Speak naturally, playfully and confidently like a witty Nigerian WhatsApp friend. Keep it respectful and never overact."
			: undefined,
	});
	await send(sock, groupJid, { audio: audio.buffer, mimetype: audio.mimetype, ptt: true }, { quoted: msg });
	return true;
};

const sendGeneratedImage = async ({ sock, msg, groupJid, senderJid, prompt }) => {
	const quota = claimImageQuota(senderJid);
	if (!quota.allowed) {
		await send(sock, groupJid, { text: `⏳ Image limit reached. Try again in about ${Math.ceil(quota.retryAfterSeconds / 60)} minute(s).` }, { quoted: msg });
		return true;
	}
	const image = await generateAlphaImage(prompt);
	await send(sock, groupJid, { image: image.buffer, caption: "🎨 *Alpha Image*" }, { quoted: msg });
	return true;
};

const runExistingMediaIntent = async ({ sock, msg, groupJid, senderJid, metadata, intent, prompt }) => {
	const sendMessageWTyping = (to, content, options) => send(sock, to, content, options);
	const smart = detectSmartIntent(intent.original, { isGroup: true });
	if (!smart || (intent.mode === "video" && !/video/i.test(smart.label || ""))) {
		const { commandsPublic } = await import("./commandLoader.js");
		const command = intent.mode === "video" ? "freevideo" : "freeimage";
		const target = commandsPublic[command];
		if (!target) throw new Error(`${command} is not available`);
		await target(sock, msg, groupJid, safePrompt(prompt, 500).split(/\s+/), {
			prefix: process.env.PREFIX || "$",
			command,
			isGroup: true,
			senderJid,
			groupMetadata: metadata,
			sendMessageWTyping,
			evv: safePrompt(prompt, 500),
		});
		return true;
	}
	return runSmartIntent({
		intent: smart,
		sock,
		msg,
		from: groupJid,
		info: {
			prefix: process.env.PREFIX || "$",
			isGroup: true,
			senderJid,
			groupMetadata: metadata,
			sendMessageWTyping,
			extendedMessageOriginal: contextInfoOf(msg),
		},
	});
};

export const handleExplicitAlphaDelivery = async ({ sock, msg, groupJid, senderJid, body }) => {
	const intent = detectAlphaDeliveryIntent(body);
	// Strict rule: Alpha sends text unless the user explicitly asks for another format.
	if (!intent.explicit || intent.mode === "text") return false;
	if (!groupJid?.endsWith("@g.us") || !senderJid || !sock?.user) return false;

	const metadata = await sock.groupMetadata(groupJid).catch(() => null);
	if (!metadata?.participants) return false;
	const botJids = await getBotIdentityJids(sock, metadata, botSeedJids(sock));
	const mentioned = contextInfoOf(msg)?.mentionedJid || [];
	const mentionedList = Array.isArray(mentioned) ? mentioned : [mentioned];
	const resolvedMention = mentionedList.some((jid) => isSameGroupUser(metadata, jid, botJids));
	// WhatsApp can occasionally expose a PN/LID alias too late for the passive
	// router. A visible @Alpha mention (or a message starting with Alpha) is a
	// safe fallback and prevents explicit voice/image requests becoming text.
	if (!resolvedMention && !bodyAddressesAlpha(body)) return false;

	const groupData = await getGroupData(groupJid).catch(() => null);
	if (!groupData?.isChatBotOn) return false;
	const settings = normalizeAlphaSettings(groupData);
	const isOwner = isConfiguredOwner(senderJid);
	const isAdmin = isJidGroupAdmin(metadata, [senderJid, msg?.key?.participantPn, msg?.key?.participantAlt].filter(Boolean));
	if (!canUseAlphaMention({
		settings,
		senderJid,
		isAdmin,
		isOwner,
		matches: (left, right) => isSameGroupUser(metadata, left, right),
	})) return true;
	if (settings.alphaMode === "off" || isAlphaQuiet(settings)) return true;
	if (!useAlphaQuota(groupJid, senderJid, settings.alphaDailyQuota)) return true;

	try {
		const prompt = safePrompt(intent.prompt || intent.original, 5000);
		if (intent.mode === "voice") return sendVoiceAnswer({ sock, msg, groupJid, senderJid, prompt, settings });
		if (intent.mode === "image") {
			// Explicit image/picture requests are AI-generated by default. Only
			// clearly search-oriented wording such as “find/search/get a real photo”
			// uses the safe public-media search path.
			if (intent.action === "search") return runExistingMediaIntent({ sock, msg, groupJid, senderJid, metadata, intent, prompt });
			return sendGeneratedImage({ sock, msg, groupJid, senderJid, prompt });
		}
		if (intent.mode === "video") {
			if (intent.action === "generate") {
				await send(sock, groupJid, { text: "🎥 AI video generation is not configured yet. I can still find and send a matching real video if you say *find me a video of…*." }, { quoted: msg });
				return true;
			}
			return runExistingMediaIntent({ sock, msg, groupJid, senderJid, metadata, intent, prompt });
		}
		return false;
	} catch (error) {
		console.error("[ALPHA DELIVERY ROUTER]", error.message);
		await send(sock, groupJid, { text: `⚡ Alpha could not deliver that response as ${intent.mode}: ${error.message}` }, { quoted: msg }).catch(() => {});
		return true;
	}
};
