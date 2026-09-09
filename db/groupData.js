import mdClient from "./client.js";

const group = mdClient.db("MyBotDataDB").collection("Groups");

const createGroupData = async (groupJid, groupMetadata) => {
  try {
    const res = await group.findOne({ _id: groupJid });
    if (res == null) {
      await group.insertOne({
        _id: groupJid,
        isBotOn: false,
        isImgOn: false,
        isChatBotOn: false,
        alphaMode: "smart",
        alphaMemoryLimit: 5,
        alphaDailyQuota: 10,
        alphaImageOn: true,
        alphaVoiceOn: false,
        alphaDocOn: false,
        alphaStickerOn: true,
        alphaPersonality: "funny",
        alphaResponseLength: "short",
        alphaQuietStart: "",
        alphaQuietEnd: "",
        alphaAccessMode: "everyone",
        alphaAllowedMembers: [],
        alphaDeniedMembers: [],
        humanEngagementEnabled: false,
        humanEngagementLevel: "balanced",
        humanSilenceMinutes: 75,
        humanDailyLimit: 3,
        humanActiveJoinEnabled: true,
        humanAdminReminderEnabled: true,
        humanAdminReminderTime: "21:30",
        is91Only: false,
        isRankNotifOn: false,
        grpName: groupMetadata.subject,
        desc: groupMetadata.desc ? groupMetadata.desc.toString() : "",
        cmdBlocked: [],
        welcome: "",
        isWelcomeOn: false,
        goodbye: "",
        isGoodbyeOn: false,
        isAntiLinkOn: false,
        antiLinkAction: "warn",
        allowedDomains: [],
        isAntiSpamOn: false,
        isAntiStatusMentionOn: false,
        spamLimit: 6,
        spamWindowSeconds: 12,
        duplicateLimit: 3,
        warningLimit: 3,
        warningAction: "remove",
        statusMentionWarningLimit: 3,
        statusMentionWarnCount: [],
        mutedMembers: [],
        rules: "",
        totalMsgCount: 0,
        memberWarnCount: [],
        members: [],
        chatHistory: [],
      });
    } else {
      await group.updateOne(
        { _id: groupJid },
        { $set: { grpName: groupMetadata.subject, desc: groupMetadata.desc ? groupMetadata.desc.toString() : "" } },
      );
    }
  } catch (err) {
    console.error("[groupDataDb error]", err.message);
  }
};

const getGroupData = async (groupJid) => {
  try { return await group.findOne({ _id: groupJid }); }
  catch (err) { console.error("[groupDataDb error]", err.message); return -1; }
};

export { getGroupData, createGroupData, group };
