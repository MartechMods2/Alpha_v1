import { group } from "../db/groupData.js";
import { isSameGroupUser } from "./groupParticipants.js";
import { deleteModerationMessage, notifyDeletionProblem } from "./moderationDelete.js";
import {
	configuredModeratorNumbers,
	getModeratorTargetProtection,
	isConfiguredModerator,
	isModeratorProtectedTarget,
	isModeratorRootProtectedTarget,
} from "./moderatorProtection.js";

export {
	configuredModeratorNumbers,
	getModeratorTargetProtection,
	isConfiguredModerator,
	isModeratorProtectedTarget,
	isModeratorRootProtectedTarget,
};

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
	sock, msg, groupJid, memberJid, groupData, groupMetadata, botJids = [], isBotAdmin, sendMessageWTyping,
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
	const deletion = await deleteModerationMessage({ sock, msg, groupJid, memberJid, groupMetadata, botJids, isBotAdmin, allowAdminTarget: true });
	await notifyDeletionProblem({ result: deletion, groupJid, sendMessageWTyping });
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
