import axios from "axios";
import { createMemeImage } from "../../../utils/mediaStudio.js";
import { downloadResolvedMedia } from "../../../utils/mediaInput.js";
import {
	isProviderAvailable,
	getMediaRuntimeConfig,
	reportProviderResult,
	runMediaJob,
} from "../../../utils/mediaJobs.js";
import { listMemeTemplates } from "../../../db/mediaData.js";

const categories = {
	wholesome: "wholesomememes",
	programming: "ProgrammerHumor",
	gaming: "gamingmemes",
	reaction: "reactiongifs",
};

const fallbackMemes = [
	["drake", "Ignoring group rules", "Reading the pinned rules"],
	["twobuttons", "Reply immediately", "Read the message properly first"],
	["changemymind", "This group has the best members", "Change my mind"],
	["buzz", "Group notifications", "Group notifications everywhere"],
];

const memeText = (value) => encodeURIComponent(String(value || "_").trim().replace(/[/?#%]/g, " ").slice(0, 90) || "_");

const fetchFallbackMeme = async () => {
	const [template, top, bottom] = fallbackMemes[Math.floor(Math.random() * fallbackMemes.length)];
	const url = `https://api.memegen.link/images/${template}/${memeText(top)}/${memeText(bottom)}.png`;
	const response = await axios.get(url, { responseType: "arraybuffer", timeout: 15_000, maxContentLength: 8 * 1024 * 1024 });
	return { buffer: Buffer.from(response.data), caption: "😂 Alpha Meme Studio fallback" };
};

const handler = async (sock, msg, from, args, msgInfoObj) => {
	const { sendMessageWTyping, senderJid } = msgInfoObj;
	let imageMedia = null;
	try {
		imageMedia = await downloadResolvedMedia(sock, msg, { allowedKinds: ["image"], maxBytes: 12 * 1024 * 1024 });
	} catch {}

	try {
		if (!imageMedia && String(args[0] || "").toLowerCase() === "template") {
			const [namePart, topPart = "_", ...bottomParts] = args.slice(1).join(" ").split("|").map((part) => part.trim());
			const templates = await listMemeTemplates();
			const template = templates.find((entry) => entry.nameKey === String(namePart || "").toLowerCase() || entry.templateId === String(namePart || "").toLowerCase());
			if (!template) {
				const names = templates.map((entry) => entry.name).join(", ") || "No custom templates configured";
				return sendMessageWTyping(from, { text: `❌ Template not found. Available: ${names}` }, { quoted: msg });
			}
			const url = `https://api.memegen.link/images/${template.templateId}/${memeText(topPart)}/${memeText(bottomParts.join("|") || "_")}.png`;
			const image = await runMediaJob({
				feature: "meme",
				groupJid: from,
				senderJid,
				task: async () => {
					const response = await axios.get(url, { responseType: "arraybuffer", timeout: 15_000, maxContentLength: 8 * 1024 * 1024 });
					return Buffer.from(response.data);
				},
			});
			return sendMessageWTyping(from, { image, caption: `😂 ${template.name}` }, { quoted: msg });
		}
		if (imageMedia) {
			const caption = args.join(" ").trim();
			if (!caption) {
				return sendMessageWTyping(
					from,
					{ text: "❌ Add meme text: `meme top text | bottom text`." },
					{ quoted: msg },
				);
			}
			const [topText = "", ...bottomParts] = caption.split("|");
			const memeBuffer = await runMediaJob({
				feature: "meme",
				groupJid: from,
				senderJid,
				task: () => createMemeImage(imageMedia.buffer, topText, bottomParts.join("|")),
			});
			return sendMessageWTyping(
				from,
				{ image: memeBuffer, caption: "😂 Made with Alpha Meme Studio" },
				{ quoted: msg },
			);
		}

		const result = await runMediaJob({
			feature: "meme",
			groupJid: from,
			senderJid,
			task: async () => {
				if (isProviderAvailable("memeapi")) {
					try {
						const category = categories[args[0]?.toLowerCase()] || "wholesomememes";
						const { data } = await axios.get(`https://meme-api.com/gimme/${category}`, { timeout: 15_000 });
						if (!data?.url || data.nsfw === true || data.spoiler === true) throw new Error("Unsafe or empty provider response");
						const media = await axios.get(data.url, { responseType: "arraybuffer", timeout: 20_000, maxContentLength: 10 * 1024 * 1024 });
						reportProviderResult("memeapi", true);
						return {
							buffer: Buffer.from(media.data),
							caption: `😂 *${String(data.title || "Meme").slice(0, 180)}*`,
							video: !/^image\//i.test(media.headers["content-type"] || ""),
						};
					} catch (providerError) {
						reportProviderResult("memeapi", false, providerError.message);
					}
				}
				if (!getMediaRuntimeConfig().providerFallbacks) {
					throw new Error("The meme provider is unavailable and automatic fallbacks are disabled");
				}
				const fallback = await fetchFallbackMeme();
				return { ...fallback, video: false };
			},
		});
		return result.video
			? sendMessageWTyping(from, { video: result.buffer, caption: result.caption, gifPlayback: true }, { quoted: msg })
			: sendMessageWTyping(from, { image: result.buffer, caption: result.caption }, { quoted: msg });
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
