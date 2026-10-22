import fs from "fs";
import os from "node:os";
import path from "node:path";
import yts from "yt-search";
import { isValidAudioFile, readFileEfficiently } from "../../../utils/file.js";
import { buildYtDlpOptions, describeYtDlpError, isYouTubeUrl, runYtDlpAdaptive } from "../../../utils/ytdlp.js";
import { downloadOpenMedia, findOpenAudio } from "../../../utils/openMediaSources.js";
import { audioCacheKey, encodeVoiceNote, inspectAudio } from "../../../utils/audioDelivery.js";
import { runMediaJob } from "../../../utils/mediaJobs.js";

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
	let target = query;
	if (!isYouTubeUrl(query)) {
		let timer;
		const results = await Promise.race([yts(query), new Promise((_, reject) => {
			timer = setTimeout(() => reject(Error("Audio search timed out. Try a YouTube link.")), 15000);
		})]).finally(() => clearTimeout(timer));
		const track = (results.videos || []).find((video) => isYouTubeUrl(video.url) && !video.live && video.seconds > 0 && video.seconds <= 720);
		if (!track) throw new Error("No song under 12 minutes was found");
		target = track.url;
	}
	const info = await runYtDlpAdaptive(target, await ytdlpOptions({ dumpSingleJson: true, skipDownload: true }));
	if (info.is_live || !Number.isFinite(Number(info.duration)) || Number(info.duration) <= 0 || Number(info.duration) > 720)
		throw Error("Choose a non-live track with a known length up to 12 minutes.");
	return { url: target, title: info.title || query };
};

const sendTrack = async ({ from, msg, command, sendMessageWTyping, buffer, title, mime = "audio/mpeg", ext = "mp3", source = "", voice = false }) => {
	const type = await inspectAudio(buffer);
	mime = type.mime; ext = type.ext;
	if (voice) return sendMessageWTyping(from, { audio: await encodeVoiceNote(buffer), mimetype: "audio/ogg; codecs=opus", ptt: true }, { quoted: msg });
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
	const voice = args.at(-1) === "--voice";
	if ((args.includes("--voice") && !voice) || (voice && ["songdoc", "mp3file"].includes(command)))
		return sendMessageWTyping(from, { text: "Use song <query> --voice for a voice note, or songdoc <query> for a file." }, { quoted: msg });
	const query = normalizeQuery((voice ? args.slice(0, -1) : args).join(" "));
	if (!query) {
		return sendMessageWTyping(
			from,
			{ text: "❌ Usage: `song artist - title`" },
			{ quoted: msg },
		);
	}

	const cacheKey = audioCacheKey(query, isYouTubeUrl);
	purgeAudioCache();
	const cached = audioCache.get(cacheKey);
	if (cached) {
		return sendTrack({ from, msg, command, sendMessageWTyping, ...cached, voice });
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
	for (const [id, until] of requestCooldowns) if (until <= now) requestCooldowns.delete(id);
	while (requestCooldowns.size > 3000) requestCooldowns.delete(requestCooldowns.keys().next().value);
	const directory = await fs.promises.mkdtemp(path.join(os.tmpdir(), "alpha-song-"));
	const outputPath = path.join(directory, "track.mp3");

	try {
		// Prefer provider-authorized/open streams. This avoids depending on a
		// challenged YouTube data-centre IP and preserves the provider's media type.
		if (!isYouTubeUrl(query)) {
			const openTrack = await findOpenAudio(query).catch(() => null);
			if (openTrack?.fullLength === true) {
				try {
					const buffer = await downloadOpenMedia(openTrack, MAX_TRACK_BYTES);
					const entry = {
						buffer,
						title: [openTrack.artist, openTrack.title].filter(Boolean).join(" - ") || query,
						mime: openTrack.mime || "audio/mpeg",
						ext: openTrack.ext || "mp3",
						source: openTrack.source || "Licensed media provider",
					};
					await inspectAudio(buffer);
					rememberAudio(cacheKey, entry);
					return sendTrack({ from, msg, command, sendMessageWTyping, ...entry, voice });
				} catch (providerError) {
					console.warn("[AUDIO] Open source unavailable; trying fallback.");
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
				maxFilesize: MAX_TRACK_BYTES,
				matchFilter: "!is_live & duration <= 720",
				output: outputPath,
			}),
		);
		if (!fs.existsSync(outputPath) || !isValidAudioFile(outputPath)) {
			throw new Error("A valid MP3 file was not produced");
		}
		const stats = await fs.promises.stat(outputPath);
		if (stats.size > MAX_TRACK_BYTES) throw new Error("Track is larger than the 25MB safety limit");
		const buffer = await readFileEfficiently(outputPath, MAX_TRACK_BYTES, false);
		await inspectAudio(buffer);
		rememberAudio(cacheKey, { buffer, title: track.title });
		return sendTrack({
			from,
			msg,
			command,
			sendMessageWTyping,
			buffer,
			title: track.title,
			voice,
		});
	} catch (error) {
		requestCooldowns.delete(senderJid);
		console.warn("[AUDIO] Song delivery failed.");
		const message = String(error.message || "").toLowerCase();
		const detail = message.includes("12 minutes")
			? "Choose a non-live track with a known length up to 12 minutes."
			: message.includes("25mb") ? "Audio exceeds the 25MB safety limit."
			: message.includes("recognized audio") ? "The source did not return a valid audio file. Try another source."
			: describeYtDlpError(error);
		return sendMessageWTyping(from, { text: `❌ Song failed. ${detail}` }, { quoted: msg });
	} finally {
		await fs.promises.rm(directory, { recursive: true, force: true });
	}
};

export default () => ({
	cmd: ["song", "play", "songdoc", "mp3file"],
	desc: "Send licensed/open audio directly, with YouTube as a last-resort fallback",
	usage: "song <artist - title or YouTube link> [--voice] | songdoc <query>",
	handler: async (sock, msg, from, args, info) => {
		try {
			return await runMediaJob({ feature: "song", groupJid: from, senderJid: info.senderJid, retryable: false,
				task: () => handler(sock, msg, from, args, info) });
		} catch {
			return info.sendMessageWTyping(from, { text: "❌ Audio request unavailable. The media queue or quota may be full; try again later." }, { quoted: msg });
		}
	},
});
