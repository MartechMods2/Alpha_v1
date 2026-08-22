const handler = async (sock, msg, from, args, msgInfoObj) => {
	const { groupAdmins, botNumber, sendMessageWTyping } = msgInfoObj;

	// --- START OF FIX ---
	// Extract the pure numeric part from the bot's ID
	const botPureNumber = botNumber[0] || botNumber[1]?.split('@')[0] || sock.user.id.split('@')[0];
	
	// Check if ANY admin ID matches the bot's pure number
	const isBotAdmin = groupAdmins.some(adminId => {
		const adminPure = adminId.split('@')[0].split(':')[0]; // Handles both s.whatsapp.net and lid
		return adminPure === botPureNumber;
	});

	if (!isBotAdmin) {
		return sendMessageWTyping(from, { text: `❌ I'm not an admin here` }, { quoted: msg });
	}
	// --- END OF FIX ---

	if (!args[0]) {
		return sendMessageWTyping(from, { text: `❌ *Provide on/off*` }, { quoted: msg });
	}

	args[0] = args[0].toLowerCase();

	try {
		if (args[0] === "off") {
			sock.groupSettingUpdate(from, "announcement");
			sendMessageWTyping(from, { text: `✅ *Only Admin can send Message* ` }, { quoted: msg });
		} else if (args[0] === "on") {
			sock.groupSettingUpdate(from, "not_announcement");
			sendMessageWTyping(from, { text: `✅ *All member can send Message* ` }, { quoted: msg });
		} else {
			return sendMessageWTyping(from, { text: `❌ *Provide right args* ` }, { quoted: msg });
		}
	} catch (err) {
		sendMessageWTyping(from, { text: err.toString() }, { quoted: msg });
		console.error(err);
	}
};

export default () => ({
	cmd: ["chat"],
	desc: "Enable/disable group chat for members.",
	usage: "chat on/off",
	handler,
});
