import { getGroupData, group } from "../../../db/groupData.js";
import { extractPhoneNumber } from "../../../utils/lid.js";
import { parseMuteDuration } from "../../../utils/groupSafety.js";
import {
	isJidGroupAdmin,
	isSameGroupUser,
	participantJids,
} from "../../../utils/groupParticipants.js";
import {
	addModeratorAudit,
	findModeratorMute,
	getModeratorTargetProtection,
	isConfiguredModerator,
} from "../../../utils/moderatorAuthority.js";

const targetFromContext = (context) => context?.mentionedJid?.[0] || context?.participant || "";
const mention = (jid) => `@${extractPhoneNumber(jid)}`;
const cleanReason = (args, skipIndex = -1) => args
	.filter((arg, index) => index !== skipIndex && !String(arg).startsWith("@"))
	.join(" ")
	.trim()
	.slice(0, 240);

const resolveLiveTarget = (metadata, rawTarget) => {
	if (!rawTarget) return "";
	for (const participant of metadata?.participants || []) {
		const aliases = participantJids(participant);
		if (!aliases.length || !isSameGroupUser(metadata, rawTarget, aliases)) continue;
		return aliases.find((jid) => jid.endsWith("@s.whatsapp.net") || jid.endsWith("@hosted"))
			|| aliases.find((jid) => jid.endsWith("@lid") || jid.endsWith("@hosted.lid"))
			|| rawTarget;
	}
	return rawTarget;
};

const destructiveProtectionMessage = (reason) => {
	if (reason === "group-owner") return "🛡️ Moderator Override cannot demote or remove the group owner.";
	if (reason === "moderator") return "🛡️ Moderator Override cannot demote or remove another protected Moderator.";
	return "🛡️ Moderator Override cannot target Alpha or the creator account with destructive actions.";
};

const handler = async (sock, msg, from, args, msgInfoObj) => {
	const {
		command,
		extendedMessageOriginal,
		groupMetadata,
		botJids,
		senderJid,
		sendMessageWTyping,
	} = msgInfoObj;
	const reply = (text, mentions = []) => sendMessageWTyping(from, { text, mentions }, { quoted: msg });
	let metadata = groupMetadata;
	try {
		const fresh = await sock.groupMetadata(from);
		if (fresh?.participants) metadata = fresh;
	} catch (error) {
		console.warn("Moderator Override could not refresh group metadata:", error.message);
	}
	const botIsAdmin = isJidGroupAdmin(metadata, botJids);
	const senderCandidates = [senderJid, msg.key?.participant, msg.key?.participantPn, msg.key?.participantAlt].filter(Boolean);
	if (!isConfiguredModerator(metadata, senderCandidates)) {
		return reply("👑 This is a *Moderator Override* command. Ordinary members and admins cannot use it.");
	}
	const rawTarget = targetFromContext(extendedMessageOriginal);
	if (!rawTarget) return reply("❌ Tag the target or reply to their message.");
	const target = resolveLiveTarget(metadata, rawTarget);
	const protection = getModeratorTargetProtection(metadata, target, botJids);
	const softDisciplineCommands = new Set(["modmute", "modrestrict", "modwarn"]);
	const destructiveCommands = new Set(["moddemote", "modkick", "modban", "modremove"]);

	// Moderator mute/warn are soft override actions. They may target ordinary
	// members, WhatsApp admins, the group owner and other configured moderators.
	// Alpha and the configured creator account remain absolutely protected.
	if (softDisciplineCommands.has(command) && protection.rootProtected) {
		return reply("🛡️ Moderator mute/warn cannot target Alpha or the creator account.");
	}
	if (destructiveCommands.has(command) && protection.destructiveProtected) {
		return reply(destructiveProtectionMessage(protection.reason));
	}

	const data = await getGroupData(from);
	const matches = (left, right) => isSameGroupUser(metadata, left, right);
	const audit = async (action, reason = "") => addModeratorAudit(from, {
		action,
		target,
		by: senderJid,
		reason,
	});

	if (["modmute", "modrestrict"].includes(command)) {
		if (!botIsAdmin) return reply("❌ Alpha must be a group admin before Moderator mute can be enforced.");
		const durationIndex = args.findIndex((arg) => parseMuteDuration(arg).valid && !String(arg).startsWith("@"));
		const parsed = parseMuteDuration(durationIndex >= 0 ? args[durationIndex] : "forever");
		if (!parsed.valid) return reply("❌ Duration must look like `30m`, `2h`, `1d`, `1w`, or `forever` (maximum 30 days).");
		const reason = cleanReason(args, durationIndex) || "Moderator override";
		const muted = findModeratorMute(data, target, metadata);
		const stored = [muted.entry?.member, ...muted.expiredMembers].filter(Boolean);
		if (stored.length) await group.updateOne({ _id: from }, { $pull: { moderatorMutedMembers: { member: { $in: stored } } } });
		const mutedUntil = parsed.milliseconds ? new Date(Date.now() + parsed.milliseconds) : null;
		await group.updateOne(
			{ _id: from },
			{ $push: { moderatorMutedMembers: { $each: [{ member: target, mutedBy: senderJid, mutedAt: new Date(), mutedUntil, reason }], $slice: -100 } } },
		);
		await audit("modmute", reason);
		return reply(`👑 ${mention(target)} is now under *Moderator Mute* for *${parsed.label}*.\nReason: ${reason}`, [target]);
	}

	if (command === "modunmute") {
		const muted = findModeratorMute(data, target, metadata);
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
		if (!botIsAdmin) return reply("❌ Alpha must be a group admin to demote another admin.");
		if (!isJidGroupAdmin(metadata, target)) return reply(`ℹ️ ${mention(target)} is not currently a WhatsApp admin.`, [target]);
		const reason = cleanReason(args) || "Moderator override";
		await sock.groupParticipantsUpdate(from, [target], "demote");
		await audit("moddemote", reason);
		return reply(`👑 ${mention(target)} has been demoted by Moderator Override.\nReason: ${reason}`, [target]);
	}

	if (["modkick", "modban", "modremove"].includes(command)) {
		if (!botIsAdmin) return reply("❌ Alpha must be a group admin to remove a participant.");
		const reason = cleanReason(args) || "Moderator override";
		await sock.groupParticipantsUpdate(from, [target], "remove");
		await audit(command, reason);
		return reply(`👑 ${mention(target)} removed by Moderator Override.\nReason: ${reason}`, [target]);
	}

	if (command === "modhistory") {
		const warning = (Array.isArray(data?.moderatorAdminWarnings) ? data.moderatorAdminWarnings : [])
			.find((entry) => matches(target, entry.member));
		const mute = findModeratorMute(data, target, metadata).entry;
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
	desc: "Moderator-only override actions: soft mute/warn can discipline members and admins while destructive actions keep owner/creator/Moderator protections",
	usage: "modmute @member 2h [reason] | modwarn @member [reason] | moddemote @admin [reason] | modkick @admin [reason]",
	handler,
});
