import { askSafeAi, useSafeAiBudget } from "../../utils/safeAi.js";
import { getMemberPreferences } from "../../db/members.js";
import {
	claimImageQuota,
	claimVoiceQuota,
	generateAlphaImage,
	generateAlphaVoiceNote,
	imageProviderStatus,
} from "../../utils/alphaMediaAi.js";
import {
	getVoiceProfile,
	parseVoiceProfileArgs,
} from "../../utils/alphaPresentation.js";
import {
	AI_IMAGE_COMMANDS,
	AI_VOICE_COMMANDS,
	MEDIA_HELP_COMMANDS,
	RAW_TTS_COMMANDS,
	classifyAlphaMediaCommand,
	resolveExplicitMediaPrompt,
} from "../../utils/explicitMediaMode.js";

const IMAGE_STATUS_COMMANDS = ["imgstatus", "imagestatus"];

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

	if (IMAGE_STATUS_COMMANDS.includes(command)) {
		const status = imageProviderStatus();
		const ready = status.openai || status.pollinations;
		return reply(
			`🎨 *Alpha Image Status*\n\n` +
			`Overall: *${ready ? "READY ✅" : "NOT CONFIGURED ❌"}*\n` +
			`OpenAI: *${status.openai ? "configured" : "missing key"}* — ${status.openaiModel}\n` +
			`Pollinations fallback: *${status.pollinations ? "configured" : "missing key"}* — ${status.pollinationsModel}\n\n` +
			`${ready ? `Try *${prefix}img a futuristic Lagos skyline at night*` : "Admin: configure OPENAI_API_KEY or POLLINATIONS_API_KEY on the host, then restart Alpha."}`,
		);
	}

	if (mode === "help") {
		return reply(
			`⚡ *Alpha Explicit AI Modes*\n\n` +
			`${prefix}alpha <question> — text answer\n` +
			`${prefix}voice <question> — Alpha answers as a voice note\n` +
			`${prefix}voice woman <question> — one-off voice profile\n` +
			`${prefix}img <prompt> — Alpha generates and sends an AI image\n` +
			`${prefix}imgstatus — check image providers\n` +
			`${prefix}say <text> — read your exact text aloud\n\n` +
			`Examples:\n` +
			`${prefix}voice explain DNS simply\n` +
			`${prefix}voice funny explain gravity\n` +
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
				{ image: image.buffer, mimetype: image.mimetype, caption: `🎨 *Alpha Image*\n${prompt.slice(0, 500)}` },
				{ quoted: msg },
			);
		} catch (error) {
			console.error("[ALPHA_IMAGE]", error.message);
			return reply(`❌ Alpha could not generate that image.\n${error.message}\n\nCheck *${prefix}imgstatus*.`);
		}
	}

	if (mode === "voice-ai") {
		const preferences = await getMemberPreferences(senderJid).catch(() => ({ voiceProfile: "default" }));
		const parsedVoice = parseVoiceProfileArgs(args, preferences.voiceProfile);
		const profile = getVoiceProfile(parsedVoice.profile);
		const prompt = resolveExplicitMediaPrompt(parsedVoice.args, extendedMessageOriginal).slice(0, 5000);
		if (!prompt) return reply(`❌ Usage: ${prefix}voice [profile] <question or instruction>`);
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
			const audio = await generateAlphaVoiceNote(spoken, profile);
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
		const preferences = await getMemberPreferences(senderJid).catch(() => ({ voiceProfile: "default" }));
		const parsedVoice = parseVoiceProfileArgs(args, preferences.voiceProfile);
		const profile = getVoiceProfile(parsedVoice.profile);
		const text = resolveExplicitMediaPrompt(parsedVoice.args, extendedMessageOriginal).slice(0, 2800);
		if (!text) return reply(`❌ Add text after ${prefix}${command} or reply to a text message.`);
		const quota = claimVoiceQuota(senderJid);
		if (!quota.allowed) return reply(`⏳ Voice-note limit reached. Try again in about ${Math.ceil(quota.retryAfterSeconds / 60)} minute(s).`);
		try {
			const audio = await generateAlphaVoiceNote(text, profile);
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
		...MEDIA_HELP_COMMANDS,
		...AI_IMAGE_COMMANDS,
		...AI_VOICE_COMMANDS,
		...RAW_TTS_COMMANDS,
		...IMAGE_STATUS_COMMANDS,
	],
	desc: "Explicit Alpha output modes with image diagnostics and configurable voice profiles",
	usage: "alpha <question> | voice [profile] <question> | img <prompt> | imgstatus | say [profile] <exact text>",
	handler,
});
