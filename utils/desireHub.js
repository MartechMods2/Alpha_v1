import { getGroupData } from "../db/groupData.js";
import { askSafeAi } from "./safeAi.js";
import { claimAlphaGroupAiUsage, refundAlphaGroupAiUsage } from "./alphaQuota.js";
import { generateSocialGamePrompt } from "./socialGameGenerator.js";
import { addGroupWarning, clearGroupWarnings } from "./moderation.js";
import { getGroupSafetySettings } from "./groupSafety.js";
import { extractPhoneNumber } from "./lid.js";

const states = new Map();
const consentCooldowns = new Map();
const MAX_GROUPS = 300;
const MAX_RECENT = 12;
const STATE_TTL_MS = 2 * 60 * 60_000;
const CONSENT_COOLDOWN_MS = 6 * 60 * 60_000;

const clean = (value, max = 300) => String(value || "").replace(/\s+/g, " ").trim().slice(0, max);
const consentSolicitation = /(?:^|\b)(?:nudes?\??|send\s+(?:me\s+)?nudes?|drop\s+nudes?|send\s+(?:me\s+)?(?:naked|explicit)\s+(?:pics?|photos?)|show\s+(?:me\s+)?(?:your\s+)?(?:nudes?|naked\s+(?:pics?|photos?)))(?:\b|$)/i;
const pressureSignal = /\b(?:no\s+means\s+yes|keep\s+asking|she'?ll\s+agree|he'?ll\s+agree|don'?t\s+take\s+no|why\s+won'?t\s+you\s+send)\b/i;

const prune = (now = Date.now()) => {
	for (const [jid, state] of states) if (now - state.touchedAt > STATE_TTL_MS) states.delete(jid);
	if (states.size > MAX_GROUPS) {
		const extra = [...states.entries()].sort((a, b) => a[1].touchedAt - b[1].touchedAt).slice(0, states.size - MAX_GROUPS);
		for (const [jid] of extra) states.delete(jid);
	}
	if (consentCooldowns.size > 2000) {
		for (const [key, expires] of consentCooldowns) if (expires <= now) consentCooldowns.delete(key);
	}
};

export const recordDesireActivity = ({ groupJid, senderJid, body, at = Date.now() }) => {
	if (!groupJid?.endsWith("@g.us") || !senderJid) return;
	let state = states.get(groupJid);
	if (!state) {
		state = { recent: [], touchedAt: at };
		states.set(groupJid, state);
	}
	state.touchedAt = at;
	const text = clean(body, 180);
	if (text) {
		state.recent.push({ at, sender: senderJid, text, boundary: consentSolicitation.test(text) || pressureSignal.test(text) });
		if (state.recent.length > MAX_RECENT) state.recent.splice(0, state.recent.length - MAX_RECENT);
	}
	if (states.size > MAX_GROUPS + 20) prune(at);
};

export const getDesireVibe = (groupJid, now = Date.now()) => {
	const state = states.get(groupJid);
	const recent = (state?.recent || []).filter((item) => item.at >= now - 10 * 60_000);
	const unique = new Set(recent.map((item) => item.sender)).size;
	const boundaryFlags = recent.filter((item) => item.boundary).length;
	const energy = recent.length === 0 ? 1 : Math.min(10, Math.max(1, Math.round(1 + recent.length * 0.55 + unique * 1.2)));
	let label = "Quiet mode. Somebody drop gist. 👀";
	if (energy >= 9) label = boundaryFlags ? "Energy is mad, but boundaries need attention. 🌚" : "Banter heavy. Everybody is outside today. 🔥";
	else if (energy >= 7) label = boundaryFlags ? "Vibe is active; keep the flirting respectful." : "Good energy. Gist is moving nicely. 😮‍💨🔥";
	else if (energy >= 4) label = "Warm enough. One dangerous topic and this place wakes up. 😂";
	return { energy, messages: recent.length, participants: unique, boundaryFlags, label };
};

export const formatVibeCheck = (groupJid) => {
	const vibe = getDesireVibe(groupJid);
	const boundary = vibe.boundaryFlags
		? `${vibe.boundaryFlags} recent boundary flag(s) noticed — keep it consensual.`
		: "No obvious boundary flags in Alpha's recent sample.";
	return `🌚 *VIBE CHECK*\n\nEnergy: *${vibe.energy}/10*\n${vibe.label}\n${boundary}\n\n_${vibe.messages} recent messages · ${vibe.participants} active people_`;
};

