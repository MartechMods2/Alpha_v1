const handler = async (sock, msg, from, args, msgInfoObj) => {
	const { groupAdmins, botNumber, sendMessageWTyping } = msgInfoObj;

	// --- FIX: Extract pure numeric part correctly ---
	// botNumber[2] is the raw number (e.g., "2348031748860")
	// botNumber[0] is the full JID (e.g., "2348031748860@s.whatsapp.net")
	// We prioritize the raw number, then strip anything that isn't a digit.
	const botRaw = botNumber[2] || botNumber[1]?.split('@')[0] || botNumber[0]?.split('@')[0] || sock.user.id.split('@')[0];
	const botPureNumber = botRaw.split(':')[0]; // Removes ":1" suffix if present
	
	// Check if ANY admin ID matches the bot's pure number
	const isBotAdmin = groupAdmins.some(adminId => {
		const adminPure = adminId.split('@')[0].split(':')[0];
		return adminPure === botPureNumber;
	});

	// --- CONSOLE LOG for debugging (you asked where to put it — right here!) ---
	console.log("🔍 [DEBUG] botPureNumber:", botPureNumber);
	console.log("🔍 [DEBUG] Admin pure numbers:", groupAdmins.map(a => a.split('@')[0].split(':')[0]));
	console.log("🔍 [DEBUG] isBotAdmin:", isBotAdmin);
	// ---------------------------------------------------------------------------

	if (!isBotAdmin) {
		return sendMessageWTyping(from, { text: `❌ I'm not an admin here` }, { quoted: msg });
	}

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
});		console.error(err);
	}
};

export default () => ({
	cmd: ["chat"],
	desc: "Enable/disable group chat for members.",
	usage: "chat on/off",
	handler,
});
