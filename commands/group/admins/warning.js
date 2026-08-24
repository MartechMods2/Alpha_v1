import { getGroupData } from "../../../db/groupData.js";
import { extractPhoneNumber } from "../../../utils/lid.js";
import {
	clearGroupWarnings,
	isProtectedGroupMember,
	warnGroupMember,
} from "../../../utils/moderation.js";

const handler = async (sock, msg, from, args, msgInfoObj) => {
	const {
		command,
		groupMetadata,
		botJids,
		isBotAdmin,
		sendMessageWTyping,
		extendedMessageOriginal,
	} = msgInfoObj;
	const taggedJid =
		extendedMessageOriginal?.participant || extendedMessageOriginal?.mentionedJid?.[0];
	if (!taggedJid) {
		return sendMessageWTyping(
			from,
			{ text: "❌ Mention a member or reply to their message." },
			{ quoted: msg },
		);
	}

	try {
		if (command === "unwarn") {
			await clearGroupWarnings(from, taggedJid);
			return sendMessageWTyping(
				from,
				{
					text: `✅ Warnings cleared for @${extractPhoneNumber(taggedJid)}.`,
					mentions: [taggedJid],
				},
				{ quoted: msg },
			);
		}

		if (isProtectedGroupMember(groupMetadata, taggedJid, botJids)) {
			return sendMessageWTyping(
				from,
				{ text: "❌ The bot, group owner, and admins cannot be warned." },
				{ quoted: msg },
			);
		}

		const groupData = await getGroupData(from);
		const wasMentioned = Boolean(extendedMessageOriginal?.mentionedJid?.length);
		const reason = (wasMentioned ? args.slice(1) : args)
			.join(" ")
			.trim()
			.slice(0, 300) || "Admin warning";
		return warnGroupMember({
			sock,
			msg,
			groupJid: from,
			memberJid: taggedJid,
			groupData,
			groupMetadata,
			botJids,
			isBotAdmin,
			sendMessageWTyping,
			reason,
		});
	} catch (error) {
		console.error("Warning command failed:", error);
		return sendMessageWTyping(
			from,
			{ text: `❌ Warning failed: ${error.message}` },
			{ quoted: msg },
		);
	}
};

export default () => ({
	cmd: ["warn", "unwarn"],
	desc: "Warn a member or clear their warnings",
	usage: "warn @mention [reason] | unwarn @mention | reply",
	handler,
});