export const generateRizzReplies = async ({
	groupJid,
	senderJid,
	context,
	groupMetadata,
	isOwner = false,
	memberName = "",
	candidates = [],
}) => {
	const input = clean(context, 1000);
	if (!input) return "🌚 Give me what they said. Example: `$rizz she said come find out`.";

	const quotaClaim = await claimAlphaGroupAiUsage({
		groupJid,
		senderJid,
		memberName,
		groupMetadata,
		isOwner,
		candidates,
	});
	if (!quotaClaim.allowed) return `⏳ Your Alpha AI limit for today has been reached (*${quotaClaim.used}/${quotaClaim.limit}*).`;

	try {
		const { text } = await askSafeAi({
			groupJid,
			systemPrompt: "You are Alpha's RIZZ Coach for a Nigerian WhatsApp social group. Give exactly three short reply options labelled Playful, Smooth, and Sweet. Keep them witty, confident, non-explicit, consensual, age-neutral, and never manipulative or pressuring. Do not encourage harassment, stalking, sexual coercion, or repeated pursuit after rejection. Maximum 18 words per option. Sound natural, not corporate.",
			messages: [{ role: "user", content: input }],
		});
		return `🫦 *RIZZ COACH*\n\n${String(text || "").trim().slice(0, 1200)}`;
	} catch (error) {
		await refundAlphaGroupAiUsage(quotaClaim).catch(() => {});
		console.warn("[DESIRE RIZZ]", error.message);
		return `🫦 *RIZZ COACH*\n\n*Playful:* “Come find out” is doing a lot of work there 😂\n*Smooth:* Careful, I might actually take you seriously.\n*Sweet:* I like your confidence. Now you've got my attention. 🌚`;
	}
};

export const generateDesireGame = async ({ groupJid, type, quotaInput = null }) => {
	const requested = String(type || "").toLowerCase().replace(/[\s_-]+/g, "");
	if (["2truths", "2truthsalie", "twotruths", "twotruthsandalie"].includes(requested)) {
		return "🎭 *2 TRUTHS & A LIE*\n\nDrop three short statements about yourself — two true, one lie. Label them A, B, C. Everybody guesses. 🌚";
	}
	const map = {
		wouldyourather: "wyr", wyr: "wyr", truth: "truth", dare: "dare", icebreaker: "icebreaker",
	};
	const gameType = map[requested];
	if (!gameType) return "🎮 Try `$game 2truths`, `$game wouldyourather`, `$game truth`, `$game dare`, or `$game icebreaker`.";
	const prompt = await generateSocialGamePrompt({ groupJid, type: gameType, quotaInput });
	const title = gameType === "wyr" ? "WOULD YOU RATHER?" : gameType.toUpperCase();
	return `🎮 *${title}*\n\n${clean(prompt, 800)}\n\n_No pressure. Skip anything you don't want to answer._`;
};

export const maybeSendConsentReminder = async ({ sock, groupJid, senderJid, body }) => {
	const text = clean(body, 500);
	if (!senderJid || !consentSolicitation.test(text)) return false;
	const groupData = await getGroupData(groupJid).catch(() => null);
	if (!groupData?.desireHubEnabled || groupData.desireConsentGateEnabled === false) return false;
	const key = `${groupJid}:${senderJid}`;
	const now = Date.now();
	if ((consentCooldowns.get(key) || 0) > now) return false;
	consentCooldowns.set(key, now + CONSENT_COOLDOWN_MS);
	prune(now);
	await sock.sendMessage(senderJid, {
		text: "🌚 Quick one from Alpha: *Rule 4 — no unsolicited explicit content.* Ask first and respect the answer. Keep the vibe fun, not uncomfortable.",
	}).catch((error) => console.warn("[DESIRE CONSENT DM]", error.message));
	return true;
};

export const warnDesireMember = async ({ sock, msg, groupJid, memberJid, groupData, isBotAdmin, sendMessageWTyping, reason }) => {
	const settings = getGroupSafetySettings(groupData);
	const count = await addGroupWarning(groupJid, memberJid);
	const atLimit = count >= settings.warningLimit;
	let removed = false;
	if (atLimit && settings.warningAction === "remove" && isBotAdmin) {
		try {
			await sock.groupParticipantsUpdate(groupJid, [memberJid], "remove");
			await clearGroupWarnings(groupJid, memberJid);
			removed = true;
		} catch (error) {
			console.warn("[DESIRE WARN REMOVE]", error.message);
		}
	}
	const phone = extractPhoneNumber(memberJid);
	const reasonText = clean(reason, 90);
	let text = `🌚 @${phone}, respect boundaries. No means no. *Warning ${count}/${settings.warningLimit}.*`;
	if (reasonText && reasonText.toLowerCase() !== "admin warning") text += `\n_${reasonText}_`;
	if (atLimit && !removed) text += "\nLast warning. Admin review next. 🫡";
	if (removed) text = `🚪 @${phone}, boundary crossed too many times. You're out.`;
	await sendMessageWTyping(groupJid, { text, mentions: [memberJid] }, { quoted: msg });
	return { count, limit: settings.warningLimit, atLimit, removed };
};

export const desireRuntimeStats = () => ({ trackedGroups: states.size, maxGroups: MAX_GROUPS, recentPerGroup: MAX_RECENT });
