import { getMemberData } from "../../db/members.js";
import { downloadContentFromMessage } from "baileys";
import { setStickerMetadata } from "../../utils/stickerMetadata.js";

const handler = async (sock, msg, from, args, msgInfoObj) => {
	const { evv, type, content, sendMessageWTyping, senderJid, command, extendedMessageOriginal } = msgInfoObj;
	const memberData = await getMemberData(senderJid);

	if (type === "extendedTextMessage" && content.includes("stickerMessage")) {
		let packName = "Alpha";
		let authorName = "Martech";
		if (args.includes("pack")) packName = args.join(" ").split("pack ")[1]?.split("author")[0] || packName;
		if (args.includes("author")) authorName = args.join(" ").split("author ")[1]?.split("pack")[0] || authorName;

		const downloadFilePath = extendedMessageOriginal?.quotedMessage?.stickerMessage;
		const stream = await downloadContentFromMessage(downloadFilePath, "sticker");
		const chunks = [];
		for await (const chunk of stream) chunks.push(chunk);
		const buffer = Buffer.concat(chunks);

		const packOrAuthor = args.includes("pack") || args.includes("author");
		const finalPack = packOrAuthor ? packName : evv || memberData?.customStealText || "Alpha";
		const finalAuthor = packOrAuthor ? authorName : evv || memberData?.customStealText ? "" : "Martech";
		const sticker = await setStickerMetadata(buffer, { pack: finalPack, author: finalAuthor, remove: command === "stealn" });
		return sendMessageWTyping(from, { sticker }, { quoted: msg });
	} else {
		return sendMessageWTyping(from, { text: `❌ *Reply on Sticker*` }, { quoted: msg });
	}
};

export default () => ({
	cmd: ["steal", "stealn"],
	desc: "Steal stickers with custom pack and author names or default ones.",
	usage: "steal | steal pack <name> author <name>",
	handler,
});
