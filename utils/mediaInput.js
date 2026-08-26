import { downloadMediaMessage } from "baileys";
import { fileTypeFromBuffer } from "file-type";

const MEDIA_KEYS = ["imageMessage", "videoMessage", "audioMessage", "stickerMessage", "documentMessage"];
const kindFromKey = (key) => key?.replace("Message", "") || null;

export const resolveMediaEnvelope = (msg) => {
	const direct = msg?.message || {};
	const directKey = MEDIA_KEYS.find((key) => direct[key]);
	if (directKey) {
		return {
			envelope: msg,
			key: directKey,
			kind: kindFromKey(directKey),
			node: direct[directKey],
			quoted: false,
		};
	}

	const context = direct.extendedTextMessage?.contextInfo
		|| direct.imageMessage?.contextInfo
		|| direct.videoMessage?.contextInfo
		|| direct.documentMessage?.contextInfo;
	const quotedMessage = context?.quotedMessage || {};
	const quotedKey = MEDIA_KEYS.find((key) => quotedMessage[key]);
	if (!quotedKey) return null;
	return {
		envelope: {
			key: {
				remoteJid: msg.key?.remoteJid,
				id: context.stanzaId,
				participant: context.participant,
				fromMe: Boolean(context.participant && context.participant === msg.key?.remoteJid),
			},
			message: quotedMessage,
		},
		key: quotedKey,
		kind: kindFromKey(quotedKey),
		node: quotedMessage[quotedKey],
		quoted: true,
	};
};

export const downloadResolvedMedia = async (sock, msg, {
	allowedKinds = MEDIA_KEYS.map(kindFromKey),
	maxBytes = 25 * 1024 * 1024,
} = {}) => {
	const resolved = resolveMediaEnvelope(msg);
	if (!resolved || !allowedKinds.includes(resolved.kind)) {
		throw new Error(`Send or reply to ${allowedKinds.join(", ")} media`);
	}
	const ctx = sock?.updateMediaMessage && sock?.logger
		? { reuploadRequest: sock.updateMediaMessage, logger: sock.logger }
		: undefined;
	const buffer = await downloadMediaMessage(resolved.envelope, "buffer", {}, ctx);
	if (!Buffer.isBuffer(buffer) || buffer.length === 0) throw new Error("WhatsApp returned an empty media file");
	if (buffer.length > maxBytes) throw new Error(`Media is larger than ${Math.ceil(maxBytes / 1024 / 1024)}MB`);
	const detected = await fileTypeFromBuffer(buffer).catch(() => null);
	return {
		...resolved,
		buffer,
		mime: detected?.mime || resolved.node?.mimetype || "application/octet-stream",
		extension: detected?.ext || String(resolved.node?.mimetype || "").split("/")[1]?.split(";")[0] || "bin",
		duration: Number(resolved.node?.seconds || 0),
	};
};

export const quotedText = (msg) => {
	const context = msg?.message?.extendedTextMessage?.contextInfo;
	const quoted = context?.quotedMessage || {};
	return String(
		quoted.conversation
		|| quoted.extendedTextMessage?.text
		|| quoted.imageMessage?.caption
		|| quoted.videoMessage?.caption
		|| "",
	).trim();
};
