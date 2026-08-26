import { getGroupData, group } from "../../../db/groupData.js";
import { extractPhoneNumber } from "../../../utils/lid.js";
import { getGroupSafetySettings, parseMuteDuration } from "../../../utils/groupSafety.js";
import { isSameGroupUser } from "../../../utils/groupParticipants.js";
import {
	clearStatusMentionWarnings,
	isProtectedGroupMember,
} from "../../../utils/moderation.js";

const targetFromContext = (context) =>
	context?.mentionedJid?.[0] || context?.participant || "";

const mention = (jid) => `@${extractPhoneNumber(jid)}`;

const formatUntil = (date) => {
	if (!date) return "until manually unmuted";
	return `until ${new Intl.DateTimeFormat("en-GB", {
		timeZone: process.env.BOT_TIMEZONE || "Africa/Lagos",
		dateStyle: "medium",
		timeStyle: "short",
	}).format(new Date(date))}`;
};

const handler = async (sock, msg, from, args, msgInfoObj) => {
	const {
		command,
		extendedMessageOriginal,
		groupMetadata,
		botJids,
		isBotAdmin,
		senderJid,
		sendMessageWTyping,
	} = msgInfoObj;
	const reply = (text, mentions = []) =>
		sendMessageWTyping(from, { text, mentions }, { quoted: msg });
	const groupData = await getGroupData(from);
	const matches = (left, right) => isSameGroupUser(groupMetadata, left, right);
	const target = targetFromContext(extendedMessageOriginal);

	if (["antistatus", "antistatusmention"].includes(command)) {
		const action = String(args[0] || "status").toLowerCase();
		if (action === "status") {
			const settings = getGroupSafetySettings(groupData);
			return reply(
				`🚫 *Anti Status Mention*\n\nStatus: *${settings.isAntiStatusMentionOn ? "ON ✅" : "OFF ❌"}*\n` +
				"Penalty: *3 strikes → removal*\nAdmins, owners and the bot are exempt.",
			);
		}
		if (["on", "off"].includes(action)) {
			if (action === "on" && !isBotAdmin) return reply("❌ Make the bot a group admin before enabling this feature.");
			await group.updateOne({ _id: from }, { $set: { isAntiStatusMentionOn: action === "on" } });
			return reply(`✅ Anti status mention turned *${action.toUpperCase()}*.`);
		}
		if (action === "list") {
			const entries = Array.isArray(groupData?.statusMentionWarnCount) ? groupData.statusMentionWarnCount : [];
			if (!entries.length) return reply("✅ Nobody has a status-mention strike.");
			const shown = entries.slice(-30);
			return reply(
				"🚫 *Status-Mention Strikes*\n\n" + shown.map((entry) => `${mention(entry.member)} — *${Math.min(3, Number(entry.count || 0))}/3*`).join("\n"),
				shown.map((entry) => entry.member),
			);
		}
		if (action === "clear") {
			if (!target) return reply("❌ Tag a member or reply to their message: `antistatus clear @member`.");
			await clearStatusMentionWarnings(from, target, matches);
			return reply(`✅ Cleared status-mention strikes for ${mention(target)}.`, [target]);
		}
		return reply("❌ Use: `antistatus on`, `antistatus off`, `antistatus status`, `antistatus list`, or `antistatus clear @member`.");
	}

	if (["statuswarns", "statusstrikes"].includes(command)) {
		if (!target) return reply("❌ Tag a member or reply to their message.");
		const entries = Array.isArray(groupData?.statusMentionWarnCount) ? groupData.statusMentionWarnCount : [];
		const count = entries.filter((entry) => matches(target, entry.member)).reduce((highest, entry) => Math.max(highest, Number(entry.count || 0)), 0);
		return reply(`🚫 ${mention(target)} has *${Math.min(3, count)}/3* status-mention strikes.`, [target]);
	}

	if (["clearstatuswarn", "clearstatusstrike"].includes(command)) {
		if (!target) return reply("❌ Tag a member or reply to their message.");
		await clearStatusMentionWarnings(from, target, matches);
		return reply(`✅ Cleared status-mention strikes for ${mention(target)}.`, [target]);
	}

	const mutedMembers = getGroupSafetySettings(groupData).mutedMembers;
	if (["mutelist", "muted"].includes(command)) {
		const active = mutedMembers.filter((entry) => !entry.mutedUntil || entry.mutedUntil.getTime() > Date.now());
		if (!active.length) return reply("🔊 No members are muted in this group.");
		return reply(
			"🔇 *Muted Members*\n\n" + active.map((entry) => `${mention(entry.member)} — ${formatUntil(entry.mutedUntil)}`).join("\n"),
			active.map((entry) => entry.member),
		);
	}

	if (command === "muteinfo") {
		if (!target) return reply("❌ Tag a member or reply to their message.");
		const entry = mutedMembers.find((item) => matches(target, item.member));
		if (!entry || (entry.mutedUntil && entry.mutedUntil.getTime() <= Date.now())) {
			return reply(`🔊 ${mention(target)} is not muted.`, [target]);
		}
		return reply(
			`🔇 *Mute Information*\n\nMember: ${mention(target)}\nDuration: *${formatUntil(entry.mutedUntil)}*\nReason: *${entry.reason || "Not specified"}*`,
			[target],
		);
	}

	if (["unmute", "unsilence"].includes(command)) {
		if (!target) return reply("❌ Tag a member or reply to their message.");
		const stored = mutedMembers.filter((entry) => matches(target, entry.member)).map((entry) => entry.member);
		if (!stored.length) return reply(`🔊 ${mention(target)} is not muted.`, [target]);
		await group.updateOne({ _id: from }, { $pull: { mutedMembers: { member: { $in: stored } } } });
		return reply(`🔊 ${mention(target)} has been unmuted.`, [target]);
	}

	if (["mute", "silence"].includes(command)) {
		if (!isBotAdmin) return reply("❌ The bot must be a group admin to delete muted messages.");
		if (!target) return reply("❌ Tag a member or reply to their message: `mute @member [30m|2h|1d|forever] [reason]`.");
		if (isProtectedGroupMember(groupMetadata, target, botJids)) {
			return reply("❌ The bot, group owner and group admins cannot be muted.");
		}
		const durationIndex = args.findIndex((arg) => parseMuteDuration(arg).valid && !String(arg).startsWith("@"));
		const parsedDuration = parseMuteDuration(durationIndex >= 0 ? args[durationIndex] : "forever");
		if (!parsedDuration.valid) return reply("❌ Duration must look like `30m`, `2h`, `1d`, `1w`, or `forever` (maximum 30 days).");
		const reason = args
			.filter((arg, index) => index !== durationIndex && !String(arg).startsWith("@"))
			.join(" ")
			.trim()
			.slice(0, 200);
		const stored = mutedMembers.filter((entry) => matches(target, entry.member)).map((entry) => entry.member);
		if (stored.length) await group.updateOne({ _id: from }, { $pull: { mutedMembers: { member: { $in: stored } } } });
		const mutedUntil = parsedDuration.milliseconds ? new Date(Date.now() + parsedDuration.milliseconds) : null;
		await group.updateOne(
			{ _id: from },
			{
				$push: {
					mutedMembers: {
						$each: [{
							member: target,
							mutedBy: senderJid,
							reason,
							mutedAt: new Date(),
							mutedUntil,
						}],
						$slice: -100,
					},
				},
			},
		);
		return reply(
			`🔇 ${mention(target)} muted *${parsedDuration.label}*. Their new group messages will be deleted silently.${reason ? `\nReason: ${reason}` : ""}`,
			[target],
		);
	}
};

export default () => ({
	cmd: [
		"antistatus", "antistatusmention", "statuswarns", "statusstrikes", "clearstatuswarn", "clearstatusstrike",
		"mute", "silence", "unmute", "unsilence", "mutelist", "muted", "muteinfo",
	],
	desc: "Control status mentions and mute selected group members",
	usage: "antistatus on/off | mute @member [30m|2h|1d|forever] [reason] | unmute @member | mutelist",
	handler,
});
