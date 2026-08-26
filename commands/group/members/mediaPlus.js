import axios from "axios";
import {
	createPhotoGrid,
	createProfileCard,
	createThumbnail,
	processAudio,
	processVideo,
	removeImageBackground,
	transformImage,
} from "../../../utils/mediaStudio.js";
import { downloadResolvedMedia } from "../../../utils/mediaInput.js";
import { runMediaJob } from "../../../utils/mediaJobs.js";
import { getGameProfile } from "../../../db/gameData.js";
import { getGameRank } from "../../../utils/gameRanks.js";

const gridSessions = new Map();
const cooldowns = new Map();

const parseTime = (value, fallback = 0) => {
	const raw = String(value ?? "").trim();
	if (!raw) return fallback;
	if (/^\d+(?:\.\d+)?$/.test(raw)) return Number(raw);
	const parts = raw.split(":").map(Number);
	if (parts.some((part) => !Number.isFinite(part))) return fallback;
	return parts.reduce((total, part) => total * 60 + part, 0);
};

const canRun = (key, duration = 15_000) => {
	const now = Date.now();
	if ((cooldowns.get(key) || 0) > now) return false;
	cooldowns.set(key, now + duration);
	if (cooldowns.size > 3000) for (const [entry, expires] of cooldowns) if (expires <= now) cooldowns.delete(entry);
	return true;
};

const fetchAvatar = async (sock, jid) => {
	try {
		const url = await sock.profilePictureUrl(jid, "image");
		const response = await axios.get(url, { responseType: "arraybuffer", timeout: 10_000, maxContentLength: 5 * 1024 * 1024 });
		return Buffer.from(response.data);
	} catch {
		return null;
	}
};

const imageOperations = new Set(["upscale", "replacebg", "passport", "signature", "scan"]);

const handleImage = async ({ sock, msg, from, args, command, senderJid, sendMessageWTyping }) => {
	const media = await downloadResolvedMedia(sock, msg, { allowedKinds: ["image"], maxBytes: 12 * 1024 * 1024 });
	const options = {};
	if (command === "replacebg") {
		options.color = args[0] || "#ffffff";
	}
	if (command === "passport") {
		options.color = args[0] || "#f4f8ff";
	}
	const image = await runMediaJob({
		feature: command,
		groupJid: from,
		senderJid,
		task: async () => {
			const source = ["replacebg", "passport"].includes(command) && process.env.REMOVE_BG_KEY
				? await removeImageBackground(media.buffer)
				: media.buffer;
			return transformImage(source, command, options);
		},
	});
	return sendMessageWTyping(from, { image, caption: `✅ ${command} completed by Alpha Media Studio` }, { quoted: msg });
};

const handleThumbnail = async ({ sock, msg, from, args, senderJid, sendMessageWTyping }) => {
	const media = await downloadResolvedMedia(sock, msg, { allowedKinds: ["image"], maxBytes: 12 * 1024 * 1024 });
	const [title, ...subtitle] = args.join(" ").split("|");
	if (!title?.trim()) return sendMessageWTyping(from, { text: "❌ Usage: reply to an image with `thumbnail Title | subtitle`." }, { quoted: msg });
	const image = await runMediaJob({
		feature: "thumbnail",
		groupJid: from,
		senderJid,
		task: () => createThumbnail(media.buffer, title, subtitle.join("|")),
	});
	return sendMessageWTyping(from, { image, caption: "🖼️ Alpha Thumbnail Studio" }, { quoted: msg });
};

const handleGrid = async ({ sock, msg, from, args, senderJid, sendMessageWTyping }) => {
	const key = `${from}:${senderJid}`;
	const action = String(args[0] || "add").toLowerCase();
	if (action === "start") {
		gridSessions.set(key, { buffers: [], expires: Date.now() + 5 * 60_000 });
		return sendMessageWTyping(from, { text: "🧩 Photo grid started. Send or reply to 2–4 images with `photogrid add`, then use `photogrid done`." }, { quoted: msg });
	}
	const session = gridSessions.get(key);
	if (!session || session.expires <= Date.now()) {
		gridSessions.delete(key);
		return sendMessageWTyping(from, { text: "❌ Start first with `photogrid start`." }, { quoted: msg });
	}
	if (action === "cancel") {
		gridSessions.delete(key);
		return sendMessageWTyping(from, { text: "✅ Photo grid cancelled." }, { quoted: msg });
	}
	if (action === "done") {
		if (session.buffers.length < 2) return sendMessageWTyping(from, { text: "❌ Add at least two images first." }, { quoted: msg });
		gridSessions.delete(key);
		const image = await runMediaJob({
			feature: "photogrid",
			groupJid: from,
			senderJid,
			task: () => createPhotoGrid(session.buffers),
		});
		return sendMessageWTyping(from, { image, caption: "🧩 Alpha Photo Grid" }, { quoted: msg });
	}
	if (session.buffers.length >= 4) return sendMessageWTyping(from, { text: "❌ This grid already has four images. Use `photogrid done`." }, { quoted: msg });
	const media = await downloadResolvedMedia(sock, msg, { allowedKinds: ["image"], maxBytes: 8 * 1024 * 1024 });
	session.buffers.push(media.buffer);
	session.expires = Date.now() + 5 * 60_000;
	return sendMessageWTyping(from, { text: `✅ Photo ${session.buffers.length}/4 added.${session.buffers.length >= 2 ? " Use `photogrid done` when ready." : ""}` }, { quoted: msg });
};

