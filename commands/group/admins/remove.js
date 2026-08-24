import { config } from "dotenv";
import {
	isGroupOwner,
	isJidGroupAdmin,
	isSameGroupUser,
} from "../../../utils/groupParticipants.js";
config();
const myNumbers = (process.env.MY_NUMBER || "")
	.split(",")
	.map((number) => number.replace(/[^0-9]/g, ""))
	.filter(Boolean)
	.map((number) => `${number}@s.whatsapp.net`);

const handler = async (sock, msg, from, args, msgInfoObj) => {
	const { sendMessageWTyping, groupMetadata, botJids, isBotAdmin, extendedMessageOriginal } = msgInfoObj;
	// return sendMessageWTyping(
	//     from,
	//     { text: "```❌ The admin commands are blocked for sometime to avoid ban on whatsapp!```" },
	//     { quoted: msg }
	// );

	if (!isBotAdmin) {
		return sendMessageWTyping(from, { text: `❌ I'm not admin here` }, { quoted: msg });
	}

	if (!extendedMessageOriginal) {
		return sendMessageWTyping(from, { text: `*Mention or tag member.*` }, { quoted: msg });
	}

	const taggedJid = extendedMessageOriginal.participant || extendedMessageOriginal.mentionedJid?.[0];
	if (!taggedJid) {
		return sendMessageWTyping(from, { text: `*Mention or tag member.*` }, { quoted: msg });
	}

	if (
		isGroupOwner(groupMetadata, taggedJid) ||
		myNumbers.some((ownerJid) => isSameGroupUser(groupMetadata, taggedJid, ownerJid)) ||
		isSameGroupUser(groupMetadata, taggedJid, botJids) ||
		isJidGroupAdmin(groupMetadata, taggedJid)
	) {
		return sendMessageWTyping(from, { text: `❌ *Can't remove Bot/Owner/admin*` }, { quoted: msg });
	}

	try {
		await sock
			.groupParticipantsUpdate(from, [taggedJid], "remove")
			.then(() => {
				sendMessageWTyping(from, { text: `✅ *Removed*` }, { quoted: msg });
			})
			.catch((err) => {
				console.log(err);
			});
	} catch (err) {
		sendMessageWTyping(from, { text: err.toString() }, { quoted: msg });
		console.log(err);
	}
};

export default () => ({
	cmd: ["remove", "kick", "ban"],
	desc: "Remove a member from group.",
	usage: "remove @mention | reply",
	handler,
});
