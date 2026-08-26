import { hasDisallowedLink, getGroupSafetySettings } from "./groupSafety.js";
import {
	enforceMemberMute,
	isProtectedGroupMember,
	warnGroupMember,
	warnStatusMentionMember,
} from "./moderation.js";
import { detectSpam } from "./spamTracker.js";

export const handleAutomodMessage = async ({
	sock,
	msg,
	groupJid,
	senderJid,
	body,
	isCommand,
	isOwner,
	isGroupAdmin,
	groupData,
	groupMetadata,
	botJids,
	isBotAdmin,
	isGroupStatusMention = false,
	sendMessageWTyping,
}) => {
	if (!groupData || msg.key.fromMe || isOwner || isGroupAdmin) {
		return { handled: false };
	}
	if (isProtectedGroupMember(groupMetadata, senderJid, botJids)) {
		return { handled: false };
	}

	const muteResult = await enforceMemberMute({
		sock,
		msg,
		groupJid,
		memberJid: senderJid,
		groupData,
		groupMetadata,
		botJids,
		isBotAdmin,
	});
	if (muteResult.handled) return muteResult;

	if (isGroupStatusMention) {
		return warnStatusMentionMember({
			sock,
			msg,
			groupJid,
			memberJid: senderJid,
			groupData,
			groupMetadata,
			botJids,
			isBotAdmin,
			sendMessageWTyping,
		});
	}

	if (isCommand) return { handled: false };

	const settings = getGroupSafetySettings(groupData);
	let reason = null;
	let shouldDelete = false;

	if (settings.isAntiLinkOn && hasDisallowedLink(body, settings.allowedDomains)) {
		reason = "Links are not allowed here";
		shouldDelete = settings.antiLinkAction === "delete";
	} else if (settings.isAntiSpamOn && body) {
		reason = detectSpam({
			key: `${groupJid}:${senderJid}`,
			body,
			settings,
		});
		shouldDelete = Boolean(reason);
	}

	if (!reason) return { handled: false };

	if (shouldDelete && isBotAdmin) {
		await sock.sendMessage(groupJid, { delete: msg.key }).catch((error) =>
			console.warn("Automod could not delete message:", error.message),
		);
	}

	const result = await warnGroupMember({
		sock,
		msg,
		groupJid,
		memberJid: senderJid,
		groupData,
		groupMetadata,
		botJids,
		isBotAdmin,
		sendMessageWTyping,
		reason,
	});
	return { handled: true, ...result };
};
