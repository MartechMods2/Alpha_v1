import axios from "axios";
import { downloadMediaMessage } from "baileys";
import { createMemeImage } from "../../../utils/mediaStudio.js";

const categories = {
	wholesome: "wholesomememes",
	programming: "ProgrammerHumor",
	gaming: "gamingmemes",
	reaction: "reactiongifs",
};

const getImageEnvelope = (msg, extendedMessageOriginal) => {
	if (msg.message?.imageMessage) return msg;
	if (extendedMessageOriginal?.quotedMessage?.imageMessage) {
		return { ...msg, message: extendedMessageOriginal.quotedMessage };
	}
	return null;
};

const handler = async (sock, msg, from, args, msgInfoObj) => {
	const { sendMessageWTyping, extendedMessageOriginal } = msgInfoObj;
	const imageEnvelope = getImageEnvelope(msg, extendedMessageOriginal);

	try {
		if (imageEnvelope) {
			const caption = args.join(" ").trim();
			if (!caption) {
				return sendMessageWTyping(
					from,
					{ text: "❌ Add meme text: `meme top text | bottom text`." },
					{ quoted: msg },
				);
			}
			const [topText = "", ...bottomParts] = caption.split("|");
			const imageBuffer = await downloadMediaMessage(imageEnvelope, "buffer", {});
			const memeBuffer = await createMemeImage(imageBuffer, topText, bottomParts.join("|"));
			return sendMessageWTyping(
				from,
				{ image: memeBuffer, caption: "😂 Made with Alpha Meme Studio" },
				{ quoted: msg },
			);
		}

		const category = categories[args[0]?.toLowerCase()] || "wholesomememes";
		const { data } = await axios.get(`https://meme-api.com/gimme/${category}`, {
			timeout: 15_000,
		});
		if (!data?.url) throw new Error("Meme provider returned no image");
		if (data.nsfw === true || data.spoiler === true) throw new Error("Meme provider returned filtered content");
		const caption = `😂 *${String(data.title || "Meme").slice(0, 180)}*`;
		if (/\.(jpe?g|png|webp)(\?|$)/i.test(data.url)) {
			return sendMessageWTyping(from, { image: { url: data.url }, caption }, { quoted: msg });
		}
		return sendMessageWTyping(
			from,
			{ video: { url: data.url }, caption, gifPlayback: true },
			{ quoted: msg },
		);
	} catch (error) {
		console.error("Meme command failed:", error.message);
		return sendMessageWTyping(
			from,
			{ text: "❌ Meme generation failed. Try another image or try again later." },
			{ quoted: msg },
		);
	}
};

export default () => ({
	cmd: ["meme", "mememaker"],
	desc: "Generate a custom caption meme or fetch a safe random meme",
	usage: "meme [wholesome|programming|gaming] | reply to image: meme top | bottom",
	handler,
});
