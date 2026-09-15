import { clearAfkStatus, getGroupAfkStatuses } from "../db/productivityData.js";
import { formatElapsed, safeDisplayName } from "./groupProductivity.js";

const groupCache = new Map();
const noticeCooldown = new Map();
const CACHE_TTL_MS = 120_000;
const NOTICE_TTL_MS = 90_000;

const senderOf = (msg) => msg?.key?.participantPn || msg?.key?.participant || msg?.key?.participantAlt || "";
const contextOf = (msg) => msg?.message?.extendedTextMessage?.contextInfo || msg?.message?.imageMessage?.contextInfo || msg?.message?.videoMessage?.contextInfo || msg?.message?.documentMessage?.contextInfo || {};

const aliases = (jid) => {
	const value = String(jid || "");
	const local = value.split("@")[0].replace(/\D/g, "");
	return new Set([value, local].filter(Boolean));
};

const sameUser = (a, b) => {
	const aa = aliases(a);
	const bb = aliases(b);
	for (const item of aa) if (bb.has(item)) return true;
	return false;
};

const loadStatuses = async (groupJid, force = false) => {
	const cached = groupCache.get(groupJid);
	const now = Date.now();
	if (!force && cached && cached.expiresAt > now) return cached.items;
	const items = await getGroupAfkStatuses(groupJid).catch(() => []);
	groupCache.set(groupJid, { items, expiresAt: now + CACHE_TTL_MS });
	if (groupCache.size > 400) for (const [key, value] of groupCache) if (value.expiresAt <= now) groupCache.delete(key);
	return items;
};

export const invalidateAfkGroupCache = (groupJid) => groupCache.delete(groupJid);

const referencedMembers = (msg) => {
	const context = contextOf(msg);
	const mentioned = Array.isArray(context.mentionedJid) ? context.mentionedJid : context.mentionedJid ? [context.mentionedJid] : [];
	if (context.participant) mentioned.push(context.participant);
	return [...new Set(mentioned.filter(Boolean))].slice(0, 8);
};

export const handleAfkPresence = async (sock, msg) => {
	const groupJid = msg?.key?.remoteJid;
	if (!groupJid?.endsWith("@g.us") || msg?.key?.fromMe) return false;
	const senderJid = senderOf(msg);
	if (!senderJid) return false;
	const refs = referencedMembers(msg);
	const statuses = await loadStatuses(groupJid);
	const senderAfk = statuses.find((item) => sameUser(item.memberJid, senderJid));

	if (senderAfk) {
		await clearAfkStatus(groupJid, senderAfk.memberJid).catch(() => null);
		invalidateAfkGroupCache(groupJid);
		const since = new Date(senderAfk.since || senderAfk.createdAt || Date.now()).getTime();
		await sock.sendMessage(groupJid, {
			text: `👋 Welcome back, @${senderJid.split("@")[0]}. You were away for ${formatElapsed(since)}.`,
			mentions: [senderJid],
		}, { quoted: msg }).catch(() => null);
	}

	if (!refs.length) return false;
	const away = statuses.filter((status) => refs.some((jid) => sameUser(status.memberJid, jid)) && !sameUser(status.memberJid, senderJid)).slice(0, 4);
	if (!away.length) return false;
	const now = Date.now();
	const visible = away.filter((status) => {
		const key = `${groupJid}:${senderJid}:${status.memberJid}`;
		if ((noticeCooldown.get(key) || 0) > now) return false;
		noticeCooldown.set(key, now + NOTICE_TTL_MS);
		return true;
	});
	if (!visible.length) return false;
	if (noticeCooldown.size > 2000) for (const [key, expires] of noticeCooldown) if (expires <= now) noticeCooldown.delete(key);
	const lines = visible.map((status) => {
		const since = new Date(status.since || status.createdAt || now).getTime();
		return `🌙 @${status.memberJid.split("@")[0]} is AFK (${formatElapsed(since)}): ${String(status.reason || "Away for a bit").slice(0, 180)}`;
	});
	await sock.sendMessage(groupJid, { text: lines.join("\n"), mentions: visible.map((status) => status.memberJid) }, { quoted: msg }).catch(() => null);
	return false;
};

export const afkRuntimeStats = () => ({ cachedGroups: groupCache.size, noticeCooldowns: noticeCooldown.size });
