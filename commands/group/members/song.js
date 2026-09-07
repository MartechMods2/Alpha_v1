import fs from "fs";
import yts from "yt-search";
import memoryManager from "../../../utils/memory.js";
import { isValidAudioFile, readFileEfficiently } from "../../../utils/file.js";
import { buildYtDlpOptions, describeYtDlpError, isYouTubeUrl, runYtDlpAdaptive } from "../../../utils/ytdlp.js";
import { downloadOpenMedia, findOpenAudio } from "../../../utils/openMediaSources.js";

const audioCache = new Map();
const requestCooldowns = new Map();
const CACHE_TTL_MS = 15 * 60_000;
const MAX_CACHE_BYTES = 35 * 1024 * 1024;
const MAX_TRACK_BYTES = 25 * 1024 * 1024;

const normalizeQuery = (value) =>
	String(value || "")
		.trim()
		.replace(/\s+/g, " ")
		.slice(0, 120);

const safeFileName = (title) =>
	String(title || "song")
		.replace(/[\\/:*?"<>|\u0000-\u001f]/g, "")
		.trim()
		.slice(0, 100) || "song";

const purgeAudioCache = (now = Date.now()) => {
	for (const [key, entry] of audioCache) {
		if (entry.expires <= now) audioCache.delete(key);
	}
	let total = [...audioCache.values()].reduce((sum, entry) => sum + entry.buffer.length, 0);
	while (total > MAX_CACHE_BYTES || audioCache.size > 3) {
		const oldestKey = audioCache.keys().next().value;
		if (!oldestKey) break;
		total -= audioCache.get(oldestKey).buffer.length;
		audioCache.delete(oldestKey);
	}
};

const rememberAudio = (key, entry) => {
	if (entry.buffer.length > 12 * 1024 * 1024) return;
	audioCache.delete(key);
	audioCache.set(key, { ...entry, expires: Date.now() + CACHE_TTL_MS });
	purgeAudioCache();
};

const ytdlpOptions = async (extra = {}) => {
	return buildYtDlpOptions(extra);
};

const resolveTrack = async (query) => {
	if (isYouTubeUrl(query)) {
		const info = await runYtDlpAdaptive(query, await ytdlpOptions({ dumpSingleJson: true, skipDownload: true }));
		if ((info.duration || 0) > 12 * 60) throw new Error("Track is longer than 12 minutes");
		return { url: query, title: info.title || "Song" };
	}
	const results = await yts(query);
	const track = (results.videos || []).find(
		(video) => isYouTubeUrl(video.url) && (!video.seconds || video.seconds <= 12 * 60),
	);
	if (!track) throw new Error("No song under 12 minutes was found");
	return { url: track.url, title: track.title || query };
};

const sendTrack = async ({ from, msg, command, sendMessageWTyping, buffer, title, mime = "audio/mpeg", ext = "mp3", source = "" }) => {
	const fileName = `${safeFileName(title)}.${String(ext || "mp3").replace(/[^a-z0-9]/gi, "").slice(0, 5) || "mp3"}`;
	if (command === "songdoc" || command === "mp3file") {
		return sendMessageWTyping(
			from,
			{
				document: buffer,
				mimetype: mime,
				fileName,
				caption: `🎵 *${safeFileName(title)}*${source ? `\nSource: ${source}` : ""}`,
			},
			{ quoted: msg },
		);
	}
	return sendMessageWTyping(
		from,
		{ audio: buffer, mimetype: mime, fileName, ptt: false },
		{ quoted: msg },
	);
};

const handler = async (sock, msg, from, args, msgInfoObj) => {
	const { command, senderJid, sendMessageWTyping } = msgInfoObj;
	const query = normalizeQuery(args.join(" "));
	if (!query) {
		return sendMessageWTyping(
			from,
			{ text: "❌ Usage: `song artist - title`" },
			{ quoted: msg },
		);
	}

	const cacheKey = query.toLowerCase();
	purgeAudioCache();
	const cached = audioCache.get(cacheKey);
	if (cached) {
		return sendTrack({ from, msg, command, sendMessageWTyping, ...cached });
	}

	const now = Date.now();
	if ((requestCooldowns.get(senderJid) || 0) > now) {
		return sendMessageWTyping(
			from,
			{ text: "⏳ Song cooldown: wait 45 seconds before requesting another download." },
			{ quoted: msg },
		);
	}
	requestCooldowns.set(senderJid, now + 45_000);
	const outputPath = memoryManager.generateTempFileName(".mp3");

	try {
		// Prefer provider-authorized/open streams. This avoids depending on a
		// challenged YouTube data-centre IP and preserves the provider's media type.
		if (!isYouTubeUrl(query)) {
			const openTrack = await findOpenAudio(query).catch(() => null);
			if (openTrack) {
				try {
					const buffer = await downloadOpenMedia(openTrack, MAX_TRACK_BYTES);
					const entry = {
						buffer,
						title: [openTrack.artist, openTrack.title].filter(Boolean).join(" - ") || query,
						mime: openTrack.mime || "audio/mpeg",
						ext: openTrack.ext || "mp3",
						source: openTrack.source || "Licensed media provider",
					};
					rememberAudio(cacheKey, entry);
					return sendTrack({ from, msg, command, sendMessageWTyping, ...entry });
				} catch (providerError) {
					console.warn("Open audio provider failed; trying the last-resort source:", providerError.message);
				}
			}
		}

		const track = await resolveTrack(query);
		await runYtDlpAdaptive(
			track.url,
			await ytdlpOptions({
				format: "bestaudio/best",
				extractAudio: true,
				audioFormat: "mp3",
				audioQuality: 5,
				output: outputPath,
			}),
		);
		if (!fs.existsSync(outputPath) || !isValidAudioFile(outputPath)) {
			throw new Error("A valid MP3 file was not produced");
		}
		const stats = await fs.promises.stat(outputPath);
		if (stats.size > MAX_TRACK_BYTES) throw new Error("Track is larger than the 25MB safety limit");
		const buffer = await readFileEfficiently(outputPath, MAX_TRACK_BYTES, false);
		rememberAudio(cacheKey, { buffer, title: track.title });
		return sendTrack({
			from,
			msg,
			command,
			sendMessageWTyping,
			buffer,
			title: track.title,
		});
	} catch (error) {
		requestCooldowns.delete(senderJid);
		console.error("Song download failed:", error.message);
		const message = String(error.message || "").toLowerCase();
		const detail = message.includes("12 minutes") || message.includes("25mb")
			? error.message
			: describeYtDlpError(error);
		return sendMessageWTyping(from, { text: `❌ Song failed. ${detail}` }, { quoted: msg });
	} finally {
		memoryManager.safeUnlink(outputPath);
	}
};

export default () => ({
	cmd: ["song", "play", "songdoc", "mp3file"],
	desc: "Send licensed/open audio directly, with YouTube as a last-resort fallback",
	usage: "song <artist - title> | songdoc <artist - title>",
	handler,
});
