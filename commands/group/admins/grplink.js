const handler = async (sock, msg, from, args, msgInfoObj) => {
	const { isBotAdmin, sendMessageWTyping } = msgInfoObj;

	if (!isBotAdmin) {
		return sendMessageWTyping(from, { text: `❌ I'm not admin here` }, { quoted: msg });
	}

	try {
		const gc_invite_code = await sock.groupInviteCode(from);
		const gc_link = `https://chat.whatsapp.com/${gc_invite_code}`;
		sendMessageWTyping(from, { text: gc_link, detectLinks: true }, { quoted: msg });
	} catch (err) {
		sendMessageWTyping(from, { text: err.toString() }, { quoted: msg });
		console.error(err);
	}
};

export default () => ({
	cmd: ["link"],
	desc: "Get Group Link",
	usage: "link",
	handler,
});
