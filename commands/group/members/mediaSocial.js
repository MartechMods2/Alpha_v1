import axios from "axios";
import {
	addMediaContestSubmission,
	closeMediaContest,
	deleteGroupSticker,
	findGroupStickers,
	getActiveMediaContest,
	getGroupSticker,
	getRandomGroupSticker,
	saveGroupSticker,
	startMediaContest,
	voteMediaContest,
} from "../../../db/mediaData.js";
import { recordGameResult } from "../../../db/gameData.js";
import { createMemeImage, imageBufferToSticker } from "../../../utils/mediaStudio.js";
import { downloadResolvedMedia } from "../../../utils/mediaInput.js";
import { runMediaJob } from "../../../utils/mediaJobs.js";

const safe = (value, max = 120) => String(value || "").replace(/[\r\n\t*_~`]/g, " ").replace(/\s+/g, " ").trim().slice(0, max);

const fetchAvatar = async (sock, jid) => {
	const url = await sock.profilePictureUrl(jid, "image");
	const response = await axios.get(url, { responseType: "arraybuffer", timeout: 10_000, maxContentLength: 5 * 1024 * 1024 });
	return Buffer.from(response.data);
};

const resolveSticker = async (from, rawNumber) => {
	const entries = await findGroupStickers(from, "", 20);
	const index = Number.parseInt(rawNumber, 10) - 1;
	if (!Number.isInteger(index) || index < 0 || !entries[index]) return null;
	return getGroupSticker(from, entries[index]._id);
};

const handleStickerVault = async ({ sock, msg, from, args, command, senderJid, updateName, isGroupAdmin, isOwner, sendMessageWTyping }) => {
	const reply = (text) => sendMessageWTyping(from, { text }, { quoted: msg });
	if (command === "avatarsticker") {
		const avatar = await fetchAvatar(sock, senderJid).catch(() => null);
		if (!avatar) return reply("❌ I could not access your profile photo.");
		const sticker = await runMediaJob({
			feature: "avatarsticker", groupJid: from, senderJid,
			task: () => imageBufferToSticker(avatar, { pack: "Alpha Avatars", author: "MartechMods2", quality: 84 }),
		});
		return sendMessageWTyping(from, { sticker }, { quoted: msg });
	}
	if (command === "stickersave") {
		const media = await downloadResolvedMedia(sock, msg, { allowedKinds: ["sticker"], maxBytes: 1024 * 1024 });
		const [name, ...tags] = args.join(" ").split("|");
		const saved = await saveGroupSticker({
			groupJid: from, name, tags: tags.join("|").split(/[, ]+/), data: media.buffer,
			authorJid: senderJid, authorName: updateName,
		});
		return reply(`✅ Saved *${saved.name}* to the group sticker pack.`);
	}
	if (["stickerfind", "stickerrandom"].includes(command)) {
		const entry = command === "stickerrandom"
			? await getRandomGroupSticker(from, args.join(" "))
			: await getRandomGroupSticker(from, args.join(" "));
		if (!entry) return reply("❌ No saved sticker matched that search.");
		return sendMessageWTyping(from, { sticker: Buffer.from(entry.data.buffer || entry.data) }, { quoted: msg });
	}

	const action = String(args[0] || "list").toLowerCase();
	if (action === "delete") {
		const entry = await resolveSticker(from, args[1]);
		if (!entry) return reply("❌ Sticker not found. Use `stickerpack list`.");
		const result = await deleteGroupSticker(from, entry._id, senderJid, isGroupAdmin || isOwner);
		return result.deletedCount ? reply("✅ Sticker removed from the group pack.") : reply("❌ Only its creator or an admin can remove it.");
	}
	const entries = await findGroupStickers(from, args.slice(action === "list" ? 1 : 0).join(" "), 20);
	if (!entries.length) return reply("🗃️ This group sticker pack is empty. Reply to a sticker with `stickersave name | tags`.");
	return reply(`🗃️ *Group Sticker Pack*\n\n${entries.map((entry, index) => `${index + 1}. *${entry.name}*${entry.tags?.length ? ` — ${entry.tags.join(", ")}` : ""}`).join("\n")}\n\nUse \`stickerfind <name/tag>\` or \`stickerrandom\`.`);
};

const contestType = (command) => command === "stickerbattle" ? "sticker" : command === "memebattle" ? "meme" : "caption";

