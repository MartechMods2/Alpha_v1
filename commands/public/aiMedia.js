import { askSafeAi, useSafeAiBudget } from "../../utils/safeAi.js";
import {
	claimImageQuota,
	claimVoiceQuota,
	generateAlphaImage,
	generateAlphaVoiceNote,
} from "../../utils/alphaMediaAi.js";

export const AI_IMAGE_COMMANDS = Object.freeze(["img", "imagegen", "drawai", "aipicture"]);
export const AI_VOICE_COMMANDS = Object.freeze(["voice", "voiceask", "askvoice", "aivoice", "vnote"]);
export const RAW_TTS_COMMANDS = Object.freeze(["say", "speak", "tts"]);

export const classifyAlphaMediaCommand = (command) => {
	const value = String(command || "").toLowerCase();
	if (AI_IMAGE_COMMANDS.includes(value)) return "image";
	if (AI_VOICE_COMMANDS.includes(value)) return "voice-ai";
	if (RAW_TTS_COMMANDS.includes(value)) return "voice-tts";
	if (["aimedia", "mediaai", "aimediahelp"].includes(value)) return "help";
	return "unknown";
};

const quotedText = (context = {}) => {
	const q = context?.quotedMessage || {};
	return String(
		q.conversation ??
		q.extendedTextMessage?.text ??
		q.imageMessage?.caption ??
		q.videoMessage?.caption ??
		q.documentMessage?.caption ??
		"",
	).trim();
};

export const resolveExplicitMediaPrompt = (args = [], context = {}) =>
	(String(Array.isArray(args) ? args.join(" ") : args).trim() || quotedText(context)).trim();

const handler = async (_sock, msg, from, args, info) => {
	const {
		command,
		prefix = "$",
		senderJid,
		isGroup,
		extendedMessageOriginal,
		sendMessageWTyping,
	} = info;
	const reply = (text) => sendMessageWTyping(from, { text }, { quoted: msg });
	const mode = classifyAlphaMediaCommand(command);

	if (mode === "help") {
		return reply(
			`⚡ *Alpha Explicit AI Modes*\n\n` +
			`${prefix}alpha <question> — text answer\n` +
			`${prefix}voice <question> — Alpha answers as a voice note\n` +
			`${prefix}img <prompt> — Alpha generates and sends an AI image\n` +
			`${prefix}say <text> — read your exact text aloud\n\n` +
			`Examples:\n` +
			`${prefix}voice explain DNS simply\n` +
			`${prefix}img a boy running in a sunny park\n` +
			`${prefix}say Welcome to the group`,
		);
	}

	if (mode === "image") {
		const prompt = resolveExplicitMediaPrompt(args, extendedMessageOriginal).slice(0, 4000);
		if (!prompt) return reply(`❌ Usage: ${prefix}img <describe the image you want>`);
		const quota = claimImageQuota(senderJid);
		if (!quota.allowed) return reply(`⏳ Image limit reached. Try again in about ${Math.ceil(quota.retryAfterSeconds / 60)} minute(s).`);
		try {
			const image = await generateAlphaImage(prompt);
			return sendMessageWTyping(
				from,
				{ image: image.buffer, caption: `🎨 *Alpha Image*\n${prompt.slice(0, 500)}` },
				{ quoted: msg },
			);
		} catch (error) {
			console.error("[ALPHA_IMAGE]", error.message);
			return reply(`❌ Alpha could not generate that image: ${error.message}`);
		}
	}

	if (mode === "voice-ai") {
		const prompt = resolveExplicitMediaPrompt(args, extendedMessageOriginal).slice(0, 5000);
		if (!prompt) return reply(`❌ Usage: ${prefix}voice <question or instruction>`);
		const quota = claimVoiceQuota(senderJid);
		if (!quota.allowed) return reply(`⏳ Voice-note limit reached. Try again in about ${Math.ceil(quota.retryAfterSeconds / 60)} minute(s).`);
		const aiAllowed = isGroup ? await useSafeAiBudget(from, senderJid).catch(() => true) : true;
		if (!aiAllowed) return reply("⏳ Your Alpha AI limit for today has been reached.");
		try {
			const { text } = await askSafeAi({
				groupJid: isGroup ? from : "direct",
				systemPrompt:
					"You are Alpha answering through a WhatsApp voice note. Answer the user's actual request instead of reading the prompt back. Be accurate, natural, clear, concise and conversational. Do not use markdown because the output will be spoken aloud. Keep the response under about 220 words unless detail is essential. For cybersecurity topics, stay defensive, ethical and authorized-use focused.",
				messages: [{ role: "user", content: prompt }],
			});
			const spoken = String(text || "").replace(/[*_`#]/g, "").trim().slice(0, 2800);
			if (!spoken) throw new Error("AI returned no answer to speak");
			const audio = await generateAlphaVoiceNote(spoken);
			return sendMessageWTyping(
				from,
				{ audio: audio.buffer, mimetype: audio.mimetype, ptt: true },
				{ quoted: msg },
			);
		} catch (error) {
			console.error("[ALPHA_VOICE_AI]", error.message);
			return reply(`❌ Alpha could not answer by voice: ${error.message}`);
		}
	}

	if (mode === "voice-tts") {
		const text = resolveExplicitMediaPrompt(args, extendedMessageOriginal).slice(0, 2800);
		if (!text) return reply(`❌ Add text after ${prefix}${command} or reply to a text message.`);
		const quota = claimVoiceQuota(senderJid);
		if (!quota.allowed) return reply(`⏳ Voice-note limit reached. Try again in about ${Math.ceil(quota.retryAfterSeconds / 60)} minute(s).`);
		try {
			const audio = await generateAlphaVoiceNote(text);
			return sendMessageWTyping(
				from,
				{ audio: audio.buffer, mimetype: audio.mimetype, ptt: true },
				{ quoted: msg },
			);
		} catch (error) {
			console.error("[ALPHA_TTS]", error.message);
			return reply(`❌ Alpha could not create the voice note: ${error.message}`);
		}
	}
};

export default () => ({
	cmd: [
		"aimedia", "mediaai", "aimediahelp",
		...AI_IMAGE_COMMANDS,
		...AI_VOICE_COMMANDS,
		...RAW_TTS_COMMANDS,
	],
	desc: "Explicit Alpha output modes: text with $alpha, AI voice answers with $voice, and AI images with $img",
	usage: "alpha <question> | voice <question> | img <prompt> | say <exact text>",
	handler,
});
