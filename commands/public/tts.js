import { createTextStickerImage, convertMediaToSticker } from "../../utils/mediaStudio.js";
import { runMediaJob } from "../../utils/mediaJobs.js";

const handler = async (sock, msg, from, args, msgInfoObj) => {
	const { sendMessageWTyping, evv, extendedMessageOriginal, senderJid } = msgInfoObj;
	const quotedText =
		extendedMessageOriginal?.quotedMessage?.conversation ||
		extendedMessageOriginal?.quotedMessage?.extendedTextMessage?.text ||
		"";
	const message = String(evv || quotedText).trim().slice(0, 180);
	if (!message) {
		return sendMessageWTyping(from, { text: "❌ Enter text or reply to a text message: `attp your text`." }, { quoted: msg });
	}

	try {
		const sticker = await runMediaJob({
			feature: "textsticker",
			groupJid: from,
			senderJid,
			task: async () => {
				const png = await createTextStickerImage(message.replaceAll(":", "\n"));
				return convertMediaToSticker(png, { inputExtension: "png", pack: "Alpha", author: "Text Sticker" });
			},
		});
		return sendMessageWTyping(from, { sticker }, { quoted: msg });
	} catch (error) {
		console.error("Text sticker failed:", error.message);
		return sendMessageWTyping(from, { text: `❌ Text sticker failed: ${error.message}` }, { quoted: msg });
	}
};

export default () => ({
	cmd: ["attp"],
	desc: "Convert text into a WhatsApp sticker",
	usage: "attp <text>",
	handler,
});
