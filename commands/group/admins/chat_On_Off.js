import { getPNFromLID } from "../../../utils/lid.js";

const handler = async (sock, msg, from, args, msgInfoObj) => {
    const { botNumber, sendMessageWTyping } = msgInfoObj;

    console.log("🔍 [DEBUG] Fetching fresh group metadata from WhatsApp...");
    let freshMetadata;
    try {
        freshMetadata = await sock.groupMetadata(from);
    } catch (err) {
        console.error("❌ Failed to fetch group metadata:", err.message);
        return sendMessageWTyping(from, { text: `❌ Failed to fetch group info.` }, { quoted: msg });
    }

    const participants = freshMetadata.participants;
    console.log("🔍 [DEBUG] Raw participant IDs:", participants.map(p => p.id));

    // Get bot's pure phone number (without :1 or @)
    const botRaw = botNumber[2] || botNumber[1]?.split('@')[0] || botNumber[0]?.split('@')[0] || sock.user.id.split('@')[0];
    const botPureNumber = botRaw.split(':')[0];
    console.log("🔍 [DEBUG] Bot pure number:", botPureNumber);

    // Resolve each participant's ID to a phone number (if it's a LID)
    const resolvedParticipants = await Promise.all(
        participants.map(async (p) => {
            let id = p.id;
            let phone = null;
            if (id.endsWith('@lid')) {
                try {
                    phone = await getPNFromLID(sock, id);
                } catch (e) {
                    console.warn(`⚠️ Could not resolve LID ${id}:`, e.message);
                }
            } else {
                // Already a phone JID (e.g., @s.whatsapp.net)
                phone = id;
            }
            return { id, phone };
        })
    );

    console.log("🔍 [DEBUG] Resolved participant phones:", resolvedParticipants.map(r => r.phone));

    // Check if bot is present by comparing resolved phone numbers
    const botPresent = resolvedParticipants.some(r => {
        if (!r.phone) return false;
        const pure = r.phone.split('@')[0].split(':')[0];
        return pure === botPureNumber;
    });
    console.log("🔍 [DEBUG] Is bot present? ", botPresent);

    if (!botPresent) {
        return sendMessageWTyping(
            from,
            { text: `❌ I'm not a member of this group (LID resolution failed). Try re-adding me.` },
            { quoted: msg }
        );
    }

    // Check if bot is admin (also need to resolve LIDs)
    const adminParticipants = participants.filter(p => p.admin === 'admin' || p.admin === 'superadmin');
    const resolvedAdmins = await Promise.all(
        adminParticipants.map(async (p) => {
            let id = p.id;
            let phone = null;
            if (id.endsWith('@lid')) {
                try {
                    phone = await getPNFromLID(sock, id);
                } catch (e) {
                    console.warn(`⚠️ Could not resolve admin LID ${id}:`, e.message);
                }
            } else {
                phone = id;
            }
            return { id, phone };
        })
    );

    const botAdmin = resolvedAdmins.some(r => {
        if (!r.phone) return false;
        const pure = r.phone.split('@')[0].split(':')[0];
        return pure === botPureNumber;
    });
    console.log("🔍 [DEBUG] Is bot admin? ", botAdmin);

    if (!botAdmin) {
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
