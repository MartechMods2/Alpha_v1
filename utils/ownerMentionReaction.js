import { isSameGroupUser } from "./groupParticipants.js";

export const OWNER_MENTION_REACTIONS = Object.freeze(["👑", "⚡"]);
const OWNER_ALIAS_CACHE_MS = 10 * 60_000;
const ownerMetadataCache = new Map();

const digits = (value) => String(value || "").replace(/[^0-9]/g, "");

export const configuredOwnerJids = (raw = process.env.MY_NUMBER || "") =>
	String(raw)
		.split(",")
		.map(digits)
		.filter(Boolean)
		.map((number) => `${number}@s.whatsapp.net`);

export const ownerMentionContext = (msg = {}) => {
	const m = msg.message || {};
	return (
		m.extendedTextMessage?.contextInfo ||
		m.imageMessage?.contextInfo ||
		m.videoMessage?.contextInfo ||
		m.documentMessage?.contextInfo ||
		m.audioMessage?.contextInfo ||
		{}
	);
};

export const ownerMentionedJids = (msg = {}) => {
	const mentioned = ownerMentionContext(msg)?.mentionedJid;
	return Array.isArray(mentioned) ? mentioned.filter(Boolean) : mentioned ? [mentioned] : [];
};

export const ownerMentionBody = (msg = {}) => {
	const m = msg.message || {};
	return String(
		m.conversation ||
		m.extendedTextMessage?.text ||
		m.imageMessage?.caption ||
		m.videoMessage?.caption ||
		m.documentMessage?.caption ||
		"",
	).trim();
};

export const hasTypedMartechMention = (body = "") => /(^|\s)@martech\b/i.test(String(body));

const sameDigits = (left, right) => {
	const a = digits(String(left || "").split("@")[0]);
	const b = digits(String(right || "").split("@")[0]);
	return Boolean(a && b && a === b);
};

export const isOwnerMention = ({ mentionedJids = [], ownerJids = [], metadata = null } = {}) =>
	mentionedJids.some((mentioned) => ownerJids.some((owner) => {
		if (sameDigits(mentioned, owner)) return true;
		if (!metadata?.participants?.length) return false;
		return isSameGroupUser(metadata, mentioned, owner);
	}));

export const pickOwnerMentionReaction = (messageId = "") => {
	let hash = 0;
	for (const char of String(messageId)) hash = ((hash * 31) + char.charCodeAt(0)) >>> 0;
	return OWNER_MENTION_REACTIONS[hash % OWNER_MENTION_REACTIONS.length];
};

const metadataWithTimeout = async (sock, groupJid) => {
	const cached = ownerMetadataCache.get(groupJid);
	if (cached && cached.expiresAt > Date.now()) return cached.metadata;
	try {
		const metadata = await Promise.race([
			sock.groupMetadata(groupJid),
			new Promise((_, reject) => setTimeout(() => reject(new Error("owner mention metadata timeout")), 1500)),
		]);
		if (metadata?.participants?.length) ownerMetadataCache.set(groupJid, { metadata, expiresAt: Date.now() + OWNER_ALIAS_CACHE_MS });
		return metadata;
	} catch {
		return cached?.metadata || null;
	}
};

export const handleOwnerMentionReaction = async (sock, msg) => {
	const groupJid = msg?.key?.remoteJid;
	if (!sock?.user || !msg?.message || msg?.key?.fromMe || !groupJid?.endsWith("@g.us")) return false;

	const body = ownerMentionBody(msg);
	const mentionedJids = ownerMentionedJids(msg);
	const typedMartech = hasTypedMartechMention(body);
	if (!typedMartech && !mentionedJids.length) return false;

	const ownerJids = configuredOwnerJids();
	let mentionedOwner = isOwnerMention({ mentionedJids, ownerJids });
	if (!mentionedOwner && mentionedJids.length && ownerJids.length) {
		const metadata = await metadataWithTimeout(sock, groupJid);
		mentionedOwner = isOwnerMention({ mentionedJids, ownerJids, metadata });
	}
	if (!typedMartech && !mentionedOwner) return false;

	const reaction = pickOwnerMentionReaction(msg?.key?.id || `${groupJid}:${body}`);
	try {
		await sock.sendMessage(groupJid, { react: { text: reaction, key: msg.key } });
		return true;
	} catch (error) {
		console.warn("Owner mention reaction failed:", error.message);
		return false;
	}
};
