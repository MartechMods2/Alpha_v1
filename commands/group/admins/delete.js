import { isSameGroupUser } from "../../../utils/groupParticipants.js";

const handler = async (sock, msg, from, args, msgInfoObj) => {
	let { groupMetadata, botJids, isBotAdmin, sendMessageWTyping, extendedMessageOriginal } = msgInfoObj;

	try {
		if (!extendedMessageOriginal) {
			return sendMessageWTyping(from, { text: `❌ Reply on a message to delete.` }, { quoted: msg });
		}

		const participant = extendedMessageOriginal.participant;
		const isBotMessage = isSameGroupUser(groupMetadata, participant, botJids);
		if (!isBotMessage) {
			if (!isBotAdmin)
				return sendMessageWTyping(
					from,
					{ text: `❌ Bot need to be admin in order to delete messages.` },
					{ quoted: msg }
				);
		}

		let options = {
			remoteJid: from,
			fromMe: false,
			id: extendedMessageOriginal.stanzaId,
			participant: extendedMessageOriginal.participant,
		};

		if (isBotMessage) {
			options.fromMe = true;
		}

		sendMessageWTyping(from, { delete: options });
	} catch (err) {
		console.log(err);
		sendMessageWTyping(from, { text: err.toString() }, { quoted: msg });
	}
};

export default () => ({
	cmd: ["delete"],
	desc: "Delete a message",
	usage: "delete | reply to message to delete",
	handler,
});
