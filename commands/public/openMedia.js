import { fileTypeFromBuffer } from "file-type";
import {
	downloadOpenMedia,
	findOpenAudio,
	findOpenVideo,
	parseArtistTitle,
	searchCommonsFile,
	searchLyrics,
} from "../../utils/openMediaSources.js";

const cooldowns = new Map();
const COOLDOWN_MS = 45_000;

const safe = (value, max = 120) => String(value || "").replace(/[\r\n\t*_~`]/g, " ").replace(/\s+/g, " ").trim().slice(0, max);
const reply = (sendMessageWTyping, from, msg, text) => sendMessageWTyping(from, { text }, { quoted: msg });

const requireQuery = (args, prefix, command) => {
	const query = safe(args.join(" "), 160);
	if (query) return query;
	throw new Error(`Usage: ${prefix}${command} Artist - Song name`);
};

const checkCooldown = (senderJid) => {
	const now = Date.now();
	const remaining = (cooldowns.get(senderJid) || 0) - now;
	if (remaining > 0) throw new Error(`Wait ${Math.ceil(remaining / 1000)} seconds before another media search.`);
	cooldowns.set(senderJid, now + COOLDOWN_MS);
};

const sourceCaption = (result) => {
	const length = result.fullLength === false ? "Official preview" : "Full public/licensed file";
	return `🎵 *${safe(result.title)}*${result.artist ? `\n🎤 ${safe(result.artist)}` : ""}\n📚 Source: ${safe(result.source)}\n🛡️ ${length}`;
};

const sendResult = async ({ result, sendMessageWTyping, from, msg, forceDocument = false }) => {
	const buffer = await downloadOpenMedia(result);
	const detected = await fileTypeFromBuffer(buffer).catch(() => null);
	const mime = detected?.mime || result.mime || "application/octet-stream";
	const ext = detected?.ext || result.ext || "bin";
	const fileName = `${safe(result.artist ? `${result.artist} - ${result.title}` : result.title, 90)}.${ext}`;
	const caption = sourceCaption(result);
	if (!forceDocument && mime.startsWith("audio/")) {
		await sendMessageWTyping(from, { text: caption }, { quoted: msg });
		return sendMessageWTyping(from, { audio: buffer, mimetype: mime, fileName, ptt: false }, { quoted: msg });
	}
	if (!forceDocument && mime.startsWith("video/")) {
		return sendMessageWTyping(from, { video: buffer, mimetype: mime, caption }, { quoted: msg });
	}
	if (!forceDocument && mime.startsWith("image/")) {
		return sendMessageWTyping(from, { image: buffer, mimetype: mime, caption }, { quoted: msg });
	}
	return sendMessageWTyping(from, { document: buffer, mimetype: mime, fileName, caption }, { quoted: msg });
};

const helpText = (prefix) => `📥 *Alpha Media Search V2*\n\n` +
	`${prefix}music Artist - Song name\n` +
	`${prefix}musicfile Artist - Song name\n` +
	`${prefix}video Artist - Video name\n` +
	`${prefix}lyrics Artist - Song name\n` +
	`${prefix}file Nature sounds\n\n` +
	`Works in groups and private chats. Full downloads use public/licensed catalogues. If a commercial track is unavailable, Alpha may send a clearly labelled official preview instead.`;

const handler = async (sock, msg, from, args, msgInfoObj) => {
	const { command, prefix, senderJid, sendMessageWTyping } = msgInfoObj;
	if (command === "mediahelp") return reply(sendMessageWTyping, from, msg, helpText(prefix));
	if (command === "mediasources") {
		return reply(sendMessageWTyping, from, msg,
			`📡 *Open Media Sources*\n\n✅ Internet Archive — no key\n✅ Wikimedia Commons — no key\n✅ Apple official previews — no key\n✅ LRCLIB lyrics — no key\n${process.env.JAMENDO_CLIENT_ID ? "✅" : "⚪"} Jamendo full-track catalogue — ${process.env.JAMENDO_CLIENT_ID ? "configured" : "optional JAMENDO_CLIENT_ID"}\n${process.env.PEXELS_API_KEY ? "✅" : "⚪"} Pexels stock video — ${process.env.PEXELS_API_KEY ? "configured" : "optional PEXELS_API_KEY"}\n\nYouTube is not used by these commands.`);
	}

	let cooldownStarted = false;
	try {
		const query = requireQuery(args, prefix, command);
		checkCooldown(senderJid);
		cooldownStarted = true;
		if (command === "lyrics") {
			const parsed = parseArtistTitle(query);
			const result = await searchLyrics(query);
			if (!result) throw new Error(`No lyrics found for ${parsed.query}.`);
			return reply(
				sendMessageWTyping,
				from,
				msg,
				`🎵 *${safe(result.title)}*\n🎤 *${safe(result.artist || "Unknown artist")}*\n📚 Source: ${result.source}\n\n${result.lyrics}`,
			);
		}

		await reply(sendMessageWTyping, from, msg, "⏳ Searching safe public media sources…");

		if (command === "music" || command === "musicfile") {
			const result = await findOpenAudio(query);
			if (!result) throw new Error("No licensed audio or official preview was found.");
			return sendResult({ result, sendMessageWTyping, from, msg, forceDocument: command === "musicfile" });
		}
		if (command === "video" || command === "videofile") {
			const result = await findOpenVideo(query);
			if (!result) throw new Error("No licensed video or official preview was found.");
			return sendResult({ result, sendMessageWTyping, from, msg, forceDocument: command === "videofile" });
		}

		const result = await searchCommonsFile(query);
		if (!result) throw new Error("No suitable openly licensed file was found.");
		return sendResult({ result, sendMessageWTyping, from, msg, forceDocument: command === "file" });
	} catch (error) {
		if (cooldownStarted) cooldowns.delete(senderJid);
		console.error("Open media command failed:", error.message);
		return reply(sendMessageWTyping, from, msg, `❌ ${error.message}`);
	}
};

export default () => ({
	cmd: ["music", "musicfile", "video", "videofile", "lyrics", "file", "mediahelp", "mediasources"],
	desc: "Search and send licensed music, video, lyrics and open media in groups or DMs",
	usage: "music <artist - title> | video <query> | lyrics <artist - title> | file <query>",
	handler,
});
