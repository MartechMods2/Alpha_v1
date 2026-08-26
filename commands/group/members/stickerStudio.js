import {
	createTextStickerImage,
	imageBufferToSticker,
	removeImageBackground,
} from "../../../utils/mediaStudio.js";
import { downloadResolvedMedia, quotedText } from "../../../utils/mediaInput.js";
import { runMediaJob } from "../../../utils/mediaJobs.js";

const aiCooldowns = new Map();
const textCooldowns = new Map();

const handler = async (sock, msg, from, args, msgInfoObj) => {
	const { command, senderJid, sendMessageWTyping } = msgInfoObj;
	const reply = (text) => sendMessageWTyping(from, { text }, { quoted: msg });
	const now = Date.now();

	try {
		if (["textsticker", "ts", "reactionsticker"].includes(command)) {
			if ((textCooldowns.get(senderJid) || 0) > now) return;
			textCooldowns.set(senderJid, now + 10_000);
			const text = command === "reactionsticker" ? quotedText(msg) : args.join(" ").trim();
			if (!text) return reply("❌ Usage: `textsticker your text here`");
			const sticker = await runMediaJob({
				feature: command,
				groupJid: from,
				senderJid,
				task: async () => imageBufferToSticker(createTextStickerImage(text), {
					pack: command === "reactionsticker" ? "Alpha Reactions" : "Alpha Text",
					author: "MartechMods2",
				}),
			});
			return sendMessageWTyping(from, { sticker }, { quoted: msg });
		}

		if ((aiCooldowns.get(senderJid) || 0) > now) {
			return reply("⏳ AI sticker cooldown: wait one minute before another request.");
		}
		let imageMedia;
		try {
			imageMedia = await downloadResolvedMedia(sock, msg, { allowedKinds: ["image"], maxBytes: 10 * 1024 * 1024 });
		} catch (error) {
			return reply(`❌ ${error.message}.`);
		}
		if (!process.env.REMOVE_BG_KEY) {
			return reply("❌ AI stickers require `REMOVE_BG_KEY` in the Render environment.");
		}
		aiCooldowns.set(senderJid, now + 60_000);
		const sticker = await runMediaJob({
			feature: "aisticker",
			groupJid: from,
			senderJid,
			task: async () => imageBufferToSticker(await removeImageBackground(imageMedia.buffer), {
				pack: args.join(" ").trim().slice(0, 64) || "Alpha AI Cutouts",
				author: "MartechMods2",
				quality: 86,
			}),
		});
		return sendMessageWTyping(from, { sticker }, { quoted: msg });
	} catch (error) {
		console.error("Sticker Studio failed:", error.message);
		if (command === "aisticker" || command === "cutoutsticker") aiCooldowns.delete(senderJid);
		return reply(`❌ Sticker generation failed: ${error.message}`);
	}
};

export default () => ({
	cmd: ["aisticker", "cutoutsticker", "textsticker", "ts", "reactionsticker"],
	desc: "Create AI background-removed or text stickers",
	usage: "aisticker [pack name] (reply to image) | textsticker <text>",
	handler,
});
