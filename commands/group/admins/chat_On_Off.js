const handler = async (sock, msg, from, args, msgInfoObj) => {
    const { groupAdmins, botNumber, sendMessageWTyping } = msgInfoObj;

    // Extract pure numeric part correctly
    const botRaw = botNumber[2] || botNumber[1]?.split('@')[0] || botNumber[0]?.split('@')[0] || sock.user.id.split('@')[0];
    const botPureNumber = botRaw.split(':')[0];
    
    // Check if bot is admin using pure number comparison
    const isBotAdmin = groupAdmins.some(adminId => {
        const adminPure = adminId.split('@')[0].split(':')[0];
        return adminPure === botPureNumber;
    });

    // Debug logs (visible in Render)
    console.log("🔍 [DEBUG] botPureNumber:", botPureNumber);
    console.log("🔍 [DEBUG] Admin pure numbers:", groupAdmins.map(a => a.split('@')[0].split(':')[0]));
    console.log("🔍 [DEBUG] isBotAdmin:", isBotAdmin);

    if (!isBotAdmin) {
        return sendMessageWTyping(from, { text: `❌ I'm not an admin here` }, { quoted: msg });
    }

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
