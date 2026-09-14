import { extractPhoneNumber } from "./lid.js";

const escapeRegex = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export const extractMessageBody = (msg) => {
	const m = msg?.message || {};
	const value =
		m.conversation ??
		m.imageMessage?.caption ??
		m.videoMessage?.caption ??
		m.extendedTextMessage?.text ??
		m.buttonsResponseMessage?.selectedDisplayText ??
		m.templateButtonReplyMessage?.selectedDisplayText ??
		m.listResponseMessage?.title ??
		m.documentMessage?.caption ??
		m.audioMessage?.caption ??
		"";
	return String(value).trim();
};

export const parseCommandSegment = (raw, prefix = "$") => {
	const clean = String(raw || "").trim();
	const p = String(prefix || "$");
	if (!clean.startsWith(p)) return null;
	const content = clean.slice(p.length).trim();
	if (!content) return null;
	const tokens = content.split(/\s+/).filter(Boolean);
	const command = String(tokens.shift() || "").toLowerCase();
	return command ? { raw: clean, command, args: tokens, evv: tokens.join(" ") } : null;
};

export const parseCommandChain = (body, prefix = "$", maxCommands = 6) => {
	const p = String(prefix || "$");
	const text = String(body || "").trim();
	if (!text.startsWith(p)) return { commands: [], truncated: false };
	const boundary = new RegExp(`\\s*(?:,|;|\\n)\\s*(?=${escapeRegex(p)})`, "g");
	const rawParts = text.split(boundary).map((part) => part.trim()).filter(Boolean);
	const parsed = rawParts.map((part) => parseCommandSegment(part, p)).filter(Boolean);
	const safeLimit = Math.min(8, Math.max(1, Number(maxCommands) || 6));
	return {
		commands: parsed.slice(0, safeLimit),
		truncated: parsed.length > safeLimit,
	};
};

const numberOf = (jid) => {
	try { return String(extractPhoneNumber(jid) || "").replace(/\D/g, ""); }
	catch { return String(jid || "").replace(/\D/g, ""); }
};

export const contextForCommandSegment = (segment, context = {}) => {
	if (!segment?.raw || !context) return context;
	const wanted = [...String(segment.raw).matchAll(/@([0-9]{5,20})/g)].map((match) => match[1]);
	if (!wanted.length) return context;
	const original = Array.isArray(context.mentionedJid)
		? context.mentionedJid
		: context.mentionedJid
			? [context.mentionedJid]
			: [];
	if (!original.length) return context;
	const ordered = [];
	for (const wantedNumber of wanted) {
		for (const jid of original) {
			const candidate = numberOf(jid);
			if (!candidate) continue;
			if (candidate === wantedNumber || candidate.endsWith(wantedNumber) || wantedNumber.endsWith(candidate)) {
				if (!ordered.includes(jid)) ordered.push(jid);
			}
		}
	}
	return ordered.length ? { ...context, mentionedJid: ordered } : context;
};
