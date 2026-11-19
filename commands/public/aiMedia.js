import { premiumReply } from "../../utils/premiumReplies.js";
import { askSafeAi } from "../../utils/safeAi.js";
import { claimAlphaGroupAiUsage, refundAlphaGroupAiUsage } from "../../utils/alphaQuota.js";
import { alphaPublicFailureMessage, notifyAlphaOwnerFailure } from "../../utils/alphaErrorReporter.js";
import { getMemberPreferences } from "../../db/members.js";
import {
	claimImageQuota,
	claimVoiceQuota,
	generateAlphaVoiceNote,
} from "../../utils/alphaMediaAi.js";
import { generateAlphaImage, imageProviderStatus } from "../../utils/alphaImage.js";
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

const handler = async (sock, msg, from, args, info) => {
	const {
		command,
		prefix = "$",
		senderJid,
		isGroup,
		isOwner,
		groupMetadata,
		extendedMessageOriginal,
		sendMessageWTyping,
	} = info;
	const reply = (text) => sendMessageWTyping(from, { text }, { quoted: msg });
	const mode = classifyAlphaMediaCommand(command);

	if (IMAGE_STATUS_COMMANDS.includes(command)) {
		const status = imageProviderStatus();
        const ready = status.preferredProvider === "cloudflare" ? status.cloudflare :
          status.preferredProvider === "openai" ? status.openai : status.preferredProvider === "gemini" ? status.gemini : status.preferredProvider === "pollinations" ? status.pollinations : status.cloudflare || status.openai || status.gemini || status.pollinations;
        const missing = status.preferredProvider === "cloudflare" ? status.cloudflareMissing.join(" and ") :
          status.preferredProvider === "gemini" ? "GOOGLE_API_KEY" : status.preferredProvider === "openai" ? "OPENAI_API_KEY" : status.preferredProvider === "pollinations" ? "POLLINATIONS_API_KEY" : "the selected provider credentials";
        return reply(
          `🎨 *Image Studio*\n\n` +
          `Primary provider: *${status.preferredProvider}*\n` +
          `Cloudflare: *${status.cloudflare ? "credentials configured" : "setup required"}*\n` +
          `Model: ${status.cloudflareModel}\n` +
          `Paid-provider fallback: *${status.fallbackEnabled ? "enabled" : "disabled"}*\n\n` +
          (ready ? `Credentials are configured; generation availability depends on provider quota.\nTry *${prefix}img a futuristic Lagos skyline at night*` :
            `Admin: add ${missing} in Render, then redeploy. No API token should be posted in chat.`)
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
		let quotaClaim = null;
		if (isGroup) {
			quotaClaim = await claimAlphaGroupAiUsage({
				groupJid: from,
				senderJid,
				memberName: msg?.pushName || "",
				groupMetadata,
				isOwner,
				candidates: [msg?.key?.participantPn, msg?.key?.participantAlt],
			});
			if (!quotaClaim.allowed) return reply(`⏳ Your Alpha AI limit for today has been reached (*${quotaClaim.used}/${quotaClaim.limit}*).`);
		}
		let generated = false;
		try {
			const image = await generateAlphaImage(prompt);
			generated = true;
			return sendMessageWTyping(
				from,
				{ image: image.buffer, mimetype: image.mimetype, caption: premiumReply(`🎨 *Image ready*\n\n${prompt.slice(0, 500)}`) },
				{ quoted: msg },
			);
		} catch (error) {
			if (quotaClaim?.charged && !generated) await refundAlphaGroupAiUsage(quotaClaim).catch(() => {});
			console.error("[ALPHA_IMAGE]", error.message);
			notifyAlphaOwnerFailure({
				sock,
				scope: "image-generation",
				error,
				groupName: isGroup ? (groupMetadata?.subject || "") : "",
				senderName: msg?.pushName || "",
			});
			return reply(`${alphaPublicFailureMessage("image")}\nCheck *${prefix}imgstatus* if you are the administrator.`);
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
		let quotaClaim = null;
		if (isGroup) {
			quotaClaim = await claimAlphaGroupAiUsage({
				groupJid: from,
				senderJid,
				memberName: msg?.pushName || "",
				groupMetadata,
				isOwner,
				candidates: [msg?.key?.participantPn, msg?.key?.participantAlt],
			});
			if (!quotaClaim.allowed) return reply(`⏳ Your Alpha AI limit for today has been reached (*${quotaClaim.used}/${quotaClaim.limit}*).`);
		}
		let providerSucceeded = false;
		try {
			const { text } = await askSafeAi({
				groupJid: isGroup ? from : "direct",
				systemPrompt:
					"You are Alpha answering through a WhatsApp voice note. Answer the user's actual request instead of reading the prompt back. Be accurate, natural, clear, concise and conversational. Do not use markdown because the output will be spoken aloud. Keep the response under about 220 words unless detail is essential. For cybersecurity topics, stay defensive, ethical and authorized-use focused.",
				messages: [{ role: "user", content: prompt }],
			});
			providerSucceeded = true;
			const spoken = String(text || "").replace(/[*_`#]/g, "").trim().slice(0, 2800);
			if (!spoken) throw new Error("AI returned no answer to speak");
			const audio = await generateAlphaVoiceNote(spoken, profile);
			return sendMessageWTyping(
				from,
				{ audio: audio.buffer, mimetype: audio.mimetype, ptt: true },
				{ quoted: msg },
			);
		} catch (error) {
			if (quotaClaim?.charged && !providerSucceeded) await refundAlphaGroupAiUsage(quotaClaim).catch(() => {});
			console.error("[ALPHA_VOICE_AI]", error.message);
			notifyAlphaOwnerFailure({
				sock,
				scope: "voice-ai",
				error,
				groupName: isGroup ? (groupMetadata?.subject || "") : "",
				senderName: msg?.pushName || "",
			});
			return reply(alphaPublicFailureMessage("voice"));
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
			notifyAlphaOwnerFailure({
				sock,
				scope: "voice-tts",
				error,
				groupName: isGroup ? (groupMetadata?.subject || "") : "",
				senderName: msg?.pushName || "",
			});
			return reply(alphaPublicFailureMessage("voice"));
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
	desc: "Explicit Alpha output modes with multi-provider image generation and configurable voice profiles",
	usage: "alpha <question> | voice [profile] <question> | img <prompt> | imgstatus | say [profile] <exact text>",
	handler,
});
