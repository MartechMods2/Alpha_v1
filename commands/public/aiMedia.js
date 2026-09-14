import { askSafeAi, useSafeAiBudget } from "../../utils/safeAi.js";
import {
	claimImageQuota,
	claimVoiceQuota,
	generateAlphaImage,
	generateAlphaVoiceNote,
} from "../../utils/alphaMediaAi.js";

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

	if (["aimedia", "mediaai", "aimediahelp"].includes(command)) {
		return reply(
			`🎨🎙️ *Alpha AI Media*\n\n` +
			`${prefix}img a boy running in a sunny park\n` +
			`${prefix}voice Welcome to the group\n` +
			`${prefix}voiceask Explain photosynthesis simply\n\n` +
			`You can also reply to text with ${prefix}voice to turn it into a WhatsApp voice note.`,
		);
	}

	if (["img", "imagegen", "drawai", "aipicture"].includes(command)) {
		const prompt = args.join(" ").trim();
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

	if (["voice", "vnote", "say", "speak"].includes(command)) {
		const text = (args.join(" ").trim() || quotedText(extendedMessageOriginal)).slice(0, 2800);
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
			console.error("[ALPHA_VOICE]", error.message);
			return reply(`❌ Alpha could not create the voice note: ${error.message}`);
		}
	}

	if (["voiceask", "askvoice", "aivoice"].includes(command)) {
		const prompt = (args.join(" ").trim() || quotedText(extendedMessageOriginal)).slice(0, 5000);
		if (!prompt) return reply(`❌ Usage: ${prefix}voiceask <question or instruction>`);
		const quota = claimVoiceQuota(senderJid);
		if (!quota.allowed) return reply(`⏳ Voice-note limit reached. Try again in about ${Math.ceil(quota.retryAfterSeconds / 60)} minute(s).`);
		const aiAllowed = isGroup ? await useSafeAiBudget(from, senderJid).catch(() => true) : true;
		if (!aiAllowed) return reply("⏳ Your Alpha AI limit for today has been reached.");
		try {
			const { text } = await askSafeAi({
				groupJid: isGroup ? from : "direct",
				systemPrompt: "You are Alpha speaking in a WhatsApp voice note. Answer the user's request accurately and naturally. Keep the response under about 180 words unless detail is essential. Do not use markdown formatting because the output will be spoken aloud. Stay safe and defensive for cybersecurity topics.",
				messages: [{ role: "user", content: prompt }],
			});
			const spoken = String(text || "").replace(/[*_`#]/g, "").slice(0, 2500);
			if (!spoken) throw new Error("AI returned no text to speak");
			const audio = await generateAlphaVoiceNote(spoken);
			return sendMessageWTyping(
				from,
				{ audio: audio.buffer, mimetype: audio.mimetype, ptt: true },
				{ quoted: msg },
			);
		} catch (error) {
			console.error("[ALPHA_VOICEASK]", error.message);
			return reply(`❌ Alpha could not answer by voice: ${error.message}`);
		}
	}
};

export default () => ({
	cmd: [
		"aimedia", "mediaai", "aimediahelp",
		"img", "imagegen", "drawai", "aipicture",
		"voice", "vnote", "say", "speak",
		"voiceask", "askvoice", "aivoice",
	],
	desc: "Generate AI images directly into WhatsApp and make Alpha send real voice-note replies",
	usage: "img <prompt> | voice <text> | reply + voice | voiceask <question>",
	handler,
});
