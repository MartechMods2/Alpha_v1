import { getGroupData, group } from "../../../db/groupData.js";
import { extractPhoneNumber } from "../../../utils/lid.js";
import { parseMuteDuration } from "../../../utils/groupSafety.js";
import { isJidGroupAdmin, isSameGroupUser } from "../../../utils/groupParticipants.js";
import {
	addModeratorAudit,
	findModeratorMute,
	isConfiguredModerator,
	isModeratorProtectedTarget,
} from "../../../utils/moderatorAuthority.js";

const targetFromContext = (context) => context?.mentionedJid?.[0] || context?.participant || "";
const mention = (jid) => `@${extractPhoneNumber(jid)}`;
const cleanReason = (args, skipIndex = -1) => args
	.filter((arg, index) => index !== skipIndex && !String(arg).startsWith("@"))
	.join(" ")
	.trim()
	.slice(0, 240);

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
	const reply = (text, mentions = []) => sendMessageWTyping(from, { text, mentions }, { quoted: msg });
	const senderCandidates = [senderJid, msg.key?.participant, msg.key?.participantPn, msg.key?.participantAlt].filter(Boolean);
	if (!isConfiguredModerator(groupMetadata, senderCandidates)) {
		return reply("👑 This is a *Moderator Override* command. Ordinary members and admins cannot use it.");
	}
	const target = targetFromContext(extendedMessageOriginal);
	if (!target) return reply("❌ Tag the target or reply to their message.");
	if (isModeratorProtectedTarget(groupMetadata, target, botJids)) {
		return reply("🛡️ Moderator Override cannot target the group owner, Alpha, creator account, or another protected Moderator.");
	}

	const data = await getGroupData(from);
	const matches = (left, right) => isSameGroupUser(groupMetadata, left, right);
	const audit = async (action, reason = "") => addModeratorAudit(from, {
		action,
		target,
		by: senderJid,
		reason,
	});

	if (["modmute", "modrestrict"].includes(command)) {
		if (!isBotAdmin) return reply("❌ Alpha must be a group admin before Moderator mute can be enforced.");
		const durationIndex = args.findIndex((arg) => parseMuteDuration(arg).valid && !String(arg).startsWith("@"));
		const parsed = parseMuteDuration(durationIndex >= 0 ? args[durationIndex] : "forever");
		if (!parsed.valid) return reply("❌ Duration must look like `30m`, `2h`, `1d`, `1w`, or `forever` (maximum 30 days).");
		const reason = cleanReason(args, durationIndex) || "Moderator override";
		const muted = findModeratorMute(data, target, groupMetadata);
		const stored = [muted.entry?.member, ...muted.expiredMembers].filter(Boolean);
		if (stored.length) await group.updateOne({ _id: from }, { $pull: { moderatorMutedMembers: { member: { $in: stored } } } });
		const mutedUntil = parsed.milliseconds ? new Date(Date.now() + parsed.milliseconds) : null;
		await group.updateOne(
			{ _id: from },
			{ $push: { moderatorMutedMembers: { $each: [{ member: target, mutedBy: senderJid, mutedAt: new Date(), mutedUntil, reason }], $slice: -100 } } },
		);
		await audit("modmute", reason);
		return reply(`👑 ${mention(target)} is now under *Moderator Mute* for *${parsed.label}*. Admin protection was overridden.\nReason: ${reason}`, [target]);
	}

	if (command === "modunmute") {
		const muted = findModeratorMute(data, target, groupMetadata);
		const stored = [muted.entry?.member, ...muted.expiredMembers].filter(Boolean);
		if (!stored.length) return reply(`🔊 ${mention(target)} has no Moderator mute.`, [target]);
		await group.updateOne({ _id: from }, { $pull: { moderatorMutedMembers: { member: { $in: stored } } } });
		await audit("modunmute");
		return reply(`👑 Moderator mute removed from ${mention(target)}.`, [target]);
	}

	if (command === "modwarn") {
		const reason = cleanReason(args) || "Moderator warning";
		const entries = Array.isArray(data?.moderatorAdminWarnings) ? data.moderatorAdminWarnings : [];
		const existing = entries.find((entry) => matches(target, entry.member));
		const count = Number(existing?.count || 0) + 1;
		if (existing) {
			await group.updateOne(
				{ _id: from, "moderatorAdminWarnings.member": existing.member },
				{ $set: { "moderatorAdminWarnings.$.count": count, "moderatorAdminWarnings.$.reason": reason, "moderatorAdminWarnings.$.by": senderJid, "moderatorAdminWarnings.$.updatedAt": new Date() } },
			);
		} else {
			await group.updateOne(
				{ _id: from },
				{ $push: { moderatorAdminWarnings: { $each: [{ member: target, count, reason, by: senderJid, updatedAt: new Date() }], $slice: -100 } } },
			);
		}
		await audit("modwarn", reason);
		return reply(`👑 *Moderator Warning ${count}* — ${mention(target)}\n${reason}`, [target]);
	}

	if (command === "modunwarn") {
		const entries = Array.isArray(data?.moderatorAdminWarnings) ? data.moderatorAdminWarnings : [];
		const stored = entries.filter((entry) => matches(target, entry.member)).map((entry) => entry.member);
		if (stored.length) await group.updateOne({ _id: from }, { $pull: { moderatorAdminWarnings: { member: { $in: stored } } } });
		await audit("modunwarn");
		return reply(`👑 Moderator warnings cleared for ${mention(target)}.`, [target]);
	}

	if (command === "moddemote") {
		if (!isBotAdmin) return reply("❌ Alpha must be a group admin to demote another admin.");
		if (!isJidGroupAdmin(groupMetadata, target)) return reply(`ℹ️ ${mention(target)} is not currently a WhatsApp admin.`, [target]);
		const reason = cleanReason(args) || "Moderator override";
		await sock.groupParticipantsUpdate(from, [target], "demote");
		await audit("moddemote", reason);
		return reply(`👑 ${mention(target)} has been demoted by Moderator Override.\nReason: ${reason}`, [target]);
	}

	if (["modkick", "modban", "modremove"].includes(command)) {
		if (!isBotAdmin) return reply("❌ Alpha must be a group admin to remove a participant.");
		const reason = cleanReason(args) || "Moderator override";
		await sock.groupParticipantsUpdate(from, [target], "remove");
		await audit(command, reason);
		return reply(`👑 ${mention(target)} removed by Moderator Override.\nReason: ${reason}`, [target]);
	}

	if (command === "modhistory") {
		const warning = (Array.isArray(data?.moderatorAdminWarnings) ? data.moderatorAdminWarnings : [])
			.find((entry) => matches(target, entry.member));
		const mute = findModeratorMute(data, target, groupMetadata).entry;
		const actions = (Array.isArray(data?.moderatorAudit) ? data.moderatorAudit : [])
			.filter((entry) => matches(target, entry.target))
			.slice(-5)
			.reverse();
		const lines = [
			`👑 *Moderator History — ${mention(target)}*`,
			`Warnings: *${Number(warning?.count || 0)}*`,
			`Moderator mute: *${mute ? "ACTIVE" : "OFF"}*`,
		];
		if (warning?.reason) lines.push(`Last warning: ${warning.reason}`);
		if (mute?.reason) lines.push(`Mute reason: ${mute.reason}`);
		if (actions.length) {
			lines.push("", "Recent override actions:");
			for (const entry of actions) lines.push(`• ${entry.action}${entry.reason ? ` — ${entry.reason}` : ""}`);
		}
		return reply(lines.join("\n"), [target]);
	}

	return reply("👑 Moderator commands: `modmute`, `modunmute`, `modwarn`, `modunwarn`, `moddemote`, `modkick`, `modban`, `modhistory`.");
};

export default () => ({
	cmd: ["modmute", "modrestrict", "modunmute", "modwarn", "modunwarn", "moddemote", "modkick", "modban", "modremove", "modhistory"],
	desc: "Moderator-only override actions that can discipline ordinary WhatsApp admins while preserving owner/creator/Moderator protections",
	usage: "modmute @admin 2h [reason] | modwarn @admin [reason] | moddemote @admin [reason] | modkick @admin [reason]",
	handler,
});
