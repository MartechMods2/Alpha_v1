const handler = async (sock, msg, from, args, msgInfoObj) => {
    const { botNumber, sendMessageWTyping } = msgInfoObj;

    // --- FORCE LIVE FETCH: Ignore stale cache ---
    console.log("🔍 [DEBUG] Fetching fresh group metadata from WhatsApp...");
    let freshMetadata;
    try {
        freshMetadata = await sock.groupMetadata(from);
    } catch (err) {
        console.error("❌ Failed to fetch group metadata:", err.message);
        return sendMessageWTyping(from, { text: `❌ Failed to fetch group info.` }, { quoted: msg });
    }

    // Extract admin JIDs from fresh metadata
    const freshGroupAdmins = freshMetadata.participants
        .filter(p => p.admin === 'admin' || p.admin === 'superadmin')
        .map(p => p.id);

    console.log("🔍 [DEBUG] Fresh admin IDs:", freshGroupAdmins);

    // Extract the bot's pure number
    const botRaw = botNumber[2] || botNumber[1]?.split('@')[0] || botNumber[0]?.split('@')[0] || sock.user.id.split('@')[0];
    const botPureNumber = botRaw.split(':')[0];

    // Check if the bot is an admin in the fresh list
    const isBotAdmin = freshGroupAdmins.some(adminId => {
        const adminPure = adminId.split('@')[0].split(':')[0];
        return adminPure === botPureNumber;
    });

    console.log("🔍 [DEBUG] botPureNumber:", botPureNumber);
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
