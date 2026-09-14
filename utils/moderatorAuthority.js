import { group } from "../db/groupData.js";
import { extractPhoneNumber } from "./lid.js";
import { isGroupOwner, isSameGroupUser } from "./groupParticipants.js";
import { claimDeletionBudget } from "./moderationCircuit.js";

const configuredNumbers = (name) => String(process.env[name] || "")
	.split(",")
	.map((value) => value.replace(/\D/g, ""))
	.filter(Boolean);

const moderatorNumbers = () => configuredNumbers("MODERATORS");
const ownerNumbers = () => configuredNumbers("MY_NUMBER");
const asPn = (number) => `${number}@s.whatsapp.net`;

const digitsOf = (jid) => {
	try { return String(extractPhoneNumber(jid) || "").replace(/\D/g, ""); }
	catch { return String(jid || "").replace(/\D/g, ""); }
};

export const configuredModeratorNumbers = () => moderatorNumbers();

export const isConfiguredModerator = (metadata, candidates = []) => {
	const values = (Array.isArray(candidates) ? candidates : [candidates]).filter(Boolean);
	const configured = moderatorNumbers();
	for (const candidate of values) {
		const digits = digitsOf(candidate);
		if (digits && configured.includes(digits)) return true;
		if (configured.some((number) => isSameGroupUser(metadata, candidate, asPn(number)))) return true;
	}
	return false;
};

/**
 * Moderator actions have two safety tiers:
 * - rootProtected: Alpha and the configured creator account can never be muted,
 *   warned, demoted or removed by Moderator Override.
 * - destructiveProtected: group owners and configured moderators are additionally
 *   protected from destructive actions such as demote/kick/ban, but they may be
 *   muted or warned by another configured moderator.
 */
export const getModeratorTargetProtection = (metadata, target, botJids = []) => {
	if (!target) {
		return {
			rootProtected: true,
			destructiveProtected: true,
			reason: "invalid-target",
		};
	}
	if (isSameGroupUser(metadata, target, botJids)) {
		return {
			rootProtected: true,
			destructiveProtected: true,
			reason: "alpha",
		};
	}
	if (ownerNumbers().some((number) => isSameGroupUser(metadata, target, asPn(number)))) {
		return {
			rootProtected: true,
			destructiveProtected: true,
			reason: "creator",
		};
	}
	if (isGroupOwner(metadata, target)) {
		return {
			rootProtected: false,
			destructiveProtected: true,
			reason: "group-owner",
		};
	}
	if (isConfiguredModerator(metadata, [target])) {
		return {
			rootProtected: false,
			destructiveProtected: true,
			reason: "moderator",
		};
	}
	return {
		rootProtected: false,
		destructiveProtected: false,
		reason: "ordinary",
	};
};

export const isModeratorRootProtectedTarget = (metadata, target, botJids = []) =>
	getModeratorTargetProtection(metadata, target, botJids).rootProtected;

// Backward-compatible strong protection check for destructive moderator actions.
export const isModeratorProtectedTarget = (metadata, target, botJids = []) =>
	getModeratorTargetProtection(metadata, target, botJids).destructiveProtected;

export const findModeratorMute = (groupData, memberJid, metadata) => {
	const entries = Array.isArray(groupData?.moderatorMutedMembers) ? groupData.moderatorMutedMembers : [];
	const now = Date.now();
	const expiredMembers = [];
	let entry = null;
	for (const item of entries) {
		if (!isSameGroupUser(metadata, memberJid, item?.member)) continue;
		if (item?.mutedUntil && new Date(item.mutedUntil).getTime() <= now) expiredMembers.push(item.member);
		else if (!entry) entry = item;
	}
	return { entry, expiredMembers };
};

export const enforceModeratorMute = async ({
	sock, msg, groupJid, memberJid, groupData, groupMetadata, botJids = [], isBotAdmin,
}) => {
	// Soft Moderator mutes intentionally apply to members, ordinary admins,
	// group owners and configured moderators. Only Alpha and the creator account
	// remain absolutely exempt from Moderator mute enforcement.
	if (isModeratorRootProtectedTarget(groupMetadata, memberJid, botJids)) return { handled: false };
	const muted = findModeratorMute(groupData, memberJid, groupMetadata);
	if (muted.expiredMembers.length) {
		await group.updateOne(
			{ _id: groupJid },
			{ $pull: { moderatorMutedMembers: { member: { $in: muted.expiredMembers } } } },
		);
	}
	if (!muted.entry) return { handled: false };
	if (isBotAdmin && claimDeletionBudget(groupJid)) {
		await sock.sendMessage(groupJid, { delete: msg.key }).catch((error) =>
			console.warn("Could not delete moderator-muted message:", error.message));
	}
	return { handled: true, moderatorMuted: true };
};

export const addModeratorAudit = async (groupJid, entry) => group.updateOne(
	{ _id: groupJid },
	{
		$push: {
			moderatorAudit: {
				$each: [{ ...entry, at: new Date() }],
				$slice: -100,
			},
		},
	},
);
