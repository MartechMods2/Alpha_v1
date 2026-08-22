const handler = async (sock, msg, from, args, msgInfoObj) => {
    const { botNumber, sendMessageWTyping } = msgInfoObj;

    // 1. FORCE FRESH METADATA FETCH (ignores Redis/NodeCache)
    console.log("🔍 [DEBUG] Fetching fresh group metadata from WhatsApp...");
    let freshMetadata;
    try {
        freshMetadata = await sock.groupMetadata(from);
    } catch (err) {
        console.error("❌ Failed to fetch group metadata:", err.message);
        return sendMessageWTyping(from, { text: `❌ Failed to fetch group info.` }, { quoted: msg });
    }

    // 2. LOG EVERY SINGLE PARTICIPANT (to confirm bot exists in group)
    const allParticipants = freshMetadata.participants.map(p => p.id);
    console.log("🔍 [DEBUG] ALL participants in this group:", allParticipants);

    // 3. EXTRACT BOT'S PURE NUMBER
    const botRaw = botNumber[2] || botNumber[1]?.split('@')[0] || botNumber[0]?.split('@')[0] || sock.user.id.split('@')[0];
    const botPureNumber = botRaw.split(':')[0];
    console.log("🔍 [DEBUG] Bot's pure number:", botPureNumber);

    // 4. CHECK IF BOT IS EVEN A MEMBER
    const isBotPresent = allParticipants.some(id => {
        const pure = id.split('@')[0].split(':')[0];
        return pure === botPureNumber;
    });

    console.log("🔍 [DEBUG] Is bot present in group?", isBotPresent);

    if (!isBotPresent) {
        return sendMessageWTyping(
            from,
            { text: `❌ I'm not even a member of this group! Please remove me and re-add me as admin.` },
            { quoted: msg }
        );
    }

    // 5. CHECK IF BOT IS ADMIN (using fresh data)
    const freshGroupAdmins = freshMetadata.participants
        .filter(p => p.admin === 'admin' || p.admin === 'superadmin')
        .map(p => p.id);

    const isBotAdmin = freshGroupAdmins.some(adminId => {
        const adminPure = adminId.split('@')[0].split(':')[0];
        return adminPure === botPureNumber;
    });

    console.log("🔍 [DEBUG] Fresh admin IDs:", freshGroupAdmins);
    console.log("🔍 [DEBUG] isBotAdmin:", isBotAdmin);

    if (!isBotAdmin) {
        return sendMessageWTyping(
            from,
            { text: `❌ I'm not an admin here. Please promote me first.` },
            { quoted: msg }
        );
    }

    // 6. EXECUTE THE ACTUAL COMMAND (ON/OFF)
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
