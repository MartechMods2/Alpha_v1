import {
	getActionLeaderboard,
	getActionSettings,
	getActionStats,
	recordAction,
	setActionOptOut,
} from "../../../db/actionData.js";
import { getMemberData } from "../../../db/members.js";
import {
	ACTION_COMMANDS,
	ACTIONS,
	FRIENDLY_ACTIONS,
	createActionStickerImage,
} from "../../../utils/actionStudio.js";
import { isSameGroupUser } from "../../../utils/groupParticipants.js";
import { runMediaJob } from "../../../utils/mediaJobs.js";
import { imageBufferToSticker } from "../../../utils/mediaStudio.js";
import { getSafeSettings } from "../../../db/safePackData.js";

const cooldowns = new Map();
const CONTROL_COMMANDS = ["action", "actions", "actionhelp", "actionstats", "topactions", "actionoptout", "actionoptin"];

const safeName = (value, jid) => String(value || jid?.split("@")[0] || "Member")
	.replace(/[\r\n\t*_~`]/g, " ").replace(/\s+/g, " ").trim().slice(0, 40);

const targetFromContext = (context) =>
	(Array.isArray(context?.mentionedJid) ? context.mentionedJid[0] : context?.mentionedJid) || context?.participant || "";

const memberName = async (jid, fallback = "") => {
	const data = await getMemberData(jid).catch(() => null);
	return safeName(data && data !== -1 ? data.username : fallback, jid);
};

const actionHelp = () => {
	const rough = ACTION_COMMANDS.filter((name) => ACTIONS[name].tone === "rough");
	return (
		"🎬 *Alpha Action Sticker Studio*\n\n" +
		`Friendly: ${FRIENDLY_ACTIONS.map((name) => `\`${name}\``).join(", ")}\n\n` +
		`Play-fight: ${rough.map((name) => `\`${name}\``).join(", ")}\n\n` +
		"Tag a member or reply to their message. Example: `slap @member`.\n" +
		"Other commands: `action random @member`, `actionstats`, `topactions`, `actionoptout`, `actionoptin`."
	);
};

const handleStats = async ({ msg, from, command, target, senderJid, sendMessageWTyping }) => {
	const reply = (text, mentions = []) => sendMessageWTyping(from, { text, mentions }, { quoted: msg });
	if (command === "topactions") {
		const rows = await getActionLeaderboard(from, 10);
		if (!rows.length) return reply("🎬 No action stickers have been sent in this group yet.");
		return reply(
			"🏆 *Action Sticker Leaderboard*\n\n" + rows.map((entry, index) =>
				`${index + 1}. *${safeName(entry.memberName, entry.memberJid)}* — ${entry.sent || 0} sent · ${entry.received || 0} received`,
			).join("\n"),
			rows.map((entry) => entry.memberJid),
		);
	}
	const selected = target || senderJid;
	const stats = await getActionStats(from, selected);
	if (!stats) return reply("🎬 No action-sticker statistics found for that member.", [selected]);
	const favourites = Object.entries(stats.sentActions || {}).sort((a, b) => b[1] - a[1]).slice(0, 3);
	return reply(
		`🎬 *Action Stats — ${safeName(stats.memberName, selected)}*\n\n` +
		`Sent: *${stats.sent || 0}*\nReceived: *${stats.received || 0}*\n` +
		`Favourite actions: ${favourites.length ? favourites.map(([name, count]) => `${name} (${count})`).join(", ") : "none yet"}`,
		[selected],
	);
};

const handler = async (sock, msg, from, args, msgInfoObj) => {
	const { command, senderJid, updateName, extendedMessageOriginal, groupMetadata, sendMessageWTyping } = msgInfoObj;
	const reply = (text, mentions = []) => sendMessageWTyping(from, { text, mentions }, { quoted: msg });
	const target = targetFromContext(extendedMessageOriginal);

	try {
		if (["actions", "actionhelp"].includes(command) || (command === "action" && !args.length)) return reply(actionHelp());
		if (["actionstats", "topactions"].includes(command)) {
			return handleStats({ msg, from, command, target, senderJid, sendMessageWTyping });
		}
		if (["actionoptout", "actionoptin"].includes(command)) {
			await setActionOptOut(from, senderJid, command === "actionoptout");
			return reply(command === "actionoptout"
				? "🛡️ You opted out. Members cannot target you with action stickers in this group."
				: "✅ You opted back in to action stickers.");
		}

		const settings = await getActionSettings(from);
		const safeSettings = await getSafeSettings(from);
		if (settings.mode === "off") return reply("🎬 Action stickers are disabled in this group.");
		let action = command === "action" ? String(args[0] || "").toLowerCase() : command;
		if (action === "random") {
			const pool = settings.mode === "friendly" ? FRIENDLY_ACTIONS : ACTION_COMMANDS;
			action = pool[Math.floor(Math.random() * pool.length)];
		}
		const definition = ACTIONS[action];
		if (!definition) return reply(actionHelp());
		if (settings.mode === "friendly" && definition.tone !== "friendly") {
			return reply("🛡️ This group allows friendly actions only. Try `hug`, `highfive`, `cheer`, `dance` or `laugh`.");
		}
		if (!target) return reply(`❌ Tag a member or reply to their message: \`${action} @member\`.`);
		if (isSameGroupUser(groupMetadata, senderJid, target)) return reply("😄 Choose another member for that action.");
		if ((settings.optedOutMembers || []).some((jid) => isSameGroupUser(groupMetadata, target, jid))) {
			return reply("🛡️ That member has opted out of action stickers.");
		}

		const cooldownKey = `${from}:${senderJid}`;
		const now = Date.now();
		const readyAt = cooldowns.get(cooldownKey) || 0;
		if (readyAt > now) return reply(`⏳ Wait ${Math.ceil((readyAt - now) / 1000)} seconds before another action.`);
		cooldowns.set(cooldownKey, now + settings.cooldownSeconds * 1000);

		const [actorName, targetName] = await Promise.all([
			memberName(senderJid, updateName),
			memberName(target),
		]);
		const sticker = await runMediaJob({
			feature: `action-${action}`,
			groupJid: from,
			senderJid,
			task: async () => imageBufferToSticker(await createActionStickerImage({
				action,
				actorName,
				targetName,
				style: safeSettings.actionStyle,
			}), { pack: "Alpha Action Studio", author: "MartechMods2", quality: 86 }),
		});
		await sendMessageWTyping(from, { sticker, mentions: [senderJid, target] }, { quoted: msg });
		await recordAction({ groupJid: from, actorJid: senderJid, actorName, targetJid: target, targetName, action });
	} catch (error) {
		console.error("Action Sticker Studio failed:", error.message);
		return reply(`❌ Action sticker failed: ${error.message}`);
	}
};

export default () => ({
	cmd: [...ACTION_COMMANDS, ...CONTROL_COMMANDS],
	desc: "Create premium realistic-human or anime action stickers with opt-out protection and group statistics",
	usage: "slap @member | hug @member | action random @member | actionstats | topactions",
	handler,
});
