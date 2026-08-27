import { getEnhancementSettings, listEnhancementItems } from "../db/enhancementData.js";
import { matchesTriggerPhrase, minuteWithinWindow, safeMemberName } from "./featureSuite.js";

const cache = new Map();
const cooldowns = new Map();
const CACHE_MS = 30_000;
const COOLDOWN_MS = 2 * 60_000;

const activeAtCurrentTime = (hours) => {
	if (!hours) return true;
	const [start, end] = String(hours).split("-");
	if (!start || !end) return true;
	const parts = new Intl.DateTimeFormat("en-GB", {
		timeZone: process.env.BOT_TIMEZONE || "Africa/Lagos",
		hour: "2-digit",
		minute: "2-digit",
		hourCycle: "h23",
	}).formatToParts(new Date());
	const now = Number(parts.find((part) => part.type === "hour")?.value) * 60 + Number(parts.find((part) => part.type === "minute")?.value);
	const toMinutes = (value) => Number(value.slice(0, 2)) * 60 + Number(value.slice(3));
	const startMinutes = toMinutes(start);
	const endMinutes = toMinutes(end);
	return minuteWithinWindow(now, startMinutes, endMinutes);
};

const loadRules = async (groupJid) => {
	const current = cache.get(groupJid);
	if (current?.expires > Date.now()) return current;
	const [settings, rules] = await Promise.all([
		getEnhancementSettings(groupJid),
		listEnhancementItems(groupJid, "autoreply", { status: "active" }, 30),
	]);
	const value = { settings, rules, expires: Date.now() + CACHE_MS };
	cache.set(groupJid, value);
	return value;
};

export const invalidateAdvancedAutomationCache = (groupJid) => cache.delete(groupJid);

export const handleAdvancedAutomation = async ({
	msg,
	groupJid,
	senderJid,
	senderName,
	body,
	isGroup,
	isCommand,
	isFromBot,
	sendMessageWTyping,
}) => {
	if (!isGroup || isCommand || isFromBot || !body || body.length > 700) return { handled: false };
	const { settings, rules } = await loadRules(groupJid);
	if (!settings.autoReplyEnabled || !rules.length || !activeAtCurrentTime(settings.autoReplyHours)) return { handled: false };
	const rule = rules.find((entry) => matchesTriggerPhrase(body, entry.text));
	if (!rule) return { handled: false };
	const key = `${groupJid}:${senderJid}:${rule._id}`;
	const now = Date.now();
	if ((cooldowns.get(key) || 0) > now) return { handled: false };
	cooldowns.set(key, now + COOLDOWN_MS);
	if (cooldowns.size > 5000) for (const [entry, expiry] of cooldowns) if (expiry <= now) cooldowns.delete(entry);
	const name = safeMemberName(senderName, senderJid);
	const response = String(rule.payload?.response || "").replaceAll("{name}", name).slice(0, 1000);
	if (!response) return { handled: false };
	await sendMessageWTyping(groupJid, { text: response }, { quoted: msg });
	return { handled: true };
};
