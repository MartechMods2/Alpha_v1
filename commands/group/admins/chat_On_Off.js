const handler = async (sock, msg, from, args, msgInfoObj) => {
	const { isBotAdmin, sendMessageWTyping } = msgInfoObj;

	if (!isBotAdmin) {
        return sendMessageWTyping(
            from,
            { text: `❌ I'm not an admin here. Please promote me.` },
            { quoted: msg }
        );
    }

    // === COMMAND LOGIC ===
    if (!args[0]) {
        return sendMessageWTyping(from, { text: `❌ *Provide on/off*` }, { quoted: msg });
    }

    const arg = args[0].toLowerCase();

    try {
        if (arg === "off") {
            await sock.groupSettingUpdate(from, "announcement");
            return sendMessageWTyping(from, { text: `✅ *Only Admin can send Message*` }, { quoted: msg });
        } else if (arg === "on") {
            await sock.groupSettingUpdate(from, "not_announcement");
            return sendMessageWTyping(from, { text: `✅ *All member can send Message*` }, { quoted: msg });
        } else {
            return sendMessageWTyping(from, { text: `❌ *Provide right args*` }, { quoted: msg });
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
