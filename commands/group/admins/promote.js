import { isGroupOwner } from "../../../utils/groupParticipants.js";

const handler = async (sock, msg, from, args, msgInfoObj) => {
	const { groupMetadata, isBotAdmin, sendMessageWTyping, extendedMessageOriginal } = msgInfoObj;
	// return sendMessageWTyping(
	//     from,
	//     { text: "```❌ The admin commands are blocked for sometime to avoid ban on whatsapp!```" },
	//     { quoted: msg }
	// );

	if (!isBotAdmin) {
		return sendMessageWTyping(from, { text: "❌ I'm not admin here." }, { quoted: msg });
	}

	if (!extendedMessageOriginal) {
		return sendMessageWTyping(from, { text: "Mention or tag member." }, { quoted: msg });
	}

	const taggedJid = extendedMessageOriginal.participant || extendedMessageOriginal.mentionedJid?.[0];
	if (!taggedJid) {
		return sendMessageWTyping(from, { text: "Mention or tag member." }, { quoted: msg });
	}
	if (isGroupOwner(groupMetadata, taggedJid)) {
		return sendMessageWTyping(from, { text: "❌ *Group Owner Tagged*" }, { quoted: msg });
	}

	try {
		await sock.groupParticipantsUpdate(from, [taggedJid], "promote");
		sendMessageWTyping(from, { text: `✅ *Promoted*` }, { quoted: msg });
	} catch (err) {
		sendMessageWTyping(from, { text: err.toString() }, { quoted: msg });
		console.error(err);
	}
};

export default () => ({
	cmd: ["promote"],
	desc: "Give admin permission to a member",
	usage: "promote @mention | reply",
	handler,
});
