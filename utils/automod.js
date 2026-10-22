import { hasDisallowedLink, getGroupSafetySettings } from "./groupSafety.js";
import {
	enforceMemberMute,
	isProtectedGroupMember,
	warnGroupMember,
	warnStatusMentionMember,
} from "./moderation.js";
import { enforceModeratorMute } from "./moderatorAuthority.js";
import { detectSpam } from "./spamTracker.js";
import { deleteModerationMessage } from "./moderationDelete.js";

export const handleAutomodMessage = async ({
	sock, msg, groupJid, senderJid, body, isCommand, isOwner, isGroupAdmin,
	groupData, groupMetadata, botJids, isBotAdmin, isGroupStatusMention = false, sendMessageWTyping,
}) => {
	if (!groupData || msg.key.fromMe || isOwner) return { handled: false };

	// Moderator Override mute is checked before the ordinary admin exemption so a
	// configured moderator can intentionally silence members, admins, the group
	// owner, or another configured moderator. Alpha and the creator stay exempt.
	const moderatorMute = await enforceModeratorMute({
		sock, msg, groupJid, memberJid: senderJid, groupData, groupMetadata, botJids, isBotAdmin, sendMessageWTyping,
	});
	if (moderatorMute.handled) return moderatorMute;

	if (isGroupAdmin) return { handled: false };
	if (isProtectedGroupMember(groupMetadata, senderJid, botJids)) return { handled: false };

	const muteResult = await enforceMemberMute({ sock, msg, groupJid, memberJid: senderJid, groupData, groupMetadata, botJids, isBotAdmin, sendMessageWTyping });
	if (muteResult.handled) return muteResult;

	if (isGroupStatusMention) {
		return warnStatusMentionMember({ sock, msg, groupJid, memberJid: senderJid, groupData, groupMetadata, botJids, isBotAdmin, sendMessageWTyping });
	}
	const settings = getGroupSafetySettings(groupData);
	let reason = null;
	let shouldDelete = false;
	let templateKey = "warning";
	if (settings.isAntiLinkOn && hasDisallowedLink(body, settings.allowedDomains)) {
		reason = "Unapproved link detected";
		shouldDelete = settings.antiLinkAction === "delete";
		templateKey = "anti-link";
	} else if (!isCommand && settings.isAntiSpamOn && body) {
		reason = detectSpam({ key: `${groupJid}:${senderJid}`, body, settings });
		shouldDelete = Boolean(reason);
		templateKey = "anti-spam";
	}
	if (!reason) return { handled: false };
	const deletion = shouldDelete
		? await deleteModerationMessage({ sock, msg, groupJid, memberJid: senderJid, groupMetadata, botJids, isBotAdmin })
		: { status: "warn-only", deleted: false };
	if (deletion.status === "protected") return { handled: false };
	const result = await warnGroupMember({ sock, msg, groupJid, memberJid: senderJid, groupData, groupMetadata, botJids, isBotAdmin: deletion.isBotAdmin ?? isBotAdmin, sendMessageWTyping, reason, templateKey, deletion });
	return { handled: true, ...result };
};