const handleContest = async ({ sock, msg, from, args, command, senderJid, updateName, isGroupAdmin, isOwner, sendMessageWTyping }) => {
	const type = contestType(command);
	const action = String(args[0] || "status").toLowerCase();
	const reply = (text) => sendMessageWTyping(from, { text }, { quoted: msg });
	if (action === "start") {
		if (!isGroupAdmin && !isOwner) return reply("❌ Only an admin can start a contest.");
		const contest = await startMediaContest({ groupJid: from, type, topic: args.slice(1).join(" "), createdBy: senderJid });
		return reply(`🏁 *${type.toUpperCase()} BATTLE STARTED*\n\nTopic: *${contest.topic}*\nSubmit with \`${command} submit <caption>\`. One entry per member; voting closes when an admin uses \`${command} end\`.`);
	}
	const contest = await getActiveMediaContest(from, type);
	if (!contest) return reply(`❌ No ${type} contest is active. An admin can use \`${command} start <topic>\`.`);
	if (action === "submit") {
		let text = safe(args.slice(1).join(" "), 180);
		if (type === "meme") {
			const media = await downloadResolvedMedia(sock, msg, { allowedKinds: ["image"], maxBytes: 10 * 1024 * 1024 });
			const [top, ...bottom] = text.split("|");
			if (!top?.trim()) return reply(`❌ Usage: \`${command} submit top text | bottom text\` while sending or replying to an image.`);
			const image = await runMediaJob({ feature: "memebattle", groupJid: from, senderJid, task: () => createMemeImage(media.buffer, top, bottom.join("|")) });
			await sendMessageWTyping(from, { image, caption: `🎭 Meme battle entry by *${safe(updateName, 60)}*` }, { quoted: msg });
		} else if (type === "sticker") {
			await downloadResolvedMedia(sock, msg, { allowedKinds: ["sticker"], maxBytes: 1024 * 1024 });
			text ||= "Sticker entry";
		} else if (!text) {
			return reply(`❌ Usage: \`${command} submit <your caption>\`.`);
		}
		const entry = await addMediaContestSubmission({ contestId: contest._id, memberJid: senderJid, memberName: updateName, text });
		return reply(`✅ Entry *#${entry.number}* accepted. Members vote with \`${command} vote ${entry.number}\`.`);
	}
	if (action === "vote") {
		const number = Number.parseInt(args[1], 10) - 1;
		const submission = contest.submissions?.[number];
		if (!submission) return reply("❌ Entry not found.");
		if (submission.memberJid === senderJid) return reply("❌ You cannot vote for your own entry.");
		await voteMediaContest({ contestId: contest._id, memberJid: senderJid, submissionId: submission.id });
		return reply(`✅ Your vote for entry *#${number + 1}* was recorded.`);
	}
	if (action === "end") {
		if (!isGroupAdmin && !isOwner) return reply("❌ Only an admin can close the contest.");
		const closed = await closeMediaContest(contest._id);
		const winner = closed.standings?.[0];
		if (!winner) return reply("🏁 Contest closed without any entries.");
		await recordGameResult({ groupJid: from, memberJid: winner.memberJid, name: winner.memberName, game: `${type}battle`, points: 20, won: true, correct: true });
		return reply(`🏆 *${safe(winner.memberName, 60)}* wins the ${type} battle with *${winner.votes} vote${winner.votes === 1 ? "" : "s"}*!\n+20 Alpha points awarded.`);
	}
	const rows = (contest.submissions || []).map((entry, index) => `${index + 1}. *${safe(entry.memberName, 60)}* — ${entry.text || `${type} entry`}`);
	return reply(`🎭 *${type.toUpperCase()} BATTLE*\nTopic: ${contest.topic}\n\n${rows.length ? rows.join("\n") : "No entries yet."}`);
};

const handler = async (sock, msg, from, args, msgInfoObj) => {
	const context = { sock, msg, from, args, ...msgInfoObj };
	try {
		if (["stickerpack", "stickersave", "stickerfind", "stickerrandom", "avatarsticker"].includes(msgInfoObj.command)) return handleStickerVault(context);
		return handleContest(context);
	} catch (error) {
		console.error("Media social command failed:", error.message);
		return msgInfoObj.sendMessageWTyping(from, { text: `❌ ${error.message}` }, { quoted: msg });
	}
};

export default () => ({
	cmd: [
		"stickerpack", "stickersave", "stickerfind", "stickerrandom", "avatarsticker",
		"memebattle", "captionbattle", "captioncontest", "stickerbattle",
	],
	desc: "Persistent sticker collections and competitive media battles",
	usage: "stickerpack | stickersave | memebattle start|submit|vote|end",
	handler,
});
