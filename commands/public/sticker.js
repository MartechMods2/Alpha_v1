import { convertMediaToSticker } from "../../utils/mediaStudio.js";
import { downloadResolvedMedia } from "../../utils/mediaInput.js";
import { runMediaJob } from "../../utils/mediaJobs.js";

const parseMetadata = (args) => {
	const normalized = args.map((arg) => String(arg));
	const valueAfter = (keyword) => {
		const index = normalized.findIndex((arg) => arg.toLowerCase() === keyword);
		if (index < 0) return "";
		const stop = normalized.findIndex((arg, at) => at > index && ["pack", "author"].includes(arg.toLowerCase()));
		return normalized.slice(index + 1, stop < 0 ? normalized.length : stop).join(" ").trim().slice(0, 64);
	};
	return {
		pack: valueAfter("pack") || "Alpha Stickers",
		author: valueAfter("author") || "MartechMods2",
		quality: Math.min(90, Math.max(40, Number(normalized.find((arg) => /^\d{1,3}$/.test(arg))) || 78)),
		crop: normalized.some((arg) => ["crop", "c"].includes(arg.toLowerCase())),
		nometadata: normalized.some((arg) => arg.toLowerCase() === "nometadata"),
	};
};

const handler = async (sock, msg, from, args, msgInfoObj) => {
	const { senderJid, sendMessageWTyping } = msgInfoObj;
	const reply = (text) => sendMessageWTyping(from, { text }, { quoted: msg });
	try {
		const media = await downloadResolvedMedia(sock, msg, {
			allowedKinds: ["image", "video", "sticker"],
			maxBytes: 25 * 1024 * 1024,
		});
		if (media.kind === "video" && media.duration > 10) return reply("❌ Videos must be 10 seconds or shorter.");
		const metadata = parseMetadata(args);
		const sticker = await runMediaJob({
			feature: "sticker",
			groupJid: from,
			senderJid,
			task: () => convertMediaToSticker(media.buffer, {
				inputExtension: media.extension,
				animated: media.kind === "video" || media.mime === "image/gif",
				pack: metadata.nometadata ? "" : metadata.pack,
				author: metadata.nometadata ? "" : metadata.author,
				quality: metadata.quality,
				crop: metadata.crop,
			}),
		});
		return sendMessageWTyping(from, { sticker }, { quoted: msg });
	} catch (error) {
		console.error("[STICKER ERR]", error.message);
		return reply(`❌ Sticker failed: ${error.message}`);
	}
};

export default () => ({
	cmd: ["sticker", "s", "videosticker", "gifsticker"],
	desc: "Convert direct or replied images, GIFs and short videos into stickers",
	usage: "sticker [crop] [quality] [pack name] [author name] [nometadata]",
	handler,
});
