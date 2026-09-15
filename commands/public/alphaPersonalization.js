import { getMemberPreferences, setMemberPreferences } from "../../db/members.js";
import { askSafeAi, useSafeAiBudget } from "../../utils/safeAi.js";
import { claimVoiceQuota, generateAlphaVoiceNote } from "../../utils/alphaMediaAi.js";
import {
	ALPHA_TEXT_STYLES,
	ALPHA_VOICE_PROFILES,
	applyAlphaTextStyle,
	getVoiceProfile,
	normalizeTextStyle,
	normalizeVoiceProfile,
} from "../../utils/alphaPresentation.js";

const VOICE_EXAMPLES = Object.freeze({
	default: "balanced",
	man: "adult masculine",
	woman: "adult feminine",
	boy: "youthful light",
	girl: "youthful bright",
	funny: "playful comic",
	deep: "deep grounded",
	calm: "calm reassuring",
	energetic: "upbeat energetic",
	storyteller: "storytelling",
	radio: "radio host",
	nigerian: "natural Nigerian English",
});

const handler = async (_sock, msg, from, args, info) => {
	const { command, prefix = "$", senderJid, isGroup, sendMessageWTyping } = info;
	const reply = (text) => sendMessageWTyping(from, { text }, { quoted: msg });

	if (["alphavoices", "voiceprofiles"].includes(command)) {
		const lines = ALPHA_VOICE_PROFILES.map((name) => `• *${name}* — ${VOICE_EXAMPLES[name] || name}`);
		return reply(
			`🎙️ *Alpha Voice Profiles*\n\n${lines.join("\n")}\n\n` +
			`Set yours: *${prefix}setvoice woman*\n` +
			`Preview: *${prefix}voicepreview funny*\n` +
			`One message only: *${prefix}voice funny explain DNS*\n\n` +
			`_Distinct character voices use the premium speech provider when configured; the Google fallback may sound more generic._`,
		);
	}

	if (["alphafonts", "fontstyles"].includes(command)) {
		const sample = "Alpha keeps the vibe smart 123";
		const previews = ALPHA_TEXT_STYLES.map((style) => `• *${style}* — ${applyAlphaTextStyle(sample, style)}`);
		return reply(
			`✍️ *Alpha Text Styles*\n\n${previews.join("\n")}\n\n` +
			`Set yours: *${prefix}setfont script*\n` +
			`Styled AI answer: *${prefix}stylealpha explain DNS*\n` +
			`Reset: *${prefix}setfont normal*\n\n` +
			`_These are WhatsApp-safe Unicode styles, not downloadable font files. Links, code and @mentions stay readable._`,
		);
	}

	if (command === "setvoice") {
		const requested = String(args[0] || "").toLowerCase();
		if (!ALPHA_VOICE_PROFILES.includes(requested)) {
			return reply(`❌ Choose: ${ALPHA_VOICE_PROFILES.map((name) => `*${name}*`).join(", ")}\nTry *${prefix}alphavoices* for previews.`);
		}
		const next = await setMemberPreferences(senderJid, { voiceProfile: normalizeVoiceProfile(requested) });
		return reply(`🎙️ Alpha voice set to *${next.voiceProfile}*.\nUse *${prefix}voice <question>* and Alpha will keep that profile.`);
	}

	if (command === "voicepreview") {
		const requested = normalizeVoiceProfile(args[0], (await getMemberPreferences(senderJid)).voiceProfile);
		const quota = claimVoiceQuota(senderJid);
		if (!quota.allowed) return reply("⏳ Voice previews are cooling down. Try again shortly.");
		try {
			const profile = getVoiceProfile(requested);
			const audio = await generateAlphaVoiceNote(`Hey, this is Alpha using the ${requested} voice profile. If this vibe works for you, set it as your default.`, profile);
			return sendMessageWTyping(from, { audio: audio.buffer, mimetype: audio.mimetype, ptt: true }, { quoted: msg });
		} catch (error) {
			return reply(`❌ Voice preview failed: ${error.message}`);
		}
	}

	if (command === "setfont") {
		const requested = String(args[0] || "").toLowerCase();
		if (!ALPHA_TEXT_STYLES.includes(requested)) {
			return reply(`❌ Choose: ${ALPHA_TEXT_STYLES.map((name) => `*${name}*`).join(", ")}\nTry *${prefix}alphafonts* for previews.`);
		}
		const next = await setMemberPreferences(senderJid, { textStyle: normalizeTextStyle(requested) });
		return reply(`✍️ Alpha reply style set to *${next.textStyle}*.\n${applyAlphaTextStyle("Alpha AI workflows and stylealpha replies will use this style.", next.textStyle)}`);
	}

	if (command === "stylealpha") {
		const prompt = args.join(" ").trim();
		if (!prompt) return reply(`❌ Use: ${prefix}stylealpha <question>`);
		const allowed = isGroup ? await useSafeAiBudget(from, senderJid).catch(() => true) : true;
		if (!allowed) return reply("⏳ Your Alpha AI limit for today has been reached.");
		try {
			const prefs = await getMemberPreferences(senderJid);
			const { text } = await askSafeAi({
				groupJid: isGroup ? from : "direct",
				systemPrompt: "You are Alpha, a natural WhatsApp assistant. Answer accurately, helpfully and concisely. Do not use markdown # headings. Do not invent facts.",
				messages: [{ role: "user", content: prompt.slice(0, 5000) }],
			});
			return reply(applyAlphaTextStyle(text || "Alpha returned no answer.", prefs.textStyle));
		} catch (error) {
			return reply(`❌ Styled Alpha answer failed: ${error.message}`);
		}
	}

	if (["alphaprefs", "myprefs"].includes(command)) {
		const prefs = await getMemberPreferences(senderJid);
		return reply(
			`⚡ *Your Alpha Preferences*\n\n` +
			`Voice: *${prefs.voiceProfile}*\n` +
			`Text style: *${prefs.textStyle}*\n` +
			`Tone: *${prefs.tone}*\n` +
			`Pronouns: *${prefs.pronouns}*\n\n` +
			`${prefix}setvoice <profile> · ${prefix}setfont <style>`,
		);
	}
};

export default () => ({
	cmd: ["alphavoices", "voiceprofiles", "setvoice", "voicepreview", "alphafonts", "fontstyles", "setfont", "stylealpha", "alphaprefs", "myprefs"],
	desc: "Personalize Alpha voice character and WhatsApp-safe Unicode reply style",
	usage: "alphavoices | setvoice woman | voicepreview funny | alphafonts | setfont script | stylealpha <question> | alphaprefs",
	handler,
});
