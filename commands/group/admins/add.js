import { normalizeJID } from "../../../utils/lid.js";

const handler = async (sock, msg, from, args, msgInfoObj) => {
	const { evv, isBotAdmin, sendMessageWTyping, extendedMessageOriginal } = msgInfoObj;

	if (!isBotAdmin) {
		return sendMessageWTyping(from, { text: "❌ Bot needs to be admin to add members." }, { quoted: msg });
	}
	if (!evv && !extendedMessageOriginal && !args[0]) {
		return sendMessageWTyping(
			from,
			{ text: "❌ Provide a number or reply to a member's message." },
			{ quoted: msg }
		);
	}

	let participant =
		(extendedMessageOriginal &&
			(extendedMessageOriginal.participant || extendedMessageOriginal.mentionedJid?.[0])) ||
		(evv || args[0] || "").split(" ").join("");
	if (participant.startsWith("@")) {
		return sendMessageWTyping(
			from,
			{ text: "Don't tag or mentions, provide the number in text." },
			{ quoted: msg }
		);
	}

	participant = participant.replace(/[^0-9@.a-z]/gi, "");
	// Use normalizeJID for LID/PN support
	participant = await normalizeJID(sock, participant);

	try {
		const res = await sock.groupParticipantsUpdate(from, [participant], "add");
		const status = res[0].status;
		const statusMessages = {
			400: "❌ Invalid number, include country code.",
			403: "❌ Number has privacy setting on adding to group.",
			408: "❌ Number has left the group recently.",
			409: "❌ Number is already in group.",
			500: "❌ Group is full.",
			200: "✅ Number added to group.",
		};
		const text = statusMessages[status] || "❌ An error has occurred. Try again later.";
		sendMessageWTyping(from, { text: text }, { quoted: msg });
	} catch (error) {
		sendMessageWTyping(from, { text: error.toString() }, { quoted: msg });
		console.error(error);
	}
};

export default () => ({
	cmd: ["add"],
	desc: "Add a member to group.",
	usage: "add number | reply",
	handler,
});
