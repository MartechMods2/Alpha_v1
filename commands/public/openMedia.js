import { fileTypeFromBuffer } from "file-type";
import {
	downloadOpenMedia,
	findMusicLinks,
	findOpenAudio,
	findOpenVideo,
	findOfficialPreview,
	openMusicProviderStatus,
	parseArtistTitle,
	searchCoverArt,
	searchCommonsFile,
	searchGeniusLink,
	searchLyrics,
	searchNigeriaChart,
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
	`${prefix}naijasong Artist - Song name\n` +
	`${prefix}afrobeats Artist - Song name\n` +
	`${prefix}gospelsong Artist - Song name\n` +
	`${prefix}songpreview Artist - Song name\n` +
	`${prefix}songlink Artist - Song name\n` +
	`${prefix}musicfile Artist - Song name\n` +
	`${prefix}musicvideo Artist - Video name\n` +
	`${prefix}lyrics Artist - Song name\n` +
	`${prefix}syncedlyrics Artist - Song name\n` +
	`${prefix}albumart Artist - Album or song\n` +
	`${prefix}musicartist Artist name\n` +
	`${prefix}naijacharts\n` +
	`${prefix}file Nature sounds\n\n` +
	`Works in groups and private chats. Full downloads use public/licensed catalogues. If a commercial track is unavailable, Alpha may send a clearly labelled official preview instead.`;

const providerText = () => {
	const status = openMusicProviderStatus();
	return Object.entries(status).map(([name, entry]) => {
		let state = "NOT LINKED";
		if (entry.access === "restricted" && !entry.configured) state = "RESTRICTED — safely skipped";
		else if (entry.credentialsConfigured) state = "LINKED";
		else if (entry.configured) state = "READY — no key required";
		return `${entry.configured ? "✅" : "⚪"} ${name} — ${state}\n   ${entry.capability}`;
	}).join("\n");
};

const sendLinks = async ({ query, sendMessageWTyping, from, msg }) => {
	const links = await findMusicLinks(query);
	if (!links.length) throw new Error("No verified music pages were found.");
	const first = links[0];
	return reply(sendMessageWTyping, from, msg,
		`🔗 *${safe(first.title || query)}*${first.artist ? `\n🎤 ${safe(first.artist)}` : ""}\n\n${links.map((entry) => `• ${entry.source}: ${entry.url}`).join("\n")}\n\nThese are official catalogue or reference links; no protected audio was copied.`);
};

const handler = async (sock, msg, from, args, msgInfoObj) => {
	const { command, prefix, senderJid, sendMessageWTyping } = msgInfoObj;
	if (command === "mediahelp") return reply(sendMessageWTyping, from, msg, helpText(prefix));
	if (command === "mediasources") {
		return reply(sendMessageWTyping, from, msg,
			`📡 *Nigerian-first Music Sources*\n\n${providerText()}\n${process.env.PEXELS_API_KEY ? "✅ pexels — LINKED" : "⚪ pexels — NOT LINKED"}\n   stock video\n✅ Wikimedia Commons — READY — no key required\n   open files\n\nAudiomack is skipped unless official partner credentials are present. YouTube, scraping, cookies and rotating proxies are not used by these commands.`);
	}

	let cooldownStarted = false;
	try {
		if (["naijacharts", "trendingnaija", "newnaija"].includes(command)) {
			checkCooldown(senderJid);
			cooldownStarted = true;
			const tracks = await searchNigeriaChart();
			if (!tracks.length) throw new Error("Nigeria charts require LASTFM_API_KEY. Add the free key in Render and try again.");
			return reply(sendMessageWTyping, from, msg, `🇳🇬 *Nigeria Music Discovery*\n\n${tracks.map((track, index) => `${index + 1}. ${safe(track.artist)} — ${safe(track.title)}\n${track.url}`).join("\n\n")}\n\nSource: Last.fm Nigeria discovery data`);
		}
		const query = requireQuery(args, prefix, command);
		checkCooldown(senderJid);
		cooldownStarted = true;
		if (command === "lyrics" || command === "syncedlyrics") {
			const parsed = parseArtistTitle(query);
			const result = await searchLyrics(query);
			if (!result) {
				const genius = await searchGeniusLink(query).catch(() => null);
				if (genius) return reply(sendMessageWTyping, from, msg, `🎵 *${safe(genius.title)}*\n🎤 ${safe(genius.artist)}\n\nLyrics were not available from the open provider. Official Genius page:\n${genius.url}`);
				throw new Error(`No lyrics found for ${parsed.query}.`);
			}
			const selectedLyrics = command === "syncedlyrics" && result.syncedLyrics ? result.syncedLyrics : result.lyrics;
			const type = command === "syncedlyrics" && result.syncedLyrics ? "Synchronized lyrics" : "Lyrics";
			return reply(
				sendMessageWTyping,
				from,
				msg,
				`🎵 *${safe(result.title)}*\n🎤 *${safe(result.artist || "Unknown artist")}*\n📚 ${type} — ${result.source}\n\n${selectedLyrics}`,
			);
		}

		if (["songlink", "musicartist"].includes(command)) {
			return sendLinks({ query, sendMessageWTyping, from, msg });
		}

		await reply(sendMessageWTyping, from, msg, "⏳ Searching safe public media sources…");

		if (["music", "musicfile", "naijasong", "afrobeats", "gospelsong", "songpreview"].includes(command)) {
			const result = command === "songpreview" ? await findOfficialPreview(query) : await findOpenAudio(query);
			if (!result) throw new Error("No licensed audio or official preview was found.");
			return sendResult({ result, sendMessageWTyping, from, msg, forceDocument: command === "musicfile" });
		}
		if (command === "video" || command === "videofile" || command === "musicvideo") {
			const result = await findOpenVideo(query);
			if (!result) throw new Error("No licensed video or official preview was found.");
			return sendResult({ result, sendMessageWTyping, from, msg, forceDocument: command === "videofile" });
		}
		if (command === "albumart" || command === "musiccover") {
			const result = await searchCoverArt(query);
			if (!result) throw new Error("No matching release artwork was found.");
			return sendResult({ result, sendMessageWTyping, from, msg });
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
	cmd: ["music", "musicfile", "naijasong", "afrobeats", "gospelsong", "songpreview", "songlink", "video", "videofile", "musicvideo", "lyrics", "syncedlyrics", "musicartist", "naijacharts", "trendingnaija", "newnaija", "albumart", "musiccover", "file", "mediahelp", "mediasources"],
	desc: "Search and send licensed music, video, lyrics and open media in groups or DMs",
	usage: "music <artist - title> | naijasong <artist - title> | musicvideo <query> | lyrics <artist - title>",
	handler,
});
