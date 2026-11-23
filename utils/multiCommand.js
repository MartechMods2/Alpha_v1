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
	return command ? { raw: clean, command, args: tokens, evv: tokens.join(" "), inputText: content.slice(content.match(/^\S+/)[0].length).trimStart() } : null;
};

export const parseCommandChain = (body, prefix = "$", maxCommands = 6) => {
	const p = String(prefix || "$");
	const text = String(body || "").trim();
	if (!text.startsWith(p)) return { commands: [], truncated: false };
    const rawParts = [];
    let start = 0, quote = null;
    for (let i = 0; i < text.length; i++) {
        const char = text[i];
        if (char === "\\") { i++; continue; }
        if (quote) { if (char === quote) quote = null; continue; }
        if (char === "`" || ((char === '"' || char === "'") && (i === 0 || /\s/.test(text[i - 1])))) {
            quote = char; continue;
        }
        if (![",", ";", "\n"].includes(char)) continue;
        let next = i + 1;
        while (/\s/.test(text[next] || "") && next < text.length) next++;
        if (!text.startsWith(p, next)) continue;
        rawParts.push(text.slice(start, i).trim());
        start = next; i = next - 1;
    }
    rawParts.push(text.slice(start).trim());
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
	if (!wanted.length) return { ...context, mentionedJid: [] };
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
	return { ...context, mentionedJid: ordered };
};

// Preserve quoted/media context while giving each handler only its own input.
export const messageForCommandSegment = (msg, segment, type) => {
 const message = { ...msg.message };
 if (type === 'conversation') message.conversation = segment.raw;
 else {
  const original = message[type] || {};
  const field = type === 'extendedTextMessage' ? 'text' :
    ['buttonsResponseMessage', 'templateButtonReplyMessage'].includes(type) ? 'selectedDisplayText' :
    type === 'listResponseMessage' ? 'title' : 'caption';
  message[type] = { ...original, [field]: segment.raw,
   ...(original.contextInfo ? {contextInfo: contextForCommandSegment(segment, original.contextInfo)} : {}) };
 }
 return { ...msg, message };
};

export const runCommandSegments = async (segments, dispatch, onError) => {
 for (const [index, segment] of segments.entries()) {
  try { await dispatch(segment, index); }
  catch { await onError(segment); }
 }
};
