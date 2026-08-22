const handler = async (sock, msg, from, args, msgInfoObj) => {
    const { sendMessageWTyping, botNumber, extendedMessageOriginal } = msgInfoObj;

    // ===== BOT ADMIN CHECK (LID-SAFE) =====
    let freshMetadata;
    try {
        freshMetadata = await sock.groupMetadata(from);
    } catch (err) {
        console.error("Failed to fetch group metadata:", err.message);
        return sendMessageWTyping(from, { text: `❌ Failed to fetch group info.` }, { quoted: msg });
    }
    const botRaw = botNumber[2] || botNumber[1]?.split('@')[0] || botNumber[0]?.split('@')[0] || sock.user.id.split('@')[0];
    const botPureNumber = botRaw.split(':')[0];
    const isBotAdmin = freshMetadata.participants.some(p => {
        if (p.admin !== 'admin' && p.admin !== 'superadmin') return false;
        const idToCheck = p.phoneNumber || p.id;
        const pure = idToCheck.split('@')[0].split(':')[0];
        return pure === botPureNumber;
    });
    if (!isBotAdmin) {
        return sendMessageWTyping(from, { text: `❌ I'm not admin here.` }, { quoted: msg });
    }
    // ===== END =====

    if (!extendedMessageOriginal) {
        return sendMessageWTyping(from, { text: "Mention or tag member." }, { quoted: msg });
    }

    const taggedJid = extendedMessageOriginal.participant || extendedMessageOriginal.mentionedJid?.[0];
    if (!taggedJid) {
        return sendMessageWTyping(from, { text: "Mention or tag member." }, { quoted: msg });
    }
    if (taggedJid === freshMetadata.owner) {
        return sendMessageWTyping(from, { text: "❌ *Group Owner Tagged*" }, { quoted: msg });
    }

    try {
        await sock.groupParticipantsUpdate(from, [taggedJid], "demote");
        sendMessageWTyping(from, { text: "✅ *Demoted*" }, { quoted: msg });
    } catch (err) {
        sendMessageWTyping(from, { text: err.toString() }, { quoted: msg });
        console.error(err);
    }
};

export default () => ({
    cmd: ["demote"],
    desc: "Remove admin permission of a member",
    usage: "demote @mention | reply",
    handler,
});