const handleCard = async ({ sock, msg, from, command, senderJid, updateName, sendMessageWTyping }) => {
	const [profile, avatar] = await Promise.all([getGameProfile(from, senderJid), fetchAvatar(sock, senderJid)]);
	const points = profile?.points || 0;
	const rank = getGameRank(points);
	const image = await runMediaJob({
		feature: command,
		groupJid: from,
		senderJid,
		task: () => createProfileCard({
			name: updateName || profile?.name || "Alpha Member",
			subtitle: command === "rankcard" ? `${rank.emoji} ${rank.name} · ${profile?.wins || 0} wins` : "Verified Alpha Group Member",
			points,
			avatarBuffer: avatar,
			accent: command === "rankcard" ? "#b45309" : "#7c3aed",
		}),
	});
	return sendMessageWTyping(from, { image, caption: command === "rankcard" ? "🏆 Alpha Rank Card" : "👤 Alpha Profile Card" }, { quoted: msg });
};

const handleAudio = async ({ sock, msg, from, args, command, senderJid, sendMessageWTyping }) => {
	const media = await downloadResolvedMedia(sock, msg, { allowedKinds: ["audio", "video"], maxBytes: 25 * 1024 * 1024 });
	const options = command === "audiocut"
		? { start: parseTime(args[0]), duration: parseTime(args[1], 15) }
		: {};
	const audio = await runMediaJob({
		feature: command,
		groupJid: from,
		senderJid,
		task: () => processAudio(media.buffer, media.extension, command, options),
	});
	return sendMessageWTyping(from, { audio, mimetype: "audio/mpeg", fileName: `alpha-${command}.mp3` }, { quoted: msg });
};

const handleWaveform = async ({ sock, msg, from, senderJid, sendMessageWTyping }) => {
	const media = await downloadResolvedMedia(sock, msg, { allowedKinds: ["audio", "video"], maxBytes: 25 * 1024 * 1024 });
	const { createWaveform } = await import("../../../utils/mediaStudio.js");
	const image = await runMediaJob({ feature: "waveform", groupJid: from, senderJid, task: () => createWaveform(media.buffer, media.extension) });
	return sendMessageWTyping(from, { image, caption: "🎵 Alpha Audio Waveform" }, { quoted: msg });
};

const handleVideo = async ({ sock, msg, from, args, command, senderJid, sendMessageWTyping }) => {
	const media = await downloadResolvedMedia(sock, msg, { allowedKinds: ["video"], maxBytes: 30 * 1024 * 1024 });
	const options = command === "videocut"
		? { start: parseTime(args[0]), duration: parseTime(args[1], 10) }
		: command === "videocaption"
			? { text: args.join(" ") }
			: { at: parseTime(args[0], 1) };
	if (command === "videocaption" && !options.text) return sendMessageWTyping(from, { text: "❌ Usage: reply to a video with `videocaption your text`." }, { quoted: msg });
	const output = await runMediaJob({
		feature: command,
		groupJid: from,
		senderJid,
		task: () => processVideo(media.buffer, media.extension, command, options),
	});
	const content = command === "videothumbnail"
		? { image: output, caption: "🖼️ Video thumbnail" }
		: { video: output, mimetype: "video/mp4", caption: `✅ ${command} completed` };
	return sendMessageWTyping(from, content, { quoted: msg });
};

const handler = async (sock, msg, from, args, msgInfoObj) => {
	const context = { sock, msg, from, args, ...msgInfoObj };
	const key = `${from}:${msgInfoObj.senderJid}:${msgInfoObj.command}`;
	if (!canRun(key, msgInfoObj.command === "photogrid" ? 4_000 : 15_000)) return;
	try {
		if (imageOperations.has(msgInfoObj.command)) return handleImage(context);
		if (msgInfoObj.command === "thumbnail") return handleThumbnail(context);
		if (msgInfoObj.command === "photogrid") return handleGrid(context);
		if (["profilecard", "rankcard"].includes(msgInfoObj.command)) return handleCard(context);
		if (["audiocut", "denoise", "normalize"].includes(msgInfoObj.command)) return handleAudio(context);
		if (msgInfoObj.command === "waveform") return handleWaveform(context);
		if (["videocut", "videocaption", "videothumbnail"].includes(msgInfoObj.command)) return handleVideo(context);
	} catch (error) {
		console.error(`Media Plus ${msgInfoObj.command} failed:`, error.message);
		return msgInfoObj.sendMessageWTyping(from, { text: `❌ ${msgInfoObj.command} failed: ${error.message}` }, { quoted: msg });
	}
};

export default () => ({
	cmd: [
		"upscale", "replacebg", "passport", "thumbnail", "photogrid", "signature", "scan",
		"profilecard", "rankcard", "audiocut", "denoise", "normalize", "waveform",
		"videocut", "videocaption", "videothumbnail",
	],
	desc: "Alpha image, audio, video, document and profile media studio",
	usage: "media command (send or reply to supported media)",
	handler,
});
