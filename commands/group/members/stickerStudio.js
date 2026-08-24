import { downloadMediaMessage } from "baileys";
import {
	createTextStickerImage,
	imageBufferToSticker,
	removeImageBackground,
} from "../../../utils/mediaStudio.js";

const aiCooldowns = new Map();
const textCooldowns = new Map();

const getImageEnvelope = (msg, extendedMessageOriginal) => {
	if (msg.message?.imageMessage) return msg;
	if (extendedMessageOriginal?.quotedMessage?.imageMessage) {
		return { ...msg, message: extendedMessageOriginal.quotedMessage };
	}
	return null;
};

const handler = async (sock, msg, from, args, msgInfoObj) => {
	const { command, senderJid, sendMessageWTyping, extendedMessageOriginal } = msgInfoObj;
	const reply = (text) => sendMessageWTyping(from, { text }, { quoted: msg });
	const now = Date.now();

	try {
		if (command === "textsticker" || command === "ts") {
			if ((textCooldowns.get(senderJid) || 0) > now) return;
			textCooldowns.set(senderJid, now + 10_000);
			const text = args.join(" ").trim();
			if (!text) return reply("❌ Usage: `textsticker your text here`");
			const png = createTextStickerImage(text);
			const sticker = await imageBufferToSticker(png, {
				pack: "Alpha Text",
				author: "MartechMods2",
			});
			return sendMessageWTyping(from, { sticker }, { quoted: msg });
		}

		if ((aiCooldowns.get(senderJid) || 0) > now) {
			return reply("⏳ AI sticker cooldown: wait one minute before another request.");
		}
		const imageEnvelope = getImageEnvelope(msg, extendedMessageOriginal);
		if (!imageEnvelope) return reply("❌ Send or reply to an image with `aisticker`.");
		if (!process.env.REMOVE_BG_KEY) {
			return reply("❌ AI stickers require `REMOVE_BG_KEY` in the Render environment.");
		}
		aiCooldowns.set(senderJid, now + 60_000);
		const source = await downloadMediaMessage(imageEnvelope, "buffer", {});
		const cutout = await removeImageBackground(source);
		const sticker = await imageBufferToSticker(cutout, {
			pack: args.join(" ").trim().slice(0, 64) || "Alpha AI Cutouts",
			author: "MartechMods2",
			quality: 86,
		});
		return sendMessageWTyping(from, { sticker }, { quoted: msg });
	} catch (error) {
		console.error("Sticker Studio failed:", error.message);
		if (command === "aisticker" || command === "cutoutsticker") aiCooldowns.delete(senderJid);
		return reply(`❌ Sticker generation failed: ${error.message}`);
	}
};

export default () => ({
	cmd: ["aisticker", "cutoutsticker", "textsticker", "ts"],
	desc: "Create AI background-removed or text stickers",
	usage: "aisticker [pack name] (reply to image) | textsticker <text>",
	handler,
});
